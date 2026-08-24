import type { Customer360, DashView, DomainConfig, Vehicle360 } from "./types";

export const CUSTOMER_DEMO_ID = "30000000-0000-0000-0000-000000000001";
export const VEHICLE_DEMO_ID = "40000000-0000-0000-0000-000000000001";

export const CLIENT_DEMO_CUSTOMER: Customer360 = {
  id: CUSTOMER_DEMO_ID,
  displayName: "James Hartley",
  mobile: "+61 412 345 678",
  email: "james.hartley@prakashinfotech.com",
  preferredChannel: "WhatsApp",
  address: "14 Bayside Ave, Sydney NSW",
  lifetimeValue: 127450,
  customerSince: "2021-01-04",
  serviceVisitCount: 12,
  vehicles: [{ id: VEHICLE_DEMO_ID, make: "BMW", model: "X5", variant: "xDrive40i", vin: "WBAKS4C50J0Z12345", registration: "DMS-360" }],
  timeline: [
    { occurredAt: "2024-12-15T10:00:00Z", type: "delivery", summary: "Vehicle delivered — BMW X5 xDrive40i" },
    { occurredAt: "2024-11-03T10:00:00Z", type: "test-drive", summary: "BMW X5 and Mercedes GLE comparison" },
    { occurredAt: "2024-09-18T10:00:00Z", type: "service", summary: "60,000 km scheduled service completed" },
  ],
};

export const CLIENT_DEMO_VEHICLE: Vehicle360 = {
  id: VEHICLE_DEMO_ID,
  vin: "WBAKS4C50J0Z12345",
  registration: "DMS-360",
  make: "BMW",
  model: "X5",
  variant: "xDrive40i",
  colour: "Alpine White",
  modelYear: 2024,
  odometerKm: 12450,
  marketValue: 109500,
  status: "customer-owned",
  ownerName: "James Hartley",
  ownerMobile: "+61 412 345 678",
  timeline: CLIENT_DEMO_CUSTOMER.timeline,
};

export const PUBLIC_DOMAINS: Array<{ id: DashView; index: string; name: string; description: string }> = [
  { id: "sales", index: "01", name: "Retail & CRM", description: "One guided path from enquiry and appraisal through quote, F&I, delivery, and retention." },
  { id: "service", index: "02", name: "Fixed operations", description: "Bookings, workshop load, digital approvals, parts, warranty, and payment in the same flow." },
  { id: "vehicles", index: "03", name: "Vehicle intelligence", description: "A VIN-led lifecycle covering acquisition, inventory, condition, ownership, and resale margin." },
  { id: "group", index: "04", name: "Group control", description: "Branch comparisons, profitability, exceptions, forecasting, and OEM reporting without spreadsheet joins." },
];

export const NAV_SECTIONS: Array<{ label: string; items: Array<{ id: DashView; label: string }> }> = [
  { label: "Command", items: [{ id: "overview", label: "Executive pulse" }, { id: "customers", label: "Customer 360" }, { id: "vehicles", label: "Vehicle 360" }] },
  { label: "Revenue", items: [{ id: "sales", label: "Sales & CRM" }, { id: "finance", label: "Finance & insurance" }, { id: "marketing", label: "Marketing" }] },
  { label: "Operations", items: [{ id: "service", label: "Service workshop" }, { id: "parts", label: "Parts" }, { id: "usedcars", label: "Used vehicles" }, { id: "inventory", label: "Inventory" }] },
  { label: "Intelligence", items: [{ id: "workforce", label: "Workforce" }, { id: "branch", label: "Branch performance" }, { id: "group", label: "Group analytics" }] },
];

export type WorkspaceHub = {
  id: string;
  label: string;
  shortLabel: string;
  summary: string;
  items: Array<{ id: DashView; label: string; detail: string }>;
};

