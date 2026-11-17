// ── ONBOARDING FLOW ────────────────────────────────────────────────────────
// Shown once, right after a new user creates their account.
// Collects: name, role, brand_name, audience, pillars, voice, key_phrases, posts.
// Progress is saved after EVERY step — to localStorage instantly, and to
// Supabase `user_state` (cloud, debounced ~1.2s) so leaving mid-onboarding
// and coming back later (even on a different device/browser) resumes
// exactly where they left off instead of starting over. The final "Finish
// Setup" / "Skip for now" writes the real `profiles` row and clears the draft.

const VOICE_DESCRIPTOR_OPTIONS = [
  'Direct', 'Confessional', 'Prophetic', 'Practical', 'Aphoristic',
  'Conversational', 'Authoritative', 'Warm', 'Challenging', 'Storytelling',
  'Data-driven', 'Inspirational', 'Contrarian', 'Mentoring', 'Visionary',
  'Humble', 'Sharp', 'Poetic', 'Bold', 'Grounded'
];

const ONBOARDING_STEPS = [
  { id: 'identity',   title: 'Who are you?',                    emoji: '✦' },
  { id: 'audience',   title: 'Who do you show up for?',         emoji: '◎' },
  { id: 'pillars',    title: 'What do you always come back to?', emoji: '▦' },
  { id: 'voice',      title: 'How do you sound?',               emoji: '◈' },
  { id: 'phrases',    title: 'What do you always say?',         emoji: '❝' },
  { id: 'posts',      title: 'Show me something you\'ve written', emoji: '▣' },
  { id: 'done',       title: 'You\'re in.',                     emoji: '★' }
];

let _onboardingData = {
  name: '', role: '', brand_name: '', audience: '',
  pillars: [], voice_descriptors: [], key_phrases: [], sample_posts: []
};
let _onboardingStep = 0;
let _onboardingUserId = null;

function _draftKey(userId) { return `brandos_onboarding_draft_${userId}`; }

function saveOnboardingDraft() {
  if (!_onboardingUserId) return;
  const payload = { step: _onboardingStep, data: _onboardingData, savedAt: Date.now() };
  try {
    localStorage.setItem(_draftKey(_onboardingUserId), JSON.stringify(payload));
  } catch (e) { /* storage full/unavailable — non-fatal, cloud save below still runs */ }
  // Cloud copy — this is what lets someone resume on a different device or
  // browser, or after clearing local storage, instead of starting over.
  // Debounced (1.2s) inside saveUserStateDebounced, so rapid step changes
  // don't spam the network.
  saveUserStateDebounced(_onboardingUserId, { onboardingDraft: payload });
}

