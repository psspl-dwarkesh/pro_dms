# Git workflow

## Branches

- `main`: production-ready releases only; deploys production.
- `develop`: reviewed integration state; deploys the shared preview/staging environment.
- `feature/<short-name>`: product features from `develop`.
- `fix/<short-name>`: non-urgent fixes from `develop`.
- `hotfix/<short-name>`: urgent production fixes from `main`, merged back to both `main` and `develop`.
- `refactor/<short-name>` and `chore/<short-name>`: non-feature engineering work from `develop`.

One branch should represent one reviewable outcome. Do not combine unrelated cleanup with a feature unless the cleanup is required to deliver it safely.

## Delivery flow

1. Update `develop`, then create the focused branch.
2. Commit small coherent changes using an imperative subject, for example `feat(web): add role-based operations workspace`.
3. Rebase or merge the latest `develop` and resolve conflicts on the feature branch.
4. Run `npm run check`, `npm test`, and any relevant database/browser checks.
5. Push the feature branch and open a review targeting `develop`.
6. Merge only after checks and review pass. Prefer squash merge for a noisy branch and preserve meaningful multi-commit history when it improves traceability.
7. Promote `develop` to `main` through a release review. Tag production releases with semantic versions when release management starts.

## Guardrails

- Never force-push shared `main` or `develop`.
- Never commit `.env` files, generated bundles, coverage, local caches, or credentials.
- Verify `git diff --check`, the staged diff, and the target branch before committing.
- Database migrations and their compatible application code must ship together.
- Document rollback steps for high-risk releases.
