-- STATS Research Feed — record of which articles have been exported to Zotero.
--
-- Run this the same way as 0001 (SQL Editor → New query → paste → Run).
-- Idempotent, so re-running is harmless.
--
-- Why this table exists:
--
--   Which articles have already gone to Zotero was previously tracked in
--   localStorage only. That made the duplicate guard per-browser: exporting
--   from a second device re-sent everything, as did clearing site data. Zotero
--   has a Duplicate Items view that cleans up after the fact, but the better
--   answer is not to create them.
--
--   This is bookkeeping, not a credential. A row says "article W123 was
--   exported", which carries no more sensitivity than the saved-articles table
--   it mirrors.
--
-- What is deliberately NOT here:
--
--   The Zotero API key, and the identity of the connected Zotero account.
--   A Zotero key with write access can alter or delete an entire library, so
--   it stays in the browser that entered it and travels only to
--   api.zotero.org. See src/hooks/useZoteroKey.ts. Nothing in this schema
--   should ever grow a column for it.

create table if not exists public.zotero_exports (
  user_id     uuid        not null references auth.users (id) on delete cascade,
  article_id  text        not null,
  exported_at timestamptz not null default now(),
  primary key (user_id, article_id)
);

comment on table public.zotero_exports is
  'One row per (user, article) already exported to Zotero, so a second export from any device skips it. Never stores Zotero credentials.';

-- Same owner-only policy as every other table: enforced by Postgres on both
-- read and write, not merely checked in the browser. `using` gates reads and
-- which rows an update/delete may touch; `with check` gates what an insert or
-- update may produce. Both are required.
alter table public.zotero_exports enable row level security;

drop policy if exists "zotero_exports are private to their owner" on public.zotero_exports;
create policy "zotero_exports are private to their owner"
  on public.zotero_exports
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
