// ── AUTH PAGE (email + password) ────────────────────────────────────────────
// New user:      email + password → account created. Signed in immediately
//                if your Supabase project has "Confirm email" OFF, or shown
//                a "check your email" screen if it's ON.
// Returning user: email + password → signed in immediately
// No invite codes, no magic links — for every account, including admins.
// Admin status is granted by email match on the server.

function renderAuthPage() {
  const gate = document.getElementById('auth-gate');
  if (!gate) return;
  gate.innerHTML = '';
  gate.style.display = 'flex';
  gate.appendChild(buildAuthCard());
}

function buildAuthCard() {
  const wrap = document.createElement('div');
  wrap.className = 'auth-card';

  const urlMode = new URLSearchParams(location.search).get('mode');
  let mode = (urlMode === 'returning') ? 'returning' : 'new'; // 'new' | 'returning' | 'forgot'

  function render() {
    wrap.innerHTML = `
      <img src="assets/icons/icon-192.png" alt="" class="auth-mark"><div class="auth-logo">Brand <span>OS</span></div>

      <div class="auth-tabs">
        <button class="auth-tab ${mode==='new'?'active':''}" id="tab-new">Create Account</button>
        <button class="auth-tab ${mode==='returning'?'active':''}" id="tab-ret">Sign In</button>
      </div>

      ${mode === 'new' ? `
        <p class="auth-sub">Enter your email and password to create your account.</p>
        <div class="auth-field">
          <label for="a-email">Email</label>
          <input id="a-email" type="email" class="auth-input"
            placeholder="you@example.com" autocomplete="email" autocorrect="off" spellcheck="false">
        </div>
        <div class="auth-field">
          <label for="a-password">Password</label>
          <div class="auth-pass-wrap">
            <input id="a-password" type="password" class="auth-input"
              placeholder="At least 6 characters" autocomplete="new-password">
            <button type="button" class="auth-eye" data-eye="a-password" aria-label="Show password">${EYE_SVG}</button>
          </div>
        </div>
        <div id="a-error" class="auth-error" style="display:none"></div>
        <button id="a-btn" class="auth-btn">Create Account →</button>
      ` : mode === 'returning' ? `
        <p class="auth-sub">Sign in with your email and password.</p>
        <div class="auth-field">
          <label for="a-email">Email</label>
          <input id="a-email" type="email" class="auth-input"
            placeholder="you@example.com" autocomplete="email" autocorrect="off" spellcheck="false">
        </div>
        <div class="auth-field">
          <label for="a-password">Password</label>
          <div class="auth-pass-wrap">
            <input id="a-password" type="password" class="auth-input"
              placeholder="Your password" autocomplete="current-password">
            <button type="button" class="auth-eye" data-eye="a-password" aria-label="Show password">${EYE_SVG}</button>
          </div>
        </div>
        <div id="a-error" class="auth-error" style="display:none"></div>
        <button id="a-btn" class="auth-btn">Sign In →</button>
        <button id="a-forgot" class="auth-btn auth-btn--outline" style="margin-top:0.75rem">Forgot password?</button>
      ` : `
        <p class="auth-sub">Enter your email — we'll send a link to reset your password.</p>
        <div class="auth-field">
          <label for="a-email">Email</label>
          <input id="a-email" type="email" class="auth-input"
            placeholder="you@example.com" autocomplete="email" autocorrect="off" spellcheck="false">
        </div>
        <div id="a-error" class="auth-error" style="display:none"></div>
        <button id="a-btn" class="auth-btn">Send Reset Link →</button>
        <button id="a-back" class="auth-btn auth-btn--outline" style="margin-top:0.75rem">Back to Sign In</button>
      `}
    `;

    wrap.querySelector('#tab-new')?.addEventListener('click', () => { mode = 'new'; render(); });
    wrap.querySelector('#tab-ret')?.addEventListener('click', () => { mode = 'returning'; render(); });
    wrap.querySelector('#a-forgot')?.addEventListener('click', () => { mode = 'forgot'; render(); });
    wrap.querySelector('#a-back')?.addEventListener('click', () => { mode = 'returning'; render(); });

    wrap.querySelector('#a-btn')?.addEventListener('click', () => handleSubmit());
    wireEyeToggles(wrap);
    wrap.querySelectorAll('.auth-input').forEach(inp => {
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') handleSubmit(); });
    });
  }

  async function handleSubmit() {
    const btn   = wrap.querySelector('#a-btn');
    const errEl = wrap.querySelector('#a-error');
    const email = (wrap.querySelector('#a-email')?.value || '').trim().toLowerCase();
    errEl.style.display = 'none';

    if (!email || !email.includes('@')) {
      showAuthError(errEl, 'Enter a valid email address.');
      return;
    }

    // ── Forgot password ──────────────────────────────────────────────────
    if (mode === 'forgot') {
      btn.disabled = true; btn.textContent = 'Sending…';
      const { error } = await SUPA.auth.resetPasswordForEmail(email, {
        redirectTo: location.origin + location.pathname
      });
      btn.disabled = false; btn.textContent = 'Send Reset Link →';
      if (error) { showAuthError(errEl, error.message); return; }
      wrap.innerHTML = `
        <div style="text-align:center">
          <div style="font-size:3rem;margin-bottom:1rem">📬</div>
          <div class="auth-logo" style="margin-bottom:0.75rem">Check your inbox</div>
          <p style="color:var(--text-muted);font-size:0.9375rem;line-height:1.65;margin-bottom:1.5rem">
            We sent a password reset link to<br><strong style="color:var(--text)">${email}</strong>
          </p>
          <button id="a-back2" class="auth-btn auth-btn--outline">Back to Sign In</button>
        </div>`;
      wrap.querySelector('#a-back2').addEventListener('click', () => { mode = 'returning'; render(); });
      return;
    }

    const password = wrap.querySelector('#a-password')?.value || '';
    if (!password || password.length < 6) {
      showAuthError(errEl, 'Password must be at least 6 characters.');
      return;
    }

    // ── New account ──────────────────────────────────────────────────────
    if (mode === 'new') {
      btn.disabled = true; btn.textContent = 'Creating account…';
      const { data, error } = await SUPA.auth.signUp({ email, password });
      btn.disabled = false; btn.textContent = 'Create Account →';

      if (error) {
        const msg = (error.message || '').toLowerCase();
        showAuthError(errEl, msg.includes('already registered')
          ? 'An account with that email already exists — try Sign In instead.'
          : error.message);
        return;
      }

      // Whether this shows a "check your email" screen or signs the person
      // straight in depends entirely on your Supabase project's
      // Authentication → Providers → Email → "Confirm email" setting —
      // this code handles both without needing to know which one is on.
      // With confirmation ON, signUp() succeeds but returns no session
      // (data.session is null) until the person clicks the emailed link.
      if (!data.session) {
        wrap.innerHTML = `
          <div style="text-align:center">
            <div style="font-size:3rem;margin-bottom:1rem">📬</div>
            <div class="auth-logo" style="margin-bottom:0.75rem">Check your email</div>
            <p style="color:var(--text-muted);font-size:0.9375rem;line-height:1.65;margin-bottom:1.5rem">
              We sent a confirmation link to<br><strong style="color:var(--text)">${email}</strong><br>
              Click it to activate your account, then come back and sign in.
            </p>
            <button id="a-back3" class="auth-btn auth-btn--outline">Back to Sign In</button>
          </div>`;
        wrap.querySelector('#a-back3').addEventListener('click', () => { mode = 'returning'; render(); });
        return;
      }
      // Confirmation is off — signed in immediately. main.js's
      // onAuthStateChange picks this up and routes to onboarding
      // automatically. Nothing more to do here.
      return;
    }

    // ── Returning user sign-in ───────────────────────────────────────────
    btn.disabled = true; btn.textContent = 'Signing in…';
    const { error } = await SUPA.auth.signInWithPassword({ email, password });
    btn.disabled = false; btn.textContent = 'Sign In →';

    if (error) {
      const msg = (error.message || '').toLowerCase();
      showAuthError(errEl, msg.includes('invalid login')
        ? 'Incorrect email or password.'
        : error.message);
      return;
    }
    // Signed in — main.js's onAuthStateChange handles the rest.
  }

  render();
  return wrap;
}

