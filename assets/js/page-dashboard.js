// ── PAGE: DASHBOARD (COCKPIT) ──────────────────────────────────────────────
// One screen that shows the state of the brand today: what's live, what's due,
// what to say, and who you are — no hunting through menus.
//
// REDESIGNED: this used to be four separate blocks (Today's Brief, a
// "Breaking angle" card, "Your plan for today", and "What to post next →
// Suggest 4") all independently answering the same underlying question —
// "what should I post today?" — each with its own button. That handed the
// user four decisions before they'd written a single word. Now it's one
// hero card that merges the schedule fact + the AI's reasoning + any
// breaking news angle, with exactly one obvious action. "Suggest 4" is
// still here for when someone wants other options, but it's a small,
// clearly secondary link underneath — not a rival section.

function renderDashboard() {
  const el = document.createElement('div');
  el.className = 'ck';

  // ── live state ───────────────────────────────────────────────────────────
  // AI availability is now decided entirely server-side (shared keys live
  // in ai-proxy.php's config/keys-store.php) — STATE.aiAvailable is just a
  // boolean set once at boot by fetchAiStatus(), never a key value.
  const hasKey     = STATE.aiAvailable !== false;

  const todayISO   = new Date().toISOString().split('T')[0];
  const now        = new Date();
  const dayName    = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][now.getDay()];
  const dateLong   = now.toLocaleDateString('en-GB',{ day:'numeric', month:'long' });
  const hour       = now.getHours();
  const greeting   = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName  = escHtml((((getUserProfile ? getUserProfile()?.name : null) || 'there').split(' ')[0]));

  const posts      = STATE.publish?.posts || [];
  const draftCount = (STATE.publish?.drafts||[]).length + posts.filter(p=>p.status==='draft').length;
  const todaySlot  = (STATE.publish?.schedule||[]).find(s => s.day===dayName && s.active && s.type!=='Off');
  const postTime   = todaySlot ? (STATE.intel?.postTimes?.[dayName] || '09:00') : null;
  const postedToday= posts.some(p => p.date===todayISO && p.status==='posted');

  const alertsOn   = !!(STATE.intel && STATE.intel.enabled);
  const notifGranted = ('Notification' in window) && Notification.permission === 'granted';

  const streak = computeStreak();

  // ── First-week setup nudge (#9) — Voice Library and the Big Idea are the
  // actual differentiator vs. a generic chatbot, but they're easy to never
  // discover since they're a level deep in Studio. For the first 7 days,
  // a slim strip (not a competing card) points new users at whichever one
  // they haven't done yet — dismissible per-session, reappears next visit
  // until it's actually done or the week is up.
  const accountCreated  = getUserProfile()?.created_at ? new Date(getUserProfile().created_at) : null;
  const accountAgeDays  = accountCreated ? Math.floor((Date.now() - accountCreated.getTime()) / 86400000) : 99;
  const isFirstWeek     = accountAgeDays <= 7;
  const hasVoiceSamples = (STATE.voiceLibrary || []).length >= 3;
  const hasBigIdea      = !!STATE.signature;
  const setupNudgeDismissedThisSession = sessionStorage.getItem('brandos_setup_nudge_dismissed') === '1';
  const showSetupNudge  = isFirstWeek && (!hasVoiceSamples || !hasBigIdea) && !setupNudgeDismissedThisSession;
  const setupNudgeText  = !hasVoiceSamples
    ? "Add 3 real posts so the AI actually sounds like you"
    : "Find your Big Idea — the thing that makes your brand memorable";
  const setupNudgeJump  = !hasVoiceSamples ? 'voice-library' : 'positioning';

  const cachedBrief = (STATE.intel && STATE.intel.dailyBriefDate === todayISO && STATE.intel.dailyBriefSig === briefFreshnessSignature())
    ? STATE.intel.dailyBrief : null;

  // Breaking angle — a fresh (<12h) news-triggered idea takes over the hero
  // instead of appearing as a separate, competing card above it.
  const pendingAngle = STATE.intel && STATE.intel.pendingNewsAngle;
  const angleFresh = !!(pendingAngle && (Date.now() - new Date(pendingAngle.ts).getTime() < 12 * 60 * 60 * 1000));

  // The exact idea text that "Write it" will hand off to Create — updated
  // once the brief finishes loading (see the .then() below) if there's no
  // breaking angle taking priority.
  let heroIdeaText = angleFresh ? pendingAngle.angle : '';

  // ── 1 · COCKPIT HEADER + STATUS STRIP ────────────────────────────────────
  el.innerHTML = `
    ${showSetupNudge ? `
    <div class="ck-setup-nudge" id="setup-nudge">
      <span>${icon('sparkles',13)} ${setupNudgeText}</span>
      <div class="ck-setup-nudge-actions">
        <button class="ck-setup-nudge-cta" data-jump="${setupNudgeJump}">Do it now →</button>
        <button class="ck-setup-nudge-dismiss" id="dismiss-setup-nudge" aria-label="Dismiss">${icon('x',12)}</button>
      </div>
    </div>` : ''}
    <header class="ck-top">
      <div>
        <p class="ck-eyebrow">${dayName} · ${dateLong}</p>
        <h1 class="ck-hello">${greeting}, ${firstName}.</h1>
      </div>
      <div class="ck-status" role="group" aria-label="System status">
        ${!hasKey ? `<span class="ck-stat ck-stat--alert" title="AI engine not configured">
          <span class="ck-dot ck-dot--down"></span>
          AI engine unavailable
        </span>` : ''}
        ${streak.current > 0 ? `<span class="ck-stat ck-stat--streak" title="${streak.freezesAvailable > 0 ? 'You have a free streak-saver this month if you miss a day' : 'Post today to keep this streak'}">
          🔥 ${streak.current} day${streak.current===1?'':'s'}
        </span>` : ''}
        <button class="ck-stat" data-jump="profile" title="Alerts">
          ${icon('zap', 12)} Alerts ${alertsOn ? (notifGranted?'on':'pending') : 'off'}
        </button>
        <button class="ck-stat" data-jump="publish" title="Drafts waiting">
          ${icon('draft',12)} ${draftCount} draft${draftCount===1?'':'s'}
        </button>
      </div>
    </header>

    <!-- 2 · ONE HERO — schedule + reasoning + breaking angle, merged -->
    <section class="ck-hero" aria-live="polite">
      <div class="ck-hero-head">
        <div class="ck-hero-kicker">
          ${angleFresh
            ? `${icon('zap',13)} Trending now`
            : postedToday
              ? `${icon('sparkles',13)} Today's idea`
              : hour >= 17
                ? `${icon('sparkles',13)} Quick win before today ends`
                : hour >= 12
                  ? `${icon('sparkles',13)} Still time today`
                  : `${icon('sparkles',13)} Today's idea`}
        </div>
        ${angleFresh
          ? `<button id="dismiss-angle" class="ck-icon-btn" title="Dismiss" aria-label="Dismiss">${icon('x',13)}</button>`
          : `<button id="brief-refresh" class="ck-icon-btn" title="Get a new idea" aria-label="Refresh"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg></button>`}
      </div>

      <div class="ck-hero-lead">${todaySlot ? todaySlot.type : 'No post scheduled today'}</div>
      <div class="ck-hero-meta">
        ${todaySlot
          ? `${todaySlot.platform} · due ${postTime} ${postedToday ? '<span class="ck-pill ck-pill--ok">Posted</span>' : '<span class="ck-pill ck-pill--wait">Not yet</span>'}`
          : `Only post if you've got something real to say — here's an idea if you want one.`}
      </div>
      ${streak.atRisk ? `<div class="ck-hero-streak-warn">🔥 Don't lose your ${streak.current}-day streak — post today${streak.freezesAvailable > 0 ? ' (or you have one free save this month)' : ''}.</div>` : ''}

      <div class="ck-hero-body" id="hero-body">
        ${angleFresh
          ? `<p class="ck-hero-headline">${pendingAngle.headline}</p><p class="ck-hero-text">${pendingAngle.angle}</p>`
          : cachedBrief
            ? renderBriefRows(cachedBrief)
            : hasKey
              ? `<div class="ck-brief-loading">${ckShimmer(3)}</div>`
              : `<p class="ck-empty">AI engine isn't configured yet — check back once your admin sets it up.</p>`}
      </div>

      <button class="ck-cta" id="hero-write-btn">${icon('write',13)} ${(postedToday && !angleFresh) ? 'Write another' : 'Write it'}</button>
    </section>

    <!-- 3 · Quiet, clearly-secondary "show me something else" -->
    <div class="ck-more-ideas">
      <button id="sugg-btn" class="ck-more-ideas-btn" ${!hasKey?'disabled':''}>${icon('sparkles',13)} Want a different idea? <span>Suggest 4</span></button>
    </div>
    <div id="ideas-area"></div>

    <!-- 4 · QUICK JUMP RAIL -->
    <section>
      <div class="ck-rail-label">More tools</div>
      <div class="ck-rail">
        ${[
          ['discover','discover','Discover'],
          ['feedback','feedback','Feedback'],
          ['positioning','position','Positioning'],
          ['offers','offers','Offers']
        ].map(([page,ic,label])=>`
          <button class="ck-rail-item" data-jump="${page}">
            <span class="ck-rail-ic">${icon(ic,18)}</span>${label}
          </button>`).join('')}
      </div>
    </section>
  `;

  // ── wire: jump buttons ───────────────────────────────────────────────────
  el.querySelectorAll('[data-jump]').forEach(b =>
    b.addEventListener('click', () => navigate(b.dataset.jump)));

  // ── wire: dismiss first-week setup nudge (per-session only — it comes
  // back next visit until the person actually completes one of the two) ───
  el.querySelector('#dismiss-setup-nudge')?.addEventListener('click', () => {
    sessionStorage.setItem('brandos_setup_nudge_dismissed', '1');
    el.querySelector('#setup-nudge')?.remove();
  });

  // ── wire: hero write button ──────────────────────────────────────────────
  el.querySelector('#hero-write-btn').addEventListener('click', () => {
    if (angleFresh) { STATE.intel.pendingNewsAngle = null; saveIntelState(); }
    navigate('content', heroIdeaText ? { idea: heroIdeaText } : {});
  });

  // ── wire: dismiss breaking angle → falls back to the routine brief ───────
  el.querySelector('#dismiss-angle')?.addEventListener('click', () => {
    STATE.intel.pendingNewsAngle = null; saveIntelState();
    navigate('dashboard'); // simplest correct redraw — hero's shape depends on angle presence
  });

  // ── wire: daily brief (only present when not showing a breaking angle) ──
  const heroBody     = el.querySelector('#hero-body');
  const briefRefresh = el.querySelector('#brief-refresh');

  briefRefresh?.addEventListener('click', async () => {
    if (!hasKey) { showToast('AI engine is not configured yet — contact your admin', true); return; }
    STATE.intel.dailyBriefDate = null; STATE.intel.dailyBrief = null; saveIntelState();
    heroBody.innerHTML = `<div class="ck-brief-loading">${ckShimmer(3)}</div>`;
    const res = await generateDailyBrief();
    if (res) { heroBody.innerHTML = renderBriefRows(res); heroIdeaText = parseBriefToday(res); }
    else heroBody.innerHTML = '<p class="ck-empty">Could not reach the AI engine right now — try again shortly.</p>';
  });

  if (!angleFresh && hasKey && !cachedBrief) {
    generateDailyBrief().then(res => {
      if (res) { heroBody.innerHTML = renderBriefRows(res); heroIdeaText = parseBriefToday(res); }
    });
  } else if (!angleFresh && cachedBrief) {
    heroIdeaText = parseBriefToday(cachedBrief);
  }

  // ── wire: suggest posts ──────────────────────────────────────────────────
  const suggBtn   = el.querySelector('#sugg-btn');
  const ideasArea = el.querySelector('#ideas-area');

  if (suggBtn) {
    suggBtn.addEventListener('click', async () => {
      setLoading(suggBtn, true, 'Thinking…');
      ideasArea.innerHTML = `<div class="grid-2">${[0,1,2,3].map(()=>`<div class="card">${ckShimmer(3)}</div>`).join('')}</div>`;
      const examples = pickExamples(2);
      const myProfile = getUserProfile();
      const prompt = `Generate exactly 4 specific post ideas for ${myProfile?.name || 'this'}'s brand for the NEXT WEEK.
