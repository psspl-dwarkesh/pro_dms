# Database rules

## Connection and tenancy

- Neon PostgreSQL is the deployed database. Read `DATABASE_URL` from the environment; never commit or print it.
- Use a small pool with connection and idle timeouts suitable for serverless functions.
- Production tables that hold dealership data must carry organization ownership directly or through a guaranteed relationship.
- Every production read and write must be scoped by the authorized organization, and by branch when the permission model requires it.

## Migrations

- Store ordered SQL migrations in `database/`. Never rewrite an already released migration; add the next numbered file.
- Migrations must be repeatable by the migration runner, transactional where PostgreSQL permits it, and recorded in `schema_migrations`.
- Prefer additive, backwards-compatible changes. Use expand/migrate/contract for destructive schema changes.
- Seed demonstration data idempotently and keep it visibly synthetic.
- Back up and rehearse any destructive production migration before execution.

## Query design

- Parameterize values and select only required columns.
- Add indexes for tenant plus lookup/sort patterns. Confirm write overhead before adding broad indexes.
- Bound timelines and searches; use cursor pagination for high-volume paths.
- Avoid N+1 access. Batch independent reads with a single connection or a controlled transaction.
- Use `EXPLAIN (ANALYZE, BUFFERS)` on representative non-production data before accepting a slow query.

## Data integrity

- Prefer database constraints for invariants: foreign keys, uniqueness, checks, and non-null rules.
- Store timestamps as `timestamptz` and convert for the dealership timezone at the boundary.
- Treat customer contact, finance, insurance, identity, and vehicle ownership data as sensitive.
- Define retention and audit requirements before storing production personal data.

## Operations

- `npm run db:check` is read-only and is the default connectivity check.
- `npm run db:migrate` mutates the configured database and must only run against an identified target.
