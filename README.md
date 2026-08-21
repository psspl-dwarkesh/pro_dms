# AutoAxis DMS

AutoAxis is an automotive integration hub and high-fidelity operations showcase. It connects dealership retail, service, parts, finance and insurance, inventory, marketing, branch, and group decisions around shared Customer 360 and Vehicle 360 records.

The repository includes a production-shaped React workspace, a Node/Express API that runs locally and on Vercel, ordered PostgreSQL migrations, a verified Neon connection path, API tests, and repository-scoped engineering instructions.

## Quick start

Requirements: Node.js 20 or newer and npm.

```bash
npm install
npm run dev
```

The web app runs at `http://localhost:5173`. For API-backed Customer 360 and Vehicle 360 searches, start the API in a second terminal:

```bash
npm run dev:api
```

Without `DATABASE_URL`, the API uses clearly marked demonstration records. A database outage does not silently fall back to demo data; it returns a dependency error.

## Quality and database commands

```bash
npm run check       # API syntax, frontend typecheck, production bundle
npm test            # API contract tests
npm run db:check    # read-only Neon/PostgreSQL connectivity and schema check
npm run db:migrate  # apply pending recorded migrations to the configured database
```

Copy `.env.example` to `apps/api/.env` for local API and database configuration. Never commit the resulting `.env` file.

## Repository map

```text
.agents/skills      Repository-scoped AutoAxis production workflow
apps/web            Public product site and lazy-loaded operations workspace
apps/api            Shared Express API for local Node and Vercel Functions
api                 Thin Vercel function entrypoint
database            Ordered, repeatable PostgreSQL migrations and demo seed
docs                Architecture, product blueprint, deployment, and rules
AGENTS.md            Always-on instructions for coding agents
```

Start with [the documentation index](./docs/README.md). All people, dealership names, metrics, and operational outcomes in the showcase are demonstration data unless approved evidence is supplied.
