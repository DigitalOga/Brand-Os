<?php
/**
 * Brand OS — ai-proxy.php
 *
 * Lives in the SAME folder as app.html. All LLM / NewsAPI / YouTube
 * calls route through here. The actual key values live ONLY in
 * config/keys-store.php on this server — never in Supabase, never sent
 * to the browser. This file still checks Supabase to confirm the caller
 * is a real signed-in user (and, for the daily brief / assistant, to read
 * their own brand profile for personalization) — that's a plain HTTPS
 * REST call, not a Supabase Edge Function, so none of the Edge Function
 * issues apply.
 *
 * Set ALLOWED_ORIGIN below to your real domain before going live.
 */

header('Content-Type: application/json');
require_once __DIR__ . '/config/supa-helper.php';

// ── Lock to your own domain(s) ─────────────────────────────────────────
// List every variant people might actually load the app from (apex +
// www, and http variants only if you genuinely don't have SSL — you
// should). A same-origin request (the normal case, since this file
// lives next to app.html) never even triggers this check in the
// browser, but the CORS headers must still be correct for the mobile
// PWA/home-screen case and for any future cross-origin setup.
define('ALLOWED_ORIGINS', [
    'https://brandos.lumynaire.com',      // ← change to your real domain
    'https://www.brandos.lumynaire.com',  // ← keep or remove based on which you use
]);
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$originOk = in_array(rtrim($origin, '/'), ALLOWED_ORIGINS, true);
header('Access-Control-Allow-Origin: ' . ($originOk ? $origin : ALLOWED_ORIGINS[0]));
header('Vary: Origin');
header('Access-Control-Allow-Headers: authorization, content-type');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

function respond($body, $status = 200) {
    http_response_code($status);
    echo json_encode($body);
    exit;
}

// ── Simple per-IP rate limit (file-based, no DB needed) ────────────────
function rateLimitOk($bucket, $max = 60, $windowSeconds = 3600) {
    $dir = sys_get_temp_dir() . '/brandos-rl';
    if (!is_dir($dir)) @mkdir($dir, 0700, true);
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $file = $dir . '/' . md5($bucket . '-' . $ip) . '.json';
    $now = time();
    $data = ['count' => 0, 'reset' => $now + $windowSeconds];
    if (is_file($file)) {
        $existing = json_decode(file_get_contents($file), true);
        if ($existing && $existing['reset'] > $now) $data = $existing;
    }
    $data['count']++;
    @file_put_contents($file, json_encode($data));
    return $data['count'] <= $max;
}
if (!rateLimitOk('ai-proxy', 120, 3600)) {
    respond(['error' => 'Too many requests — try again shortly'], 429);
}

// ── 1. Verify the caller is a real signed-in Supabase user ────────────
$userId = requireSupabaseUser();
if (!$userId) respond(['error' => 'Unauthorized'], 401);

$CALLER_PROFILE = fetchProfileRow($userId);
if (!empty($CALLER_PROFILE['is_suspended'])) respond(['error' => 'Your account has been suspended'], 403);

// ── status action can be a GET (used at boot to know what's available) ──
if ($_SERVER['REQUEST_METHOD'] === 'GET' && ($_GET['action'] ?? '') === 'status') {
    $keys = loadKeysStore();
    respond([
        'ok'        => true,
        'available' => !empty(array_filter([$keys['groq'] ?? '', $keys['cerebras'] ?? '', $keys['openrouter'] ?? '', $keys['mistral'] ?? '', $keys['anthropic'] ?? ''])),
        'news'      => !empty($keys['newsapi'] ?? ''),
        'youtube'   => !empty($keys['youtube'] ?? ''),
    ]);
}

// ── 2. Read the incoming request body ──────────────────────────────────
$input = json_decode(file_get_contents('php://input'), true);
if (!$input || !isset($input['action'])) respond(['error' => 'Invalid request body'], 400);

$KEYS = loadKeysStore();

