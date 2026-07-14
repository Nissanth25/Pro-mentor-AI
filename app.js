// ═══════════════════════════════════════════════════════════════
//  ProMentor AI — app.js  (No-server, localStorage auth)
//  OpenAI AI + Full SPA Logic
// ═══════════════════════════════════════════════════════════════

import { generateMockData, generateLocalChatResponse } from './mockGenerator.js';

// One-time credential reset (remove after first load)
try {
  if (!window.localStorage.getItem('pm_reset_v2')) {
    window.localStorage.removeItem('pm_users');
    window.localStorage.removeItem('pm_session');
    window.localStorage.setItem('pm_reset_v2', '1');
  }
} catch(e) {}

// Safe localStorage wrapper with memory fallback
const storage = {
  _data: {},
  getItem(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return this._data[key] || null;
    }
  },
  setItem(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      this._data[key] = String(value);
    }
  },
  removeItem(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (e) {
      delete this._data[key];
    }
  }
};

// ── CONFIG ──────────────────────────────────────────────────────
let OPENAI_KEY = storage.getItem('pm_openai_key') || '';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

// ── MERMAID ──────────────────────────────────────────────────────
function getActiveThemeMode() {
  const current = storage.getItem('pm_theme') || 'system';
  if (current === 'system') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return (current === 'light' || current === 'minimal') ? 'light' : 'dark';
}

function initMermaid() {
  const isLight = getActiveThemeMode() === 'light';
  mermaid.initialize({
    startOnLoad: false,
    theme: isLight ? 'default' : 'dark',
    themeVariables: isLight ? {
      darkMode: false,
      background: '#f8fafc',
      primaryColor: '#3b82f6',
      primaryTextColor: '#0f172a',
      lineColor: '#cbd5e1',
      fontSize: '13px'
    } : {
      darkMode: true,
      background: '#0c0c1a',
      primaryColor: '#7c3aed',
      primaryTextColor: '#e8e8f5',
      lineColor: '#5a5a7a',
      fontSize: '13px'
    }
  });
}
initMermaid();

// ── STATE ────────────────────────────────────────────────────────
let currentUser   = null;
let projects      = [];
let activeProject = null;
let chatHistory   = [];
let chatOpen      = false;
let currentSlide  = 0;
let selectedFeats = new Set();

// ═══════════════════════════════════════════════════════════════
//  LOCAL AUTH HELPERS  (all stored in localStorage)
// ═══════════════════════════════════════════════════════════════
const AUTH_KEY     = 'pm_users';
const SESSION_KEY  = 'pm_session';

function getUsers()        { return JSON.parse(storage.getItem(AUTH_KEY) || '{}'); }
function saveUsers(u)      { storage.setItem(AUTH_KEY, JSON.stringify(u)); }
function getSession()      { return JSON.parse(storage.getItem(SESSION_KEY) || 'null'); }
function saveSession(user) { storage.setItem(SESSION_KEY, JSON.stringify(user)); }
function clearSession()    { storage.removeItem(SESSION_KEY); }

function hashPassword(str) {
  // Simple deterministic hash (sufficient for local demo)
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(36);
}

function authRegister(name, email, password) {
  if (!name || !email || !password) throw new Error('All fields are required.');
  if (password.length < 6) throw new Error('Password must be at least 6 characters.');
  const users = getUsers();
  const key   = email.toLowerCase();
  if (users[key]) throw new Error('This email is already registered. Please log in.');
  const uid = 'u_' + Date.now().toString(36);
  users[key] = { uid, name, email, passwordHash: hashPassword(password), createdAt: Date.now() };
  saveUsers(users);
  return users[key];
}

function authLogin(email, password) {
  const users = getUsers();
  const key   = email.toLowerCase().trim();
  const user  = users[key];
  if (!user) throw new Error('No account found with this email. Please register first.');
  if (user.passwordHash !== hashPassword(password)) throw new Error('Incorrect password. Please try again.');
  return user;
}

// ── BOOTSTRAP: check existing session ───────────────────────────
(function init() {
  const session = getSession();
  if (session && session.uid) {
    currentUser = session;
    loadProjects();
    populateDashboard(currentUser);
    showPage('dashboard');
  } else {
    showPage('landing');
  }
})();

// ═══════════════════════════════════════════════════════════════
//  ROUTER
// ═══════════════════════════════════════════════════════════════
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pg = document.getElementById('page-' + id);
  if (pg) pg.classList.add('active');
  document.getElementById('chat-widget').classList.toggle('hidden', id !== 'report');
  window.scrollTo(0, 0);
}

// ═══════════════════════════════════════════════════════════════
//  LOCAL STORAGE — PROJECTS & STATS
// ═══════════════════════════════════════════════════════════════
function loadProjects() {
  if (!currentUser) return;
  const raw = storage.getItem(`pm_projects_${currentUser.uid}`);
  projects = raw ? JSON.parse(raw) : [];
}
function saveProjects() {
  if (!currentUser) return;
  storage.setItem(`pm_projects_${currentUser.uid}`, JSON.stringify(projects));
}
function saveLastProjectPreview(proj, data) {
  if (!proj) return;
  storage.setItem('pm_last_project_preview', JSON.stringify({
    ...proj,
    reportData: data || proj.reportData || null
  }));
}
function getStats() {
  if (!currentUser) return { projects: 0, docs: 0, chats: 0, features: 0 };
  return JSON.parse(storage.getItem(`pm_stats_${currentUser.uid}`) || '{"projects":0,"docs":0,"chats":0,"features":0}');
}
function saveStats(s) {
  if (!currentUser) return;
  storage.setItem(`pm_stats_${currentUser.uid}`, JSON.stringify(s));
}

// ═══════════════════════════════════════════════════════════════
//  LANDING PAGE
// ═══════════════════════════════════════════════════════════════
document.getElementById('nav-login-btn').addEventListener('click', () => { switchTab('login'); showPage('auth'); });
document.getElementById('nav-get-started-btn').addEventListener('click', () => { switchTab('register'); showPage('auth'); });
document.getElementById('hero-start-btn').addEventListener('click', () => {
  if (currentUser) showPage('dashboard');
  else { switchTab('register'); showPage('auth'); }
});
document.getElementById('hero-demo-btn').addEventListener('click', () => {
  document.getElementById('features-section').scrollIntoView({ behavior: 'smooth' });
});

// ═══════════════════════════════════════════════════════════════
//  AUTH PAGE
// ═══════════════════════════════════════════════════════════════
window.switchTab = function(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
  document.getElementById(`form-${tab}`).classList.add('active');
  // Clear messages
  ['login-error','reg-error','reg-success'].forEach(id => document.getElementById(id).classList.add('hidden'));
};
document.getElementById('tab-login').addEventListener('click', () => switchTab('login'));
document.getElementById('tab-register').addEventListener('click', () => switchTab('register'));

// Eye toggle
document.querySelectorAll('.eye-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const inp = document.getElementById(btn.dataset.target);
    if (!inp) return;
    inp.type = inp.type === 'password' ? 'text' : 'password';
    btn.textContent = inp.type === 'password' ? '👁' : '🙈';
  });
});

// ── REGISTER ────────────────────────────────────────────────────
document.getElementById('form-register').addEventListener('submit', e => {
  e.preventDefault();
  const name  = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const pass  = document.getElementById('reg-password').value;
  document.getElementById('reg-error').classList.add('hidden');
  document.getElementById('reg-success').classList.add('hidden');
  setAuthLoading(true, 'reg');
  try {
    authRegister(name, email, pass);
    setAuthLoading(false, 'reg');
    showAuthMsg('reg-success', `✅ Account created successfully! You can now log in.`, 'success');
    document.getElementById('form-register').reset();
    // Auto-switch to login after 1.5s
    setTimeout(() => switchTab('login'), 1500);
  } catch (err) {
    setAuthLoading(false, 'reg');
    showAuthMsg('reg-error', '❌ ' + err.message, 'error');
  }
});

// ── LOGIN ────────────────────────────────────────────────────────
document.getElementById('form-login').addEventListener('submit', e => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-password').value;
  document.getElementById('login-error').classList.add('hidden');
  setAuthLoading(true, 'login');
  try {
    const user = authLogin(email, pass);
    saveSession(user);
    currentUser = user;
    setAuthLoading(false, 'login');
    loadProjects();
    populateDashboard(user);
    showToast('Welcome back, ' + user.name.split(' ')[0] + '! 🎉', 'success');
    showPage('dashboard');
  } catch (err) {
    setAuthLoading(false, 'login');
    showAuthMsg('login-error', '❌ ' + err.message, 'error');
  }
});

function setAuthLoading(on, prefix) {
  const spin = document.getElementById(`${prefix}-spin`);
  const text = document.getElementById(`${prefix}-btn-text`);
  if (!spin || !text) return;
  if (on) { spin.classList.remove('hidden'); text.classList.add('hidden'); }
  else    { spin.classList.add('hidden');    text.classList.remove('hidden'); }
}
function showAuthMsg(id, msg, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = `auth-msg ${type}`;
  el.classList.remove('hidden');
}

// ── LOGOUT ───────────────────────────────────────────────────────
document.getElementById('logout-btn').addEventListener('click', () => {
  clearSession();
  currentUser = null; projects = []; activeProject = null; chatHistory = [];
  showPage('landing');
  showToast('Logged out successfully.', 'success');
});

// ═══════════════════════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════════════════════
function populateDashboard(user) {
  const name = user.name || user.email.split('@')[0];
  document.getElementById('dash-user-name').textContent = name;
  document.getElementById('dash-user-av').textContent   = name[0].toUpperCase();
  document.getElementById('dash-greeting').textContent  = name.split(' ')[0];
  loadProjects();
  const stats = getStats();
  document.getElementById('s-projects').textContent = stats.projects;
  document.getElementById('s-docs').textContent     = stats.docs;
  document.getElementById('s-chats').textContent    = stats.chats;
  document.getElementById('s-features').textContent = stats.features;
  renderProjectsList();
}

