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
- Three schema migrations in `supabase/migrations/`: `0001_init.sql` (auth
  sync, RLS, 3-stage pipeline), `0002_six_stage_pipeline.sql` (6 stages,
  `stage_data` JSONB, partner branding columns, storage bucket), and
  `0003_favorites_requirements_categories.sql` (idea favorites, per-user
  requirements, admin-managed lab categories). All applied to production
  already — run future migrations the same way, by pasting into the
  Supabase SQL Editor (no CLI/Docker access on this dev machine, so no
  `supabase db push` workflow is set up).
- `exceljs` generates the Excel export at `GET /labs/[labId]/export`
  (`src/app/labs/[labId]/export/route.ts`) — one worksheet per stage, same
  column layout on every sheet, one row per idea including every stage's
  fields, comments, per-user requirements, and rating averages. Access is
  RLS-scoped like everything else (no special export permission).

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
- Concept requires `story`, Distribution requires `requirements`, and
  Prototyping requires both `mvpDescription` and `audienceTested` ("Who are
  we testing with?") before an idea can move *into* that stage — the same
  "fill this in before the move completes" pattern as Shortlist's reasoning
  gate, implemented client-side in `pipeline-board.tsx` via
  `StageGateDialog` (`STAGE_GATE_FIELDS`, one or more fields per stage). Go-
  Live is deliberately excluded, per the non-blocking-checklist decision
  above.

**Gotcha: server actions here rely on `revalidatePath`, which is not
enough on its own.** It invalidates the Next.js cache server-side, but an
already-mounted client component's props won't refetch until something
calls `router.refresh()` from the browser.

**Every mutation on the pipeline board is optimistic — this is load-bearing
for perceived speed, not a style preference.** Drags, favorites, ratings,
checklists, the Shortlist/Concept/Prototyping/Distribution forms, comments,
and requirements all update `PipelineBoard`'s `localIdeas` state
*immediately*, before the server action resolves, via two entry points:
- `commitMove` / `commitToggleFavorite` / `commitDeleteIdea` /
  `commitCreateIdea` in `pipeline-board.tsx` for board-level actions (drag,
  favorite, delete, create) — each snapshots the previous state and rolls
  back if the save fails.
- `applyIdeaPatch` (passed down as `onIdeaUpdate`) for everything inside
  `IdeaDetailDialog` — each section computes its own next-state patch
  (e.g. a new `stageData.concept` object, or `comments` with a synthesized
  entry appended) and applies it via `onIdeaUpdate` before awaiting the
  server action. On failure these call `router.refresh()` as a blunt
  resync rather than hand-writing a precise revert — errors are the rare
  path, so a full refresh there is an acceptable cost.

This was a deliberate rewrite (previously most of these called
`router.refresh()` on *success*, which — combined with re-fetching the
lab's entire ideas/comments/ratings/favorites/requirements dataset — made
the whole board feel slow). **Do not reintroduce success-path
`router.refresh()` calls here**; any new mutation on the board should
follow the same pattern (patch local state first, persist in the
background, resync only on error), or the sluggishness comes back. Comment
and requirement optimistic entries use `crypto.randomUUID()` for a temp id
and the current user's own email (threaded down as `currentUserEmail`);
newly created ideas do the same and get their temp id reconciled with the
server's real id once `createIdea` returns it.

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

## Pipeline board UX pass (search/filter/sort, list view, stale flag, move-to-stage)

Follow-up to the optimistic-UI/performance rewrite: implemented the
"quick win" tier of the UX suggestions without adding any new
`router.refresh()` calls or otherwise touching the optimistic-update
architecture.

- **Search/filter/sort toolbar** (`pipeline-board.tsx`): a `visibleIdeas`
  `useMemo` filters `localIdeas` by free-text search (title + description +
  category), a category `Select`, and a "Favorites only" toggle, then
  sorts by `sortBy` (`added` / `newest` / `favorites` / `rating`). This all
  runs client-side against data already loaded — no network round-trip.
  `ideasByStage` (what the board columns render) now derives from
  `visibleIdeas`, not `localIdeas` directly.
- **Board/List view toggle**: `IdeaListView`
  (`components/idea-list-view.tsx`) is a flat sortable table over the same
  `visibleIdeas`, for scanning/reviewing everything at once instead of
  per-column. Clicking a row opens the same `IdeaDetailDialog` the board
  uses, via a lifted `selectedIdeaId` state in `PipelineBoard` (not a
  per-card `open` state, since the list view has no cards).
- **Stale idea indicator** (`idea-utils.ts`): `isIdeaStale()` flags any
  idea whose `updatedAt` (the DB's existing `set_updated_at()` trigger
  column) is 14+ days old. Deliberately one field/one threshold — a
  clock-icon "Stale" badge on the card and in the list view, nothing more
  elaborate. Requires `ideas.updated_at` to be selected and mapped through
  as `updatedAt` in `page.tsx` and `IdeaWithExtras`.
- **Move-to-stage dropdown** (`idea-detail-dialog.tsx`): a `Select` in the
  detail dialog header lets you change an idea's stage without
  drag-and-drop — same gate-checking logic as dragging, since both call
  the same `requestMove(ideaId, targetStageId)` function (extracted out of
  the old inline `onDragEnd` body in `pipeline-board.tsx`). This is the
  keyboard/screen-reader-accessible path onto the board; true accessible
  drag-and-drop was judged not worth the complexity given this simpler
  alternative exists.
- **Deliberately not built**: a separate "saved" status indicator. Every
  mutation is already optimistic (the UI changes the instant you act), and
  multi-field stage-data forms already show `toast.success`/`toast.error`
  on save. A dedicated saved-state UI element would be redundant chrome
  given those two signals already exist — cut to keep the UI simpler, per
  the "very easy to understand and use" constraint.
- **Base UI `Select` gotcha, again**: `categoryFilter`'s `onValueChange`
  hit the same `string | null` issue as everywhere else — wrap with
  `(v) => setCategoryFilter(v ?? "all")`.

Still pending the user's decision before building (not started): soft-delete
for ideas, notifications (digest/activity), a cross-lab leadership
dashboard, and duplicate-idea detection on creation.

## Lab header hamburger menu

The lab header's three scattered actions ("Export to Excel" link, "Lab
settings" link, "Sign out" button) are consolidated into one menu, opened
from a single hamburger icon button — `LabHeaderMenu`
(`src/components/lab-header-menu.tsx`), wired into `src/app/labs/[labId]/layout.tsx`
next to the partner-branding block.

Built on Base UI's `Menu` primitive
(`src/components/ui/dropdown-menu.tsx`, previously defined but unused
anywhere in the app). Added a `DropdownMenuLinkItem` wrapper around
`Menu.LinkItem` for the two navigable items — Base UI has a dedicated
`LinkItem` part (renders an `<a>`, supports `render` to compose with
`next/link`'s `Link` for client-side nav) distinct from plain `Menu.Item`,
and its docs explicitly call it out for menu items that navigate, so use
it instead of `Menu.Item render={<a/>}`. Note its `closeOnClick` defaults
to `false` (opposite of `Menu.Item`, which defaults to `true`) — pass
`closeOnClick` explicitly on both link items so the menu doesn't stay open
after navigating.

"Export to Excel" renders as a plain `<a href="/labs/[id]/export">` (not
`next/link`'s `Link`) since it's a file download
(`Content-Disposition: attachment` in the route handler), not a page
navigation — consistent with how it worked before this change. "Lab
settings" uses `render={<Link href=... />}` for normal SPA navigation
since it goes to a real page. "Sign out" stays a real `<form
action="/auth/signout" method="post">` element (required — it's a
server-side session mutation, not a client transition); the menu item is a
plain `Menu.Item` whose `onClick` calls `.submit()` on a `useRef` pointing
at a hidden sibling `<form>`, matching Base UI's documented pattern for
menu items that need to trigger something imperatively rather than
navigate.

`SignOutButton` (`src/components/sign-out-button.tsx`) is untouched and
still used by `src/app/page.tsx` and `src/app/admin/layout.tsx` — this
change only touches the lab header, not the home page or admin section.

Note: this container has no real Supabase credentials
(`.env.local` doesn't exist here), and the app's middleware
(`src/lib/supabase/middleware.ts`) runs on every route including a scratch
test page — so a live click-through of this menu wasn't possible in this
session; verified via `next build`/`eslint` only. If something looks off
in the browser (menu positioning, the destructive-red styling on Sign out,
keyboard nav), that's the first place to check.

## Idea detail dialog: star moved next to the title; header pattern/logo removed

Two follow-up fixes after the hamburger menu change, from live feedback:

- **Favorite star overlapped the dialog's close (X) button.**
  `IdeaDetailDialog`'s header (`idea-detail-dialog.tsx`) used
  `justify-between` to push `FavoriteToggle` to the far right of the
  header row — the same corner as `DialogContent`'s own close button
  (`absolute top-2 right-2`, in `dialog.tsx`), so they collided. Fixed by
  changing the header row to `items-center gap-2` (star sits right next
  to the title text, not pinned to the row's far edge) and adding `pr-6`
  so the title+star group doesn't run under the close button on long
  titles.
- **Removed the lab header's decorative branding**: the Saudi Experience
  Labs logo + its `.pattern-strip` background that was fixed to the
  top-left corner of the viewport, and the full-width `.pattern-strip`
  bar fixed to the bottom — both in `src/app/labs/[labId]/layout.tsx`.
  Per the user, these were visual clutter, not wanted in the lab view.
  The header's left padding (`pl-36`, sized to clear the old top-left
  brand block) is back to a normal `px-6`; the wrapper's `pb-3` (reserved
  for the old bottom bar) is also gone.
  The `.pattern-strip` CSS class itself (`globals.css`) is untouched and
  still used by `ColumnBand` in `pipeline-board.tsx` (the thin colored
  band under each pipeline column header) and by the login/confirm pages'
  own logo — this change only removed the two lab-layout usages, not the
  class or the asset files.

## Pipeline column band: fixed brand purple instead of the lab's own color

`ColumnBand` (`pipeline-board.tsx`, the thin band under each column
header) used to inherit `--strip-color` from the lab layout wrapper,
which sets it to `lab.primary_color` — so the band always matched
whatever accent color that lab picked. First fix: kept the masked
"Strip solid" artwork (guidelines p.42) but overrode its color to
`--brand-purple-dark`. **Superseded** by the next note below — the user
then said explicitly they don't want the masked/patterned look at all,
anywhere, not just a different color for it.

## Column band, take two: flat solid color, no mask

Per explicit follow-up ("I don't want the pattern in the strip"),
`ColumnBand` no longer uses the `.pattern-strip` class (the CSS mask
that gives it the "Strip solid" shaped/patterned look) at all — it's now
a plain `<div>` with `backgroundColor: var(--brand-purple-dark)` and no
mask-image, i.e. an actual flat solid-colored rectangle. Same fixed
brand-purple reasoning as before (never one of the 7 lab accent options
in `BRAND_ACCENTS`, so it can't collide with the lab's own color) — only
the shape/masking is gone, not the color choice.

This leaves `.pattern-strip` and `.pattern-strip-minimal`
(`globals.css`) with zero remaining usages anywhere in the app. Left
them defined rather than deleting — they're a documented, deliberate
reproduction of an official Visit Saudi guideline element (with page
references), so they're cheap to keep around if a future page ever
wants that patterned look again. If nothing ever picks them back up,
they're safe to delete along with `/public/brand/pattern-strip-mask.png`.
