// ── BRAND CONTEXT ──────────────────────────────────────────────────────────
// This file ships to every browser, logged in or not — so it deliberately
// contains ZERO brand-specific or prompt-engineering content. No persona
// text, no banned-phrase list, no delivery-spine template, nothing that
// would hand a competitor (or any anonymous visitor via view-source /
// DevTools) a copy of the actual voice/prompt recipe. All of that —
// per-user brand data (persona, guardrails, key phrases, proof bank) AND
// the shared ANTI_GENERIC_RULES ruleset — lives ONLY server-side, in
// ai-proxy.php, which nobody outside the server can ever read. The
// browser sends a bare task prompt; the server independently rebuilds the
// full system prompt itself from the `profiles` row and never trusts
// anything the client sends for it.
// ── ANTI-GENERIC RULES + FULL SYSTEM PROMPT BUILDING ────────────────────
// REMOVED FROM HERE ON PURPOSE. This used to build a full copy of the
// system prompt (banned phrases, formatting rules, persona/delivery-spine
// template) client-side into a BASE_SYSTEM_PROMPT variable — but nothing
// ever actually read that variable. ai-proxy.php independently rebuilds
// the complete, authoritative system prompt server-side from the same
// `profiles` row (see buildSystemPromptFromProfile() there) and never
// trusts anything the browser sends for it. So this entire block was
// pure dead weight that did nothing except ship the whole prompt-
// engineering recipe — including the exact banned-phrase list and every
// user's persona/delivery-spine template shape — to any visitor who
// opened dev tools or view-source, logged in or not. Deleting it changes
// nothing about how generation actually behaves; the real enforcement
// was always server-side.

const CHANNEL_FLEX = {
  'LinkedIn Post': `One-line confession hook, lots of white space, fragments fine. Door = a comment prompt or soft DM ask.`,
  'Instagram':     `Hook in the first line. Tight, punchy, scannable. Door = "DM me [word]" or link-in-bio.`,
  'Email':         `Open mid-scene, conversational. Story can run longer. Door = one link to free value OR tiered links.`,
  'WhatsApp':      `Skip the long story. Lead with the reframe. Very tight, voice-note energy. Very short.`,
  'Video Script':  `Strong hook up front. Mark [PAUSE] beats and the single on-screen line.`
};

function channelBrief(type) {
  return CHANNEL_FLEX[type] || `Flex naturally to the format: ${type}.`;
}

// ── PER-USER OVERRIDE (multi-tenant) ────────────────────────────────────────
// CONTENT_PILLARS starts generic and gets swapped for each signed-in
// user's own pillars (fetched from their profile row) via
// applyUserBrandConfig(), called once per login from main.js. `let`-bound
// so every page reading it as a live global always gets the current
// user's own values, never a hardcoded default.
let CONTENT_PILLARS = [
  "Lessons Learned", "Behind the Work", "Industry Insight",
  "Client Wins", "Personal Story", "Practical How-To"
];

const BOTTLENECK_STAGES = [
  { value:"0-100k",   label:"0–100k (Proof)" },
  { value:"100-250k", label:"100–250k (Product)" },
  { value:"250-500k", label:"250–500k (Systems)" },
  { value:"500k-1M",  label:"500k–1M (Leverage)" },
  { value:"1M+",      label:"1M+ (Ecosystem)" }
];

// Reads each signed-in user's own bio fields (populated via onboarding's
// AI Discovery step or Profile settings) instead of a hardcoded bio.
function getMyBios() {
  const p = (typeof getUserProfile === 'function') ? getUserProfile() : null;
  return [
    { label:"Short (Social)",            text: p?.bio_short  || "Add your short bio in Profile settings to see it here." },
    { label:"Medium (Speaking/Podcast)", text: p?.bio_medium || "Add your medium-length bio in Profile settings to see it here." },
    { label:"Long (About Page)",         text: p?.bio_long   || "Add your long bio in Profile settings to see it here." }
  ];
}

const CONTENT_TYPES   = ["LinkedIn Post","Instagram","Email","WhatsApp","Video Script"];
const CONTENT_MODES   = ["Full critique","Rewrite it","Strengthen hook","Add CTA","Make it more Yomi"];
const CONTENT_FORMATS = ["LinkedIn story","Short insight","Thread starter","Contrarian take"];

const SOURCES = [
  { id:"news",     label:"News",         emoji:"📰", live:true  },
  { id:"youtube",  label:"YouTube",      emoji:"▶️", live:true  },
  { id:"reddit",   label:"Reddit",       emoji:"🟠", aiOnly:true },
  { id:"ddg",      label:"DuckDuckGo",   emoji:"🔍", aiOnly:true },
  { id:"linkedin", label:"LinkedIn",     emoji:"💼", aiOnly:true },
  { id:"twitter",  label:"Twitter/X",    emoji:"𝕏",  aiOnly:true },
  { id:"africa",   label:"Africa / SME", emoji:"🌍", aiOnly:true },
  { id:"podcasts", label:"Podcasts",     emoji:"🎙", aiOnly:true }
];

