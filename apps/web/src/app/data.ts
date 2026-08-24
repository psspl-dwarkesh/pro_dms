import type { AdminView, DashView, PortalId, Role } from "./types";

export const PUBLIC_DOMAINS: Array<{ id: DashView; index: string; name: string; description: string }> = [
  { id: "sales", index: "01", name: "Retail and CRM", description: "One guided path from enquiry and appraisal through quote, F&I, delivery, and retention." },
  { id: "service", index: "02", name: "Fixed operations", description: "Bookings, workshop load, digital approvals, parts, warranty, and payment in the same flow." },
  { id: "vehicles", index: "03", name: "Vehicle intelligence", description: "A VIN-led lifecycle covering acquisition, inventory, condition, ownership, and resale margin." },
  { id: "analytics", index: "04", name: "Group control", description: "Branch comparisons, profitability, exceptions, forecasting, and OEM reporting without spreadsheet joins." },
];

// ---------------------------------------------------------------------------
// Primary sidebar: exactly the six portals
// ---------------------------------------------------------------------------
// Always visible, always labelled (icon + text, never icon-only), in this order. Sign-in lands on
// the first entry the signed-in role permits - there is no cross-portal "Home" and no seventh nav
// item. Administration is deliberately absent: it hangs off the account menu (see ADMIN_VIEW).
// docs/six-portal-workspace-plan.md is the authoritative IA; read it before changing this list.
export const NAV_SECTIONS: Array<{ label: string; items: Array<{ id: PortalId; label: string; blurb: string }> }> = [
  {
    label: "Workspaces",
    items: [
      { id: "customers", label: "Customer 360", blurb: "Relationship, consent, and lifetime value" },
      { id: "vehicles", label: "Vehicle 360", blurb: "VIN lifecycle, condition, service, and disposition" },
      { id: "sales", label: "Sales 360", blurb: "Leads, test drives, quotes, orders, delivery" },
      { id: "finance", label: "Finance 360", blurb: "Applications, contracts, insurance, payables" },
      { id: "marketing", label: "Marketing 360", blurb: "Audiences, campaigns, journeys, attribution" },
      { id: "analytics", label: "Analytics 360", blurb: "Dealership, branch, group, and workforce analysis" },
    ],
  },
];

export const ADMIN_VIEW: AdminView = "company";
export const ADMIN_LABEL = "Administration";

// Portal order, derived so NAV_SECTIONS stays the single source of truth for the primary sidebar.
export const PORTAL_IDS: PortalId[] = NAV_SECTIONS.flatMap((section) => section.items.map((item) => item.id));

const PORTAL_LABELS = Object.fromEntries(
  NAV_SECTIONS.flatMap((section) => section.items.map((item) => [item.id, item.label] as const)),
) as Record<PortalId, string>;

export const PORTAL_BLURBS = Object.fromEntries(
  NAV_SECTIONS.flatMap((section) => section.items.map((item) => [item.id, item.blurb] as const)),
) as Record<PortalId, string>;

// ---------------------------------------------------------------------------
// Contextual secondary sidebar and internal tab shell
// ---------------------------------------------------------------------------
// Each portal's own pages. The first entry is the portal's core area and shares the portal's id,
// so ?workspace=vehicles opens Vehicle 360 on its core tab. Sub-area ids are unchanged from the
// pre-consolidation DashView union, so every existing ?workspace=service|parts|usedcars|branch|
// group|workforce deep link still resolves - it now opens the owning portal with that tab active.
//
// A portal chat extends its own portal's array here (and adds the matching slot in
// DashboardApp#renderArea). It should not restructure this map or touch another portal's array.
export const PORTAL_AREAS: Record<PortalId, Array<{ id: DashView; label: string }>> = {
  customers: [{ id: "customers", label: "Overview" }],
  vehicles: [
    { id: "vehicles", label: "Overview" },
    { id: "service", label: "Service and workshop" },
    { id: "parts", label: "Parts" },
    { id: "usedcars", label: "Used, recon, and auction" },
  ],
  sales: [{ id: "sales", label: "Overview" }],
  finance: [{ id: "finance", label: "Overview" }],
  marketing: [{ id: "marketing", label: "Overview" }],
  analytics: [
    { id: "analytics", label: "Dealership" },
    { id: "branch", label: "Branch performance" },
    { id: "group", label: "Group analytics" },
    { id: "workforce", label: "Workforce productivity" },
  ],
};

