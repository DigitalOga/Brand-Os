// ── PAGE: VOICE LIBRARY ─────────────────────────────────────────────────────
// Manages the pool of real example posts injected as few-shot context into
// every generation. Free users: up to 5 posts. Pro: unlimited.

const FREE_VOICE_LIMIT = 5;

function renderVoiceLibrary() {
  const el = document.createElement('div');
  el.className = 'space-y-6';

  function getLib() { return STATE.voiceLibrary || []; }

  function saveLib(lib) {
    STATE.voiceLibrary = lib;
    saveState();
    syncVoicePostsToServer(lib);
  }

  // The server-side system prompt (buildSystemPromptFromProfile in
  // ai-proxy.php) is what EVERY generation feature uses — Positioning,
  // Discover, Offers, Feedback, Video Script, Coaching, everything, not
  // just the few pages that build their own client-side examples. It reads
  // profiles.voice_posts. Before this fix, that column was only ever set
  // once, during onboarding, and NEVER updated again — so anything added
  // to the Voice Library after onboarding had zero effect on most of the
  // app, no matter how many real posts someone added. This keeps it live.
  let _voiceSyncTimer = null;
  function syncVoicePostsToServer(lib) {
    clearTimeout(_voiceSyncTimer);
    _voiceSyncTimer = setTimeout(async () => {
      try {
        const userId = STATE.user?.session?.user?.id;
        if (!userId) return;
        // Most recent first (lib is already newest-first), capped to keep
        // the system prompt's token cost reasonable on every single call.
        const topPosts = lib.slice(0, 5).map(p => p.text);
        await upsertProfile(userId, { voice_posts: topPosts });
        if (STATE.user.profile) STATE.user.profile.voice_posts = topPosts;
      } catch (e) {
        console.warn('[Brand OS] Voice Library sync error:', e.message);
        showToast("Saved locally, but couldn't sync to your account — check your connection.", true);
      }
    }, 600);
  }

  function renderCards() {
    const lib = getLib();
    const area = el.querySelector('#vl-cards');
    if (!area) return;

    if (!lib.length) {
      area.innerHTML = `
        <div style="text-align:center;padding:3rem 1rem;color:var(--muted-fg)">
          <div style="font-size:2rem;margin-bottom:0.75rem">📂</div>
          <p style="font-size:0.9rem;font-weight:600;margin-bottom:0.25rem">No posts yet</p>
          <p style="font-size:0.8rem">Paste a post below and tap Add — it immediately enters the generation pool.</p>
        </div>`;
      return;
    }

    area.innerHTML = lib.map((p, i) => `
      <div class="card vl-card" data-i="${i}" style="position:relative;border-left:3px solid var(--accent)">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:0.75rem;margin-bottom:0.6rem">
          <div style="display:flex;flex-wrap:wrap;gap:0.4rem">
            <span class="badge badge-navy" style="font-size:0.65rem">${escHtml(p.pillar||'—')}</span>
            <span class="badge badge-muted" style="font-size:0.65rem">${escHtml(p.channel||'—')}</span>
          </div>
          <button class="vl-remove-btn btn btn-outline btn-sm" data-i="${i}"
            style="flex-shrink:0;color:var(--danger,#ef4444);border-color:var(--danger,#ef4444);padding:0.2rem 0.6rem;font-size:0.7rem">
            Remove
          </button>
        </div>
        <p style="font-size:0.8rem;line-height:1.65;color:var(--muted-fg);white-space:pre-wrap;max-height:160px;overflow:hidden;-webkit-mask-image:linear-gradient(to bottom,black 60%,transparent 100%)">${escHtml(p.text)}</p>
      </div>`).join('');

    area.querySelectorAll('.vl-remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.i, 10);
        const lib = getLib();
        lib.splice(idx, 1);
        saveLib(lib);
        renderCards();
        showToast(`Post removed from Voice Library`);
      });
    });
  }

  const PILLAR_OPTS   = CONTENT_PILLARS.length ? CONTENT_PILLARS : ['Lessons Learned','Behind the Work','Industry Insight','Client Wins','Personal Story'];
  const CHANNEL_OPTS  = ['LinkedIn Post','Instagram','Email','WhatsApp','Video Script','Twitter/X','Other'];

  const lib = getLib();
  const atLimit = !isPro() && lib.length >= FREE_VOICE_LIMIT;

  el.innerHTML = `
    <div class="page-heading">
      <h1>Voice Library</h1>
      <p>Real posts in your own voice — the AI draws from these for every generation.</p>
    </div>

    ${!isPro() ? `
    <div class="free-limit-bar">
      ${icon('sparkles',12)}
      <span><strong>${lib.length} of ${FREE_VOICE_LIMIT}</strong> free posts used.
        ${atLimit ? 'Limit reached — upgrade to add more.' : `${FREE_VOICE_LIMIT - lib.length} remaining.`}
      </span>
      ${atLimit ? `<button class="btn btn-primary btn-sm" style="margin-left:auto;padding:0.2rem 0.75rem;font-size:0.75rem" id="vl-upgrade-btn">Upgrade for unlimited</button>` : ''}
    </div>` : `
    <div class="free-limit-bar" style="background:rgba(201,168,76,0.1);border-color:var(--accent)">
      ${icon('sparkles',12)}
      <span style="color:var(--accent)"><strong>Pro</strong> — unlimited posts in your Voice Library.</span>
    </div>`}

    <div id="vl-cards"></div>

    <div class="card ${atLimit ? 'vl-add-disabled' : ''}">
      <div class="card-header">
        <div class="card-title">Add a Post</div>
        <div class="card-desc">
          ${atLimit
            ? `Free limit reached. <button class="auth-link" id="vl-upgrade-inline">Upgrade to Pro</button> to add unlimited posts.`
            : 'Paste a real post — LinkedIn, email, WhatsApp. The AI will learn your patterns from it.'}
        </div>
      </div>
      ${!atLimit ? `
      <div class="space-y-4">
        <div>
          <label>Post Content</label>
          <textarea class="textarea mt-1" id="vl-post-input" placeholder="Paste a post you've written…" style="min-height:160px"></textarea>
        </div>
        <div class="flex gap-3 flex-wrap">
          <div style="flex:1;min-width:140px">
            <label>Content Pillar</label>
            <select class="select-el mt-1" id="vl-pillar">
              ${PILLAR_OPTS.map(p=>`<option>${p}</option>`).join('')}
            </select>
          </div>
          <div style="flex:1;min-width:140px">
            <label>Channel / Format</label>
            <select class="select-el mt-1" id="vl-channel">
              ${CHANNEL_OPTS.map(c=>`<option>${c}</option>`).join('')}
            </select>
          </div>
        </div>
        <button id="vl-add-btn" class="btn btn-primary" disabled>Add to Library</button>
      </div>` : ''}
    </div>
  `;

  renderCards();

  el.querySelector('#vl-upgrade-btn')?.addEventListener('click', () => navigate('subscription'));
  el.querySelector('#vl-upgrade-inline')?.addEventListener('click', () => navigate('subscription'));

  if (!atLimit) {
    const postInput = el.querySelector('#vl-post-input');
    const addBtn    = el.querySelector('#vl-add-btn');

    postInput.addEventListener('input', () => {
      addBtn.disabled = !postInput.value.trim();
    });

    addBtn.addEventListener('click', () => {
      const text    = postInput.value.trim();
      const pillar  = el.querySelector('#vl-pillar').value;
      const channel = el.querySelector('#vl-channel').value;
      if (!text) return;

      // Re-check limit on add (in case they've added multiple in-session)
      const currentLib = getLib();
      if (!isPro() && currentLib.length >= FREE_VOICE_LIMIT) {
        showToast(`Free limit is ${FREE_VOICE_LIMIT} posts. Upgrade to Pro for unlimited.`, true);
        navigate('voice-library'); // re-render to show limit UI
        return;
      }

      const newLib = [{ text, pillar, channel }, ...currentLib];
      saveLib(newLib);
      postInput.value = '';
      addBtn.disabled = true;
      renderCards();
      showToast('Post added to Voice Library');

      // Re-render if now at limit (to update the UI)
      if (!isPro() && newLib.length >= FREE_VOICE_LIMIT) {
        navigate('voice-library');
      }
    });
  }

  return el;
}
