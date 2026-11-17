// ── SUPABASE CLIENT ────────────────────────────────────────────────────────
// ✅ CONFIRMED: ehofimpglagpdollauuh is the live project. This now matches
// config/supa-helper.php.
const SUPABASE_URL      = 'https://ehofimpglagpdollauuh.supabase.co';       // Supabase → Settings → API → Project URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVob2ZpbXBnbGFncGRvbGxhdXVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyMzEwODIsImV4cCI6MjA5OTgwNzA4Mn0.aFkB_PBLzKsY_4GiyEKcEFGvaKevG5k-PfyfgbzRpmw';   // Supabase → Settings → API → anon public key

const SUPA = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true }
});

// ── GLOBAL SETTINGS ────────────────────────────────────────────────────────
// REMOVED entirely: global_settings table + fetchGlobalSettings() are gone.
// Every shared LLM/NewsAPI/YouTube key now lives ONLY in
// app/config/keys-store.php on the PHP host, used only by ai-proxy.php
// (a plain PHP script, not a Supabase Edge Function). Nothing key-related
// touches Supabase anymore.

// ── USER PROFILE ───────────────────────────────────────────────────────────
async function fetchProfile(userId) {
  const { data, error } = await SUPA
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) console.warn('[Brand OS] fetchProfile error:', error.message);
  return data || null;
}

async function upsertProfile(userId, profileData) {
  const { error } = await SUPA
    .from('profiles')
    .upsert({ id: userId, ...profileData, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// ── USER STATE ─────────────────────────────────────────────────────────────
async function fetchUserState(userId) {
  const { data, error } = await SUPA
    .from('user_state')
    .select('state_json')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) console.warn('[Brand OS] fetchUserState error:', error.message);
  return data ? data.state_json : null;
}

let _saveDebounceTimer = null;
let _pendingStatePayload = null;
function saveUserStateDebounced(userId, statePayload) {
  // Merge into whatever's already queued rather than replacing it — two
  // different parts of the app calling this within the same 1.2s window
  // used to mean only the LAST caller's payload actually got saved, since
  // upsert overwrites the whole state_json column. That silently dropped
  // the earlier caller's data. Shallow-merging here means every key from
  // every call in the window survives.
  _pendingStatePayload = { ..._pendingStatePayload, ...statePayload };
  clearTimeout(_saveDebounceTimer);
  _saveDebounceTimer = setTimeout(async () => {
    const toSave = _pendingStatePayload;
    _pendingStatePayload = null;
    try {
      await SUPA
        .from('user_state')
        .upsert({ user_id: userId, state_json: toSave, updated_at: new Date().toISOString() });
    } catch (e) {
      console.warn('[Brand OS] saveUserState error:', e.message);
    }
  }, 1200);
}

// ── INVITES ────────────────────────────────────────────────────────────────
// Fully removed. Brand OS uses plain email + password sign-up/sign-in for
// every account, including admins — there is no invite code anywhere in
// the app. Admin status is granted purely by email match server-side; see
// sql/09-remove-invites-admin-allowlist.sql.
