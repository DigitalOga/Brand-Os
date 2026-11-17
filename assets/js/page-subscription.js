// ── SUBSCRIPTION & BILLING ─────────────────────────────────────────────────
// Free vs Pro tier logic, daily generation limits, manual payment (bank
// transfer or Selar), full subscription management page.
//
// IMPORTANT: Load this file BEFORE all page-*.js files in app.html
// so isPro(), renderProPaywall(), checkGenLimit() are available globally.

// ── PAYMENT DETAILS (placeholders — fill in before launch) ─────────────────
// Bank transfer details shown in the upgrade modal. Replace every
// [PLACEHOLDER] with the real values.
const BANK_TRANSFER_DETAILS = {
  bankName:      '[BANK NAME]',            // e.g. GTBank
  accountName:   '[ACCOUNT NAME]',         // e.g. Brand OS Ltd
  accountNumber: '[ACCOUNT NUMBER]',       // e.g. 0123456789
  reference:     'Use your signed-up email as the transfer reference'
};
// Selar and Paystack checkout links. Both are flat "shop" pages — the price
// shown is whatever you configured on Selar's/Paystack's own dashboard for
// that link, NOT something this app can pass in dynamically. Before launch,
// double-check the amount configured on each of these two pages actually
// matches the plan price below (PLANS), so what the person sees in-app and
// what they're charged on the checkout page agree.
//
// Only one link was provided for each (not one per currency/plan), so the
// same link is used regardless of which currency the person selects here.
// If you later set up separate Selar/Paystack products per currency, split
// these into per-key values the same way SELAR_PAYMENT_LINKS used to expect.
const SELAR_PAYMENT_LINK    = 'https://selar.com/2i1k41y73o';
const PAYSTACK_PAYMENT_LINK = 'https://paystack.shop/pay/x4nbaz4p97';

// ── PRICING ────────────────────────────────────────────────────────────────
const PLANS = {
  usd: { currency:'USD', symbol:'$',  amount:10,    label:'$10 / month',       kobo:10    * 100 },
  ngn: { currency:'NGN', symbol:'₦', amount:15000, label:'₦15,000 / month',   kobo:15000 * 100 },
  gbp: { currency:'GBP', symbol:'£',  amount:8,     label:'£8 / month',        kobo:8     * 100 }
};

const FREE_LIMIT_AI   = 5;  // AI generations per day (free tier)
const FREE_LIMIT_BRIEF = 3; // daily brief refreshes per day (free tier)

// ── FEATURE LIST ──────────────────────────────────────────────────────────
const PLAN_FEATURES = [
  { label:'Dashboard — Daily Brief',                  free:true,  pro:true  },
  { label:'Write & Create (5 posts/day on Free)',      free:true,  pro:true  },
  { label:'Calendar & Post Tracker',                   free:true,  pro:true  },
  { label:'Profile & Brand Setup',                    free:true,  pro:true  },
  { label:'AI Content Engine (shared, no setup needed)', free:true,  pro:true  },
  { label:'Ask the Coach (3 questions/day on Free)',   free:true,  pro:true  },
  { label:'Voice Library (up to 5 posts on Free)',     free:true,  pro:true  },
  { label:'Unlimited AI Generations',                  free:false, pro:true  },
  { label:'Discover (search + trend analysis)',        free:false, pro:true  },
  { label:'Feedback Insights',                         free:false, pro:true  },
  { label:'Positioning (pitch check + Big Idea)',      free:false, pro:true  },
  { label:'Offer Builder',                             free:false, pro:true  },
  { label:'Unlimited Voice Library',                   free:false, pro:true  },
  { label:'Unlimited Coaching',                        free:false, pro:true  },
  { label:'Push Notifications & Alerts',              free:false, pro:true  },
];

// ── PRO STATUS ─────────────────────────────────────────────────────────────
function isPro() {
  try {
    const profile = (typeof getUserProfile === 'function') ? getUserProfile() : null;
    if (!profile) return false;
    if (profile.is_admin) return true; // admins always have full access — no need to self-grant Pro time
    if (!profile.is_pro) return false;
    if (!profile.pro_expires_at) return false;
    return new Date(profile.pro_expires_at) > new Date();
  } catch(e) { return false; }
}

function getProExpiry() {
  try {
    const profile = (typeof getUserProfile === 'function') ? getUserProfile() : null;
    if (!profile || !profile.pro_expires_at) return null;
    return new Date(profile.pro_expires_at);
  } catch(e) { return null; }
}