// ── PUBLISH MODULE CONSTANTS ──────────────────────────────────────────────
const DAYS       = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const POST_TYPES = ['Visibility Post','Authority / Lead Post','Community Post','Personal Brand Post','Engagement Post','Off'];
const PLATFORMS  = ['LinkedIn','Instagram','WhatsApp','Twitter/X','YouTube','TikTok'];
const VIDEO_STYLES = ['Talking head (solo)','Screen share / Tutorial','Voiceover + slides','Reels / Short-form','Interview / Podcast clip'];

const DEFAULT_SCHEDULE = [
  { day:'Monday',    type:'Visibility Post',       platform:'LinkedIn', active:true  },
  { day:'Tuesday',   type:'Off',                   platform:'LinkedIn', active:false },
  { day:'Wednesday', type:'Authority / Lead Post', platform:'LinkedIn', active:true  },
  { day:'Thursday',  type:'Community Post',        platform:'LinkedIn', active:true  },
  { day:'Friday',    type:'Off',                   platform:'LinkedIn', active:false },
  { day:'Saturday',  type:'Personal Brand Post',   platform:'LinkedIn', active:true  },
  { day:'Sunday',    type:'Off',                   platform:'LinkedIn', active:false },
];

// ── EXAMPLE POST LIBRARY ────────────────────────────────────────────────────
// Real or real-style posts in Yomi's voice, tagged by pillar + channel.
// EXAMPLE_POSTS used to hardcode Yomi's actual real posts here as a
// public constant — moved into his own profiles.brand_extra.example_posts
// (same protection as everyone else's voice library). pickExamples()
// below now draws only from STATE.voiceLibrary, which gets populated from
// each signed-in user's own profile at login — nothing hardcoded, nothing
// shipped to visitors who have not authenticated.
const EXAMPLE_POSTS = [];

/**
 * Return n example posts as a formatted few-shot block.
 * Draws from STATE.voiceLibrary (user-added posts) first, then falls back
 * to the built-in EXAMPLE_POSTS seeds so there is always something even
 * before the user has added anything.
 * Shuffles every call so repeated generations get different examples.
 */
function pickExamples(n = 3, { pillar = null, channel = null } = {}) {
  const userPosts = (STATE && STATE.voiceLibrary) ? STATE.voiceLibrary : [];
  const combined  = [...userPosts, ...EXAMPLE_POSTS];

  // Shuffle so every call gets a fresh draw
  const shuffled = combined.sort(() => Math.random() - 0.5);

  // Prefer posts that share the pillar OR channel, then fill from the rest
  const preferred = shuffled.filter(p =>
    (pillar  && p.pillar  === pillar)  ||
    (channel && p.channel === channel)
  );
  const rest = shuffled.filter(p => !preferred.includes(p));
  const pool = [...preferred, ...rest].slice(0, n);

  return pool.map((p, i) =>
    `--- EXAMPLE ${i + 1} (${p.pillar || 'General'} · ${p.channel || 'General'}) ---\n${p.text.trim()}`
  ).join('\n\n');
}

// ── SESSION STATE ──────────────────────────────────────────────────────────
// NOTE: there used to be a client-side PROVIDERS registry + per-user
// personal API keys (bring-your-own-key) here. That's gone — every LLM /
// NewsAPI / YouTube key is now shared, admin-managed, and lives only in
// ai-proxy.php's config/keys-store.php on the server. STATE.aiAvailable /
// newsAvailable / ytAvailable (set by fetchAiStatus() in ai-engine.js) are
// the only client-side signal of what's configured — booleans only, never
// key values.
const STATE = {
  aiAvailable: true,
  newsAvailable: false,
  ytAvailable: false,
  remember: true,
  theme: 'dark',
  usage: {},          // { toolId: { count, last } } — drives adaptive Studio order
  pins: [],           // toolIds the user locked to the front
  currentPage: 'dashboard',
  coaching:    { messages: [{ role:'ai', content:'I am ready. Ask me anything about strategy, positioning, or offers.' }] },
  content:     { activeTab:'analyze', draft:'', type:CONTENT_TYPES[0], pillar:CONTENT_PILLARS[0], mode:CONTENT_MODES[0], topic:'', format:CONTENT_FORMATS[0], analyzeResult:'', quickResult:'' },
  discover:    { query:'', sources:['news','reddit','africa'], paste:'', showPaste:false, result:null, raw:'' },
  feedback:    { data:'', context:'', result:'' },
  trends:      { topic:'', result:'' },
  positioning: { stage:BOTTLENECK_STAGES[0].value, draft:'', result:'' },
  offers:      { stage:BOTTLENECK_STAGES[1].value, problem:'', result:'' },
  llm:         { prompt:'', results:[] },
  intel:       {},   // daily brief cache — { dailyBriefDate, dailyBrief }, filled in by notifications.js
  streak:      { freezesAvailable: 1, freezesResetMonth: '', freezesUsedDates: [] }, // see computeStreak() in notifications.js
  publish: {
    activeTab:      'calendar',
    schedule:       JSON.parse(JSON.stringify(DEFAULT_SCHEDULE)),
    posts:          [],
    drafts:         [],
    videoTopic:     '',
    videoStyle:     VIDEO_STYLES[0],
    videoPillar:    '',
    videoResult:    '',
    nextPostResult: ''
  },
  voiceLibrary: []   // user-added example posts; persisted to localStorage
};

