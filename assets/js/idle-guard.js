// ── IDLE / SESSION TIMEOUT GUARD ───────────────────────────────────────────
// If there's no interaction (touch, tap, key, scroll) for 10 minutes, show
// a warning with a 60-second countdown. If she doesn't tap "Stay signed
// in" before it runs out, sign out and return to the login screen so the
// session doesn't stay open indefinitely on a shared or lost device.

const IDLE_TIMEOUT_MS   = 10 * 60 * 1000; // 10 minutes
const IDLE_WARNING_MS   = 60 * 1000;      // show warning 60s before logout
const IDLE_CHECK_EVERY  = 15 * 1000;      // poll every 15s (cheap, no per-keystroke work)

let _idleLastActivity = Date.now();
let _idleCheckInterval = null;
let _idleWarningShown = false;
let _idleCountdownInterval = null;

function _idleMarkActive() {
  _idleLastActivity = Date.now();
  if (_idleWarningShown) _idleDismissWarning();
}

function startIdleGuard() {
  if (_idleCheckInterval) clearInterval(_idleCheckInterval);
  _idleLastActivity = Date.now();
  _idleWarningShown = false;

  ['touchstart', 'mousedown', 'keydown', 'scroll', 'click'].forEach(evt =>
    window.addEventListener(evt, _idleMarkActive, { passive: true }));

  _idleCheckInterval = setInterval(_idleCheck, IDLE_CHECK_EVERY);
}

function _idleCheck() {
  if (!STATE.user || !STATE.user.session) return;
  const idleFor = Date.now() - _idleLastActivity;
  if (idleFor >= IDLE_TIMEOUT_MS) { _idleForceLogout(); return; }
  if (idleFor >= IDLE_TIMEOUT_MS - IDLE_WARNING_MS && !_idleWarningShown) {
    _idleShowWarning();
  }
}

function _idleShowWarning() {
  _idleWarningShown = true;
  const remainingStart = IDLE_TIMEOUT_MS - (Date.now() - _idleLastActivity);
  let secondsLeft = Math.max(1, Math.round(remainingStart / 1000));

  const overlay = document.createElement('div');
  overlay.id = 'idle-warning-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(4,8,20,0.72);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:1.25rem;';
  overlay.innerHTML = `
    <div style="background:var(--card-bg,#12172b);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:1.75rem 1.5rem;max-width:340px;width:100%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.5);">
      <div style="font-size:2rem;margin-bottom:0.75rem">⏳</div>
      <div style="font-weight:700;font-size:1.05rem;color:var(--text,#fff);margin-bottom:0.5rem">Still there?</div>
      <div style="font-size:0.875rem;color:var(--text-muted,#9aa3b8);line-height:1.5;margin-bottom:1.25rem">
        You've been inactive a while. For your security, you'll be signed out in
        <strong id="idle-countdown-num">${secondsLeft}</strong>s.
      </div>
      <button id="idle-stay-btn" style="width:100%;padding:0.7rem 1rem;border:none;border-radius:10px;background:var(--primary,#6467f2);color:#fff;font-weight:600;font-size:0.9rem;cursor:pointer;">
        Stay signed in
      </button>
    </div>`;
  document.body.appendChild(overlay);

  const numEl = overlay.querySelector('#idle-countdown-num');
  _idleCountdownInterval = setInterval(() => {
    secondsLeft -= 1;
    if (numEl) numEl.textContent = Math.max(0, secondsLeft);
    if (secondsLeft <= 0) {
      clearInterval(_idleCountdownInterval);
      _idleForceLogout();
    }
  }, 1000);

  overlay.querySelector('#idle-stay-btn').addEventListener('click', _idleMarkActive);
}

function _idleDismissWarning() {
  _idleWarningShown = false;
  if (_idleCountdownInterval) clearInterval(_idleCountdownInterval);
  const overlay = document.getElementById('idle-warning-overlay');
  if (overlay) overlay.remove();
}

async function _idleForceLogout() {
  _idleDismissWarning();
  try { await SUPA.auth.signOut(); } catch (e) {}
  location.reload();
}
