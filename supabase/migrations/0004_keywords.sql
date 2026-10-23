-- STATS Research Feed — saved keywords.
--
-- Run as with the others (SQL Editor → New query → paste → Run). Idempotent.
--
-- A column on user_settings rather than a new table: the list is small and
-- bounded by what a person will actually type, it is read and written whole,
-- and it belongs to the same row as the watchlist it sits beside in the UI.
-- Matching the followed_journal_ids shape also means it reuses the existing
-- settings read and write paths rather than adding another round trip.
--
-- `add column if not exists` is what makes this safe to re-run and safe to
-- apply to a project that already has rows: existing users get the default
-- empty array rather than a null that every reader would have to guard.

alter table public.user_settings
  add column if not exists keywords text[] not null default '{}';

comment on column public.user_settings.keywords is
  'Terms the user watches for. Matched against article titles and abstracts in the browser; never used to query OpenAlex, so a keyword list is never sent anywhere.';