// ── Helpers ────────────────────────────────────────────────────────────────
// Eye / eye-off icons for the show-hide password toggle, shared by the
// sign-up, sign-in, and set-new-password screens.
const EYE_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_OFF_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M14.12 14.12a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

// Wires every [data-eye] button inside `root` to toggle its target input
// between type="password" (hidden) and type="text" (revealed).
function wireEyeToggles(root) {
  root.querySelectorAll('[data-eye]').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = root.querySelector('#' + btn.dataset.eye);
      if (!input) return;
      const reveal = input.type === 'password';
      input.type = reveal ? 'text' : 'password';
      btn.innerHTML = reveal ? EYE_OFF_SVG : EYE_SVG;
      btn.setAttribute('aria-label', reveal ? 'Hide password' : 'Show password');
      input.focus();
      // keep the caret at the end instead of jumping to the start
      try { const len = input.value.length; input.setSelectionRange(len, len); } catch(e) {}
    });
  });
}

function showAuthError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
}

// ── SET NEW PASSWORD (after clicking the reset-password email link) ───────
// Supabase signs the visitor in automatically when they click the recovery
// link (that's how the link works), then fires a PASSWORD_RECOVERY event.
// Without this screen, that would just silently log them in on the old
// password. This is what actually lets them set a new one.
function renderSetNewPasswordPage() {
  const gate = document.getElementById('auth-gate');
  if (!gate) return;
  gate.innerHTML = '';
  gate.style.display = 'flex';

  const wrap = document.createElement('div');
  wrap.className = 'auth-card';
  wrap.innerHTML = `
    <img src="assets/icons/icon-192.png" alt="" class="auth-mark"><div class="auth-logo">Brand <span>OS</span></div>
    <p class="auth-sub">Choose a new password for your account.</p>
    <div class="auth-field">
      <label for="np-password">New password</label>
      <div class="auth-pass-wrap">
        <input id="np-password" type="password" class="auth-input"
          placeholder="At least 6 characters" autocomplete="new-password">
        <button type="button" class="auth-eye" data-eye="np-password" aria-label="Show password">${EYE_SVG}</button>
      </div>
    </div>
    <div class="auth-field">
      <label for="np-password2">Confirm new password</label>
      <div class="auth-pass-wrap">
        <input id="np-password2" type="password" class="auth-input"
          placeholder="Re-enter your new password" autocomplete="new-password">
        <button type="button" class="auth-eye" data-eye="np-password2" aria-label="Show password">${EYE_SVG}</button>
      </div>
    </div>
    <div id="np-error" class="auth-error" style="display:none"></div>
    <button id="np-btn" class="auth-btn">Set New Password →</button>
  `;
  gate.appendChild(wrap);
  wireEyeToggles(wrap);

  const errEl = wrap.querySelector('#np-error');
  const btn   = wrap.querySelector('#np-btn');

  async function submit() {
    const p1 = wrap.querySelector('#np-password').value;
    const p2 = wrap.querySelector('#np-password2').value;
    errEl.style.display = 'none';

    if (!p1 || p1.length < 6) { showAuthError(errEl, 'Password must be at least 6 characters.'); return; }
    if (p1 !== p2)            { showAuthError(errEl, 'Passwords do not match.'); return; }

    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      const { error } = await SUPA.auth.updateUser({ password: p1 });
      if (error) { showAuthError(errEl, error.message); btn.disabled = false; btn.textContent = 'Set New Password →'; return; }
    } catch (e) {
      showAuthError(errEl, 'Network error — check your connection and try again.');
      btn.disabled = false; btn.textContent = 'Set New Password →';
      return;
    }

    wrap.innerHTML = `
      <div style="text-align:center">
        <div style="font-size:3rem;margin-bottom:1rem">✅</div>
        <div class="auth-logo" style="margin-bottom:0.75rem">Password updated</div>
        <p style="color:var(--text-muted);font-size:0.9375rem;line-height:1.65;margin-bottom:1.5rem">
          You're all set. Continuing into your account…
        </p>
      </div>`;

    // Clear the recovery hash so a refresh doesn't re-trigger this screen,
    // then continue the normal signed-in boot flow.
    history.replaceState(null, '', location.pathname + location.search);
    setTimeout(async () => {
      const { data: { session } } = await SUPA.auth.getSession();
      await handleAuthState(session);
    }, 900);
  }

  btn.addEventListener('click', submit);
  wrap.querySelectorAll('.auth-input').forEach(inp => {
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  });
}
