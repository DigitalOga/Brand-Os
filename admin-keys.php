<?php
/**
 * Brand OS — admin-keys.php
 * Lets an is_admin=true user view (masked) and update the shared keys in
 * config/keys-store.php from inside the app, instead of needing cPanel
 * File Manager every time a key is rotated. Every request is verified
 * against Supabase (real signed-in user + is_admin=true) before anything
 * is read or written.
 */

header('Content-Type: application/json');
require_once __DIR__ . '/config/supa-helper.php';

// Must match ai-proxy.php's ALLOWED_ORIGINS exactly.
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

$userId = requireSupabaseUser();
if (!$userId) respond(['error' => 'Unauthorized'], 401);
if (!isAdminUser($userId)) respond(['error' => 'Admin access required'], 403);

$KEY_IDS = ['groq','cerebras','openrouter','mistral','anthropic','newsapi','youtube'];

$action = $_GET['action'] ?? ($_SERVER['REQUEST_METHOD'] === 'POST' ? 'update' : 'status');

if ($action === 'status' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $keys = loadKeysStore();
    $out = [];
    foreach ($KEY_IDS as $id) {
        $v = $keys[$id] ?? '';
        $out[$id] = [
            'configured' => $v !== '',
            'preview'    => $v !== '' ? (strlen($v) > 4 ? '••••' . substr($v, -4) : '••••') : '',
        ];
    }
    respond(['ok' => true, 'keys' => $out]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input || empty($input['updates']) || !is_array($input['updates'])) {
        respond(['error' => 'Invalid request body — expected { updates: { keyId: value, ... } }'], 400);
    }
    $keys = loadKeysStore();
    foreach ($input['updates'] as $id => $value) {
        if (!in_array($id, $KEY_IDS, true)) continue;
        // Empty string in the payload is treated as "leave unchanged" so
        // the admin doesn't have to retype every key just to update one —
        // sending an explicit "clear" flag would be a separate action if
        // ever needed.
        if ($value === '' || $value === null) continue;
        $keys[$id] = trim($value);
    }
    if (!saveKeysStore($keys)) respond(['error' => 'Could not write key store — check file permissions on config/keys-store.php'], 500);
    respond(['ok' => true]);
}

respond(['error' => 'Unknown action'], 400);
