# DMS operating cockpit specification

## Product rule

AutoAxis is a connected operating system, not a catalogue of independent feature tiles. A feature is considered represented in the showcase only when it has an operating stage, a contextual record, an accountable action, and visible completion feedback.

Customer 360 and Vehicle 360 remain the shared data spine. Sales, used vehicles, inventory, F&I/insurance, and workforce actions retain the same customer, VIN, branch, document, and financial context.

## Implemented cockpit coverage

Every row marked Implemented is backed by a real database table, authenticated and organization/branch-scoped CRUD routes, and a workspace view with no fabricated data. Rows marked Coming soon render the shared `ComingSoon` placeholder in the workspace instead of an invented workflow, because no data model exists for them yet.

| Cockpit | Status | Current stages |
| --- | --- | --- |
| Customer 360 | Implemented | Searchable directory; create/edit/delete; owned vehicles; cross-department timeline; lifetime value; call, WhatsApp, email; logged communications; linked leads and service jobs; share and CSV export |
| Vehicle 360 | Implemented | Searchable directory; create/edit/delete; VIN master; ownership; lifecycle timeline; linked repair orders; valuation (market value plus an estimated trade and wholesale figure derived from it); share and CSV export |
| Sales and CRM | Implemented | 360-style directory of leads; a lead's full record shows source, stage, expected value, logged test drives, and the sales order it becomes; stage updates; converting a won lead creates a linked sales order (`sales_orders.lead_id`). Full enquiry-to-delivery stages (quotation, KYC, registration, PDI, handover) are not yet modeled |
| Service workshop | Implemented | 360-style directory of repair orders; a job's full record joins the linked customer and vehicle (contact info, VIN, odometer) alongside advisor, technician, complaint, labour/parts totals; status workflow through to closed |
| Parts control | Implemented | Parts catalog with SKU, stock on hand, reorder point, unit cost and retail price; stock adjustment; low-stock filter. Kept as a flat queue, not a 360 hub: there is no line-item link between parts and repair orders (only an aggregate dollar total on the job), so there is no relational depth to hub around yet |
| Finance and insurance | Implemented | 360-style directory of deals (sales orders); a deal's full record joins its customer, vehicle, finance contract, and every insurance policy on that customer/vehicle pair in one place; status tracking |
| Company and users | Implemented, admin only | Branch directory and creation; team account directory, creation, and role/active-status management |
| Used vehicles | Implemented | Shared-VIN acquisition context; condition inspection; reconditioning tasks and cost; retail pricing and projected margin; stock ageing; Vehicle 360 auction listings/bids; wholesale disposal |
| Vehicle inventory | Coming soon | Yard location, branch transfer, and PDI/delivery tracking beyond the Vehicle 360 record have no data model yet |
| Marketing | Coming soon | Audience, journey, and attribution features have no data model yet |
| Branch performance | Coming soon | A branch-level rollup across sales, service, and parts is planned once more operating data exists |
| Group analytics | Coming soon | Cross-branch comparisons are planned once more than one branch has active operating data |
| Workforce | Coming soon | Team roster, targets, incentives, and skills tracking have no data model yet |

## Connector evidence policy

Named services on the product site are example connectors and are labelled integration-ready. Their presence is not a claim that a production account or commercial agreement is active. Core connector groups are OEM data, communications, documents/e-signature, finance/insurance, vehicle valuation and marketplaces, and accounting.

## Benchmark references

- [Tekion DMS](https://tekion.com/products/dms): unified CRM, Sales, F&I, Payroll, Service, Parts, Analytics, and Accounting context.
- [Titan DMS integrations](https://www.titandms.com/integrations): open API network across OEM, appraisal, sales, service, parts, administration, and CRM providers.
- [Pentana DealerPRO](https://www.pentanasolutions.com/product/dealerpro): integrated showroom, CRM, service, parts, accounting, administration, and BI workflows.
- [CDK Vehicle Inventory Suite](https://www.cdkglobal.com/cdk-vehicle-inventory-suite): connected Sales, Service, Marketing, appraisal, pricing, and merchandising workflows.

## Acceptance criteria

- The public header, workspace top bar, sidebar, logo, typography, spacing, and control language are visibly one product family.
- Cockpit tabs change the active process and records; record and primary actions open a guided workflow and produce completion feedback.
- Customer/Vehicle communication, filters, sharing, export, direct call, WhatsApp, and email remain accessible from their source record.
- Desktop and mobile layouts do not require horizontal page scrolling; dense cockpit rails may scroll within their own labelled region.
- All public claims and connector names stay identified as demonstration or integration-ready until evidence is approved.