function loadOnboardingDraft(userId) {
  try {
    const raw = localStorage.getItem(_draftKey(userId));
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function clearOnboardingDraft(userId) {
  try { localStorage.removeItem(_draftKey(userId)); } catch (e) {}
  // Best-effort — not awaited, onboarding is already done at this point so
  // it's fine if this lands a moment later. Wipes just the draft key;
  // the very next real app boot's saveState() will overwrite state_json
  // with real app state anyway.
  saveUserStateDebounced(userId, { onboardingDraft: null });
}

async function renderOnboarding(session) {
  const gate = document.getElementById('auth-gate');
  if (!gate) return;
  gate.innerHTML = '';
  gate.style.display = 'flex';

  const isNewSession = session.user.id !== _onboardingUserId;
  if (isNewSession) {
    _onboardingUserId = session.user.id;
    // A fresh page load looks the same as a fresh session to this module
    // (both wipe the in-memory vars) — so before assuming "start over,"
    // check for a saved draft from this exact user first. Cloud is the
    // source of truth (works across devices/browsers); local storage is
    // just a same-device fallback for if the cloud fetch fails (offline).
    const localDraft = loadOnboardingDraft(session.user.id);
    let cloudDraft = null;
    try {
      const cloudState = await fetchUserState(session.user.id);
      cloudDraft = cloudState && cloudState.onboardingDraft ? cloudState.onboardingDraft : null;
    } catch (e) { /* offline or fetch failed — fall back to local below */ }

    const draft = (cloudDraft && localDraft)
      ? (cloudDraft.savedAt >= (localDraft.savedAt || 0) ? cloudDraft : localDraft)
      : (cloudDraft || localDraft);

    if (draft && draft.data) {
      _onboardingStep = draft.step || 0;
      _onboardingData = draft.data;
    } else {
      _onboardingStep = 0;
      _onboardingData = { name:'', role:'', brand_name:'', audience:'', pillars:[], voice_descriptors:[], key_phrases:[], sample_posts:[] };
    }
  }
  // Same user calling again (tab refocus / token refresh re-fire) falls
  // through WITHOUT resetting — keeps whatever step/data was already entered.
  gate.appendChild(buildOnboardingFrame(session));
}

function buildOnboardingFrame(session) {
  const wrap = document.createElement('div');
  wrap.id = 'onboarding-wrap';
  wrap.className = 'onboarding-wrap';
  renderOnboardingStep(wrap, session);
  return wrap;
}

function renderOnboardingStep(wrap, session) {
  const step = ONBOARDING_STEPS[_onboardingStep];
  const total = ONBOARDING_STEPS.length - 1;
  const isLast = _onboardingStep >= total;

  wrap.innerHTML = `
    <div class="ob-progress" ${isLast ? 'style="opacity:0"' : ''}>
      ${ONBOARDING_STEPS.slice(0, -1).map((s, i) => `
        <div class="ob-pip ${i < _onboardingStep ? 'done' : i === _onboardingStep ? 'active' : ''}"></div>
      `).join('')}
    </div>
    <div class="ob-card" id="ob-card">
      <div class="ob-emoji">${step.emoji}</div>
      <h2 class="ob-title">${step.title}</h2>
      <div class="ob-body" id="ob-body"></div>
      <div id="ob-error" class="auth-error" style="display:none"></div>
      <div class="ob-actions" id="ob-actions"></div>
    </div>
  `;

  const body    = wrap.querySelector('#ob-body');
  const actions = wrap.querySelector('#ob-actions');
  const errEl   = wrap.querySelector('#ob-error');

  requestAnimationFrame(() => {
    wrap.querySelector('#ob-card').classList.add('ob-card--in');
  });

  switch (step.id) {

    case 'identity':
      body.innerHTML = `
        <div class="auth-field">
          <label for="ob-name">Your full name</label>
          <input id="ob-name" class="auth-input" type="text" placeholder="e.g. Amara Nwosu"
            value="${_onboardingData.name}" autocomplete="name">
        </div>
        <div class="auth-field">
          <label for="ob-role">What do you do? <span class="ob-hint">(one line)</span></label>
          <input id="ob-role" class="auth-input" type="text"
            placeholder="e.g. Business coach & systems consultant"
            value="${_onboardingData.role}">
        </div>
        <div class="auth-field">
          <label for="ob-brand">Brand name or handle <span class="ob-hint">(optional — e.g. #TheSystemsCoach)</span></label>
          <input id="ob-brand" class="auth-input" type="text"
            placeholder="e.g. #TheSystemsCoach or Amara Builds"
            value="${_onboardingData.brand_name}">
        </div>
      `;
      addObNext(actions, errEl, () => {
        const name  = body.querySelector('#ob-name').value.trim();
        const role  = body.querySelector('#ob-role').value.trim();
        const brand = body.querySelector('#ob-brand').value.trim();
        if (!name) return 'Tell us your name.';
        if (!role) return 'Describe what you do in one line.';
        _onboardingData.name       = name;
        _onboardingData.role       = role;
        _onboardingData.brand_name = brand;
        return null;
      }, wrap, session, {
        skipDefaults: () => {
          _onboardingData.name       = body.querySelector('#ob-name').value.trim()  || 'Friend';
          _onboardingData.role       = body.querySelector('#ob-role').value.trim()  || 'Content creator';
          _onboardingData.brand_name = body.querySelector('#ob-brand').value.trim() || '';
        }
      });
      break;

    case 'audience':
      body.innerHTML = `
        <p class="ob-desc">Describe the people you create for — where they are now, what keeps them stuck.</p>
        <div class="auth-field" style="margin-top:1rem">
          <textarea id="ob-audience" class="auth-input" rows="4"
            placeholder="e.g. Coaches at $0–500k revenue, African SMEs, entrepreneurs building their first real systems. They work hard but haven't figured out what to systematise yet."
            style="resize:vertical;min-height:100px">${_onboardingData.audience}</textarea>
        </div>
      `;
      addObNext(actions, errEl, () => {
        const val = body.querySelector('#ob-audience').value.trim();
        if (!val) return 'Describe who you show up for.';
        _onboardingData.audience = val;
        return null;
      }, wrap, session, {
        skipDefaults: () => {
          _onboardingData.audience = body.querySelector('#ob-audience').value.trim() || 'General professional audience';
        }
      });
      break;

    case 'pillars':
      body.innerHTML = `
        <p class="ob-desc">What topics do you always come back to? Add 4–6 content pillars.</p>
        <div class="ob-chips-wrap" id="ob-pillars-list"></div>
        <div class="ob-pill-input-row">
          <input id="ob-pillar-input" class="auth-input" type="text"
            placeholder="e.g. The Real Bottleneck" maxlength="60">
          <button class="ob-add-btn" id="ob-add-pillar">Add</button>
        </div>
      `;
      const pillarsEl = body.querySelector('#ob-pillars-list');
      function renderPillarChips() {
        pillarsEl.innerHTML = _onboardingData.pillars.map((p, i) => `
          <span class="ob-chip">
            ${p}
            <button class="ob-chip-remove" data-i="${i}" aria-label="Remove">×</button>
          </span>
        `).join('');
        pillarsEl.querySelectorAll('.ob-chip-remove').forEach(b =>
          b.addEventListener('click', () => {
            _onboardingData.pillars.splice(parseInt(b.dataset.i), 1);
            renderPillarChips();
          }));
      }
      renderPillarChips();
      function addPillar() {
        const inp = body.querySelector('#ob-pillar-input');
        const val = inp.value.trim();
        if (!val || _onboardingData.pillars.length >= 6) return;
        if (!_onboardingData.pillars.includes(val)) _onboardingData.pillars.push(val);
        inp.value = '';
        renderPillarChips();
        inp.focus();
      }
      body.querySelector('#ob-add-pillar').addEventListener('click', addPillar);
      body.querySelector('#ob-pillar-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); addPillar(); }
      });
      addObNext(actions, errEl, () => {
        if (_onboardingData.pillars.length < 2) return 'Add at least 2 content pillars.';
        return null;
      }, wrap, session, {
        skipDefaults: () => {
          if (_onboardingData.pillars.length < 2) {
            _onboardingData.pillars = ['Lessons Learned', 'Behind the Work', 'Industry Insight'];
          }
        }
      });
      break;

    case 'voice':
      body.innerHTML = `
        <p class="ob-desc">Pick the words that fit how you naturally sound. Choose as many as feel true.</p>
        <div class="ob-descriptor-grid">
          ${VOICE_DESCRIPTOR_OPTIONS.map(d => `
            <button class="ob-descriptor ${_onboardingData.voice_descriptors.includes(d) ? 'selected' : ''}"
              data-d="${d}">${d}</button>
          `).join('')}
        </div>
      `;
      body.querySelectorAll('.ob-descriptor').forEach(btn => {
        btn.addEventListener('click', () => {
          const d = btn.dataset.d;
          const idx = _onboardingData.voice_descriptors.indexOf(d);
          if (idx >= 0) { _onboardingData.voice_descriptors.splice(idx, 1); btn.classList.remove('selected'); }
          else          { _onboardingData.voice_descriptors.push(d);         btn.classList.add('selected'); }
        });
      });
      addObNext(actions, errEl, () => {
        if (_onboardingData.voice_descriptors.length < 2) return 'Pick at least 2 voice descriptors.';
        return null;
      }, wrap, session, {
        skipDefaults: () => {
          if (_onboardingData.voice_descriptors.length < 2) {
            _onboardingData.voice_descriptors = ['Direct', 'Grounded'];
          }
        }
      });
      break;

    case 'phrases':
      body.innerHTML = `
        <p class="ob-desc">What are the lines you always say — the ideas you keep coming back to, the phrases your audience repeats back to you? Add 2–5 signature phrases.</p>
        <div class="ob-chips-wrap" id="ob-phrases-list"></div>
        <div class="ob-pill-input-row">
          <input id="ob-phrase-input" class="auth-input" type="text"
            placeholder="e.g. 'You don't have a system, you have a routine'" maxlength="120">
          <button class="ob-add-btn" id="ob-add-phrase">Add</button>
        </div>
        <p class="ob-hint" style="margin-top:0.5rem">These become part of your AI's vocabulary — it'll weave them in naturally.</p>
      `;
      const phrasesEl = body.querySelector('#ob-phrases-list');
      function renderPhraseChips() {
        phrasesEl.innerHTML = _onboardingData.key_phrases.map((p, i) => `
          <span class="ob-chip" style="max-width:100%;white-space:normal;height:auto;padding:0.3rem 0.6rem 0.3rem 0.75rem;">
            "${p}"
            <button class="ob-chip-remove" data-i="${i}" aria-label="Remove">×</button>
          </span>
        `).join('');
        phrasesEl.querySelectorAll('.ob-chip-remove').forEach(b =>
          b.addEventListener('click', () => {
            _onboardingData.key_phrases.splice(parseInt(b.dataset.i), 1);
            renderPhraseChips();
          }));
      }
      renderPhraseChips();
      function addPhrase() {
        const inp = body.querySelector('#ob-phrase-input');
        const val = inp.value.trim();
        if (!val || _onboardingData.key_phrases.length >= 6) return;
        if (!_onboardingData.key_phrases.includes(val)) _onboardingData.key_phrases.push(val);
        inp.value = '';
        renderPhraseChips();
        inp.focus();
      }
      body.querySelector('#ob-add-phrase').addEventListener('click', addPhrase);
      body.querySelector('#ob-phrase-input').addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); addPhrase(); }
      });
      // Allow skipping
      addObNext(actions, errEl, () => null, wrap, session);
      break;

    case 'posts':
      body.innerHTML = `
        <p class="ob-desc">Paste 1–2 posts you've written. This seeds your Voice Library so the AI calibrates to your real voice from day one.</p>
        <div class="auth-field" style="margin-top:0.75rem">
          <label>Post 1</label>
          <textarea id="ob-post1" class="auth-input" rows="5"
            placeholder="Paste your best post here…"
            style="resize:vertical;min-height:120px">${_onboardingData.sample_posts[0] || ''}</textarea>
        </div>
        <div class="auth-field">
          <label>Post 2 <span class="ob-hint">(optional)</span></label>
          <textarea id="ob-post2" class="auth-input" rows="4"
            placeholder="Another one you're proud of…"
            style="resize:vertical;min-height:100px">${_onboardingData.sample_posts[1] || ''}</textarea>
        </div>
      `;
      const finishBtn = document.createElement('button');
      finishBtn.className = 'auth-btn';
      finishBtn.textContent = 'Finish Setup';
      actions.appendChild(finishBtn);
      finishBtn.addEventListener('click', async () => {
        const p1 = body.querySelector('#ob-post1').value.trim();
        const p2 = body.querySelector('#ob-post2').value.trim();
        _onboardingData.sample_posts = [p1, p2].filter(Boolean);
        errEl.style.display = 'none';
        finishBtn.disabled = true; finishBtn.textContent = 'Saving…';
        await finishOnboarding(session, wrap, errEl, finishBtn);
      });
      const discBtn = document.createElement('button');
      discBtn.className = 'auth-link-btn';
      discBtn.textContent = "✦ Not sure of your pillars/voice? Let AI figure it out from this";
      actions.appendChild(discBtn);
      discBtn.addEventListener('click', async () => {
        const p1 = body.querySelector('#ob-post1').value.trim();
        const p2 = body.querySelector('#ob-post2').value.trim();
        if (!p1) { errEl.textContent = 'Paste at least one post first.'; errEl.style.display = 'block'; return; }
        errEl.style.display = 'none';
        discBtn.disabled = true; discBtn.textContent = 'Analyzing your voice…';
        try {
          const raw = await callAI(
            `Analyze this writing and return ONLY raw JSON (no markdown, no prose) with this exact shape:
{"pillars":["...","...","...","..."],"voice_descriptors":["...","...","..."],"key_phrases":["...","..."],
"persona_line":"2-3 sentences describing how this person thinks/writes, grounded in specifics from the text.",
"audience":"one sentence: who this person's ideal reader/client is, inferred from the text",
"positioning_statement":"one sentence: a sharp, specific positioning statement for this person, not generic",
"bio_short":"one sentence bio, third person",
"bio_medium":"2-3 sentence bio, third person"}
Pillars = 3-4 recurring content themes. voice_descriptors = single adjectives. key_phrases = real recurring phrases/lines from the text itself, verbatim if possible. Base everything strictly on what's actually in the text — no invented facts, employers, or achievements not present.

TEXT:\n${p1}\n\n${p2}`,
            'You extract structured brand-voice and positioning data from writing samples. Output raw JSON only, nothing else.'
          );
          const parsed = JSON.parse(raw.trim().replace(/^```json\s*|\s*```$/g, ''));
          _onboardingData.pillars           = parsed.pillars || _onboardingData.pillars;
          _onboardingData.voice_descriptors = parsed.voice_descriptors || _onboardingData.voice_descriptors;
          _onboardingData.key_phrases       = parsed.key_phrases || _onboardingData.key_phrases;
          _onboardingData.sample_posts      = [p1, p2].filter(Boolean);
          _onboardingData._discoveredPersona = parsed.persona_line || '';
          if (!_onboardingData.audience && parsed.audience) _onboardingData.audience = parsed.audience;
          _onboardingData._discoveredPositioning = parsed.positioning_statement || '';
          _onboardingData._discoveredBioShort    = parsed.bio_short  || '';
          _onboardingData._discoveredBioMedium   = parsed.bio_medium || '';
          errEl.style.display = 'none';
          finishBtn.disabled = true; finishBtn.textContent = 'Saving…';
          await finishOnboarding(session, wrap, errEl, finishBtn);
        } catch (e) {
          discBtn.disabled = false; discBtn.textContent = "✦ Not sure of your pillars/voice? Let AI figure it out from this";
          errEl.textContent = 'Could not analyze — try Finish Setup instead.';
          errEl.style.display = 'block';
        }
      });
      const skipPostBtn = document.createElement('button');
      skipPostBtn.className = 'auth-link-btn';
      skipPostBtn.textContent = 'Skip for now';
      actions.appendChild(skipPostBtn);
      skipPostBtn.addEventListener('click', async () => {
        errEl.style.display = 'none';
        skipPostBtn.disabled = true; finishBtn.disabled = true;
        finishBtn.textContent = 'Saving…';
        await finishOnboarding(session, wrap, errEl, finishBtn);
      });
      const backPostBtn = document.createElement('button');
      backPostBtn.className = 'auth-link-btn ob-back-btn';
      backPostBtn.textContent = '← Back';
      actions.appendChild(backPostBtn);
      backPostBtn.addEventListener('click', () => {
        _onboardingStep--;
        saveOnboardingDraft();
        renderOnboardingStep(wrap, session);
      });
      break;

    case 'done':
      body.innerHTML = `
        <p class="ob-done-name">Welcome, ${escHtml(_onboardingData.name.split(' ')[0])}.</p>
        <p class="ob-done-line" id="ob-welcome-line">Your brand OS is live. Everything from here is yours alone.</p>
        <div class="ob-done-pillars">
          ${_onboardingData.pillars.map(p => `<span class="ob-chip ob-chip--done">${escHtml(p)}</span>`).join('')}
        </div>
        ${_onboardingData.key_phrases.length ? `<p class="ob-hint" style="margin-top:1rem;text-align:center">+${_onboardingData.key_phrases.length} key phrase${_onboardingData.key_phrases.length > 1 ? 's' : ''} locked in</p>` : ''}
        <div class="ob-first-post" id="ob-first-post">
          <p class="ob-first-post-label">${icon('sparkles',13)} Here's what a real post looks like, in your voice</p>
          <div class="ob-first-post-body" id="ob-first-post-body"><div class="ob-first-post-loading">${ckShimmer ? ckShimmer(3) : 'Writing your first post…'}</div></div>
        </div>
      `;
      // Personalized AI welcome — replaces the generic line once it
      // arrives; the generic line stays visible in the meantime so there's
      // no loading flicker/blank state.
      fetchPersonalizedWelcome({
        name: _onboardingData.name,
        role: _onboardingData.role,
        pillars: _onboardingData.pillars
      }).then(text => {
        if (text) {
          const lineEl = wrap.querySelector('#ob-welcome-line');
          if (lineEl) lineEl.textContent = text;
        }
      });
      // ── The actual "aha" moment: a real, usable post generated straight
      // from what they just told us — not a demo, the real engine, so this
      // is exactly what every post from here on will look like. ───────────
      (async () => {
        const topic = `An honest first post introducing ${_onboardingData.name.split(' ')[0]} — ${_onboardingData.role || 'their work'} — to a new audience, centred on the "${_onboardingData.pillars[0] || 'their expertise'}" pillar.`;
        const res = await callAI(`Task: Write a short, real LinkedIn post.\nTopic: ${topic}\nKeep it under 120 words. This is their very first post — make it feel like a genuine hello, not a sales pitch.`);
        const target = wrap.querySelector('#ob-first-post-body');
        if (!target) return; // user already moved on
        if (res) {
          target.innerHTML = `<p class="ob-first-post-text">${escHtml(res).replace(/\n/g,'<br>')}</p>
            <div class="ob-first-post-actions">
              <button class="btn btn-outline btn-sm" id="ob-copy-post">${icon('copy',13)} Copy</button>
            </div>`;
          target.querySelector('#ob-copy-post')?.addEventListener('click', function(){ copyText(res, this); });
        } else {
          target.innerHTML = `<p class="ob-hint">Your first post idea will be waiting on your dashboard.</p>`;
        }
      })();
      const enterBtn = document.createElement('button');
      enterBtn.className = 'auth-btn';
      enterBtn.textContent = 'Enter Brand OS';
      actions.appendChild(enterBtn);
      enterBtn.addEventListener('click', () => {
        document.getElementById('auth-gate').style.display = 'none';
        bootApp();
      });
      break;
  }
}

