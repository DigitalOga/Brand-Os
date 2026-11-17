// ── PAGE: DISCOVER (formerly two separate destinations — Discover + Trend
// Radar — merged into one, since both answered the same question: "what's
// happening in my space?" One search box, one toggle for how deep to go. ──
function renderDiscover() {
  // Pro-only feature
  if (!isPro()) return renderProPaywall('Discover');

  const S = STATE.discover;
  if (!S.mode) S.mode = 'search'; // 'search' (live results) | 'analysis' (deep AI breakdown)
  const el = document.createElement('div');
  el.className = 'space-y-6';
  el.innerHTML = `
    <div class="page-heading"><h1>Discover</h1><p>Find out what's happening in your space, and what to do about it.</p></div>
    <div class="tabs-list">
      <button class="tab-btn ${S.mode==='search'?'active':''}" data-mode="search">Quick Search</button>
      <button class="tab-btn ${S.mode==='analysis'?'active':''}" data-mode="analysis">Deep Analysis</button>
    </div>
    <div id="discover-search-pane" class="${S.mode==='search'?'':'hidden'}">
      <div class="card">
        <div class="card-header"><div class="card-title">Search For Ideas</div><div class="card-desc">News and YouTube show real results. Everything else is written by AI.</div></div>
        <div class="space-y-5">
          <div>
            <label>Topic or Search Query</label>
            <div class="flex gap-2 mt-1">
              <input class="input flex-1" id="disc-query" placeholder="e.g. AI automation for coaches, Nigerian fintech…" value="${S.query}">
              <button id="disc-search-btn" class="btn btn-primary btn-icon">${icon('search',16)}</button>
            </div>
          </div>
          <div>
            <label>Sources</label>
            <div class="flex flex-wrap gap-2 mt-1">
              ${SOURCES.map(s=>`<button class="source-btn ${S.sources.includes(s.id)?'active':''}" data-sid="${s.id}"><span>${s.emoji}</span> ${s.label} ${s.live?`<span class="source-tag">LIVE</span>`:''}</button>`).join('')}
            </div>
            <p class="text-xs text-muted mt-1"><strong>LIVE</strong> = real data (via the shared News/YouTube keys). Others = AI synthesis.</p>
          </div>
          <div>
            <button class="btn btn-ghost btn-sm" id="toggle-paste" style="color:var(--accent)">${icon('file',13)} ${S.showPaste?'Hide paste area':'Paste content to analyse (optional)'}</button>
            <div id="paste-area" class="${S.showPaste?'':'hidden'} mt-3">
              <textarea class="textarea" id="paste-input" placeholder="Paste any external content — LinkedIn post, article, competitor content…" style="min-height:100px">${S.paste}</textarea>
            </div>
          </div>
          <button id="disc-run-btn" class="btn btn-primary btn-lg w-full" ${!S.query.trim()?'disabled':''}>${icon('sparkles',16)} Search</button>
        </div>
      </div>
      <div id="disc-result" class="mt-6"></div>
    </div>
    <div id="discover-analysis-pane" class="${S.mode==='analysis'?'':'hidden'}">
      <div class="card">
        <div class="card-header"><div class="card-title">Market or Topic</div><div class="card-desc">Want a deeper, honest breakdown instead of quick results? Use this.</div></div>
        <div class="space-y-4">
          <div><label>Topic</label><input class="input mt-1" id="trend-input" placeholder="e.g. AI Automation Agencies, High-ticket coaching in Nigeria…" value="${STATE.trends.topic}"></div>
          <button id="trend-btn" class="btn btn-primary" ${!STATE.trends.topic.trim()?'disabled':''}>Run Deep Analysis</button>
        </div>
      </div>
      <div id="trend-result" class="mt-6">${STATE.trends.result?resultBox(STATE.trends.result,'Deep Analysis').outerHTML:''}</div>
    </div>`;

  // ── Mode toggle ──────────────────────────────────────────────────────────
  el.querySelectorAll('[data-mode]').forEach(btn => btn.addEventListener('click', () => {
    S.mode = btn.dataset.mode;
    el.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('active', b===btn));
    el.querySelector('#discover-search-pane').classList.toggle('hidden', S.mode!=='search');
    el.querySelector('#discover-analysis-pane').classList.toggle('hidden', S.mode!=='analysis');
  }));

  const queryInput = el.querySelector('#disc-query');
  const runBtn     = el.querySelector('#disc-run-btn');
  const searchBtn  = el.querySelector('#disc-search-btn');

  queryInput.addEventListener('input', () => { S.query=queryInput.value; runBtn.disabled=!S.query.trim(); });
  queryInput.addEventListener('keydown', e => { if(e.key==='Enter') runDiscover(); });
  el.querySelector('#toggle-paste').addEventListener('click', () => {
    S.showPaste=!S.showPaste;
    el.querySelector('#toggle-paste').innerHTML=`${icon('file',13)} ${S.showPaste?'Hide paste area':'Paste content to analyse (optional)'}`;
    el.querySelector('#paste-area').classList.toggle('hidden',!S.showPaste);
  });
  el.querySelector('#paste-input')?.addEventListener('input', e => S.paste=e.target.value);
  el.querySelectorAll('.source-btn').forEach(btn => btn.addEventListener('click', () => {
    const sid=btn.dataset.sid;
    if(S.sources.includes(sid)) S.sources=S.sources.filter(x=>x!==sid);
    else S.sources.push(sid);
    btn.classList.toggle('active',S.sources.includes(sid));
  }));

  async function runDiscover() {
    if(!S.query.trim()) return;
    if (!checkGenLimit()) return;

    setLoading(runBtn, true, 'Synthesising…');
    setLoading(searchBtn, true, '');

    const liveActive = SOURCES.filter(s=>s.live && S.sources.includes(s.id));
    let liveBlock = '';
    const notices = [];
    if(liveActive.length) {
      setLoading(runBtn, true, 'Pulling live data…');
      const [news, yt] = await Promise.all([
        S.sources.includes('news')    ? fetchNews(S.query)    : Promise.resolve(null),
        S.sources.includes('youtube') ? fetchYouTube(S.query) : Promise.resolve(null)
      ]);
      if(news) {
        if(news.ok && news.items.length) {
          liveBlock += `\n\nLIVE NEWS:\n${news.items.map(a=>`- [${a.source}] ${a.title}: ${a.desc}`).join('\n')}`;
          notices.push({ok:true,label:'News',count:news.items.length});
        } else {
          notices.push({ok:false,label:'News',reason:news.reason||'no results'});
        }
      }
      if(yt) {
        if(yt.ok && yt.items.length) {
          liveBlock += `\n\nLIVE YOUTUBE:\n${yt.items.map(v=>`- ${v.title} (${v.channel})`).join('\n')}`;
          notices.push({ok:true,label:'YouTube',count:yt.items.length});
        } else {
          notices.push({ok:false,label:'YouTube',reason:yt.reason||'no results'});
        }
      }
    }

    const pasteBlock = S.paste.trim() ? `\n\nUSER-SUPPLIED CONTENT:\n${S.paste}` : '';
    const aiSources  = S.sources.filter(sid => SOURCES.find(s=>s.id===sid && s.aiOnly));

    setLoading(runBtn, true, 'Running scan…');
    const prompt = `You are running an intelligence scan for a content creator.

Query: "${S.query}"
${aiSources.length ? `Synthesise from these perspectives: ${aiSources.map(id=>SOURCES.find(s=>s.id===id)?.label).filter(Boolean).join(', ')}` : ''}
${liveBlock}
${pasteBlock}

Produce a structured report:

## 1. Trend Snapshot
2–3 sharp sentences on what's actually happening in this space right now.

## 2. The Real Gap
What nobody is saying clearly that NEEDS to be said. One specific insight.

## 3. Your Angle
How this user should position themselves on this trend — specific, not vague.

## 4. Ready-To-Use Hooks (Post Openers)
Exactly 4 dangerous opening lines in this user's own voice.

## 5. Suggested Content Pillar
State which single pillar: ${CONTENT_PILLARS.join(' | ')}`;
    const res = await callAI(prompt);
    setLoading(runBtn, false);
    setLoading(searchBtn, false);
    if(res) { incrementDailyGen(); S.raw=res; renderDiscoverResult(res, el.querySelector('#disc-result'), notices); }
  }

  runBtn.addEventListener('click', runDiscover);
  searchBtn.addEventListener('click', runDiscover);
  if(S.raw) renderDiscoverResult(S.raw, el.querySelector('#disc-result'));

  // ── Deep Analysis (formerly the separate "Trend Radar" page) ─────────────
  const T = STATE.trends;
  const trendInput = el.querySelector('#trend-input');
  const trendBtn   = el.querySelector('#trend-btn');
  trendInput.addEventListener('input', e => { T.topic=e.target.value; trendBtn.disabled=!T.topic.trim(); });
  trendInput.addEventListener('keydown', e => { if(e.key==='Enter') trendBtn.click(); });
  el.querySelectorAll('.save-tracker-btn').forEach(btn => btn.addEventListener('click', () => showSaveModal(T.result)));
  el.querySelectorAll('.copy-btn').forEach(btn => btn.addEventListener('click', function() { copyText(T.result, this); }));

  trendBtn.addEventListener('click', async () => {
    if (!checkGenLimit()) return;
    setLoading(trendBtn, true, 'Scanning…');
    const prompt = `Task: Deep analysis of a market or topic.\nTopic: ${T.topic}\n\nGive a brutally honest breakdown:\n1. What's Actually Happening (cut through hype)\n2. Who's Winning Right Now (and why)\n3. The Real Opportunity (specific, not vague)\n4. The Hidden Risk (what most people miss)\n5. Your Move (1–2 specific actions this user should take)`;
    const res = await callAI(prompt);
    setLoading(trendBtn, false);
    if (res) { incrementDailyGen(); T.result=res; const area=el.querySelector('#trend-result'); area.innerHTML=''; area.appendChild(resultBox(res,'Deep Analysis')); }
  });

  return el;
}

