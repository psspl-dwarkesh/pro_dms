import type { DashView, Role } from "./types";

export const PUBLIC_DOMAINS: Array<{ id: DashView; index: string; name: string; description: string }> = [
  { id: "sales", index: "01", name: "Retail and CRM", description: "One guided path from enquiry and appraisal through quote, F&I, delivery, and retention." },
  { id: "service", index: "02", name: "Fixed operations", description: "Bookings, workshop load, digital approvals, parts, warranty, and payment in the same flow." },
  { id: "vehicles", index: "03", name: "Vehicle intelligence", description: "A VIN-led lifecycle covering acquisition, inventory, condition, ownership, and resale margin." },
  { id: "group", index: "04", name: "Group control", description: "Branch comparisons, profitability, exceptions, forecasting, and OEM reporting without spreadsheet joins." },
];

export const NAV_SECTIONS: Array<{ label: string; items: Array<{ id: DashView; label: string }> }> = [
  { label: "Command", items: [{ id: "overview", label: "Executive pulse" }, { id: "customers", label: "Customer 360" }, { id: "vehicles", label: "Vehicle 360" }] },
  { label: "Revenue", items: [{ id: "sales", label: "Sales and CRM" }, { id: "finance", label: "Finance and insurance" }, { id: "marketing", label: "Marketing" }] },
  { label: "Operations", items: [{ id: "service", label: "Service workshop" }, { id: "parts", label: "Parts" }, { id: "usedcars", label: "Used vehicles" }, { id: "inventory", label: "Inventory" }] },
  { label: "Intelligence", items: [{ id: "workforce", label: "Workforce" }, { id: "branch", label: "Branch performance" }, { id: "group", label: "Group analytics" }] },
  { label: "Company", items: [{ id: "company", label: "Company and users" }] },
];

// Modules with no dedicated data model yet render a "coming soon" placeholder instead of invented numbers.
export const COMING_SOON_VIEWS: ReadonlySet<DashView> = new Set(["marketing", "group", "workforce", "branch", "inventory", "usedcars"]);

// Closely-connected workspaces surfaced in each page's contextual sidebar, alongside its live quick actions.
export const PAGE_RELATED: Partial<Record<DashView, DashView[]>> = {
  overview: ["customers", "vehicles", "sales", "service", "parts", "finance"],
  customers: ["vehicles", "sales", "service"],
  vehicles: ["customers", "service"],
  sales: ["customers", "finance"],
  service: ["customers", "vehicles", "parts"],
  parts: ["service"],
  finance: ["sales", "customers"],
};

// Short "what is this page / how do I use it" copy shown from the topbar help affordance.
export const PAGE_HELP: Partial<Record<DashView, { summary: string; canDo: string[] }>> = {
  overview: {
    summary: "Your executive snapshot across the dealership - open leads, active jobs, low stock, and revenue at a glance.",
    canDo: [
      "Jump into Sales, Service, Parts, Customer 360, or Vehicle 360 from the sidebar or the Open work list.",
      "Watch the four headline metrics update as sales, service, and parts data changes.",
      "Use global search (Ctrl K) from anywhere to find a customer or vehicle.",
    ],
  },
  customers: {
    summary: "Every customer's connected record - contact details, vehicles, sales, service history, and communications in one place.",
    canDo: [
      "Search or create a customer on the left; select one to open their full record.",
      "Use Quick actions in the sidebar to create an opportunity, book service, log a call, or edit the profile.",
      "Switch tabs (Overview, Activity, Vehicles, Sales & finance, Service & care, Communications) to see everything linked to that customer.",
    ],
  },
  vehicles: {
    summary: "A VIN-led record for every vehicle - ownership, service history, and valuation in one place.",
    canDo: [
      "Search or add a vehicle on the left; select one to open its full record.",
      "Use Quick actions in the sidebar to update valuation or book a workshop visit.",
      "Switch tabs to see lifecycle events, work orders, valuation estimates, and current ownership.",
    ],
  },
  sales: {
    summary: "The lead pipeline from first enquiry through to a won or lost deal.",
    canDo: [
      "Create a lead from the sidebar and track it through each stage.",
      "Filter the pipeline by stage, or change a lead's stage directly from the list.",
      "Export the current queue to CSV for offline review.",
    ],
  },
  service: {
    summary: "The workshop queue - every repair order from booking through to close.",
    canDo: [
      "Book a new repair order from the sidebar.",
      "Filter jobs by status, or move a job to its next status directly from the list.",
      "Open the linked customer or vehicle record for full context on any job.",
    ],
  },
  parts: {
    summary: "Stock levels and reorder tracking for every part on file.",
    canDo: [
      "Add a part from the sidebar.",
      "Toggle to see only parts at or below their reorder point.",
      "Adjust quantity on hand directly from the list with the +/- controls.",
    ],
  },
  finance: {
    summary: "Finance contracts and insurance policies tied to your sales orders.",
    canDo: [
      "Create a finance contract or insurance policy from the sidebar.",
      "Switch between the Contracts and Policies tabs to review either list.",
      "Each contract links back to the sales order that financed it.",
    ],
  },
  company: {
    summary: "Manage branches and team accounts for your organisation.",
    canDo: [
      "Add a branch or a team account from the sidebar, or use the forms at the bottom of each table.",
      "Assign each team member a role and, optionally, a home branch.",
      "Deactivate an account without deleting its history by toggling its status.",
    ],
  },
};

const ORG_WIDE_VIEWS: DashView[] = ["overview", "customers", "vehicles", "sales", "service", "parts", "finance", "marketing", "usedcars", "inventory", "branch", "group", "workforce"];

// Each role maps to a genuinely distinct access need in a real dealership org structure -
// see database/009_role_model_expansion.sql for the roles this replaced and why.
export const ROLE_NAV: Record<Role, DashView[]> = {
  admin: [...ORG_WIDE_VIEWS, "company"],
  general_manager: ORG_WIDE_VIEWS,
  sales_manager: ["overview", "customers", "vehicles", "sales", "marketing", "usedcars", "inventory"],
  bdc_rep: ["overview", "customers", "sales"],
  finance_manager: ["overview", "customers", "vehicles", "sales", "finance"],
  service_advisor: ["overview", "customers", "vehicles", "service", "parts"],
  receptionist: ["overview", "customers", "vehicles"],
};
