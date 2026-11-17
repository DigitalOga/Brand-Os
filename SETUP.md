# Brand OS — Setup Guide (start to finish)

Follow this in order. Don't skip Step 1 — everything else fails silently if
that one's wrong.

---

## Step 1 — Resolve the Supabase project mismatch (do this first)

Two files currently disagree about which Supabase project is live:

- `assets/js/supabase-client.js` → `wdbfimwtlaxbrvnbkqvk.supabase.co`
- `config/supa-helper.php` → `ehofimpglagpdollauuh.supabase.co`

1. Log into [supabase.com/dashboard](https://supabase.com/dashboard) and look
   at your projects list — figure out which of those two project refs is the
   one you're actually using (check Settings → API → Project URL on each candidate
   project if you have access to both).
2. Whichever one is correct, make sure **both** files use it:
   - `assets/js/supabase-client.js` — `SUPABASE_URL` (line 6) and
     `SUPABASE_ANON_KEY` (line 7, right below it — grab this from
     Settings → API → Project API keys → `anon` `public`)
   - `config/supa-helper.php` — `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
     `SUPABASE_SERVICE_ROLE_KEY` (Settings → API → Project API keys →
     `service_role` `secret` — never share this one, never put it in a
     client-side file)
3. Delete the "⚠️ MISMATCH FLAGGED" comment blocks in both files once fixed.

If you're not sure and both projects have data in them, open each one's
Table Editor and check `profiles` for real user rows — the one with your
existing users is the live one.

---

## Step 2 — Run the database schema

1. Supabase Dashboard → **SQL Editor** → New query.
2. Paste the entire contents of `database/00-schema.sql`, click **Run**.
3. Confirm no errors. It's safe to re-run if you need to.
4. Check the admin email near the top of the file
   (`INSERT INTO public.admin_emails ...`) — it should already say
   `therealolaleye@gmail.com`. Add any other admins the same way:
   ```sql
   INSERT INTO public.admin_emails (email) VALUES ('person@example.com')
   ON CONFLICT (email) DO NOTHING;
   ```

---

## Step 3 — Supabase dashboard settings

1. **Authentication → Providers → Email**
   - Make sure Email provider is enabled.
   - "Confirm email" — your call; OFF means people can use the app the
     instant they sign up, ON adds an email verification step.
2. **Authentication → URL Configuration**
   - Site URL = `https://brandos.lumynaire.com` (or your real domain)
   - Redirect URLs = add the same domain, plus a `/**` wildcard variant.

---

## Step 4 — Fill in your real API keys

Open `config/keys-store.php` in a text editor and paste your real keys
between the quotes for whichever providers you have:

- Groq — console.groq.com/keys
- Cerebras — cloud.cerebras.ai
- OpenRouter — openrouter.ai/keys
- Mistral — console.mistral.ai/api-keys
- Anthropic — console.anthropic.com
- NewsAPI — newsapi.org
- YouTube Data API — console.cloud.google.com

Leave any you don't have yet as `''` (empty string) — `ai-proxy.php` just
skips providers with no key set. You can also do this later, from inside
the app, once you're signed in as admin (Admin Panel → Shared API Keys).

---

## Step 5 — Check the allowed origins in the PHP files

Open these three files and confirm `ALLOWED_ORIGINS` matches your real
domain (all three must match each other exactly):

- `ai-proxy.php`
- `admin-keys.php`
- `admin-users.php`

```php
define('ALLOWED_ORIGINS', [
    'https://brandos.lumynaire.com',
    'https://www.brandos.lumynaire.com',
]);
```

---

## Step 6 — Upload to your host

Upload the following to your web root via cPanel File Manager or FTP —
**keep the folder structure exactly as it is in the zip**:

```
index.html (landing page), app.html (the actual app), manifest.json, service-worker.js, .htaccess
ai-proxy.php, admin-keys.php, admin-users.php
assets/   (whole folder)
config/   (whole folder — including config/.htaccess)
```

Do **not** upload `database/` — those files only ever go into the Supabase
SQL Editor, never onto your web host.

`marketing/` is optional — upload it too if you want the landing page and
maintenance page hosted (e.g. at `yourdomain.com/marketing/brandos-landing.html`).

---

## Step 7 — Verify the config folder is actually protected

Visit `https://yourdomain.com/config/keys-store.php` in a browser.
You should see a **blank white page** — that confirms PHP is executing
the file (not serving it as text) and the `.htaccess` deny-all is in place.
If you see the raw PHP code as text, or a directory listing, stop and fix
your server config before going further — that would mean your keys are
exposed.

---

## Step 8 — Sign up as admin

1. Go to your live app URL.
2. Sign up with `therealolaleye@gmail.com` + a password of your choice.
3. Complete the onboarding flow.
4. Check the sidebar/nav for an **Admin** section — that confirms the
   allowlist trigger worked and your account is admin.
5. In Admin Panel → Shared API Keys, confirm your keys from Step 4 show
   as "Set" — this is also where you can add/rotate keys later without
   touching cPanel again.

---

## Step 9 — Optional: push reminders cron

Only if you're using the `send-reminders` Edge Function:

1. Deploy that Edge Function to your Supabase project first.
2. Open `database/02-push-reminders-cron.sql`, replace
   `YOUR-CONFIRMED-PROJECT-REF` with your real project ref (from Step 1)
   and `PASTE-YOUR-SERVICE-ROLE-KEY-HERE` with your service role key.
3. Run it in the SQL Editor.

---

## Done — sanity checklist

- [ ] `supabase-client.js` and `supa-helper.php` point at the same project
- [ ] `database/00-schema.sql` ran with no errors
- [ ] `config/keys-store.php` has at least one LLM key filled in
- [ ] `ALLOWED_ORIGINS` matches your real domain in all three PHP files
- [ ] `/config/keys-store.php` shows a blank page in the browser, not code
- [ ] Signing up with your email gets you into the Admin Panel
- [ ] A second test account (different email) does **not** see the Admin
      section and cannot reach it even by URL