$PROVIDERS = [
    'groq'       => ['endpoint' => 'https://api.groq.com/openai/v1/chat/completions', 'type' => 'openai',    'model' => 'llama-3.3-70b-versatile'],
    'cerebras'   => ['endpoint' => 'https://api.cerebras.ai/v1/chat/completions',      'type' => 'openai',    'model' => 'llama-3.3-70b'],
    'openrouter' => ['endpoint' => 'https://openrouter.ai/api/v1/chat/completions',    'type' => 'openai',    'model' => 'meta-llama/llama-3.3-70b-instruct'],
    'mistral'    => ['endpoint' => 'https://api.mistral.ai/v1/chat/completions',       'type' => 'openai',    'model' => 'mistral-large-latest'],
    'anthropic'  => ['endpoint' => 'https://api.anthropic.com/v1/messages',            'type' => 'anthropic', 'model' => 'claude-sonnet-4-6'],
];
// Agile-by-design: add a 6th provider by adding one entry above + one id
// below — nothing else in this dispatch logic needs to change.
$PROVIDER_ORDER = ['groq', 'cerebras', 'openrouter', 'mistral', 'anthropic'];

// ── SHARED ANTI-GENERIC RULES ───────────────────────────────────────────
// Appended to every system prompt so no output — content, assistant chat,
// or welcome note — slips into recognizable AI cadence.
define('ANTI_GENERIC_RULES',
    "HARD RULES — NEVER BREAK THESE:\n"
    . "PRIORITY ORDER: if this person has real sample posts or a described voice below, THEIR actual writing wins over any default in this list — e.g. if their samples show exclamation marks, short fragments, or a personal quirk, write that way, don't flatten it out. These rules exist to catch generic AI cadence when we DON'T know someone's real style yet, not to override real evidence of it.\n"
    . "- Banned words/phrases (never use, in any form): delve, unlock, unleash, elevate, empower, game-changer, "
    . "game changing, revolutionize, transform your, harness, leverage (as a verb), seamless, robust, "
    . "cutting-edge, in today's fast-paced world, in this digital age, in the ever-evolving landscape, "
    . "navigate the complexities, at the end of the day, it's important to note, it's worth noting, "
    . "let's dive in, dive deep, buckle up, look no further, take it to the next level, "
    . "a testament to, the power of, embark on a journey, tapestry, symphony, treasure trove, "
    . "moreover, furthermore, additionally (as sentence openers), firstly/secondly/lastly, in conclusion, "
    . "not just X but Y, whether it's X or Y, more than just, at its core, when it comes to, here's the thing, "
    . "here's why that matters, the truth is, plot twist, spoiler alert, let that sink in, food for thought, "
    . "the bottom line, real talk, i'll say it again, is a game changer, changes everything, "
    . "here's what nobody tells you, the secret is, the good news is, the bad news is.\n"
    . "- No throat-clearing openers (\"In this post, I want to talk about...\", \"Let's talk about...\", \"So I've been thinking about...\").\n"
    . "- Never open with a rhetorical question, a dictionary definition, or 'Imagine...'.\n"
    . "- Max ONE em dash per paragraph. Never chain them, never use one to fake a dramatic pause more than once in the same piece.\n"
    . "- Never use em-dash-heavy triads ('It's not X — it's Y'), and never stack three parallel phrases or examples for rhythm "
    . "(the 'X. Y. Z.' or 'not A, not B, but C' pattern) — real writing doesn't reliably come in threes.\n"
    . "- No unearned parallelism — don't mirror sentence structure back-to-back purely for effect.\n"
    . "- No more than 2 consecutive sentences starting with the same word or grammatical pattern.\n"
    . "- Don't use markdown formatting (headers, bullet lists, bold asterisks) inside social copy or messages meant to be read "
    . "as plain text — bullets/headers are fine only in structured outputs the tool explicitly asks for (briefs, plans, tables).\n"
    . "- No exclamation marks unless quoting someone OR the person's own samples show they use them. "
    . "No emojis unless the person's own writing uses them.\n"
    . "- Vary sentence and paragraph length like a human. Don't end every piece with a reflective question or a motivational "
    . "one-liner — vary the close, and sometimes just stop.\n"
    . "- No hedge-word padding (often, many, various, several, a range of) used as filler rather than real specificity.\n"
    . "- Be concrete: names, numbers, situations. If a specific isn't known, use a bracketed placeholder like [client name] instead of inventing one.\n"
    . "- Write like the specific person described above, not like an assistant describing them.");