const PORTAL_BY_VIEW = new Map<DashView, PortalId>(
  PORTAL_IDS.flatMap((portal) => PORTAL_AREAS[portal].map((area) => [area.id, portal] as [DashView, PortalId])),
);

// Which portal owns a view. Administration has no portal - it is reached from the account menu.
export function portalForView(view: DashView): PortalId | null {
  return PORTAL_BY_VIEW.get(view) ?? null;
}

// A portal's core area shares the portal's id, so it is labelled with the portal name here and
// with its area label ("Overview") only inside the tab strip and the contextual sidebar.
export function viewLabel(view: DashView): string {
  if (view === ADMIN_VIEW) return ADMIN_LABEL;
  const portal = portalForView(view);
  if (!portal) return view;
  if (view === portal) return PORTAL_LABELS[portal];
  return PORTAL_AREAS[portal].find((area) => area.id === view)?.label ?? PORTAL_LABELS[portal];
}

export function portalLabel(portal: PortalId): string {
  return PORTAL_LABELS[portal];
}

// Every routable workspace id, for validating the ?workspace= parameter.
export const DASH_VIEWS: DashView[] = [
  ...PORTAL_IDS.flatMap((portal) => PORTAL_AREAS[portal].map((area) => area.id)),
  ADMIN_VIEW,
];

// Deep links minted before the six-portal consolidation. `overview` was the standalone Executive
// pulse, now Analytics 360's Dealership area; `inventory` was a separate stock page, now folded
// into Vehicle 360's core area. Keep resolving both so shared and bookmarked URLs from the
// deep-link work in PR #8 do not dead-end.
export const LEGACY_VIEW_ALIASES: Record<string, DashView> = {
  overview: "analytics",
  inventory: "vehicles",
};

// Modules with no dedicated data model yet render a "coming soon" placeholder instead of invented
// numbers. Each is a sub-area of a live portal now, so the portal around it still works.
export const COMING_SOON_VIEWS: ReadonlySet<DashView> = new Set(["marketing", "usedcars", "branch", "group", "workforce"]);

// Connected portals surfaced in each page's contextual sidebar, alongside its live quick actions.
// Cross-portal only: a portal's own sub-areas are already in the tab strip and the Pages section,
// so listing them here would only duplicate them (DashboardApp filters same-portal entries out).
export const PAGE_RELATED: Partial<Record<DashView, DashView[]>> = {
  customers: ["vehicles", "sales", "finance"],
  vehicles: ["customers", "sales", "finance"],
  service: ["customers", "sales"],
  parts: ["customers", "analytics"],
  usedcars: ["sales", "marketing"],
  sales: ["customers", "vehicles", "finance"],
  finance: ["sales", "customers"],
  marketing: ["customers", "sales"],
  analytics: ["sales", "vehicles", "finance"],
  branch: ["sales", "vehicles"],
  group: ["sales", "finance"],
  workforce: ["customers", "sales"],
  company: ["analytics"],
};

