-- STATS Research Feed — weekly digest preferences.
--
-- Run as with the others (SQL Editor → New query → paste → Run). Idempotent.
--
-- Two columns on user_settings rather than a new table: both belong to the
-- same person as the watchlist and keywords already stored there, and the
-- digest job reads all three together in one query.

-- Opt-in, and `false` is load-bearing rather than a conservative default.
-- Having an account is consent to sync your own data between your own
-- devices; it is not consent to receive a weekly email. Anyone who gets a
-- digest will have switched this on themselves.
alter table public.user_settings
  add column if not exists digest_enabled boolean not null default false;

-- When this account was last sent a digest. Serves two purposes:
--
--   1. It bounds the window. A digest covers articles published since the
--      last one, falling back to the previous 7 days when null (a first
--      send, so there is no "since").
--
--   2. It is the idempotency guard. The send job refuses to send again
--      within six days, so a cron that fires twice — a retry, a redeploy, a
--      manual trigger during testing — cannot produce a duplicate email.
--      Only a *successful* send advances it.
alter table public.user_settings
  add column if not exists last_digest_sent_at timestamptz;

comment on column public.user_settings.digest_enabled is
  'Opt-in for the weekly email. Default false: an account is not consent to be emailed.';

comment on column public.user_settings.last_digest_sent_at is
  'Timestamp of the last successful digest. Bounds the next window and prevents duplicate sends.';

-- The send job finds its recipients with `where digest_enabled`, which on a
-- small table is a sequential scan either way — but this keeps that cheap if
-- the user count ever grows, and partial indexes only cover the rows that
-- matter.
create index if not exists user_settings_digest_enabled_idx
  on public.user_settings (user_id)
  where digest_enabled;

-- No new RLS policy needed. The existing owner-only policy on user_settings
-- already covers these columns: a signed-in reader can flip their own
-- digest_enabled and nobody else's. The send job does not go through RLS at
-- all — it uses the service role key, which bypasses it. That is exactly why
-- that key must never reach a browser.