function buildSystemPromptFromProfile($p) {
    if (!$p) return "You are a sharp, human-sounding writing partner. Write clearly and specifically.\n" . ANTI_GENERIC_RULES;

    $name      = $p['name'] ?? 'this user';
    $brandName = $p['brand_name'] ?? '';
    $role      = $p['role'] ?? '';
    $audience  = $p['audience'] ?? 'their professional audience';
    $voice     = !empty($p['voice_descriptors']) ? implode(', ', $p['voice_descriptors']) : 'Direct, grounded, specific.';
    $pillars   = !empty($p['pillars']) ? implode(', ', $p['pillars']) : '';
    $phrases   = !empty($p['key_phrases']) ? implode(' | ', $p['key_phrases']) : '';
    $extra     = is_array($p['brand_extra'] ?? null) ? $p['brand_extra'] : [];
    $persona   = $extra['persona_line'] ?? '';
    $positioning = $extra['positioning_statement'] ?? '';
    $regional  = $extra['regional_context'] ?? '';
    $samples   = '';
    if (!empty($p['voice_posts']) && is_array($p['voice_posts'])) {
        // Up to 3 real posts, trimmed to ~900 chars each, as ground-truth
        // voice reference. This column is kept LIVE by the Voice Library
        // page (assets/js/page-voice-library.js syncs it on every add/
        // remove) — it is NOT frozen at whatever was captured during
        // onboarding, so a post added last week shows up here today.
        // UTF-8-safe truncation (no mbstring dependency): clipping
        // mid-character would make json_encode fail on the whole API
        // request body, so trim on character boundaries via regex.
        foreach (array_slice($p['voice_posts'], 0, 3) as $i => $post) {
            $t = trim((string)$post);
            if (preg_match('/^.{0,900}/us', $t, $m)) $t = $m[0];
            $samples .= "--- Sample " . ($i + 1) . " ---\n" . $t . "\n";
        }
    }

    $prompt = "You ARE the writing voice of $name" . ($brandName ? " ($brandName)" : '') . ($role ? ", $role" : '') . ". "
        . "Everything you produce should read as if $name wrote it personally.\n"
        . ($persona ? "WHO THEY ARE: $persona\n" : '')
        . ($positioning ? "POSITIONING: $positioning\n" : '')
        . "AUDIENCE: $audience\n"
        . "VOICE: $voice\n"
        . ($pillars ? "CONTENT PILLARS (their recurring themes — tie output back to these where natural): $pillars\n" : '')
        . ($phrases ? "SIGNATURE PHRASES (lines they actually say — weave one in ONLY where it fits naturally, never force it): $phrases\n" : '')
        . ($regional ? "REGIONAL/CULTURAL CONTEXT: $regional\n" : '')
        . ($samples ? "REAL POSTS THEY'VE WRITTEN (match this rhythm, vocabulary, and structure — this is the ground truth for their voice):\n$samples" : '')
        . "\n" . ANTI_GENERIC_RULES;
    return $prompt;
}

