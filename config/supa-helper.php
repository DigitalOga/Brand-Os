<?php
/**
 * Shared helper — talks to Supabase's normal REST/Auth API only (plain
 * HTTPS calls via curl). This is NOT a Supabase Edge Function, so none of
 * the Edge Function cold-start/CORS/logging issues apply here. It's used
 * only to confirm "is this a real signed-in user" and, for admin-keys.php,
 * "is this user an admin" — the actual LLM/News/YouTube keys never touch
 * Supabase at all; those live only in keys-store.php on this server.
 */

// ✅ CONFIRMED: ehofimpglagpdollauuh is the live project (per your
// confirmation). assets/js/supabase-client.js has been updated to match
// this file rather than the other way around.
define('SUPABASE_URL', 'https://ehofimpglagpdollauuh.supabase.co');            // same as app/supabase-client.js
define('SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVob2ZpbXBnbGFncGRvbGxhdXVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyMzEwODIsImV4cCI6MjA5OTgwNzA4Mn0.aFkB_PBLzKsY_4GiyEKcEFGvaKevG5k-PfyfgbzRpmw');   // same as app/supabase-client.js
define('SUPABASE_SERVICE_ROLE_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVob2ZpbXBnbGFncGRvbGxhdXVoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDIzMTA4MiwiZXhwIjoyMDk5ODA3MDgyfQ.N1W_uhzCBSY_F8bYZT6oUe1UYlNJEp1kdinAgW7eEY4');       // Settings → API → service_role (secret)

function curlJson($url, $headers, $method = 'GET', $body = null) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    } elseif ($method === 'PATCH') {
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PATCH');
        curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    }
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    return [$httpCode, $response, $err];
}

/**
 * Verifies the Authorization header against Supabase Auth.
 * Returns the user id string on success, or null (and optionally exits
 * with a 401 if $respondFn given) on failure.
 */
function requireSupabaseUser() {
    $headers = getallheaders();
    $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    if (!$authHeader) return null;

    [$code, $userRes] = curlJson(
        SUPABASE_URL . '/auth/v1/user',
        ['apikey: ' . SUPABASE_ANON_KEY, 'Authorization: ' . $authHeader]
    );
    $userData = json_decode($userRes, true);
    if ($code !== 200 || empty($userData['id'])) return null;
    return $userData['id'];
}

/** Fetches a user's own profiles row (service role — bypasses RLS safely, server-side only). */
function fetchProfileRow($userId) {
    [$code, $res] = curlJson(
        SUPABASE_URL . "/rest/v1/profiles?id=eq.$userId&select=*",
        ['apikey: ' . SUPABASE_SERVICE_ROLE_KEY, 'Authorization: Bearer ' . SUPABASE_SERVICE_ROLE_KEY]
    );
    $rows = json_decode($res, true);
    return ($code === 200 && !empty($rows[0])) ? $rows[0] : null;
}

/** True if this user id has is_admin = true in profiles. */
function isAdminUser($userId) {
    $profile = fetchProfileRow($userId);
    return !empty($profile['is_admin']);
}

/** Default daily AI-generation cap for any user without a per-user override. */
define('DEFAULT_DAILY_QUOTA', 30);

/** Calls a Postgres RPC via the service role (bypasses RLS — server-side only). */
function callSupabaseRpc($fnName, $args) {
    [$code, $res, $err] = curlJson(
        SUPABASE_URL . "/rest/v1/rpc/$fnName",
        ['apikey: ' . SUPABASE_SERVICE_ROLE_KEY, 'Authorization: Bearer ' . SUPABASE_SERVICE_ROLE_KEY, 'Content-Type: application/json'],
        'POST',
        json_encode($args)
    );
    return [$code, json_decode($res, true), $err];
}

/** Atomically checks + increments today's usage. Returns true if allowed. */
function incrementUsageIfAllowed($userId, $quota) {
    [$code, $data, $err] = callSupabaseRpc('increment_usage_if_allowed', ['p_user_id' => $userId, 'p_quota' => (int)$quota]);
    if ($err || $code < 200 || $code >= 300) return true; // fail OPEN — a DB hiccup shouldn't block someone from working
    return $data === true;
}

/** Deletes a user entirely via Supabase's Auth Admin API (service role only). Cascades to profiles/user_state/etc. */
function deleteAuthUser($userId) {
    $ch = curl_init(SUPABASE_URL . "/auth/v1/admin/users/$userId");
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'DELETE');
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['apikey: ' . SUPABASE_SERVICE_ROLE_KEY, 'Authorization: Bearer ' . SUPABASE_SERVICE_ROLE_KEY]);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return $code >= 200 && $code < 300;
}

/** Patches a profiles row via service role (bypasses RLS — admin actions only, caller must check isAdminUser() first). */
function patchProfileRow($userId, $fields) {
    [$code, $res] = curlJson(
        SUPABASE_URL . "/rest/v1/profiles?id=eq.$userId",
        ['apikey: ' . SUPABASE_SERVICE_ROLE_KEY, 'Authorization: Bearer ' . SUPABASE_SERVICE_ROLE_KEY, 'Content-Type: application/json', 'Prefer: return=minimal'],
        'PATCH',
        json_encode($fields)
    );
    return $code >= 200 && $code < 300;
}
function loadKeysStore() {
    $path = __DIR__ . '/keys-store.php';
    $keys = @include $path;
    return is_array($keys) ? $keys : [];
}

/** Writes the shared key store array back to disk, preserving the file's format. */
function saveKeysStore($keys) {
    $lines = [];
    $comments = [
        'groq'       => 'https://console.groq.com/keys        e.g. gsk_...',
        'cerebras'   => 'https://cloud.cerebras.ai             e.g. csk-...',
        'openrouter' => 'https://openrouter.ai/keys            e.g. sk-or-...',
        'mistral'    => 'https://console.mistral.ai/api-keys',
        'anthropic'  => 'https://console.anthropic.com         e.g. sk-ant-...',
        'newsapi'    => 'https://newsapi.org',
        'youtube'    => 'https://console.cloud.google.com (YouTube Data API v3)',
    ];
    $order = ['groq','cerebras','openrouter','mistral','anthropic','newsapi','youtube'];
    foreach ($order as $id) {
        $val = isset($keys[$id]) ? $keys[$id] : '';
        $lines[] = "    '$id' => '" . addslashes($val) . "'," . (isset($comments[$id]) ? "   // {$comments[$id]}" : '');
    }
    $body = "<?php\n/**\n * Brand OS — shared key store. Edit via cPanel File Manager or the\n * in-app Admin Panel \xE2\x86\x92 Shared API Keys screen. Never sent to the browser.\n */\n\nreturn [\n\n" . implode("\n", array_slice($lines, 0, 5)) . "\n\n" . implode("\n", array_slice($lines, 5)) . "\n\n];\n";
    return file_put_contents(__DIR__ . '/keys-store.php', $body) !== false;
}
