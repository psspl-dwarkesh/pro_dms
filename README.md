# AutoAxis DMS

AutoAxis is an automotive integration hub and high-fidelity operations showcase. It connects dealership retail, service, parts, finance and insurance, inventory, marketing, branch, and group decisions around shared Customer 360 and Vehicle 360 records.

The repository includes a production-shaped React workspace, a Node/Express API with real authentication and role-based authorization (admin, branch manager, sales, service, staff), multi-tenant company sign-up, full CRUD against Neon PostgreSQL, ordered migrations, API tests, and repository-scoped engineering instructions.

## Quick start

Requirements: Node.js 20 or newer and npm.

```bash
npm install
npm run dev
```

The web app runs at `http://localhost:5173`. The workspace requires a signed-in session, so start the API in a second terminal:

```bash
npm run dev:api
```

Without `DATABASE_URL`, every API route that touches data returns a dependency error rather than falling back to fabricated records. Sign up a new dealership company from the landing page, or sign in with the seeded demo admin account: `admin@prakashinfotech.com` / `Demo@12345` (case-study credentials only, seeded by `database/005_auth_and_tenancy.sql`).

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
apps/web            Public product site, sign-in/sign-up, and lazy-loaded operations workspace
apps/api            Shared Express API (auth, RBAC, CRUD) for local Node and Vercel Functions
api                 Thin Vercel function entrypoint
database            Ordered, repeatable PostgreSQL migrations, including auth/tenancy and demo seed
docs                Architecture, product blueprint, deployment, and rules
AGENTS.md            Always-on instructions for coding agents
```

Start with [the documentation index](./docs/README.md). Only the seeded demo organization's people, metrics, and records are demonstration data; every other account and record is created by real signup and CRUD activity.
