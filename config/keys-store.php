<?php
/**
 * Brand OS — shared key store.
 *
 * Every key your Brand OS instance uses (LLM providers, NewsAPI, YouTube)
 * lives ONLY here — a plain PHP file on your own server, never in
 * Supabase, never sent to the browser. Requesting this file directly
 * over HTTP returns a blank page (PHP executes it, there's nothing to
 * echo) — the /config folder also has its own .htaccess denying all
 * direct access as a second layer of protection.
 *
 * Edit these two ways:
 *   1. cPanel File Manager — open this file, paste your key between the
 *      quotes, save.
 *   2. In-app Admin Panel → Shared API Keys — paste + save from your
 *      phone/browser (goes through admin-keys.php, which writes back to
 *      this exact file). Either way works; they edit the same source of
 *      truth.
 *
 * Leave a value as '' (empty string) if you don't have that key yet —
 * ai-proxy.php simply skips any provider/service with no key set.
 */

return [

    // ── LLM providers (tried in this order for the 'generate' action) ────
    'groq'       => ''
',   // https://console.groq.com/keys        e.g. gsk_...
    'cerebras'   => ''
',   // https://cloud.cerebras.ai             e.g. csk-...
    'openrouter' => ''
',   // https://openrouter.ai/keys            e.g. sk-or-...
    'mistral'    => '',   // https://console.mistral.ai/api-keys
    'anthropic'  => '',   // https://console.anthropic.com         e.g. sk-ant-...

    // ── Live data ─────────────────────────────────────────────────────────
    'newsapi'    => '',   // https://newsapi.org
    'youtube'    => '
',   // https://console.cloud.google.com (YouTube Data API v3)

];
