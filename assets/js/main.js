// ── NAVIGATION ─────────────────────────────────────────────────────────────
const PAGES = ['dashboard','content','discover','publish','feedback','coaching','positioning','offers','voice-library','profile','subscription','admin'];

// Primary tabs that can be swiped between, in order
const SWIPE_TABS = ['dashboard','content','publish'];

const RENDERERS = {
  dashboard:     () => renderDashboard(),
  content:       () => renderContent(),
  discover:      () => renderDiscover(),
  publish:       () => renderPublish(),
  feedback:      () => renderFeedback(),
  coaching:      () => renderCoaching(),
  positioning:   () => renderPositioning(),
  offers:        () => renderOffers(),
  'voice-library': () => renderVoiceLibrary(),
  'profile':     () => renderProfile(),
  'subscription':() => renderSubscription(),
  'admin':       () => renderAdmin()
};

// ── STUDIO (adaptive secondary tools) ──────────────────────────────────────
const STUDIO_TOOLS = [
  { id:'discover',       label:'Discover',       icon:'discover', desc:"Find ideas and see what's trending" },
  { id:'feedback',       label:'Feedback',       icon:'feedback', desc:'Turn comments and messages into ideas' },
  { id:'positioning',    label:'Positioning',    icon:'position', desc:'Find and check your one big idea' },
  { id:'offers',         label:'Offers',         icon:'offers',   desc:'Build an offer people want to buy' },
  { id:'voice-library',  label:'Voice Library',  icon:'library',  desc:'Add real posts so the AI sounds like you' },
  { id:'profile',        label:'Profile',        icon:'library', desc:'Your info and account settings' },
];
const STUDIO_IDS = STUDIO_TOOLS.map(t => t.id);
let STUDIO_ORDER = STUDIO_IDS.slice();   // computed once per session for stability

function usageScore(id) {
  const u = STATE.usage[id];
  if (!u || !u.count) return 0;
  const days = (Date.now() - (u.last || 0)) / 86400000;
  return u.count * Math.pow(0.5, days / 7);   // 1-week half-life
}
// Frozen head (user pins) → then by frequency×recency → then default order for untouched.
function computeStudioOrder() {
  const pins = STATE.pins.filter(id => STUDIO_IDS.includes(id));
  const rest = STUDIO_IDS.filter(id => !pins.includes(id));
  rest.sort((a, b) => {
    const d = usageScore(b) - usageScore(a);
    if (Math.abs(d) > 0.001) return d;
    return STUDIO_IDS.indexOf(a) - STUDIO_IDS.indexOf(b); // stable default for ties/zeros
  });
  STUDIO_ORDER = [...pins, ...rest];
}
function trackUsage(id) {
  if (!STUDIO_IDS.includes(id)) return;
  const u = STATE.usage[id] || { count:0, last:0 };
  u.count += 1; u.last = Date.now();
  STATE.usage[id] = u;
  saveState();
}
function togglePin(id) {
  const i = STATE.pins.indexOf(id);
  if (i >= 0) STATE.pins.splice(i, 1);
  else        STATE.pins.unshift(id);
  saveState();
  computeStudioOrder();   // explicit user action → reorder immediately
  renderStudio();
}

