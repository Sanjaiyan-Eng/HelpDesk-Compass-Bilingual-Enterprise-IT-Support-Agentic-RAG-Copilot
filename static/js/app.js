const chat = document.getElementById('chat');
const form = document.getElementById('chatForm');
const question = document.getElementById('question');
const trace = document.getElementById('trace');
const sourceUsed = document.getElementById('sourceUsed');
const examplesBox = document.getElementById('examples');

// ---------- Interface text (Japanese / English) ----------
// Answers and trace lines come from the server in the language of the question;
// this dictionary only controls the interface around them.
const I18N = {
  en: {
    tagline: 'Private company knowledge first. External web only when evidence is weak.',
    workflowTitle: 'LangGraph Workflow',
    flow1: '1. Detect language',
    flow2: '2. Route question',
    flow3: '3. Retrieve private KB',
    flow4: '4. Grade evidence',
    flow5: '5. Web fallback if weak',
    flow6: '6. Rewrite & retry',
    flow7: '7. Grounded answer',
    addDocument: '+ Add Company Document',
    topbarTitle: 'Enterprise Knowledge Copilot',
    placeholder: 'Ask an IT support question (Japanese or English)...',
    send: 'Ask Agent',
    traceTitle: 'Agent Trace',
    traceSubtitle: 'Watch LangGraph decisions while the request runs.',
    finalSource: 'Final Source',
    noRequest: 'No request yet.',
    noTrace: 'No trace.',
    running: 'Running LangGraph workflow...',
    runningShort: 'Running',
    requestFailed: 'Request failed',
    errorShort: 'Error',
    errorPrefix: 'Error',
    welcomeTitle: 'How can I help with IT support?',
    welcomeBody: 'Ask in Japanese or English. Try one of the examples below, or ask something that may need current external vendor information.',
    sources: 'Sources',
    sourceLabel: 'Source',
    uploadTitle: 'Ingest Company Document',
    uploadHelp: 'Upload PDF, TXT, Markdown, or DOCX in Japanese or English. The document is chunked, embedded, and indexed into Pinecone.',
    adminKey: 'Admin API key',
    uploadBtn: 'Index Document',
    chooseFile: 'Choose a file first.',
    indexing: 'Indexing document...',
    indexed: (file, chunks) => `Indexed ${file}: ${chunks} chunks.`,
    examples: [
      'How do I connect to the company VPN?',
      'What is our password reset policy?',
      'What is the latest Microsoft Teams outage guidance?',
      'パスワードをリセットするにはどうすればよいですか?',
    ],
    sourceNames: {
      private_kb: 'Private knowledge base',
      web_search: 'Web search (external)',
      direct: 'Direct reply',
      insufficient_evidence: 'Insufficient evidence',
    },
  },
  ja: {
    tagline: 'まず社内ナレッジを検索し、根拠が弱い場合のみ外部Web検索を使います。',
    workflowTitle: 'LangGraph ワークフロー',
    flow1: '1. 言語を検出',
    flow2: '2. 質問をルーティング',
    flow3: '3. 社内ナレッジを検索',
    flow4: '4. 根拠を評価',
    flow5: '5. 根拠が弱ければWeb検索',
    flow6: '6. 書き換えて再検索',
    flow7: '7. 根拠に基づく回答',
    addDocument: '+ 社内ドキュメントを追加',
    topbarTitle: '社内ナレッジ コパイロット',
    placeholder: 'ITサポートの質問を入力してください(日本語・英語)...',
    send: '質問する',
    traceTitle: 'エージェントのトレース',
    traceSubtitle: 'リクエスト実行中のLangGraphの判断を確認できます。',
    finalSource: '最終的な情報源',
    noRequest: 'まだリクエストがありません。',
    noTrace: 'トレースがありません。',
    running: 'LangGraphワークフローを実行中...',
    runningShort: '実行中',
    requestFailed: 'リクエストに失敗しました',
    errorShort: 'エラー',
    errorPrefix: 'エラー',
    welcomeTitle: 'ITサポートについてお手伝いします。',
    welcomeBody: '日本語でも英語でも質問できます。下の例を試すか、最新の外部ベンダー情報が必要な質問もどうぞ。',
    sources: '出典',
    sourceLabel: '情報源',
    uploadTitle: '社内ドキュメントの取り込み',
    uploadHelp: '日本語または英語のPDF、TXT、Markdown、DOCXをアップロードできます。ドキュメントは分割・ベクトル化され、Pineconeに登録されます。',
    adminKey: '管理者APIキー',
    uploadBtn: 'ドキュメントを登録',
    chooseFile: '先にファイルを選択してください。',
    indexing: 'ドキュメントを登録中...',
    indexed: (file, chunks) => `${file} を登録しました(${chunks}チャンク)。`,
    examples: [
      '自宅から会社のVPNに接続するにはどうすればよいですか?',
      'パスワードリセットのポリシーを教えてください。',
      'Microsoft Teams の最新の障害対応ガイダンスを教えてください。',
      'How do I connect to the company VPN?',
    ],
    sourceNames: {
      private_kb: '社内ナレッジベース',
      web_search: 'Web検索(外部情報)',
      direct: '直接応答',
      insufficient_evidence: '根拠不足',
    },
  },
};

