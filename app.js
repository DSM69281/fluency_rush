/* ═══════════════════════════════════════════════════════════
   FLUENCY RUSH — app.js
   Toda a lógica do frontend. Comunica com o servidor Python
   via REST API (fetch) e eventos em tempo real (SSE).
   ═══════════════════════════════════════════════════════════ */

// ── API base (usa a mesma origem — funciona com ngrok) ─────────────────────
const API = window.location.origin;

// ── Estado global ──────────────────────────────────────────────────────────
const state = {
  user:         null,   // { name, id }
  blitzTimer:   null,
  blitzTime:    45,
  blitzDone:    false,
  blitzQIdx:    0,
  blitzScore:   0,
  fillIdx:      0,
  rapidIdx:     0,
  rapidKnow:    0,
  rapidTotal:   0,
  missionBlitz: 0,      // acertos no blitz hoje
  missionChat:  false,  // já enviou mensagem?
};

// ── Fake users (permanecem fictícios) ─────────────────────────────────────
const FAKE_USERS = [
  { name:'Camila B.',  xp:9840, streak:45, av:'🔥' },
  { name:'Lucas M.',   xp:8200, streak:38, av:'🎯' },
  { name:'Julia A.',   xp:7650, streak:31, av:'⚡' },
  { name:'Thiago R.',  xp:7100, streak:28, av:'🌙' },
  { name:'Beatriz N.', xp:6800, streak:22, av:'🦊' },
];

// ── Conteúdo ───────────────────────────────────────────────────────────────
let BLITZ_QUESTIONS = [
  { q:'Which sentence uses <span class="hl">Present Perfect</span> correctly?',
    opts:['She went to Paris last year.','She has been to Paris twice.','She is going soon.','She was going yesterday.'], c:1 },
  { q:'Choose the correct <span class="hl">conditional</span>:',
    opts:['If he studies, he passed.','If he will study, he passes.','If he studies, he will pass.','If he studied, he will pass.'], c:2 },
  { q:'Synonym of <span class="hl">"resilient"</span>:',
    opts:['Fragile','Stubborn','Tenacious','Anxious'], c:2 },
  { q:'"I wish I <span class="hl">___</span> more time to study."',
    opts:['have','had','has','will have'], c:1 },
  { q:'Correct use of <span class="hl">Past Perfect</span>:',
    opts:['She had left before he arrived.','She has left before he arrived.','She left before he had arrived.','She was leaving when he arrived.'], c:0 },
];

let FILL_QUESTIONS = [
  { q:'"If I <span class="fill-blank">___</span> (know) about the meeting, I would have attended."',
    answer:'had known', hint:'💡 3rd conditional — If + Past Perfect.' },
  { q:'"She <span class="fill-blank">___</span> (live) here for 10 years by next month."',
    answer:'will have lived', hint:'💡 Future Perfect — will have + past participle.' },
  { q:'"He speaks English as <span class="fill-blank">___</span> as a native speaker."',
    answer:'fluently', hint:'💡 Comparativo com advérbio (-ly).' },
  { q:'"By the time you arrive, I <span class="fill-blank">___</span> (finish) cooking."',
    answer:'will have finished', hint:'💡 Future Perfect in time clauses.' },
];

let VOCAB = [
  { w:'ELOQUENT',   p:'/ˈel.ə.kwənt/ · adj',  m:'Expressivo e persuasivo na fala ou escrita.' },
  { w:'PERSEVERE',  p:'/ˌpɜː.sɪˈvɪər/ · verb', m:'Continuar com determinação apesar das dificuldades.' },
  { w:'TENACIOUS',  p:'/tɪˈneɪ.ʃəs/ · adj',    m:'Muito determinado; que não desiste facilmente.' },
  { w:'NUANCE',     p:'/ˈnjuː.ɑːns/ · noun',   m:'Diferença sutil de significado ou expressão.' },
  { w:'LEVERAGE',   p:'/ˈlev.ər.ɪdʒ/ · n/v',   m:'Usar algo como vantagem; poder de influência.' },
  { w:'RESILIENT',  p:'/rɪˈzɪl.i.ənt/ · adj',  m:'Capaz de se recuperar rapidamente de dificuldades.' },
  { w:'ARTICULATE', p:'/ɑːˈtɪk.jʊ.lət/ · adj', m:'Capaz de expressar ideias com clareza e fluidez.' },
  { w:'PROFOUND',   p:'/prəˈfaʊnd/ · adj',      m:'De grande profundidade ou intensidade; significativo.' },
];