// ── PERSISTENCE ────────────────────────────────────────────────────────────
const LS_KEY = 'brandos.v4';
function saveState() {
  try {
    if (!STATE.remember) { localStorage.removeItem(LS_KEY); return; }
    const payload = {
      remember: STATE.remember,
      theme: STATE.theme,
      usage: STATE.usage,
      pins: STATE.pins,
      publish: { posts: STATE.publish.posts, drafts: STATE.publish.drafts, schedule: STATE.publish.schedule },
      intel: STATE.intel || null,
      voiceLibrary: STATE.voiceLibrary || [],
      signature: STATE.signature || null,
      streak: STATE.streak || null
    };
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
    // Mirror to Supabase per-user cloud state when a user is signed in, so
    // Joy's posts/calendar/voice library live under her account, not mixed
    // into whichever browser's localStorage happens to be open.
    if (STATE.user && STATE.user.session && STATE.user.session.user) {
      saveUserStateDebounced(STATE.user.session.user.id, payload);
    }
  } catch(e) {}
}
// Applies a previously-saved cloud payload (same shape as saveState's
// `payload`) on top of STATE. Used on login instead of localStorage when a
// user has cloud state already saved.
function applyStatePayload(p) {
  if (!p) return;
  try {
    if (p.theme) STATE.theme = p.theme;
    if (p.usage && typeof p.usage === 'object') STATE.usage = p.usage;
    if (Array.isArray(p.pins)) STATE.pins = p.pins;
    if (p.publish) {
      if (p.publish.posts)    STATE.publish.posts    = p.publish.posts;
      if (p.publish.drafts)   STATE.publish.drafts   = p.publish.drafts || [];
      if (p.publish.schedule) STATE.publish.schedule = p.publish.schedule;
    }
    if (p.intel) STATE.intel = p.intel;
    if (Array.isArray(p.voiceLibrary)) STATE.voiceLibrary = p.voiceLibrary;
    if (p.signature) STATE.signature = p.signature;
    if (p.streak) STATE.streak = p.streak;
  } catch(e) {}
}
function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const p = JSON.parse(raw);
    if (typeof p.remember === 'boolean') STATE.remember = p.remember;
    if (p.theme) STATE.theme = p.theme;
    if (p.usage && typeof p.usage === 'object') STATE.usage = p.usage;
    if (Array.isArray(p.pins)) STATE.pins = p.pins;
    if (p.publish) {
      if (p.publish.posts)    STATE.publish.posts    = p.publish.posts;
      if (p.publish.drafts)   STATE.publish.drafts   = p.publish.drafts || [];
      if (p.publish.schedule) STATE.publish.schedule = p.publish.schedule;
    }
    if (p.intel) STATE.intel = p.intel;
    if (Array.isArray(p.voiceLibrary)) STATE.voiceLibrary = p.voiceLibrary;
    if (p.signature) STATE.signature = p.signature;
    if (p.streak) STATE.streak = p.streak;
  } catch(e) {}
}

// ── PER-USER BRAND CONFIG (multi-tenant AI voice) ───────────────────────────
// Called once, right after a profile loads at login (see main.js). The
// actual system prompt (persona, delivery spine, guardrails, banned
// phrases) is built server-side per-request in ai-proxy.php, straight
// from this same `profiles` row — this function only handles the two
// things the client itself still needs: swapping CONTENT_PILLARS to this
// user's own pillars, and seeding STATE.voiceLibrary from their saved
// posts if cloud state didn't already populate it.
function applyUserBrandConfig(profile) {
  if (!profile) return;

  if (profile.pillars && profile.pillars.length) {
    CONTENT_PILLARS = profile.pillars;
  }

  const richExamples = profile.brand_extra?.example_posts;
  if ((!STATE.voiceLibrary || !STATE.voiceLibrary.length) && richExamples && richExamples.length) {
    STATE.voiceLibrary = richExamples.map(p => ({
      text: p.text, pillar: p.pillar || 'General', channel: p.channel || 'LinkedIn Post', addedAt: Date.now()
    }));
  } else if ((!STATE.voiceLibrary || !STATE.voiceLibrary.length) && profile.voice_posts && profile.voice_posts.length) {
    STATE.voiceLibrary = profile.voice_posts.map(text => ({
      text,
      pillar: (profile.pillars && profile.pillars[0]) || 'General',
      channel: 'LinkedIn Post',
      addedAt: Date.now()
    }));
  }
}
