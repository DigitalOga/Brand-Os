// ── PAGE: PUBLISH ──────────────────────────────────────────────────────────
function renderPublish() {
  const S      = STATE.publish;
  const hasKey = STATE.aiAvailable !== false;
  const el     = document.createElement('div');
  el.className = 'space-y-6';

  el.innerHTML = `
    <div class="page-heading">
      <h1>Calendar</h1>
      <p>Plan your posting days and keep track of what you've shared.</p>
    </div>
    <div class="tabs-list" style="flex-wrap:wrap">
      <button class="tab-btn ${S.activeTab==='calendar'?'active':''}" data-tab="calendar">📅 Calendar</button>
      <button class="tab-btn ${S.activeTab==='tracker'?'active':''}" data-tab="tracker">📊 Tracker</button>
      <button class="tab-btn ${S.activeTab==='drafts'?'active':''}" data-tab="drafts">💾 Drafts</button>
      <button class="tab-btn ${S.activeTab==='plan'?'active':''}" data-tab="plan">⚡ Week Plan</button>
    </div>

    <!-- CALENDAR TAB -->
    <div id="tab-calendar" class="tab-panel ${S.activeTab==='calendar'?'active':''}">
      <div class="card">
        <div class="card-header">
          <div class="card-title">Weekly Posting Schedule</div>
          <div class="card-desc">Pick which days you'll post, and what kind of post it is.</div>
        </div>
        <div id="schedule-grid" class="space-y-3"></div>
        <div class="card-footer flex gap-2 flex-wrap">
          <button id="save-schedule-btn" class="btn btn-primary">${icon('check',14)} Save Schedule</button>
          <button id="reset-schedule-btn" class="btn btn-outline btn-sm">Reset to Default</button>
          <button id="gen-week-btn" class="btn btn-accent" ${!hasKey?'disabled':''}>${icon('sparkles',14)} Generate This Week's Posts</button>
        </div>
      </div>
      <div id="week-posts-result"></div>
    </div>

    <!-- TRACKER TAB -->
    <div id="tab-tracker" class="tab-panel ${S.activeTab==='tracker'?'active':''}">
      <div class="card">
        <div class="card-header flex items-center justify-between">
          <div><div class="card-title">Post Log</div><div class="card-desc">Track what you've published and how it performed.</div></div>
          <button id="add-post-btn" class="btn btn-primary btn-sm">${icon('write',13)} Log Post</button>
        </div>
        <div id="tracker-list"></div>
      </div>
      <div id="add-post-form" class="card hidden" style="margin-top:1rem">
        <div class="card-header"><div class="card-title">Log a Post</div></div>
        <div class="space-y-4">
          <div class="grid-2">
            <div><label>Date</label><input type="date" class="input mt-1" id="log-date" value="${new Date().toISOString().split('T')[0]}"></div>
            <div><label>Platform</label><select class="select-el mt-1" id="log-platform">${PLATFORMS.map(p=>`<option>${p}</option>`).join('')}</select></div>
          </div>
          <div class="grid-2">
            <div><label>Post Type</label><select class="select-el mt-1" id="log-type">${POST_TYPES.filter(t=>t!=='Off').map(t=>`<option>${t}</option>`).join('')}</select></div>
            <div><label>Pillar</label><select class="select-el mt-1" id="log-pillar">${CONTENT_PILLARS.map(p=>`<option>${p}</option>`).join('')}</select></div>
          </div>
          <div><label>Post Content / Summary</label><textarea class="textarea mt-1" id="log-content" placeholder="Paste the post or summarise it…" style="min-height:80px"></textarea></div>
          <div class="grid-2">
            <div><label>Likes / Reactions</label><input type="number" class="input mt-1" id="log-likes" placeholder="0" min="0"></div>
            <div><label>Comments</label><input type="number" class="input mt-1" id="log-comments" placeholder="0" min="0"></div>
          </div>
          <div><label>Notes (optional)</label><input class="input mt-1" id="log-notes" placeholder="What worked? What didn't?"></div>
          <div class="flex gap-2">
            <button id="save-log-btn" class="btn btn-primary">Save Post</button>
            <button id="cancel-log-btn" class="btn btn-outline">Cancel</button>
          </div>
        </div>
      </div>
      <div id="tracker-insights" class="mt-4"></div>
    </div>

    <!-- DRAFTS TAB -->
    <div id="tab-drafts" class="tab-panel ${S.activeTab==='drafts'?'active':''}">
      <div class="card">
        <div class="card-header">
          <div class="card-title">Saved Drafts</div>
          <div class="card-desc">Posts saved from any module. Mark as Posted when published.</div>
        </div>
        <div id="drafts-list"></div>
      </div>
    </div>

    <!-- WEEK PLAN TAB -->
    <div id="tab-plan" class="tab-panel ${S.activeTab==='plan'?'active':''}">
      <div class="card">
        <div class="card-header"><div class="card-title">Next Post Generator</div><div class="card-desc">Tell the AI what's happening this week — it writes what to post next.</div></div>
        <div class="space-y-5">
          <div><label>What's happening in your business / life this week?</label><textarea class="textarea mt-1" id="plan-context" placeholder="e.g. Just ran a masterclass. Launching a new offer next week. Had a breakthrough client result…" style="min-height:100px"></textarea></div>
          <div><label>What do you want this post to DO?</label><div class="flex flex-wrap gap-2 mt-1">
            ${['Get DMs','Build authority','Drive to offer','Spark conversation','Grow following','Share a win'].map(g=>`<button class="chip" data-goal="${g}">${g}</button>`).join('')}
          </div></div>
          <div><label>Platform</label><div class="flex flex-wrap gap-2 mt-1">${['LinkedIn','Instagram','WhatsApp','Twitter/X'].map(p=>`<button class="chip ${p==='LinkedIn'?'selected':''}" data-pgoal="${p}">${p}</button>`).join('')}</div></div>
          <button id="gen-next-btn" class="btn btn-primary btn-lg" ${!hasKey?'disabled':''}>${icon('zap',16)} Write My Next Post</button>
        </div>
      </div>
      <div id="next-post-result"></div>
    </div>`;

  // Tab switching
  el.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      S.activeTab = btn.dataset.tab;
      el.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b===btn));
      el.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id===`tab-${btn.dataset.tab}`));
    });
  });

  // ── SCHEDULE GRID ──────────────────────────────────────────────────────
  function renderScheduleGrid() {
    const grid = el.querySelector('#schedule-grid');
    grid.innerHTML = S.schedule.map((slot, i) => `
      <div class="schedule-row" data-i="${i}" style="display:grid;grid-template-columns:120px 1fr 1fr auto;gap:0.75rem;align-items:center;padding:0.6rem 0;border-bottom:1px solid var(--border)">
        <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer">
          <input type="checkbox" class="sched-toggle" data-i="${i}" ${slot.active?'checked':''}
            style="width:16px;height:16px;accent-color:var(--primary);cursor:pointer">
          <span class="text-sm font-semibold" style="color:${slot.active?'var(--foreground)':'var(--muted-fg)'}">${slot.day}</span>
        </label>
        <select class="select-el sched-type" data-i="${i}" ${!slot.active?'disabled':''} style="font-size:0.8125rem;opacity:${slot.active?1:0.4}">
          ${POST_TYPES.map(t=>`<option ${t===slot.type?'selected':''}>${t}</option>`).join('')}
        </select>
        <select class="select-el sched-platform" data-i="${i}" ${!slot.active?'disabled':''} style="font-size:0.8125rem;opacity:${slot.active?1:0.4}">
          ${PLATFORMS.map(p=>`<option ${p===slot.platform?'selected':''}>${p}</option>`).join('')}
        </select>
        <span class="badge ${slot.active?'badge-success':'badge-muted'}">${slot.active?'ON':'OFF'}</span>
      </div>`).join('');

    grid.querySelectorAll('.sched-toggle').forEach(chk => {
      chk.addEventListener('change', () => { S.schedule[+chk.dataset.i].active=chk.checked; renderScheduleGrid(); });
    });
    grid.querySelectorAll('.sched-type').forEach(sel => sel.addEventListener('change', () => S.schedule[+sel.dataset.i].type=sel.value));
    grid.querySelectorAll('.sched-platform').forEach(sel => sel.addEventListener('change', () => S.schedule[+sel.dataset.i].platform=sel.value));
  }
  renderScheduleGrid();

  el.querySelector('#save-schedule-btn').addEventListener('click', () => { saveState(); showToast('Schedule saved'); });
  el.querySelector('#reset-schedule-btn').addEventListener('click', () => { S.schedule=JSON.parse(JSON.stringify(DEFAULT_SCHEDULE)); renderScheduleGrid(); showToast('Reset to default'); });

  el.querySelector('#gen-week-btn').addEventListener('click', async () => {
    const btn = el.querySelector('#gen-week-btn');
    setLoading(btn, true, 'Generating week…');
    const activeDays = S.schedule.filter(d=>d.active && d.type!=='Off');
    const myProfile  = getUserProfile();
    const myName     = myProfile?.name || 'the user';
    const myBrand    = myProfile?.brand_name ? ` (${myProfile.brand_name})` : '';
    const res = await callAI(`Generate a full week of posts for ${myName}${myBrand}.

Schedule:
${activeDays.map(d=>`${d.day}: ${d.type} on ${d.platform}`).join('\n')}

Content Pillars to rotate: ${CONTENT_PILLARS.join(', ')}

For EACH day:
**[DAY] — [POST TYPE]**
Platform: [platform]
Pillar: [pillar]

[Full post in ${myName}'s own voice]

---

Make each post distinct. No repetition in tone or structure.`);
    setLoading(btn, false);
    if (res) {
      const area = el.querySelector('#week-posts-result');
      area.innerHTML = '';
      const blocks = res.split(/---+/).map(b=>b.trim()).filter(Boolean);
      const wrap = document.createElement('div');
      wrap.className = 'space-y-4 mt-4';
      blocks.forEach(block => {
        const dayMatch = block.match(/\*\*([^*]+)\*\*/);
        const title = dayMatch ? dayMatch[1] : 'Post';
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
          <div class="card-header flex items-center justify-between">
            <div class="card-title" style="font-size:0.9375rem">${title}</div>
            <div class="flex gap-2">
              <button class="btn btn-ghost btn-sm save-week-post" data-text="${encodeURIComponent(block)}">${icon('save',13)} Save</button>
              <button class="btn btn-ghost btn-sm copy-week-post" data-text="${encodeURIComponent(block)}">${icon('copy',13)} Copy</button>
            </div>
          </div>
          <div class="card-body text-sm" style="white-space:pre-wrap;line-height:1.75">${block}</div>`;
        card.querySelector('.copy-week-post').addEventListener('click', function(){ copyText(decodeURIComponent(this.dataset.text), this); });
        card.querySelector('.save-week-post').addEventListener('click', function(){ showSaveModal(decodeURIComponent(this.dataset.text)); });
        wrap.appendChild(card);
      });
      area.appendChild(wrap);
    }
  });

  // ── TRACKER ──────────────────────────────────────────────────────────────
  function renderTrackerList() {
    const list = el.querySelector('#tracker-list');
    const postedPosts = STATE.publish.posts.filter(p=>!p.status || p.status==='posted');
    if (!postedPosts.length) {
      list.innerHTML = `<div class="text-sm text-muted" style="padding:1.5rem 0;text-align:center">No posts logged yet. Hit "Log Post" or use "Save to Tracker" on any generated post.</div>`;
      el.querySelector('#tracker-insights').innerHTML = '';
      return;
    }
    const sorted = [...postedPosts].sort((a,b)=>new Date(b.date)-new Date(a.date));
    list.innerHTML = `<div class="space-y-2 mt-2">${sorted.map(p=>`
      <div style="display:grid;grid-template-columns:1fr auto;gap:0.75rem;align-items:start;padding:0.75rem;background:var(--muted-bg);border-radius:var(--radius-md);border:1px solid var(--border)">
        <div>
          <div class="flex items-center gap-2 mb-1 flex-wrap">
            <span class="badge badge-navy">${p.platform||'—'}</span>
            <span class="badge badge-gold">${p.type||'—'}</span>
            <span class="text-xs text-muted">${p.date}</span>
          </div>
          <p class="text-sm" style="line-height:1.5;margin-bottom:0.35rem">${(p.content||'').slice(0,120)}${(p.content||'').length>120?'…':''}</p>
          <div class="flex gap-3 text-xs text-muted flex-wrap">
            ${p.likes?`<span>👍 ${p.likes}</span>`:''}
            ${p.comments?`<span>💬 ${p.comments}</span>`:''}
            ${p.pillar?`<span style="color:var(--accent)">${p.pillar}</span>`:''}
            ${p.notes?`<span style="font-style:italic">${p.notes}</span>`:''}
          </div>
        </div>
        <button class="btn btn-ghost btn-sm" data-del="${p.id}">${icon('trash',13)}</button>
      </div>`).join('')}</div>`;

    list.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', () => { STATE.publish.posts=STATE.publish.posts.filter(p=>p.id!==btn.dataset.del); saveState(); renderTrackerList(); });
    });

    const total         = postedPosts.length;
    const totalLikes    = postedPosts.reduce((a,p)=>a+(+p.likes||0),0);
    const totalComments = postedPosts.reduce((a,p)=>a+(+p.comments||0),0);
    const byPillar      = {};
    postedPosts.forEach(p=>{ if(p.pillar) byPillar[p.pillar]=(byPillar[p.pillar]||0)+1; });
    const topPillar = Object.entries(byPillar).sort((a,b)=>b[1]-a[1])[0];

    el.querySelector('#tracker-insights').innerHTML = `
      <div class="card mt-2">
        <div class="card-header"><div class="card-title">Quick Stats</div></div>
        <div class="grid-3 text-center" style="gap:0.5rem">
          <div style="padding:0.75rem;background:var(--muted-bg);border-radius:var(--radius-md)"><div style="font-size:1.5rem;font-family:var(--font-serif);color:var(--primary)">${total}</div><div class="text-xs text-muted">Posts logged</div></div>
          <div style="padding:0.75rem;background:var(--muted-bg);border-radius:var(--radius-md)"><div style="font-size:1.5rem;font-family:var(--font-serif);color:var(--primary)">${totalLikes}</div><div class="text-xs text-muted">Total reactions</div></div>
          <div style="padding:0.75rem;background:var(--muted-bg);border-radius:var(--radius-md)"><div style="font-size:1.5rem;font-family:var(--font-serif);color:var(--primary)">${totalComments}</div><div class="text-xs text-muted">Total comments</div></div>
        </div>
        ${topPillar?`<p class="text-sm text-muted mt-3">Top pillar: <span class="badge badge-gold">${topPillar[0]}</span> (${topPillar[1]} posts)</p>`:''}
        ${hasKey && total >= 3 ? `<button id="analyse-posts-btn" class="btn btn-outline btn-sm mt-3">${icon('sparkles',13)} AI: Analyse What's Working</button>` : ''}
      </div>`;

    const analyseBtn = el.querySelector('#analyse-posts-btn');
    if (analyseBtn) {
      analyseBtn.addEventListener('click', async () => {
        setLoading(analyseBtn, true, 'Analysing…');
        const summary = postedPosts.map(p=>`${p.date} | ${p.platform} | ${p.type} | ${p.pillar} | Likes:${p.likes||0} Comments:${p.comments||0} | "${(p.content||'').slice(0,80)}"`).join('\n');
        const res = await callAI(`Analyse ${getUserProfile()?.name || "this user"}'s post performance data. Identify:\n1. What content type/pillar is getting the most engagement\n2. What's underperforming\n3. Specific recommendations for next week\n\nData:\n${summary}`);
        setLoading(analyseBtn, false);
        if (res) { const box = resultBox(res,'Content Analysis'); box.style.marginTop='1rem'; analyseBtn.closest('.card').after(box); }
      });
    }
  }
  renderTrackerList();

  el.querySelector('#add-post-btn').addEventListener('click', () => el.querySelector('#add-post-form').classList.toggle('hidden'));
  el.querySelector('#cancel-log-btn').addEventListener('click', () => el.querySelector('#add-post-form').classList.add('hidden'));
  el.querySelector('#save-log-btn').addEventListener('click', () => {
    const post = {
      id:       Date.now().toString(),
      date:     el.querySelector('#log-date').value,
      platform: el.querySelector('#log-platform').value,
      type:     el.querySelector('#log-type').value,
      pillar:   el.querySelector('#log-pillar').value,
      content:  el.querySelector('#log-content').value.trim(),
      likes:    el.querySelector('#log-likes').value,
      comments: el.querySelector('#log-comments').value,
      notes:    el.querySelector('#log-notes').value,
      status:   'posted'
    };
    if (!post.content) { showToast('Add post content first', true); return; }
    STATE.publish.posts.unshift(post);
    saveState();
    el.querySelector('#add-post-form').classList.add('hidden');
    ['#log-content','#log-likes','#log-comments','#log-notes'].forEach(id => { const el2=el.querySelector(id); if(el2) el2.value=''; });
    renderTrackerList();
    showToast('Post logged!');
  });

  // ── DRAFTS TAB ──────────────────────────────────────────────────────────
  function renderDraftsList() {
    const drafts = STATE.publish.posts.filter(p=>p.status==='draft');
    const list   = el.querySelector('#drafts-list');
    if (!drafts.length) {
      list.innerHTML = `<div class="text-sm text-muted" style="padding:1.5rem 0;text-align:center">No drafts yet. Hit "Save to Tracker" on any AI-generated post to save it here.</div>`;
      return;
    }
    list.innerHTML = `<div class="space-y-3 mt-2">${drafts.map(p=>`
      <div style="padding:1rem;background:var(--muted-bg);border-radius:var(--radius-md);border:1px solid var(--border)">
        <div class="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div class="flex gap-2 flex-wrap">
            <span class="badge badge-muted">💾 Draft</span>
            ${p.platform?`<span class="badge badge-navy">${p.platform}</span>`:''}
            ${p.pillar?`<span class="badge badge-gold">${p.pillar}</span>`:''}
            <span class="text-xs text-muted">${p.date}</span>
          </div>
          <div class="flex gap-1">
            <button class="btn btn-primary btn-sm mark-posted" data-id="${p.id}">✅ Mark as Posted</button>
            <button class="btn btn-ghost btn-sm copy-draft" data-text="${encodeURIComponent(p.content||'')}">${icon('copy',12)}</button>
            <button class="btn btn-ghost btn-sm del-draft" data-id="${p.id}">${icon('trash',12)}</button>
          </div>
        </div>
        <p class="text-sm" style="white-space:pre-wrap;line-height:1.65">${(p.content||'').slice(0,300)}${(p.content||'').length>300?'…':''}</p>
        ${p.notes?`<p class="text-xs text-muted mt-2 italic">${p.notes}</p>`:''}
      </div>`).join('')}</div>`;

    list.querySelectorAll('.mark-posted').forEach(btn => {
      btn.addEventListener('click', () => {
        const post = STATE.publish.posts.find(p=>p.id===btn.dataset.id);
        if (post) { post.status='posted'; saveState(); renderDraftsList(); renderTrackerList(); showToast('Marked as posted and moved to Tracker'); }
      });
    });
    list.querySelectorAll('.copy-draft').forEach(btn => btn.addEventListener('click', () => copyText(decodeURIComponent(btn.dataset.text), btn)));
    list.querySelectorAll('.del-draft').forEach(btn => {
      btn.addEventListener('click', () => { STATE.publish.posts=STATE.publish.posts.filter(p=>p.id!==btn.dataset.id); saveState(); renderDraftsList(); });
    });
  }
  renderDraftsList();

  // ── WEEK PLAN / NEXT POST ────────────────────────────────────────────────
  let selectedGoals = [];
  let selectedPGoal = 'LinkedIn';

  el.querySelectorAll('[data-goal]').forEach(c => c.addEventListener('click', () => {
    const g = c.dataset.goal;
    if (selectedGoals.includes(g)) selectedGoals = selectedGoals.filter(x=>x!==g);
    else selectedGoals.push(g);
    c.classList.toggle('selected', selectedGoals.includes(g));
  }));
  el.querySelectorAll('[data-pgoal]').forEach(c => c.addEventListener('click', () => {
    selectedPGoal = c.dataset.pgoal;
    el.querySelectorAll('[data-pgoal]').forEach(x=>x.classList.toggle('selected',x===c));
  }));

  el.querySelector('#gen-next-btn').addEventListener('click', async () => {
    const btn = el.querySelector('#gen-next-btn');
    const ctx = el.querySelector('#plan-context').value.trim();
    setLoading(btn, true, 'Writing post…');
    const myName2 = getUserProfile()?.name || 'the user';
    const res = await callAI(`Write ${myName2}'s NEXT POST based on what's happening right now.

Context: ${ctx||'No specific context — use brand defaults.'}
Goal: ${selectedGoals.length ? selectedGoals.join(', ') : 'Build authority and get DMs'}
Platform: ${selectedPGoal}

Write ONE complete, ready-to-publish post. No notes or explanations.
Make it feel exactly like what ${myName2} would say this week — specific, timely, in their own voice.`);
    setLoading(btn, false);
    if (res) {
      const area = el.querySelector('#next-post-result');
      area.innerHTML = '';
      area.appendChild(resultBox(res,'Your Next Post'));
    }
  });

  return el;
}