let lang = 'en';
try {
  const saved = localStorage.getItem('ui-lang');
  if (saved === 'ja' || saved === 'en') lang = saved;
  else if ((navigator.language || '').toLowerCase().startsWith('ja')) lang = 'ja';
} catch (e) { /* storage unavailable: keep default */ }

const tr = key => I18N[lang][key];

// ---------- Rendering helpers ----------
function escapeHtml(s=''){return s.replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function formatText(s=''){return escapeHtml(s).replace(/\n/g,'<br>');}
function sourceLabel(source){return (I18N[lang].sourceNames[source]) || source;}
function citationHtml(c){
  const title = c.url
    ? `<a href="${escapeHtml(c.url)}" target="_blank" rel="noopener">${escapeHtml(c.title)}</a>`
    : escapeHtml(c.title);
  const tag = c.language ? ` <span class="lang-tag">${escapeHtml(c.language.toUpperCase())}</span>` : '';
  return title + tag;
}
function addMessage(role, text, source='', citations=[]){
  const wrap=document.createElement('div'); wrap.className=`message ${role}`;
  const citeHtml=citations.length?`<div class="citations"><strong>${tr('sources')}</strong><br>${citations.map(citationHtml).join('<br>')}</div>`:'';
  wrap.innerHTML=`<div class="avatar">AI</div><div class="bubble">${formatText(text)}${source?`<div class="answer-source">${tr('sourceLabel')}: ${escapeHtml(sourceLabel(source))}</div>`:''}${citeHtml}</div>`;
  chat.appendChild(wrap); chat.scrollTop=chat.scrollHeight;
}
function addWelcome(){
  const wrap=document.createElement('div'); wrap.className='message assistant welcome';
  wrap.innerHTML=`<div class="avatar">AI</div><div class="bubble"><strong>${escapeHtml(tr('welcomeTitle'))}</strong><p>${escapeHtml(tr('welcomeBody'))}</p></div>`;
  chat.prepend(wrap);
}
function renderTrace(items=[], emptyKey='noTrace'){
  trace.innerHTML=items.length?items.map(x=>`<div class="trace-item">${escapeHtml(x)}</div>`).join(''):`<div class="empty">${escapeHtml(tr(emptyKey))}</div>`;
}
function renderExamples(){
  examplesBox.innerHTML='';
  I18N[lang].examples.forEach(text=>{
    const b=document.createElement('button'); b.type='button'; b.className='example'; b.textContent=text;
    b.addEventListener('click',()=>askAgent(text));
    examplesBox.appendChild(b);
  });
}

// ---------- Language switching ----------
function applyLang(newLang){
  lang = newLang;
  try { localStorage.setItem('ui-lang', lang); } catch (e) { /* ignore */ }
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach(el=>{ el.textContent = tr(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el=>{ el.placeholder = tr(el.dataset.i18nPlaceholder); });
  document.querySelectorAll('.lang-btn').forEach(b=>b.classList.toggle('active', b.dataset.lang === lang));
  renderExamples();
  // Re-render the welcome bubble in the new language; keep real conversation messages as they are.
  const oldWelcome = chat.querySelector('.welcome');
  if (oldWelcome) oldWelcome.remove();
  addWelcome();
  if (!chat.querySelector('.message.user')) renderTrace([], 'noRequest');
}
document.querySelectorAll('.lang-btn').forEach(b=>b.addEventListener('click',()=>applyLang(b.dataset.lang)));

// ---------- Chat ----------
async function askAgent(q){
  addMessage('user',q); question.value=''; renderTrace([tr('running')]); sourceUsed.textContent=tr('runningShort');
  const btn=form.querySelector('button'); btn.disabled=true;
  try{
    const res=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:q})});
    const data=await res.json(); if(!res.ok) throw new Error(data.detail||tr('requestFailed'));
    addMessage('assistant',data.answer,data.source_used,data.citations||[]); renderTrace(data.trace||[]); sourceUsed.textContent=sourceLabel(data.source_used);
  }catch(e){addMessage('assistant',`${tr('errorPrefix')}: ${e.message}`); renderTrace([tr('requestFailed')]); sourceUsed.textContent=tr('errorShort');}
  finally{btn.disabled=false;}
}
form.addEventListener('submit',e=>{e.preventDefault(); const q=question.value.trim(); if(q) askAgent(q);});

// ---------- Document upload ----------
const modal=document.getElementById('uploadModal');
document.getElementById('openUpload').onclick=()=>modal.classList.remove('hidden');
document.getElementById('closeUpload').onclick=()=>modal.classList.add('hidden');
document.getElementById('uploadBtn').onclick=async()=>{
  const file=document.getElementById('fileInput').files[0]; const key=document.getElementById('adminKey').value; const status=document.getElementById('uploadStatus');
  if(!file){status.textContent=tr('chooseFile'); return;}
  status.textContent=tr('indexing'); const fd=new FormData(); fd.append('file',file);
  try{const r=await fetch('/api/ingest',{method:'POST',headers:{'X-Admin-Key':key},body:fd}); const d=await r.json(); if(!r.ok) throw new Error(d.detail||'Upload failed'); status.textContent=I18N[lang].indexed(d.file,d.chunks);}catch(e){status.textContent=`${tr('errorPrefix')}: ${e.message}`;}
};

applyLang(lang);