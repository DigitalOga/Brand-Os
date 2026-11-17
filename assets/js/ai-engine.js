// ── TOAST ──────────────────────────────────────────────────────────────────
function showToast(msg, isError=false) {
  // Multi-provider failures from ai-proxy.php can be long (one clause per
  // provider tried) — truncate so the toast stays readable instead of
  // becoming a wall of text; the full detail is still in the browser console.
  const MAX_LEN = 220;
  const shown = (msg && msg.length > MAX_LEN) ? msg.slice(0, MAX_LEN).trim() + '…' : msg;
  if (isError && msg !== shown) console.warn('[Brand OS] Full error:', msg);

  const el = document.createElement('div');
  el.className = 'toast' + (isError ? ' error' : '');
  el.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="${isError ? 'M18 6L6 18M6 6l12 12' : 'M20 6L9 17l-5-5'}"/></svg> <span>${shown}</span>`;
  el.title = 'Tap to dismiss';
  el.addEventListener('click', () => el.remove());
  document.getElementById('toast-container').appendChild(el);
  // Errors stay up longer (6.5s) since they're often longer/more important
  // to actually read than a quick success confirmation (3s).
  setTimeout(() => el.remove(), isError ? 6500 : 3000);
}

// ── SHARED PHP PROXY ─────────────────────────────────────────────────────
// Everything routes through ai-proxy.php, which sits in this same folder
// (same-origin — no CORS headaches). The real provider keys live only in
// config/keys-store.php on the server; nothing key-related ever reaches
// this browser. This replaces the old Supabase Edge Function entirely.
async function callProxy(action, payload) {
  const { data: { session } } = await SUPA.auth.getSession();
  if (!session) throw new Error('Not signed in');
  const res = await fetch(`ai-proxy.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
    body: JSON.stringify({ action, ...payload })
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    const detailText = data.detail ? (typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail)) : '';
    throw new Error(detailText ? `${data.error}: ${detailText}` : (data.error || 'Proxy request failed'));
  }
  return data;
}

// ── SINGLE AI CALL ───────────────────────────────────────────────────────
// No client-side provider list/order anymore — ai-proxy.php tries every
// shared provider that has a key configured, in order, and falls back
// automatically. The browser just asks and gets text back.
async function callAI(prompt) {
  if (STATE.aiAvailable === false) {
    showToast('AI engine is not configured yet — contact your admin', true);
    return null;
  }
  try {
    const data = await callProxy('generate', { prompt });
    return data.text;
  } catch (e) {
    showToast(`AI request failed: ${e.message}`, true);
    return null;
  }
}

const callClaude = callAI;

// ── PERSISTENT ASSISTANT WIDGET (personalized chat) ─────────────────────
async function callAssistant(prompt, history = []) {
  try {
    const data = await callProxy('assistant', { prompt, history });
    return data.text;
  } catch (e) {
    return `Sorry — I couldn't reach the assistant just now (${e.message}).`;
  }
}

// ── ONBOARDING WELCOME MESSAGE ───────────────────────────────────────────
async function fetchPersonalizedWelcome(profile) {
  try {
    const { data: { session } } = await SUPA.auth.getSession();
    if (!session) return null;
    const res = await fetch(`ai-proxy.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ action: 'welcome', profile })
    });
    const data = await res.json();
    return data.text || null;
  } catch (e) { return null; }
}

// ── STATUS CHECK (at boot — is AI/News/YouTube configured server-side?) ──
async function fetchAiStatus() {
  try {
    const { data: { session } } = await SUPA.auth.getSession();
    if (!session) return;
    const res = await fetch(`ai-proxy.php?action=status`, {
      headers: { 'Authorization': `Bearer ${session.access_token}` }
    });
    const data = await res.json();
    STATE.aiAvailable   = !!data.available;
    STATE.newsAvailable = !!data.news;
    STATE.ytAvailable   = !!data.youtube;
  } catch (e) {
    STATE.aiAvailable = true; // fail open on a network hiccup rather than blocking the whole UI
  }
}

// ── LIVE DATA ──────────────────────────────────────────────────────────────
async function fetchNews(query) {
  try {
    const data = await callProxy('news', { query });
    return { ok: data.ok, items: (data.items||[]).map(a=>({ title:a.title, source:a.source?.name||'', date:(a.publishedAt||'').slice(0,10), desc:a.description||'', url:a.url })) };
  } catch(e) { return { ok:false, reason:'no-key', items:[] }; }
}

async function fetchYouTube(query) {
  try {
    const data = await callProxy('youtube', { query });
    return { ok: data.ok, items: (data.items||[]).map(v=>({ title:v.snippet?.title||'', channel:v.snippet?.channelTitle||'', date:(v.snippet?.publishedAt||'').slice(0,10), url:`https://youtube.com/watch?v=${v.id?.videoId||''}` })) };
  } catch(e) { return { ok:false, reason:'no-key', items:[] }; }
}