// ── OUTPUT QUALITY GUARDRAIL ────────────────────────────────────────────────
// ANTI_GENERIC_RULES tells the model what not to do, but a system prompt is
// a request, not a guarantee — cheaper/faster fallback providers in
// particular sometimes ignore it. This is a cheap, deterministic safety
// net: scan the actual output for a short list of the most damning
// generic-AI phrases (not the full banned list — just the ones that are
// an unambiguous tell, to avoid false positives on ordinary words like
// "moreover" appearing mid-sentence for an unrelated reason). If any show
// up, retry ONCE with a pointed correction. If it still isn't clean after
// that, ship it anyway — never fail the person's request over this, and
// never loop more than once (cost + latency both matter).
const GUARDRAIL_PHRASES = [
    "in today's fast-paced world", "in this digital age", "unlock the power",
    "game-changer", "game changer", "navigate the complexities",
    "it's important to note", "it's worth noting", "let's dive in",
    "dive deep into", "at the end of the day", "in the ever-evolving",
    "take it to the next level", "a testament to", "embark on a journey",
    "here's the thing", "the truth is", "changes everything",
];
function guardrailFindOffense($text) {
    $lower = strtolower($text);
    foreach (GUARDRAIL_PHRASES as $phrase) {
        if (strpos($lower, $phrase) !== false) return $phrase;
    }
    return null;
}

function callLLM($PROVIDER_ORDER, $PROVIDERS, $KEYS, $prompt, $systemPrompt) {
    $attempted = [];   // every provider actually tried, in order
    $errors    = [];   // one short, readable line per failure — ALL of them, not just the last

    foreach ($PROVIDER_ORDER as $id) {
        if (empty($KEYS[$id])) continue; // not configured — not a failure, just skipped
        $attempted[] = $id;
        $key = $KEYS[$id];
        $cfg = $PROVIDERS[$id];

        if ($cfg['type'] === 'anthropic') {
            $reqHeaders = ['Content-Type: application/json', 'x-api-key: ' . $key, 'anthropic-version: 2023-06-01'];
            $reqBody = json_encode(['model' => $cfg['model'], 'max_tokens' => 2000, 'system' => $systemPrompt, 'messages' => [['role' => 'user', 'content' => $prompt]]]);
        } else {
            $reqHeaders = ['Content-Type: application/json', 'Authorization: Bearer ' . $key];
            $reqBody = json_encode(['model' => $cfg['model'], 'max_tokens' => 2000, 'messages' => [['role' => 'system', 'content' => $systemPrompt], ['role' => 'user', 'content' => $prompt]]]);
        }

        [$rCode, $rRes, $rErr] = curlJson($cfg['endpoint'], $reqHeaders, 'POST', $reqBody);

        if ($rErr) {
            $line = "$id: connection error — $rErr";
            $errors[] = $line; error_log($line); continue;
        }
        if ($rCode < 200 || $rCode >= 300) {
            // Pull just the human-readable message out of the provider's JSON
            // error body instead of dumping the whole raw response — this is
            // what used to show up as an unreadable wall of JSON in the UI.
            $short = summarizeProviderError($rCode, $rRes);
            $line = "$id: $short";
            $errors[] = $line; error_log("$id failed with status $rCode: $rRes"); continue;
        }

        $data = json_decode($rRes, true);
        $text = $cfg['type'] === 'anthropic'
            ? ($data['content'][0]['text'] ?? '')
            : ($data['choices'][0]['message']['content'] ?? '');
        if ($text) return ['ok' => true, 'text' => $text, 'provider' => $id];

        $line = "$id: returned an empty response";
        $errors[] = $line;
    }

    if (empty($attempted)) {
        return ['ok' => false, 'error' => 'No shared keys configured yet — add at least one in the Admin Panel.'];
    }
    // One line per provider tried, so you see the WHOLE picture (e.g. Groq
    // and Cerebras both hit an expired key, not just whichever one failed
    // last) instead of only the final provider's error.
    return ['ok' => false, 'error' => implode(' · ', $errors)];
}

