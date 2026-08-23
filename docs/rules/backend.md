# Backend rules

## Boundaries

- Routes translate HTTP concerns; services coordinate business rules; database modules own SQL. Do not duplicate route implementations for local and serverless runtimes.
- Keep API paths versioned under `/api/v1`. Health and readiness endpoints may remain unversioned.
- There is no demonstration fallback. Every authenticated route reads and writes the real database; a missing or unavailable database returns the `DATABASE_UNAVAILABLE` dependency error, never fabricated data.

## Contracts and validation

- Validate path, query, and body inputs at the boundary. Reject invalid data with a stable 4xx error code.
- Return JSON with a consistent success shape and the error envelope defined in `errors.md`.
- Add pagination and bounded limits before returning collections. Never expose unrestricted table scans.
- Preserve backwards compatibility inside an API version or introduce a new version.

## Security

- Authentication identifies the actor; authorization checks tenant, branch, role, and record access on every protected request. Every `/api/v1/*` route other than `/api/v1/auth/*` runs through `authenticate` (`src/middleware.js`), and admin-only routes add `authorize("admin")`.
- Never accept tenant or privilege claims from the client without verifying the authenticated server-side context. Route handlers read `organizationId`/`branchId`/`role` from `request.auth` (set from the verified bearer token), never from the request body or query string.
- Keep Helmet enabled, use an explicit CORS allowlist in deployed environments, cap request sizes, and avoid leaking stack traces.
- Parameterize all SQL. Do not build SQL from request strings.
- Avoid logging PII. Redact tokens, cookies, database URLs, mobile numbers, email addresses, and document identifiers.

## Reliability

- Give requests an ID and return it with failures for support correlation.
- Use timeouts for network and database operations. Retry only transient, idempotent work with a bounded policy.
- Add graceful shutdown for long-running processes and allow serverless database clients to become idle.
- Health checks must distinguish service health from database readiness.

## Verification

- Run the API syntax/tests and `npm run db:check` after backend or database changes.
- Test valid, invalid, missing, not-found, database-unavailable, and unexpected-error paths.
