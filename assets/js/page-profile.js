// ── PAGE: PROFILE SETTINGS ─────────────────────────────────────────────────
// Edit everything about your brand identity — all changes sync to Supabase.

// ── BRAND DEPTH SCORE (#14) ─────────────────────────────────────────────────
// A simple, honest 0–100 read on how much the AI actually knows about this
// person's voice — makes the "it gets better the more you use it" promise
// visible instead of invisible. Purely derived from data that already
// exists; no new database fields needed.
function computeBrandDepth(profile) {
  profile = profile || getUserProfile() || {};
  let score = 0;
  const has = v => Array.isArray(v) ? v.length > 0 : !!(v && String(v).trim());

  if (has(profile.pillars))            score += 20;
  if (has(profile.voice_descriptors))   score += 15;
  if (has(profile.key_phrases))         score += 15;
  if (has(profile.brand_extra?.regional_context)) score += 10;
  if (STATE.signature)                  score += 20;

  const voiceCount = (STATE.voiceLibrary || []).length;
  score += voiceCount >= 3 ? 20 : Math.round((voiceCount / 3) * 20);

  return Math.min(100, score);
}

function renderProfile() {
  const profile = getUserProfile() || {};
  const el = document.createElement('div');
  el.className = 'space-y-6';

  // Build voice descriptor list HTML
  const VOICE_OPTS = [
    'Direct','Confessional','Prophetic','Practical','Aphoristic',
    'Conversational','Authoritative','Warm','Challenging','Storytelling',
    'Data-driven','Inspirational','Contrarian','Mentoring','Visionary',
    'Humble','Sharp','Poetic','Bold','Grounded'
  ];

  const currentVoice   = profile.voice_descriptors || [];
  const currentPillars = profile.pillars            || [];
  const currentPhrases = profile.key_phrases        || [];

  const brandDepth = computeBrandDepth(profile);
  const depthLabel = brandDepth >= 80 ? "The AI knows your voice well" : brandDepth >= 40 ? "Getting there — a bit more will help" : "Just starting — the AI is still learning your voice";

  el.innerHTML = `
    <div class="page-heading">
      <h1>My Profile</h1>
      <p>This is what the AI uses to sound like you.</p>
    </div>

    <!-- BRAND DEPTH -->
    <div class="card brand-depth-card">
      <div class="brand-depth-head">
        <span class="brand-depth-label">Brand Depth</span>
        <span class="brand-depth-pct">${brandDepth}%</span>
      </div>
      <div class="brand-depth-bar"><div class="brand-depth-fill" style="width:${brandDepth}%"></div></div>
      <p class="brand-depth-desc">${depthLabel}. The more of this you fill in below, the closer every post sounds to you.</p>
    </div>

    <!-- TRUST / PRIVACY NOTE -->
    <details class="privacy-note">
      <summary>${icon('shield',14)} What we store, and who can see it</summary>
      <div class="privacy-note-body">
        <p>Everything below — your pillars, voice, key phrases, Big Idea, and every post you write or save — is stored under your own account only. Nobody else using Brand OS can read it, and it's never used to write posts for anyone but you.</p>
        <p>An admin can see account-level details (your email, whether you're on Pro, how many AI generations you've used) to help run the app and fix problems — but not your actual writing, pillars, or Big Idea.</p>
        <p>Shared AI provider keys live only on the server — they're never sent to your browser or any other user.</p>
      </div>
    </details>

    <!-- IDENTITY -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">Identity</div>
        <div class="card-desc">Who you are and who you're talking to.</div>
      </div>
      <div class="space-y-4">
        <div>
          <label>Full Name</label>
          <input class="input mt-1" id="pr-name" value="${escHtml(profile.name||'')}" placeholder="Your full name">
        </div>
        <div>
          <label>What you do <span class="text-muted text-xs">(one line — this is how the AI describes your job)</span></label>
          <input class="input mt-1" id="pr-role" value="${escHtml(profile.role||'')}" placeholder="e.g. Business coach &amp; systems consultant">
        </div>
        <div>
          <label>Brand name or handle <span class="text-muted text-xs">(optional)</span></label>
          <input class="input mt-1" id="pr-brand" value="${escHtml(profile.brand_name||'')}" placeholder="e.g. #TheSystemsCoach">
        </div>
        <div>
          <label>Your Audience</label>
          <textarea class="textarea mt-1" id="pr-audience" rows="3" placeholder="Describe who you create for — where they are, what keeps them stuck.">${escHtml(profile.audience||'')}</textarea>
        </div>
      </div>
    </div>

    <!-- CONTENT PILLARS -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">Content Pillars</div>
        <div class="card-desc">The 4 to 6 topics you always talk about.</div>
      </div>
      <div class="ob-chips-wrap" id="pr-pillars-list"></div>
      <div class="ob-pill-input-row" style="margin-top:0.75rem">
        <input id="pr-pillar-input" class="input" type="text" placeholder="Add a pillar…" maxlength="60">
        <button class="btn btn-primary btn-sm" id="pr-add-pillar">Add</button>
      </div>
    </div>

    <!-- VOICE -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">Voice Descriptors</div>
        <div class="card-desc">The words that describe how you naturally sound.</div>
      </div>
      <div class="ob-descriptor-grid" id="pr-voice-grid">
        ${VOICE_OPTS.map(d => `
          <button class="ob-descriptor ${currentVoice.includes(d)?'selected':''}" data-d="${d}">${d}</button>
        `).join('')}
      </div>
    </div>

    <!-- KEY PHRASES -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">Signature Key Phrases</div>
        <div class="card-desc">Things you often say. The AI uses these in your posts too.</div>
      </div>
      <div class="ob-chips-wrap" id="pr-phrases-list"></div>
      <div class="ob-pill-input-row" style="margin-top:0.75rem">
        <input id="pr-phrase-input" class="input" type="text" placeholder="Add a phrase…" maxlength="120">
        <button class="btn btn-primary btn-sm" id="pr-add-phrase">Add</button>
      </div>
    </div>

    <!-- BIOS -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">Bios</div>
        <div class="card-desc">Used on the Positioning page. Leave this blank and we'll write it for you using what's above.</div>
      </div>
      <div class="space-y-4">
        <div>
          <label>Short Bio <span class="text-muted text-xs">(1–2 sentences — social media, email footer)</span></label>
          <textarea class="textarea mt-1" id="pr-bio-short" rows="2" placeholder="Auto-generated if left blank">${escHtml(profile.bio_short||'')}</textarea>
        </div>
        <div>
          <label>Medium Bio <span class="text-muted text-xs">(speaking intro, podcast guest)</span></label>
          <textarea class="textarea mt-1" id="pr-bio-medium" rows="3" placeholder="Auto-generated if left blank">${escHtml(profile.bio_medium||'')}</textarea>
        </div>
        <div>
          <label>Long Bio <span class="text-muted text-xs">(about page, press kit)</span></label>
          <textarea class="textarea mt-1" id="pr-bio-long" rows="5" placeholder="Auto-generated if left blank">${escHtml(profile.bio_long||'')}</textarea>
        </div>
      </div>
    </div>

    <!-- SAVE -->
    <div style="display:flex;gap:1rem;align-items:center">
      <button id="pr-save-btn" class="btn btn-primary">Save Profile</button>
      <span id="pr-save-status" style="font-size:0.8rem;color:var(--text-muted)"></span>
    </div>

    <!-- REGIONAL CONTEXT -->
    <div class="card" style="margin-top:1.5rem">
      <div class="card-header">
        <div class="card-title">Your Local Details</div>
        <div class="card-desc">Optional. Tell it about your country or area — money, local words, things people there understand. It'll use this in your posts.</div>
      </div>
      <textarea class="textarea mt-1" id="pr-regional" rows="3"
        placeholder="e.g. Nigerian/West African business context — ₦ Naira, WAT, local realities like network/power downtime, Nigerian English phrasing where it fits naturally"
      >${escHtml(profile.brand_extra?.regional_context || '')}</textarea>
      <button id="pr-save-regional-btn" class="btn btn-secondary btn-sm" style="margin-top:0.75rem">Save</button>
      <span id="pr-regional-status" style="font-size:0.8rem;color:var(--text-muted);margin-left:0.5rem"></span>
    </div>

    ${profile.is_admin ? `
    <!-- ADMIN PANEL (admins only) -->
    <div class="card" style="margin-top:1.5rem;border:1px solid rgba(201,168,76,0.4)">
      <div class="card-header">
        <div class="card-title">Admin Panel</div>
        <div class="card-desc">See your users, manage keys, and check usage.</div>
      </div>
      <button id="pr-admin-btn" class="btn btn-primary btn-sm">Open Admin Panel →</button>
    </div>
    ` : ''}

    <!-- SIGN OUT -->
    <div style="margin-top:2rem;padding-top:1.5rem;border-top:1px solid var(--border-color,rgba(255,255,255,0.1))">
      <button id="pr-signout-btn" class="btn btn-secondary" style="color:#e05252;border-color:#e05252">Sign Out</button>
    </div>
  `;

  // ── Admin Panel link (admins only) ───────────────────────────────────────
  el.querySelector('#pr-admin-btn')?.addEventListener('click', () => navigate('admin'));

  // ── Pillars ──────────────────────────────────────────────────────────────
  let editPillars = [...currentPillars];
  const pillarsEl = el.querySelector('#pr-pillars-list');

  function renderPillarChips() {
    pillarsEl.innerHTML = editPillars.map((p, i) => `
      <span class="ob-chip">
        ${escHtml(p)}
        <button class="ob-chip-remove" data-i="${i}" aria-label="Remove">×</button>
      </span>`).join('');
    pillarsEl.querySelectorAll('.ob-chip-remove').forEach(b =>
      b.addEventListener('click', () => { editPillars.splice(parseInt(b.dataset.i), 1); renderPillarChips(); }));
  }
  renderPillarChips();

  function addPillar() {
    const inp = el.querySelector('#pr-pillar-input');
    const val = inp.value.trim();
    if (!val || editPillars.length >= 6) return;
    if (!editPillars.includes(val)) editPillars.push(val);
    inp.value = ''; renderPillarChips(); inp.focus();
  }
  el.querySelector('#pr-add-pillar').addEventListener('click', addPillar);
  el.querySelector('#pr-pillar-input').addEventListener('keydown', e => { if(e.key==='Enter') { e.preventDefault(); addPillar(); } });

  // ── Voice ────────────────────────────────────────────────────────────────
  let editVoice = [...currentVoice];
  el.querySelector('#pr-voice-grid').querySelectorAll('.ob-descriptor').forEach(btn => {
    btn.addEventListener('click', () => {
      const d = btn.dataset.d;
      const idx = editVoice.indexOf(d);
      if (idx >= 0) { editVoice.splice(idx, 1); btn.classList.remove('selected'); }
      else          { editVoice.push(d);          btn.classList.add('selected'); }
    });
  });

  // ── Key Phrases ──────────────────────────────────────────────────────────
  let editPhrases = [...currentPhrases];
  const phrasesEl = el.querySelector('#pr-phrases-list');

  function renderPhraseChips() {
    phrasesEl.innerHTML = editPhrases.map((p, i) => `
      <span class="ob-chip" style="max-width:100%;white-space:normal;height:auto;padding:0.3rem 0.6rem 0.3rem 0.75rem;">
        "${escHtml(p)}"
        <button class="ob-chip-remove" data-i="${i}" aria-label="Remove">×</button>
      </span>`).join('');
    phrasesEl.querySelectorAll('.ob-chip-remove').forEach(b =>
      b.addEventListener('click', () => { editPhrases.splice(parseInt(b.dataset.i), 1); renderPhraseChips(); }));
  }
  renderPhraseChips();

  function addPhrase() {
    const inp = el.querySelector('#pr-phrase-input');
    const val = inp.value.trim();
    if (!val || editPhrases.length >= 8) return;
    if (!editPhrases.includes(val)) editPhrases.push(val);
    inp.value = ''; renderPhraseChips(); inp.focus();
  }
  el.querySelector('#pr-add-phrase').addEventListener('click', addPhrase);
  el.querySelector('#pr-phrase-input').addEventListener('keydown', e => { if(e.key==='Enter') { e.preventDefault(); addPhrase(); } });

  // ── Save ─────────────────────────────────────────────────────────────────
  el.querySelector('#pr-save-btn').addEventListener('click', async () => {
    const btn    = el.querySelector('#pr-save-btn');
    const status = el.querySelector('#pr-save-status');
    const name   = el.querySelector('#pr-name').value.trim();
    const role   = el.querySelector('#pr-role').value.trim();
    if (!name) { status.textContent = 'Name is required.'; status.style.color = 'var(--danger)'; return; }
    if (!role) { status.textContent = 'Role is required.'; status.style.color = 'var(--danger)'; return; }

    btn.disabled = true; btn.textContent = 'Saving…'; status.textContent = '';

    const updates = {
      name,
      role,
      brand_name:        el.querySelector('#pr-brand').value.trim(),
      audience:          el.querySelector('#pr-audience').value.trim(),
      pillars:           editPillars,
      voice_descriptors: editVoice,
      key_phrases:       editPhrases,
      bio_short:         el.querySelector('#pr-bio-short').value.trim(),
      bio_medium:        el.querySelector('#pr-bio-medium').value.trim(),
      bio_long:          el.querySelector('#pr-bio-long').value.trim()
    };

    try {
      await upsertProfile(STATE.user.session.user.id, updates);

      // Update STATE immediately so prompts use new data right away
      STATE.user.profile = { ...STATE.user.profile, ...updates };

      // Refresh CONTENT_PILLARS
      if (editPillars.length) {
        CONTENT_PILLARS.length = 0;
        editPillars.forEach(p => CONTENT_PILLARS.push(p));
      }

      // Update sidebar display name
      const nameEl = document.getElementById('sidebar-user-name');
      if (nameEl) nameEl.textContent = name;
      const avatarEl = document.getElementById('sidebar-avatar');
      if (avatarEl) avatarEl.textContent = name.charAt(0).toUpperCase();

      btn.disabled = false; btn.textContent = 'Save Profile';
      status.textContent = 'Saved ✓'; status.style.color = 'var(--success,#22c55e)';
      setTimeout(() => { status.textContent = ''; }, 3000);
    } catch(e) {
      btn.disabled = false; btn.textContent = 'Save Profile';
      status.textContent = 'Failed to save. Try again.'; status.style.color = 'var(--danger)';
      console.error('[Brand OS] Profile save error:', e);
    }
  });

  // ── Regional Context ─────────────────────────────────────────────────────
  el.querySelector('#pr-save-regional-btn').addEventListener('click', async () => {
    const btn    = el.querySelector('#pr-save-regional-btn');
    const status = el.querySelector('#pr-regional-status');
    const value  = el.querySelector('#pr-regional').value.trim();
    btn.disabled = true; status.textContent = 'Saving…'; status.style.color = 'var(--text-muted)';
    try {
      const mergedExtra = { ...(profile.brand_extra || {}), regional_context: value };
      await upsertProfile(STATE.user.session.user.id, { brand_extra: mergedExtra });
      STATE.user.profile = { ...STATE.user.profile, brand_extra: mergedExtra };
      applyUserBrandConfig(STATE.user.profile); // refresh CONTENT_PILLARS / voiceLibrary from the updated profile
      status.textContent = 'Saved ✓'; status.style.color = 'var(--success,#22c55e)';
    } catch (e) {
      status.textContent = 'Failed to save.'; status.style.color = 'var(--danger)';
      console.error('[Brand OS] Regional context save error:', e);
    }
    btn.disabled = false;
    setTimeout(() => { status.textContent = ''; }, 3000);
  });

  // ── Sign Out ─────────────────────────────────────────────────────────────
  el.querySelector('#pr-signout-btn').addEventListener('click', () => {
    confirmSignOut(el.querySelector('#pr-signout-btn'));
  });

  // ── Intelligence & Alerts (moved here from the removed Engine Room) ─────
  el.appendChild(renderNotificationSettings());

  return el;
}

// ── Helper: escape HTML for safe attribute/innerHTML injection ──────────────
function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