async function loadQuestionsConfig() {
  try {
    const res = await fetch(`${API}/questions.json`, { cache: 'no-store' });
    if (!res.ok) return;
    const cfg = await res.json();

    if (Array.isArray(cfg.blitz) && cfg.blitz.length) {
      BLITZ_QUESTIONS = cfg.blitz.map(x => ({ q: x.q, opts: x.opts, c: x.c }));
    }
    if (Array.isArray(cfg.fill) && cfg.fill.length) {
      FILL_QUESTIONS = cfg.fill.map(x => ({ q: x.q, answer: x.answer, hint: x.hint }));
    }
    if (Array.isArray(cfg.vocab) && cfg.vocab.length) {
      VOCAB = cfg.vocab.map(x => ({ w: x.w, p: x.p, m: x.m }));
    }
  } catch (e) {
    console.warn('Não foi possível carregar questions.json; usando conteúdo padrão.', e);
  }
}

// ═══════════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  initCursor();
  buildStreakGrid();
  startHeroTimer();

  // Bind login
  document.getElementById('btnLogin').addEventListener('click', doLogin);
  document.getElementById('loginName').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });

  // Bind chat
  document.getElementById('btnSend').addEventListener('click', sendChat);
  document.getElementById('chatInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') sendChat();
  });

  // Bind fill in
  document.getElementById('btnCheck').addEventListener('click', checkFill);
  document.getElementById('fillInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') checkFill();
  });

  // Bind rapid fire
  document.getElementById('btnKnow').addEventListener('click', () => rapidNext(true));
  document.getElementById('btnHard').addEventListener('click', () => rapidNext(false));
  document.getElementById('btnSkip').addEventListener('click', () => rapidNext(null));

  // Bind challenge cards (hero + grid)
  document.querySelectorAll('[data-challenge]').forEach(el => {
    el.addEventListener('click', () => {
      if (!state.user) return;
      const name = el.dataset.challenge;
      const xp   = parseInt(el.dataset.xp || 0);
      completeChallenge(name, xp);
    });
  });

  // Simulated live player count
  setInterval(() => {
    const n  = 800 + Math.floor(Math.random() * 400);
    const lc = document.getElementById('liveCount');
    if (lc) lc.textContent = `🔴 ${n} jogando`;
    const ho = document.getElementById('hOnline');
    if (ho) ho.textContent = `${Math.floor(Math.random()*3)+1} online`;
  }, 9000);
});

// ── Cursor ─────────────────────────────────────────────────────────────────
function initCursor() {
  const cursor = document.getElementById('cursor');
  document.addEventListener('mousemove', e => {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top  = e.clientY + 'px';
  });
  document.querySelectorAll('button, .ch-card, .lb-item').forEach(el => {
    el.addEventListener('mouseenter', () => cursor.classList.add('big'));
    el.addEventListener('mouseleave', () => cursor.classList.remove('big'));
  });
}

// ═══════════════════════════════════════════════════════════
//  LOGIN
// ═══════════════════════════════════════════════════════════
async function doLogin() {
  const nameEl = document.getElementById('loginName');
  const errEl  = document.getElementById('loginError');
  const name   = nameEl.value.trim();

  if (name.length < 2) {
    errEl.style.display = 'block';
    nameEl.style.borderColor = 'var(--pink)';
    return;
  }
  errEl.style.display = 'none';
  nameEl.style.borderColor = '';

  const id = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  state.user = { name, id };

  // Registra/atualiza usuário no servidor
  try {
    await apiFetch(`/api/users/${id}`, 'POST', { name });
  } catch (e) {
    console.error('Erro ao registrar usuário:', e);
  }

  // Mostra app
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('mainApp').style.display = 'block';

  // Atualiza UI
  document.getElementById('headerName').textContent = name;
  document.getElementById('cardName').textContent   = name;
  document.getElementById('cardTag').textContent    = `@${id}`;

  // Inicializa módulos
  initSSE();
  await loadQuestionsConfig();
  loadFill();
  loadRapid();
  startBlitz();

  // Missão: entrar
  await addXP(10, 'entrou na plataforma 🚀');
}