function addObNext(actions, errEl, validate, wrap, session, opts = {}) {
  const { skipDefaults = null } = opts; // function that fills in sensible defaults when skipped

  const row = document.createElement('div');
  row.className = 'ob-actions-row';
  row.style.cssText = 'display:flex;flex-direction:column;gap:0.6rem;width:100%';

  const btn = document.createElement('button');
  btn.className = 'auth-btn';
  btn.textContent = 'Continue';
  row.appendChild(btn);

  const linksRow = document.createElement('div');
  linksRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:0.75rem';

  // Back — every step except the very first can revisit the previous one
  if (_onboardingStep > 0) {
    const backBtn = document.createElement('button');
    backBtn.className = 'auth-link-btn ob-back-btn';
    backBtn.textContent = '← Back';
    backBtn.addEventListener('click', () => {
      _onboardingStep--;
      saveOnboardingDraft();
      renderOnboardingStep(wrap, session);
    });
    linksRow.appendChild(backBtn);
  } else {
    linksRow.appendChild(document.createElement('span')); // keeps Skip right-aligned
  }

  // Skip — every step is skippable; sensible defaults fill in anything left blank
  const skipBtn = document.createElement('button');
  skipBtn.className = 'auth-link-btn ob-skip-btn';
  skipBtn.textContent = 'Skip this step';
  skipBtn.addEventListener('click', () => {
    errEl.style.display = 'none';
    if (skipDefaults) skipDefaults();
    _onboardingStep++;
    saveOnboardingDraft();
    renderOnboardingStep(wrap, session);
  });
  linksRow.appendChild(skipBtn);

  row.appendChild(linksRow);
  actions.appendChild(row);

  btn.addEventListener('click', () => {
    errEl.style.display = 'none';
    const err = validate();
    if (err) { errEl.textContent = err; errEl.style.display = 'block'; return; }
    _onboardingStep++;
    saveOnboardingDraft();
    renderOnboardingStep(wrap, session);
  });
}

