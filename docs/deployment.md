# Deployment

AutoAxis deploys to Vercel with a Vite frontend and a shared Express serverless handler.

## Required environment

Configure these variables in Vercel without committing their values:

- `DATABASE_URL`: pooled Neon PostgreSQL connection string with TLS required.
- `WEB_ORIGIN`: comma-separated allowed deployed origins. The API also auto-allows the exact origin Vercel assigns the current deployment (`VERCEL_PROJECT_PRODUCTION_URL` and `VERCEL_URL`), so a new preview or production alias is never locked out while `WEB_ORIGIN` is updated.
- `JWT_SECRET`: required. A long random value used to sign session tokens; rotating it signs every user out.
- `DATABASE_POOL_MAX`: optional; defaults to `5`.
- `DATABASE_CONNECT_TIMEOUT_MS`: optional; defaults to `5000`.

Local development reads `apps/api/.env`. Vercel injects project environment variables directly.

## Pre-deployment checklist

```bash
npm ci
npm run check
npm test
npm run db:check
git diff --check
```

Confirm that migrations needed by the release have been applied to the identified target. `npm run db:migrate` changes the configured database and is not part of an unreviewed build step.

## Promotion

1. Push a focused feature branch for a preview deployment.
2. Open a pull request targeting `main` and verify the hosted preview: `/api/health`, public page, workspace loading, and live Customer/Vehicle search.
3. Merge the reviewed branch into `main` for production once checks and review pass.
4. Re-run the hosted smoke checks and keep the previous Vercel deployment available for rollback.

## Hosted smoke checks

- `GET /api/health` reports service `ok` and database `connected`.
- Initial public HTML and hashed assets return successfully.
- Signing up creates a new organization, branch, and admin user, and immediately reaches the dashboard.
- Signing in with the seeded demo admin (`admin@prakashinfotech.com` / `Demo@12345`) reaches the dashboard with data scoped to the demo organization only.
- Customer 360 and Vehicle 360 search return records from the signed-in user's own organization.
- Invalid search input, and any request without a valid session, return the documented public error envelope with a request ID.
