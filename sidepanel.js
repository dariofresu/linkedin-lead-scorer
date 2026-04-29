// ============================================================
// LinkedIn Lead Scorer — Side Panel JS
// Fresu Electronics · Avatar A & B scoring
// ============================================================

const CURRENT_VERSION = '1.2.0';
const GITHUB_REPO     = 'dariofresu/linkedin-lead-scorer';

const SCORING_PROMPT = `You score LinkedIn profiles as leads for Dario Fresu, Principal EMC Architect at Fresu Electronics.
Offers: EMC Design Audit €8,000 | EMC Architect System €30,000/month

AVATAR B — PRIMARY BUYER:
Titles: Head of Development, Engineering Director, VP Engineering, CTO, R&D Manager, Head of Hardware, Technical Director, Group VP, VP Product, Director of Engineering
Company: Hardware/electronics manufacturer, 15–200 employees
Pain: EMC failures cost €40–80K per respin, delayed launches, board accountability
Budget: can approve €8K–€30K+

AVATAR A — SECONDARY (maker):
Individual hardware engineer, PCB designer, embedded systems engineer, electronics designer.
Budget ceiling ~€2K. Buys courses, not audits. Good for referrals only.

SKIP: recruiters, HR, marketing professionals, pure software engineers, students/interns, EMC competitors, vague lifestyle titles (no clear professional role).

Return ONLY valid JSON — no prose, no markdown, no backticks:
{"score":<1-10>,"category":"strong_lead|possible_lead|skip","avatar":"A|B|none","signals":["2-4 short signals"],"reasoning":"one sentence","action":"Book a call|Send audit intro|Nurture with content|Do not connect"}`;