function renderProjectsList() {
  const list = document.getElementById('proj-list');
  if (!projects.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-ico">🚀</div>
        <h3>No projects yet</h3>
        <p>Start your first project and let AI do the heavy lifting!</p>
        <button class="btn btn-primary" onclick="document.getElementById('new-proj-btn').click()">✦ Create First Project</button>
      </div>`;
    return;
  }
  list.innerHTML = projects.slice().reverse().map(p => `
    <div class="proj-card glass-card" onclick="openProject('${p.id}')">
      <div class="proj-card-top">
        <span class="proj-domain-tag">${escHtml(p.domain)}</span>
        <span class="proj-date">${new Date(p.createdAt).toLocaleDateString()}</span>
      </div>
      <div class="proj-name">${escHtml(p.title)}</div>
      <div class="proj-abstract-preview">${escHtml(p.abstract.substring(0,120))}...</div>
      <div class="proj-card-footer">
        <span style="font-size:12px;color:var(--text3)">${escHtml(p.type)} · ${escHtml(p.timeline)}</span>
        <button class="btn btn-primary btn-sm">Open →</button>
      </div>
    </div>`).join('');
}

window.openProject = function(id) {
  const proj = projects.find(p => p.id === id);
  if (!proj || !proj.reportData) return;
  activeProject = proj;
  selectedFeats = new Set();
  renderReport(proj.reportData, proj);
  showPage('report');
};

document.getElementById('new-proj-btn').addEventListener('click', startWizard);

function startWizard() {
  resetWizard();
  showPage('wizard');
}

// ═══════════════════════════════════════════════════════════════
//  WIZARD
// ═══════════════════════════════════════════════════════════════
let wizData = {};

function resetWizard() {
  wizData = {};
  document.getElementById('w-title').value    = '';
  document.getElementById('w-domain').value   = '';
  document.getElementById('w-abstract').value = '';
  document.getElementById('w-tech').value     = '';
  document.getElementById('abs-count').textContent = '0';
  showWizStep(1);
}

function showWizStep(n) {
  document.querySelectorAll('.wiz-panel').forEach((p,i) => p.classList.toggle('active', i === n - 1));
  document.querySelectorAll('.wiz-step-item').forEach((s,i) => {
    s.classList.toggle('active', i === n - 1);
    s.classList.toggle('done', i < n - 1);
  });
  document.querySelectorAll('.wp-line').forEach((l,i) => l.classList.toggle('done', i < n - 1));
}

document.getElementById('w-abstract').addEventListener('input', function() {
  document.getElementById('abs-count').textContent = this.value.length;
});

document.getElementById('s1-next').addEventListener('click', () => {
  const title    = document.getElementById('w-title').value.trim();
  const domain   = document.getElementById('w-domain').value;
  const abstract = document.getElementById('w-abstract').value.trim();
  if (!title)               return showToast('Please enter a project title.', 'error');
  if (!domain)              return showToast('Please select a project domain.', 'error');
  if (abstract.length < 50) return showToast('Abstract must be at least 50 characters.', 'error');
  wizData.title = title; wizData.domain = domain; wizData.abstract = abstract;
  showWizStep(2);
});

document.getElementById('s2-prev').addEventListener('click', () => showWizStep(1));

document.getElementById('s2-next').addEventListener('click', async () => {
  wizData.type     = document.querySelector('input[name="proj-type"]:checked').value;
  wizData.team     = document.getElementById('w-team').value;
  wizData.timeline = document.getElementById('w-timeline').value;
  wizData.techPref = document.getElementById('w-tech').value.trim();
  showWizStep(3);
  await runAnalysis();
});

document.getElementById('wiz-back-btn').addEventListener('click', () => showPage('dashboard'));
document.getElementById('retry-btn').addEventListener('click', () => runAnalysis());

// ── ANALYSIS ─────────────────────────────────────────────────────
async function runAnalysis() {
  const loading = document.getElementById('ai-loading');
  const errWrap = document.getElementById('ai-error');
  loading.classList.remove('hidden');
  errWrap.classList.add('hidden');

  const steps = document.querySelectorAll('.load-step');
  steps.forEach(s => s.classList.remove('active','done'));

  const delays = [0, 1500, 3000, 4500, 6000, 7500, 9000];
  const timers = delays.map((d, i) => setTimeout(() => {
    if (i > 0) { steps[i-1].classList.remove('active'); steps[i-1].classList.add('done'); }
    if (steps[i]) steps[i].classList.add('active');
  }, d));

  try {
    const raw    = await callOpenAI(buildPrompt(wizData));
    const parsed = parseGeminiJSON(raw);

    timers.forEach(clearTimeout);
    steps.forEach(s => { s.classList.remove('active'); s.classList.add('done'); });

    const proj = {
      id: Date.now().toString(), title: wizData.title, domain: wizData.domain,
      abstract: wizData.abstract, type: wizData.type, team: wizData.team,
      timeline: wizData.timeline, techPref: wizData.techPref,
      createdAt: Date.now(), reportData: parsed
    };
    projects.push(proj);
    saveProjects();
    saveLastProjectPreview(proj, parsed);
    activeProject = proj;

    const stats = getStats();
    stats.projects++; stats.docs += 10;
    saveStats(stats);

    setTimeout(() => {
      selectedFeats = new Set();
      renderReport(parsed, proj);
      showPage('report');
      populateDashboard(currentUser);
    }, 600);

  } catch (err) {
    console.warn('API error encountered. Falling back to local generation...', err);
    showToast('⚡ Running in high-fidelity offline mode.', 'success');
    
    try {
      const parsed = generateMockData(wizData);
      
      timers.forEach(clearTimeout);
      steps.forEach(s => { s.classList.remove('active'); s.classList.add('done'); });

      const proj = {
        id: Date.now().toString(), title: wizData.title, domain: wizData.domain,
        abstract: wizData.abstract, type: wizData.type, team: wizData.team,
        timeline: wizData.timeline, techPref: wizData.techPref,
        createdAt: Date.now(), reportData: parsed
      };
      projects.push(proj);
      saveProjects();
      saveLastProjectPreview(proj, parsed);
      activeProject = proj;

      const stats = getStats();
      stats.projects++; stats.docs += 10;
      saveStats(stats);

      setTimeout(() => {
        selectedFeats = new Set();
        renderReport(parsed, proj);
        showPage('report');
        populateDashboard(currentUser);
      }, 600);
      
    } catch (fallbackErr) {
      console.error('Fallback generation error:', fallbackErr);
      timers.forEach(clearTimeout);
      loading.classList.add('hidden');
      errWrap.classList.remove('hidden');
      document.getElementById('err-msg').textContent = 'Analysis failed. Please try again.';
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  GEMINI API
// ═══════════════════════════════════════════════════════════════
async function callOpenAI(prompt, history = null) {
  if (!OPENAI_KEY) {
    throw new Error('OpenAI API Key is not set. Go to Settings (gear icon) to configure it.');
  }
  let messages = [];
  let responseFormat = undefined;

  if (history) {
    messages = history;
  } else {
    messages = [
      { role: 'user', content: prompt }
    ];
    responseFormat = { type: 'json_object' };
  }

  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: messages,
      temperature: 0.7,
      max_tokens: 4000,
      response_format: responseFormat
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${err.substring(0, 200)}`);
  }
  const json = await res.json();
  return json.choices?.[0]?.message?.content || '';
}

function buildPrompt(w) {
  return `You are ProMentor AI, an expert software project development assistant. Analyze the project below and generate a COMPREHENSIVE project development package.

PROJECT DETAILS:
- Title: ${w.title}
- Domain: ${w.domain}
- Type: ${w.type}
- Team Size: ${w.team}
- Timeline: ${w.timeline}
- Tech Preferences: ${w.techPref || 'None — recommend the best stack'}
- Abstract: ${w.abstract}

Return ONLY a single valid JSON object (no markdown, no code blocks, just raw JSON) with this EXACT structure. Be specific to THIS project:

{
  "overview": {
    "tagline": "One-line project tagline",
    "problemStatement": "Clear problem statement (2-3 sentences)",
    "objectives": ["6 specific objectives starting with action verbs"],
    "scope": "What is included and excluded (3-4 sentences)",
    "targetUsers": ["4-5 specific target user groups"],
    "expectedOutcomes": ["5-6 measurable expected outcomes"],
    "modules": [
      { "name": "Module Name", "description": "Module description", "features": ["feature 1", "feature 2", "feature 3"] }
    ]
  },
  "techStack": {
    "languages":  [{"name": "Language",  "purpose": "Why used here", "icon": "emoji"}],
    "frameworks": [{"name": "Framework", "purpose": "Why used here", "icon": "emoji"}],
    "databases":  [{"name": "Database",  "purpose": "Why used here", "icon": "emoji"}],
    "apis":       [{"name": "API",       "purpose": "How it is used", "icon": "emoji"}],
    "aiml":       [{"name": "Library",   "purpose": "ML task it handles", "icon": "emoji"}],
    "devtools":   [{"name": "Tool",      "purpose": "Development purpose", "icon": "emoji"}],
    "deployment": [{"name": "Platform",  "purpose": "Deployment role", "icon": "emoji"}],
    "testing":    [{"name": "Framework", "purpose": "Testing purpose", "icon": "emoji"}]
  },
  "srs": {
    "introduction": "Introduction paragraph",
    "purpose": "Purpose of this SRS",
    "scope": "Scope description",
    "definitions": {"term1": "definition1", "term2": "definition2", "term3": "definition3"},
    "functionalRequirements": [
      {"id": "FR-001", "title": "Requirement title", "description": "Detailed description", "priority": "High"}
    ],
    "nonFunctionalRequirements": [
      {"id": "NFR-001", "title": "Requirement title", "description": "Detailed description", "category": "Performance"}
    ],
    "systemConstraints": ["constraint 1", "constraint 2", "constraint 3"],
    "assumptions": ["assumption 1", "assumption 2"],
    "dependencies": ["dependency 1", "dependency 2"]
  },
  "diagrams": {
    "useCase":            "flowchart TD\\n  User([User]) --> A[Feature 1]\\n  User --> B[Feature 2]",
    "classDiagram":       "classDiagram\\n  class MyClass {\\n    +id: int\\n    +name: string\\n    +method(): void\\n  }",
    "sequenceDiagram":    "sequenceDiagram\\n  participant U as User\\n  participant S as Server\\n  U->>S: Request\\n  S-->>U: Response",
    "erDiagram":          "erDiagram\\n  ENTITY1 {\\n    int id PK\\n    string name\\n  }\\n  ENTITY1 ||--o{ ENTITY2 : has",
    "systemArchitecture": "flowchart TB\\n  C[Client] --> G[API Gateway]\\n  G --> SV[Service]\\n  SV --> DB[(Database)]",
    "dataFlow":           "flowchart LR\\n  IN[Input] --> P[Process] --> OUT[Output]"
  },
  "codeStructure": {
    "architecturePattern": "e.g. MVC",
    "folderTree": "project/\\n├── src/\\n│   ├── components/\\n│   └── services/\\n└── README.md",
    "keyFiles": [{"path": "src/index.js", "purpose": "Entry point"}],
    "apiEndpoints": [{"method": "GET", "endpoint": "/api/items", "description": "Returns item list"}]
  },
  "testCases": [
    {
      "module": "Module Name",
      "cases": [{"id": "TC-001", "title": "Test title", "input": "Test input", "expected": "Expected output", "type": "Unit"}]
    }
  ],
  "featureSuggestions": [
    {"id": "FS-001", "title": "Feature title", "description": "Feature description — 2 sentences", "type": "AI Integration", "impact": "High", "effort": "Medium", "icon": "🤖"}
  ],
  "slides": [
    {"slideNumber": 1, "title": "Slide Title", "content": ["Point 1", "Point 2", "Point 3"], "notes": "Speaker notes"}
  ],
  "vivaQuestions": [
    {"question": "Question text?", "answer": "Detailed answer (3-5 sentences)", "category": "Technical"}
  ]
}

REQUIREMENTS (all mandatory):
- 4+ modules with 3+ features each
- 5+ objectives, 6+ functional requirements, 4+ non-functional requirements
- Valid Mermaid.js syntax for ALL 6 diagrams (use \\n for newlines inside JSON strings, escape all special characters)
- 6+ diverse feature suggestions (AI, IoT, Cloud, Security, Analytics, Mobile, etc.)
- Exactly 8 slides: Title, Problem Statement, Objectives, System Architecture, Modules, Tech Stack, Key Features, Q&A
- 10+ viva questions across categories: Technical, Architecture, Database, Security, General
- Everything must be SPECIFIC to this project — no generic boilerplate
- Return ONLY valid JSON — absolutely no other text, no markdown fences`;
}

