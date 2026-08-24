# Six-portal workspace plan

**Status: authoritative. Supersedes the "exactly two 360s" recommendation in
`docs/AutoAxis_Full_Product_Remediation_and_Development_Specification.docx`
section 4.1.** The product owner made a deliberate call to widen the 360 model
to six portals for a flatter, more recognizable navigation. Read this file,
not that DOCX's information-architecture chapter, for the current IA. The
DOCX's chapters on forms, accessibility, security, and API/data contracts are
still accurate and still apply.

This file is the shared reference for every agent working on this repo --
Claude Code sessions and Codex alike. If you are about to touch navigation,
routing, or a top-level workspace, read this first.

## The decision

The workspace has **exactly six primary portals**, each a full 360-style
hub with its own dashboard, directory, detail pages, workflows, contextual
actions, and responsive navigation:

1. **Customer 360**
2. **Vehicle 360** -- VIN lifecycle, ownership, condition, valuation, service
   & workshop, parts, used/reconditioning, auction, and rental/demo booking.
3. **Sales 360** -- leads, opportunities, test drives, quotes, orders, delivery.
4. **Finance 360** -- finance applications, approvals, contracts, insurance
   policies, and bills/payables.
5. **Marketing 360** -- audiences, campaigns, journeys, consent, attribution.
6. **Analytics 360** -- department, branch, group, workforce productivity,
   and profitability analysis (reporting only -- not workforce management).

**Administration is not a seventh portal.** Internal employees, external
partners, roles, permissions, branch/org settings, and audit history live
under the account/settings area, reached from the account menu -- never from
the primary sidebar.

Auction and rental/demo are disposition/availability *workflows inside*
Vehicle 360, not standalone portals -- same reasoning the DOCX already gave
for auction, just applied consistently: a vehicle disposition workflow
belongs with the vehicle, not next to it.

## Mapping from the current codebase

The current `DashView` union (`apps/web/src/app/types.ts`) has 14 values.
Here is where each one goes:

| Current `DashView` | Destination |
|---|---|
| `customers` | Customer 360 (unchanged) |
| `vehicles` | Vehicle 360 -- core tab (lifecycle, ownership, valuation) |
| `service` | Vehicle 360 -- Service & Workshop tab |
| `parts` | Vehicle 360 -- Parts tab |
| `usedcars` | Vehicle 360 -- Used, Reconditioning & Auction tab |
| `inventory` | Vehicle 360 -- folded into the core tab's stock/location view |
| `sales` | Sales 360 (unchanged) |
| `finance` | Finance 360 (unchanged, gains bills/payables) |
| `marketing` | Marketing 360 (built out from its current "coming soon" stub) |
| `branch`, `group`, `workforce` | Analytics 360 (the *analysis* slice only) |
| `company` | Administration, relocated under account/settings |
| `overview` | Retired as a primary nav item. See "Landing view" below. |

`workforce` splits: the productivity/profitability *analysis* of workforce
data is an Analytics 360 report; actually *managing* people (schedules,
roles, roster) is Administration. Same underlying data, two different
audiences and two different places in the nav -- do not build one screen
that tries to be both.

### Landing view (assumption -- flag if wrong)

The six-portal list has no "Home". Proposed default: after sign-in, land on
whichever portal is first in that user's `ROLE_NAV` (Customer 360 for most
roles). No separate cross-portal landing screen. If a role-based daily-start
screen is still wanted, it becomes Customer 360's own dashboard state, not a
seventh nav item -- confirm before anyone builds a separate one.

## UX direction (applies to every portal)

- Two dynamic sidebars, not the current icon rail:
  - **Primary labelled sidebar**: exactly the six portals, always visible,
    text label + icon (no icon-only nav).
  - **Contextual secondary sidebar**: the active portal's own pages/tabs
    (e.g. inside Vehicle 360: Overview, Service & Workshop, Parts, Used &
    Auction, Documents). Changes with the active portal.
