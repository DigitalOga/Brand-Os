-- Run this AFTER deploying the send-reminders Edge Function (see
-- /supabase/functions/send-reminders/index.ts). Needs pg_cron + pg_net
-- extensions, which this enables automatically.
--
-- ✅ Project confirmed as ehofimpglagpdollauuh (matches supabase-client.js
-- and config/supa-helper.php). URL below updated to match — just paste
-- your service role key before running.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.unschedule('brandos-send-reminders')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'brandos-send-reminders');

SELECT cron.schedule(
  'brandos-send-reminders',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://ehofimpglagpdollauuh.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer PASTE-YOUR-SERVICE-ROLE-KEY-HERE'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Confirm it's registered:
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'brandos-send-reminders';

-- To find your service role key: Supabase Dashboard → Project Settings
-- → API → service_role key (NOT the anon key — this one is secret,
-- never put it in any client-side file, only here in a server-side
-- scheduled SQL job).
