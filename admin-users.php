<?php
/**
 * Brand OS — admin-users.php
 * Admin-only user management: suspend, delete, grant Pro time, set quota,
 * and basic usage analytics. Same auth pattern as admin-keys.php — every
 * request is verified as a real signed-in is_admin=true user first.
 */

header('Content-Type: application/json');
require_once __DIR__ . '/config/supa-helper.php';

// Must match ai-proxy.php / admin-keys.php exactly.
define('ALLOWED_ORIGINS', [
    'https://brandos.lumynaire.com',
    'https://www.brandos.lumynaire.com',
]);
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$originOk = in_array(rtrim($origin, '/'), ALLOWED_ORIGINS, true);
header('Access-Control-Allow-Origin: ' . ($originOk ? $origin : ALLOWED_ORIGINS[0]));
header('Vary: Origin');
header('Access-Control-Allow-Headers: authorization, content-type');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

function respond($body, $status = 200) { http_response_code($status); echo json_encode($body); exit; }

$adminId = requireSupabaseUser();
if (!$adminId) respond(['error' => 'Unauthorized'], 401);
if (!isAdminUser($adminId)) respond(['error' => 'Admin access required'], 403);

$action = $_GET['action'] ?? '';

// ── Analytics: last 14 days of AI usage + distinct active users/day ─────
if ($action === 'analytics' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $since = date('Y-m-d', strtotime('-13 days'));
    [$code, $res] = curlJson(
        SUPABASE_URL . "/rest/v1/usage_counters?day=gte.$since&select=user_id,day,count&order=day.asc",
        ['apikey: ' . SUPABASE_SERVICE_ROLE_KEY, 'Authorization: Bearer ' . SUPABASE_SERVICE_ROLE_KEY]
    );
    $rows = json_decode($res, true) ?: [];
    $byDay = [];
    foreach ($rows as $r) {
        $d = $r['day'];
        if (!isset($byDay[$d])) $byDay[$d] = ['day' => $d, 'calls' => 0, 'users' => []];
        $byDay[$d]['calls'] += (int)$r['count'];
        $byDay[$d]['users'][$r['user_id']] = true;
    }
    $out = [];
    for ($i = 13; $i >= 0; $i--) {
        $d = date('Y-m-d', strtotime("-$i days"));
        $out[] = ['day' => $d, 'calls' => $byDay[$d]['calls'] ?? 0, 'activeUsers' => isset($byDay[$d]) ? count($byDay[$d]['users']) : 0];
    }
    respond(['ok' => true, 'days' => $out]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(['error' => 'Unknown action'], 400);

$input = json_decode(file_get_contents('php://input'), true);
$targetId = $input['user_id'] ?? '';
if (!$targetId) respond(['error' => 'Missing user_id'], 400);
if ($targetId === $adminId && in_array($action, ['delete', 'suspend'], true)) {
    respond(['error' => "You can't delete or suspend your own admin account from here."], 400);
}

switch ($action) {

    case 'suspend': {
        $suspended = !empty($input['suspended']);
        if (!patchProfileRow($targetId, ['is_suspended' => $suspended])) respond(['error' => 'Failed to update user'], 500);
        respond(['ok' => true]);
    }

    case 'delete': {
        if (!deleteAuthUser($targetId)) respond(['error' => 'Failed to delete user'], 500);
        respond(['ok' => true]);
    }

    // Extends (or starts) Pro access by N days from whichever is later:
    // right now, or their current pro_expires_at (so granting time to an
    // already-active Pro user adds on top instead of shortening them).
    case 'grant_pro': {
        $days = max(1, (int)($input['days'] ?? 30));
        $profile = fetchProfileRow($targetId);
        $currentExpiry = $profile['pro_expires_at'] ?? null;
        $base = ($currentExpiry && strtotime($currentExpiry) > time()) ? strtotime($currentExpiry) : time();
        $newExpiry = gmdate('c', $base + $days * 86400);
        if (!patchProfileRow($targetId, ['is_pro' => true, 'pro_expires_at' => $newExpiry])) respond(['error' => 'Failed to grant Pro time'], 500);
        respond(['ok' => true, 'pro_expires_at' => $newExpiry]);
    }

    case 'set_quota': {
        // null/blank clears the override, falling back to DEFAULT_DAILY_QUOTA.
        $quota = isset($input['daily_quota']) && $input['daily_quota'] !== '' && $input['daily_quota'] !== null
            ? max(0, (int)$input['daily_quota']) : null;
        if (!patchProfileRow($targetId, ['daily_quota' => $quota])) respond(['error' => 'Failed to update quota'], 500);
        respond(['ok' => true]);
    }
}

respond(['error' => 'Unknown action'], 400);
