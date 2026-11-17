-- ════════════════════════════════════════════════════════════
-- BRAND OS — MASTER SCHEMA (consolidated, fresh-project edition)
-- Run the ENTIRE file once in Supabase → SQL Editor → New Query → Run.
-- Safe/idempotent — every statement uses IF NOT EXISTS / CREATE OR
-- REPLACE / DROP+CREATE, so re-running it does nothing harmful.
--
-- This file replaces the old numbered migration chain
-- (00 → 02 → 04 → 05 → 06 → 07 → 08 → 09). It builds the app directly
-- in its CURRENT, final shape:
--   • No invite codes anywhere — plain email + password sign-up for
--     everyone.
--   • Admin status is granted ONLY by email allowlist (admin_emails,
--     below) — never by anything the client can send.
--   • A guard trigger makes is_admin / is_pro / is_suspended /
--     daily_quota / paystack_reference completely un-writable by a
--     user's own session, even via a direct REST call — only the
--     service role (your PHP admin backend) can change them. This is
--     what stops any user from ever promoting themselves to admin.
--   • Subscription (Pro/Paystack) + usage/quota/suspend features
--     included from the start.
--
-- If your project already ran the old numbered files, you can still
-- run this file safely — every statement is idempotent and will just
-- confirm the current state rather than duplicate anything.
-- ════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── PROFILES ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id                  uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email               text,
  name                text,
  role                text,
  brand_name          text,
  audience            text,
  pillars             text[]      DEFAULT '{}',
  voice_descriptors   text[]      DEFAULT '{}',
  key_phrases         text[]      DEFAULT '{}',
  bio_short           text,
  bio_medium          text,
  bio_long            text,
  voice_posts         text[]      DEFAULT '{}',
  onboarded           boolean     NOT NULL DEFAULT false,
  brand_extra         jsonb       NOT NULL DEFAULT '{}'::jsonb,

  -- Admin / moderation (all guarded — see trigger below)
  is_admin            boolean     NOT NULL DEFAULT false,
  is_suspended         boolean     NOT NULL DEFAULT false,
  daily_quota         int,

  -- Subscription / Paystack (all guarded — see trigger below)
  is_pro              boolean     NOT NULL DEFAULT false,
  pro_expires_at      timestamptz,
  pro_cancelled_at    timestamptz,
  paystack_reference  text UNIQUE,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Belt-and-braces for anyone applying this to an existing table.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role               text,
  ADD COLUMN IF NOT EXISTS brand_name         text,
  ADD COLUMN IF NOT EXISTS audience           text,
  ADD COLUMN IF NOT EXISTS pillars            text[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS voice_descriptors  text[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS key_phrases        text[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS bio_short          text,
  ADD COLUMN IF NOT EXISTS bio_medium         text,
  ADD COLUMN IF NOT EXISTS bio_long           text,
  ADD COLUMN IF NOT EXISTS voice_posts        text[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS brand_extra        jsonb   NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_suspended       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS daily_quota        int,
  ADD COLUMN IF NOT EXISTS is_pro             boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pro_expires_at     timestamptz,
  ADD COLUMN IF NOT EXISTS pro_cancelled_at   timestamptz,
  ADD COLUMN IF NOT EXISTS paystack_reference text UNIQUE;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_paystack_reference_idx
  ON public.profiles (paystack_reference)
  WHERE paystack_reference IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── ADMIN EMAIL ALLOWLIST ────────────────────────────────────────────────
-- Server-only: RLS is enabled with NO policies granted to anon/authenticated,
-- so the browser can never read or write this table under any circumstance.
-- Only the Supabase SQL editor (you) or the service role (PHP backend)
-- can touch it. This is the ONLY mechanism that grants admin.
CREATE TABLE IF NOT EXISTS public.admin_emails (
  email      text        PRIMARY KEY,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_emails ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_emails FROM anon, authenticated;

-- ▼▼ EDIT THIS LIST — one row per admin. Case-insensitive match. ▼▼
INSERT INTO public.admin_emails (email, note)
VALUES ('therealolaleye@gmail.com', 'Owner / primary admin')
ON CONFLICT (email) DO NOTHING;
-- To add another admin later, run just:
--   INSERT INTO public.admin_emails (email) VALUES ('person@example.com')
--   ON CONFLICT (email) DO NOTHING;
-- (Have them sign out and back in afterwards, or run the backfill UPDATE
-- in section "BACKFILL" near the bottom of this file.)


-- ── USER STATE ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_state (
  user_id    uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  state_json jsonb       NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_us_updated_at ON public.user_state;
CREATE TRIGGER trg_us_updated_at
  BEFORE UPDATE ON public.user_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── PUSH REMINDERS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   text NOT NULL,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reminder_log (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date    date NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date)
);


-- ── DAILY AI USAGE COUNTERS ──────────────────────────────────────────────
-- No client-facing RLS policy — only ai-proxy.php (service role) and the
-- increment_usage_if_allowed() RPC below ever touch this table.
CREATE TABLE IF NOT EXISTS public.usage_counters (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day     date NOT NULL,
  count   int  NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;
-- Deliberately no policy for authenticated/anon — service role only.

-- Every shared LLM/NewsAPI/YouTube key lives only in config/keys-store.php
-- on the PHP host — there is deliberately no keys/settings table here.


-- ════════════════════════════════════════════════════════════
--  ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════

ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_state         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_log       ENABLE ROW LEVEL SECURITY;

-- Wipe all existing profile policies first (avoids stale/legacy name
-- collisions from earlier versions of this schema).
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='profiles' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
  END LOOP;
END $$;

-- A user can read/insert/update only their own row. This is what lets
-- someone edit their own name/bio/pillars etc. — but the guard trigger
-- below stops this same policy from ever being used to touch is_admin,
-- is_pro, is_suspended, daily_quota, or paystack_reference.
CREATE POLICY "profiles_own"
  ON public.profiles FOR ALL
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "us_own" ON public.user_state;
CREATE POLICY "us_own" ON public.user_state FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "push_subs_own" ON public.push_subscriptions;
CREATE POLICY "push_subs_own" ON public.push_subscriptions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Reminder log: no client-facing policy — only the send-reminders Edge
-- Function (service role) ever touches it.


-- ════════════════════════════════════════════════════════════
--  GRANTS (table-level — separate from RLS, both are required)
-- ════════════════════════════════════════════════════════════

GRANT USAGE ON SCHEMA public TO authenticated, anon;

GRANT SELECT, INSERT, UPDATE         ON public.profiles           TO authenticated;
GRANT SELECT, INSERT, UPDATE         ON public.user_state         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
-- Deliberately no grants on admin_emails, usage_counters, or reminder_log
-- for authenticated/anon — service role (SQL editor / PHP backend) only.

-- ★ Explicit service_role grants. Supabase projects normally set these up
-- automatically via default privileges when the project is created — but
-- if that ever didn't happen (or got reset), every server-side PHP call
-- (supa-helper.php, admin-keys.php, admin-users.php, ai-proxy.php) fails
-- with "permission denied for table X" even with a 100% correct service
-- role key, because table-level GRANTs are separate from RLS bypass.
-- Running these explicitly means it works regardless of what the project
-- came with by default.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles           TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_state         TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_emails       TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.usage_counters     TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reminder_log       TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;


-- ════════════════════════════════════════════════════════════
--  ★ SELF-PROMOTION GUARD ★
--  This is the piece that makes admin un-fakeable. Even though
--  "profiles_own" above lets a user UPDATE their own row (needed for
--  normal profile edits), this trigger silently strips out any change
--  to the privileged columns UNLESS the request is made by the service
--  role (i.e. by your PHP backend, which authenticates admins itself
--  before ever touching Supabase). A user can send
--  { is_admin: true } in a profile update from the browser console
--  all they like — it will simply be ignored and reverted.
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.guard_profile_privileged_fields()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_is_service boolean := (COALESCE(auth.role(), '') = 'service_role');
  v_email      text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT v_is_service THEN
      -- Never trust client-submitted privileged fields at sign-up time —
      -- reset to safe defaults no matter what the insert payload contains.
      NEW.is_admin           := false;
      NEW.is_suspended       := false;
      NEW.daily_quota        := NULL;
      NEW.is_pro             := false;
      NEW.pro_expires_at     := NULL;
      NEW.pro_cancelled_at   := NULL;
      NEW.paystack_reference := NULL;
    END IF;

    -- Fill in the real auth email server-side (never trust a client-sent
    -- email field) and auto-grant admin on an allowlist match.
    SELECT LOWER(TRIM(u.email)) INTO v_email FROM auth.users u WHERE u.id = NEW.id;
    IF v_email IS NOT NULL THEN
      IF NEW.email IS NULL OR TRIM(NEW.email) = '' THEN
        NEW.email := v_email;
      END IF;
      IF EXISTS (SELECT 1 FROM public.admin_emails a WHERE LOWER(TRIM(a.email)) = v_email) THEN
        NEW.is_admin := true;
      END IF;
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    IF NOT v_is_service THEN
      NEW.is_admin           := OLD.is_admin;
      NEW.is_suspended       := OLD.is_suspended;
      NEW.daily_quota        := OLD.daily_quota;
      NEW.is_pro             := OLD.is_pro;
      NEW.pro_expires_at     := OLD.pro_expires_at;
      NEW.pro_cancelled_at   := OLD.pro_cancelled_at;
      NEW.paystack_reference := OLD.paystack_reference;
      NEW.email              := OLD.email; -- the app never lets a user edit this directly either
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_admin_grant           ON public.profiles; -- old (invite-based) trigger, if present
DROP TRIGGER IF EXISTS trg_apply_admin_allowlist       ON public.profiles; -- old (09) trigger, if present
DROP TRIGGER IF EXISTS trg_guard_profile_privileged_fields ON public.profiles;
CREATE TRIGGER trg_guard_profile_privileged_fields
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileged_fields();


-- ════════════════════════════════════════════════════════════
--  FUNCTIONS (admin RPCs, usage quota)
-- ════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.get_users_for_admin();
CREATE OR REPLACE FUNCTION public.get_users_for_admin()
RETURNS TABLE (
  id             uuid,
  email          text,
  name           text,
  is_admin       boolean,
  onboarded      boolean,
  created_at     timestamptz,
  is_suspended   boolean,
  is_pro         boolean,
  pro_expires_at timestamptz,
  daily_quota    int
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT p.id, COALESCE(p.email, u.email), p.name, p.is_admin, p.onboarded, p.created_at,
         p.is_suspended, p.is_pro, p.pro_expires_at, p.daily_quota
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  ORDER BY p.created_at DESC;
$$;
-- Callable by any signed-in user, but admin-only data only matters once
-- page-admin.js's own is_admin check gates the UI, and the PHP admin
-- endpoints separately re-verify is_admin server-side before acting on it.
GRANT EXECUTE ON FUNCTION public.get_users_for_admin() TO authenticated;

-- Atomic "increment if under quota" — called by ai-proxy.php (service
-- role) before every paid LLM call.
CREATE OR REPLACE FUNCTION public.increment_usage_if_allowed(p_user_id uuid, p_quota int)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'utc')::date;
  v_count int;
BEGIN
  INSERT INTO public.usage_counters (user_id, day, count)
  VALUES (p_user_id, v_today, 0)
  ON CONFLICT (user_id, day) DO NOTHING;

  SELECT count INTO v_count
  FROM public.usage_counters
  WHERE user_id = p_user_id AND day = v_today
  FOR UPDATE;

  IF v_count >= p_quota THEN
    RETURN false;
  END IF;

  UPDATE public.usage_counters SET count = count + 1
  WHERE user_id = p_user_id AND day = v_today;

  RETURN true;
END;
$$;


-- ════════════════════════════════════════════════════════════
--  CLEAN UP ANY LEFTOVER OBJECTS FROM OLDER VERSIONS OF THIS SCHEMA
--  (invites system + global_settings table) — safe no-ops if you're
--  starting fresh and these never existed.
-- ════════════════════════════════════════════════════════════

DROP TRIGGER  IF EXISTS trg_apply_admin_grant ON public.profiles;
DROP FUNCTION IF EXISTS public.apply_admin_grant();
DROP FUNCTION IF EXISTS public.apply_admin_allowlist();
DROP FUNCTION IF EXISTS public.claim_invite(text, text);
DROP FUNCTION IF EXISTS public.list_configured_providers();
DROP TABLE    IF EXISTS public.invite_claims;
DROP TABLE    IF EXISTS public.invites;
DROP TABLE    IF EXISTS public.global_settings;


-- ════════════════════════════════════════════════════════════
--  BACKFILL — safe to run anytime, including right now
-- ════════════════════════════════════════════════════════════

-- Fill any missing profiles.email from auth.users…
UPDATE public.profiles p
SET email = LOWER(TRIM(u.email))
FROM auth.users u
WHERE u.id = p.id
  AND (p.email IS NULL OR TRIM(p.email) = '');

-- …then grant admin to any existing account already on the allowlist,
-- and revoke it from anyone who no longer is (e.g. a note-only entry
-- you removed).
UPDATE public.profiles p
SET is_admin = true
FROM auth.users u
WHERE u.id = p.id
  AND LOWER(TRIM(u.email)) IN (SELECT LOWER(TRIM(email)) FROM public.admin_emails)
  AND p.is_admin = false;

UPDATE public.profiles p
SET is_admin = false
FROM auth.users u
WHERE u.id = p.id
  AND LOWER(TRIM(u.email)) NOT IN (SELECT LOWER(TRIM(email)) FROM public.admin_emails)
  AND p.is_admin = true;


-- ════════════════════════════════════════════════════════════
--  NEXT STEPS (do these separately, not part of this script)
-- ════════════════════════════════════════════════════════════
-- 1. Confirm your email is correct in the admin_emails INSERT above,
--    then sign up (or sign in) at your app URL with that exact email.
--    That account becomes admin automatically — nothing else to click.
-- 2. Fill in your real keys in config/keys-store.php (see the comment
--    at the top of that file — cPanel File Manager, or Admin Panel →
--    Shared API Keys once you're signed in as admin).
-- 3. Dashboard settings:
--      Authentication → Providers → Email → "Confirm email" OFF (or ON,
--        your call — plain email+password works either way)
--      Authentication → URL Configuration → Site URL + Redirect URLs
--        = your real app domain (and a /** wildcard variant)
-- 4. Optional: database/01-seed-template-any-new-brand.sql to layer in
--    a client's voice/pillars after their onboarding; database/optional/
--    for the owner-specific voice recipe.
-- 5. Optional: database/02-push-reminders-cron.sql if you're running the
--    send-reminders Edge Function — update the project URL + service
--    role key in that file first, they must match THIS project.
-- ════════════════════════════════════════════════════════════