// ═══════════════════════════════════════════════════════════
//  SSE — eventos em tempo real do servidor
// ═══════════════════════════════════════════════════════════
function initSSE() {
  const es = new EventSource(`${API}/events`);

  es.addEventListener('init', e => {
    const db = JSON.parse(e.data);
    renderRanking(Object.values(db.users || {}));
    renderFeed(db.feed || []);
    renderChat(db.chat || []);
  });

  es.addEventListener('users', e => {
    const users = JSON.parse(e.data);
    renderRanking(Object.values(users));
    // Atualiza XP do próprio usuário
    const me = users[state.user.id];
    if (me) updateMyXP(me.xp);
  });

  es.addEventListener('feed', e => {
    renderFeed(JSON.parse(e.data));
  });

  es.addEventListener('chat', e => {
    renderChat(JSON.parse(e.data));
  });

  es.onerror = () => {
    console.warn('SSE desconectado. Reconectando em 3s...');
    setTimeout(initSSE, 3000);
    es.close();
  };
}

// ═══════════════════════════════════════════════════════════
//  API helpers
// ═══════════════════════════════════════════════════════════
async function apiFetch(path, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  return res.json();
}

// ═══════════════════════════════════════════════════════════
//  XP
// ═══════════════════════════════════════════════════════════
async function addXP(amount, reason) {
  if (!state.user) return;
  await apiFetch(`/api/users/${state.user.id}/xp`, 'PATCH', { amount });
  await apiFetch('/api/feed', 'POST', { name: state.user.name, action: reason, xp: amount });
  toast(`+${amount} XP — ${reason}`, '#c8ff00', '#04040a');
}

function updateMyXP(xp) {
  document.getElementById('hXP').textContent    = xp.toLocaleString();
  document.getElementById('cardXP').textContent = xp.toLocaleString();
  const pct = Math.min(98, (xp / 10000) * 100);
  document.getElementById('cardXPBar').style.width = Math.max(2, pct) + '%';
}

// ═══════════════════════════════════════════════════════════
//  RANKING — merge usuários reais + fictícios
// ═══════════════════════════════════════════════════════════
function renderRanking(realUsers) {
  const all = [...realUsers.map(u => ({ ...u, isReal: true })), ...FAKE_USERS]
    .sort((a, b) => b.xp - a.xp)
    .map((u, i) => ({ ...u, rank: i + 1 }));

  const lb = document.getElementById('leaderboard');
  lb.innerHTML = '';

  all.slice(0, 10).forEach(u => {
    const isMe = u.isReal && u.name === state.user?.name;
    const rc   = u.rank === 1 ? 'var(--gold)' : u.rank === 2 ? '#c0c0c0' : u.rank === 3 ? '#cd7f32' : 'var(--muted)';
    const av   = u.isReal ? (u.name[0].toUpperCase()) : (u.av || u.name[0]);
    const avBg = u.isReal
      ? 'background:linear-gradient(135deg,var(--lime),var(--cyan))'
      : 'background:var(--s3)';

    const row = document.createElement('div');
    row.className = `lb-item${isMe ? ' me' : ''}`;
    row.innerHTML = `
      <div class="lb-rank" style="color:${rc}">${u.rank}</div>
      <div class="lb-av" style="${avBg}">${av}</div>
      <div class="lb-info">
        <div class="lb-name">${u.name}${isMe ? ' 👈' : ''}</div>
        <div class="lb-stat">${u.isReal ? '🟢 Online' : `🔘 ${u.streak || 0}d streak`}</div>
      </div>
      <div class="lb-pts">${(u.xp || 0).toLocaleString()}</div>`;
    lb.appendChild(row);
  });
}

// ═══════════════════════════════════════════════════════════
//  FEED
// ═══════════════════════════════════════════════════════════
function renderFeed(items) {
  const feed = document.getElementById('liveFeed');
  feed.innerHTML = '';
  [...items].reverse().slice(0, 8).forEach(item => {
    const li = document.createElement('li');
    li.className = 'feed-item';
    li.innerHTML = `
      <div class="feed-avatar" style="background:rgba(200,255,0,.15);color:var(--lime)">${item.name[0].toUpperCase()}</div>
      <div class="feed-text"><strong>${item.name}</strong> <span>${item.action}${item.xp ? ` <em style="color:var(--lime)">+${item.xp}xp</em>` : ''}</span></div>
      <div class="feed-time">${timeSince(item.ts)}</div>`;
    feed.appendChild(li);
  });
}

