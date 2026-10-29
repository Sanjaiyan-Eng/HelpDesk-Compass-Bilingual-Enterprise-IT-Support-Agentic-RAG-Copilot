# HelpDesk Compass

### Bilingual (日本語 / English) Enterprise IT Support Agentic RAG Copilot

> *Grounded answers with citations, in Japanese and English. When the evidence is weak, it says so instead of guessing.*
> *根拠に基づく回答と出典表示を、日本語と英語で。確信が持てないときは、推測せずにお伝えします。*

An end-to-end **Forward Deployed Engineer (FDE) project** that turns a notebook-style Agentic RAG workflow into a deployable, bilingual internal product using **LangGraph, FastAPI, Pinecone, Groq, Tavily, HTML, CSS, and JavaScript**.

**Why "Compass"?** A compass gives direction. HelpDesk Compass points employees to the right answer from trusted sources, and points them to a human when the evidence is not strong enough.

---

## 日本語概要 (Japanese Summary)

**HelpDesk Compass** は、社内IT部門(情シス)向けのバイリンガル(日本語/英語)対応 Agentic RAG コパイロットです。

- まず社内ナレッジベース(Pinecone)を検索し、取得した根拠が十分かを評価してから回答します。
- 根拠が弱い場合のみ、Web 検索(Tavily)を利用します。
- それでも不十分な場合は、クエリを書き換えて再検索します。
- 最終的に根拠が得られない場合は、推測で答えず、ITサービスデスクへの問い合わせを案内します。
- 質問された言語(日本語または英語)で回答し、日本語の質問で英語のマニュアルを検索することもできます。

---

## 1. Business Problem

### Customer
**superNovaRetail Japan (ノヴァリテール)**, a fictional 3,000-employee retail company with staff who work in both Japanese and English.

### Problem
The internal IT team (情シス) is small and maintains many documents: VPN instructions, password rules, MFA policy, software installation rules, laptop troubleshooting guides, and service-desk runbooks. These documents exist in **both Japanese and English**, and some live in PDF or Word files.

Employees still create repetitive support tickets because:

- They do not know where the correct document is.
- Traditional keyword search returns too many results, and it fails when the question and the document are in different languages.
- A normal chatbot may hallucinate an answer, and a confident wrong answer is costly in a business setting.
- Internal documents can be incomplete or outdated.
- Some questions require current vendor information from the public web.

### Example
An employee asks:

> **"How do I connect to the company VPN from home?"**
> **「自宅から会社のVPNに接続するにはどうすればよいですか?」**

The answer exists in the private company KB, so the system should **not search the public internet**. It replies in the language of the question, even if the source document is in the other language.

Another employee asks:

> **"What is the latest Microsoft Teams outage guidance?"**
> **「Microsoft Teams の最新の障害対応ガイダンスを教えてください。」**

The internal KB may not contain current outage information. The system should recognize weak private evidence, use an external search, grade that evidence, and answer with an external-source warning.

### Business Goal
Build a secure, bilingual IT Support Copilot that:

1. Understands questions in Japanese and English.
2. Searches trusted private knowledge first, across both languages.
3. Checks whether retrieved evidence is good enough.
4. Uses web search only when private knowledge is insufficient.
5. Rewrites weak queries and retries.
6. Generates grounded answers in the user's language, with source citations.
7. Shows the decision path for transparency and debugging.
8. Lets authorized staff add new company documents in either language.

---



## 2. Simple Architecture

```text
                   ┌─────────────────────┐
                   │   Employee / User   │
                   │    (日本語 / EN)     │
                   └──────────┬──────────┘
                              │
                              ▼
                   ┌─────────────────────┐
                   │ HTML/CSS/JavaScript │
                   │   Web UI (JA / EN)  │
                   └──────────┬──────────┘
                              │ POST /api/chat
                              ▼
                   ┌─────────────────────┐
                   │       FastAPI       │
                   └──────────┬──────────┘
                              │
                              ▼
                   ┌─────────────────────┐
                   │     LangGraph       │
                   │ Agentic RAG Control │
                   │ (language-aware)    │
                   └──────────┬──────────┘
                              │
               ┌──────────────┴──────────────┐
               │                             │
               ▼                             ▼
       ┌───────────────┐              ┌──────────────┐
       │ Private KB    │              │ Tavily Web   │
       │ Pinecone      │              │ Search       │
       │ (JA + EN docs)│              │              │
       └───────┬───────┘              └──────┬───────┘
               │                             │
               └──────────────┬──────────────┘
                              ▼
                     ┌────────────────┐
                     │ Groq LLM       │
                     │ Grounded Answer│
                     │ + Citations    │
                     └────────────────┘
```