export const WORKSPACE_HUBS: WorkspaceHub[] = [
  { id: "home", label: "Home", shortLabel: "Home", summary: "Priorities, alerts and recent work", items: [{ id: "overview", label: "Executive pulse", detail: "Decisions and exceptions" }] },
  { id: "customer", label: "Customer 360", shortLabel: "Customers", summary: "Relationship, ownership and consent", items: [{ id: "customers", label: "Customer 360", detail: "Directory and shared relationship record" }] },
  { id: "vehicle", label: "Vehicle 360", shortLabel: "Vehicles", summary: "VIN lifecycle, condition and value", items: [{ id: "vehicles", label: "Vehicle 360", detail: "Directory and shared VIN record" }] },
  { id: "sales", label: "Sales & F&I", shortLabel: "Sales & F&I", summary: "Lead through delivery and settlement", items: [{ id: "sales", label: "Sales & CRM", detail: "Enquiries, pipeline and delivery" }, { id: "finance", label: "Finance & insurance", detail: "KYC, offers and settlement" }] },
  { id: "fixed-ops", label: "Fixed Operations", shortLabel: "Fixed Ops", summary: "Workshop, parts and handover", items: [{ id: "service", label: "Service workshop", detail: "Bookings, repair orders and bays" }, { id: "parts", label: "Parts control", detail: "Fitment, reservations and supply" }] },
  { id: "inventory", label: "Inventory & Used", shortLabel: "Inventory", summary: "Stock, appraisal and disposition", items: [{ id: "inventory", label: "New inventory", detail: "Orders, allocation and PDI" }, { id: "usedcars", label: "Used vehicles", detail: "Appraise, recondition and publish" }] },
  { id: "growth", label: "Growth", shortLabel: "Growth", summary: "Audiences, journeys and retention", items: [{ id: "marketing", label: "Marketing journeys", detail: "Consent-aware customer growth" }] },
  { id: "insights", label: "Insights", shortLabel: "Insights", summary: "Group, branch and operating analysis", items: [{ id: "group", label: "Group analytics", detail: "Executive and group comparison" }, { id: "branch", label: "Branch performance", detail: "Branch drill-down and recovery" }] },
  { id: "admin", label: "Workforce & Admin", shortLabel: "Workforce", summary: "People, access and accountability", items: [{ id: "workforce", label: "Workforce & Admin", detail: "Teams, roles and productivity" }] },
];

export const REVENUE_TREND = [
  { month: "Mar", actual: 6.2, plan: 6.0 },
  { month: "Apr", actual: 6.5, plan: 6.3 },
  { month: "May", actual: 6.1, plan: 6.5 },
  { month: "Jun", actual: 7.0, plan: 6.7 },
  { month: "Jul", actual: 7.4, plan: 7.0 },
  { month: "Aug", actual: 7.8, plan: 7.4 },
];