// Extracts a short, human-readable message from a failed provider response.
// Falls back to a generic status-code message if the body isn't the JSON
// shape we expect (e.g. an HTML error page from a gateway timeout).
function summarizeProviderError($code, $rawBody) {
    $data = json_decode($rawBody, true);
    $msg = null;
    if (is_array($data)) {
        $msg = $data['error']['message']
            ?? $data['message']
            ?? (is_string($data['error'] ?? null) ? $data['error'] : null);
    }
    if ($code == 429) return 'rate limited (429)' . ($msg ? " — $msg" : '');
    if ($code == 401 || $code == 403) return 'key rejected (' . $code . ')' . ($msg ? " — $msg" : '');
    if ($msg) return "status $code — " . mb_substr($msg, 0, 150);
    return "status $code";
}

switch ($input['action']) {

    case 'generate': {
        $prompt = $input['prompt'] ?? '';
        if (!$prompt) respond(['error' => 'Missing prompt'], 400);
        $profile = $CALLER_PROFILE;
        $quota = $profile['daily_quota'] ?? DEFAULT_DAILY_QUOTA;
        if (empty($profile['is_admin']) && !incrementUsageIfAllowed($userId, $quota)) {
            respond(['error' => "You've used all $quota of today's free tries. Come back after midnight and you'll have more."], 429);
        }
        $systemPrompt = $input['assistant'] ?? false
            ? buildAssistantSystemPrompt($profile)
            : buildSystemPromptFromProfile($profile);
        $result = callLLM($PROVIDER_ORDER, $PROVIDERS, $KEYS, $prompt, $systemPrompt);
        if (!$result['ok']) respond(['error' => 'All shared providers failed', 'detail' => $result['error']], 502);

        // Guardrail: one automatic retry if a generic-AI tell slipped
        // through despite the system prompt's instructions not to use it.
        $offense = guardrailFindOffense($result['text']);
        if ($offense) {
            $correctedPrompt = $prompt . "\n\n(Your previous attempt at this used the phrase \"$offense\", which reads as generic AI writing. Do not use it or anything like it — rewrite from scratch in a more specific, human voice.)";
            $retry = callLLM($PROVIDER_ORDER, $PROVIDERS, $KEYS, $correctedPrompt, $systemPrompt);
            if ($retry['ok']) $result = $retry; // use the retry even if it isn't perfect — never loop a second time
        }

        respond(['text' => $result['text'], 'provider' => $result['provider']]);
    }

    // ── Persistent AI assistant widget — same LLM pool, a slightly
    // different (conversational, coaching-tone) system prompt, and it
    // accepts short recent chat history for context. ─────────────────
    case 'assistant': {
        $prompt = $input['prompt'] ?? '';
        $history = is_array($input['history'] ?? null) ? $input['history'] : [];
        if (!$prompt) respond(['error' => 'Missing prompt'], 400);
        $profile = $CALLER_PROFILE;
        $quota = $profile['daily_quota'] ?? DEFAULT_DAILY_QUOTA;
        if (empty($profile['is_admin']) && !incrementUsageIfAllowed($userId, $quota)) {
            respond(['error' => "You've used all $quota of today's free tries. Come back after midnight and you'll have more."], 429);
        }
        $name = $profile['name'] ?? 'there';
        $brandName = $profile['brand_name'] ?? '';
        $role = $profile['role'] ?? '';
        $audience = $profile['audience'] ?? '';
        $pillars = !empty($profile['pillars']) ? implode(', ', $profile['pillars']) : '';
        $voice = !empty($profile['voice_descriptors']) ? implode(', ', $profile['voice_descriptors']) : '';
        $extra = is_array($profile['brand_extra'] ?? null) ? $profile['brand_extra'] : [];
        $persona = $extra['persona_line'] ?? '';
        $systemPrompt = "You are $name's personal Brand OS assistant"
            . ($brandName ? " for $brandName" : '') . ". You know them well:\n"
            . ($role ? "- What they do: $role\n" : '')
            . ($persona ? "- Who they are: $persona\n" : '')
            . ($audience ? "- Who they serve: $audience\n" : '')
            . ($pillars ? "- Their content pillars: $pillars\n" : '')
            . ($voice ? "- Their voice: $voice\n" : '')
            . "Speak to $name directly, referencing their actual pillars, audience, and voice when giving advice — never generic tips that could apply to anyone. "
            . "Be warm, sharp, and brief: 2-5 sentences unless they ask for more. "
            . "You can answer questions about using Brand OS (Create, Calendar, Studio tools, Voice Library, Discover) and about their content strategy.\n"
            . ANTI_GENERIC_RULES;

        $convo = '';
        foreach (array_slice($history, -6) as $turn) {
            $role = ($turn['role'] ?? 'user') === 'assistant' ? 'Assistant' : 'User';
            $convo .= "$role: " . ($turn['content'] ?? '') . "\n";
        }
        $fullPrompt = ($convo ? "Conversation so far:\n$convo\n" : '') . "User: $prompt";

        $result = callLLM($PROVIDER_ORDER, $PROVIDERS, $KEYS, $fullPrompt, $systemPrompt);
        if (!$result['ok']) respond(['error' => 'Assistant unavailable', 'detail' => $result['error']], 502);
        respond(['text' => $result['text']]);
    }

    // ── Onboarding welcome message — one short, personalized note
    // generated right after onboarding finishes. ───────────────────────
    case 'welcome': {
        $profileInput = $input['profile'] ?? [];
        $name = $profileInput['name'] ?? 'there';
        $role = $profileInput['role'] ?? '';
        $pillars = !empty($profileInput['pillars']) ? implode(', ', $profileInput['pillars']) : '';
        $prompt = "Write a short (2-3 sentences), warm, energizing welcome message for $name"
            . ($role ? ", who works as: $role" : '') . ($pillars ? ". Their content pillars: $pillars" : '')
            . ". Speak directly to them as 'you'. No generic AI phrasing. Make it feel like their Brand OS just came alive for them personally, referencing something specific from what they shared where possible.";
        $result = callLLM($PROVIDER_ORDER, $PROVIDERS, $KEYS,
            $prompt, "You write short, specific, non-generic welcome notes. No preamble, no quotation marks, just the message itself.\n" . ANTI_GENERIC_RULES);
        if (!$result['ok']) respond(['ok' => false, 'text' => "Welcome, $name. Your Brand OS is live."]);
        respond(['ok' => true, 'text' => trim($result['text'])]);
    }

    case 'news': {
        $query = $input['query'] ?? '';
        if (empty($KEYS['newsapi'])) respond(['ok' => false, 'reason' => 'no-key', 'items' => []]);
        $url = 'https://newsapi.org/v2/everything?q=' . urlencode($query) . '&language=en&sortBy=publishedAt&pageSize=6&apiKey=' . $KEYS['newsapi'];
        [$code, $res, $err] = curlJson($url, []);
        $data = json_decode($res, true);
        if ($err || !$data || ($data['status'] ?? '') !== 'ok') {
            respond(['ok' => false, 'reason' => $data['code'] ?? 'error', 'items' => []]);
        }
        respond(['ok' => true, 'items' => $data['articles'] ?? []]);
    }

    case 'youtube': {
        $query = $input['query'] ?? '';
        if (empty($KEYS['youtube'])) respond(['ok' => false, 'reason' => 'no-key', 'items' => []]);
        $url = 'https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=relevance&maxResults=6&q=' . urlencode($query) . '&key=' . $KEYS['youtube'];
        [$code, $res, $err] = curlJson($url, []);
        $data = json_decode($res, true);
        if ($err || !empty($data['error'])) {
            respond(['ok' => false, 'reason' => 'error', 'items' => []]);
        }
        respond(['ok' => true, 'items' => $data['items'] ?? []]);
    }
}

respond(['error' => 'Unknown action'], 400);

function buildAssistantSystemPrompt($profile) {
    return buildSystemPromptFromProfile($profile);
}