---

## 4. Agentic RAG Workflow

This follows the same core implementation pattern as the reference notebook, with language handling added at the start and a clear end state when evidence is insufficient.

```text
Question (日本語 or English)
   ↓
[0] Detect Language (answer in the same language)
   ↓
[1] Route Question
   ├── Greeting / simple chat ─────────────→ Direct Answer
   │
   └── IT support question
                ↓
[2] Retrieve from Private Pinecone KB
    (multilingual embeddings: JA ↔ EN)
                ↓
[3] Grade Private Evidence
       ┌────────┴────────┐
       │                 │
     GOOD               WEAK
       │                 │
       ▼                 ▼
Generate from KB    [4] Tavily Web Search
  + citations            ↓
                  [5] Grade Web Evidence
                    ┌────┴─────┐
                    │          │
                  GOOD        WEAK
                    │          │
                    ▼          ▼
              Generate Web  [6] Rewrite Query
              (with warning)   ↓
                         Retry Private KB
                               ↓
                        Max retry reached?
                               ↓
                    Insufficient Evidence
                    → advise contacting the IT service desk
```

### Why Agentic?

Normal RAG does approximately this:

```text
Question → Retrieve → Generate
```

This project makes decisions:

```text
Question
 → Detect language
 → Route
 → Retrieve
 → Evaluate evidence
 → Choose KB or Web
 → Rewrite if needed
 → Retry
 → Generate grounded answer (or admit insufficient evidence)
```

The system therefore controls **what to do next** based on its current state.

---

## 5. Bilingual (日本語 / English) Support

| Capability | How it works | Where to implement |
|---|---|---|
| Language detection | Detect Japanese vs. English at the start of the graph and carry `language` in the LangGraph state | `app/rag/state.py`, `app/rag/workflow.py` |
| Answer in the user's language | Pass the detected language into the generation prompt; keep Japanese answers in polite (です/ます) tone | `app/rag/workflow.py` |
| Cross-lingual retrieval | A multilingual embedding model places Japanese and English text in the same vector space, so a Japanese question can find an English document and vice versa | `app/rag/vectorstore.py`, `EMBEDDING_MODEL` |
| Japanese-aware chunking | Add Japanese sentence separators (`。`, `、`) to the text splitter, because Japanese has no spaces between words | `app/services/ingestion.py` |
| Bilingual knowledge base | Sample handbook and runbook provided in both languages | `data/sample_kb/` |
| Bilingual UI | Language toggle, Japanese/English placeholder text, and sample question buttons | `templates/index.html`, `static/js/app.js` |
| Citations | Every grounded answer lists the source document so users can verify it | `app/rag/workflow.py`, API response |

Example Japanese-aware splitter configuration:

```python
from langchain_text_splitters import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    chunk_size=800,
    chunk_overlap=120,
    separators=["\n\n", "\n", "。", "、", ". ", " ", ""],
)
```

---

## 6. Main Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Agent workflow | LangGraph | Stateful routing and conditional decisions |
| LLM | Groq | Routing, grading, rewriting, answer generation (Japanese and English) |
| Embeddings | HuggingFace `paraphrase-multilingual-MiniLM-L12-v2` | Local multilingual embeddings (384 dimensions, covers Japanese and English) |
| Vector DB | Pinecone (dimension 384, cosine metric) | Private enterprise knowledge base |
| External search | Tavily | Fallback when company KB is insufficient |
| API | FastAPI | Backend and REST endpoints |
| Frontend | HTML/CSS/JavaScript | Bilingual employee-facing interface |
| Audit | SQLite | Basic decision-path logging |
| Packaging | Docker | Reproducible deployment |

---

## 7. Project Structure

```text
HelpDesk_Compass/
│
├── app/
│   ├── api/
│   │   └── routes.py              # Chat, health and ingestion APIs
│   │
│   ├── core/
│   │   ├── config.py              # Environment configuration
│   │   └── logging.py             # Logging configuration
│   │
│   ├── rag/
│   │   ├── state.py               # LangGraph state (includes language) + structured decisions
│   │   ├── vectorstore.py         # Pinecone + multilingual embeddings
│   │   └── workflow.py            # Complete bilingual Agentic RAG graph
│   │
│   ├── services/
│   │   ├── audit.py               # SQLite query audit
│   │   └── ingestion.py           # PDF/TXT/MD/DOCX loading + Japanese-aware chunking
│   │
│   └── main.py                    # FastAPI application
│
├── data/
│   └── sample_kb/
│       ├── company_it_handbook.md        # English
│       ├── company_it_handbook_ja.md     # 日本語 (add)
│       ├── service_desk_runbook.md       # English
│       └── service_desk_runbook_ja.md    # 日本語 (add)
│
├── static/
│   ├── css/style.css
│   └── js/app.js                  # Includes JA/EN toggle
│
├── templates/
│   └── index.html
│
├── tests/
│   └── test_ingestion.py
│
├── uploads/
├── .env.example
├── Dockerfile
├── ingest_sample_kb.py
├── requirements.txt
├── run.py
└── README.md
```