function parseGeminiJSON(text) {
  let cleaned = text.trim()
    .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch {}
    }
    throw new Error('AI returned invalid JSON. Please retry — the model occasionally makes formatting errors.');
  }
}

// ═══════════════════════════════════════════════════════════════
//  REPORT RENDERING
// ═══════════════════════════════════════════════════════════════
function renderReport(data, proj) {
  document.getElementById('rpt-domain').textContent = proj.domain;
  document.getElementById('rpt-title').textContent  = proj.title;
  document.getElementById('rpt-meta').textContent   =
    `Generated by ProMentor AI · ${new Date(proj.createdAt).toLocaleString()} · ${proj.type} · Team: ${proj.team} · Timeline: ${proj.timeline}`;

  document.getElementById('rqs-mod').textContent  = data.overview?.modules?.length  || 0;
  document.getElementById('rqs-tech').textContent = countTech(data.techStack);
  document.getElementById('rqs-viva').textContent = data.vivaQuestions?.length      || 0;
  document.getElementById('rqs-feat').textContent = data.featureSuggestions?.length || 0;

  renderOverviewTab(data.overview, proj);
  renderTechStackTab(data.techStack);
  renderSrsTab(data.srs);
  renderDiagramsTab(data.diagrams);
  renderCodeTab(data.codeStructure);
  renderTestsTab(data.testCases);
  renderFeaturesTab(data.featureSuggestions);
  renderSlidesTab(data.slides);
  renderFullReportTab(data, proj);
  renderVivaTab(data.vivaQuestions);

  switchReportTab('overview');
  initChat(proj, data);
}

function countTech(ts) {
  if (!ts) return 0;
  return ['languages','frameworks','databases','apis','aiml','devtools','deployment','testing']
    .reduce((a, k) => a + (ts[k]?.length || 0), 0);
}

// ── TABS ─────────────────────────────────────────────────────────
document.getElementById('rpt-tabs').addEventListener('click', e => {
  const btn = e.target.closest('.rtab');
  if (btn) switchReportTab(btn.dataset.tab);
});

function switchReportTab(tab) {
  document.querySelectorAll('.rtab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => {
    const active = p.id === `tp-${tab}`;
    p.classList.toggle('active', active);
    p.style.display = active ? 'block' : 'none';
  });
  if (tab === 'diagrams') setTimeout(renderMermaidDiagrams, 150);
}

// ── OVERVIEW ─────────────────────────────────────────────────────
function renderOverviewTab(ov, proj) {
  if (!ov) return;
  document.getElementById('tp-overview').innerHTML = `
    <div style="margin-bottom:24px">
      <div class="rsec-title">📊 Project Overview</div>
      <p class="rsec-sub">${escHtml(ov.tagline || '')}</p>
    </div>
    <div class="overview-grid">
      <div>
        <div class="content-section glass-card" style="padding:24px;margin-bottom:16px">
          <div class="content-section-title">🎯 Problem Statement</div>
          <p style="color:var(--text2);line-height:1.8;font-size:14px">${escHtml(ov.problemStatement||'')}</p>
        </div>
        <div class="content-section glass-card" style="padding:24px;margin-bottom:16px">
          <div class="content-section-title">🏆 Objectives</div>
          <ul class="objectives-list">${(ov.objectives||[]).map(o=>`<li>${escHtml(o)}</li>`).join('')}</ul>
        </div>
        <div class="content-section glass-card" style="padding:24px;margin-bottom:16px">
          <div class="content-section-title">📦 Scope</div>
          <p style="color:var(--text2);line-height:1.8;font-size:14px">${escHtml(ov.scope||'')}</p>
        </div>
        <div class="content-section glass-card" style="padding:24px">
          <div class="content-section-title">🔷 Modules</div>
          ${(ov.modules||[]).map(m=>`
            <div class="module-card">
              <div class="module-name">${escHtml(m.name)}</div>
              <div class="module-desc">${escHtml(m.description)}</div>
              <div class="module-features">${(m.features||[]).map(f=>`<span class="mod-feat-tag">${escHtml(f)}</span>`).join('')}</div>
            </div>`).join('')}
        </div>
      </div>
      <div>
        <div class="glass-card" style="padding:24px;margin-bottom:16px">
          <div class="content-section-title">👥 Target Users</div>
          <div>${(ov.targetUsers||[]).map(u=>`<span class="target-user-tag">${escHtml(u)}</span>`).join('')}</div>
        </div>
        <div class="glass-card" style="padding:24px">
          <div class="content-section-title">✅ Expected Outcomes</div>
          <div>${(ov.expectedOutcomes||[]).map(o=>`<span class="outcome-tag">${escHtml(o)}</span>`).join('')}</div>
        </div>
      </div>
    </div>`;
}

// ── TECH STACK ───────────────────────────────────────────────────
function renderTechStackTab(ts) {
  if (!ts) return;
  const secs = [
    {key:'languages', label:'💻 Programming Languages'},
    {key:'frameworks',label:'🧩 Frameworks & Libraries'},
    {key:'databases', label:'🗄️ Databases'},
    {key:'apis',      label:'🔌 APIs & Services'},
    {key:'aiml',      label:'🧠 AI/ML Libraries'},
    {key:'devtools',  label:'🛠️ Dev Tools'},
    {key:'deployment',label:'☁️ Deployment & Cloud'},
    {key:'testing',   label:'🧪 Testing Frameworks'},
  ];
  document.getElementById('tp-techstack').innerHTML = `
    <div style="margin-bottom:24px">
      <div class="rsec-title">⚙️ Technology Stack</div>
      <p class="rsec-sub">Recommended technologies tailored to your project</p>
    </div>
    <div class="tech-sections">
      ${secs.map(s => {
        const items = ts[s.key] || [];
        if (!items.length) return '';
        return `<div class="tech-section glass-card">
          <div class="tech-sec-title">${s.label}</div>
          ${items.map(i=>`
            <div class="tech-item">
              <span style="font-size:20px">${i.icon||'📦'}</span>
              <div style="flex:1">
                <div class="tech-item-name">${escHtml(i.name)}</div>
                <div class="tech-item-purpose">${escHtml(i.purpose)}</div>
              </div>
            </div>`).join('')}
        </div>`;
      }).join('')}
    </div>`;
}

