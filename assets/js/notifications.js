// ── BRAND OS INTELLIGENCE ENGINE ───────────────────────────────────────────
// 4 systems: Post Reminders · News Alerts · Brand Nudges · Daily Brief
// Designed for Web2APK (WebView stays alive = timers fire reliably)

// Real first name for notification copy — was previously hardcoded to
// "Oga" everywhere below regardless of who was signed in. Falls back to
// a neutral "there" (not "Oga") for the rare case a profile has no name set.
function notifFirstName() {
  const profile = (typeof getUserProfile === 'function') ? getUserProfile() : null;
  const name = profile?.name || '';
  return name.split(' ')[0] || 'there';
}

// ── NOTIFICATION STATE (persisted in STATE.intel) ─────────────────────────
// STATE.intel is initialised in brand-config.js patch below via initIntelState()
function initIntelState() {
  if (!STATE.intel) {
    STATE.intel = {
      permission:      'default',   // 'granted' | 'denied' | 'default'
      newsInterval:    4,           // hours between news pulls
      lastNewsPull:    null,        // ISO timestamp
      lastNudge:       null,        // ISO timestamp
      dailyBriefDate:  null,        // YYYY-MM-DD — prevents re-generating same day
      dailyBrief:      null,        // cached brief text
      pendingNewsAngle: null,       // news angle waiting on dashboard
      postTimes:       {},          // { 'Monday': '09:00', 'Wednesday': '09:00', … }
      nudgeInterval:   8,           // hours between brand nudges
      enabled:         true
    };
  }
  // Merge any missing keys on upgrade
  const d = STATE.intel;
  if (d.newsInterval    === undefined) d.newsInterval    = 4;
  if (d.nudgeInterval   === undefined) d.nudgeInterval   = 8;
  if (d.postTimes       === undefined) d.postTimes       = {};
  if (d.enabled         === undefined) d.enabled         = true;
}

// ── SAVE intel into persistence ────────────────────────────────────────────
// FIXED: this used to write ONLY to localStorage and never reach the cloud
// (user_state table) at all — despite saveState() in brand-config.js
// already knowing how to save `intel` correctly to both places. That meant
// the Daily Brief cache, dismissed news angles, and notification settings
// never synced across devices/browsers, and could go stale in ways that
// looked like "the app isn't pulling fresh data."
function saveIntelState() {
  if (typeof saveState === 'function') { saveState(); return; }
  // Fallback if brand-config.js hasn't loaded yet for some reason —
  // local-only, better than losing the write entirely.
  try {
    const raw = localStorage.getItem(LS_KEY);
    const p   = raw ? JSON.parse(raw) : {};
    p.intel   = STATE.intel;
    localStorage.setItem(LS_KEY, JSON.stringify(p));
  } catch(e) {}
}
function loadIntelState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const p = JSON.parse(raw);
    if (p.intel) STATE.intel = { ...STATE.intel, ...p.intel };
  } catch(e) {}
}

// ── PERMISSION ─────────────────────────────────────────────────────────────
const VAPID_PUBLIC_KEY = 'BEyQNifDQZ9bEL-V-scnvOYVlaImKD7xw6uqc6Y5GZkR8hZDnGnKibnJyRlHEL84sQFLRJ-NUyOEIzkh6fqNumI';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

async function subscribeToPushReminders() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  if (!STATE.user?.session?.user?.id) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }
    const json = sub.toJSON();
    await SUPA.from('push_subscriptions').upsert({
      user_id: STATE.user.session.user.id,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      updated_at: new Date().toISOString()
    });
  } catch (e) { console.warn('[Brand OS] Push subscribe failed:', e.message); }
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') { STATE.intel.permission = 'granted'; await subscribeToPushReminders(); return true; }
  if (Notification.permission === 'denied')  { STATE.intel.permission = 'denied';  return false; }
  const result = await Notification.requestPermission();
  STATE.intel.permission = result;
  saveIntelState();
  if (result === 'granted') await subscribeToPushReminders();
  return result === 'granted';
}

function canNotify() {
  return ('Notification' in window) && Notification.permission === 'granted' && STATE.intel.enabled;
}

// ── FIRE A NOTIFICATION ────────────────────────────────────────────────────
function fireNotification(title, body, tag, navigateTo) {
  if (!canNotify()) {
    // Fallback: in-app toast if no permission
    showToast(`${title}: ${body.slice(0,60)}…`);
    return;
  }
  const n = new Notification(title, {
    body,
    tag,
    icon:  'assets/icons/icon-192.png',   // resolved relative to the page (app.html), not this script
    badge: 'assets/icons/icon-72.png',
    requireInteraction: false,
    silent: false
  });
  if (navigateTo) {
    n.onclick = () => { window.focus(); navigate(navigateTo); n.close(); };
  }
}