Content pillars: ${CONTENT_PILLARS.join(', ')}
Voice: ${(myProfile?.voice_descriptors && myProfile.voice_descriptors.length) ? myProfile.voice_descriptors.join(', ').toLowerCase() : 'direct, specific, grounded'}.
Mix: personal story, contrarian take, framework breakdown, short insight.

These are real posts from their library — they set the standard for what a strong idea looks like when executed:

${examples}

---

Use that quality bar as reference. Generate ideas with hooks that feel as alive as those examples — not generic, not templated.

EXACT format (use --- as separator):
**Topic:** [specific subject]
**Hook:** [opening 1-2 sentences in your own voice]
**Pillar:** [which pillar]
**Format:** [LinkedIn story | Short insight | Thread starter | Contrarian take]
**Why Now:** [one sentence why timely]
---`;
      const res = await callAI(prompt);
      setLoading(suggBtn, false);
      if (!res) { ideasArea.innerHTML=''; return; }
      renderIdeas(parsePostIdeas(res), ideasArea);
    });
  }

  return el;
}

// ── Pull just the "TODAY" line out of a brief, for pre-filling Create ──────
function parseBriefToday(text) {
  const m = text.match(/TODAY[:：]\s*([\s\S]*?)(?=\s*(?:🔥|ANGLE|⚠️|WATCH)\s*[:：]|$)/i);
  return m ? m[1].replace(/^[^\w"'(]+/, '').trim() : text.slice(0, 200).trim();
}

// ── Daily Brief: parse "TODAY / ANGLE / WATCH" into instrument rows ────────
function renderBriefRows(text) {
  const grab = (label, stop) => {
    const re = new RegExp(label + '[:：]\\s*([\\s\\S]*?)(?=\\s*(?:' + stop + ')\\s*[:：]|$)', 'i');
    const m = text.match(re);
    return m ? m[1].replace(/^[^\w"'(]+/, '').trim() : '';
  };
  const today = grab('TODAY', '🔥|ANGLE|⚠️|WATCH');
  const angle = grab('ANGLE', '⚠️|WATCH');
  const watch = grab('WATCH', '$^');

  if (today && angle && watch) {
    const row = (tag, cls, body) =>
      `<div class="ck-brief-row ${cls}"><span class="ck-brief-tag">${tag}</span><p>${body}</p></div>`;
    return row('Today','is-today',today) + row('Angle','is-angle',angle) + row('Watch','is-watch',watch);
  }
  // fallback: show raw text, lightly formatted
  const safe = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return `<p class="ck-brief-raw">${safe}</p>`;
}

// ── small shimmer block (n lines) ─────────────────────────────────────────
function ckShimmer(n=3) {
  const w = ['72%','100%','58%','88%','64%'];
  let out = '';
  for (let i=0;i<n;i++) out += `<div class="skeleton ck-shim" style="width:${w[i%w.length]}"></div>`;
  return out;
}

// ── post-idea parsing + rendering (unchanged behaviour) ───────────────────
function parsePostIdeas(text) {
  const blocks = text.split(/---/).map(b=>b.trim()).filter(Boolean);
  return blocks.slice(0,4).map(block => ({
    topic:  (block.match(/\*\*Topic[\s:]+\*?\*?([^\n*]+)/i)||[])[1]?.trim() || block.split('\n')[0].replace(/^\d+\.\s*/,'').trim(),
    hook:   (block.match(/\*\*Hook[\s:]+\*?\*?([^\n*]+)/i)||[])[1]?.trim() || '',
    pillar: (block.match(/\*\*Pillar[\s:]+\*?\*?([^\n*]+)/i)||[])[1]?.trim() || CONTENT_PILLARS[0],
    format: (block.match(/\*\*Format[\s:]+\*?\*?([^\n*]+)/i)||[])[1]?.trim() || 'LinkedIn story',
    why:    (block.match(/\*\*Why Now[\s:]+\*?\*?([^\n*]+)/i)||[])[1]?.trim() || ''
  }));
}

function renderIdeas(ideas, container) {
  container.innerHTML = `<div class="grid-2">${ideas.map(idea => `
    <div class="card idea-card card-hover" data-hook="${encodeURIComponent(idea.hook||idea.topic)}" style="cursor:pointer">
      <div class="flex items-center justify-between gap-2 mb-2">
        <p class="font-semibold text-sm" style="flex:1;line-height:1.4">${idea.topic}</p>
        <span class="arrow shrink-0">${icon('arrow',16)}</span>
      </div>
      ${idea.hook?`<p class="text-xs text-muted italic mb-2" style="overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">"${idea.hook}"</p>`:''}
      <div class="flex gap-1 flex-wrap">
        <span class="badge badge-gold">${idea.pillar}</span>
        ${idea.format?`<span class="badge badge-muted">${idea.format}</span>`:''}
      </div>
      ${idea.why?`<p class="text-xs text-muted mt-2">${idea.why}</p>`:''}
    </div>`).join('')}</div>`;
  container.querySelectorAll('.idea-card').forEach(card => {
    card.addEventListener('click', () => navigate('content', { idea: decodeURIComponent(card.dataset.hook) }));
  });
}
