# Project notes — saudiexperiencelabs

Durable context for whoever (or whichever session) picks this up next. Code
and commit messages are the primary source of truth; this file exists for
the *why* behind decisions that don't have an obvious home in code comments.

## What this is

Internal idea-pipeline platform for 7 Saudi Tourism Authority Experience
Labs. Ideas move through a 6-stage pipeline (Longlist → Shortlist → Concept
→ Prototyping/Field-Testing → Go-Live → Distribution), rated against
criteria, inside per-lab branded spaces with partner co-branding. ~25 users.
Priorities in order: **reliability, simplicity, ease of use**.

Live at **https://www.saudiexperiencelabs.com**. Repo:
**https://github.com/Epimetheus3000/saudiexperiencelabs**. Deploys
automatically via Vercel on every push to `main`.

## Architecture

- Next.js 16 (App Router), Supabase (Postgres + Auth + Storage), Vercel,
  shadcn/ui (this version uses **Base UI**, not Radix — components use a
  `render` prop instead of `asChild`), Tailwind v4 (CSS-based config, no
  `tailwind.config.ts`), dnd-kit, Zod.
- Supabase project ref `eiogcuytbxqksktkfgzx`. Env vars
  (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`) are set in both `.env.local` (gitignored) and
  Vercel's project settings.
- Two schema migrations in `supabase/migrations/`: `0001_init.sql` (auth
  sync, RLS, 3-stage pipeline) and `0002_six_stage_pipeline.sql` (6 stages,
  `stage_data` JSONB, partner branding columns, storage bucket). Both are
  applied to production already — run future migrations the same way, by
  pasting into the Supabase SQL Editor (no CLI/Docker access on this dev
  machine, so no `supabase db push` workflow is set up).

## Permissions model

Two role types, enforced via **Postgres RLS**, not just app-level checks:

- **Master** (one flag, `is_master`): full access everywhere. No exceptions.
- **Team member / Partner**: rows in `lab_memberships`. A partner
  (`is_external = true`) is blocked at the DB trigger level from ever having
  a second membership row, even under concurrent inserts (advisory lock).

`has_lab_access()` and `is_master()` Postgres functions back every RLS
policy. Admin server actions that use the service-role client (bypasses RLS
entirely — user invites, deletes) all call `requireMaster()` first as a
defense-in-depth check, since the service role has no RLS protection of its
own.

## Data model notes

- `ideas.stage_data` is a single JSONB column holding all stage-specific
  fields, keyed by stage *name* → a short key (`shortlist`, `concept`,
  `prototyping`, `goLive`, `distribution` — see
  `src/app/labs/[labId]/stage-data.ts`). This replaced separate fixed
  columns (`shortlist_reasoning`, `concept_details`, etc.) in migration
  0002. Rationale: stages 3–6 each need a different field set, and one
  flexible JSON column is simpler than a table that grows a column per
  stage with mostly-empty rows.
- Keying by stage *name* rather than stage *id* is a deliberate tradeoff:
  reads better in the DB, matches how the DB triggers already identify
  stages by name (`Longlist`, `Shortlist`), but would orphan data if a
  Master ever renamed a default stage. There's no rename UI today, so this
  is accepted, not an oversight.
- Business rules enforced via Postgres triggers (not just app code), per the
  brief's reliability priority: 50-idea Longlist cap (race-safe via advisory
  lock), shortlist-reasoning-required-to-leave-Longlist gate, external
  single-membership cap, auto-seeding 6 stages when a lab is created.
- **Checklists (Shortlist "things to consider", Go-Live launch checklist)
  are tracked but non-blocking** — items are checkable and saved, but never
  prevent a card moving to the next stage. This was an explicit product
  decision (asked, confirmed) over making them hard gates.
- Concept, Prototyping, and Distribution each require one key field
  (`story`, `mvpDescription`, `requirements` respectively) before an idea
  can move *into* that stage — the same "fill this in before the move
  completes" pattern as Shortlist's reasoning gate, implemented client-side
  in `pipeline-board.tsx` via `StageGateDialog`. Go-Live is deliberately
  excluded, per the non-blocking-checklist decision above.

**Gotcha: server actions here rely on `revalidatePath`, which is not
enough on its own.** It invalidates the Next.js cache server-side, but an
already-mounted client component's props won't refetch until something
calls `router.refresh()` from the browser. Every mutation in
`src/app/labs/[labId]/components/` (favorites, comments, ratings, stage
data, requirements, idea creation) must call `router.refresh()` after a
successful action, or the UI silently goes stale until a manual reload.
This bit both "new idea doesn't appear" and "favorite star doesn't update"
in practice — if a new mutation is added here, don't repeat it.

## Brand system — read this before touching anything visual

The user provided the actual official "ST23 Comprehensive Interactive
Guidelines" PDF from Saudi Tourism Authority. All brand assets in
`public/brand/` were extracted directly from it (see "Asset extraction"
below) — **never hand-redraw or approximate these**; the guidelines
explicitly state visual properties and the logotype must be reproduced from
master artwork and never altered, redrawn, or recolored.

**Exact palette** (from guidelines p.20 — do not introduce colors outside
this set):

| Role | Hex |
|---|---|
| Primary dark purple | `#78006E` |
| Primary vibrant purple | `#BE008C` |
| Neutral gray | `#EBEBEB` |
| Functional text gray | `#4B4B4B` |
| Secondary red | `#FF4664` |
| Secondary orange | `#FA783C` |
| Secondary dark blue | `#646EC8` |
| Secondary blue | `#64A0DC` |
| Secondary dark green | `#3CA06E` |
| Secondary green | `#46C8A0` |

All defined as CSS custom properties in `src/app/globals.css`.

**Hard rule from the guidelines (p.21)**: *"Our dark purple and white are
the only brand colors used for backgrounds. Any other brand colors used are
incorrect."* This is why per-lab distinction is done via accent color
(text, borders, a recolored pattern band) rather than a colored background
fill — a real conflict surfaced early on and resolved explicitly with the
user rather than guessed at.

**Per-lab accent color**: one of 7 approved options (the 6 secondary colors
+ vibrant purple), picked via the swatch UI in
`src/components/admin/brand-color-picker.tsx`, stored in `labs.primary_color`
(name predates the brand work; it's really "accent color" now). The 4 labs
created before this system existed still have ad-hoc, off-brand colors
(`#932092`, `#0f172a`, `#aa7941`, `#919191`) — **this was flagged to the
user and is still pending their decision** on whether to auto-migrate them
to on-brand swatches or let them pick manually.

**Visual properties (patterns)**: the guidelines define 6 styles (Tile,
Grid, Layer, Expressive, Strip, Minimal). Per explicit user instruction,
only **Strip** and **Minimal** are used inside the app itself (kanban
board, headers, dividers); **Grid** is reserved for the login page as the
one "bigger brand moment" screen. Don't mix property styles on one screen.

- `public/brand/pattern-strip-mask.png` — the "Strip solid" property
  (guidelines p.42), extracted as a black-alpha mask so it can be recolored
  via CSS `mask-image` to any of the 7 approved accent colors without ever
  altering the artwork's shape. Applied via the `.pattern-strip` CSS class
  (`--strip-color` custom property controls the tint).
- `.pattern-strip-minimal` is the same mask at low-opacity gray — this is
  what "Minimal" actually means per the guidelines (p.38): a monochrome
  tonal (purple/light-purple or gray/white only) application of the same
  pattern family for subtle contexts, **not** a separate small icon asset as
  might be assumed from the name.
- `public/brand/pattern-grid.jpg` — the "Grid" property (p.36-37), used
  full-bleed on the login page only.
- `public/brand/visit-saudi-logo.png` — the "Welcome to Arabia — Stacked"
  logotype lockup (guidelines p.9, p.14). This is the primary general-use
  lockup for Latin/English communications. **Do not use the "Horizontal"
  variant** — the guidelines mark it "used only in special cases, please
  seek approval." Do not separate the "Welcome to Arabia" tagline from the
  "Saudi" wordmark; they're one approved unit. Minimum on-screen size per
  the guidelines is 90px wide, with clear space around it of roughly 1/5 of
  the wordmark's width.

**Typography**: the guidelines call for "Saudi Serif" (headline) / "Saudi
Sans" (body), both proprietary and not provided. Per explicit user
instruction, the site now uses real Google Fonts as the working choice:
**Fraunces** for display/headings, **Open Sans** (400 + 700) for body copy,
loaded via `next/font/google` in `src/app/layout.tsx` and exposed as
`--font-heading-brand` / `--font-body-brand` in `globals.css`. `font-sans`
(the site's default body font) and `font-heading` (used by `CardTitle`,
`DialogTitle`, `AlertDialogTitle`, and `h1`–`h3`) both resolve from these. If
the real Saudi Serif/Sans files arrive later, swap the two `next/font`
imports and variables — no component code should need to change.

**Partner logos**: explicitly left as placeholders (a dashed "?" box shown
when `partner_name` is set but `partner_logo_url` isn't) — the user is
sourcing these directly from each partner (HiHome, Archinations, Al
Khaleej/Gordon Ramsay Academy, Vocally) rather than having them fabricated
or scraped. Same for the Visit Saudi mark, which was reproduced from the
guidelines directly instead.

### Asset extraction process (for reference, not to be repeated blindly)

The user first shared an SVG file described as "extracted from the official
brand guidelines." Its embedded C2PA metadata revealed it was actually
AI-generated by a different Claude session, not a real extraction — this
was caught and flagged before it got used anywhere. The user then provided
the actual guidelines PDF, and assets were properly extracted from that
using `pypdf` + `pymupdf` (rendering pages at high DPI, then cropping/
masking with `Pillow`) — none of these Python packages are installed
globally; they were `pip install --user`'d into the system Python. The
source PDF and intermediate extraction files live in `brand-assets/`,
which is gitignored (too large, and just working material — only the final
processed files in `public/brand/` are needed by the app).

## Known open items (asked, not yet resolved)

1. **4 existing labs have off-brand accent colors** — user hasn't decided
   whether to auto-migrate or pick manually via the new swatch UI.
2. **Corporate wifi blocks the domain** — likely the user's company secure
   web gateway auto-blocking `saudiexperiencelabs.com` as a newly-registered
   domain. Suggested fix: ask their IT to whitelist the domain (and
   `*.supabase.co`, since magic-link auth calls Supabase directly from the
   browser). Not something fixable from this side.
3. ~~**Invite emails not arriving reliably**~~ — resolved: custom SMTP via
   Resend is configured in Supabase (Authentication → Emails → SMTP
   Settings), with `saudiexperiencelabs.com` verified via SPF/DKIM at
   Namecheap.
4. **Real font files** (Saudi Serif, Saudi Sans) — pending from the user.
5. **Partner logo files** — pending from the user, sourced directly from
   each partner.

## Magic-link sign-in flow (PKCE → token_hash + explicit click)

The login flow originally used `signInWithOtp` + a `/auth/callback` route
calling `exchangeCodeForSession(code)` (PKCE) — the standard Supabase SSR
pattern. In practice, users on corporate email (the same networks that
already interfered with domain access — see the wifi item above, now
resolved via Resend/SPF/DKIM) reported clicking the magic link and landing
back on the login page instead of being signed in.

Root cause: many corporate email security gateways (Safe Links, Mimecast,
Proofpoint, etc.) pre-fetch/scan links in inbound mail *before* the
recipient clicks them. PKCE codes and OTP tokens are single-use — a scan
consumes it, so the real click gets an already-expired token and fails.
This also happens independent of scanning if someone requests the link on
one device/browser and opens it on another, since PKCE requires a matching
`code_verifier` cookie from the requesting browser.

Fix, in two parts:
1. **`/auth/confirm`** (`src/app/auth/confirm/page.tsx`) replaces the
   token-exchange step: it uses `supabase.auth.verifyOtp({ token_hash,
   type })` instead of PKCE, which doesn't depend on any cookie from the
   requesting browser — it works from any device.
2. It renders a **"Continue" button the person must click** rather than
   verifying automatically on page load. An automated link-scanner fetches
   the page but doesn't click buttons, so it can no longer consume the
   token before the real user does.
3. The Supabase **Magic Link email template** was changed (Dashboard →
   Authentication → Emails → Templates) from `{{ .ConfirmationURL }}` to
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink`
   so links point at our own page instead of Supabase's
   auto-verifying `/auth/v1/verify` endpoint.

`/auth/confirm` is listed in `PUBLIC_PATHS` in
`src/lib/supabase/middleware.ts` — it must stay there, or unauthenticated
visitors get redirected to `/login` before they can click Continue.

The old `/auth/callback` route is untouched and still used by the admin
**invite-user** flow (`inviteUserByEmail`, in `src/app/admin/actions.ts`),
which is a separate Supabase email template — don't merge or remove it
when working on magic-link auth.

## Local dev environment (if working locally again)

- Node.js was not present on this machine originally; installed via `nvm`
  (`~/.nvm`). GitHub CLI was downloaded directly from GitHub's releases
  (official binary, not via Homebrew, since Homebrew isn't installed) into
  `~/bin/gh-cli`. Both are general-purpose, not project-specific — kept
  even when the project folder itself was cleaned up.
- This sandbox's Bash tool cannot read `~/Downloads` by default; use
  `mcp__ccd_directory__request_directory` to grant access, or have the user
  copy files into the project folder instead.
- The dev server's Turbopack build has a subprocess-spawning restriction in
  this specific preview-tool sandbox (spawning a pooled Node process fails
  with an environment/PATH issue specific to that tool). Running
  `npm run dev` via a plain background Bash process (with
  `dangerouslyDisableSandbox: true`) and pointing the browser at
  `localhost:3000` directly works fine — that's the pattern used throughout
  this project.