// ── DAILY GENERATION COUNTER ───────────────────────────────────────────────
// Stored in localStorage, separate from STATE — simple and reliable.
const _GEN_KEY    = 'brandos_daily_gen';
const _BRIEF_KEY  = 'brandos_daily_brief_count';

function _todayISO() { return new Date().toISOString().split('T')[0]; }

function getDailyGenCount() {
  try {
    const raw = localStorage.getItem(_GEN_KEY);
    if (!raw) return 0;
    const d = JSON.parse(raw);
    if (d.date !== _todayISO()) return 0;
    return d.count || 0;
  } catch(e) { return 0; }
}

function incrementDailyGen() {
  try {
    const today = _todayISO();
    const raw = localStorage.getItem(_GEN_KEY);
    const d = raw ? JSON.parse(raw) : { date: today, count: 0 };
    if (d.date !== today) { d.date = today; d.count = 0; }
    d.count++;
    localStorage.setItem(_GEN_KEY, JSON.stringify(d));
    return d.count;
  } catch(e) { return 0; }
}

function getDailyBriefCount() {
  try {
    const raw = localStorage.getItem(_BRIEF_KEY);
    if (!raw) return 0;
    const d = JSON.parse(raw);
    if (d.date !== _todayISO()) return 0;
    return d.count || 0;
  } catch(e) { return 0; }
}

function incrementDailyBrief() {
  try {
    const today = _todayISO();
    const raw = localStorage.getItem(_BRIEF_KEY);
    const d = raw ? JSON.parse(raw) : { date: today, count: 0 };
    if (d.date !== today) { d.date = today; d.count = 0; }
    d.count++;
    localStorage.setItem(_BRIEF_KEY, JSON.stringify(d));
    return d.count;
  } catch(e) { return 0; }
}

// ── CHECK GENERATION LIMIT ────────────────────────────────────────────────
// Returns true if the call may proceed, false if the gate should block.
function checkGenLimit() {
  if (isPro()) return true;
  const count = getDailyGenCount();
  if (count < FREE_LIMIT_AI) return true;
  showProUpgradeToast('generation');
  return false;
}

function checkBriefLimit() {
  if (isPro()) return true;
  const count = getDailyBriefCount();
  if (count < FREE_LIMIT_BRIEF) return true;
  showProUpgradeToast('daily brief refresh');
  return false;
}

function showProUpgradeToast(feature) {
  if (typeof showToast === 'function') {
    showToast(`You've used all your free tries for ${feature} today. Come back tomorrow, or go Pro for no daily limit.`, true);
  }
}

// ── PAYWALL COMPONENT ─────────────────────────────────────────────────────
// Drop-in paywall gate for any Pro-only page.
function renderProPaywall(featureName) {
  const el = document.createElement('div');
  el.className = 'pro-gate';
  el.innerHTML = `
    <div class="pro-gate-inner">
      <div class="pro-gate-icon">⚡</div>
      <h3 class="pro-gate-title">${featureName} is a Pro feature</h3>
      <p class="pro-gate-desc">
        Upgrade to unlock ${featureName}, plus unlimited AI generations,
        Discover, Coaching, Positioning, Offers, and every Studio tool.
      </p>
      <div class="pro-gate-pricing">
        <span>From <strong>$10</strong> · <strong>₦15,000</strong> · <strong>£8</strong> per month</span>
      </div>
      <button class="btn btn-primary pro-gate-btn" id="pro-gate-cta">
        Upgrade to Pro →
      </button>
      <p class="pro-gate-note">Cancel anytime · Pay by bank transfer, Selar, or Paystack</p>
    </div>
  `;
  el.querySelector('#pro-gate-cta').addEventListener('click', () => {
    if (typeof navigate === 'function') navigate('subscription');
  });
  return el;
}