// Short "what is this page / how do I use it" copy shown from the topbar help affordance.
// Coming-soon areas fall back to their planned-feature copy in DashboardApp, so they are omitted.
export const PAGE_HELP: Partial<Record<DashView, { summary: string; canDo: string[] }>> = {
  customers: {
    summary: "Every customer's connected record - contact details, vehicles, sales, service history, and communications in one place.",
    canDo: [
      "Search or create a customer on the left; select one to open their full record.",
      "Use Quick actions in the sidebar to create an opportunity, book service, log a call, or edit the profile.",
      "Switch tabs (Overview, Activity, Vehicles, Sales & finance, Service & care, Communications) to see everything linked to that customer.",
    ],
  },
  vehicles: {
    summary: "A VIN-led record for every vehicle - intake, ownership, documents, lifecycle, appraisal, valuation, and stock/location, plus auction and rental/demo disposition, all in one place.",
    canDo: [
      "Search or add a vehicle on the left; select one to open its full record.",
      "Use the record's own tabs - Ownership, Documents, Appraisal, Valuation, Stock & location, Auction, Rental & demo - to work each part of the vehicle's lifecycle.",
      "Use Quick actions in the sidebar to transfer ownership, record an appraisal or valuation, check the vehicle out, or book a workshop visit.",
      "Move between this portal's pages - Service and workshop, Parts, Used, recon, and auction - from the tabs above or the Pages list in the sidebar.",
    ],
  },
  service: {
    summary: "Vehicle 360's workshop page - every repair order's connected record, with its customer and vehicle alongside it.",
    canDo: [
      "Search or book a repair order on the left; select one to open its full record.",
      "Update status directly from the record as work progresses.",
      "Open the linked customer for full context on who the vehicle belongs to.",
    ],
  },
  parts: {
    summary: "Vehicle 360's parts page - stock levels and reorder tracking for every part on file.",
    canDo: [
      "Add a part from the sidebar.",
      "Toggle to see only parts at or below their reorder point.",
      "Adjust quantity on hand directly from the list with the +/- controls.",
    ],
  },
  sales: {
    summary: "Every lead's connected record - source, stage, test drives, and the sale it becomes.",
    canDo: [
      "Search or create a lead on the left; select one to open its full record.",
      "Use Quick actions in the sidebar to log a test drive, or convert a won lead into a sale.",
      "Change stage directly from the record; once won and converted, jump straight to Finance 360.",
    ],
  },
  finance: {
    summary: "Every deal's connected record - the vehicle, its finance contract, and any insurance policies.",
    canDo: [
      "Search or create a deal on the left; select one to open its full record.",
      "Use Quick actions in the sidebar to attach a finance contract or an insurance policy.",
      "Deals convert here automatically once a lead is won and converted from Sales 360.",
    ],
  },
  analytics: {
    summary: "Dealership-wide reporting. This page is the operating snapshot - open leads, active jobs, low stock, and revenue at a glance.",
    canDo: [
      "Watch the four headline metrics update as sales, service, and parts data changes.",
      "Open work flags what needs attention and deep-links into the portal that owns it.",
      "Use the tabs above for branch, group, and workforce analysis.",
    ],
  },
  company: {
    summary: "Administration - branches and team accounts for your organisation. Reached from the account menu, not the primary sidebar.",
    canDo: [
      "Add a branch or a team account from the sidebar, or use the forms at the bottom of each table.",
      "Assign each team member a role and, optionally, a home branch.",
      "Deactivate an account without deleting its history by toggling its status.",
    ],
  },
};

// ---------------------------------------------------------------------------
// Role access
// ---------------------------------------------------------------------------
// Views a role may reach, at the same per-view granularity as before the consolidation: granting
// a portal does not silently grant every sub-area inside it. A portal appears in the primary
// sidebar when the role can reach at least one of its areas. The API's own capability checks
// (apps/api/src/permissions.js) remain the authorization boundary - this list is navigation only.
const ALL_PORTAL_VIEWS: DashView[] = DASH_VIEWS.filter((view) => view !== ADMIN_VIEW);

// Each role maps to a genuinely distinct access need in a real dealership org structure -
// see database/009_role_model_expansion.sql for the roles this replaced and why.
export const ROLE_NAV: Record<Role, DashView[]> = {
  admin: [...ALL_PORTAL_VIEWS, ADMIN_VIEW],
  general_manager: ALL_PORTAL_VIEWS,
  sales_manager: ["customers", "vehicles", "usedcars", "sales", "marketing"],
  bdc_rep: ["customers", "sales"],
  finance_manager: ["customers", "vehicles", "sales", "finance"],
  service_advisor: ["customers", "vehicles", "service", "parts"],
  receptionist: ["customers", "vehicles"],
};

// Sign-in with no ?workspace= in the URL lands here: the first portal in the primary sidebar that
// this role permits. There is no separate cross-portal landing screen.
export function firstPermittedView(role: Role | null | undefined): DashView {
  const permitted = role ? ROLE_NAV[role] : [];
  return PORTAL_IDS.find((portal) => permitted.includes(portal)) ?? permitted[0] ?? "customers";
}
