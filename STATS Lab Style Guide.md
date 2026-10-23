# STATS Lab @ CMC — Design System for Claude Instances

Give this file to Claude (paste it into the prompt or project instructions) when building any STATS Lab web app, dashboard, or tool. It is a machine-readable spec, not a document for humans to read.

## Design Direction

Base structure: `stocked-webapp` (shadcn/ui on Next.js + Tailwind — clean, minimal, generous whitespace, no heavy ornamentation). Keep that structure. Swap the color and type tokens for the STATS Lab identity below. Do not add grid backgrounds, corner brackets, or stamp/badge overlays — those belong to the separate DSM-OD-1 satirical aesthetic and clash with a clean minimalist base. This spec produces a serious, academic, well-built tool — not a satirical one.

## Color Tokens (shadcn/CSS variable format, HSL)

Drop into `globals.css` under `:root`:

```css
:root {
  --background: 36.9 39.4% 93.5%;      /* cream #f5f0e8 */
  --foreground: 0 0% 10%;               /* near-black text */
  --card: 0 0% 100%;
  --card-foreground: 0 0% 10%;
  --popover: 0 0% 100%;
  --popover-foreground: 0 0% 10%;
  --primary: 349.0 70.8% 34.9%;         /* maroon #981A31 */
  --primary-foreground: 0 0% 100%;
  --secondary: 192.9 100.0% 21.0%;      /* blue #00546B */
  --secondary-foreground: 0 0% 100%;
  --accent: 309.8 48.0% 24.9%;          /* purple #5E2154 */
  --accent-foreground: 0 0% 100%;
  --muted: 36.9 20% 95%;
  --muted-foreground: 0 0% 35%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 0 0% 98%;
  --border: 36.9 15% 85%;
  --input: 36.9 15% 85%;
  --ring: 349.0 70.8% 34.9%;
  --radius: 0.5rem;
}
```

Hex reference: maroon `#981A31` (primary), blue `#00546B` (secondary), purple `#5E2154` (accent), cream `#f5f0e8` (background). Maroon leads; blue and purple are accents, not co-equal.

## Typography

- **Font:** Inter (as in Stocked) for UI and body text — keep this, don't switch to serif/mono. Import via Google Fonts or `next/font`.
- **Headlines:** Inter, semibold/bold, not italic serif — this is the one deliberate break from older STATS Lab projects (DSM-OD-1, journal feed used Georgia/Courier). The clean sans-only system is what makes the Stocked base feel modern; don't reintroduce serif headlines here.
- **Weight scale:** 400 body, 500 UI labels, 600–700 headings.

## Component Style

- Keep shadcn/ui defaults (`Button`, `Card`, `Input`, `Badge`, etc.) — don't rebuild them.
- `border-radius: 0.5rem` (shadcn default) — rounded but not pill-shaped.
- Primary actions: maroon background, white text. Secondary actions: outline or ghost variant in blue. Destructive actions: default shadcn red, unchanged.
- Cards: white background against the cream page background, subtle border, no drop shadows beyond shadcn defaults.

## Tech Stack

- **GitHub** — version control and hosting for every project, public unless there's a data-sensitivity reason not to be.
- **Supabase** — backend/database for anything needing persistent data, auth, or Postgres.
- **Vercel** — deployment for Next.js apps.
- **Streamlit** — default for quick Python-side data tools, internal dashboards, or pandas-based analysis apps rather than a full Next.js frontend.
- GitHub Pages is fine for static single-file HTML/JS projects that don't need a backend.

## Practical Prompt Snippet

> Build this as a Next.js + Tailwind + shadcn/ui app, styled like a clean minimal SaaS tool (Inter font, generous whitespace, no heavy ornamentation). Use this color system: maroon `#981A31` as primary, blue `#00546B` as secondary, purple `#5E2154` as accent, cream `#f5f0e8` as page background, white cards. Rounded corners (`0.5rem`), shadcn defaults for buttons/cards/inputs. No serif headlines, no grid backgrounds, no bracket or stamp motifs. Use Supabase for backend/data and Vercel for deployment; use Streamlit instead if this is a quick Python data tool rather than a full web app.

## Reference Project

- **Stocked** — `github.com/szzhou4/stocked-webapp`, deployed at `stocked-webapp.vercel.app`. Structural and stack reference. Its current color tokens are default shadcn indigo, not yet updated to the palette above — this spec is the intended direction for Stocked itself, not just future projects.

---
*Internal lab convention. Superseded the earlier maroon/serif/grid-motif spec (DSM-OD-1 style) as the default — that older look is reserved for satirical projects specifically, not the lab's general tools.*
