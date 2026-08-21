# DMS operating cockpit specification

## Product rule

AutoAxis is a connected operating system, not a catalogue of independent feature tiles. A feature is considered represented in the showcase only when it has an operating stage, a contextual record, an accountable action, and visible completion feedback.

Customer 360 and Vehicle 360 remain the shared data spine. Sales, used vehicles, inventory, F&I/insurance, and workforce actions retain the same customer, VIN, branch, document, and financial context.

## Implemented cockpit coverage

| Cockpit | Complete demonstration stages |
| --- | --- |
| Customer 360 | Seven-record searchable directory; segment filters; profile and consent editing; call, WhatsApp and email; tasks and notes; activity filters; owned vehicles; sales and finance history; insurance; service bookings and repair orders; document wallet; portal preview; share and CSV export |
| Vehicle 360 | Six-asset searchable directory; ownership/stock/demo/reserved filters; VIN master; lifecycle filters; repair orders, inspections, recalls and PDI; valuation and appraisal; ownership chain; document vault; inventory intake, auction and rental/demo booking; share and CSV export |
| New vehicle sales | Enquiry and assignment; qualification and pipeline; availability and configuration; test drive; quotation; KYC; finance; insurance; accessories; booking and invoice; registration; PDI; delivery checklist; handover; follow-up |
| Used vehicles | Acquisition and trade-in; appraisal and automated valuation; market comparison; 200-point inspection; photos/video; workshop preparation; refurbishment and recon cost; stock and pricing; aging; marketplace publishing; auction/reserve; expected and actual margin |
| Finance and insurance | KYC and lender comparison; approvals and contracts; policy quotation and tracking; insurer/workshop context; renewals; claims and accidents; commissions, reversals, and reconciliation |
| Vehicle inventory | New, used, incoming, allocated, reserved, and available VINs; yard location; branch transfer; demo/test-drive fleet; mileage and condition; receipt; PDI; registration dependencies; delivery and aging alerts; valuation |
| Workforce | Sales, service, technician, parts, and finance teams; attendance/roster; targets; incentives and commission; productivity and quality; skill matrix; certification; training and coaching |

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