const FREE_MODELS = [
  { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B — Recommended' },
  { id: 'google/gemini-2.0-flash-exp:free',        label: 'Gemini 2.0 Flash — Fast' },
  { id: 'deepseek/deepseek-r1:free',               label: 'DeepSeek R1 — Best reasoning' },
  { id: 'mistralai/mistral-7b-instruct:free',      label: 'Mistral 7B — Lightweight' },
  { id: 'microsoft/phi-4-reasoning:free',          label: 'Phi-4 Reasoning — Microsoft' },
];

const PROVIDERS = {
  openrouter: {
    name: 'OpenRouter', color: '#6d4aff',
    sub: 'Free models · Low daily limits · May rate-limit',
    keyUrl: 'https://openrouter.ai/keys',
    async call(key, model, p) {
      const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}`, 'HTTP-Referer': 'https://fresuelectronics.com', 'X-Title': 'LinkedIn Lead Scorer' },
        body: JSON.stringify({ model, max_tokens: 400, temperature: 0.1, messages: [{ role: 'system', content: SCORING_PROMPT }, { role: 'user', content: pmsg(p) }] })
      });
      const d = await r.json();
      console.log('OpenRouter response:', r.status, JSON.stringify(d).slice(0, 300));
      if (!r.ok || d.error) throw new Error(`OpenRouter ${r.status}: ${d.error?.message || d.error?.code || JSON.stringify(d).slice(0,200)}`);
      return parseScore(d.choices[0].message.content);
    }
  },
  groq: {
    name: 'Groq ⭐ Recommended', color: '#f55036',
    sub: 'Free · 30 req/min · Fast · console.groq.com',
    keyUrl: 'https://console.groq.com/keys',
    async call(key, model, p) {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({ model: 'llama-3.3-70b-versatile', max_tokens: 400, temperature: 0.1, messages: [{ role: 'system', content: SCORING_PROMPT }, { role: 'user', content: pmsg(p) }] })
      });
      const d = await r.json();
      console.log('Groq response:', r.status, JSON.stringify(d).slice(0, 300));
      if (!r.ok || d.error) throw new Error(`Groq ${r.status}: ${d.error?.message || JSON.stringify(d).slice(0,200)}`);
      return parseScore(d.choices[0].message.content);
    }
  },
  gemini: {
    name: 'Gemini Flash', color: '#4285f4',
    sub: 'Free · 1500 req/day · aistudio.google.com',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    async call(key, model, p) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: SCORING_PROMPT + '\n\n' + pmsg(p) }] }], generationConfig: { maxOutputTokens: 400, temperature: 0.1 } })
      });
      const d = await r.json();
      console.log('Gemini response:', r.status, JSON.stringify(d).slice(0, 300));
      if (!r.ok || d.error) throw new Error(`Gemini ${r.status}: ${d.error?.message || JSON.stringify(d).slice(0,200)}`);
      return parseScore(d.candidates[0].content.parts[0].text);
    }
  },
  anthropic: {
    name: 'Claude Haiku', color: '#d97756',
    sub: 'Included in Claude.ai plan · No key needed',
    keyUrl: null,
    async call(key, model, p) {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 400, system: SCORING_PROMPT, messages: [{ role: 'user', content: pmsg(p) }] })
      });
      const d = await r.json();
      console.log('Anthropic response:', r.status, JSON.stringify(d).slice(0, 300));
      if (!r.ok || d.error) throw new Error(`Anthropic ${r.status}: ${d.error?.error?.message || d.error?.message || JSON.stringify(d).slice(0,200)}`);
      return parseScore((d.content || []).map(b => b.text || '').join(''));
    }
  }
};

function getKey() { return (S.apiKey || '').trim(); }

function pmsg(p) {
  return `Name: ${p.name}\nTitle: ${p.title}\nCompany: ${p.company || 'Unknown'}\nLinkedIn: ${p.url}\nAbout: ${p.about || 'N/A'}`;
}

function parseScore(text) {
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

// ============================================================
// STATE
// ============================================================
let S = {
  phase: 'loading',        // loading | setup | home | analyzing | results
  showSettings: false,
  provider: 'groq',
  model: FREE_MODELS[0].id,
  apiKey: '',
  onLinkedIn: false,
  currentTabId: null,
  profiles: [],
  results: [],
  filter: 'all',
  progress: 0,
  progressText: '',
};

// ============================================================
// INIT
// ============================================================
async function init() {
  try {
    const stored = await chrome.storage.local.get(['provider', 'model', 'apiKey', 'results']);
    if (stored.provider) S.provider = stored.provider;
    if (stored.model)    S.model    = stored.model;
    if (stored.apiKey)   S.apiKey   = stored.apiKey;
    if (stored.results?.length) S.results = stored.results;
  } catch (e) {}

  await refreshTab();
  S.phase = (S.apiKey || S.provider === 'anthropic') ? 'home' : 'setup';
  render();

  // Header settings button (static element — bind once)
  document.getElementById('btn-settings-hdr')?.addEventListener('click', () => {
    S.showSettings = !S.showSettings;
    render();
  });

  // Listen for tab changes from background
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'tabUpdated') {
      const wasOnLinkedIn = S.onLinkedIn;
      S.onLinkedIn = !!(msg.url?.includes('linkedin.com/mynetwork/invitation-manager'));
      S.currentTabId = msg.tabId;
      if (!S.showSettings && (S.phase === 'home' || S.phase === 'results') && wasOnLinkedIn !== S.onLinkedIn) {
        render();
      }
    }
    if (msg.action === 'scrapeProgress') {
      S.progress    = msg.pct;
      S.progressText = msg.text;
      updateProgressUI();
    }
  });
}

async function refreshTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    S.onLinkedIn   = !!(tab?.url?.includes('linkedin.com/mynetwork/invitation-manager'));
    S.currentTabId = tab?.id;
  } catch (e) { S.onLinkedIn = false; }
}

function saveSettings() {
  chrome.storage.local.set({ provider: S.provider, model: S.model, apiKey: S.apiKey });
}

// ============================================================
// RENDER
// ============================================================
function render() {
  const el = document.getElementById('root');
  if (!el) return;
  el.innerHTML = S.showSettings ? settingsHTML() : phaseHTML();
  bindEvents();
}

function phaseHTML() {
  switch (S.phase) {
    case 'setup':     return setupHTML();
    case 'analyzing': return analyzingHTML();
    case 'results':   return resultsHTML();
    default:          return homeHTML();
  }
}

// ============================================================
// SETUP SCREEN
// ============================================================
function setupHTML() {
  const prov = PROVIDERS[S.provider];
  const needsKey = S.provider !== 'anthropic';
  return `
    <div class="section-lbl">Choose AI Provider</div>
    ${Object.entries(PROVIDERS).map(([k, v]) => `
      <div class="prov-card${S.provider === k ? ' sel' : ''}" data-prov="${k}">
        <div class="prov-dot" style="background:${v.color};"></div>
        <div style="flex:1;"><div class="prov-name">${v.name}</div><div class="prov-sub">${v.sub}</div></div>
        ${S.provider === k ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0a66c2" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
      </div>`).join('')}

    ${S.provider === 'openrouter' ? `
    <div style="margin-top:14px;">
      <label>Free model</label>
      <select id="sel-model">
        ${FREE_MODELS.map(m => `<option value="${m.id}"${S.model === m.id ? ' selected' : ''}>${m.label}</option>`).join('')}
      </select>
    </div>` : ''}

    ${needsKey ? `
    <div style="margin-top:14px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;">
        <label>API Key</label>
        ${prov.keyUrl ? `<a href="${prov.keyUrl}" target="_blank" style="font-size:11px;">Get free key ↗</a>` : ''}
      </div>
      <input type="password" id="inp-key" placeholder="Paste your key here..." value="${esc(S.apiKey)}">
      <div class="hint">Stored locally in your browser. Never transmitted anywhere else.</div>
    </div>` : `
    <div class="info-box" style="margin-top:14px;">
      <p>No key needed — Claude Haiku is included in your Claude.ai plan automatically.</p>
    </div>`}

    <div style="margin-top:18px;">
      <button class="btn-primary btn-full" id="btn-setup-save" ${needsKey && !S.apiKey ? 'disabled' : ''}>
        Save & Get Started →
      </button>
    </div>`;
}

// ============================================================
// HOME SCREEN
// ============================================================
function homeHTML() {
  const hasResults = S.results.length > 0;
  const counts = {
    total:    S.results.length,
    strong:   S.results.filter(r => r.category === 'strong_lead').length,
    possible: S.results.filter(r => r.category === 'possible_lead').length,
    skip:     S.results.filter(r => r.category === 'skip').length,
  };

  return `
    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <div class="section-lbl" style="margin:0;">LinkedIn Status</div>
        <button id="btn-refresh" style="font-size:11px;padding:3px 8px;color:#6b7280;">↻ Refresh</button>
      </div>

      ${S.onLinkedIn ? `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <div class="status-dot dot-green"></div>
          <span style="font-size:13px;font-weight:500;color:#15803d;">On LinkedIn Invitations</span>
        </div>
        <button class="btn-green btn-full" id="btn-scan">
          Scan Connection Requests
        </button>` : `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <div class="status-dot dot-red"></div>
          <span style="font-size:13px;color:#dc2626;">Not on LinkedIn Invitations</span>
        </div>
        <p style="font-size:12px;color:#6b7280;margin-bottom:10px;line-height:1.4;">Click below to open the LinkedIn invitations page, then come back here and click Scan.</p>
        <button class="btn-primary btn-full" id="btn-go-linkedin">Open LinkedIn Invitations ↗</button>`}
    </div>

    ${hasResults ? `
    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <div class="section-lbl" style="margin:0;">Last Scan Results</div>
        <button id="btn-clear" style="font-size:11px;padding:3px 8px;color:#dc2626;border-color:#fca5a5;">Clear</button>
      </div>
      <div class="stats-grid" style="margin-bottom:12px;">
        <div class="stat-card"><div class="stat-num">${counts.total}</div><div class="stat-lbl">Total</div></div>
        <div class="stat-card"><div class="stat-num" style="color:#16a34a;">${counts.strong}</div><div class="stat-lbl">Strong</div></div>
        <div class="stat-card"><div class="stat-num" style="color:#d97706;">${counts.possible}</div><div class="stat-lbl">Possible</div></div>
        <div class="stat-card"><div class="stat-num" style="color:#dc2626;">${counts.skip}</div><div class="stat-lbl">Skip</div></div>
      </div>
      <button class="btn-primary btn-full" id="btn-view-results">View Full Dashboard →</button>
    </div>` : `
    <div class="empty">
      <div class="empty-icon">📊</div>
      <p>No results yet.<br>Go to LinkedIn and scan your pending connection requests.</p>
    </div>`}

    <div style="margin-top:8px;text-align:center;">
      <span style="font-size:11px;color:#9ca3af;">Using ${PROVIDERS[S.provider].name}${S.provider === 'openrouter' ? ' · ' + (FREE_MODELS.find(m=>m.id===S.model)?.label.split('—')[0].trim()||'') : ''}</span>
    </div>`;
}

// ============================================================
// ANALYZING SCREEN
// ============================================================
function analyzingHTML() {
  return `
    <div style="text-align:center;padding:48px 20px;">
      <div style="font-size:36px;margin-bottom:16px;">🔍</div>
      <div style="font-size:15px;font-weight:600;color:#111;margin-bottom:6px;">Analyzing profiles</div>
      <div style="font-size:12px;color:#6b7280;margin-bottom:20px;" id="prog-text">${esc(S.progressText || 'Starting...')}</div>
      <div class="progress-wrap" style="margin-bottom:8px;">
        <div class="progress-fill" id="prog-bar" style="width:${S.progress}%;"></div>
      </div>
      <div style="font-size:12px;color:#9ca3af;" id="prog-pct">${S.progress}%</div>
    </div>`;
}

// ============================================================
// RESULTS SCREEN
// ============================================================
function resultsHTML() {
  const { results, filter } = S;
  const filtered = (filter === 'all' ? results : results.filter(r => r.category === filter))
    .slice().sort((a, b) => b.score - a.score);
  const counts = {
    total: results.length,
    strong: results.filter(r=>r.category==='strong_lead').length,
    possible: results.filter(r=>r.category==='possible_lead').length,
    skip: results.filter(r=>r.category==='skip').length,
  };

  const rateLimitHit = results.some(r => r.signals?.includes('⚠ Rate limit reached'));
  const notAnalyzed  = results.filter(r => r.signals?.includes('⏭ Not analyzed')).length;

  return `
    ${rateLimitHit ? `
    <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:10px 12px;margin-bottom:10px;">
      <p style="font-size:12px;color:#92400e;font-weight:600;margin-bottom:2px;">⚠ Rate limit hit — partial results</p>
      <p style="font-size:11px;color:#92400e;line-height:1.5;">${notAnalyzed} profile${notAnalyzed!==1?'s':''} not scored. Switch to <strong>Groq</strong> in Settings (30 req/min free) and scan again.</p>
    </div>` : ''}
    <div class="stats-grid" style="margin-bottom:10px;">
      <div class="stat-card"><div class="stat-num">${counts.total}</div><div class="stat-lbl">Total</div></div>
      <div class="stat-card"><div class="stat-num sc-high">${counts.strong}</div><div class="stat-lbl">Strong</div></div>
      <div class="stat-card"><div class="stat-num sc-mid">${counts.possible}</div><div class="stat-lbl">Possible</div></div>
      <div class="stat-card"><div class="stat-num sc-low">${counts.skip}</div><div class="stat-lbl">Skip</div></div>
    </div>

    <div class="tabs">
      ${[['all','All'],['strong_lead','Strong'],['possible_lead','Possible'],['skip','Skip']].map(([k,l]) =>
        `<button class="tab${filter===k?' active':''}" data-filter="${k}">${l}</button>`).join('')}
      <button id="btn-home" style="margin-left:auto;font-size:11px;padding:4px 10px;border-radius:999px;color:#6b7280;border-color:#e5e7eb;">← Home</button>
    </div>

    <div id="results-list">
      ${filtered.length === 0
        ? `<div class="empty"><p>No profiles in this category.</p></div>`
        : filtered.map(r => cardHTML(r)).join('')}
    </div>`;
}

function cardHTML(r) {
  const isStrong = r.category === 'strong_lead', isPossible = r.category === 'possible_lead';
  const cardClass = isStrong ? 'lc-strong' : isPossible ? 'lc-possible' : 'lc-skip';
  const badgeClass = isStrong ? 'b-strong' : isPossible ? 'b-possible' : 'b-skip';
  const badgeLabel = isStrong ? 'Strong Lead' : isPossible ? 'Possible Lead' : 'Skip';
  const scoreClass = r.score >= 7 ? 'sc-high' : r.score >= 4 ? 'sc-mid' : 'sc-low';
  const actionClass = r.action === 'Book a call' ? 'ab-book' : r.action === 'Send audit intro' ? 'ab-audit' : r.action === 'Nurture with content' ? 'ab-nurture' : 'ab-skip';

  return `
    <div class="lead-card ${cardClass}">
      <div style="display:flex;align-items:flex-start;gap:10px;">
        <div class="avatar">${ini(r.name)}</div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            <span class="lead-name">${esc(r.name)}</span>
            ${r.avatar !== 'none' ? `<span class="badge b-av">Av.${r.avatar}</span>` : ''}
          </div>
          <div class="lead-title">${esc(r.title)}</div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div class="score-num ${scoreClass}">${r.score}<span style="font-size:10px;font-weight:400;color:#9ca3af;">/10</span></div>
          <div><span class="badge ${badgeClass}" style="margin-top:3px;display:inline-block;">${badgeLabel}</span></div>
        </div>
      </div>

      ${r.signals?.length ? `<div class="signals">${r.signals.map(s => `<span class="signal">${esc(s)}</span>`).join('')}</div>` : ''}

      <div class="reasoning">${esc(r.reasoning)}</div>

      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;">
        ${r.url ? `<a href="${esc(r.url)}" target="_blank" style="font-size:11px;color:#9ca3af;">View profile ↗</a>` : '<span></span>'}
        <span class="action-badge ${actionClass}">${esc(r.action)}</span>
      </div>
    </div>`;
}

// ============================================================
// SETTINGS SCREEN
// ============================================================
function settingsHTML() {
  const prov = PROVIDERS[S.provider];
  const needsKey = S.provider !== 'anthropic';
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
      <div class="section-lbl" style="margin:0;">Settings</div>
      <button id="btn-settings-done" style="font-size:12px;padding:4px 12px;background:#0a66c2;color:white;border-color:#0a66c2;">Done</button>
    </div>

    <div class="section-lbl">AI Provider</div>
    ${Object.entries(PROVIDERS).map(([k, v]) => `
      <div class="prov-card${S.provider === k ? ' sel' : ''}" data-prov="${k}">
        <div class="prov-dot" style="background:${v.color};"></div>
        <div style="flex:1;"><div class="prov-name">${v.name}</div><div class="prov-sub">${v.sub}</div></div>
        ${S.provider === k ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0a66c2" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
      </div>`).join('')}

    ${S.provider === 'openrouter' ? `
    <div style="margin-top:12px;">
      <label>Free model</label>
      <select id="sel-model">
        ${FREE_MODELS.map(m => `<option value="${m.id}"${S.model === m.id ? ' selected' : ''}>${m.label}</option>`).join('')}
      </select>
    </div>` : ''}

    ${needsKey ? `
    <div style="margin-top:12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;">
        <label>API Key</label>
        ${prov.keyUrl ? `<a href="${prov.keyUrl}" target="_blank" style="font-size:11px;">Get key ↗</a>` : ''}
      </div>
      <input type="password" id="inp-key" placeholder="Paste your key..." value="${esc(S.apiKey)}">
      <div class="hint">Stored only in your local Chrome storage. Never shared.</div>
    </div>` : ''}

    <hr class="divider">

    <hr class="divider">
    <div class="section-lbl">Version & Updates</div>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;margin-bottom:10px;">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:12px;color:#6b7280;">Current version: <strong style="color:#111;">v${CURRENT_VERSION}</strong></span>
        <button id="btn-check-update" style="font-size:11px;padding:3px 10px;">Check for updates</button>
      </div>
      <div id="update-status" style="font-size:11px;color:#9ca3af;margin-top:6px;display:none;"></div>
    </div>
    <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px 12px;margin-bottom:12px;">
      <p style="font-size:11px;color:#1d4ed8;line-height:1.6;">To update: run <code style="background:#dbeafe;padding:1px 5px;border-radius:4px;">git pull</code> in the extension folder, then go to <strong>chrome://extensions</strong> and click the ↺ reload button.</p>
    </div>
    <button id="btn-clear-all" class="btn-danger btn-full" style="margin-bottom:6px;">Clear all results</button>
    <button id="btn-reset-all" class="btn-danger btn-full">Reset everything (clears key & settings)</button>`;
}

// ============================================================
// EVENT BINDING
// ============================================================
function bindEvents() {
  // Provider selection
  document.querySelectorAll('[data-prov]').forEach(el => {
    el.addEventListener('click', () => {
      S.provider = el.dataset.prov;
      if (S.provider === 'anthropic') S.apiKey = '';
      render();
    });
  });

  // Model selection
  document.getElementById('sel-model')?.addEventListener('change', e => { S.model = e.target.value; });

  // API key input — auto-save as user types
  document.getElementById('inp-key')?.addEventListener('input', e => {
    S.apiKey = e.target.value.trim();
    const btn = document.getElementById('btn-setup-save');
    if (btn) btn.disabled = S.provider !== 'anthropic' && !S.apiKey;
    // Auto-save to storage so key persists even if panel is closed
    if (S.apiKey.length > 10) chrome.storage.local.set({ apiKey: S.apiKey });
  });

  // Setup save
  document.getElementById('btn-setup-save')?.addEventListener('click', () => {
    saveSettings();
    S.phase = 'home';
    render();
  });

  // Settings done
  document.getElementById('btn-settings-done')?.addEventListener('click', () => {
    saveSettings();
    S.showSettings = false;
    render();
  });

  // Settings actions
  document.getElementById('btn-clear-all')?.addEventListener('click', () => {
    if (confirm('Clear all scan results?')) {
      S.results = [];
      chrome.storage.local.remove('results');
      S.showSettings = false;
      S.phase = 'home';
      render();
    }
  });

  document.getElementById('btn-reset-all')?.addEventListener('click', () => {
    if (confirm('Reset everything? This will clear your API key and all results.')) {
      chrome.storage.local.clear();
      S = { phase: 'setup', showSettings: false, provider: 'openrouter', model: FREE_MODELS[0].id, apiKey: '', onLinkedIn: S.onLinkedIn, currentTabId: S.currentTabId, profiles: [], results: [], filter: 'all', progress: 0, progressText: '' };
      render();
    }
  });

  document.getElementById('btn-check-update')?.addEventListener('click', checkForUpdates);

  // Home actions
  document.getElementById('btn-refresh')?.addEventListener('click', async () => {
    await refreshTab();
    render();
  });

  document.getElementById('btn-go-linkedin')?.addEventListener('click', async () => {
    const url = 'https://www.linkedin.com/mynetwork/invitation-manager/received/';
    if (S.currentTabId) {
      await chrome.tabs.update(S.currentTabId, { url });
    } else {
      chrome.tabs.create({ url });
    }
  });

  document.getElementById('btn-scan')?.addEventListener('click', startScan);

  document.getElementById('btn-view-results')?.addEventListener('click', () => {
    S.phase = 'results';
    S.filter = 'all';
    render();
  });

  document.getElementById('btn-clear')?.addEventListener('click', () => {
    S.results = [];
    chrome.storage.local.remove('results');
    render();
  });

  // Results filters
  document.querySelectorAll('.tab[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => { S.filter = btn.dataset.filter; render(); });
  });

  document.getElementById('btn-home')?.addEventListener('click', () => {
    S.phase = 'home';
    render();
  });
}

// ============================================================
// SCAN LOGIC
// ============================================================
async function startScan() {
  // Validate API key before doing anything
  if (S.provider !== 'anthropic' && !getKey()) {
    alert('No API key set. Open Settings (gear icon) and paste your ' + PROVIDERS[S.provider].name + ' key.');
    return;
  }
  if (S.provider !== 'anthropic' && getKey().length < 20) {
    alert('API key looks too short — please double-check it in Settings.');
    return;
  }

  if (!S.currentTabId) {
    await refreshTab();
    if (!S.currentTabId) { alert('Could not detect the LinkedIn tab. Try refreshing.'); return; }
  }

  S.phase = 'analyzing';
  S.progress = 0;
  S.progressText = 'Connecting to LinkedIn...';
  render();

  try {
    // Try to ping the content script; inject if not loaded
    const isLoaded = await pingContentScript();
    if (!isLoaded) {
      S.progressText = 'Injecting scraper...';
      updateProgressUI();
      await chrome.scripting.executeScript({ target: { tabId: S.currentTabId }, files: ['content.js'] });
      await sleep(400);
    }

    S.progressText = 'Scrolling to load all requests...';
    updateProgressUI();

    // Scrape LinkedIn
    const profiles = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout — took too long. Try again.')), 90000);
      chrome.tabs.sendMessage(S.currentTabId, { action: 'scrape' }, (response) => {
        clearTimeout(timeout);
        if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
        if (!response) { reject(new Error('No response from page. Try refreshing LinkedIn and scanning again.')); return; }
        if (response.error) { reject(new Error(response.error)); return; }
        resolve(Array.isArray(response) ? response : []);
      });
    });

    if (!profiles.length) {
      S.phase = 'home';
      alert('No connection requests found. Make sure you have pending invitations visible on the page.');
      render();
      return;
    }

    // Analyze each profile with AI
    const results = [];
    const callFn = PROVIDERS[S.provider].call.bind(PROVIDERS[S.provider]);
    const delayMs = S.provider === 'groq' ? 400 : 800;

    for (let i = 0; i < profiles.length; i++) {
      const p = profiles[i];
      S.progress     = Math.round(((i + 0.5) / profiles.length) * 100);
      S.progressText = `Analyzing ${p.name}... (${i + 1}/${profiles.length})`;
      updateProgressUI();

      if (i > 0) await sleep(delayMs);

      try {
        const scored = await callFn(getKey(), S.model, p);
        results.push({ ...p, ...scored });
      } catch (e) {
        const errMsg = String(e.message || e);
        console.error('Scoring error for', p.name, ':', e);

        // Auth error — stop and alert
        if (/401|403|invalid|unauthorized|key|auth/i.test(errMsg)) {
          S.results = results;
          S.phase = 'results'; S.filter = 'all';
          chrome.storage.local.set({ results });
          render();
          alert('API key error: ' + errMsg + '\n\nOpen Settings and check your key.');
          return;
        }

        // Rate limit — stop immediately, show what we have
        if (/429|rate.?limit|too many/i.test(errMsg)) {
          const scored_count = results.length;
          const remaining = profiles.length - i;
          results.push({ ...p, score: 0, category: 'skip', avatar: 'none',
            signals: ['⚠ Rate limit reached'],
            reasoning: `Rate limit hit. ${scored_count} of ${profiles.length} profiles scored. Switch to Groq for higher limits.`,
            action: 'Do not connect' });
          // Mark remaining profiles as skipped
          for (let j = i + 1; j < profiles.length; j++) {
            results.push({ ...profiles[j], score: 0, category: 'skip', avatar: 'none',
              signals: ['⏭ Not analyzed'],
              reasoning: 'Skipped — rate limit was hit before this profile.',
              action: 'Do not connect' });
          }
          S.results = results;
          S.phase = 'results'; S.filter = 'all';
          chrome.storage.local.set({ results });
          render();
          return;
        }

        // Other error — mark and continue
        results.push({ ...p, score: 0, category: 'skip', avatar: 'none',
          signals: ['⚠ Error'], reasoning: errMsg.slice(0, 120), action: 'Do not connect' });
      }
    }

    S.results = results;
    S.progress = 100;
    chrome.storage.local.set({ results });
    S.phase = 'results';
    S.filter = 'all';
    render();

  } catch (e) {
    S.phase = 'home';
    render();
    alert('Scan error: ' + e.message);
  }
}

