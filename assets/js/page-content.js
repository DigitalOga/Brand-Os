// ── PAGE: CONTENT ──────────────────────────────────────────────────────────
function renderContent() {
  const S = STATE.content;
  const VS = STATE.publish; // video script fields live here — unchanged location, avoids losing anyone's existing saved video draft
  const el = document.createElement('div');
  el.className = 'space-y-6';
  el.innerHTML = `
    <div class="page-heading">
      <h1>Write &amp; Analyze</h1>
      <p>Write posts that sound just like you.</p>
    </div>
    ${!isPro() ? `
    <div class="free-limit-bar">
      ${icon('sparkles',12)}
      <span>You've used <strong>${getDailyGenCount()} of ${FREE_LIMIT_AI}</strong> free tries today.</span>
      <button class="btn btn-primary btn-sm" style="margin-left:auto;padding:0.2rem 0.75rem;font-size:0.75rem" data-nav="subscription">Upgrade</button>
    </div>` : ''}
    <div class="tabs-list">
      <button class="tab-btn ${S.activeTab==='analyze'?'active':''}" data-tab="analyze">Analyze &amp; Rewrite</button>
      <button class="tab-btn ${S.activeTab==='quick'?'active':''}" data-tab="quick">Quick Post</button>
      <button class="tab-btn ${S.activeTab==='video'?'active':''}" data-tab="video">Video Script</button>
    </div>
    <div id="tab-analyze" class="tab-panel ${S.activeTab==='analyze'?'active':''}">
      <div class="card">
        <div class="card-header"><div class="card-title">Draft Settings</div><div class="card-desc">Fill this in first.</div></div>
        <div class="space-y-5">
          <div><label>Content Type</label><div class="flex flex-wrap gap-2 mt-1">${CONTENT_TYPES.map(t=>`<button class="chip ${S.type===t?'selected':''}" data-type="${t}">${t}</button>`).join('')}</div></div>
          <div><label>Content Pillar</label><div class="flex flex-wrap gap-2 mt-1">${CONTENT_PILLARS.map(p=>`<button class="chip ${S.pillar===p?'selected':''}" data-pillar="${p}">${p}</button>`).join('')}</div></div>
          <div><label>Draft</label><textarea class="textarea mt-1" id="draft-input" placeholder="Paste your rough draft here…" style="min-height:150px">${S.draft}</textarea></div>
          <div><label>Mode</label><div class="flex flex-wrap gap-2 mt-1">${CONTENT_MODES.map(m=>`<button class="chip ${S.mode===m?'selected':''}" data-mode="${m}">${m}</button>`).join('')}</div></div>
          <button id="analyze-btn" class="btn btn-primary" ${!S.draft.trim()?'disabled':''}>Analyze &amp; Improve</button>
        </div>
      </div>
      <div id="analyze-result">${S.analyzeResult?resultBox(S.analyzeResult,'Analysis Result').outerHTML:''}</div>
    </div>
    <div id="tab-quick" class="tab-panel ${S.activeTab==='quick'?'active':''}">
      <div class="card">
        <div class="card-header"><div class="card-title">Quick Generator</div><div class="card-desc">Turn one idea into a full post.</div></div>
        <div class="space-y-5">
          <div>
            <label>Topic, Idea, or Hook</label>
            <input class="input mt-1" id="topic-input" placeholder="e.g. Why most coaches fail to cross $100k…" value="${S.topic}">
            ${S.topic?`<p class="text-xs text-accent mt-1" style="display:flex;align-items:center;gap:4px">${icon('sparkles',12)} Idea loaded — hit Generate to write this post.</p>`:''}
          </div>
          <div><label>Format</label><div class="flex flex-wrap gap-2 mt-1">${CONTENT_FORMATS.map(f=>`<button class="chip ${S.format===f?'selected':''}" data-format="${f}">${f}</button>`).join('')}</div></div>
          <button id="quick-btn" class="btn btn-primary btn-lg" ${!S.topic.trim()?'disabled':''}>Generate Post</button>
        </div>
      </div>
      <div id="quick-result">${S.quickResult?resultBox(S.quickResult,'Generated Post').outerHTML:''}</div>
    </div>
    <div id="tab-video" class="tab-panel ${S.activeTab==='video'?'active':''}">
      <div class="card">
        <div class="card-header"><div class="card-title">Video Script Generator</div><div class="card-desc">A full script — what to say, what to show, and words for the screen.</div></div>
        <div class="space-y-5">
          <div><label>Topic or Idea</label><input class="input mt-1" id="vid-topic" placeholder="e.g. Why African coaches can't scale past ₦500k…" value="${VS.videoTopic}"></div>
          <div><label>Video Style</label><div class="flex flex-wrap gap-2 mt-1">${VIDEO_STYLES.map(v=>`<button class="chip ${VS.videoStyle===v?'selected':''}" data-vstyle="${v}">${v}</button>`).join('')}</div></div>
          <div><label>Content Pillar</label><div class="flex flex-wrap gap-2 mt-1">${CONTENT_PILLARS.map(p=>`<button class="chip ${VS.videoPillar===p?'selected':''}" data-vpillar="${p}">${p}</button>`).join('')}</div></div>
          <div class="grid-2">
            <div><label>Target Length</label><select class="select-el mt-1" id="vid-length"><option>60 seconds (Reel/Short)</option><option>2–3 minutes</option><option>5–7 minutes</option><option>10–15 minutes</option><option>20–30 minutes (deep dive)</option></select></div>
            <div><label>Platform</label><select class="select-el mt-1" id="vid-platform"><option>YouTube</option><option>Instagram Reels</option><option>TikTok</option><option>LinkedIn Video</option><option>Facebook</option></select></div>
          </div>
          <button id="gen-script-btn" class="btn btn-primary btn-lg" ${!VS.videoTopic.trim()?'disabled':''}>${icon('sparkles',16)} Generate Script</button>
        </div>
      </div>
      <div id="video-result"></div>
    </div>`;

  // Tab switching
  el.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      S.activeTab = btn.dataset.tab;
      el.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b===btn));
      el.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id===`tab-${btn.dataset.tab}`));
    });
  });

  el.querySelectorAll('[data-type]').forEach(c => c.addEventListener('click', () => { S.type=c.dataset.type; el.querySelectorAll('[data-type]').forEach(x=>x.classList.toggle('selected',x===c)); }));
  el.querySelectorAll('[data-pillar]').forEach(c => c.addEventListener('click', () => { S.pillar=c.dataset.pillar; el.querySelectorAll('[data-pillar]').forEach(x=>x.classList.toggle('selected',x===c)); }));
  el.querySelectorAll('[data-mode]').forEach(c => c.addEventListener('click', () => { S.mode=c.dataset.mode; el.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('selected',x===c)); }));
  el.querySelectorAll('[data-format]').forEach(c => c.addEventListener('click', () => { S.format=c.dataset.format; el.querySelectorAll('[data-format]').forEach(x=>x.classList.toggle('selected',x===c)); }));

  // Upgrade button in limit bar
  el.querySelector('[data-nav="subscription"]')?.addEventListener('click', () => navigate('subscription'));

  const draftInput = el.querySelector('#draft-input');
  const analyzeBtn = el.querySelector('#analyze-btn');
  draftInput.addEventListener('input', () => { S.draft=draftInput.value; analyzeBtn.disabled=!S.draft.trim(); });

  el.querySelectorAll('.save-tracker-btn').forEach(btn => btn.addEventListener('click', () => showSaveModal(S.analyzeResult)));
  el.querySelectorAll('.copy-btn').forEach(btn => btn.addEventListener('click', function() { copyText(S.analyzeResult, this); }));

  analyzeBtn.addEventListener('click', async () => {
    // ── Free tier generation limit ────────────────────────────────────────
    if (!checkGenLimit()) return;

    setLoading(analyzeBtn, true, 'Processing…');
    const examples = pickExamples(3, { pillar: S.pillar, channel: S.type });
    const prompt = `Task: ${S.mode}
Content Type: ${S.type}
Content Pillar: ${S.pillar}
Channel flex: ${channelBrief(S.type)}

REAL EXAMPLES — these are actual posts that embody the voice at its best. Use them to calibrate tone, rhythm, and structure. Do NOT copy them. Let them anchor what "sounds like this user" actually means in practice:

${examples}

---

Now apply that same voice and cadence to the task below.

Judge and fix the draft against the Delivery Spine (Hook → Turn → Principle → Proof/Reframe → Door). Call out which beat is missing or weak, then deliver the fix.

Draft:
"""
${S.draft}
"""`;
    const res = await callAI(prompt);
    setLoading(analyzeBtn, false);
    if (res) {
      incrementDailyGen();
      S.analyzeResult=res;
      const area=el.querySelector('#analyze-result');
      area.innerHTML='';
      area.appendChild(resultBox(res,'Analysis Result'));
    }
  });

  const topicInput = el.querySelector('#topic-input');
  const quickBtn   = el.querySelector('#quick-btn');
  topicInput.addEventListener('input', () => { S.topic=topicInput.value; quickBtn.disabled=!S.topic.trim(); });

  quickBtn.addEventListener('click', async () => {
    // ── Free tier generation limit ────────────────────────────────────────
    if (!checkGenLimit()) return;

    setLoading(quickBtn, true, 'Generating…');
    const examples = pickExamples(3, { pillar: S.pillar, channel: S.format });
    const prompt = `Task: Write new content from scratch.
Topic/Hook seed: ${S.topic}
Format: ${S.format}
Channel flex: ${channelBrief(S.format)}

REAL EXAMPLES — these posts show what the voice looks like when it's working. Use them to feel the rhythm, the white space, the cadence. Do NOT copy them. Let them set the standard your output must match:

${examples}

---

Now write a fresh post from the topic seed above.

Sound exactly like ${getUserProfile()?.name || 'this user'} — not a cleaned-up version, the real one. Follow the delivery approach and voice already established in the system instructions.`;
    const res = await callAI(prompt);
    setLoading(quickBtn, false);
    if (res) {
      incrementDailyGen();
      S.quickResult=res;
      const area=el.querySelector('#quick-result');
      area.innerHTML='';
      area.appendChild(resultBox(res,'Generated Post'));
    }
  });

  // ── Video Script (moved here from the old Publish page — it's a generator,
  // not a tracking tool, so it belongs with the rest of "Create") ───────────
  el.querySelectorAll('[data-vstyle]').forEach(c => c.addEventListener('click', () => { VS.videoStyle=c.dataset.vstyle; el.querySelectorAll('[data-vstyle]').forEach(x=>x.classList.toggle('selected',x===c)); }));
  el.querySelectorAll('[data-vpillar]').forEach(c => c.addEventListener('click', () => { VS.videoPillar=c.dataset.vpillar; el.querySelectorAll('[data-vpillar]').forEach(x=>x.classList.toggle('selected',x===c)); }));

  const vidTopic     = el.querySelector('#vid-topic');
  const genScriptBtn = el.querySelector('#gen-script-btn');
  vidTopic.addEventListener('input', () => { VS.videoTopic=vidTopic.value; genScriptBtn.disabled=!VS.videoTopic.trim(); });

  genScriptBtn.addEventListener('click', async () => {
    if (!checkGenLimit()) return;
    setLoading(genScriptBtn, true, 'Writing script…');
    const length   = el.querySelector('#vid-length').value;
    const platform = el.querySelector('#vid-platform').value;
    const res = await callAI(`Write a full video script for ${getUserProfile()?.name || 'this user'}.

Topic: ${VS.videoTopic}
Style: ${VS.videoStyle}
Platform: ${platform}
Target length: ${length}
Content Pillar: ${VS.videoPillar||'Most relevant pillar'}

Script structure:
## 🎬 VIDEO TITLE (SEO-optimised for ${platform})
## 📌 HOOK (First 3–5 seconds — spoken)
## 🖥 ON-SCREEN TEXT (Hook frame)
## 📖 BODY — SPOKEN SCRIPT
## 📷 B-ROLL NOTES
## 💬 ON-SCREEN TEXT (Key points)
## 🎯 CTA (Final 10–15 seconds — spoken)
## 📝 CAPTION / POST COPY
## #️⃣ HASHTAGS`);
    setLoading(genScriptBtn, false);
    if (res) {
      incrementDailyGen();
      VS.videoResult = res;
      const area = el.querySelector('#video-result');
      area.innerHTML = '';
      const sections = res.split(/##\s+/).filter(Boolean);
      const wrap = document.createElement('div');
      wrap.className = 'space-y-3 mt-4';
      sections.forEach(sec => {
        const lines   = sec.trim().split('\n');
        const content = lines.slice(1).join('\n').trim();
        if (!content) return;
        const card = document.createElement('div');
        card.className = 'card';
        card.style.borderLeft = '3px solid var(--accent)';
        card.innerHTML = `
          <div class="flex items-center justify-between mb-2">
            <span class="font-semibold text-sm" style="color:var(--primary)">${lines[0].trim()}</span>
            <button class="btn btn-ghost btn-sm copy-sec" data-text="${encodeURIComponent(content)}">${icon('copy',12)}</button>
          </div>
          <div class="text-sm" style="white-space:pre-wrap;line-height:1.75">${content}</div>`;
        card.querySelector('.copy-sec').addEventListener('click', function(){ copyText(decodeURIComponent(this.dataset.text), this); });
        wrap.appendChild(card);
      });
      const actions = document.createElement('div');
      actions.className = 'flex gap-2';
      actions.innerHTML = `
        <button class="btn btn-outline flex-1">${icon('copy',14)} Copy Full Script</button>
        <button class="btn btn-accent">${icon('save',14)} Save to Tracker</button>`;
      actions.querySelector('.btn-outline').addEventListener('click', function(){ copyText(res, this); });
      actions.querySelector('.btn-accent').addEventListener('click', () => showSaveModal(res));
      wrap.appendChild(actions);
      area.appendChild(wrap);
    }
  });

  return el;
}