function studioTileMarkup(t) {
  const pinned = STATE.pins.includes(t.id);
  return `<button class="studio-row ${pinned?'is-pinned':''}" data-studio="${t.id}">
    <span class="studio-row-icon">${icon(t.icon, 20)}</span>
    <span class="studio-row-text">
      <span class="studio-row-title">${t.label}</span>
      <span class="studio-row-desc">${t.desc || ''}</span>
    </span>
    <span class="studio-pin" data-pin="${t.id}" title="${pinned?'Unpin':'Pin to top'}" aria-label="Pin ${t.label}">
      <svg viewBox="0 0 24 24" fill="${pinned?'currentColor':'none'}" stroke="currentColor" stroke-width="1.8"><path d="M12 17v5M9 10.76V4a1 1 0 011-1h4a1 1 0 011 1v6.76a2 2 0 00.59 1.41l1.7 1.7A1 1 0 0117.59 16H6.41a1 1 0 01-.7-1.71l1.7-1.7A2 2 0 009 10.76z"/></svg>
    </span>
    <span class="studio-row-chevron">${icon('chevronRight', 16)}</span>
  </button>`;
}
// Renders BOTH the mobile sheet grid and the desktop sidebar list, same order.
function renderStudio() {
  const ordered = STUDIO_ORDER.map(id => STUDIO_TOOLS.find(t => t.id === id)).filter(Boolean);

  const grid = document.getElementById('studio-grid');
  if (grid) {
    grid.innerHTML = ordered.map(studioTileMarkup).join('');
    grid.querySelectorAll('[data-pin]').forEach(b =>
      b.addEventListener('click', e => { e.stopPropagation(); haptic(); togglePin(b.dataset.pin); }));
    grid.querySelectorAll('[data-studio]').forEach(b =>
      b.addEventListener('click', () => { closeSheet(); navigate(b.dataset.studio); }));
  }

  const side = document.getElementById('sidebar-studio');
  if (side) {
    side.innerHTML = ordered.map(t =>
      `<button class="nav-link" data-nav="${t.id}">${icon(t.icon,16)} ${t.label}</button>`).join('');
    side.querySelectorAll('[data-nav]').forEach(el =>
      el.addEventListener('click', () => navigate(el.dataset.nav)));
  }
}

// ── PAGE NAVIGATION (history-routed) ───────────────────────────────────────
function navigate(page, opts = {}) {
  if (!PAGES.includes(page)) page = 'dashboard';
  if (OPEN_SHEET && !opts.fromPop) closeSheet();

  STATE.currentPage = page;
  trackUsage(page);

  if (page === 'content' && opts.idea) {
    STATE.content.topic     = opts.idea;
    STATE.content.activeTab = 'quick';
  }

  if (!opts.fromPop) {
    const entry = { type:'page', page };
    if (opts.replace || !history.state) history.replaceState(entry, '', `?go=${page}`);
    else                                history.pushState(entry, '', `?go=${page}`);
  }

  document.querySelectorAll('[data-nav]').forEach(el => el.classList.toggle('active', el.dataset.nav === page));

  const container = document.getElementById('page-container');
  container.innerHTML = '';
  try {
    container.appendChild((RENDERERS[page] || RENDERERS.dashboard)());
  } catch (e) {
    console.error('[Brand OS] Page render error:', e);
    container.innerHTML = `
      <div style="padding:2rem 1.25rem; text-align:left;">
        <div style="font-size:1.1rem; font-weight:bold; color:#e05252; margin-bottom:0.75rem;">
          This page hit an error
        </div>
        <div style="font-family:monospace; font-size:0.8rem; background:rgba(224,82,82,0.1); border:1px solid rgba(224,82,82,0.3); border-radius:8px; padding:1rem; white-space:pre-wrap; word-break:break-word; color:var(--text);">
${(e && e.stack) || (e && e.message) || String(e)}
        </div>
        <p style="margin-top:1rem; font-size:0.85rem; color:var(--text-muted);">
          Screenshot this and send it — this is the exact cause, no dev tools needed.
        </p>
      </div>`;
  }
  container.classList.remove('page-enter');
  void container.offsetWidth;
  container.classList.add('page-enter');

  const scroller = document.getElementById('scroll-wrap');
  if (scroller) scroller.scrollTop = 0;
  container.scrollTop = 0;
}

window.addEventListener('popstate', e => {
  if (OPEN_SHEET) { closeSheet(true); return; }
  const page = (e.state && e.state.page) ? e.state.page : 'dashboard';
  navigate(page, { fromPop:true });
});