// ── SYSTEM 1: POST REMINDERS ───────────────────────────────────────────────
// Fires 30 min before each scheduled active post day (based on publish schedule)
// Checks every minute via setInterval started at boot

let _postReminderInterval = null;

function startPostReminders() {
  if (_postReminderInterval) clearInterval(_postReminderInterval);
  _postReminderInterval = setInterval(checkPostReminders, 60 * 1000); // every 1 min
  checkPostReminders(); // immediate check on boot
}

function checkPostReminders() {
  if (!STATE.intel.enabled) return;
  const schedule = STATE.publish?.schedule || [];
  const now      = new Date();
  const dayName  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][now.getDay()];
  const hh       = now.getHours();
  const mm       = now.getMinutes();

  schedule.forEach(entry => {
    if (!entry.active || entry.type === 'Off' || entry.day !== dayName) return;

    // Get the post time for this day (default 09:00 if not set)
    const postTime  = (STATE.intel.postTimes[dayName] || '09:00').split(':');
    const postH     = parseInt(postTime[0]);
    const postM     = parseInt(postTime[1]);

    // Calculate 30-min-before window
    let remH = postH, remM = postM - 30;
    if (remM < 0) { remH -= 1; remM += 60; }

    // Fire if we're within the 1-minute window of the reminder time
    if (hh === remH && mm === remM) {
      const tag = `post-reminder-${dayName}-${postH}${postM}`;
      fireNotification(
        `⏰ Post time in 30 minutes, ${notifFirstName()}`,
        `Your ${entry.type} on ${entry.platform} is due at ${postTime[0]}:${postTime[1]}. Tap to write it.`,
        tag,
        'content'
      );
    }
  });
}

// ── SYSTEM 2: NEWS-TRIGGERED POST ALERTS (every 4 hours) ──────────────────
let _newsAlertInterval = null;

function startNewsAlerts() {
  if (_newsAlertInterval) clearInterval(_newsAlertInterval);
  const intervalMs = (STATE.intel.newsInterval || 4) * 60 * 60 * 1000;
  _newsAlertInterval = setInterval(runNewsAlert, intervalMs);

  // Also run if last pull was >4 hours ago (on app open)
  const last = STATE.intel.lastNewsPull ? new Date(STATE.intel.lastNewsPull) : null;
  const diff = last ? (Date.now() - last.getTime()) : Infinity;
  if (diff >= intervalMs) {
    setTimeout(runNewsAlert, 8000); // delay 8s after boot so AI engine is ready
  }
}

async function runNewsAlert() {
  if (!STATE.intel.enabled) return;
  if (!STATE.aiAvailable) return; // AI not configured server-side

  STATE.intel.lastNewsPull = new Date().toISOString();
  saveIntelState();

  // Try live news first, fall back to AI-only if no shared NewsAPI key
  let newsContext = '';
  if (STATE.newsAvailable) {
    const profile = getUserProfile ? getUserProfile() : null;
    const regional = profile?.brand_extra?.regional_context || '';
    const audience = profile?.audience || '';
    const newsQuery = regional || audience || 'entrepreneurs coaching AI business';
    const result = await fetchNews(newsQuery);
    if (result.ok && result.items.length) {
      newsContext = result.items.slice(0,3).map(i => `- ${i.title} (${i.source})`).join('\n');
    }
  }

  const briefProfile = getUserProfile ? getUserProfile() : null;
  const briefName     = briefProfile?.name || 'this user';
  const briefAudience = briefProfile?.audience || 'their audience';

  const prompt = newsContext
    ? `You are ${briefName}'s brand intelligence system.

Here are 3 real news headlines right now:
${newsContext}

Pick the ONE headline most relevant to ${briefAudience}.
Generate a punchy, on-voice post ANGLE (not the full post) in 2 sentences max.
Format exactly:
HEADLINE: [the headline you chose]
ANGLE: [2-sentence on-voice hook/angle]`

    : `You are ${briefName}'s brand intelligence system.
Generate ONE timely, relevant post angle for ${briefAudience} RIGHT NOW.
Think: what's happening in this person's industry, market, or audience's world right now?
Format exactly:
HEADLINE: [a real trend or tension happening now]
ANGLE: [2-sentence on-voice hook/angle — direct, names the real tension]`;

  const res = await callAI(prompt, 'You are a brand intelligence assistant. Be concise and sharp.');
  if (!res) return;

  const headline = (res.match(/HEADLINE:\s*(.+)/i)||[])[1]?.trim() || 'Something worth posting about';
  const angle    = (res.match(/ANGLE:\s*([\s\S]+)/i)||[])[1]?.trim() || res.trim();

  // Store for dashboard pickup
  STATE.intel.pendingNewsAngle = { headline, angle, ts: new Date().toISOString() };
  saveIntelState();

  fireNotification(
    `📰 New post idea from the news, ${notifFirstName()}`,
    `${headline} — tap to see it.`,
    'news-alert',
    'dashboard'
  );
}

