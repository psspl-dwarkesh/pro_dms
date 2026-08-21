# Deployment

AutoAxis deploys to Vercel with a Vite frontend and a shared Express serverless handler.

## Required environment

Configure these variables in Vercel without committing their values:

- `DATABASE_URL`: pooled Neon PostgreSQL connection string with TLS required.
- `WEB_ORIGIN`: comma-separated allowed deployed origins.
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
2. Merge the reviewed branch into `develop` for shared integration/staging.
3. Verify the hosted `/api/health`, public page, workspace loading, and live Customer/Vehicle search.
4. Promote the reviewed `develop` state to `main` for production.
5. Re-run the hosted smoke checks and keep the previous Vercel deployment available for rollback.

## Hosted smoke checks

- `GET /api/health` reports service `ok` and database `connected`.
- Initial public HTML and hashed assets return successfully.
- Entering operations downloads the deferred workspace chunk.
- Customer 360 search for the demonstration record reports `Neon live data`.
- Vehicle 360 search for registration `DMS-360` reports `Neon live data`.
- Invalid search input returns the documented public error envelope with a request ID.