---

## 8. Setup

### Step 1 — Create virtual environment

```bash
python -m venv venv
```

Windows:

```bash
venv\Scripts\activate
```

macOS/Linux:

```bash
source venv/bin/activate
```

### Step 2 — Install dependencies

```bash
pip install -r requirements.txt
```

### Step 3 — Configure environment

Create a `.env` file in the project root directory with the following variables:

```env
# LLM
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=openai/gpt-oss-20b

# External Search
TAVILY_API_KEY=your_tavily_api_key_here

# Vector Database (Pinecone)
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX_NAME=helpdesk-compass
PINECONE_NAMESPACE=company-it-kb

# Embeddings (multilingual, 384 dimensions)
EMBEDDING_MODEL=sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2

# Security
ADMIN_API_KEY=change-me-in-production

# Application Settings
APP_ENV=development
```

#### Environment Variable Reference

| Variable | Description | Example | Required |
|---|---|---|---|
| `GROQ_API_KEY` | API key for Groq LLM (routing, grading, generation) | `gsk_...` | ✅ Yes |
| `TAVILY_API_KEY` | API key for Tavily web search | `tvly-...` | ✅ Yes |
| `PINECONE_API_KEY` | API key for Pinecone vector database | `pckey-...` | ✅ Yes |
| `PINECONE_INDEX_NAME` | Pinecone index name | `helpdesk-compass` | ⚠️ Optional (default: `helpdesk-compass`) |
| `PINECONE_NAMESPACE` | Pinecone namespace for document isolation | `company-it-kb` | ⚠️ Optional (default: `company-it-kb`) |
| `GROQ_MODEL` | Groq model identifier | `openai/gpt-oss-20b` | ⚠️ Optional (default: `openai/gpt-oss-20b`) |
| `EMBEDDING_MODEL` | Multilingual embedding model (must match the Pinecone index dimension) | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` | ⚠️ Optional (default shown) |
| `ADMIN_API_KEY` | Secret key for admin endpoints (document ingestion) | `your-secure-key` | ⚠️ Optional (default: `change-me`) |
| `APP_ENV` | Application environment | `development` or `production` | ⚠️ Optional (default: `development`) |

**⚠️ Important Security Notes:**

- Never commit `.env` to version control. Add it to `.gitignore`.
- Change `ADMIN_API_KEY` to a secure random value in production.
- Use environment variables instead of hardcoding secrets.
- Restrict API key access to only the services that need them.
- Choose the Pinecone region deliberately, and review data-residency and data-protection requirements (for example Japan's APPI) with your compliance team before using real company data.

**⚠️ Pinecone index note:**

Create the index with **dimension 384** and **cosine** metric to match the embedding model. If you change the embedding model, the dimension must match, and you must re-ingest all documents, because vectors from different models are not comparable.

### Step 4 — Load sample company knowledge

```bash
python ingest_sample_kb.py
```

This demonstrates the bilingual RAG ingestion pipeline:

```text
Company Documents (日本語 + English)
   ↓
Load Documents
   ↓
Chunk Text (Japanese-aware separators)
   ↓
Multilingual HuggingFace Embeddings
   ↓