// ═══════════════════════════════════════════════════════════
//  CHAT
// ═══════════════════════════════════════════════════════════
function renderChat(msgs) {
  const box = document.getElementById('chatBox');
  box.innerHTML = '';
  if (!msgs.length) {
    box.innerHTML = '<div class="chat-empty">💬 Seja o primeiro a escrever!</div>';
    return;
  }
  msgs.slice(-40).forEach(m => {
    const isMe = m.name === state.user?.name;
    const div  = document.createElement('div');
    div.className = `chat-msg${isMe ? ' me' : ''}`;
    div.innerHTML = `<span class="chat-name">${isMe ? 'Você' : m.name}</span>
                     <span class="chat-bubble">${escapeHtml(m.text)}</span>`;
    box.appendChild(div);
  });
  box.scrollTop = box.scrollHeight;
}

async function sendChat() {
  if (!state.user) return;
  const input = document.getElementById('chatInput');
  const text  = input.value.trim();
  if (!text) return;
  input.value = '';
  await apiFetch('/api/chat', 'POST', { name: state.user.name, text });

  // Missão chat
  if (!state.missionChat) {
    state.missionChat = true;
    const el = document.getElementById('missionChat');
    if (el) { el.className = 'mission-item done'; el.querySelector('.mission-icon').textContent = '✅'; }
    await addXP(30, 'enviou mensagem no chat 💬');
  }
}

// ═══════════════════════════════════════════════════════════
//  CHALLENGE
// ═══════════════════════════════════════════════════════════
async function completeChallenge(name, xp) {
  await addXP(xp, `completou "${name}" 🎯`);
}

// ═══════════════════════════════════════════════════════════
//  BLITZ QUIZ
// ═══════════════════════════════════════════════════════════
function loadBlitzQ() {
  const q    = BLITZ_QUESTIONS[state.blitzQIdx % BLITZ_QUESTIONS.length];
  const qEl  = document.getElementById('blitzQ');
  const opts = document.getElementById('blitzOptions');
  const num  = document.getElementById('qnum');

  qEl.innerHTML = q.q;
  num.textContent = state.blitzQIdx + 1;
  opts.innerHTML  = '';

  q.opts.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'blitz-opt';
    btn.textContent = opt;
    btn.addEventListener('click', () => blitzAnswer(btn, i === q.c));
    opts.appendChild(btn);
  });
}

function startBlitz() {
  state.blitzDone = false;
  state.blitzTime = 45;
  loadBlitzQ();
  clearInterval(state.blitzTimer);

  state.blitzTimer = setInterval(() => {
    if (state.blitzDone) return;
    state.blitzTime--;

    const mm  = String(Math.floor(state.blitzTime / 60)).padStart(2, '0');
    const ss  = String(state.blitzTime % 60).padStart(2, '0');
    const tel = document.getElementById('blitzTimerEl');
    const bar = document.getElementById('blitzBarEl');

    if (tel) { tel.textContent = `${mm}:${ss}`; tel.style.color = state.blitzTime < 10 ? 'var(--pink)' : 'var(--orange)'; }
    if (bar) bar.style.width = (state.blitzTime / 45 * 100) + '%';

    if (state.blitzTime <= 0) {
      clearInterval(state.blitzTimer);
      toast('⏰ Tempo esgotado! Próxima questão...', '#ff0080', '#fff');
      state.blitzDone = true;
      state.blitzQIdx++;
      setTimeout(startBlitz, 1800);
    }
  }, 1000);
}

function blitzAnswer(btn, correct) {
  if (state.blitzDone) return;
  state.blitzDone = true;
  clearInterval(state.blitzTimer);

  document.querySelectorAll('.blitz-opt').forEach(o => { o.disabled = true; });
  btn.classList.add(correct ? 'correct' : 'wrong');

  if (correct) {
    // Marca a correta se errou
  } else {
    const q    = BLITZ_QUESTIONS[state.blitzQIdx % BLITZ_QUESTIONS.length];
    const all  = document.querySelectorAll('.blitz-opt');
    if (all[q.c]) all[q.c].classList.add('correct');
    toast('✗ Incorreto — resposta marcada em verde', '#ff0080', '#fff');
  }

  if (correct) {
    state.blitzScore++;
    document.getElementById('qscore').textContent = state.blitzScore;
    addXP(15, 'acertou no Blitz Quiz ⚡');

    // Missão blitz
    state.missionBlitz++;
    const sub = document.getElementById('missionBlitzSub');
    if (sub) sub.textContent = `${state.missionBlitz}/5 acertos`;
    if (state.missionBlitz >= 5) {
      const el = document.getElementById('missionBlitz');
      if (el) { el.className = 'mission-item done'; el.querySelector('.mission-icon').textContent = '✅'; }
      addXP(150, 'completou missão Blitz 5x ✅');
    }
  }

  state.blitzQIdx++;
  setTimeout(startBlitz, 2200);
}