// Reusable "taste it, then upgrade" preview — a real chunk of the AI's own
// result shown in full, with the rest hidden behind a blur + upgrade card.
// Used instead of an all-or-nothing wall for Feedback Insights and the
// Signature scan, so free users see genuine value before being asked to pay.
function renderBlurredPreview(fullText, opts = {}) {
  const { visibleText, teaseLine, ctaLabel = 'Upgrade to Pro to see the rest →' } = opts;
  const wrap = document.createElement('div');
  wrap.className = 'card pro-blur-wrap';
  wrap.innerHTML = `
    <div class="pro-blur-visible">${escHtml(visibleText).replace(/\n/g,'<br>')}</div>
    <div class="pro-blur-hidden" aria-hidden="true">
      <div class="pro-blur-fade">${escHtml(fullText).replace(/\n/g,'<br>')}</div>
      <div class="pro-blur-overlay">
        <p class="pro-blur-tease">${teaseLine || "There's more here — the rest is for Pro."}</p>
        <button class="btn btn-primary btn-sm" id="pro-blur-cta">${ctaLabel}</button>
      </div>
    </div>
  `;
  wrap.querySelector('#pro-blur-cta').addEventListener('click', () => {
    if (typeof navigate === 'function') navigate('subscription');
  });
  return wrap;
}

// ── SUBSCRIPTION PAGE ─────────────────────────────────────────────────────
function renderSubscription() {
  const pro    = isPro();
  const expiry = getProExpiry();
  const el     = document.createElement('div');
  el.className = 'space-y-6';

  const fmtDate = d => d
    ? d.toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })
    : '';

  const tick = color =>
    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
  const cross = () =>
    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted-fg)" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

  el.innerHTML = `
    <div class="page-heading">
      <h1>Subscription</h1>
      <p>Manage your Brand OS plan, billing, and renewal.</p>
    </div>

    <!-- CURRENT PLAN STATUS -->
    <div class="card sub-plan-card ${pro ? 'sub-plan-card--pro' : ''}">
      <div class="sub-plan-top">
        <div>
          <span class="sub-plan-badge ${pro ? 'sub-plan-badge--pro' : 'sub-plan-badge--free'}">
            ${pro ? '⚡ Pro Plan' : 'Free Plan'}
          </span>
          <h2 class="sub-plan-title">
            ${pro ? "You're on Brand OS Pro" : "You're on the Free Plan"}
          </h2>
          <p class="text-muted text-sm" style="margin-top:0.25rem">
            ${pro
              ? (expiry && expiry > new Date()
                  ? `Renews on <strong>${fmtDate(expiry)}</strong>. Your Pro features are fully active.`
                  : `Your Pro access has expired. Renew below to restore full access.`)
              : 'Upgrade to Pro for unlimited AI, all Studio tools, and no daily caps.'}
          </p>
        </div>
        ${pro && expiry ? `
          <div class="sub-plan-renewal">
            <div class="sub-plan-renewal-label">Next renewal</div>
            <div class="sub-plan-renewal-date">${fmtDate(expiry)}</div>
          </div>` : ''}
      </div>
    </div>

    ${!pro ? `
    <!-- PRICING OPTIONS -->
    <div>
      <h3 style="margin-bottom:1rem">Choose your currency</h3>
      <div class="sub-pricing-grid">
        <button class="sub-price-card" data-plan="usd">
          <div class="sub-price-flag">🇺🇸</div>
          <div class="sub-price-amount">$10</div>
          <div class="sub-price-period">per month · USD</div>
        </button>
        <button class="sub-price-card sub-price-card--featured" data-plan="ngn">
          <div class="sub-price-popular">Most Popular</div>
          <div class="sub-price-flag">🇳🇬</div>
          <div class="sub-price-amount">₦15,000</div>
          <div class="sub-price-period">per month · NGN</div>
        </button>
        <button class="sub-price-card" data-plan="gbp">
          <div class="sub-price-flag">🇬🇧</div>
          <div class="sub-price-amount">£8</div>
          <div class="sub-price-period">per month · GBP</div>
        </button>
      </div>
    </div>

    <!-- UPGRADE CTA -->
    <div class="card" style="text-align:center;padding:2rem 1.5rem">
      <div id="sub-selected-label" style="font-size:0.95rem;font-weight:600;color:var(--muted-fg);margin-bottom:1rem">
        Select a plan above to continue
      </div>
      <button id="sub-pay-btn" class="btn btn-primary sub-pay-btn" disabled>
        Upgrade to Pro →
      </button>
      <p class="text-xs text-muted" style="margin-top:0.75rem">
        Pay by bank transfer or Selar · Cancel anytime
      </p>
    </div>

    <!-- FREE TIER LIMITS REMINDER -->
    <div class="card sub-limits-card">
      <div class="card-header">
        <div class="card-title">What you get for free (resets every day)</div>
      </div>
      <div class="sub-limits-grid">
        <div class="sub-limit-row">
          <span>AI tries used today</span>
          <strong>${getDailyGenCount()} / ${FREE_LIMIT_AI}</strong>
        </div>
        <div class="sub-limit-row">
          <span>Daily Brief refreshes today</span>
          <strong>${getDailyBriefCount()} / ${FREE_LIMIT_BRIEF}</strong>
        </div>
      </div>
    </div>
    ` : ''}

    <!-- FEATURES COMPARISON TABLE -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">Free vs Pro</div>
      </div>
      <div class="sub-features-table">
        <div class="sub-features-head">
          <span>Feature</span>
          <span style="text-align:center">Free</span>
          <span style="text-align:center;color:var(--accent)">⚡ Pro</span>
        </div>
        ${PLAN_FEATURES.map(f => `
          <div class="sub-feature-row">
            <span>${f.label}</span>
            <span style="text-align:center">${f.free ? tick('var(--success)') : cross()}</span>
            <span style="text-align:center">${f.pro  ? tick('var(--accent)') : cross()}</span>
          </div>`).join('')}
      </div>
    </div>

    ${pro ? `
    <!-- ABOUT RENEWAL -->
    <div class="card" style="border:1px solid rgba(239,68,68,0.3)">
      <div class="card-header">
        <div class="card-title" style="color:var(--destructive,#ef4444)">About your Pro plan ending</div>
        <div class="card-desc">
          Your plan does NOT renew by itself. Your Pro access stays on until <strong>${fmtDate(expiry)}</strong>,
          then it turns back into the Free plan unless you pay again.
        </div>
      </div>
      <button id="sub-cancel-btn" class="btn btn-outline" style="border-color:rgba(239,68,68,0.6);color:var(--destructive,#ef4444)">
        Cancel Subscription
      </button>
    </div>
    ` : ''}
  `;

  // ── Plan selection ────────────────────────────────────────────────────────
  if (!pro) {
    let selectedPlan = null;

    el.querySelectorAll('[data-plan]').forEach(card => {
      card.addEventListener('click', () => {
        el.querySelectorAll('[data-plan]').forEach(c => c.classList.remove('sub-price-card--selected'));
        card.classList.add('sub-price-card--selected');
        selectedPlan = card.dataset.plan;
        const plan = PLANS[selectedPlan];
        el.querySelector('#sub-selected-label').textContent = `${plan.label} — bank transfer or Selar`;
        const btn = el.querySelector('#sub-pay-btn');
        btn.disabled = false;
        btn.textContent = `Continue — ${plan.label} →`;
      });
    });

    // ── Payment modal (bank transfer / Selar) ────────────────────────────
    el.querySelector('#sub-pay-btn').addEventListener('click', () => {
      if (!selectedPlan) return;
      const user = STATE.user && STATE.user.session && STATE.user.session.user;
      if (!user) { showToast('Please sign in to upgrade', true); return; }
      showPaymentModal(selectedPlan, user);
    });
  }

  // ── Cancel ───────────────────────────────────────────────────────────────
  // Manual payments (bank transfer / Selar) never auto-renew — Pro simply
  // lapses at the expiry date unless another payment is made. So "cancel"
  // is informational only; there's no billing to stop.
  if (pro) {
    el.querySelector('#sub-cancel-btn')?.addEventListener('click', () => {
      const until = fmtDate(expiry);
      showToast(`Nothing to cancel — there's no auto-renewal. Your Pro access simply ends on ${until} unless you pay again.`);
    });
  }

  return el;
}

