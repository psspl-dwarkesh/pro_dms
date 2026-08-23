# Showcase depth and completion contract

AutoAxis is a product case study designed and built by Prakash Software Solutions. Placeholder product, support, employee, and demonstration-contact emails use the `prakashinfotech.com` domain so ownership is clear throughout the experience.

## Product story

AutoAxis is demonstrated as an Automotive Integration Hub. The case study follows one connected relationship:

mobile search → Customer 360 → owned VIN → Vehicle 360 → service inspection → trade appraisal → used acquisition → reconditioning → pricing/publish → sales follow-up

This journey is the product spine. Department views add context to the same customer and vehicle records rather than behave like disconnected applications.

## Complete demonstration paths

- Signup and sign-in: creating a company self-provisions a new organization, its first branch, and an admin account; every account is scoped to one organization and (for non-admin roles) one branch.
- Customer 360: connected search, owned vehicles, cross-department timeline, lifetime value, call, WhatsApp, email, share, export, and opportunity creation, all reading and writing the real database.
- Vehicle 360: connected VIN search, identity, ownership, service history, condition, market/trade value, inventory intake and workshop booking.
- Operating cockpits (Sales, Service, Parts, Finance and insurance): a live queue backed by the database, filters, CSV export, and a primary guided action that creates or updates a real record.
- Global workspace: keyboard search across Customer and Vehicle records; visible Neon connection state; role-filtered navigation; responsive navigation.
- Product site: shared brand/header system, four-state interactive workspace preview, interactive Customer/Vehicle operating model and linked service-to-trade journey.

## Scope discipline

- Finance, insurance, parts and communications appear inside connected workflows as well as their role views.
- Third-party names on the product site are shown as integration-ready categories. They do not claim an active production connection.
- Every workflow mutation is persisted to the database, scoped to the signed-in user's organization and branch. Nothing in the authenticated workspace is session-only or reset on refresh.
- Marketing, Group analytics, Workforce, Branch performance, Inventory, and Used-vehicle remarketing have no data model yet and are shown as a labelled "coming soon" placeholder rather than an invented workflow.
- No new top-level module is added unless it has a meaningful workflow, a real record context, and a visible, persisted result.

## Integration priorities

1. OEM orders, allocation, vehicle specification, warranty/recall, parts and retail reporting.
2. Finance, payments, identity, insurance and deal documents.
3. Valuation, listings, appraisal and wholesale/auction.
4. Phone, WhatsApp/SMS and email recorded against the shared timeline.

## Release acceptance

- No dead primary buttons in the showcased journey.
- Desktop and 360 px layouts are readable without horizontal overflow.
- Keyboard focus is visible; dialogs are labelled and Escape closes workspace overlays.
- Web and API checks pass, Neon health is connected, and the production build is promoted through a reviewed feature branch merged into `main`.
- Public metrics and outcomes remain labelled demonstration/illustrative until evidence is approved.