async function finishOnboarding(session, wrap, errEl, btn) {
  try {
    await upsertProfile(session.user.id, {
      name:              _onboardingData.name,
      role:              _onboardingData.role,
      brand_name:        _onboardingData.brand_name,
      audience:          _onboardingData.audience,
      pillars:           _onboardingData.pillars,
      voice_descriptors: _onboardingData.voice_descriptors,
      key_phrases:       _onboardingData.key_phrases,
      voice_posts:       _onboardingData.sample_posts,
      onboarded:         true,
      ...(_onboardingData._discoveredBioShort  ? { bio_short:  _onboardingData._discoveredBioShort }  : {}),
      ...(_onboardingData._discoveredBioMedium ? { bio_medium: _onboardingData._discoveredBioMedium } : {}),
      ...((_onboardingData._discoveredPersona || _onboardingData._discoveredPositioning) ? { brand_extra: {
        ...(_onboardingData._discoveredPersona     ? { persona_line: _onboardingData._discoveredPersona } : {}),
        ...(_onboardingData._discoveredPositioning ? { positioning_statement: _onboardingData._discoveredPositioning } : {})
      } } : {})
    });

    if (_onboardingData.sample_posts.length) {
      STATE.voiceLibrary = _onboardingData.sample_posts.map(text => ({
        text, pillar: _onboardingData.pillars[0] || 'General', channel: 'LinkedIn Post',
        addedAt: Date.now()
      }));
    }

    // Re-fetch the real row rather than hand-rolling STATE.user.profile from
    // _onboardingData — the DB row is the source of truth (is_admin,
    // brand_extra merge, id, created_at, etc.), and drifting from it caused
    // subtle bugs (e.g. admin flag missing) right after first onboarding.
    const freshProfile = await fetchProfile(session.user.id);
    STATE.user = { ...STATE.user, profile: freshProfile || { ..._onboardingData, onboarded: true } };
    clearOnboardingDraft(session.user.id);

    _onboardingStep = ONBOARDING_STEPS.findIndex(s => s.id === 'done');
    renderOnboardingStep(wrap, session);
  } catch (e) {
    btn.disabled = false; btn.textContent = 'Finish Setup';
    errEl.textContent = 'Could not save your profile — ' + (e && (e.message || e.details || e.hint) || 'please try again.');
    errEl.style.display = 'block';
    console.error('[Brand OS] finishOnboarding error:', e);
  }
}
