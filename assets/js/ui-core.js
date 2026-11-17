// ── SVG ICONS ──────────────────────────────────────────────────────────────
const ICONS = {
  dashboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>`,
  write:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
  discover:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`,
  publish:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="12" y1="14" x2="16" y2="14"/></svg>`,
  coach:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
  feedback:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>`,
  trends:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
  position:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></svg>`,
  offers:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg>`,
  engine:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>`,
  x:         `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  copy:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`,
  check:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
  send:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
  sparkles:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/></svg>`,
  search:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  loader:    `<svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0"/></svg>`,
  arrow:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`,
  link:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
  globe:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>`,
  zap:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  user:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  bot:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>`,
  ok:        `<svg viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
  fail:      `<svg viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  file:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
  key:       `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>`,
  save:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`,
  draft:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  trash:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>`,
  library:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="13" y2="11"/></svg>`,
  chevronRight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`
};

function icon(name, size=16) {
  const s = ICONS[name] || '';
  return s.replace('<svg ', `<svg width="${size}" height="${size}" `);
}

// Distinct, honest "this failed" state — separate on purpose from a normal
// empty state (nothing to show yet). Uses a warning icon + red-tinted text
// so a permission/network failure never looks identical to "no data yet".
function errorState(message) {
  return `<div class="state-error">
    <span class="state-error-icon">⚠️</span>
    <span>${message}</span>
  </div>`;
}

// ── HELPERS ────────────────────────────────────────────────────────────────
function setLoading(btn, yes, text='') {
  if (yes) { btn._orig = btn.innerHTML; btn.innerHTML = `${icon('loader',14)} ${text||'Processing…'}`; btn.disabled = true; }
  else { btn.innerHTML = btn._orig || btn.innerHTML; btn.disabled = false; }
}

async function copyText(text, btn) {
  await navigator.clipboard.writeText(text);
  if (typeof haptic === 'function') haptic();
  const orig = btn.innerHTML;
  btn.innerHTML = `${icon('check',14)} Copied`;
  showToast('Copied to clipboard');
  setTimeout(() => btn.innerHTML = orig, 2000);
}

// NOTE: navigation, sheets (Studio / Ask), theme + haptics now live in main.js.

// ── SAVE-TO-TRACKER MODAL ──────────────────────────────────────────────────
function showSaveModal(text) {
  const existing = document.getElementById('save-modal-backdrop');
  if (existing) existing.remove();

  const backdrop = document.createElement('div');
  backdrop.id = 'save-modal-backdrop';
  backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:500;display:flex;align-items:center;justify-content:center;padding:1rem';

  backdrop.innerHTML = `
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:var(--radius-xl);padding:1.5rem;width:100%;max-width:480px;box-shadow:var(--shadow-lg)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem">
        <h3 style="font-size:1rem;margin:0">Save to Post Tracker</h3>
        <button id="save-modal-close" class="btn btn-ghost btn-icon btn-sm">${icon('x',14)}</button>
      </div>
      <div class="space-y-4">
        <div class="grid-2">
          <div>
            <label>Platform</label>
            <select class="select-el mt-1" id="sm-platform">${PLATFORMS.map(p=>`<option>${p}</option>`).join('')}</select>
          </div>
          <div>
            <label>Post Type</label>
            <select class="select-el mt-1" id="sm-type">${POST_TYPES.filter(t=>t!=='Off').map(t=>`<option>${t}</option>`).join('')}</select>
          </div>
        </div>
        <div>
          <label>Content Pillar</label>
          <select class="select-el mt-1" id="sm-pillar">${CONTENT_PILLARS.map(p=>`<option>${p}</option>`).join('')}</select>
        </div>
        <div>
          <label>Status</label>
          <div class="flex gap-2 mt-1">
            <button class="chip selected" data-status="draft">💾 Draft</button>
            <button class="chip" data-status="posted">✅ Already Posted</button>
          </div>
        </div>
        <div>
          <label>Notes (optional)</label>
          <input class="input mt-1" id="sm-notes" placeholder="Any context about this post…">
        </div>
        <div class="flex gap-2">
          <button id="sm-save-btn" class="btn btn-primary flex-1">${icon('save',14)} Save to Tracker</button>
          <button id="sm-cancel-btn" class="btn btn-outline">Cancel</button>
        </div>
      </div>
    </div>`;

  document.body.appendChild(backdrop);

  let selectedStatus = 'draft';
  backdrop.querySelectorAll('[data-status]').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedStatus = btn.dataset.status;
      backdrop.querySelectorAll('[data-status]').forEach(b => b.classList.toggle('selected', b === btn));
    });
  });

  backdrop.querySelector('#save-modal-close').addEventListener('click', () => backdrop.remove());
  backdrop.querySelector('#sm-cancel-btn').addEventListener('click', () => backdrop.remove());
  backdrop.addEventListener('click', e => { if (e.target === backdrop) backdrop.remove(); });

  backdrop.querySelector('#sm-save-btn').addEventListener('click', () => {
    const post = {
      id:       Date.now().toString(),
      date:     new Date().toISOString().split('T')[0],
      platform: backdrop.querySelector('#sm-platform').value,
      type:     backdrop.querySelector('#sm-type').value,
      pillar:   backdrop.querySelector('#sm-pillar').value,
      content:  text,
      status:   selectedStatus,
      notes:    backdrop.querySelector('#sm-notes').value,
      likes:    '',
      comments: ''
    };
    STATE.publish.posts.unshift(post);
    saveState();
    if (typeof haptic === 'function') haptic(12);
    backdrop.remove();
    showToast(selectedStatus === 'draft' ? '💾 Saved as draft — find it in Publish → Tracker' : '✅ Post logged in Tracker');
  });
}

// ── RESULT BOX (with Save to Tracker + Copy) ──────────────────────────────
function resultBox(text, title='Result') {
  const d = document.createElement('div');
  d.className = 'result-box';
  d.innerHTML = `
    <div class="result-box-header">
      <span class="result-box-title">${title}</span>
      <div class="flex gap-2">
        <button class="btn btn-ghost btn-sm save-tracker-btn">${icon('save',13)} Save to Tracker</button>
        <button class="btn btn-ghost btn-sm copy-btn">${icon('copy',13)} Copy</button>
      </div>
    </div>
    <div class="result-box-body"></div>`;
  d.querySelector('.result-box-body').textContent = text;
  d.querySelector('.copy-btn').addEventListener('click', function() { copyText(text, this); });
  d.querySelector('.save-tracker-btn').addEventListener('click', () => showSaveModal(text));
  return d;
}