// ── SRS ──────────────────────────────────────────────────────────
function renderSrsTab(srs) {
  if (!srs) return;
  const pc = p => ({High:'prio-high',Medium:'prio-med',Low:'prio-low'}[p]||'prio-med');
  document.getElementById('tp-srs').innerHTML = `
    <div style="margin-bottom:24px;display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <div class="rsec-title">📄 Software Requirements Specification</div>
        <p class="rsec-sub">Complete SRS for ${escHtml(activeProject?.title||'')}</p>
      </div>
      <button class="copy-btn" onclick="copySection('tp-srs')">📋 Copy</button>
    </div>
    <div class="srs-body">
      <div class="srs-block glass-card"><div class="srs-block-title">1. Introduction</div><p class="srs-text">${escHtml(srs.introduction||'')}</p></div>
      <div class="srs-block glass-card"><div class="srs-block-title">2. Purpose</div><p class="srs-text">${escHtml(srs.purpose||'')}</p></div>
      <div class="srs-block glass-card"><div class="srs-block-title">3. Scope</div><p class="srs-text">${escHtml(srs.scope||'')}</p></div>
      ${srs.definitions&&Object.keys(srs.definitions).length?`
      <div class="srs-block glass-card">
        <div class="srs-block-title">4. Definitions &amp; Acronyms</div>
        <table style="width:100%;border-collapse:collapse">
          ${Object.entries(srs.definitions).map(([k,v])=>`
            <tr style="border-bottom:1px solid var(--glass-bdr)">
              <td style="padding:10px 14px;font-weight:700;font-size:14px;width:180px;color:var(--text)">${escHtml(k)}</td>
              <td style="padding:10px 14px;font-size:13px;color:var(--text2)">${escHtml(v)}</td>
            </tr>`).join('')}
        </table>
      </div>`:''}
      <div class="srs-block glass-card">
        <div class="srs-block-title">5. Functional Requirements</div>
        ${(srs.functionalRequirements||[]).map(r=>`
          <div class="req-item">
            <div class="req-id">${escHtml(r.id)}</div>
            <div class="req-title">${escHtml(r.title)}</div>
            <div class="req-desc">${escHtml(r.description)}</div>
            <span class="req-priority ${pc(r.priority)}">${escHtml(r.priority||'Medium')}</span>
          </div>`).join('')}
      </div>
      <div class="srs-block glass-card">
        <div class="srs-block-title">6. Non-Functional Requirements</div>
        ${(srs.nonFunctionalRequirements||[]).map(r=>`
          <div class="req-item" style="border-left-color:rgba(6,182,212,0.5)">
            <div class="req-id" style="color:#67e8f9">${escHtml(r.id)}</div>
            <div class="req-title">${escHtml(r.title)}</div>
            <div class="req-desc">${escHtml(r.description)}</div>
            ${r.category?`<span class="req-priority" style="background:rgba(6,182,212,0.1);color:#67e8f9">${escHtml(r.category)}</span>`:''}
          </div>`).join('')}
      </div>
      <div class="srs-block glass-card">
        <div class="srs-block-title">7. System Constraints</div>
        <div>${(srs.systemConstraints||[]).map(c=>`<span class="constraint-tag">⚠️ ${escHtml(c)}</span>`).join('')}</div>
      </div>
      <div class="srs-block glass-card">
        <div class="srs-block-title">8. Assumptions &amp; Dependencies</div>
        <div style="margin-bottom:12px"><strong style="font-size:13px">Assumptions:</strong>
          ${(srs.assumptions||[]).map(a=>`<div style="padding:6px 0;font-size:13px;color:var(--text2);border-bottom:1px solid rgba(255,255,255,0.04)">→ ${escHtml(a)}</div>`).join('')}
        </div>
        <div><strong style="font-size:13px">Dependencies:</strong>
          ${(srs.dependencies||[]).map(d=>`<div style="padding:6px 0;font-size:13px;color:var(--text2);border-bottom:1px solid rgba(255,255,255,0.04)">→ ${escHtml(d)}</div>`).join('')}
        </div>
      </div>
    </div>`;
}

// ── DIAGRAMS ─────────────────────────────────────────────────────
function renderDiagramsTab(diagrams) {
  if (!diagrams) return;
  const defs = [
    {key:'useCase',            label:'👤 Use Case Diagram',      desc:'Actor-system interactions'},
    {key:'classDiagram',       label:'🔷 Class Diagram',         desc:'OOP class structure'},
    {key:'sequenceDiagram',    label:'↔️ Sequence Diagram',      desc:'System interaction flow'},
    {key:'erDiagram',          label:'🗄️ ER Diagram',            desc:'Database entity relationships'},
    {key:'systemArchitecture', label:'🏗️ System Architecture',   desc:'High-level system design'},
    {key:'dataFlow',           label:'🌊 Data Flow Diagram',     desc:'Data movement through system'},
  ];
  document.getElementById('tp-diagrams').innerHTML = `
    <div style="margin-bottom:24px">
      <div class="rsec-title">📐 Diagrams &amp; Architecture</div>
      <p class="rsec-sub">Auto-generated diagrams using Mermaid.js</p>
    </div>
    <div class="diagrams-grid">
      ${defs.map(d=>`
        <div class="diagram-card glass-card">
          <div class="diagram-title">${d.label} <span style="font-size:11px;color:var(--text3);font-weight:400">— ${d.desc}</span></div>
          <div class="diagram-wrap">
            <div class="mermaid" id="diag-${d.key}" data-src="${escAttr(diagrams[d.key]||'')}">
              ${escHtml(diagrams[d.key]||'graph TD\n  A[No diagram]')}
            </div>
          </div>
        </div>`).join('')}
    </div>`;
}

async function renderMermaidDiagrams() {
  initMermaid();
  const els = document.querySelectorAll('.mermaid[data-src]');
  for (const el of els) {
    if (el.dataset.rendered) continue;
    const src = el.getAttribute('data-src') || el.textContent.trim();
    if (!src) continue;
    try {
      const id = 'mm_' + el.id + '_' + Date.now().toString(36);
      const { svg } = await mermaid.render(id, src);
      el.innerHTML = svg;
      el.dataset.rendered = '1';
    } catch (e) {
      el.innerHTML = `<div class="diagram-error">⚠️ Could not render diagram<br><small>${escHtml(e.message?.substring(0,100)||'')}</small></div>`;
      el.dataset.rendered = '1';
    }
  }
}

async function forceRenderMermaidDiagrams() {
  initMermaid();
  const els = document.querySelectorAll('.mermaid[data-src]');
  for (const el of els) {
    el.removeAttribute('data-rendered');
    const src = el.getAttribute('data-src');
    if (!src) continue;
    try {
      const id = 'mm_' + el.id + '_' + Date.now().toString(36);
      const { svg } = await mermaid.render(id, src);
      el.innerHTML = svg;
      el.dataset.rendered = '1';
    } catch (e) {
      el.innerHTML = `<div class="diagram-error">⚠️ Could not render diagram<br><small>${escHtml(e.message?.substring(0,100)||'')}</small></div>`;
      el.dataset.rendered = '1';
    }
  }
}

// ── CODE STRUCTURE ───────────────────────────────────────────────
function renderCodeTab(cs) {
  if (!cs) return;
  const mc = m => ({GET:'m-get',POST:'m-post',PUT:'m-put',DELETE:'m-delete'}[m?.toUpperCase()]||'m-get');
  document.getElementById('tp-codestructure').innerHTML = `
    <div style="margin-bottom:24px">
      <div class="rsec-title">💻 Source Code Structure</div>
      <p class="rsec-sub">Architecture: <strong>${escHtml(cs.architecturePattern||'MVC')}</strong></p>
    </div>
    <div class="code-grid">
      <div>
        <div class="code-tree-wrap glass-card">
          <div class="content-section-title">📁 Folder Structure</div>
          <pre class="code-tree">${escHtml(cs.folderTree||'')}</pre>
        </div>
        ${cs.keyFiles?.length?`
        <div class="glass-card" style="padding:24px;margin-top:16px">
          <div class="content-section-title">🗝️ Key Files</div>
          ${cs.keyFiles.map(f=>`
            <div style="padding:10px 0;border-bottom:1px solid var(--glass-bdr)">
              <div style="font-family:'JetBrains Mono',monospace;font-size:12px;color:#a5f3fc;margin-bottom:4px">${escHtml(f.path)}</div>
              <div style="font-size:13px;color:var(--text2)">${escHtml(f.purpose)}</div>
            </div>`).join('')}
        </div>`:''}
      </div>
      <div class="glass-card" style="padding:24px">
        <div class="content-section-title">🔌 API Endpoints</div>
        ${(cs.apiEndpoints||[]).map(ep=>`
          <div class="endpoint-item">
            <span class="method-badge ${mc(ep.method)}">${escHtml(ep.method)}</span>
            <span class="endpoint-path">${escHtml(ep.endpoint)}</span>
            <span class="endpoint-desc">${escHtml(ep.description)}</span>
          </div>`).join('')}
      </div>
    </div>`;
}