// Reusable sign-out flow — used by both the sidebar's Sign Out button and
// the Profile page's Sign Out button, so it behaves identically everywhere.
function confirmSignOut(triggerBtn) {
  showConfirmSheet({
    icon: '🚪',
    title: 'Sign out?',
    message: "You'll need your email and password to sign back in.",
    confirmLabel: 'Yes, sign out',
    onConfirm: async () => {
      if (triggerBtn) { triggerBtn.disabled = true; triggerBtn.textContent = 'Signing out…'; }
      try {
        await SUPA.auth.signOut();
      } catch (e) {
        console.error('[Brand OS] Sign out error:', e);
      }
      location.reload(); // clears in-memory STATE too, not just the session
    }
  });
}

// ── SHEETS (studio + ask) ──────────────────────────────────────────────────
let OPEN_SHEET = null;
const SHEETS = {
  studio:  { backdrop:'studio-backdrop',  sheet:'studio-sheet'  },
  ask:     { backdrop:'ask-backdrop',     sheet:'ask-sheet'     },
  confirm: { backdrop:'confirm-backdrop', sheet:'confirm-sheet' }
};
function openSheet(name) {
  if (OPEN_SHEET) closeSheet();
  const s = SHEETS[name]; if (!s) return;
  OPEN_SHEET = name;
  document.getElementById(s.backdrop).classList.add('open');
  document.getElementById(s.sheet).classList.add('open');
  haptic();
  if (name === 'studio') renderStudio();
  if (name === 'ask') {
    const body = document.getElementById('ask-body');
    body.innerHTML = '';
    body.appendChild(renderCoaching());
  }
  // The floating chat assistant is fixed-position and would otherwise float
  // on top of full-screen sheets (e.g. the Studio grid) since it sits at a
  // higher z-index than any in-page content. Hide it while a sheet is open.
  if (typeof hideAssistantWidget === 'function') hideAssistantWidget();
}
function closeSheet() {
  if (!OPEN_SHEET) return;
  const s = SHEETS[OPEN_SHEET]; OPEN_SHEET = null;
  document.getElementById(s.backdrop).classList.remove('open');
  document.getElementById(s.sheet).classList.remove('open');
  if (typeof showAssistantWidget === 'function') showAssistantWidget();
}

// Reusable confirmation for anything destructive (sign out, delete, remove) —
// replaces plain browser confirm() popups with the app's own styled sheet.
// Usage: showConfirmSheet({ icon:'🚪', title:'Sign out?', message:'...',
//                            confirmLabel:'Yes, sign out', onConfirm: () => {...} })
function showConfirmSheet({ icon = '⚠️', title = 'Are you sure?', message = '', confirmLabel = 'Yes', onConfirm }) {
  document.getElementById('confirm-icon').textContent = icon;
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-msg').textContent = message;
  const yesBtn = document.getElementById('confirm-yes-btn');
  yesBtn.textContent = confirmLabel;
  // Clone-replace to strip any previous click listener before attaching this call's own
  const freshYes = yesBtn.cloneNode(true);
  yesBtn.parentNode.replaceChild(freshYes, yesBtn);
  freshYes.addEventListener('click', () => {
    closeSheet();
    if (typeof onConfirm === 'function') onConfirm();
  });
  openSheet('confirm');
}

// ── THEME ───────────────────────────────────────────────────────────────────
const SUN  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`;
const MOON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/></svg>`;
function applyTheme() {
  document.documentElement.setAttribute('data-theme', STATE.theme);
  const glyph = STATE.theme === 'dark' ? SUN : MOON;
  ['theme-toggle','theme-toggle-m'].forEach(id => { const b = document.getElementById(id); if (b) b.innerHTML = glyph; });
  const tc = document.querySelector('meta[name="theme-color"]');
  if (tc) tc.setAttribute('content', STATE.theme === 'dark' ? '#0a1124' : '#0f1c3f');
}
function toggleTheme() {
  STATE.theme = STATE.theme === 'dark' ? 'light' : 'dark';
  saveState(); applyTheme(); haptic();
}

// ── HAPTICS ─────────────────────────────────────────────────────────────────
function haptic(ms = 8) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }

// ── SPLASH ──────────────────────────────────────────────────────────────────
function hideSplash() {
  const splash = document.getElementById('splash');
  if (!splash) return;
  splash.classList.add('fade-out');
  setTimeout(() => splash.classList.add('hidden'), 500);
}

