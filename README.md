# I-O/Quant Psych Research Feed

**Your personalized research inbox, built by the STATS Lab at CMC.**

A research productivity tool for industrial-organizational and quantitative
psychology researchers. It pulls recent publications from a set of journals you
choose, and — unlike a plain RSS reader — it remembers what you've already
seen, so you can pick up exactly where you left off the next time you check in.

Optionally, it syncs that across your devices and exports what you save
straight into Zotero.

Live at **[stats-lab-research-feed.vercel.app](https://stats-lab-research-feed.vercel.app)**.

---

## What problem this solves

This project exists to fix two specific frustrations with literature feeds
that a research professor identified:

**1. "Where did I leave off?"**
Researchers check a feed sporadically — maybe once a week, maybe once a
month. When you come back, you shouldn't have to re-skim everything you've
already read to figure out what's new. This feed tracks, in your
browser, which articles you've seen, which are new since your last visit,
and roughly where you stopped scrolling — then gives you a one-click
**"Continue where you left off"** to jump back there.

**2. "I only care about my journals."**
Every researcher follows a different slice of the literature. Instead of one
fixed list, you get a **journal watchlist** you can search, customize, and
change any time — your choices persist and immediately reshape the feed.

Everything else in the app (search, filters, sorting, abstracts, open-access
badges) exists in service of those two goals.

## Acknowledgements

Inspired by [Kayla Walters' I/O psychology journal
feed](https://kayla-walters.github.io/io-psych-journal-feed/research_feed.html);
no code from it was used or adapted.

Early demo version built by Amy Mo ([@yanqiao2007](https://github.com/yanqiao2007)), an undergraduate research
assistant in the STATS Lab, as part of her work in the lab.

---

## How it works

### The journal watchlist

You are not limited to the built-in list. Searching for a journal the app does
not know offers to look it up in OpenAlex, and adding one from those results
follows it immediately — OpenAlex indexes essentially all of academic
publishing, so anything with a source record can be followed. Added journals
carry their OpenAlex Source ID, so they skip ISSN resolution entirely, which
also means journals OpenAlex indexes without an ISSN still work. They sync
with your account, because the watchlist syncs ids and an id without its
definition is useless on another device.

The app ships with a default catalog of 38 organizational, I/O, and
quantitative psychology
journals (see [`src/lib/journals/catalog.ts`](src/lib/journals/catalog.ts)),
all followed by default. Open **Manage journals** to search, check/uncheck
individual journals, select all, clear all, or restore the defaults. Your
choices are saved in your browser and immediately reshape the feed.

### Seen / unseen tracking

Seen/unseen state is **entirely manual and deterministic** — click
**Mark as seen** on any article, and click it again to mark it unseen.
Nothing is ever marked seen automatically by scrolling, hovering, or simply
being rendered on screen; an earlier version experimented with automatic
viewport-dwell detection and it was inconsistent in practice, so it was
removed in favor of an explicit, predictable control. Seen articles stay
fully readable but visually recede a little (lighter weight, no unread
accent stripe) so unseen articles stand out.

### "New since your last visit"

The app tracks two timestamps: your current session's activity, and the
*end* of your previous session. A page reload doesn't immediately overwrite
your "previous visit" marker — a real gap in activity (30+ minutes) has to
pass first. That's what makes "3 new since your last visit" mean something:
reloading the page five times in a row won't reset it to zero, and your
very first-ever visit never misleadingly claims the whole 90-day feed is
"new."

### Continue where you left off

The rule is simple and fully deterministic: **Continue** always points to the
*first unseen article, newest-first, across your currently followed
journals*. It's recomputed on every render from your current article set and
seen-state — never persisted, never based on scroll position, viewport
occupancy, or hover — so it can't go stale and always reflects manual
seen/unseen changes immediately, including after a refresh. If you haven't
marked anything seen yet, the banner doesn't show (there's nothing to
resume). If everything is seen, it shows a "you're all caught up" state
instead. Clicking Continue clears any active search/filter so the target is
always reachable, and scrolls straight to it.

---

### Clearing a backlog

**Mark all seen** acts on whatever is currently listed, not the whole feed —
if you have filtered to one journal, that is what it marks. A confirmation
names the exact count and spells out the active filters ("Journal of Applied
Psychology, matching 'leadership'"), because the real risk is not misclicking
the button but not noticing a filter is on. There is no undo, and the dialog
says so.

### Light and dark

A header control toggles between light and dark in one click. It flips the
opposite of what is currently *showing*, not of what is stored — which matters
because the starting state is "follow the OS": a reader on a light OS would
otherwise click once and see nothing change, since "system" and "light" look
identical. Following the OS remains the default until the control is touched.

The theme is deliberately **not** synced to the account: it is a property of
the device you are reading on, and the OS already knows the right answer there.
An inline script in `<head>` applies the stored choice before first paint, so a
dark-mode reader never gets a white flash on load.

The dark palette is not a mechanical inversion. The lab's maroon (34.9%
lightness) and blue (21%) are dark by design and illegible on a dark ground, so
both are lightened until they pass WCAG AA rather than kept "accurate" and
unreadable; the background is a warm near-black so the cream identity stays
recognisable. Measured: body text 14.6:1, card title 13.0:1, white on the
primary 4.8:1, links 7.5:1.

### Copying a citation

Every article card has a **Cite** button that copies an APA 7th-edition
reference. It writes the clipboard in two flavours at once — HTML carrying the
italics APA requires on the journal name and volume, and plain text — so
pasting into Word or Google Docs arrives already formatted while a plain-text
field still gets something sensible.

It handles the forms that actually come up: standard volume(issue), pages;
**Advance online publication** for the ~59% of recent articles with no volume
yet, which is APA's own form for that case rather than a gap; `Article #####`
for publisher e-locations; `(n.d.)` for undated work; and the 21-or-more
authors rule (first 19, ellipsis, final author, no ampersand).

One thing it deliberately does not do is force the article title into sentence
case. OpenAlex returns a mix of title and sentence case, and mechanically
lowercasing would destroy proper nouns and acronyms — "Generative AI" becoming
"generative ai" is a worse error than casing a reader can see and fix.

### Open-access PDFs

Where OpenAlex knows a direct address for a freely readable copy, article cards
show a **PDF** link beside "Open article". Only `best_oa_location.pdf_url` is
used, never its landing page — that is usually the same URL "Open article"
already points at, so labelling it "PDF" would promise a file and sometimes
deliver a paywall.

In practice this covers about a quarter of the feed: of 318 recent articles
across the 38 journals, 159 were open access but only 90 had a direct PDF
address. OpenAlex often knows a free copy exists without knowing where the file
itself is.

### Zotero export

Signed-in users can connect a Zotero library from the account menu and push
their saved articles into it as proper `journalArticle` references — authors,
abstract, DOI, date, journal, and link, all from fields the app already has.
Items arrive tagged **I-O/Quant Psych Research Feed**, so they are easy to find
or remove in bulk later. Where an open-access PDF address is known, it is
attached to the item as a linked-URL child.

**The API key never touches this app's server.** `api.zotero.org` sends
`Access-Control-Allow-Origin: *` and permits the `Zotero-API-Key` header, so
the browser posts to Zotero directly. The key is stored only in the browser
that entered it, is never written to Supabase, and is not part of the synced
state — a Zotero key with write access can alter or delete an entire library,
and holding other people's is a liability better avoided than mitigated. That
guarantee is structural: the key uses `createPersistedValueStore`, whose
signature has no sync-slice parameter, so it cannot join sync even by mistake.

**What does sync is the record of what was exported** — a list of article ids,
not a credential — so exporting from a second device does not create
duplicates. Disconnecting keeps that record (reconnecting the same library
should not re-send everything); switching to a genuinely different library has
an explicit **Reset** control.

PDFs are attached as links rather than stored files. Storing them would mean
fetching each one server-side, since publishers send no CORS headers, which
would spend the user's Zotero storage quota, route every file through this
app's bandwidth, and fetch dozens of PDFs from publishers via a single IP.
Checking the links showed why that last part matters: SAGE and Taylor & Francis
answer automated requests with a Cloudflare bot check that a person clicking
from the feed passes transparently.

## Architecture

```
src/
  app/
    page.tsx, layout.tsx  App Router entry + global CSS
    api/openalex/         Server-side proxy that attaches the OpenAlex key
    auth/confirm/         Where the magic-link email lands
  components/
    ui/                   Small hand-built shadcn/ui-style primitives
                           (Button, Card, Dialog, Checkbox, Switch, …)
    feed/                 Feed-specific UI (ArticleCard, FeedControls,
                           FeedStatusBar, empty/loading/error states, …)
    journals/             Journal watchlist management dialog
    auth/                 Sign-in dialog + header account button
    zotero/               Connect-library section (in the account dialog)
                           and the export dialog
    info/                 The About panel
  hooks/                  React hooks: watchlist, seen state, bookmarks,
                           visit tracking, first-run notice, Zotero key
  lib/
    auth/AuthProvider.tsx Auth context: session state, magic link, sign-out
    supabase/client.ts    Browser Supabase client (null when unconfigured)
    sync/                 Local-first cloud sync: the store<->cloud bus,
                           the Supabase data layer, and the engine that
                           seeds/pulls/pushes — the ONLY place that talks
                           to Supabase tables
    zotero/client.ts      Zotero Web API v3 — the ONLY place that talks to
                           Zotero, and the only place the user's Zotero key
                           is ever read
    journals/catalog.ts   The static journal catalog (name + ISSNs)
    feed/continueTarget.ts Pure function deriving the "Continue where you
                           left off" target from articles + seen state
    openalex/              OpenAlex data-access layer (client, source
                           resolution, work fetching, normalization, demo
                           fallback data) — the ONLY place that talks to
                           OpenAlex
    storage/               Isolated localStorage adapter + key registry
    types.ts               Shared Article/Journal/filter types
    utils/                 Date formatting, text sanitization, cn() helper
```

The guiding rule: **UI components never call OpenAlex, Supabase, Zotero, or
`localStorage` directly.** They call hooks (`useWatchlist`, `useSeenState`, …) or the
`getFeedArticles()` function from `lib/openalex/feed.ts`. That keeps the
data-fetching and persistence logic centralized, testable, and swappable.

## Tech stack

- **Next.js 16** (App Router, Turbopack) + **TypeScript** (strict mode)
- **Tailwind CSS v4** — design tokens from the STATS Lab style guide (cream
  background, maroon primary, restrained blue/purple accents, Inter
  typeface, `0.5rem` corner radii, no gradients/glassmorphism)
- Hand-built **shadcn/ui-style** primitives on top of Radix UI primitives
  (`@radix-ui/react-dialog`, `-checkbox`, `-switch`, `-separator`) — no
  heavyweight component library
- **React hooks + `useSyncExternalStore`** for state — no Redux/Zustand/etc.
- **OpenAlex** as the live research metadata source (see below), behind a
  server-side proxy that holds the API key
- **Zotero Web API v3** for reference export, called directly from the browser
  so the user's key never reaches this app's server
- **Supabase** (Postgres + Auth) for the *optional* account layer — magic-link
  sign-in and cross-device sync. Entirely opt-in at both the deployment level
  (no env vars → no accounts) and the user level (no sign-in → no server)

## OpenAlex integration

[OpenAlex](https://openalex.org) is a free, fully open scholarly index.
Browsing it is keyless, but **as of October 2026 a free API key is required
to page past the first page of results with `cursor=`** — without one a
38-journal watchlist silently truncates to 100 articles.

The key is therefore held server-side by the `/api/openalex/*` route
(`src/app/api/openalex/[...path]/route.ts`) and never shipped to the browser:
this is a public site, and an OpenAlex key carries the issuing person's daily
budget. All client requests go through that proxy, which works with or
without a key configured. Two incidental benefits: OpenAlex sees the
deployment's IP rather than each reader's, and identical upstream requests
are CDN-cached, so a popular watchlist costs one upstream call instead of one
per visitor.

Set `OPENALEX_API_KEY` (no `NEXT_PUBLIC_` prefix) locally and in Vercel — see
[`.env.example`](.env.example). Without it the app still runs, and now says so
rather than quietly serving a short feed.

The data-access layer (`src/lib/openalex/`) does the following, without ever
hand-typing a guessed OpenAlex ID:

1. **Resolve journals → OpenAlex Source IDs by ISSN, cached per journal.**
   Every journal in the catalog carries its print/online ISSNs (cross-checked
   against the ISSN International Centre portal, publisher pages, and
   Wikipedia). Each journal's resolved Source ID (or confirmed
   "unresolvable") is cached independently in `localStorage` for 24 hours
   (`src/lib/openalex/sources.ts`). Only journals whose cached resolution is
   missing or stale are looked up — and those are still batched into as few
   `GET /sources?filter=issn:a|b|c|...` requests as possible (never one
   request per journal), never a fuzzy title match.
2. **Fetch recent works by source, cached per journal.** Each journal's
   recent works are cached independently for 20 minutes
   (`src/lib/openalex/feed.ts`). Only journals whose cache is missing or
   stale get fetched, and — same principle — every stale/missing journal in
   one load is OR'd together into as few
   `GET /works?filter=primary_location.source.id:S1|S2|...,
   from_publication_date:<90 days ago>,type:article|review,is_retracted:false`
   requests as possible, paginated via OpenAlex's cursor API and capped at a
   sane number of pages per batch. Because each journal's data is cached
   independently, **toggling a journal in the watchlist is a purely local
   operation** — unfollowing never triggers a network call, and re-following
   a journal whose data is still fresh is instant. Only genuinely new or
   stale journals ever hit the network, and identical concurrent requests
   (same URL in flight at the same time) are de-duplicated in
   `src/lib/openalex/client.ts`.
3. **Filter to genuine scholarly content.** The `type:article|review,
   is_retracted:false` filter (verified against OpenAlex's current API docs,
   including its July 2026 type-classification overhaul) excludes errata,
   corrections, editorials, letters, and retracted works server-side, while
   keeping legitimate review articles. `normalize.ts` re-checks the same
   condition defensively in case a record is missing the field or a future
   code path queries OpenAlex without the filter.
4. **Normalize** every OpenAlex work into a consistent internal `Article`
   shape — reconstructing the abstract from OpenAlex's inverted-index
   format, extracting a safe DOI/article URL, and gracefully defaulting
   missing authors/dates/OA status/abstracts instead of erroring. Only these
   normalized fields are cached — never raw OpenAlex response payloads — to
   keep the `localStorage` footprint compact.
5. **De-duplicate** by work ID and then by DOI.

All UI-level filtering and sorting — text search, seen/unseen, Open Access,
sort order, expanding an abstract, marking an article seen — operates
entirely on the already-fetched, already-cached article set in memory and
never triggers a new OpenAlex request.

If OpenAlex can't be reached, or a specific journal's source can't be
resolved, the app **never fabricates data or fakes a live result**. Instead
it falls back to a small, clearly-labeled demo dataset (every title is
prefixed "Demo Article:", carries a "Demo data" badge, and a banner explains
what happened) so the app still renders something useful. Any journal that
couldn't be resolved is flagged directly in the "Manage journals" dialog.

### Caching model at a glance

| What | Where | Granularity | TTL |
|---|---|---|---|
| Journal → OpenAlex Source ID | `localStorage` (`stats-feed:openalex-source-cache`) | per journal | 24h |
| Recent works per journal | `localStorage` (`stats-feed:openalex-works-cache`) | per journal | 20min |
| In-flight duplicate requests | in-memory (per browser tab) | per exact URL | until settled |

Everything is per-browser, client-side `localStorage` — there's no server, so
nothing is shared across users or devices, and a hard refresh just re-reads
the same cache (no data loss). This is intentionally simple for a research
prototype; a future version with a backend could add a shared server-side
cache, but that's out of scope here.

## Running it locally

Requirements: Node.js 18.18+ (Node 22 recommended) and npm.

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000). It runs with no
configuration at all, but two optional environment variables matter (see
[`.env.example`](.env.example)):

| Variable | Without it |
|---|---|
| `OPENALEX_API_KEY` | The feed caps at the first 100 results, with a banner saying so. OpenAlex gates cursor paging behind a key, so this is **strongly recommended** — it is free and takes a minute. Note there is no `NEXT_PUBLIC_` prefix: it is read server-side only. |
| `NEXT_PUBLIC_SUPABASE_URL` / `..._ANON_KEY` | No accounts, no cross-device sync, and no Zotero export (which is account-gated). Everything else works, saved in the browser. |

Turning on accounts takes about 15 minutes — see
[`SUPABASE_SETUP.md`](SUPABASE_SETUP.md). Note that the auth email templates in
[`supabase/email-templates/`](supabase/email-templates/) are **not optional for
institutional email**: they carry a 6-digit sign-in code alongside the link,
because university mail systems routinely open inbound links before the reader
does, which spends a single-use link. A code typed by hand cannot be consumed
that way.

Other useful commands:

```bash
npm run build   # production build
npm run start   # run the production build locally
npm run lint    # ESLint
```

> **Verification status (Oct 2026).** Everything below was exercised against
> live services, not mocks: `npm run build`, `npm run lint` and
> `npx tsc --noEmit` pass; a cold load retrieves the full feed from
> `api.openalex.org` with no demo fallback and no unresolved journals; the
> Supabase migrations are applied and row-level security is confirmed enforced
> on all four tables (an anonymous write is rejected by Postgres, not just by
> the browser); the
> magic-link sign-in completes end to end and seeds a new account from local
> state; and the Zotero field mapping is checked against Zotero's own
> `journalArticle` template, which rejects unknown fields.
>
> **Not verified:** a successful Zotero write. That needs a real
> write-capable key, which belongs to the user rather than in a test. The
> failure paths — invalid key, read-only key — were exercised against the live
> API and behave correctly, and the key is confirmed absent from the HTML and
> every JS chunk.

## How local persistence works

Everything the app remembers about you lives in your browser's
`localStorage`. Without an account that is the whole story — nothing leaves
your device. With an account, three of these keys additionally sync (see
"Optional accounts and cross-device sync" below); the rest never do.
See `src/lib/storage/localStorageAdapter.ts` and
`src/lib/storage/keys.ts` for the full list of keys. In short, it persists:

- Your followed journal IDs
- Which article IDs you've marked seen (manually — see "Seen / unseen
  tracking" above)
- Your previous-visit timestamp (used for "new since last visit")
- Saved/bookmarked articles — a **full snapshot** of each article (title,
  authors, journal, date, abstract, link), not just its id, so a saved
  article stays viewable in the **Saved** tab even if you later unfollow
  its journal or it ages out of the 90-day feed window
- Whether you've dismissed the first-run notice
- Your Zotero API key, if you connected one — **this one never syncs and never
  leaves the browser**, unlike everything else in this list
- Which account the synced state belongs to, when signed in (so one person's
  local state can never be pushed up into another person's new account on a
  shared machine)
- Per-journal caches of OpenAlex source-ID resolutions and recent works (to
  avoid refetching data that's already fresh — see "Caching model at a
  glance" above)

"Continue where you left off" is **not** persisted — it's recomputed on every
render from your current articles and seen-state (see "Continue where you
left off" above), so there's nothing to list here for it.

All reads/writes go through one small adapter (`storage.get/set/remove`),
and every hook that owns a piece of state (`useWatchlist`, `useSeenState`,
etc.) is built on that adapter plus `useSyncExternalStore` — never
`localStorage` calls scattered through components.

## Optional accounts and cross-device sync

Accounts are off until someone configures them, and optional for every reader
even then. The model is **local-first**: `localStorage` remains the single
synchronous source of truth the UI renders from, signed in or not. That is
what keeps the read path free of loading spinners and keeps the whole app
working offline and signed out, exactly as V1 did.

Setup lives in [`SUPABASE_SETUP.md`](SUPABASE_SETUP.md); the schema and its
row-level security policies live in
[`supabase/migrations/0001_user_state.sql`](supabase/migrations/0001_user_state.sql).

### What syncs, and what deliberately doesn't

| State | Syncs? | Why |
|---|---|---|
| Followed journals | Yes | Real curation effort; the main thing worth carrying between devices |
| Seen article ids | Yes | The feature the app exists for — "where did I leave off" should survive a change of machine |
| Saved articles (full snapshots) | Yes | Same reasoning, and the snapshot keeps them readable after a journal is unfollowed |
| Which articles went to Zotero | Yes | Bookkeeping, not a credential. Kept per-browser it was useless: a second device re-exported everything |
| Journals you added yourself | Yes | The watchlist syncs ids; without the definitions, another device gets ids it cannot render or fetch |
| **Zotero API key** | **No** | **Can alter or delete an entire library. Stays in the browser that entered it, travels only to api.zotero.org** |
| Previous-visit timestamps | No | Genuinely per-device: "new since your last visit" means your last visit *here* |
| OpenAlex source/works caches | No | Disposable performance data with a 20-minute/24-hour TTL. Syncing them would add write traffic and staleness bugs for no benefit |

### How it behaves

- **Signing in for the first time** seeds the cloud *from* the browser, so a
  reader who spent months curating a watchlist anonymously keeps all of it.
- **Every load after that** treats the cloud as authoritative and overwrites
  local state. This is deliberately not a merge: a union cannot tell "absent"
  from "deliberately deleted", so merging would resurrect journals the user
  unfollowed and articles they marked unseen.
- **Each change pushes a delta** (one row), not a rewrite of the whole list,
  and writes are queued strictly in order so two rapid toggles cannot land
  backwards.
- **A click during the opening pull is replayed** on top of whatever the
  server sent, rather than being silently overwritten.
- **Signing out clears the synced slices from the browser** — the data stays
  in the account. This matters on a shared lab machine, and the sign-out
  confirmation says so plainly.
- **One person's local state never seeds another person's new account.** The
  browser records which user its synced state belongs to, and refuses to push
  it up into a different account.

### Where the code lives

```
hooks/createPersistedStore.ts   Emits a delta on each mutation; registers
                                 snapshot/applyRemote/resetLocal per slice
lib/sync/bus.ts                 Dependency-free seam between the two (no
                                 React, no Supabase — avoids an import cycle)
lib/sync/remote.ts              Every Supabase table query, and nothing else
lib/sync/engine.ts              Seed/pull/push orchestration + write queue
lib/auth/AuthProvider.tsx       Session state and the magic-link call
lib/zotero/client.ts            Zotero API; the only reader of the key
```

Schema and row-level security policies live in
[`supabase/migrations/`](supabase/migrations/) — run both files. Auth email
templates are in [`supabase/email-templates/`](supabase/email-templates/) and
are **not optional for institutional email**: the stock Supabase template links
through an endpoint that university mail scanners consume before the reader
clicks. Full setup in [`SUPABASE_SETUP.md`](SUPABASE_SETUP.md).

The same containment rule as the OpenAlex layer applies: UI components never
touch Supabase directly.

## Current limitations

- **Accounts are optional, and off by default.** With no Supabase project
  configured, state lives in one browser: clear your browser data (or switch
  browsers/devices) and it's gone. See
  [`SUPABASE_SETUP.md`](SUPABASE_SETUP.md) to turn sync on.
- **Signed in, the server wins on load.** A change made while genuinely
  offline is lost if the tab reloads before reconnecting. Queued writes live
  in memory, not on disk. For a feed you check periodically this is a fair
  trade for never resurrecting deleted state, but it is a real limitation.
- **No realtime.** Another device's changes arrive on page load or when the
  tab regains focus, not instantly. Two devices edited simultaneously will
  not fight, but they will not live-update each other either.
- **Sync is per-tab.** Two tabs of this app open at once do not notify each
  other of local changes; the second tab picks them up on reload or refocus.
- **No self-service account deletion.** Removing a user is a manual
  `delete from auth.users` in the Supabase dashboard (it cascades).
- **The Supabase account layer has not been run against a live Supabase
  project.** The machine this was built on had no Docker or Supabase CLI, so
  no Postgres could be started locally. Typecheck, lint, and production build
  pass; the signed-out path, the sign-in dialog, the unreachable-server error
  path, and the `/auth/confirm` failure screen were all exercised in a
  browser. What remains unverified is everything that needs a real server:
  the migration SQL actually applying, the RLS policies, a real magic-link
  round trip, and sync between two devices. Walk through "Checking it
  actually works" in [`SUPABASE_SETUP.md`](SUPABASE_SETUP.md) once before
  relying on it.
- **An OpenAlex API key is effectively required.** Without `OPENALEX_API_KEY`
  the feed is capped at the first 100 results, because OpenAlex gates cursor
  paging behind a key. The app detects this and shows a "showing only part of
  your feed" banner carrying OpenAlex's own explanation, rather than silently
  serving a short feed as it did before Oct 2026.
- **Zotero export is one-way and account-gated.** It pushes saved articles to
  Zotero and never reads back, so anything deleted in Zotero is not noticed,
  and the app will not re-send it (the export record says it already went).
  The **Reset** control in the account menu is the way out of that.
- **The Zotero key is per-browser by design.** Signing in on a new device
  brings your watchlist and export history across, but still asks for the key.
  That asymmetry is deliberate, not an oversight.
- **Author names split on the final space**, which is what most Zotero
  importers do. "Jan van der Berg" comes through imperfectly. Every heuristic
  here trades one class of error for another.
- **PDF links cover about a quarter of the feed** — OpenAlex often knows a free
  copy exists without knowing a direct PDF address. Publisher-hosted links may
  show a brief Cloudflare check before the file; repository-hosted ones load
  directly.
- **Topic filtering was intentionally not built.** OpenAlex's topic/concept
  metadata isn't reliably populated for every work, and the brief explicitly
  said not to sacrifice core functionality for it.
- **No push notifications or email digests** — this is a pull-based feed you
  check when you want to.
- The 90-day retrieval window and per-request page caps are reasonable
  defaults, not tuned against real traffic volume for all 38 journals at
  once.
- OpenAlex's `type`/`is_retracted` classification (verified current as of
  2026-08-26) is itself imperfect — its July 2026 overhaul improved accuracy
  to ~78% against ground truth, up from ~69%, so a small amount of
  misclassified content may still slip through or be over-excluded. The
  `type:article|review` allowlist plus `is_retracted:false` is the best
  currently-available filter, not a guarantee of a perfectly clean corpus.

## Journal source mapping status

All 38 journals are in the catalog with print **and** online
ISSNs cross-checked against multiple independent sources (the ISSN
International Centre portal, publisher pages, Wikipedia) — no journal was
dropped, and no OpenAlex Source ID was hand-typed or guessed anywhere in the
codebase. Resolution from ISSN → OpenAlex Source ID happens **live, at
runtime**, via OpenAlex's own `/sources?filter=issn:...` endpoint, cached
independently per journal for 24h (see `src/lib/openalex/sources.ts`), and
any journal OpenAlex doesn't return a match for is surfaced directly in the
"Manage journals" dialog rather than silently dropped or faked.

This live resolution step has now been exercised against the real API: a cold
load resolved all 38 journals to OpenAlex Source IDs and returned 339
articles, with nothing flagged as unresolved in "Manage journals".

## Deploying to Vercel

This is a standard Next.js App Router project, so it deploys to Vercel with
no configuration: connect the GitHub repo, accept the defaults, deploy. No
environment variables are required — a deployment without them simply has no
accounts, and the feed works exactly as described above.

To enable accounts on a deployment, add `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` in the Vercel project settings and add that
origin's `/auth/confirm` to Supabase's redirect allowlist — see
[`SUPABASE_SETUP.md`](SUPABASE_SETUP.md) step 6.

## Roadmap ideas

- Optional email/weekly-digest summaries of new articles
- Author-level or topic-level following, once OpenAlex's topic metadata is
  reliably populated across these journals
- Choosing a destination Zotero collection, rather than the library root
- Checking Zotero for an existing item by DOI before export, which would also
  catch items added by Zotero's own browser connector
