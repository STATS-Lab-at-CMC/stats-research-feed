-- STATS Research Feed — journals a user added beyond the built-in catalog.
--
-- Run this the same way as the others (SQL Editor → New query → paste → Run).
-- Idempotent, so re-running is harmless.
--
-- Why this syncs rather than staying local:
--
--   The watchlist syncs as a list of journal *ids*. If the definitions behind
--   those ids lived only in the browser that added them, signing in on a
--   second device would restore a watchlist referring to journals that device
--   has never heard of — no name, no ISSNs, nothing to fetch. The ids and the
--   definitions have to travel together or neither should.
--
-- Shape:
--
--   The whole JournalDefinition is stored as jsonb rather than split into
--   columns, for the same reason saved_articles keeps a full snapshot: the
--   client already has a well-defined shape for it, and splitting it here
--   would mean a migration every time that shape gains a field.

create table if not exists public.custom_journals (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  journal_id text        not null,
  journal    jsonb       not null,
  added_at   timestamptz not null default now(),
  primary key (user_id, journal_id)
);

comment on table public.custom_journals is
  'Journals a user added themselves, as full JournalDefinition objects. Synced because the watchlist syncs ids, and an id without its definition is useless on another device.';

alter table public.custom_journals enable row level security;

drop policy if exists "custom_journals are private to their owner" on public.custom_journals;
create policy "custom_journals are private to their owner"
  on public.custom_journals
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
