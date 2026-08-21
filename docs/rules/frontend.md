# Frontend rules

## Product experience

- Design for dealership work: show owners, responsible teams, statuses, exceptions, deadlines, and the next action.
- Keep Customer 360 and Vehicle 360 as shared contexts linked from sales, service, parts, finance, inventory, and marketing.
- Use role-oriented language and realistic operating states. Generic KPI cards are supporting evidence, not the whole screen.
- Label unapproved metrics and people as demonstration data. Do not imply production customer proof.

## Structure

- Keep the public product experience separate from the authenticated operations workspace.
- Lazy-load the workspace and data-visualization dependencies so the landing page does not pay their cost.
- Put shared types in `src/app/types.ts`, stable product data in `src/app/data.ts`, API logic in `src/lib`, and workspace views under `src/app/dashboard`.
- A component should own one clear concern. Extract repeated behavior when it has a stable contract, not merely to reduce line count.

## UI system

- Use the AutoAxis tokens in `src/styles/theme.css`; do not scatter new brand hex values through components.
- Preserve the automotive control-room character: deep navy surfaces, warm signal-orange actions, strong typography, data-dense but calm layouts, and visible connection lines.
- Keep content aligned to a deliberate grid. Avoid centering every section or repeating identical card grids.
- Support keyboard navigation, visible focus, semantic landmarks, accessible labels, reduced motion, and WCAG AA contrast.
- Verify desktop and mobile layouts. Navigation and tables must remain usable at 360 px without horizontal page overflow.

## Client behavior

- Every request must expose loading, empty, success, and failure states.
- Use the shared API client so timeouts, JSON parsing, and error messages behave consistently.
- Do not put secrets, privileged decisions, or tenant authorization in the browser.
- Prefer derived state over duplicated state. Avoid effects for logic that can be calculated during render.

## Verification

- Run `npm run check --workspace=@autoaxis/web`.
- Exercise the public-to-workspace transition, navigation, search success, search empty, and API failure behavior.
- Review the production bundle report. A new initial chunk above 250 KB gzip requires an explicit reason and a split/caching plan.