- Customer profile card: Edit, Share, Call, Email, and a **More** overflow --
  not a flat wall of icon buttons.
- No unlabelled copy-ID icon. Every copyable field (mobile, email, VIN,
  registration) gets its own labelled copy affordance with success feedback.
- Communications redesigned: bordered cards, visible summary text, filters,
  and an obvious "Log communication" primary action.
- Global search groups results by section (Customers, Vehicles, Deals,
  Finance records, Pages) and deep-links to the exact record -- building on
  the grouped-search work already merged in
  `feature/search-deep-links-and-modal-a11y` (PR #8), which currently only
  covers customers/vehicles; extend its grouping, don't replace its
  mechanism.
- No `window.alert`/`confirm`/`prompt` anywhere. Branded modals, drawers,
  confirmation dialogs, and toasts only -- reuse `useDialogFocusTrap` from
  `apps/web/src/app/dashboard/RecordViews.tsx` (added in PR #8) for every new
  dialog instead of writing a new unmanaged one.
- Remove a generic/placeholder screen only once its real 360-portal
  replacement is live -- never delete functionality and leave a gap.

## Why this needs sequencing, not just 11 parallel chats

Every portal chat would otherwise need to edit the same handful of files --
`types.ts` (the `DashView` union), `data.ts` (`NAV_SECTIONS`, `ROLE_NAV`,
`PAGE_RELATED`, `PAGE_HELP`), `DashboardApp.tsx` (the two-sidebar shell,
account menu), and `App.tsx` (routing). If six chats all touch those at once,
every one of them conflicts with every other one on the exact same lines.

The fix is a **foundation phase**, done once, by one owner, merged before
anyone else starts:

1. Consolidate `DashView` and the primary sidebar down to the six portals.
2. Give Vehicle 360 and Analytics 360 an internal tab/contextual-sidebar
   shell with slots for their sub-areas (Service, Parts, Used & Auction;
   Branch, Group, Workforce) -- initially just re-parenting the *existing*
   view components into those slots, not rebuilding them. Nothing is deleted
   or loses functionality in this phase; it only moves where it's reached
   from.
3. Move `company`/`CompanyAdmin` into the account menu as Administration.
4. Rewrite `ROLE_NAV` against the new six-portal set.
5. Ship the two-sidebar shell UI shell itself (primary + contextual), reused
   by every portal.

Once that one PR merges, the remaining work is genuinely parallel-safe:

| Group | Chats | Can run together? |
|---|---|---|
| A | Customer 360, Sales 360, Finance 360, Marketing 360, Analytics 360, Administration | Yes -- disjoint feature files/routes |
| B | Vehicle 360 core | Must land *before* group C (owns the tab shell those three plug into) |
| C | Vehicle 360: Service & Workshop, Parts, Used/Recon/Auction | Yes, once B has landed -- each owns its own feature files, plugs into an existing tab slot |
| D | Final production QA | Last -- after everything above has merged |

Codex and Claude Code sessions can absolutely work simultaneously from
`main` once a group is parallel-safe, as long as each chat:

- Bases its branch on the latest `main` (`git pull` before branching).
- Stays inside its own feature's files -- routes, `apps/api/src/routes/*`,
  and its own React feature files. Shared files (`types.ts`, `data.ts`,
  `DashboardApp.tsx`) should only be touched to *add* a portal's own entry
  (e.g. one more `NAV_SECTIONS` item, one more `ROLE_NAV` array append),
  never to restructure them.
- Pulls `main` again and rebases before pushing, per
  `docs/rules/git-workflow.md` -- small, frequent PRs beat one long-lived
  branch.
- Opens a PR against `main`; nothing merges without `npm run check`, `npm
  test`, and (for database changes) `npm run db:check` passing.

If two chats' PRs do conflict on a shared file despite this, the second one
to reach review rebases onto the first's merged result -- do not resolve it
by editing on `main` directly.