// ── TEST CASES ───────────────────────────────────────────────────
function renderTestsTab(testCases) {
  if (!testCases) return;
  const tc = t => ({Unit:'t-unit',Integration:'t-integration',System:'t-system'}[t]||'t-unit');
  document.getElementById('tp-testcases').innerHTML = `
    <div style="margin-bottom:24px">
      <div class="rsec-title">🧪 Test Cases</div>
      <p class="rsec-sub">Comprehensive test coverage for all modules</p>
    </div>
    ${(testCases||[]).map(mod=>`
      <div class="test-module glass-card" style="padding:24px;margin-bottom:16px">
        <div class="test-module-name">📦 ${escHtml(mod.module)}</div>
        <table class="test-table">
          <thead><tr><th>ID</th><th>Title</th><th>Input</th><th>Expected Output</th><th>Type</th></tr></thead>
          <tbody>
            ${(mod.cases||[]).map(c=>`
              <tr>
                <td style="font-family:'JetBrains Mono',monospace;font-size:12px;color:#a78bfa">${escHtml(c.id)}</td>
                <td style="font-weight:600;color:var(--text)">${escHtml(c.title)}</td>
                <td>${escHtml(c.input)}</td>
                <td>${escHtml(c.expected)}</td>
                <td><span class="test-type ${tc(c.type)}">${escHtml(c.type)}</span></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`).join('')}`;
}

// ── FEATURE SUGGESTIONS ──────────────────────────────────────────
function renderFeaturesTab(features) {
  if (!features) return;
  const ic = i => ({High:'impact-high',Medium:'impact-med',Low:'impact-low'}[i]||'impact-med');
  const ec = e => ({High:'effort-high',Medium:'effort-med',Low:'effort-low'}[e]||'effort-med');
  document.getElementById('tp-features').innerHTML = `
    <div class="features-tab-intro">
      <div>
        <div class="rsec-title">✨ AI Feature Suggestions</div>
        <p class="feat-tab-note">Click cards to select features to incorporate into your plan</p>
      </div>
      <span class="selected-count" id="feat-sel-count">0 selected</span>
    </div>
    <div class="features-suggestions-grid">
      ${(features||[]).map(f=>`
        <div class="feat-suggestion-card glass-card" data-id="${escAttr(f.id)}" onclick="toggleFeature(this,'${escAttr(f.id)}')">
          <div class="fs-header">
            <span class="fs-icon">${f.icon||'✨'}</span>
            <div class="fs-checkbox" id="fc-${escAttr(f.id)}"></div>
          </div>
          <div class="fs-title">${escHtml(f.title)}</div>
          <div class="fs-desc">${escHtml(f.description)}</div>
          <div class="fs-tags">
            <span class="fs-tag fs-type">${escHtml(f.type)}</span>
            <span class="fs-tag ${ic(f.impact)}">Impact: ${escHtml(f.impact)}</span>
            <span class="fs-tag ${ec(f.effort)}">Effort: ${escHtml(f.effort)}</span>
          </div>
        </div>`).join('')}
    </div>
    <div class="incorporate-btn-wrap">
      <button class="btn btn-primary btn-lg" onclick="incorporateFeatures()">✦ Incorporate Selected Features</button>
    </div>`;
}

window.toggleFeature = function(card, id) {
  if (selectedFeats.has(id)) {
    selectedFeats.delete(id);
    card.classList.remove('selected');
    const cb = document.getElementById('fc-'+id);
    if (cb) cb.textContent = '';
  } else {
    selectedFeats.add(id);
    card.classList.add('selected');
    const cb = document.getElementById('fc-'+id);
    if (cb) cb.textContent = '✓';
  }
  document.getElementById('feat-sel-count').textContent = selectedFeats.size + ' selected';
};

window.incorporateFeatures = function() {
  if (!selectedFeats.size) return showToast('Select at least one feature first.', 'error');
  const stats = getStats(); stats.features += selectedFeats.size; saveStats(stats);
  showToast(`✅ ${selectedFeats.size} feature(s) incorporated into your project plan!`, 'success');
};

// ── SLIDES ───────────────────────────────────────────────────────
let slides = [];
function renderSlidesTab(slidesData) {
  if (!slidesData?.length) return;
  slides = slidesData; currentSlide = 0;
  document.getElementById('tp-slides').innerHTML = `
    <div style="margin-bottom:24px">
      <div class="rsec-title">🎴 Presentation Slides</div>
      <p class="rsec-sub">Ready-made slide outline for your presentation</p>
    </div>
    <div class="glass-card" style="overflow:hidden">
      <div class="slides-nav">
        <button class="btn btn-outline btn-sm" id="slide-prev">← Prev</button>
        <span class="slide-counter" id="slide-counter">1 / ${slides.length}</span>
        <button class="btn btn-outline btn-sm" id="slide-next">Next →</button>
      </div>
      <div id="slide-display" class="slide-display glass-card" style="margin:0 24px 24px;background:rgba(124,58,237,0.04)"></div>
      <div class="slide-dots" id="slide-dots">
        ${slides.map((_,i)=>`<div class="slide-dot ${i===0?'active':''}" onclick="goToSlide(${i})"></div>`).join('')}
      </div>
      <div style="height:24px"></div>
    </div>`;
  document.getElementById('slide-prev').addEventListener('click', () => changeSlide(-1));
  document.getElementById('slide-next').addEventListener('click', () => changeSlide(1));
  renderSlide(0);
}

function renderSlide(i) {
  const s = slides[i]; if (!s) return;
  document.getElementById('slide-display').innerHTML = `
    <div class="slide-num">Slide ${s.slideNumber||i+1} of ${slides.length}</div>
    <div class="slide-title">${escHtml(s.title)}</div>
    <ul class="slide-content-list">${(s.content||[]).map(c=>`<li>${escHtml(c)}</li>`).join('')}</ul>
    ${s.notes?`<div class="slide-notes">📝 Notes: ${escHtml(s.notes)}</div>`:''}`;
  document.getElementById('slide-counter').textContent = `${i+1} / ${slides.length}`;
  document.querySelectorAll('.slide-dot').forEach((d,j) => d.classList.toggle('active', j===i));
}
function changeSlide(dir) { currentSlide = (currentSlide+dir+slides.length)%slides.length; renderSlide(currentSlide); }
window.goToSlide = function(i) { currentSlide = i; renderSlide(i); };

// ── FULL REPORT ──────────────────────────────────────────────────
function renderFullReportTab(data, proj) {
  const ov = data.overview||{}, ts = data.techStack||{}, srs = data.srs||{};
  document.getElementById('tp-fullreport').innerHTML = `
    <div class="section-copy-btn">
      <button class="copy-btn" onclick="copySection('tp-fullreport')">📋 Copy Full Report</button>
    </div>
    <div class="full-report-wrap">
      <h1>${escHtml(proj.title)}</h1>
      <p><em>${escHtml(ov.tagline||'')}</em></p>
      <p><strong>Domain:</strong> ${escHtml(proj.domain)} &nbsp;|&nbsp; <strong>Type:</strong> ${escHtml(proj.type)} &nbsp;|&nbsp; <strong>Team:</strong> ${escHtml(proj.team)} &nbsp;|&nbsp; <strong>Timeline:</strong> ${escHtml(proj.timeline)}</p>
      <h2>1. Abstract</h2><p>${escHtml(proj.abstract)}</p>
      <h2>2. Problem Statement</h2><p>${escHtml(ov.problemStatement||'')}</p>
      <h2>3. Objectives</h2><ul>${(ov.objectives||[]).map(o=>`<li>${escHtml(o)}</li>`).join('')}</ul>
      <h2>4. Scope</h2><p>${escHtml(ov.scope||'')}</p>
      <h2>5. Target Users</h2><ul>${(ov.targetUsers||[]).map(u=>`<li>${escHtml(u)}</li>`).join('')}</ul>
      <h2>6. Modules</h2>
      ${(ov.modules||[]).map(m=>`<h3>${escHtml(m.name)}</h3><p>${escHtml(m.description)}</p><ul>${(m.features||[]).map(f=>`<li>${escHtml(f)}</li>`).join('')}</ul>`).join('')}
      <h2>7. Technology Stack</h2>
      <p><strong>Languages:</strong> ${escHtml((ts.languages||[]).map(t=>t.name).join(', '))}</p>
      <p><strong>Frameworks:</strong> ${escHtml((ts.frameworks||[]).map(t=>t.name).join(', '))}</p>
      <p><strong>Databases:</strong> ${escHtml((ts.databases||[]).map(t=>t.name).join(', '))}</p>
      <p><strong>APIs:</strong> ${escHtml((ts.apis||[]).map(t=>t.name).join(', '))}</p>
      <p><strong>Deployment:</strong> ${escHtml((ts.deployment||[]).map(t=>t.name).join(', '))}</p>
      <h2>8. SRS Summary</h2>
      <h3>Functional Requirements</h3>
      <ul>${(srs.functionalRequirements||[]).map(r=>`<li><strong>${escHtml(r.id)}:</strong> ${escHtml(r.title)} — ${escHtml(r.description)}</li>`).join('')}</ul>
      <h3>Non-Functional Requirements</h3>
      <ul>${(srs.nonFunctionalRequirements||[]).map(r=>`<li><strong>${escHtml(r.id)}:</strong> ${escHtml(r.title)} — ${escHtml(r.description)}</li>`).join('')}</ul>
      <h2>9. Expected Outcomes</h2>
      <ul>${(ov.expectedOutcomes||[]).map(o=>`<li>${escHtml(o)}</li>`).join('')}</ul>
    </div>`;
}

// ── VIVA Q&A ─────────────────────────────────────────────────────
let allViva = [];
function renderVivaTab(vivaQ) {
  if (!vivaQ) return;
  allViva = vivaQ;
  const cats = ['All', ...new Set(vivaQ.map(q => q.category||'General'))];
  document.getElementById('tp-viva').innerHTML = `
    <div style="margin-bottom:24px;display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
      <div>
        <div class="rsec-title">🎓 Viva Q&amp;A</div>
        <p class="rsec-sub">${vivaQ.length} questions with detailed answers — click any question to expand</p>
      </div>
      <button class="copy-btn" onclick="copySection('tp-viva')">📋 Copy All</button>
    </div>
    <div class="viva-filters" id="viva-filters">
      ${cats.map(c=>`<button class="viva-filter ${c==='All'?'active':''}" onclick="filterViva('${escAttr(c)}',this)">${escHtml(c)}</button>`).join('')}
    </div>
    <div id="viva-list">${renderVivaList(vivaQ)}</div>`;
}

function renderVivaList(items) {
  return items.map((q,i)=>`
    <div class="viva-item glass-card" id="vi-${i}">
      <div class="viva-category">${escHtml(q.category||'General')}</div>
      <div class="viva-q" onclick="toggleViva('vi-${i}')">
        <span>Q${i+1}: ${escHtml(q.question)}</span>
        <span class="viva-expand">▾</span>
      </div>
      <div class="viva-a">A: ${escHtml(q.answer)}</div>
    </div>`).join('');
}

window.filterViva = function(cat, btn) {
  document.querySelectorAll('.viva-filter').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const filtered = cat === 'All' ? allViva : allViva.filter(q => q.category === cat);
  document.getElementById('viva-list').innerHTML = renderVivaList(filtered);
};
window.toggleViva = function(id) { document.getElementById(id).classList.toggle('expanded'); };

// ── EXPORT / NAV ─────────────────────────────────────────────────
document.getElementById('rpt-export-btn').addEventListener('click', () => {
  showToast('Opening print dialog — choose "Save as PDF"', 'success');
  setTimeout(() => window.print(), 400);
});
document.getElementById('rpt-dash-btn').addEventListener('click', () => {
  populateDashboard(currentUser);
  showPage('dashboard');
});

// ═══════════════════════════════════════════════════════════════
//  AI MENTOR CHAT
// ═══════════════════════════════════════════════════════════════
function initChat(proj, data) {
  chatHistory = [
    { role: 'user', content:
      `You are an expert AI project mentor for the following project. Answer all questions helpfully, concisely, and specifically to this project context.
PROJECT: ${proj.title}
DOMAIN: ${proj.domain}
ABSTRACT: ${proj.abstract}
TECH STACK: ${JSON.stringify(data.techStack)}
ARCHITECTURE: ${data.codeStructure?.architecturePattern||'MVC'}
MODULES: ${(data.overview?.modules||[]).map(m=>m.name).join(', ')}
Be practical, friendly, and project-specific.`
    },
    { role: 'assistant', content: `Ready to help with "${proj.title}"! I know your full project context. What would you like to know?` }
  ];
  // Reset chat UI
  document.getElementById('chat-msgs').innerHTML = `
    <div class="chat-msg assistant">
      <div class="msg-av"><img src="logo.jpg" alt="ProMentor AI Logo" class="brand-logo-img" /></div>
      <div class="msg-bubble">👋 Hi! I'm your AI Mentor for <strong>${escHtml(proj.title)}</strong>. I have full context of your project — ask me anything about the tech stack, architecture, code, or development process!</div>
    </div>`;
  document.getElementById('chat-suggs').classList.remove('hidden');
}

document.getElementById('chat-fab').addEventListener('click', toggleChat);
document.getElementById('chat-close').addEventListener('click', toggleChat);

function toggleChat() {
  chatOpen = !chatOpen;
  document.getElementById('chat-panel').classList.toggle('hidden', !chatOpen);
  document.getElementById('chat-badge').classList.add('hidden');
  if (chatOpen) document.getElementById('chat-input').focus();
}

document.getElementById('chat-send').addEventListener('click', sendChatMessage);
document.getElementById('chat-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
});
document.getElementById('chat-input').addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 100) + 'px';
});

window.useSuggestion = function(btn) {
  document.getElementById('chat-input').value = btn.textContent;
  document.getElementById('chat-suggs').classList.add('hidden');
  sendChatMessage();
};

async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const msg   = input.value.trim();
  if (!msg) return;
  input.value = ''; input.style.height = 'auto';

  appendChatMsg('user', msg);
  chatHistory.push({ role: 'user', content: msg });

  const typingEl = document.createElement('div');
  typingEl.className = 'chat-msg assistant';
  typingEl.innerHTML = `<div class="msg-av"><img src="logo.jpg" alt="ProMentor AI Logo" class="brand-logo-img" /></div><div class="chat-typing"><span></span><span></span><span></span></div>`;
  document.getElementById('chat-msgs').appendChild(typingEl);
  scrollChat();

  try {
    const reply = await callOpenAI(null, chatHistory);
    typingEl.remove();
    chatHistory.push({ role: 'assistant', content: reply });
    appendChatMsg('assistant', reply);
    const stats = getStats(); stats.chats++; saveStats(stats);
  } catch (chatErr) {
    console.warn('Chat API error. Falling back to local responses...', chatErr);
    typingEl.remove();
    const localReply = generateLocalChatResponse(msg, activeProject);
    chatHistory.push({ role: 'assistant', content: localReply });
    appendChatMsg('assistant', localReply);
    const stats = getStats(); stats.chats++; saveStats(stats);
  }
}

function appendChatMsg(role, text) {
  const msgs = document.getElementById('chat-msgs');
  const div  = document.createElement('div');
  div.className = `chat-msg ${role}`;
  div.innerHTML = role === 'assistant'
    ? `<div class="msg-av"><img src="logo.jpg" alt="ProMentor AI Logo" class="brand-logo-img" /></div><div class="msg-bubble">${formatChatText(text)}</div>`
    : `<div class="msg-bubble">${escHtml(text)}</div><div class="msg-av" style="background:var(--grad2)">👤</div>`;
  msgs.appendChild(div);
  scrollChat();
}

function scrollChat() {
  const msgs = document.getElementById('chat-msgs');
  msgs.scrollTop = msgs.scrollHeight;
}

function formatChatText(text) {
  return escHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code style="background:rgba(255,255,255,0.1);padding:1px 5px;border-radius:3px;font-family:monospace;font-size:12px">$1</code>')
    .replace(/\n/g, '<br>');
}

// ═══════════════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════════════
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = msg;
  t.className = `toast ${type}`;
  t.classList.remove('hidden');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.add('hidden'), 3500);
}

function escHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function escAttr(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

window.copySection = function(id) {
  const el = document.getElementById(id);
  if (!el) return;
  navigator.clipboard.writeText(el.innerText||el.textContent)
    .then(() => showToast('📋 Copied to clipboard!', 'success'))
    .catch(() => showToast('Could not copy. Try selecting and copying manually.', 'error'));
};

// Smooth scroll for nav links
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', e => {
    const target = document.querySelector(link.getAttribute('href'));
    if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }); }
  });
});

// Make first tab panel visible
document.querySelectorAll('.tab-panel').forEach((p, i) => {
  p.style.display = i === 0 ? 'block' : 'none';
  if (i === 0) p.classList.add('active');
});

// Auto-run wizard analysis when URL contains ?autorun=1 and project params.
(function() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autorun') === '1') {
      wizData = wizData || {};
      wizData.title = params.get('title') || 'Demo Project';
      wizData.domain = params.get('domain') || 'Web Application';
      wizData.abstract = params.get('abstract') || 'Demo abstract for automated run.';
      wizData.type = params.get('type') || 'Academic';
      wizData.team = params.get('team') || '1 developer';
      wizData.timeline = params.get('timeline') || '1 month';
      wizData.techPref = params.get('techPref') || '';
      // populate fields if present
      if (document.getElementById('w-title')) document.getElementById('w-title').value = wizData.title;
      if (document.getElementById('w-domain')) document.getElementById('w-domain').value = wizData.domain;
      if (document.getElementById('w-abstract')) document.getElementById('w-abstract').value = wizData.abstract;
      if (document.getElementById('w-tech')) document.getElementById('w-tech').value = wizData.techPref;
      // show wizard and run analysis
      showPage('wizard');
      showWizStep(3);
      setTimeout(() => { runAnalysis().catch(e => console.error('autorun analysis failed', e)); }, 300);
    }
  } catch (e) { console.warn('autorun check failed', e); }
})();

// ── SETTINGS MODAL BINDINGS ──────────────────────────────────────
const settingsModal  = document.getElementById('settings-modal');
const openaiKeyInput = document.getElementById('set-openai-key');

// Temporary settings state
let settingsOriginalTheme = 'system';
let settingsOriginalKey = '';
let settingsTempTheme = 'system';

// Load initial settings value
openaiKeyInput.value = storage.getItem('pm_openai_key') || '';

function toggleSettingsModal(show) {
  if (show) {
    settingsOriginalTheme = storage.getItem('pm_theme') || 'system';
    settingsOriginalKey = storage.getItem('pm_openai_key') || '';
    settingsTempTheme = settingsOriginalTheme;
    openaiKeyInput.value = settingsOriginalKey;
    syncModeToggleUI(settingsTempTheme);
    settingsModal.classList.remove('hidden');
  } else {
    settingsModal.classList.add('hidden');
  }
}

// Bind show settings triggers
['dash-settings-btn', 'wiz-settings-btn', 'rpt-settings-btn'].forEach(id => {
  const btn = document.getElementById(id);
  if (btn) btn.addEventListener('click', () => toggleSettingsModal(true));
});

// Bind close triggers (with revert theme preview)
['settings-close', 'settings-cancel'].forEach(id => {
  const btn = document.getElementById(id);
  if (btn) btn.addEventListener('click', () => {
    applyTheme(settingsOriginalTheme, false);
    toggleSettingsModal(false);
  });
});

settingsModal.addEventListener('click', e => {
  if (e.target === settingsModal) {
    applyTheme(settingsOriginalTheme, false);
    toggleSettingsModal(false);
  }
});

// ── THEME SWITCHER & ONBOARDING ─────────────────────────────────
const themeSelect = document.getElementById('theme-select');
const modeToggleGroup = document.getElementById('set-mode-toggle');
const ONBOARD_KEY = 'pm_seen_onboarding';

function applyTheme(t, save = true) {
  // 'system' uses OS preference (no data-theme attribute)
  if (!t || t === 'default' || t === 'system') { 
    document.body.removeAttribute('data-theme'); 
    if (save) storage.setItem('pm_theme', 'system'); 
  } else { 
    document.body.setAttribute('data-theme', t); 
    if (save) storage.setItem('pm_theme', t); 
  }
  if (themeSelect && (t === 'system' || t === 'light' || t === 'dark' || t === 'warm' || t === 'minimal')) themeSelect.value = t;
  syncModeToggleUI(t);

  // Dynamically re-render diagrams if the page currently displays them
  const currentTab = document.querySelector('.rtab.active')?.dataset.tab;
  if (currentTab === 'diagrams') {
    forceRenderMermaidDiagrams().catch(e => console.error('Mermaid re-render failed', e));
  }
}

// Reflect the current saved theme onto the Settings modal's mode toggle buttons
function syncModeToggleUI(t) {
  if (!modeToggleGroup) return;
  const current = t || storage.getItem('pm_theme') || 'system';
  modeToggleGroup.querySelectorAll('.mode-toggle-btn').forEach(btn => {
    const isActive = btn.dataset.mode === current;
    btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
  });
}

// initialize theme from storage
try {
  const savedTheme = storage.getItem('pm_theme') || 'system';
  if (themeSelect) { themeSelect.value = savedTheme; }
  if (savedTheme && savedTheme !== 'system') applyTheme(savedTheme, true);
  else applyTheme('system', true);
} catch(e) {}

if (themeSelect) themeSelect.addEventListener('change', (e) => applyTheme(e.target.value));

if (modeToggleGroup) {
  modeToggleGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('.mode-toggle-btn');
    if (!btn) return;
    settingsTempTheme = btn.dataset.mode;
    applyTheme(settingsTempTheme, false); // temporary preview
  });
}

// Listen for system theme changes dynamically to handle OS dark/light mode switches
try {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const current = storage.getItem('pm_theme') || 'system';
    if (current === 'system') {
      applyTheme('system', false);
    }
  });
} catch (e) {}

// Onboarding modal logic
const onboardModal = document.getElementById('onboarding-modal');
const onboardClose = document.getElementById('onboard-close');
const onboardSkip = document.getElementById('onboard-skip');
const onboardDone = document.getElementById('onboard-done');
const onboardTrigger = document.getElementById('open-onboarding-btn');

function showOnboarding(show) {
  if (!onboardModal) return;
  onboardModal.classList.toggle('hidden', !show);
}

if (onboardTrigger) onboardTrigger.addEventListener('click', () => { showOnboarding(true); });
if (onboardClose) onboardClose.addEventListener('click', () => { showOnboarding(false); storage.setItem(ONBOARD_KEY, '1'); });
if (onboardSkip) onboardSkip.addEventListener('click', () => { showOnboarding(false); storage.setItem(ONBOARD_KEY, '1'); });
if (onboardDone) onboardDone.addEventListener('click', () => {
  showOnboarding(false);
  storage.setItem(ONBOARD_KEY, '1');
  // open wizard and focus first field
  startWizard();
  setTimeout(() => { document.getElementById('w-title')?.focus(); }, 300);
  // start the guided walkthrough shortly after opening the wizard
  setTimeout(() => { try { window.startUIWalkthrough(); } catch(e) {} }, 700);
});

// Auto-show onboarding if first time (unless ?autorun=1 used)
try {
  const params = new URLSearchParams(window.location.search);
  if (!params.get('autorun') && params.get('onboard') === '1') showOnboarding(true);
  else if (!storage.getItem(ONBOARD_KEY) && !params.get('autorun')) setTimeout(() => showOnboarding(true), 900);
} catch(e) {}

// ── WALKTHROUGH (step-by-step highlight) ───────────────────────
let walkthroughSteps = [];
let walkIndex = -1;
const walkOverlay = document.createElement('div'); walkOverlay.className = 'walk-overlay hidden'; document.body.appendChild(walkOverlay);
const walkHighlight = document.createElement('div'); walkHighlight.className = 'walk-highlight hidden'; walkOverlay.appendChild(walkHighlight);
const walkTooltip = document.createElement('div'); walkTooltip.className = 'walk-tooltip hidden'; walkOverlay.appendChild(walkTooltip);

function startWalkthrough(steps) {
  if (!Array.isArray(steps) || !steps.length) return;
  walkthroughSteps = steps; walkIndex = -1;
  walkOverlay.classList.remove('hidden');
  nextWalkStep();
}

function endWalkthrough() { walkOverlay.classList.add('hidden'); walkHighlight.classList.add('hidden'); walkTooltip.classList.add('hidden'); walkIndex = -1; }

function nextWalkStep() { setWalkStep(walkIndex + 1); }
function prevWalkStep() { setWalkStep(walkIndex - 1); }

function setWalkStep(i) {
  if (i < 0) i = 0;
  if (i >= walkthroughSteps.length) { endWalkthrough(); return; }
  walkIndex = i;
  const step = walkthroughSteps[walkIndex];
  const el = document.querySelector(step.selector);
  if (!el) { walkTooltip.textContent = step.content || ''; walkTooltip.style.left = '12px'; walkTooltip.style.top = '12px'; walkTooltip.classList.remove('hidden'); walkHighlight.classList.add('hidden'); return; }
  const r = el.getBoundingClientRect();
  // position highlight
  walkHighlight.style.width = (r.width + 16) + 'px';
  walkHighlight.style.height = (r.height + 16) + 'px';
  walkHighlight.style.left = (r.left - 8 + window.scrollX) + 'px';
  walkHighlight.style.top = (r.top - 8 + window.scrollY) + 'px';
  walkHighlight.classList.remove('hidden');
  // position tooltip intelligently
  const top = r.bottom + 12 + window.scrollY;
  let left = r.left + window.scrollX;
  if (left + 440 > window.innerWidth) left = window.innerWidth - 440 - 24;
  walkTooltip.innerHTML = `<div style="font-weight:700;margin-bottom:6px">${step.title||''}</div><div style="color:${getComputedStyle(document.body).getPropertyValue('--text2')}">${step.content||''}</div><div class="walk-controls"><button class="btn btn-outline" id="walk-prev">← Back</button><button class="btn btn-primary" id="walk-next">Next →</button><button class="btn btn-outline" id="walk-skip">Skip</button></div>`;
  walkTooltip.style.left = left + 'px'; walkTooltip.style.top = top + 'px'; walkTooltip.classList.remove('hidden');
  // bind controls
  document.getElementById('walk-next')?.addEventListener('click', nextWalkStep);
  document.getElementById('walk-prev')?.addEventListener('click', prevWalkStep);
  document.getElementById('walk-skip')?.addEventListener('click', endWalkthrough);
  // ensure visible
  window.scrollTo({ top: Math.max(0, r.top - 120), behavior: 'smooth' });
}

// small default walkthrough sequence
const defaultWalk = [
  { selector: '.hero-title', title: 'Hero Title', content: 'Start by clearly stating your project idea here.' },
  { selector: '#hero-start-btn', title: 'Start Button', content: 'Click to begin the guided project wizard.' },
  { selector: '#w-title', title: 'Project Title', content: 'Write a concise, descriptive title (max 120 chars).' },
  { selector: '#w-abstract', title: 'Project Abstract', content: 'Provide details: goals, users, features, and constraints.' },
  { selector: '#s2-next', title: 'Analyze with AI', content: 'When ready, click to run the AI analysis and generate your report.' }
];

// Expose a global trigger to start walkthrough (e.g., from onboarding 'Start Guided Run')
window.startUIWalkthrough = function() { startWalkthrough(defaultWalk); };

// ── MICRO-INTERACTION: ripple effect for buttons ─────────────────
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn');
  if (!btn) return;
  const rect = btn.getBoundingClientRect();
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  const size = Math.max(rect.width, rect.height) * 1.2;
  ripple.style.width = ripple.style.height = size + 'px';
  ripple.style.left = (e.clientX - rect.left - size/2) + 'px';
  ripple.style.top = (e.clientY - rect.top - size/2) + 'px';
  btn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 700);
});

// Save Settings
document.getElementById('settings-save').addEventListener('click', () => {
  const key = openaiKeyInput.value.trim();
  storage.setItem('pm_openai_key', key);
  OPENAI_KEY = key;
  
  // Permanently save and apply the selected temp theme
  applyTheme(settingsTempTheme, true);
  
  toggleSettingsModal(false);
  showToast('⚙️ Settings saved successfully!', 'success');
});

// ── DYNAMIC PERSONALIZATION INTERACTIVE PREVIEW ──────────────────
(function initPersonalizationSpotlight() {
  const tabList     = document.getElementById('project-tabs-list');
  const previewBody = document.getElementById('preview-body');
  const previewName = document.getElementById('preview-project-name');
  if (!tabList || !previewBody) return;

  const SAMPLE_PROJECTS = {
    hospital: {
      key: 'hospital',
      icon: '🏥',
      name: 'AI Hospital Management System',
      outputs: [
        {
          icon: '⚙️', label: 'Tech Stack', badge: 'AI', badgeType: 'ai',
          value: 'Node.js · Express · MongoDB (HIPAA) · React · HL7 FHIR',
          tags: ['REST APIs', 'JWT Auth', 'Docker', 'Redis Cache']
        },
        {
          icon: '📋', label: 'Modules & Objectives', badge: '✓', badgeType: 'done',
          value: 'Patient Registration, OPD Queue, EHR Records, Billing & Insurance, Pharmacy, Lab Reports',
          tags: []
        },
        {
          icon: '🗄️', label: 'Database Design', badge: 'AI', badgeType: 'ai',
          value: 'Collections: Patient, Doctor, Appointment, Prescription, Invoice, Ward',
          tags: ['Indexed on PatientID', 'HIPAA Encrypted', 'Audit Logs']
        },
        {
          icon: '📐', label: 'UML Diagrams', badge: '✓', badgeType: 'done',
          value: 'Class: Doctor↔Patient↔Appointment · ER: 6 entities · Sequence: Triage Flow',
          tags: ['Use Case', 'Sequence', 'ER', 'Activity']
        },
        {
          icon: '🔌', label: 'API Endpoints', badge: 'AI', badgeType: 'ai',
          value: 'POST /patients/admit · GET /appointments/today · PUT /prescriptions/:id · GET /reports/lab',
          tags: []
        },
        {
          icon: '✨', label: 'AI Feature Suggestion', badge: 'AI', badgeType: 'ai',
          value: 'Predictive triage scoring model using vital signs ML pipeline',
          tags: ['TensorFlow', 'NLP for Symptoms', 'Real-time Alerts']
        }
      ]
    },
    parking: {
      key: 'parking',
      icon: '🚗',
      name: 'Smart Parking System',
      outputs: [
        {
          icon: '⚙️', label: 'Tech Stack', badge: 'AI', badgeType: 'ai',
          value: 'Python · Flask · OpenCV · PostgreSQL · React Native · MQTT',
          tags: ['ANPR Camera', 'IoT Sensors', 'YOLO v8', 'Raspberry Pi']
        },
        {
          icon: '📋', label: 'Modules & Objectives', badge: '✓', badgeType: 'done',
          value: 'Slot Detection, License Plate Recognition, Online Booking, Payment, Occupancy Dashboard',
          tags: []
        },
        {
          icon: '🗄️', label: 'Database Design', badge: 'AI', badgeType: 'ai',
          value: 'Tables: Slot, Vehicle, Booking, Payment, Camera, SensorLog',
          tags: ['Real-time Updates', 'Geospatial Index', 'Time-series data']
        },
        {
          icon: '📐', label: 'UML Diagrams', badge: '✓', badgeType: 'done',
          value: 'ER: Slot↔Booking↔Vehicle · Sequence: Entry → Detect → Allocate → Pay → Exit',
          tags: ['Flowchart', 'DFD', 'Use Case', 'ER']
        },
        {
          icon: '🔌', label: 'API Endpoints', badge: 'AI', badgeType: 'ai',
          value: 'GET /slots/available · POST /bookings/reserve · POST /payments/initiate · GET /camera/stream',
          tags: []
        },
        {
          icon: '✨', label: 'AI Feature Suggestion', badge: 'AI', badgeType: 'ai',
          value: 'Dynamic surge pricing model based on real-time occupancy predictions',
          tags: ['scikit-learn', 'Demand Forecast', 'Stripe Integration']
        }
      ]
    },
    ecommerce: {
      key: 'ecommerce',
      icon: '🛒',
      name: 'AI E-Commerce Platform',
      outputs: [
        {
          icon: '⚙️', label: 'Tech Stack', badge: 'AI', badgeType: 'ai',
          value: 'Next.js · FastAPI · PostgreSQL · Redis · Stripe · Elasticsearch',
          tags: ['CDN Assets', 'OAuth 2.0', 'Microservices', 'PWA']
        },
        {
          icon: '📋', label: 'Modules & Objectives', badge: '✓', badgeType: 'done',
          value: 'Product Catalog, AI Recommendations, Cart & Checkout, Order Tracking, Seller Dashboard, Reviews',
          tags: []
        },
        {
          icon: '🗄️', label: 'Database Design', badge: 'AI', badgeType: 'ai',
          value: 'Tables: User, Product, Order, Cart, Review, Category, Recommendation',
          tags: ['Full-text Search', 'Partitioned Orders', 'JSONB Attributes']
        },
        {
          icon: '📐', label: 'UML Diagrams', badge: '✓', badgeType: 'done',
          value: 'ER: 7 entities · Sequence: Browse → Add Cart → Checkout → Ship → Deliver',
          tags: ['Component Diagram', 'State Chart', 'ER', 'Activity']
        },
        {
          icon: '🔌', label: 'API Endpoints', badge: 'AI', badgeType: 'ai',
          value: 'GET /products/search · POST /cart/add · POST /orders/place · GET /recommendations/:userId',
          tags: []
        },
        {
          icon: '✨', label: 'AI Feature Suggestion', badge: 'AI', badgeType: 'ai',
          value: 'Collaborative filtering engine with real-time personalized product recommendations',
          tags: ['PyTorch', 'A/B Testing', 'Clickstream Analysis']
        }
      ]
    },
    farm: {
      key: 'farm',
      icon: '🌾',
      name: 'Smart Farming System',
      outputs: [
        {
          icon: '⚙️', label: 'Tech Stack', badge: 'AI', badgeType: 'ai',
          value: 'Python · Django · InfluxDB · MQTT · TensorFlow Lite · React',
          tags: ['Raspberry Pi', 'DHT22 Sensors', 'LoRaWAN', 'Edge AI']
        },
        {
          icon: '📋', label: 'Modules & Objectives', badge: '✓', badgeType: 'done',
          value: 'Soil Monitoring, Automated Irrigation, Crop Disease Detection, Yield Prediction, Alerts',
          tags: []
        },
        {
          icon: '🗄️', label: 'Database Design', badge: 'AI', badgeType: 'ai',
          value: 'Tables: Field, SensorReading, CropCycle, IrrigationSchedule, DiseaseReport, Forecast',
          tags: ['Time-series DB', 'Geospatial Fields', 'Sensor Partitions']
        },
        {
          icon: '📐', label: 'UML Diagrams', badge: '✓', badgeType: 'done',
          value: 'ER: Field↔Sensor↔Reading · Sequence: Detect Moisture → Trigger Irrigation → Log',
          tags: ['DFD', 'State Diagram', 'ER', 'Activity']
        },
        {
          icon: '🔌', label: 'API Endpoints', badge: 'AI', badgeType: 'ai',
          value: 'GET /sensors/soil · POST /irrigation/trigger · GET /disease/detect · GET /yield/predict',
          tags: []
        },
        {
          icon: '✨', label: 'AI Feature Suggestion', badge: 'AI', badgeType: 'ai',
          value: 'CNN-based leaf disease detection from drone imagery with treatment recommendation engine',
          tags: ['OpenCV', 'TFLite', 'Drone API', 'WhatsApp Alerts']
        }
      ]
    }
  };

  function getStoredPreviewProject() {
    try {
      const raw = storage.getItem('pm_last_project_preview');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function joinNames(items, limit = 4) {
    return (items || [])
      .map(item => typeof item === 'string' ? item : item?.name)
      .filter(Boolean)
      .slice(0, limit)
      .join(' · ');
  }

  function summarizePreviewProject(proj) {
    const data = proj?.reportData || {};
    const tech = data.techStack || {};
    const overviewModules = data.overview?.modules || [];
    const diagrams = data.diagrams || {};
    const codeStructure = data.codeStructure || {};
    const featureSuggestions = data.featureSuggestions || [];
    const firstFeature = featureSuggestions[0];

    return {
      key: `custom-${proj?.id || 'project'}`,
      icon: '✨',
      name: proj?.title ? `${proj.title}${proj.domain ? ` · ${proj.domain}` : ''}` : 'Personalized Project Blueprint',
      outputs: [
        {
          icon: '⚙️', label: 'Tech Stack', badge: 'AI', badgeType: 'ai',
          value: joinNames([...(tech.languages || []), ...(tech.frameworks || []), ...(tech.databases || [])]) || proj?.domain || 'Domain-aware stack generated from your project profile.',
          tags: [joinNames(tech.apis || []), joinNames(tech.deployment || []), joinNames(tech.testing || [])].filter(Boolean)
        },
        {
          icon: '📋', label: 'Modules & Objectives', badge: '✓', badgeType: 'done',
          value: joinNames(overviewModules, 6) || 'Objectives and modules tailored to the submitted abstract.',
          tags: []
        },
        {
          icon: '🗄️', label: 'Database Design', badge: 'AI', badgeType: 'ai',
          value: joinNames(tech.databases, 4) || codeStructure.architecturePattern || 'Database and schema design generated from the project context.',
          tags: [codeStructure.folderTree ? 'Code structure aligned' : '', diagrams.erDiagram ? 'ER model ready' : '', diagrams.systemArchitecture ? 'Architecture mapped' : ''].filter(Boolean)
        },
        {
          icon: '📐', label: 'UML Diagrams', badge: '✓', badgeType: 'done',
          value: [diagrams.useCase ? 'Use Case' : '', diagrams.classDiagram ? 'Class' : '', diagrams.sequenceDiagram ? 'Sequence' : '', diagrams.erDiagram ? 'ER' : '', diagrams.systemArchitecture ? 'System Architecture' : ''].filter(Boolean).join(' · ') || 'Context-specific UML and workflow diagrams generated for the project.',
          tags: [diagrams.useCase ? 'Use Case' : '', diagrams.sequenceDiagram ? 'Sequence' : '', diagrams.erDiagram ? 'ER' : '', diagrams.systemArchitecture ? 'System Architecture' : ''].filter(Boolean)
        },
        {
          icon: '💻', label: 'Code Structure', badge: 'AI', badgeType: 'ai',
          value: codeStructure.folderTree || 'Source layout adapted to the project requirements and scope.',
          tags: []
        },
        {
          icon: '✨', label: 'AI Feature Suggestion', badge: 'AI', badgeType: 'ai',
          value: firstFeature?.description || 'New AI feature ideas inferred from the project domain and abstract.',
          tags: [firstFeature?.type, firstFeature?.impact ? `Impact: ${firstFeature.impact}` : '', firstFeature?.effort ? `Effort: ${firstFeature.effort}` : ''].filter(Boolean)
        }
      ]
    };
  }

  function getPreviewProjects() {
    const projectsSource = [];
    const stored = getStoredPreviewProject();
    const latestUserProject = projects.length ? projects[projects.length - 1] : null;
    const customProject = stored || latestUserProject;

    if (customProject) projectsSource.push(summarizePreviewProject(customProject));

    for (const project of Object.values(SAMPLE_PROJECTS)) {
      if (projectsSource.length >= 4) break;
      projectsSource.push(project);
    }

    return projectsSource;
  }

  function renderProject(project) {
    if (!project) return;

    previewName.textContent = `${project.icon} ${project.name}`;

    previewBody.innerHTML = project.outputs.map((out, i) => `
      <div class="preview-output-card" style="animation-delay:${i * 0.05}s">
        <div class="poc-label">
          ${out.icon} ${out.label}
          <span class="poc-badge poc-badge--${out.badgeType}">${out.badge === 'AI' ? '🤖 AI' : out.badge + ' Done'}</span>
        </div>
        <div class="poc-value">${out.value}</div>
        ${out.tags.length ? `<div class="poc-tags">${out.tags.map(t => `<span class="poc-tag">${t}</span>`).join('')}</div>` : ''}
      </div>
    `).join('');
  }

  const previewProjects = getPreviewProjects();
  tabList.innerHTML = previewProjects.map((project, index) => `
    <button class="project-tab-btn${index === 0 ? ' active' : ''}" data-preview-key="${project.key || index}">
      <span class="ptab-icon">${project.icon}</span>
      <div class="ptab-info">
        <div class="ptab-name">${project.name}</div>
        <div class="ptab-domain">${project.key && project.key.startsWith('custom-') ? 'Personalized · AI-generated from your project input' : 'Demo · Sample blueprint'}</div>
      </div>
    </button>
  `).join('');

  const byKey = new Map(previewProjects.map((project, index) => [String(project.key || index), project]));

  // Tab click listeners
  tabList.addEventListener('click', e => {
    const btn = e.target.closest('.project-tab-btn');
    if (!btn) return;
    tabList.querySelectorAll('.project-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderProject(byKey.get(btn.dataset.previewKey));
  });

  // Auto-rotate every 5s
  const keys = previewProjects.map((project, index) => String(project.key || index));
  let autoIdx = 0;
  setInterval(() => {
    if (document.hidden) return; // Don't rotate when tab not visible
    autoIdx = (autoIdx + 1) % keys.length;
    const key = keys[autoIdx];
    tabList.querySelectorAll('.project-tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.previewKey === key);
    });
    renderProject(byKey.get(key));
  }, 5000);

  // Initial render
  renderProject(previewProjects[0]);
})();

console.log('%c🚀 ProMentor AI — No-server mode active!', 'color:#a855f7;font-size:16px;font-weight:bold');
