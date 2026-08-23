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

const ORG_WIDE_VIEWS: DashView[] = ["overview", "customers", "vehicles", "sales", "service", "parts", "finance", "marketing", "usedcars", "inventory", "branch", "group", "workforce"];

export const ROLE_NAV: Record<Role, DashView[]> = {
  admin: [...ORG_WIDE_VIEWS, "company"],
  branch_manager: ORG_WIDE_VIEWS,
  sales: ["overview", "customers", "vehicles", "sales", "finance", "marketing"],
  service: ["overview", "customers", "vehicles", "service", "parts", "inventory", "usedcars"],
  staff: ["overview", "customers", "vehicles"],
};