// ── SWIPE BETWEEN PRIMARY TABS ──────────────────────────────────────────────
function initSwipe() {
  const scroller = document.getElementById('scroll-wrap');
  if (!scroller) return;
  let x0 = null, y0 = null, lock = null;
  scroller.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) { x0 = null; return; }
    // ignore swipes that begin on horizontally-scrollable UI
    if (e.target.closest('.snap-x, .tabs-list, .chat-messages, .studio-grid, input, textarea')) { x0 = null; return; }
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; lock = null;
  }, { passive:true });
  scroller.addEventListener('touchmove', e => {
    if (x0 == null) return;
    const dx = e.touches[0].clientX - x0, dy = e.touches[0].clientY - y0;
    if (lock == null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      lock = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      // Vertical intent confirmed — surrender immediately so native scroll
      // gets uncontested compositor-thread control (no jank, full momentum)
      if (lock === 'y') { x0 = null; return; }
    }
  }, { passive:true });
  scroller.addEventListener('touchend', e => {
    if (x0 == null || lock !== 'x') { x0 = null; return; }
    const dx = e.changedTouches[0].clientX - x0;
    const i = SWIPE_TABS.indexOf(STATE.currentPage);
    if (i === -1) { x0 = null; return; }
    if (dx <= -80 && i < SWIPE_TABS.length - 1) { haptic(); navigate(SWIPE_TABS[i+1]); }
    else if (dx >= 80 && i > 0)                 { haptic(); navigate(SWIPE_TABS[i-1]); }
    x0 = null;
  }, { passive:true });
}

// ── AUTH-GATED BOOT ──────────────────────────────────────────────────────────
// Flow: check session -> no session: show auth page.
//       session but not onboarded: show onboarding.
//       session + onboarded: load profile + cloud state, apply this user's
//       brand voice/pillars, then boot the app for real.
function getUserProfile() {
  return (STATE.user && STATE.user.profile) || null;
}

async function handleAuthState(session) {
  const gate = document.getElementById('auth-gate');

  if (!session) {
    if (gate) gate.style.display = 'flex';
    renderAuthPage();
    return;
  }

  const profile = await fetchProfile(session.user.id);

  if (profile && profile.is_suspended) {
    await SUPA.auth.signOut();
    if (gate) gate.style.display = 'flex';
    renderAuthPage();
    setTimeout(() => showToast('This account has been suspended. Contact your admin.', true), 300);
    return;
  }

  if (!profile || !profile.onboarded) {
    if (gate) gate.style.display = 'flex';
    await renderOnboarding(session);
    return;
  }

  STATE.user = { session, profile };
  applyUserBrandConfig(profile);

  // Ask ai-proxy.php whether AI/News/YouTube are configured server-side
  // (booleans only — the actual key values never leave the PHP file).
  await fetchAiStatus();

  // Prefer this user's cloud state (posts/calendar/voice library) over
  // whatever's in local storage, so accounts don't bleed into each other
  // on a shared browser.
  const cloudState = await fetchUserState(session.user.id);
  if (cloudState) applyStatePayload(cloudState);
  else loadState();

  if (gate) gate.style.display = 'none';
  bootApp();
}

// Direct URL backstop: Supabase can process a recovery link's token
// before onAuthStateChange even has a listener registered, so relying on
// the PASSWORD_RECOVERY event alone can occasionally skip the "set new
// password" screen. Checking the URL directly at boot closes that gap.
function isPasswordRecoveryUrl() {
  const hash = location.hash || '';
  return hash.includes('type=recovery');
}