function renderDiscoverResult(raw, container, notices=[]) {
  const get = n => (raw.match(new RegExp(`##?\\s*${n}[.\\s]+[^\\n]*\\n([\\s\\S]*?)(?=##?\\s*${n+1}[.\\s]|$)`,'i'))||[])[1]?.trim()||'';
  const snapshot   = get(1)||raw;
  const gap        = get(2);
  const angle      = get(3);
  const hooksBlock = get(4);
  const hooks      = hooksBlock.split('\n').map(l=>l.replace(/^[-*•\d.]+\s*/,'').trim()).filter(Boolean).slice(0,4);
  const pillar     = CONTENT_PILLARS.find(p=>raw.toLowerCase().includes(p.toLowerCase().slice(0,8)))||CONTENT_PILLARS[0];

  const noticeStrip = notices.length ? `<div class="flex flex-wrap gap-2 mb-3">${notices.map(n => n.ok ? `<span class="badge badge-success">${icon('ok',11)} ${n.label}: ${n.count} live</span>` : `<span class="badge badge-muted">${n.label}: AI fallback (${n.reason})</span>`).join('')}</div>` : '';

  container.innerHTML = `
    <div class="space-y-4">
      ${noticeStrip}
      <div class="flex items-center gap-2 text-xs text-muted">Suggested pillar: <span class="badge badge-gold">${pillar}</span></div>
      <div class="card"><div class="card-header"><div class="card-title">📡 Trend Snapshot</div></div><div class="card-body text-sm" style="white-space:pre-wrap;line-height:1.7">${snapshot}</div></div>
      ${gap?`<div class="card" style="border-color:rgba(15,28,63,0.25)"><div class="card-header"><div class="card-title">🎯 The Real Gap</div></div><div class="card-body text-sm" style="white-space:pre-wrap;line-height:1.7">${gap}</div></div>`:''}
      ${angle?`<div class="card" style="border-color:rgba(201,168,76,0.4)"><div class="card-header"><div class="card-title">⚡ Your Angle</div></div><div class="card-body text-sm" style="white-space:pre-wrap;line-height:1.7">${angle}</div></div>`:''}
      ${hooks.length?`<div class="card">
        <div class="card-header"><div class="card-title">🪝 Ready-to-Use Hooks</div><div class="card-desc">Tap to copy or write a full post.</div></div>
        <div class="space-y-3">${hooks.map(h=>`<div class="hook-card">
          <p class="hook-text">${h}</p>
          <div class="hook-actions">
            <button class="btn btn-outline btn-sm copy-hook" data-text="${encodeURIComponent(h)}">${icon('copy',12)} Copy</button>
            <button class="btn btn-primary btn-sm write-hook" data-hook="${encodeURIComponent(h)}">${icon('link',12)} Write This Post</button>
          </div>
        </div>`).join('')}</div>
      </div>`:''}
    </div>`;

  container.querySelectorAll('.copy-hook').forEach(btn => btn.addEventListener('click', () => copyText(decodeURIComponent(btn.dataset.text), btn)));
  container.querySelectorAll('.write-hook').forEach(btn => btn.addEventListener('click', () => navigate('content', {idea:decodeURIComponent(btn.dataset.hook)})));
}
