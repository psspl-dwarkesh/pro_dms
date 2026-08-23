# AutoAxis architecture

## Product model

AutoAxis is organized around two durable master records, Customer 360 and Vehicle 360, rather than department-owned copies. Sales, service, parts, finance, insurance, marketing, used vehicles, inventory, branch, group, workforce, and OEM integrations contribute events to the same relationship and vehicle histories.

## Runtime topology

```text
Browser
  ├─ public product experience (initial bundle)
  └─ lazy operations workspace + charts
          │ HTTPS /api/v1
          ▼
Express application
  ├─ request ID, security headers, CORS, validation
  ├─ Customer 360 / Vehicle 360 query orchestration
  └─ stable error envelope
          │ parameterized SQL
          ▼
Neon PostgreSQL
  ├─ customer and vehicle master records
  ├─ ownership and interaction timelines
  └─ ordered schema_migrations history
```

The same Express application serves local Node and Vercel Functions. `api/[...path].js` is deliberately a one-line adapter, which prevents local and deployed API contracts from drifting.

## Frontend boundaries

- `LandingPage.tsx` owns the public product narrative and does not import charting.
- `auth/AuthContext.tsx` holds the signed-in session (token, user, organization) and exposes `login`/`signup`/`logout`; `auth/LoginPage.tsx` and `auth/SignupPage.tsx` are the only entry points into the workspace.
- `DashboardApp.tsx` is loaded with `React.lazy` only after a session exists, and filters its navigation by the signed-in user's role (`data.ts`'s `ROLE_NAV`).
- `DashboardViews.tsx` owns the sales, service, parts, and finance operating workspaces; modules with no data model yet render `components/ComingSoon.tsx` instead of invented numbers.
- `RecordViews.tsx` owns Customer 360 and Vehicle 360 search/detail behavior, backed entirely by the database CRUD routes.
- `dashboard/CompanyAdmin.tsx` is the admin-only branch and user management screen.
- `data.ts` holds navigation structure and public marketing copy only, never operational records; `types.ts` holds shared frontend contracts.
- `lib/api.ts` centralizes timeouts, parsing, bearer-token attachment, and error normalization for every verb (GET/POST/PATCH/DELETE).

The public bundle should stay small and useful even when the API is unavailable. Every API-backed view exposes explicit loading, empty, and failure states, and no view falls back to fabricated data.

## API and data boundaries

Routes own HTTP translation and input limits. The database module owns parameterized SQL, a small serverless-safe pool, bounded queries, and dependency-error normalization. The deployed database is Neon PostgreSQL; local PostgreSQL remains compatible.

Every `/api/v1/*` route (other than `/api/v1/auth/*`) requires a bearer token issued at signup or login. The token carries the authenticated user's organization, branch, and role; every query is scoped server-side to that organization (and, for non-admin roles, that branch) rather than trusting any client-supplied identifier. Signing up creates a new organization (a dealership company), its first branch, and an admin user in one transaction, so multiple dealership companies can self-serve onto the same deployment with fully isolated data. Before connecting production dealership data at scale, still add audit history, rate limits, structured observability, retention controls, and tested backup/restore procedures.

## Migration strategy

SQL files are ordered under `database/`. The migration runner records filename and SHA-256 checksum in `schema_migrations`, applies each migration in a transaction, and refuses to run if an already recorded migration changes. Demonstration seed rows use stable identifiers and conflict-safe inserts.

## Deployment

Vercel builds `apps/web` and serves the shared Express handler from `api`. Static assets use content hashes and immutable caching. See [deployment](./deployment.md) for environment and promotion checks.