Pinecone Vector Database
```

### Step 5 — Run the application

```bash
python run.py
```

Open:

```text
http://127.0.0.1:8000
```

FastAPI API docs:

```text
http://127.0.0.1:8000/docs
```

---

## 9. Demo Scenarios (English & 日本語)

### Demo A — Private KB Success

Ask:

> **How do I connect to the company VPN from home?**
> **自宅から会社のVPNに接続するにはどうすればよいですか?**

Expected path:

```text
Detect Language → EN / JA
Router → KB
Private KB Retrieval
KB Grade → GOOD
Generate from Private KB (with citation)
```

Teaching point:

> Trusted internal company knowledge is preferred. No public web call is necessary.

---

### Demo B — Company Policy Question

Ask:

> **Can IT support ask me to share my MFA code?**
> **IT担当者からMFAコードを教えてほしいと言われたら、共有してもよいですか?**

The internal handbook says employees must never share passwords or MFA codes with support personnel.

Expected path:

```text
Detect Language → EN / JA
Router → KB
Private KB Retrieval
KB Grade → GOOD
Private KB Answer (with citation)
```

Teaching point:

> RAG allows the model to answer using company-specific information it was never trained on.

---

### Demo C — External / Current Information

Ask:

> **What is the latest Microsoft Teams outage guidance?**
> **Microsoft Teams の最新の障害対応ガイダンスを教えてください。**

Expected path when internal documents do not answer it:

```text
Detect Language → EN / JA
Router → KB
Private KB Retrieval
KB Grade → WEAK
Tavily Search
Web Grade → GOOD
Web Answer (with external-source warning)
```

Teaching point:

> Agentic RAG can choose another information source rather than blindly answering from irrelevant vectors.

---

### Demo D — Query Rewrite

Ask a deliberately vague question such as:

> **My work communication app is acting strange after the new update. What should I do?**
> **アップデート後に、仕事用のチャットアプリの調子がおかしいです。どうすればよいですか?**

If both KB and first external retrieval are weak, the workflow can rewrite the query and retry. If the retry limit is reached, the system admits insufficient evidence and advises contacting the IT service desk, for example:

> 社内ドキュメントから十分な根拠を確認できませんでした。ITサービスデスクへお問い合わせください。

Teaching point:

> Retrieval failure does not immediately mean failure. An agent can improve the search query and try again while using a retry guard to avoid loops, and it should admit uncertainty instead of guessing.

---

### Demo E — Direct Conversation

Ask:

> **Hello!**
> **こんにちは!**

Expected path:

```text
Detect Language → EN / JA
Router → DIRECT
Direct Answer
```

Teaching point:

> Not every message should trigger expensive vector search or web search.

---

### Demo F — Cross-Lingual Retrieval

Ask in Japanese about a document that exists only in English (or the reverse):

> **パスワードの有効期限は何日ですか?**  (the password policy exists only in the English handbook)

Expected path:

```text
Detect Language → JA
Router → KB
Private KB Retrieval (multilingual embeddings match the English chunk)
KB Grade → GOOD
Answer in Japanese, citing the English source document
```

Teaching point:

> Multilingual embeddings let employees ask in their own language without needing every document translated first.

---

## 10. Document Upload Demo

The sidebar contains **Add Company Document**.

Use the `ADMIN_API_KEY` from `.env`.

Upload one of:

- `.pdf`
- `.txt`
- `.md`
- `.docx`

Japanese and English documents are both supported. The backend performs:

```text
Upload
  ↓
Validate Type
  ↓
Load Text
  ↓
Recursive Chunking (Japanese-aware)
  ↓
Multilingual Embeddings
  ↓
Pinecone Indexing
  ↓
Immediately Available for Retrieval
```

This is useful in an FDE demonstration because the customer does not want to edit Python every time a new policy is published.

---

## 11. API Endpoints

### `GET /api/health`

Health check.

### `POST /api/chat`

Request:

```json
{
  "question": "パスワードをリセットするにはどうすればよいですか?"
}
```

Response contains:

```json
{
  "answer": "...",
  "language": "ja",
  "source_used": "private_kb",
  "trace": [
    "Language detected → ja",
    "Router → KB",
    "Private KB retrieval → 4 chunks",
    "KB evidence grade → GOOD",
    "Answer generation → PRIVATE KB"
  ],
  "citations": [
    { "source": "company_it_handbook_ja.md", "chunk": 3 }
  ]
}
```

### `POST /api/ingest`

Protected by the `X-Admin-Key` request header.

Uploads a document and adds its chunks to Pinecone.

---

## 12. Evaluation

Test the system with a small bilingual question set that covers all demo paths.

| Metric | Description |
|---|---|
| Retrieval hit rate | The correct chunk appears in the top-k results, measured separately for Japanese and English questions |
| Cross-lingual hit rate | Japanese question finds English document, and English question finds Japanese document |
| Groundedness | Share of answer claims supported by the retrieved sources |
| Citation accuracy | The cited document actually contains the claim |
| Correct routing | KB vs. web vs. direct decisions match the expected path |
| Insufficient-evidence behavior | The system admits uncertainty on out-of-scope questions instead of guessing |

---

## 13. Roadmap

- [ ] PII redaction before any query is sent to Tavily
- [ ] Admin-controlled policy switch to enable or disable web fallback
- [ ] Human escalation with ticket creation and retrieved context attached
- [ ] Excel (`.xlsx`) document ingestion
- [ ] Chat integrations (Microsoft Teams, Slack, LINE WORKS, Chatwork)
- [ ] Feedback loop from escalated tickets back into the knowledge base
- [ ] Self-hosted vector database option (for example Qdrant or pgvector) for strict data-residency needs
- [ ] Full Japanese README (`README.ja.md`)