// ── SYSTEM 3: BRAND INTELLIGENCE NUDGES ───────────────────────────────────
// Internal awareness alerts — pillar gaps, posting streaks, etc.
let _nudgeInterval = null;

function startBrandNudges() {
  if (_nudgeInterval) clearInterval(_nudgeInterval);
  const intervalMs = (STATE.intel.nudgeInterval || 8) * 60 * 60 * 1000;
  _nudgeInterval = setInterval(runBrandNudge, intervalMs);
}

function runBrandNudge() {
  if (!STATE.intel.enabled) return;

  const nudges = buildNudges();
  if (!nudges.length) return;

  const pick = nudges[Math.floor(Math.random() * nudges.length)];
  STATE.intel.lastNudge = new Date().toISOString();
  saveIntelState();

  fireNotification(
    pick.title,
    pick.body,
    'brand-nudge-' + Date.now(),
    pick.page || 'dashboard'
  );
}

function buildNudges() {
  const nudges = [];
  const posts   = STATE.publish?.posts || [];
  const schedule= STATE.publish?.schedule || [];
  const now     = new Date();

  // Check last posted date
  const lastPost = posts.filter(p => p.status === 'posted').sort((a,b) => b.date.localeCompare(a.date))[0];
  if (lastPost) {
    const daysSince = Math.floor((now - new Date(lastPost.date)) / 86400000);
    if (daysSince >= 3) {
      nudges.push({
        title: `You haven't posted in ${daysSince} days`,
        body:  `It's been ${daysSince} days since your last post. Post something today to stay visible.`,
        page:  'content'
      });
    }
  }

  // Check pillar balance
  const pillarCounts = {};
  CONTENT_PILLARS.forEach(p => pillarCounts[p] = 0);
  posts.filter(p => p.status==='posted' && p.pillar).forEach(p => {
    if (pillarCounts[p.pillar] !== undefined) pillarCounts[p.pillar]++;
  });
  const coldPillar = Object.entries(pillarCounts).sort((a,b)=>a[1]-b[1])[0];
  if (coldPillar && coldPillar[1] === 0) {
    nudges.push({
      title: `You haven't posted about "${coldPillar[0]}"`,
      body:  `You haven't written anything on "${coldPillar[0]}" yet. Try one post on this topic.`,
      page:  'content'
    });
  }

  // Check draft backlog
  const drafts = posts.filter(p => p.status === 'draft').length;
  if (drafts >= 3) {
    nudges.push({
      title: `${drafts} drafts waiting`,
      body:  `You have ${drafts} saved drafts. Finish one and post it.`,
      page:  'publish'
    });
  }

  // Check if today has an active schedule slot not yet posted
  const dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][now.getDay()];
  const todaySlot = schedule.find(s => s.day === dayName && s.active && s.type !== 'Off');
  const todayPosted = posts.some(p => p.date === now.toISOString().split('T')[0] && p.status === 'posted');
  if (todaySlot && !todayPosted) {
    nudges.push({
      title: `Today's post isn't done yet`,
      body:  `${todaySlot.type} on ${todaySlot.platform} was planned for today. You haven't posted it yet.`,
      page:  'content'
    });
  }

  // Always-available generic nudges (voice-on-brand)
  const generic = [
    { title: `You just need one idea`, body: `You don't need a big plan. Just one true thing to say today. What is it?`, page: 'content' },
    { title: `Reuse an old post`, body: `Take your best LinkedIn post from this month and turn it into an Instagram caption or a WhatsApp message. You already did the hard part.`, page: 'content' },
    { title: `Check what's trending`, body: `Something new may be happening in your field this week. Check Discover — it takes 30 seconds.`, page: 'discover' },
    { title: `Have you asked for the sale lately?`, body: `Some posts should just ask people to buy or book a call. When did you last do that clearly, not just hint at it?`, page: 'offers' },
    { title: `Check your bio`, body: `Your bio is often the first thing people read. Is it still true? Does it talk about their problem before yours?`, page: 'positioning' },
  ];
  nudges.push(...generic);

  return nudges;
}

