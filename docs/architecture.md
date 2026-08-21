# AutoAxis architecture

## Product model

AutoAxis is organized around two durable master records—Customer 360 and Vehicle 360—rather than department-owned copies. Sales, service, parts, finance, insurance, marketing, used vehicles, inventory, branch, group, workforce, and OEM integrations contribute events to the same relationship and vehicle histories.

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
- `DashboardApp.tsx` is loaded with `React.lazy` only when a user enters operations.
- `DashboardViews.tsx` owns executive and domain operating workspaces.
- `RecordViews.tsx` owns Customer 360 and Vehicle 360 search/detail behavior.
- `data.ts` holds stable illustrative product data; `types.ts` holds shared frontend contracts.
- `lib/api.ts` centralizes timeouts, parsing, and error normalization.

The public bundle should stay small and useful even when the API is unavailable. API-backed views expose demo/live source labels and explicit loading, empty, and failure states.

## API and data boundaries

Routes own HTTP translation and input limits. The database module owns parameterized SQL, a small serverless-safe pool, bounded queries, and dependency-error normalization. The deployed database is Neon PostgreSQL; local PostgreSQL remains compatible.

The current showcase has no authentication. Before connecting production dealership data, add identity, organization/branch authorization, row-level tenancy guarantees, audit history, rate limits, structured observability, retention controls, and tested backup/restore procedures.

## Migration strategy

SQL files are ordered under `database/`. The migration runner records filename and SHA-256 checksum in `schema_migrations`, applies each migration in a transaction, and refuses to run if an already recorded migration changes. Demonstration seed rows use stable identifiers and conflict-safe inserts.

## Deployment

Vercel builds `apps/web` and serves the shared Express handler from `api`. Static assets use content hashes and immutable caching. See [deployment](./deployment.md) for environment and promotion checks.