// ═══════════════════════════════════════════════════════════
//  FILL IN THE BLANK
// ═══════════════════════════════════════════════════════════
function loadFill() {
  const q = FILL_QUESTIONS[state.fillIdx];
  document.getElementById('fillSentence').innerHTML = q.q;
  document.getElementById('fillHint').textContent   = q.hint;
  document.getElementById('fillInput').value        = '';
}

function checkFill() {
  if (!state.user) { toast('⚠️ Faça login primeiro!', '#ff6a00', '#fff'); return; }
  const input = document.getElementById('fillInput');
  const val   = input.value.trim().toLowerCase();
  const ans   = FILL_QUESTIONS[state.fillIdx].answer.toLowerCase();

  if (val === ans) {
    addXP(20, 'completou Fill in the Blank ✏️');
    state.fillIdx = (state.fillIdx + 1) % FILL_QUESTIONS.length;
    setTimeout(loadFill, 800);
  } else {
    toast(`✗ Resposta: "${FILL_QUESTIONS[state.fillIdx].answer}"`, '#ff0080', '#fff');
    input.style.borderColor = 'var(--pink)';
    setTimeout(() => { input.style.borderColor = ''; }, 1200);
  }
}

// ═══════════════════════════════════════════════════════════
//  VOCAB RAPID FIRE
// ═══════════════════════════════════════════════════════════
function loadRapid() {
  const v = VOCAB[state.rapidIdx];
  document.getElementById('rapidWord').textContent    = v.w;
  document.getElementById('rapidPron').textContent    = v.p;
  document.getElementById('rapidMeaning').textContent = v.m;
}

function rapidNext(knew) {
  if (!state.user) { toast('⚠️ Faça login primeiro!', '#ff6a00', '#fff'); return; }
  state.rapidTotal++;
  if (knew === true) {
    state.rapidKnow++;
    addXP(5, `aprendeu "${VOCAB[state.rapidIdx].w}" 📚`);
  } else if (knew === false) {
    toast('📌 Adicionada para revisão', '#ff0080', '#fff');
  }
  state.rapidIdx = (state.rapidIdx + 1) % VOCAB.length;
  loadRapid();
  const pct  = Math.min(100, (state.rapidKnow / Math.max(1, state.rapidTotal)) * 100);
  const fill = document.getElementById('rapidBarFill');
  if (fill) fill.style.width = pct + '%';
}

// ═══════════════════════════════════════════════════════════
//  STREAK GRID
// ═══════════════════════════════════════════════════════════
function buildStreakGrid() {
  const sg = document.getElementById('streakGrid');
  if (!sg) return;
  ['D','S','T','Q','Q','S','S'].forEach(h => {
    const d = document.createElement('div');
    d.style.cssText = 'font-size:.58rem;color:var(--muted);font-weight:700;text-align:center;';
    d.textContent = h;
    sg.appendChild(d);
  });
  for (let i = 0; i < 28; i++) {
    const d = document.createElement('div');
    d.className = 'streak-day ' + (i === 22 ? 'today' : i < 22 && Math.random() > 0.1 ? 'hit' : 'miss');
    d.textContent = i + 1;
    sg.appendChild(d);
  }
}

// ═══════════════════════════════════════════════════════════
//  HERO TIMER (contagem regressiva)
// ═══════════════════════════════════════════════════════════
function startHeroTimer() {
  let total = 4 * 3600 + 23 * 60 + 11;
  setInterval(() => {
    if (total <= 0) total = 86400;
    total--;
    const h  = String(Math.floor(total / 3600)).padStart(2,'0');
    const m  = String(Math.floor((total % 3600) / 60)).padStart(2,'0');
    const s  = String(total % 60).padStart(2,'0');
    const el = document.getElementById('heroTimer');
    if (el) el.textContent = `${h}:${m}:${s}`;
  }, 1000);
}

// ═══════════════════════════════════════════════════════════
//  UTILS
// ═══════════════════════════════════════════════════════════
function toast(msg, bg, color) {
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = 'toast';
  t.style.cssText = `background:${bg};color:${color};border:1px solid rgba(255,255,255,.1);`;
  t.innerHTML = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

function timeSince(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)   return s + 's';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  return Math.floor(s / 3600) + 'h';
}

function escapeHtml(str) {
  return str
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}
