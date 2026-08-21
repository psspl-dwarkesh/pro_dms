# AutoAxis web

The AutoAxis web workspace contains two deliberate loading boundaries:

- A fast public product site with the automotive brand and operating-model narrative.
- A lazy-loaded dealership operations workspace with executive, sales, service, parts, F&I, marketing, used vehicle, inventory, branch, group, Customer 360, and Vehicle 360 views.

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
src/app/dashboard             Lazy operations workspace
src/app/components            Maintained brand primitives
src/app/data.ts               Illustrative operating data
src/app/types.ts              Shared frontend types
src/lib/api.ts                Typed request and error behavior
src/styles                    Brand tokens, global base, and application CSS
```

Keep the landing route free of charting and workspace-only dependencies. See `docs/rules/frontend.md` and `docs/rules/performance.md` before changing layout or loading boundaries.
