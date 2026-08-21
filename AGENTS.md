# AutoAxis engineering instructions

AutoAxis is a dealership operations platform built around shared Customer 360 and Vehicle 360 records. Preserve that product model: features should connect departments rather than create disconnected copies of customer or vehicle data.

## Start here

1. Read `docs/README.md` for the maintained documentation map.
2. Read only the rule files relevant to the files you will change.
3. Check `git status`, the current branch, and existing tests before editing.

## Required working agreements

- Work on `feature/*`, `fix/*`, `refactor/*`, or `chore/*` branches. Do not commit directly to `main` or `develop`.
- Keep `main` deployable and use `develop` as the integration branch. See `docs/rules/git-workflow.md`.
- Never commit secrets or log connection strings. Use `.env.example` for names and safe placeholders only.
- Keep API responses, errors, and database access tenant-ready even while the showcase uses demonstration data.
- Do not publish invented customer claims or metrics as facts. Mark them as demonstration data, illustrative workflow, or product concept.
- Remove files only after proving they are unreferenced with repository search and verifying the build still passes.
- Prefer small domain modules and lazy-loaded route/workspace boundaries over a single large component or bundle.
- Run `npm run check` and `npm test` before handoff. Run `npm run db:check` when database code or configuration changes.

## Architecture boundaries

- `apps/web`: presentation, client state, accessible interactions, and API clients.
- `apps/api`: HTTP transport, validation, orchestration, and database access.
- `database`: ordered, repeatable SQL migrations only.
- `docs`: product, architecture, operating rules, and decisions.
- `.agents/skills`: focused repository workflows for coding agents.

Keep dependencies pointing inward: UI calls the API; API calls data access; database modules do not depend on HTTP or UI code.
