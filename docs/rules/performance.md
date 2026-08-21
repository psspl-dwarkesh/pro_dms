# Performance rules

## Frontend budgets

- Keep the public landing route below 250 KB gzip of initial JavaScript; target below 150 KB when practical.
- Lazy-load the operations workspace, charts, and low-frequency views.
- Self-host or system-fallback fonts for the application shell; third-party font failure must not block rendering.
- Reserve media dimensions, use modern formats, and do not ship decorative assets that are invisible at the current breakpoint.
- Avoid animation that triggers layout. Respect `prefers-reduced-motion`.

## Runtime behavior

- Fetch data when the view needs it, deduplicate active requests, and bound timeouts.
- Cache immutable assets aggressively with hashed filenames. Keep HTML and health responses fresh enough for releases and operations.
- Virtualize or paginate large tables and timelines.
- Keep expensive chart and formatting work out of hot render paths.

## API and database

- Use bounded result sets and indexed tenant-aware predicates.
- Avoid cold-start connection storms with a small reusable pool and `allowExitOnIdle` for serverless runtimes.
- Cache stable reference data only when invalidation and tenant separation are explicit.
- Measure p50, p95, and error rate for important workflows before optimizing by intuition.

## Verification

- Compare Vite output sizes before and after material frontend changes.
- Test one desktop and one mobile viewport, slow network loading, and unavailable API behavior.
- Use browser performance tooling or a hosted audit for release candidates; record regressions and their accepted tradeoff.