// ── SYSTEM 4: DAILY BRIEF (runs on dashboard load) ────────────────────────
// Builds a short fingerprint of "the facts that would make today's brief
// wrong if they changed" — today's post status, draft count, coldest
// pillar. Used so the brief regenerates the moment something real
// changes (e.g. you post today's content), instead of staying frozen
// until midnight or a manual refresh even though it's now stale.
function briefFreshnessSignature() {
  const now      = new Date();
  const dayName  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][now.getDay()];
  const todayISO = now.toISOString().split('T')[0];
  const schedule = STATE.publish?.schedule || [];
  const todaySlot= schedule.find(s => s.day === dayName && s.active && s.type !== 'Off');
  const posts    = STATE.publish?.posts || [];
  const postedToday = posts.some(p => p.date === todayISO && p.status === 'posted');
  const drafts   = posts.filter(p=>p.status==='draft').length;
  const lastPost = posts.filter(p=>p.status==='posted').sort((a,b)=>b.date.localeCompare(a.date))[0];
  return [todaySlot?.type||'none', postedToday, drafts, lastPost?.date||'none'].join('|');
}

// ── STREAK ENGINE ───────────────────────────────────────────────────────────
// Derived entirely from real post history (STATE.publish.posts) — never a
// separate counter that can drift out of sync with what actually happened.
// A streak counts consecutive calendar days with at least one posted item,
// walking backward from today. Today itself doesn't break a streak just for
// being incomplete — the day isn't over yet.
//
// One "freeze" per calendar month: if exactly one day in the current streak
// was missed, and a freeze hasn't already been used for that same gap, the
// engine quietly covers it instead of resetting the streak to zero. This is
// a loss-aversion mechanic on purpose — a single bad day shouldn't erase two
// weeks of real effort.
function computeStreak() {
  if (!STATE.streak) STATE.streak = { freezesAvailable: 1, freezesResetMonth: '', freezesUsedDates: [] };
  const streakState = STATE.streak;

  const thisMonth = new Date().toISOString().slice(0,7); // YYYY-MM
  if (streakState.freezesResetMonth !== thisMonth) {
    streakState.freezesResetMonth = thisMonth;
    streakState.freezesAvailable  = 1;
    streakState.freezesUsedDates  = [];
    saveIntelState(); // piggybacks on the same save path — see saveState() in brand-config.js
  }

  const posts     = STATE.publish?.posts || [];
  const postedSet = new Set(posts.filter(p => p.status === 'posted').map(p => p.date));

  const toISO = d => d.toISOString().split('T')[0];
  const today = new Date();
  today.setHours(0,0,0,0);

  let cursor = new Date(today);
  if (!postedSet.has(toISO(cursor))) cursor.setDate(cursor.getDate() - 1); // today doesn't have to be done yet

  let current = 0;
  let freezesLeftThisWalk = streakState.freezesAvailable;
  let pendingFreezeDate = null; // a gap tentatively bridged — only counts if a real posted day confirms it on the other side
  let usedFreezeOn = null;

  while (true) {
    const iso = toISO(cursor);
    if (postedSet.has(iso)) {
      current++;
      if (pendingFreezeDate) { usedFreezeOn = pendingFreezeDate; pendingFreezeDate = null; }
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    // Missed day. Only one un-confirmed freeze can be pending at a time —
    // hitting a second gap before the first is confirmed means the streak
    // genuinely ends here, not "freeze twice in a row".
    if (pendingFreezeDate) break;
    if (freezesLeftThisWalk > 0 && !streakState.freezesUsedDates.includes(iso)) {
      freezesLeftThisWalk--;
      pendingFreezeDate = iso;
      current++; // tentative — rolled back below if never confirmed
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    break;
  }

  // If the walk ended still "waiting" on a freeze that was never confirmed
  // by a real posted day beyond it, that tentative day doesn't actually
  // count — it was just the empty space before the streak began.
  if (pendingFreezeDate) current--;
  else if (usedFreezeOn && !streakState.freezesUsedDates.includes(usedFreezeOn)) {
    streakState.freezesUsedDates.push(usedFreezeOn);
    streakState.freezesAvailable = Math.max(0, streakState.freezesAvailable - 1);
    saveIntelState();
  }

  // "At risk" — has an active streak, hasn't posted today yet, and it's
  // afternoon or later (so there's real urgency, not a false alarm at 7am).
  const postedToday = postedSet.has(toISO(today));
  const atRisk = current > 0 && !postedToday && new Date().getHours() >= 14;

  return {
    current,
    postedToday,
    atRisk,
    freezesAvailable: streakState.freezesAvailable
  };
}

async function generateDailyBrief() {
  if (!STATE.aiAvailable) return null;
  if (!STATE.intel) STATE.intel = {}; // belt-and-suspenders — see the STATE.intel default in brand-config.js

  const today = new Date().toISOString().split('T')[0];
  const sig   = briefFreshnessSignature();
  if (STATE.intel.dailyBriefDate === today && STATE.intel.dailyBriefSig === sig && STATE.intel.dailyBrief) {
    return STATE.intel.dailyBrief; // cached — nothing relevant has changed since it was generated
  }

  const now      = new Date();
  const dayName  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][now.getDay()];
  const schedule = STATE.publish?.schedule || [];
  const todaySlot= schedule.find(s => s.day === dayName && s.active && s.type !== 'Off');
  const posts    = STATE.publish?.posts || [];
  const lastPost = posts.filter(p=>p.status==='posted').sort((a,b)=>b.date.localeCompare(a.date))[0];
  const drafts   = posts.filter(p=>p.status==='draft').length;

  const pillarCounts = {};
  CONTENT_PILLARS.forEach(p => pillarCounts[p] = 0);
  posts.filter(p=>p.status==='posted'&&p.pillar).forEach(p=>{ if(pillarCounts[p.pillar]!==undefined) pillarCounts[p.pillar]++; });
  const coldPillar = Object.entries(pillarCounts).sort((a,b)=>a[1]-b[1])[0]?.[0];
  const briefName = (getUserProfile ? getUserProfile()?.name : null) || 'this user';

  const prompt = `You are ${briefName}'s Brand OS daily intelligence system. Generate a short, sharp Daily Brief for today (${dayName}, ${today}).

Context:
- Today's scheduled post: ${todaySlot ? `${todaySlot.type} on ${todaySlot.platform}` : 'Nothing scheduled'}
- Last published: ${lastPost ? lastPost.date : 'No posts logged yet'}
- Drafts waiting: ${drafts}
- Coldest content pillar: ${coldPillar}

Deliver exactly 3 things in this format:
📌 TODAY: [One sentence — what to focus on today, specific to the schedule above]
🔥 ANGLE: [One Yomi-voice content angle worth exploring today — direct, specific, non-obvious]
⚠️ WATCH: [One brand intelligence warning or pattern to be aware of this week]

No preamble. No sign-off. Just those 3 lines.`;

  const res = await callAI(prompt, 'You are a sharp brand intelligence assistant. Be concise, direct, Yomi-voice.');
  if (!res) return null;

  STATE.intel.dailyBriefDate = today;
  STATE.intel.dailyBriefSig  = sig;
  STATE.intel.dailyBrief     = res.trim();
  saveIntelState();
  return STATE.intel.dailyBrief;
}

// ── NOTIFICATION SETTINGS PANEL (rendered inside Profile page) ────────────
function renderNotificationSettings() {
  const S = STATE.intel;
  const granted = ('Notification' in window) && Notification.permission === 'granted';

  const el = document.createElement('div');
  el.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div class="card-title">Reminders & Alerts</div>
        <div class="card-desc">Post reminders, news ideas, and helpful nudges</div>
      </div>
      <div class="space-y-5">

        <div class="flex items-center justify-between">
          <div>
            <p class="font-semibold text-sm">Notifications</p>
            <p class="text-xs text-muted mt-1">${granted ? '✅ Permission granted' : '⚠️ Not yet enabled — tap to allow'}</p>
          </div>
          <button id="notif-perm-btn" class="btn ${granted?'btn-outline btn-sm':'btn-primary btn-sm'}">
            ${granted ? 'Enabled' : 'Enable Alerts'}
          </button>
        </div>

        <div class="flex items-center justify-between">
          <div>
            <p class="font-semibold text-sm">All Alerts</p>
            <p class="text-xs text-muted mt-1">Master on/off switch</p>
          </div>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input type="checkbox" id="intel-enabled" ${S.enabled?'checked':''}>
            <span class="text-sm">${S.enabled?'On':'Off'}</span>
          </label>
        </div>

        <div class="nav-divider"></div>

        <div>
          <p class="font-semibold text-sm mb-3">Post Reminder Times</p>
          <p class="text-xs text-muted mb-3">Set the time you plan to post each active day. Reminder fires 30 min before.</p>
          <div class="space-y-2" id="post-times-grid">
            ${(STATE.publish?.schedule||[]).filter(s=>s.active&&s.type!=='Off').map(s=>`
              <div class="flex items-center justify-between">
                <span class="text-sm font-semibold" style="width:110px">${s.day}</span>
                <span class="text-xs text-muted" style="flex:1">${s.type} · ${s.platform}</span>
                <input type="time" class="input post-time-input" style="width:110px;padding:0.3rem 0.5rem" data-day="${s.day}" value="${S.postTimes[s.day]||'09:00'}">
              </div>`).join('') || '<p class="text-xs text-muted">No active post days set in Publish → Calendar.</p>'}
          </div>
        </div>

        <div class="nav-divider"></div>

        <div class="grid-2">
          <div>
            <label>How often to check the news</label>
            <select class="select-el mt-1" id="news-interval">
              ${[2,4,6,8,12].map(h=>`<option value="${h}" ${S.newsInterval==h?'selected':''}>${h} hours</option>`).join('')}
            </select>
          </div>
          <div>
            <label>How often to send nudges</label>
            <select class="select-el mt-1" id="nudge-interval">
              ${[4,6,8,12,24].map(h=>`<option value="${h}" ${S.nudgeInterval==h?'selected':''}>${h} hours</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="flex gap-2 flex-wrap">
          <button id="test-notif-btn" class="btn btn-outline btn-sm">🔔 Test Notification</button>
          <button id="test-nudge-btn" class="btn btn-outline btn-sm">🧠 Test Brand Nudge</button>
          <button id="test-news-btn"  class="btn btn-outline btn-sm">📰 Test News Alert</button>
          <button id="clear-brief-btn" class="btn btn-ghost btn-sm">↺ Refresh Daily Brief</button>
        </div>

      </div>
    </div>`;

  // Permission
  el.querySelector('#notif-perm-btn').addEventListener('click', async () => {
    const ok = await requestNotificationPermission();
    showToast(ok ? '✅ Notifications enabled' : '❌ Permission denied — check browser settings', !ok);
    navigate('profile');
  });

  // Master toggle
  el.querySelector('#intel-enabled').addEventListener('change', e => {
    S.enabled = e.target.checked;
    saveIntelState();
    showToast(S.enabled ? 'Alerts enabled' : 'Alerts paused');
  });

  // Post times
  el.querySelectorAll('.post-time-input').forEach(inp => {
    inp.addEventListener('change', () => {
      S.postTimes[inp.dataset.day] = inp.value;
      saveIntelState();
      showToast(`${inp.dataset.day} reminder set for ${inp.value}`);
    });
  });

  // Intervals
  el.querySelector('#news-interval').addEventListener('change', e => {
    S.newsInterval = parseInt(e.target.value);
    saveIntelState();
    startNewsAlerts(); // restart with new interval
    showToast(`News pull every ${S.newsInterval} hours`);
  });
  el.querySelector('#nudge-interval').addEventListener('change', e => {
    S.nudgeInterval = parseInt(e.target.value);
    saveIntelState();
    startBrandNudges();
    showToast(`Brand nudges every ${S.nudgeInterval} hours`);
  });

  // Test buttons
  el.querySelector('#test-notif-btn').addEventListener('click', () => {
    fireNotification('🔔 Brand OS Alert Test', `Notifications are working. ${notifFirstName()}, the system is live.`, 'test', 'dashboard');
    showToast('Test notification fired');
  });
  el.querySelector('#test-nudge-btn').addEventListener('click', () => { runBrandNudge(); showToast('Brand nudge fired'); });
  el.querySelector('#test-news-btn').addEventListener('click', async () => {
    showToast('Pulling news angle…');
    await runNewsAlert();
    showToast('News alert fired — check dashboard');
  });
  el.querySelector('#clear-brief-btn').addEventListener('click', () => {
    STATE.intel.dailyBriefDate = null;
    STATE.intel.dailyBrief     = null;
    saveIntelState();
    showToast('Daily Brief will regenerate on next dashboard visit');
  });

  return el;
}

// ── BOOT: start all systems ────────────────────────────────────────────────
function bootIntelligenceEngine() {
  initIntelState();
  loadIntelState();
  startPostReminders();
  startNewsAlerts();
  startBrandNudges();
}
