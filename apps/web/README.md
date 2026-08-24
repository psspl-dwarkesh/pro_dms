# AutoAxis web

The AutoAxis web workspace contains two deliberate loading boundaries:

- A fast public product site with the automotive brand and operating-model narrative, plus sign-in and company sign-up.
- A lazy-loaded, role-filtered dealership operations workspace: executive overview, Customer 360, Vehicle 360, sales, service, parts, and finance/insurance are backed by the database; marketing, used vehicles, inventory, branch, group, and workforce render a "coming soon" placeholder until their data model ships.

## Commands

Run from the repository root:

```bash
npm run dev:web
npm run check --workspace=@autoaxis/web
```

The development server proxies `/api` to `http://localhost:4000`. Start `npm run dev:api` for live Neon-backed record searches.

## Structure

```text
src/app/LandingPage.tsx       Public product experience
src/app/auth                  AuthContext, LoginPage, SignupPage
src/app/dashboard             Lazy operations workspace, including Pickers and Administration
src/app/components            Maintained brand primitives and the ComingSoon placeholder
src/app/data.ts               Navigation structure, role-to-nav map, and public marketing copy
src/app/types.ts              Shared frontend types
src/lib/api.ts                Typed request, bearer-token, and error behavior
src/styles                    Brand tokens, global base, and application CSS
```

Keep the landing route free of charting and workspace-only dependencies. See `docs/rules/frontend.md` and `docs/rules/performance.md` before changing layout or loading boundaries.
