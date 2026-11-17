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
    'groq'       => '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
',   // https://console.groq.com/keys        e.g. gsk_...
    'cerebras'   => 'csk-pmr4e265vn5dppxtyj34jkvhyk42p9k2nk988rfk3ke383x6
',   // https://cloud.cerebras.ai             e.g. csk-...
    'openrouter' => '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
',   // https://openrouter.ai/keys            e.g. sk-or-...
    'mistral'    => 'zqZ7t5oF4OcradoNw8qKqXHIQvmK78ew',   // https://console.mistral.ai/api-keys
    'anthropic'  => '',   // https://console.anthropic.com         e.g. sk-ant-...

    // ── Live data ─────────────────────────────────────────────────────────
    'newsapi'    => '3c3e337aa6754763808e47b02cba4caa',   // https://newsapi.org
    'youtube'    => 'AIzaSyBI0frMRYq8WoT6PgKHBr0Hh4Z8cDU0rbs
',   // https://console.cloud.google.com (YouTube Data API v3)

];