export const DOMAIN_CONFIG: Record<Exclude<DashView, "overview" | "customers" | "vehicles">, DomainConfig> = {
  sales: {
    title: "Sales & CRM",
    eyebrow: "Revenue operations",
    description: "Move every enquiry from first response to a controlled, profitable delivery.",
    action: "Create opportunity",
    metrics: [
      { label: "Open pipeline", value: "$8.42m", delta: "+11.8% month on month", tone: "good" },
      { label: "Response SLA", value: "08:14", delta: "1m 46s inside target", tone: "good" },
      { label: "Test-drive conversion", value: "34.6%", delta: "+2.4 pts", tone: "good" },
      { label: "At-risk deliveries", value: "7", delta: "3 require intervention", tone: "warn" },
    ],
    queueTitle: "Deals needing attention",
    queue: [
      { primary: "A. Nguyen · Q7 55 TFSI", secondary: "Finance condition pending", meta: "$148,900 · Delivery 23 Aug", status: "Escalate", tone: "bad" },
      { primary: "R. Mehta · Ranger Wildtrak", secondary: "Trade valuation expires today", meta: "$78,450 · Owner: S. Cole", status: "Today", tone: "warn" },
      { primary: "J. Hartley · X5 xDrive40i", secondary: "Delivery pack complete", meta: "$127,450 · Sydney Central", status: "Ready", tone: "good" },
    ],
    insightTitle: "Pipeline signal",
    insight: "Nine high-intent opportunities have no next activity. Assigning them before 11:00 protects an estimated $312k of weighted pipeline.",
  },
  service: {
    title: "Service workshop",
    eyebrow: "Fixed operations",
    description: "Keep advisors, technicians, parts, warranty, and customers on one live repair-order clock.",
    action: "New booking",
    metrics: [
      { label: "Bay utilisation", value: "86%", delta: "+4 pts vs plan", tone: "good" },
      { label: "Labour recovery", value: "91.2%", delta: "1.8 pts below target", tone: "warn" },
      { label: "Awaiting approval", value: "12", delta: "$18.4k quoted work", tone: "warn" },
      { label: "Promise risk", value: "4", delta: "2 customer updates due", tone: "bad" },
    ],
    queueTitle: "Live workshop exceptions",
    queue: [
      { primary: "RO-18492 · Volvo XC60", secondary: "Diagnostic blocked · technical support", meta: "Bay 04 · 52m over plan", status: "Blocked", tone: "bad" },
      { primary: "RO-18506 · BMW X5", secondary: "Digital approval unopened", meta: "$1,280 · Sent 34m ago", status: "Contact", tone: "warn" },
      { primary: "RO-18488 · Mazda CX-5", secondary: "Quality check complete", meta: "Pickup 15:30", status: "Ready", tone: "good" },
    ],
    insightTitle: "Capacity signal",
    insight: "Moving two inspection jobs to Bay 11 removes the afternoon bottleneck and restores the 16:00 promise window.",
  },
  parts: {
    title: "Parts control",
    eyebrow: "Warehouse & supply",
    description: "Protect workshop flow and margin with VIN-fitment, reservations, and demand-led replenishment.",
    action: "Create order",
    metrics: [
      { label: "Fill rate", value: "94.8%", delta: "+1.6 pts", tone: "good" },
      { label: "Stock value", value: "$2.18m", delta: "3.1 turns annualised", tone: "neutral" },
      { label: "Emergency orders", value: "8", delta: "3 preventable", tone: "warn" },
      { label: "Obsolete stock", value: "$96.4k", delta: "4.4% of inventory", tone: "bad" },
    ],
    queueTitle: "Supply exceptions",
    queue: [
      { primary: "11-42-8-659-230 · Oil filter", secondary: "Workshop demand exceeds available", meta: "Need 18 · Available 7", status: "Reorder", tone: "bad" },
      { primary: "31416791911 · Brake disc", secondary: "Inter-branch stock available", meta: "Parramatta · 6 units", status: "Transfer", tone: "warn" },
      { primary: "5Q0-698-151 · Pad set", secondary: "Reserved for RO-18511", meta: "Bin A-14-03", status: "Picked", tone: "good" },
    ],
    insightTitle: "Demand signal",
    insight: "Service-booking demand predicts a brake-component shortage in six days. A consolidated order avoids four emergency freight events.",
  },
  finance: {
    title: "Finance & insurance",
    eyebrow: "Deal profitability",
    description: "Compare offers, manage conditions, protect compliance, and make every product outcome visible.",
    action: "New application",
    metrics: [
      { label: "Finance penetration", value: "48.2%", delta: "+3.0 pts", tone: "good" },
      { label: "Products per deal", value: "1.84", delta: "+0.12", tone: "good" },
      { label: "Approval time", value: "42m", delta: "8m faster", tone: "good" },
      { label: "Compliance holds", value: "3", delta: "2 documents missing", tone: "bad" },
    ],
    queueTitle: "Applications needing action",
    queue: [
      { primary: "FI-62014 · A. Nguyen", secondary: "Income evidence missing", meta: "$112,000 financed", status: "Hold", tone: "bad" },
      { primary: "FI-62018 · R. Mehta", secondary: "Two lender offers available", meta: "Best rate 7.14%", status: "Compare", tone: "warn" },
      { primary: "FI-62009 · J. Hartley", secondary: "Settlement confirmed", meta: "Contract pack complete", status: "Complete", tone: "good" },
    ],
    insightTitle: "Margin signal",
    insight: "Warranty attachment is strongest when the comparison is shared before final desking. Seven active deals are at that decision point.",
  },
  marketing: {
    title: "Marketing journeys",
    eyebrow: "Demand & retention",
    description: "Build consent-aware audiences from real ownership, service, and intent signals.",
    action: "Create journey",
    metrics: [
      { label: "Attributed pipeline", value: "$1.26m", delta: "+18.4%", tone: "good" },
      { label: "Service retention", value: "71.3%", delta: "+2.8 pts", tone: "good" },
      { label: "Active journeys", value: "14", delta: "6 lifecycle triggers", tone: "neutral" },
      { label: "Consent exceptions", value: "22", delta: "Suppressed automatically", tone: "warn" },
    ],
    queueTitle: "Journey operations",
    queue: [
      { primary: "First-service welcome", secondary: "142 customers enter tomorrow", meta: "Email + SMS · Consent checked", status: "Scheduled", tone: "good" },
      { primary: "36-month ownership renewal", secondary: "Offer inventory below audience", meta: "82 customers · 31 matches", status: "Review", tone: "warn" },
      { primary: "Lapsed service recovery", secondary: "Frequency cap conflict", meta: "18 contacts suppressed", status: "Fix", tone: "bad" },
    ],
    insightTitle: "Audience signal",
    insight: "Owners approaching 48 months with positive service history are converting 2.3× above broad renewal audiences in the demonstration model.",
  },
  usedcars: {
    title: "Used vehicle centre",
    eyebrow: "Acquisition & remarketing",
    description: "Control every unit from appraisal and refurbishment to pricing, publishing, and disposal.",
    action: "Start appraisal",
    metrics: [
      { label: "Retail units", value: "184", delta: "+12 this month", tone: "good" },
      { label: "Average age", value: "38d", delta: "2d better", tone: "good" },
      { label: "Recon cycle", value: "3.7d", delta: "0.6d over plan", tone: "warn" },
      { label: "Margin at risk", value: "$74k", delta: "11 aged units", tone: "bad" },
    ],
    queueTitle: "Stock actions",
    queue: [
      { primary: "2022 Volvo XC90 · U-30418", secondary: "Price position 7% above market", meta: "64 days · $71,900", status: "Reprice", tone: "bad" },
      { primary: "2023 Mazda CX-60 · U-30462", secondary: "Photography booked", meta: "Recon 92% · 2 days", status: "Publish", tone: "warn" },
      { primary: "2021 BMW 330i · U-30398", secondary: "Buyer deposit received", meta: "$48,400 · Margin 9.8%", status: "Sold", tone: "good" },
    ],
    insightTitle: "Pricing signal",
    insight: "Repricing four 45+ day units to the competitive band is forecast to release $221k in working capital within two weeks.",
  },
  inventory: {
    title: "Vehicle inventory",
    eyebrow: "Supply & fulfilment",
    description: "See every VIN, order milestone, location, allocation, PDI dependency, and aging risk.",
    action: "Locate vehicle",
    metrics: [
      { label: "Available units", value: "428", delta: "92 incoming", tone: "neutral" },
      { label: "Allocated", value: "76%", delta: "+5 pts", tone: "good" },
      { label: "PDI due", value: "18", delta: "6 within 24 hours", tone: "warn" },
      { label: "60+ day stock", value: "21", delta: "$1.8m carrying value", tone: "bad" },
    ],
    queueTitle: "Fulfilment exceptions",
    queue: [
      { primary: "WBA11EU09R9Y40122 · BMW iX1", secondary: "Delivery date changed by OEM", meta: "Customer delivery 26 Aug", status: "Notify", tone: "bad" },
      { primary: "KMHHC81DVNU142910 · Ioniq 5", secondary: "PDI parts reserved", meta: "Yard C-12 · Due 14:00", status: "In progress", tone: "warn" },
      { primary: "WVWZZZCD6PW114728 · Golf R", secondary: "Allocation matched", meta: "Deal S-10982", status: "Ready", tone: "good" },
    ],
    insightTitle: "Supply signal",
    insight: "Seven unallocated incoming units match active qualified opportunities. Pre-allocation shortens forecast days-to-delivery by 4.2 days.",
  },
  branch: {
    title: "Branch performance",
    eyebrow: "Sydney Central",
    description: "Connect local targets to the people, vehicles, jobs, and exceptions that move them.",
    action: "Open scorecard",
    metrics: [
      { label: "Revenue to plan", value: "103.8%", delta: "+$284k", tone: "good" },
      { label: "Gross margin", value: "18.6%", delta: "+0.8 pts", tone: "good" },
      { label: "Customer effort", value: "2.1", delta: "0.3 better", tone: "good" },
      { label: "Open risks", value: "9", delta: "4 ownerless", tone: "bad" },
    ],
    queueTitle: "Leadership actions",
    queue: [
      { primary: "Workshop promise performance", secondary: "Below group floor for 3 days", meta: "Owner: Fixed Ops Director", status: "Recover", tone: "bad" },
      { primary: "Used acquisition target", secondary: "8 units behind monthly pace", meta: "Owner: Sales Manager", status: "Plan", tone: "warn" },
      { primary: "Finance penetration", secondary: "Highest in group", meta: "48.2% · +3.0 pts", status: "On track", tone: "good" },
    ],
    insightTitle: "Branch signal",
    insight: "Sydney Central leads revenue plan but workshop promise performance is the only material drag on customer effort this week.",
  },
  group: {
    title: "Group analytics",
    eyebrow: "Pacific Motor Group",
    description: "Compare branches on one definition of revenue, margin, experience, and operational risk.",
    action: "Create briefing",
    metrics: [
      { label: "Group revenue", value: "$48.7m", delta: "+7.4% vs plan", tone: "good" },
      { label: "Gross profit", value: "$9.06m", delta: "18.6% margin", tone: "good" },
      { label: "Forecast confidence", value: "92%", delta: "+4 pts", tone: "good" },
      { label: "Critical risks", value: "6", delta: "Across 4 branches", tone: "bad" },
    ],
    queueTitle: "Group exceptions",
    queue: [
      { primary: "North Shore · Used vehicles", secondary: "Aging value above group threshold", meta: "$640k in 60+ day stock", status: "Review", tone: "bad" },
      { primary: "Parramatta · Parts", secondary: "Emergency freight above plan", meta: "+$18.2k month to date", status: "Investigate", tone: "warn" },
      { primary: "Sydney Central · F&I", secondary: "Best practice candidate", meta: "48.2% penetration", status: "Share", tone: "good" },
    ],
    insightTitle: "Group signal",
    insight: "Rebalancing nine slow-moving SUVs between three branches improves local demand fit and reduces modeled carrying cost by $31k.",
  },
  workforce: {
    title: "Workforce control",
    eyebrow: "People, skills & performance",
    description: "Connect targets, attendance, capability, incentive outcomes, and workload to the operating records each team owns.",
    action: "Add team member",
    metrics: [
      { label: "Active team", value: "184", delta: "Across 12 branches", tone: "neutral" },
      { label: "Productivity", value: "91.4%", delta: "+2.6 pts this month", tone: "good" },
      { label: "Training due", value: "14", delta: "5 safety-critical", tone: "warn" },
      { label: "Target risk", value: "8", delta: "Coaching plans required", tone: "bad" },
    ],
    queueTitle: "People actions",
    queue: [
      { primary: "Workshop certification", secondary: "Five technicians require EV safety renewal", meta: "Due in 14 days", status: "Assign", tone: "bad" },
      { primary: "Sales coaching cohort", secondary: "Lead response below group SLA", meta: "8 advisors · 3 branches", status: "Coach", tone: "warn" },
      { primary: "August incentive run", secondary: "Commission inputs reconciled", meta: "184 team members", status: "Ready", tone: "good" },
    ],
    insightTitle: "Capacity signal",
    insight: "Moving two EV-certified technicians across the afternoon roster covers projected demand without overtime or promise risk.",
  },
};