// ── PAYMENT MODAL (bank transfer / Selar) ─────────────────────────────────
// Opens a centered modal with the two ways to pay. Pro is activated
// manually by the admin (Admin Panel → +30d Pro) once payment is confirmed.
function showPaymentModal(planKey, user) {
  const plan = PLANS[planKey];
  const existing = document.getElementById('pay-modal-backdrop');
  if (existing) existing.remove();

  const bank = BANK_TRANSFER_DETAILS;

  const backdrop = document.createElement('div');
  backdrop.id = 'pay-modal-backdrop';
  backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:500;display:flex;align-items:center;justify-content:center;padding:1rem;overflow-y:auto;';

  backdrop.innerHTML = `
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:16px;max-width:420px;width:100%;padding:1.5rem;max-height:90vh;overflow-y:auto;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.25rem">
        <h3 style="margin:0">Upgrade to Pro</h3>
        <button id="pay-modal-close" class="btn btn-ghost btn-icon btn-sm" aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <p class="text-muted text-sm" style="margin:0 0 1.25rem">${plan.label} · Choose how you'd like to pay.</p>

      <!-- OPTION 1: BANK TRANSFER -->
      <div style="border:1px solid var(--border);border-radius:12px;padding:1rem;margin-bottom:1rem">
        <div style="display:flex;align-items:center;gap:0.5rem;font-weight:600;margin-bottom:0.75rem">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"/></svg>
          Bank Transfer
        </div>
        <div class="text-sm" style="display:grid;gap:0.4rem">
          <div style="display:flex;justify-content:space-between;gap:0.5rem"><span class="text-muted">Bank</span><strong>${bank.bankName}</strong></div>
          <div style="display:flex;justify-content:space-between;gap:0.5rem"><span class="text-muted">Account name</span><strong>${bank.accountName}</strong></div>
          <div style="display:flex;justify-content:space-between;gap:0.5rem;align-items:center">
            <span class="text-muted">Account number</span>
            <span style="display:flex;align-items:center;gap:0.4rem">
              <strong id="pay-acct-num" style="font-family:monospace">${bank.accountNumber}</strong>
              <button id="pay-copy-acct" class="btn btn-ghost btn-sm" style="padding:0.2rem 0.5rem">Copy</button>
            </span>
          </div>
          <div style="display:flex;justify-content:space-between;gap:0.5rem"><span class="text-muted">Amount</span><strong>${plan.symbol}${plan.amount.toLocaleString()}</strong></div>
        </div>
        <p class="text-xs text-muted" style="margin:0.75rem 0 0">
          ${bank.reference}${user && user.email ? ` (<strong>${(typeof escHtml === 'function' ? escHtml(user.email) : String(user.email).replace(/[<>&"]/g, ''))}</strong>)` : ''}.
          Once your transfer is confirmed, Pro is activated on your account — usually within a few hours.
        </p>
      </div>

      <!-- OPTION 2: SELAR -->
      <div style="border:1px solid var(--border);border-radius:12px;padding:1rem;margin-bottom:1rem">
        <div style="display:flex;align-items:center;gap:0.5rem;font-weight:600;margin-bottom:0.75rem">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
          Pay with Selar
        </div>
        <a id="pay-selar-btn" class="btn btn-primary" style="width:100%;text-decoration:none" href="${SELAR_PAYMENT_LINK}" target="_blank" rel="noopener noreferrer">
          Pay ${plan.label} on Selar →
        </a>
        <p class="text-xs text-muted" style="margin:0.75rem 0 0">You'll be taken to Selar's secure checkout. Use the same email you signed up with so your Pro access links to this account.</p>
      </div>

      <!-- OPTION 3: PAYSTACK -->
      <div style="border:1px solid var(--border);border-radius:12px;padding:1rem">
        <div style="display:flex;align-items:center;gap:0.5rem;font-weight:600;margin-bottom:0.75rem">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M6 15h4"/></svg>
          Pay with Paystack
        </div>
        <a id="pay-paystack-btn" class="btn btn-primary" style="width:100%;text-decoration:none" href="${PAYSTACK_PAYMENT_LINK}" target="_blank" rel="noopener noreferrer">
          Pay ${plan.label} on Paystack →
        </a>
        <p class="text-xs text-muted" style="margin:0.75rem 0 0">You'll be taken to Paystack's secure checkout. Use the same email you signed up with so your Pro access links to this account.</p>
      </div>

      <p class="text-xs text-muted" style="margin:1rem 0 0;text-align:center">
        Payment is confirmed manually right now — Pro is switched on for your account shortly after you pay, not instantly.
      </p>
    </div>`;

  document.body.appendChild(backdrop);

  backdrop.querySelector('#pay-modal-close').addEventListener('click', () => backdrop.remove());
  backdrop.addEventListener('click', e => { if (e.target === backdrop) backdrop.remove(); });

  backdrop.querySelector('#pay-copy-acct')?.addEventListener('click', async (e) => {
    try {
      await navigator.clipboard.writeText(BANK_TRANSFER_DETAILS.accountNumber);
      e.target.textContent = 'Copied';
      if (typeof showToast === 'function') showToast('Account number copied');
      setTimeout(() => { e.target.textContent = 'Copy'; }, 2000);
    } catch(err) {
      if (typeof showToast === 'function') showToast('Copy failed — long-press the number to copy it manually.', true);
    }
  });
}