document.addEventListener('DOMContentLoaded', async () => {
  // Global safety net: if ANYTHING throws anywhere in the app and isn't
  // caught locally, show it as a visible banner instead of a silent
  // blank screen. Works on any device — no dev tools needed to see it.
  window.addEventListener('error', (e) => showGlobalErrorBanner(e.error || e.message));
  window.addEventListener('unhandledrejection', (e) => showGlobalErrorBanner(e.reason));

  const recoveryFlow = isPasswordRecoveryUrl();

  try {
    const { data: { session } } = await SUPA.auth.getSession();
    if (recoveryFlow && session) {
      renderSetNewPasswordPage();
    } else {
      await handleAuthState(session);
    }
  } catch (e) {
    console.error('[Brand OS] Auth boot error:', e);
    showGlobalErrorBanner(e);
    renderAuthPage();
  }

  SUPA.auth.onAuthStateChange((event, newSession) => {
    const currentUserId = STATE.user && STATE.user.session && STATE.user.session.user && STATE.user.session.user.id;
    const newUserId = newSession && newSession.user && newSession.user.id;

    if (event === 'PASSWORD_RECOVERY') {
      renderSetNewPasswordPage();
      return;
    }
    if (event === 'SIGNED_IN' && newUserId !== currentUserId && !isPasswordRecoveryUrl()) {
      handleAuthState(newSession);
    }
    if (event === 'SIGNED_OUT') location.reload();
    // TOKEN_REFRESHED and same-user SIGNED_IN re-fires (tab refocus, etc.)
    // are intentionally ignored — they're not a new login and shouldn't
    // re-route or reset in-progress onboarding.
  });
});

// ── BOOT ────────────────────────────────────────────────────────────────────
function bootApp() {
  applyTheme();
  computeStudioOrder();
  renderStudio();
  bootIntelligenceEngine();
  startIdleGuard();
  mountAssistantWidget();

  setTimeout(hideSplash, 650);

  // primary nav (tabs, FAB, sidebar primary links). Studio links inside
  // #sidebar-studio are managed by renderStudio() so they survive re-sorts.
  document.querySelectorAll('[data-nav]').forEach(el => {
    if (el.closest('#sidebar-studio')) return;
    el.addEventListener('click', e => { e.preventDefault(); haptic(); navigate(el.dataset.nav); });
  });

  // studio + ask launchers
  const wire = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
  wire('studio-btn-m',   () => openSheet('studio'));
  wire('ask-btn',        () => openSheet('ask'));
  wire('sidebar-ask-btn',() => openSheet('ask'));
  wire('studio-close',   () => closeSheet());
  wire('ask-close',      () => closeSheet());
  wire('studio-backdrop',() => closeSheet());
  wire('ask-backdrop',   () => closeSheet());
  wire('confirm-backdrop',() => closeSheet());
  wire('confirm-no-btn', () => closeSheet());
  wire('sidebar-signout-btn', () => confirmSignOut(document.getElementById('sidebar-signout-btn')));
  wire('theme-toggle',   toggleTheme);
  wire('theme-toggle-m', toggleTheme);

  document.addEventListener('keydown', e => { if (e.key === 'Escape' && OPEN_SHEET) closeSheet(); });

  initSwipe();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', e => {
      if (e.data && e.data.type === 'navigate' && e.data.page) navigate(e.data.page);
    });
  }

  let startPage = STATE.currentPage || 'dashboard';
  try {
    const go = new URLSearchParams(location.search).get('go');
    if (go && PAGES.includes(go)) startPage = go;
  } catch (e) {}
  navigate(startPage, { replace:true });
}

function showGlobalErrorBanner(err) {
  if (document.getElementById('global-error-banner')) return; // don't stack duplicates
  const banner = document.createElement('div');
  banner.id = 'global-error-banner';
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#3a1414;border-bottom:2px solid #e05252;padding:1rem;font-family:monospace;font-size:0.75rem;color:#ffb4b4;white-space:pre-wrap;word-break:break-word;max-height:40vh;overflow:auto;';
  banner.textContent = '⚠ ERROR (screenshot this): ' + ((err && err.stack) || (err && err.message) || String(err));
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕ Dismiss';
  closeBtn.style.cssText = 'display:block;margin-top:0.5rem;background:#e05252;color:#fff;border:none;padding:0.4rem 0.8rem;border-radius:6px;font-family:sans-serif;';
  closeBtn.onclick = () => banner.remove();
  banner.appendChild(closeBtn);
  document.body.prepend(banner);
}