async function pingContentScript() {
  return new Promise(resolve => {
    try {
      chrome.tabs.sendMessage(S.currentTabId, { action: 'ping' }, (resp) => {
        resolve(!chrome.runtime.lastError && resp?.ok === true);
      });
    } catch (e) { resolve(false); }
    setTimeout(() => resolve(false), 800);
  });
}

// ============================================================
// HELPERS
// ============================================================
function updateProgressUI() {
  const bar  = document.getElementById('prog-bar');
  const text = document.getElementById('prog-text');
  const pct  = document.getElementById('prog-pct');
  if (bar)  bar.style.width  = S.progress + '%';
  if (text) text.textContent = S.progressText;
  if (pct)  pct.textContent  = S.progress + '%';
}

function ini(n) { return (n || '?').split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase(); }
function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ============================================================
// UPDATE CHECKER
// ============================================================
async function checkForUpdates() {
  const btn    = document.getElementById('btn-check-update');
  const status = document.getElementById('update-status');
  if (!status) return;

  status.style.display = 'block';
  status.style.color   = '#9ca3af';
  status.textContent   = 'Checking GitHub...';
  if (btn) btn.disabled = true;

  try {
    // Get latest commit on main branch
    const r = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/commits/main`,
      { headers: { 'Accept': 'application/vnd.github.v3+json' } }
    );

    if (!r.ok) throw new Error(`GitHub API ${r.status}`);

    const data  = await r.json();
    const latestSha  = data.sha?.slice(0, 7);
    const latestDate = data.commit?.committer?.date
      ? new Date(data.commit.committer.date).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })
      : '';
    const latestMsg  = data.commit?.message?.split('\n')[0] || '';

    // Get stored SHA (set when extension was last updated)
    const stored = await chrome.storage.local.get(['installedSha']);
    const installedSha = stored.installedSha;

    if (!installedSha) {
      // First check — store current SHA as baseline
      await chrome.storage.local.set({ installedSha: data.sha });
      status.style.color  = '#15803d';
      status.textContent  = `✓ Baseline set (${latestSha} · ${latestDate}). You'll see updates from now on.`;
    } else if (data.sha === installedSha) {
      status.style.color  = '#15803d';
      status.textContent  = `✓ Up to date — ${latestSha} · ${latestDate}`;
    } else {
      const installedShort = installedSha.slice(0, 7);
      status.style.color  = '#d97706';
      status.innerHTML    =
        `⬆ Update available: <strong>${latestMsg}</strong> (${latestDate})<br>` +
        `Run <code style="background:#fef3c7;padding:1px 5px;border-radius:3px;font-size:10px;">git pull</code> ` +
        `in the extension folder, then reload the extension in chrome://extensions`;
    }

  } catch (e) {
    status.style.color  = '#dc2626';
    status.textContent  = 'Could not reach GitHub: ' + String(e.message).slice(0, 80);
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ============================================================
// START
// ============================================================
init();
