# Brand OS — deployment package (reorganized)

## Where things live now

```
/                     ← upload everything to your web root EXCEPT database/
  index.html          ← the public landing page (what yourdomain.com shows)
  app.html            ← the actual app — sign in/up, dashboard, everything else
  manifest.json
  service-worker.js
  ai-proxy.php        ← must stay next to app.html (same folder)
  admin-keys.php      ← must stay next to app.html
  admin-users.php     ← must stay next to app.html
  .htaccess           ← light hardening for the public app

  assets/
    css/              styles.css, auth-styles.css
    js/               every page-*.js + core scripts (main.js, ai-engine.js, etc.)
    icons/            icon-72 / 192 / 512 / maskable-512 — NEW logo baked in

  config/             ← THE SECRETS FOLDER. Upload it, but it is
    keys-store.php       self-protecting: keys-store.php returns a blank
    supa-helper.php       page if hit directly, and config/.htaccess
    .htaccess             denies ALL direct access as a second layer.

marketing/            ← optional standalone pages, NOT part of the app shell
  maintenance.html        ("recalibrating" holding page, use during downtime)
  maintenance.html       (renamed from maintenancex.html — "recalibrating" holding page)

database/             ← run in Supabase SQL Editor. Never upload this to
  00-schema.sql          your web host — it's not app code.
  01-seed-template-any-new-brand.sql
  02-push-reminders-cron.sql
  optional/
    owner-voice-recipe.sql
```

## Answering your actual question: where are the keys?

They were never meant to be in a SQL file — they live in **`config/keys-store.php`**,
a plain PHP file on your own server. Nothing about them touches Supabase or the
browser. You can edit them two ways, and both write to the exact same file:

1. **cPanel File Manager** — open `config/keys-store.php`, paste the key
   between the quotes, save.
2. **In-app Admin Panel → Shared API Keys** (only visible once you're signed
   in as an admin) — paste + save from your phone. This goes through
   `admin-keys.php`, which writes back to `config/keys-store.php` for you.

The reason you couldn't find it in the old zip: `ai-proxy.php`, `admin-keys.php`,
and `admin-users.php` all expect it at `config/supa-helper.php` /
`config/keys-store.php` (look at the `require_once __DIR__ . '/config/...'`
line in any of them) — but the zip had every file loose in one folder, with
no `config/` subfolder at all. That mismatch is fixed now; nothing in the PHP
code itself needed to change, just where the files sit on disk.

## Admin lockdown — how "only you" is enforced

Three separate layers, so no one can promote themselves even by calling the
API directly:

1. **`admin_emails` allowlist table** (Supabase) — only `therealolaleye@gmail.com`
   is in it. RLS + revoked grants mean no browser session, not even yours,
   can read or write that table. Only the Supabase SQL editor or your PHP
   backend (service role) can touch it.
2. **`guard_profile_privileged_fields` trigger** (new, in `database/00-schema.sql`) —
   this is the real fix. Previously, `is_admin`, `is_pro`, `is_suspended`,
   `daily_quota`, and `paystack_reference` could technically be changed by
   a user updating their own profile row directly through Supabase's REST
   API (RLS only checked *which row*, not *which columns*). Now, any
   change to those columns from a normal signed-in session is silently
   reverted — only requests made with your service role key (i.e. your PHP
   admin backend, after it independently verifies `is_admin`) can change them.
3. **`admin-keys.php` / `admin-users.php`** — both re-check `is_admin` on the
   server before doing anything, regardless of what the browser sends.

To add another admin later: `INSERT INTO public.admin_emails (email) VALUES ('person@example.com') ON CONFLICT (email) DO NOTHING;`
in the SQL editor, then have them sign out/in.

## What was cleaned up / removed

- **Consolidated 9 numbered SQL migration files into one `00-schema.sql`** that
  builds the current end-state directly (no invites, admin-by-allowlist,
  subscription + admin/usage features, the new guard trigger). The old
  invite-code system these superseded is dropped automatically if present.
- **`04-seed-template-any-new-brand.sql`** → renamed `01-seed-template-any-new-brand.sql`,
  with the now-dead "Step 1: create an invite code" instruction removed
  (sign-up is plain email + password for everyone).
- **`05-push-reminders-cron.sql`** → renamed `02-push-reminders-cron.sql`. Found
  and fixed a real bug: it was pointing at a different Supabase project
  (`wdbfimwtlaxbrvnbkqvk`) than the one in `config/supa-helper.php`
  (`ehofimpglagpdollauuh`) — it would have silently called the wrong project's
  Edge Function every 15 minutes. Fixed to match.
- **`02-yomi-recipe-migration.sql`** → moved to `database/optional/owner-voice-recipe.sql`,
  content untouched (it's your own seeded voice data, still useful, just not
  part of the core install).
- **`maintenancex.html`** → renamed `maintenance.html`.
- App icons replaced everywhere (manifest, favicon, apple-touch-icon,
  service worker cache list, push-notification icon/badge) with the new
  logo, including a properly padded maskable variant so Android/adaptive
  icon masks don't clip it.
- Service worker cache version bumped so every device picks up the new
  paths on next load instead of serving stale cached references to the
  old flat file locations.

## Deploy checklist

1. Upload everything except `database/` to your web root — `index.html` is
   your public landing page, `app.html` is the actual app. Optionally
   include `marketing/maintenance.html` too if you want a holding page
   ready for planned downtime.
2. Run `database/00-schema.sql` once in Supabase SQL Editor.
3. Fill in real values in `config/keys-store.php`.
4. Confirm `ai-proxy.php` / `admin-keys.php` / `admin-users.php`'s
   `ALLOWED_ORIGINS` match your real domain.
5. Sign up at your app URL with `therealolaleye@gmail.com` — that account
   becomes admin automatically.
