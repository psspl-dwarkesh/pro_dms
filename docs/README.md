# AutoAxis documentation index

This is the first stop for contributors and coding agents. Read the smallest set of documents that covers the change.

## Product and architecture

- [Product blueprint](./product-blueprint.md): product thesis, benchmark capabilities, demonstration journeys, and evidence policy.
- [Showcase depth](./showcase-depth.md): completion contract, connected demonstration path, scope limits, and acceptance checks.
- [DMS operating cockpits](./dms-operating-cockpits.md): implemented Sales, Used, Inventory, Insurance, and Workforce workflows.
- [Architecture](./architecture.md): runtime boundaries, data flow, deployment shape, and production roadmap.
- [Deployment](./deployment.md): Vercel environment, promotion, hosted smoke checks, and rollback.

## Engineering rules

- [Frontend rules](./rules/frontend.md): component boundaries, accessibility, responsive behavior, and performance.
- [Backend rules](./rules/backend.md): API contracts, validation, security, and service boundaries.
- [Database rules](./rules/database.md): Neon/PostgreSQL access, migrations, tenancy, indexes, and data safety.
- [Error rules](./rules/errors.md): error taxonomy, public envelopes, logs, retries, and UI states.
- [Git workflow](./rules/git-workflow.md): branch, commit, review, integration, and release flow.
- [Performance rules](./rules/performance.md): bundle budgets, query behavior, caching, and verification.

## Quick commands

```bash
npm install
npm run dev
npm run dev:api
npm run check
npm test
npm run db:check
npm run db:migrate
```

`db:migrate` changes the configured database. Use it only after checking the target environment. `db:check` is read-only.
