import {
  AlertTriangle, ArrowRight, ArrowUpRight, BadgeCheck, BarChart3, CalendarClock, CarFront,
  CheckCircle2, Clock3, Copy, DollarSign, Download, Filter, Gauge, Lightbulb, Mail,
  Sparkles, Target, TrendingUp, Users, Wrench, ChevronRight,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DOMAIN_CONFIG, REVENUE_TREND } from "../data";
import type { DashView, DomainConfig } from "../types";
import { Toast, WorkflowModal, WorkspacePage } from "./RecordViews";

function MetricCard({ metric }: { metric: DomainConfig["metrics"][number] }) {
  return (
    <div className="metric-card">
      <span className="metric-label">{metric.label}</span>
      <strong className="metric-value">{metric.value}</strong>
      <em className={`metric-delta tone-${metric.tone ?? "neutral"}`}>{metric.delta}</em>
    </div>
  );
}

const tooltipStyle = {
  background: "#0b2535",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: "10px",
  color: "#f4f5f0",
  fontSize: 12,
  padding: "10px 14px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
};

type Studio = {
  title: string;
  icon?: typeof Users;
  tabs: Array<{
    label: string;
    description: string;
    action: string;
    coverage: string[];
    records: Array<{ name: string; meta: string; status: string }>;
  }>;
};

const OPERATING_STUDIOS: Partial<Record<DashView, Studio>> = {
  sales: {
    title: "New Vehicle Retail Desk",
    tabs: [
      {
        label: "Enquiry & Pipeline",
        description: "Capture, assign, and qualify every lead with response ownership and a visible next step.",
        action: "Capture enquiry",
        coverage: ["Lead capture", "SLA assignment", "Pipeline stage", "Live stock match"],
        records: [
          { name: "Ava Nguyen · Audi Q7 55 TFSI", meta: "Web enquiry · 6m response SLA · Sydney Central", status: "Qualified" },
          { name: "Rohan Mehta · Ford Ranger Wildtrak", meta: "Trade-in appraisal linked · Sarah Cole", status: "Follow-up" },
          { name: "Mia Wilson · Hyundai Ioniq 5", meta: "OEM campaign source · Unassigned", status: "New Lead" },
        ],
      },
      {
        label: "Configure & Drive",
        description: "Match live stock, configure model and variant, and control test-drive availability and outcomes.",
        action: "Schedule test drive",
        coverage: ["Live VIN match", "Variant & options", "Test drive fleet", "Accessories pack"],
        records: [
          { name: "Audi Q7 55 TFSI · Glacier White", meta: "Demo fleet A-07 · 14:30 appointment", status: "Confirmed" },
          { name: "BMW X5 xDrive40i · M Sport", meta: "Incoming unit · ETA 26 Aug · Sydney Central", status: "Configure" },
          { name: "Ford Ranger Wildtrak · V6 Diesel", meta: "Yard C-12 · Available immediately", status: "Ready" },
        ],
      },
      {
        label: "Quote, KYC & F&I",
        description: "Build a controlled deal from quotation through identity, finance, insurance, and booking.",
        action: "Build quotation",
        coverage: ["Price quotation", "KYC verification", "Lender integration", "Insurance bind", "Tax invoice"],
        records: [
          { name: "Q-44128 · Ava Nguyen", meta: "$148,900 · 2 lender offers · Macquarie & St George", status: "KYC Due" },
          { name: "Q-44119 · James Hartley", meta: "$127,450 · Trade-in equity applied", status: "Approved" },
          { name: "Q-44131 · Rohan Mehta", meta: "$78,450 · Comprehensive insurance pending", status: "Under Review" },
        ],
      },
      {
        label: "Register & Deliver",
        description: "Control registration, PDI, delivery checklist, customer handover, and post-delivery follow-up.",
        action: "Open delivery pack",
        coverage: ["NSW Registration", "PDI sign-off", "Customer checklist", "Handover slot", "30-day review"],
        records: [
          { name: "D-10982 · James Hartley", meta: "BMW X5 · Scheduled 23 Aug 10:00 · Bay 02", status: "Ready" },
          { name: "D-10991 · Mia Wilson", meta: "Ioniq 5 · Transport registration pending", status: "At Risk" },
          { name: "D-10975 · Emily Chen", meta: "Volvo XC60 · Customer follow-up due tomorrow", status: "Delivered" },
        ],
      },
    ],
  },
  usedcars: {
    title: "Pre-Owned Vehicle Centre",
    tabs: [
      {
        label: "Acquire & Appraise",
        description: "Source trade-ins and direct purchases with condition evidence, market comparables, and controlled offers.",
        action: "Start appraisal",
        coverage: ["Direct acquisition", "Trade-in intake", "Guided appraisal", "Live market comps", "RedBook guide"],
        records: [
          { name: "2022 BMW X5 · DMS-360", meta: "48,620 km · 8 market comparables · High confidence", status: "$78,200 AUD" },
          { name: "2021 Volvo XC90 · U-30418", meta: "64,100 km · Direct fleet purchase", status: "$66,500 AUD" },
          { name: "2023 Mazda CX-60 · U-30462", meta: "18,440 km · Dealership trade-in", status: "Needs Inspection" },
        ],
      },
      {
        label: "Inspect & Recondition",
        description: "Move every unit through a 200-point inspection, photography, workshop preparation, and cost control.",
        action: "Open inspection",
        coverage: ["200-point safety", "Studio photos/video", "Mechanical prep", "Detailing", "Recon expense cap"],
        records: [
          { name: "U-30462 · Mazda CX-60", meta: "184 / 200 checks complete · 360 photo booked", status: "92% Done" },
          { name: "U-30418 · Volvo XC90", meta: "$2,840 estimated · $2,610 actual spend", status: "QC Signoff" },
          { name: "U-30471 · Audi A4", meta: "Tyres & wheel refurbishment in progress", status: "In Workshop" },
        ],
      },
      {
        label: "Price & Stock",
        description: "Set retail and wholesale positions using aging, margin, location, and expected-vs-actual economics.",
        action: "Set retail price",
        coverage: ["Stock book", "Dynamic pricing", "Aging alert", "Yard position", "Target gross margin"],
        records: [
          { name: "U-30418 · Volvo XC90", meta: "64 days in stock · 7% above competitive market", status: "Reprice" },
          { name: "U-30398 · BMW 330i", meta: "22 days in stock · 9.8% realized margin", status: "On Target" },
          { name: "U-30462 · Mazda CX-60", meta: "2 days in stock · $8,420 expected gross profit", status: "Price Ready" },
        ],
      },
      {
        label: "Publish & Dispose",
        description: "Publish approved merchandising or route aged and non-retail units to a controlled wholesale auction.",
        action: "Publish vehicle",
        coverage: ["Carsales & portal sync", "Wholesale auction", "Reserve price", "Resale tracking", "Settlement"],
        records: [
          { name: "U-30462 · Mazda CX-60", meta: "6 digital channels · 24 approved HD photos", status: "Ready to Publish" },
          { name: "U-30280 · Mercedes GLC", meta: "Wholesale auction reserve set at $48,500", status: "Approved" },
          { name: "U-30398 · BMW 330i", meta: "Sold for $48,400 · $4,710 net margin", status: "Sold" },
        ],
      },
    ],
  },
  finance: {
    title: "Finance & Insurance Control Desk",
    tabs: [
      {
        label: "Applications & Lenders",
        description: "Compare lender offers, manage KYC evidence, condition approval, contracts, and settlement.",
        action: "New application",
        coverage: ["Digital KYC", "Multi-lender compare", "Condition tracking", "E-sign contracts", "Settlement status"],
        records: [
          { name: "FI-62014 · Ava Nguyen", meta: "$112,000 financed · Payslips & income evidence due", status: "On Hold" },
          { name: "FI-62018 · Rohan Mehta", meta: "2 pre-approved offers · Best rate 7.14% APR", status: "Compare" },
          { name: "FI-62009 · James Hartley", meta: "Settlement confirmed · Macquarie Bank", status: "Settled" },
        ],
      },
      {
        label: "Insurance Integration",
        description: "Quote, bind, and track insurance policies with vehicle, customer, finance, and delivery context.",
        action: "Create insurance quote",
        coverage: ["Policy tracking", "Real-time quotes", "Insurer API link", "Handover binding"],
        records: [
          { name: "INS-8841 · Audi Q7", meta: "3 insurer quotes · Delivery scheduled 23 Aug", status: "Select Policy" },
          { name: "INS-8829 · BMW X5", meta: "NRMA Comprehensive · Active policy", status: "Bound" },
        ],
      },
      {
        label: "Claims & Renewals",
        description: "Control accident intake, claim progress, repair-order linkage, and proactive policy renewals.",
        action: "Register claim",
        coverage: ["Renewal notifications", "Accident intake", "Repair order link", "Assessor updates"],
        records: [
          { name: "CLM-1844 · Volvo XC60", meta: "Linked to RO-18492 · Insurance assessor pending", status: "Open Claim" },
          { name: "RNW-9921 · BMW X5", meta: "Renews 14 Nov 2026 · Consent verified", status: "Scheduled" },
        ],
      },
      {
        label: "Commission & Audit",
        description: "Reconcile product attachment, insurer and lender commission against settled deals and reversals.",
        action: "Run reconciliation",
        coverage: ["Commission ledger", "Product attachment rate", "Clawback / reversal", "Compliance audit"],
        records: [
          { name: "August Commission Run", meta: "31 deals reconciled · $84,220 gross commission", status: "Ready" },
          { name: "REV-114 · Cancelled Policy", meta: "$1,240 clawback reversal applied", status: "Reviewed" },
        ],
      },
    ],
  },
  inventory: {
    title: "Vehicle Stock & Yard Logistics",
    tabs: [
      {
        label: "Stock Master Book",
        description: "Unified VIN-led stock book for new, used, incoming, allocated, reserved, and available vehicles.",
        action: "Add stock vehicle",
        coverage: ["New inventory", "Used inventory", "Incoming transit", "Reserved stock", "Valuation floor"],
        records: [
          { name: "WBA11EU09R9Y40122 · BMW iX1", meta: "Incoming ship · Allocated to Deal S-10982", status: "ETA 26 Aug" },
          { name: "U-30462 · Mazda CX-60", meta: "Pre-owned inventory · Sydney Central Yard", status: "Available" },
        ],
      },
      {
        label: "Yard & Logistics Transfers",
        description: "Locate units by physical yard position and move stock between branches with accountable handover.",
        action: "Create stock transfer",
        coverage: ["Yard bay GPS", "Inter-branch transfers", "Driver manifest", "Handover sign-off"],
        records: [
          { name: "Hyundai Ioniq 5 · Yard C-12", meta: "PDI parts staged · Move to Bay 04", status: "Located" },
          { name: "9 SUV Units · North Shore", meta: "Rebalance transfer to Sydney Central & Parramatta", status: "Proposed" },
        ],
      },
      {
        label: "Demo & Test Drive Fleet",
        description: "Control demonstrator assignment, availability, bookings, mileage tracking, and return condition.",
        action: "Assign demo vehicle",
        coverage: ["Demonstrator fleet", "Mileage logs", "Booking schedule", "Return inspection"],
        records: [
          { name: "Audi Q7 · Demo A-07", meta: "Test drive booking 14:30 · Ava Nguyen", status: "Booked" },
          { name: "BMW i4 · Demo E-02", meta: "Return inspection due 17:00 · 84 km logged", status: "Out on Drive" },
        ],
      },
      {
        label: "PDI & Handover Flow",
        description: "Move incoming vehicles through receipt, PDI inspection, accessories fitment, and delivery readiness.",
        action: "Open PDI checklist",
        coverage: ["Transport receipt", "PDI signoff", "Software updates", "Delivery prep"],
        records: [
          { name: "BMW iX1 · PDI-22014", meta: "6 of 8 checks complete · Navigation update in progress", status: "In Progress" },
          { name: "VW Golf R · PDI-22008", meta: "Deal S-10982 · All pre-delivery checks passed", status: "Ready" },
        ],
      },
    ],
  },
  workforce: {
    title: "Dealership Workforce & Performance Desk",
    tabs: [
      {
        label: "Team Directory & Rostering",
        description: "Role-based dealership team directory with branch assignments, live attendance, and workload balancing.",
        action: "Add team member",
        coverage: ["Sales advisors", "Service advisors", "Master technicians", "Parts team", "F&I managers", "Roster schedule"],
        records: [
          { name: "Sarah Cole · Sales Manager", meta: "Sydney Central · Active on shift · 8 open pipeline deals", status: "Available" },
          { name: "Noah Patel · Senior Master Technician", meta: "EV High-Voltage Certified · Workshop Bay 06", status: "100% Productive" },
          { name: "Daniel Brooks · Service Advisor", meta: "Sydney Central · 14 repair orders in progress today", status: "On Duty" },
        ],
      },
      {
        label: "Targets & Performance Incentives",
        description: "Track individual and departmental monthly targets, commission attainment, and auditable incentive runs.",
        action: "Set performance target",
        coverage: ["Sales quota", "Gross profit target", "Labour recovery %", "CSI satisfaction", "Incentive payout"],
        records: [
          { name: "Sales Department · August 2026", meta: "94% target revenue · 102% gross profit plan achieved", status: "On Track" },
          { name: "Service Advisors Cohort", meta: "91.2% labour recovery rate vs 93.0% target", status: "Coaching Due" },
          { name: "F&I Finance Team", meta: "48.2% penetration · 1.84 products per deal", status: "Exceeding" },
        ],
      },
      {
        label: "Skills Matrix & Certifications",
        description: "Maintain role certifications, OEM technical training schedules, and safety-critical renewals.",
        action: "Assign training module",
        coverage: ["EV high-voltage safety", "OEM Master certification", "F&I ASIC compliance", "Workplace safety"],
        records: [
          { name: "EV Safety Certification Renewal", meta: "5 technicians due for annual renewal before 4 Sep", status: "Action Required" },
          { name: "Annual F&I Compliance Review", meta: "12 team members · 83% completion rate", status: "In Progress" },
          { name: "Service Advisor CX Excellence", meta: "4 advisors enrolled for next week seminar", status: "Scheduled" },
        ],
      },
      {
        label: "Productivity & Quality Coaching",
        description: "Connect team output to actual leads, repair order cycle times, comeback rates, and client reviews.",
        action: "Open coaching plan",
        coverage: ["Lead response SLA", "Technician efficiency", "RO comeback rate", "Customer NPS score"],
        records: [
          { name: "Workshop Technical Team", meta: "91.4% productive hours · 2.1% comeback rate (target < 3%)", status: "Strong" },
          { name: "Sales Lead Response Cohort", meta: "Average 11m response vs 10m group SLA", status: "Coaching Plan" },
        ],
      },
    ],
  },
};

export function OverviewView({ onNavigate }: { onNavigate: (view: DashView) => void }) {
  const [toast, setToast] = useState("");
  const [briefingOpen, setBriefingOpen] = useState(false);
  const briefingText =
    "AutoAxis daily executive briefing — Pacific Motor Group\n\n" +
    "1. Group revenue is currently 7.4% ahead of monthly operating plan ($48.7m MTD).\n" +
    "2. Four workshop customer promises require intervention before 11:00.\n" +
    "3. Seven customers require OEM delivery schedule updates.\n" +
    "4. $640k of pre-owned vehicle inventory is above the 60-day aging threshold.\n" +
    "5. Sydney Central F&I performance (48.2% penetration) is a group best-practice benchmark.\n\n" +
    "Prepared in the AutoAxis DMS enterprise operations workspace.";

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  function downloadBriefing() {
    const url = URL.createObjectURL(new Blob([briefingText], { type: "text/plain" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "autoaxis-daily-briefing.txt";
    anchor.click();
    URL.revokeObjectURL(url);
    setBriefingOpen(false);
    notify("Executive daily briefing exported and recorded.");
  }

  return (
    <WorkspacePage
      eyebrow="Pacific Motor Group · Executive Operations"
      title="Executive Pulse"
      description="Live dealership operating signals, cross-department exceptions, and executive decision queues."
      action={
        <button type="button" className="workspace-button workspace-button--dark" onClick={() => setBriefingOpen(true)}>
          <Sparkles size={16} /> Prepare Daily Briefing
        </button>
      }
    >
      <div className="executive-metrics-grid">
        <MetricCard metric={{ label: "Group Revenue MTD", value: "$48.7m", delta: "+7.4% vs operating plan", tone: "good" }} />
        <MetricCard metric={{ label: "Average Gross Margin", value: "18.6%", delta: "+0.8 pts vs target", tone: "good" }} />
        <MetricCard metric={{ label: "Workshop Bay Utilisation", value: "86%", delta: "12 customer approvals pending", tone: "warn" }} />
        <MetricCard metric={{ label: "Customer Promise Risk", value: "11", delta: "4 critical items needing action today", tone: "bad" }} />
      </div>

      <div className="overview-grid">
        <section className="workspace-card trend-card">
          <div className="card-heading">
            <div>
              <span>Revenue Trajectory</span>
              <strong>Actual Revenue vs Operating Plan (AUD Millions)</strong>
            </div>
            <button type="button" className="card-action-link" onClick={() => onNavigate("group")}>
              View Group P&amp;L <ArrowUpRight size={15} />
            </button>
          </div>
          <div className="trend-summary">
            <div>
              <strong>$7.8m</strong>
              <span>August Actual MTD</span>
            </div>
            <em>105.4% of Target</em>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={REVENUE_TREND} margin={{ top: 12, right: 12, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="executiveArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0d9488" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#0d9488" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(8,30,43,0.08)" vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#6e858f", fontSize: 12, fontWeight: 600 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#6e858f", fontSize: 12, fontWeight: 600 }} tickFormatter={(val) => `$${val}m`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`$${value}m AUD`, "Revenue"]} />
                <Area type="monotone" dataKey="plan" stroke="#94a7b0" strokeDasharray="4 4" fill="transparent" strokeWidth={2} name="Operating Plan" />
                <Area type="monotone" dataKey="actual" stroke="#0d9488" fill="url(#executiveArea)" strokeWidth={3} name="Actual Revenue" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="workspace-card exception-card">
          <div className="card-heading">
            <div>
              <span>Decision &amp; Risk Queue</span>
              <strong>4 Critical Items · 7 Watch List</strong>
            </div>
            <button type="button" className="card-action-link" onClick={() => onNavigate("group")}>
              All Exceptions
            </button>
          </div>
          <div className="exception-list">
            <button type="button" className="exception-row" onClick={() => onNavigate("service")}>
              <span className="exception-icon bad"><Wrench size={16} /></span>
              <div className="exception-text">
                <strong>Workshop Promise Risk</strong>
                <p>4 repair orders blocked needing parts or advisor contact</p>
              </div>
              <em className="exception-badge bad">Critical</em>
            </button>
            <button type="button" className="exception-row" onClick={() => onNavigate("inventory")}>
              <span className="exception-icon warn"><CarFront size={16} /></span>
              <div className="exception-text">
                <strong>OEM Delivery Movement</strong>
                <p>7 customers require delivery schedule notifications</p>
              </div>
              <em className="exception-badge warn">Today</em>
            </button>
            <button type="button" className="exception-row" onClick={() => onNavigate("usedcars")}>
              <span className="exception-icon warn"><Clock3 size={16} /></span>
              <div className="exception-text">
                <strong>Aged Pre-Owned Exposure</strong>
                <p>$640k of vehicle stock is above the 60-day threshold</p>
              </div>
              <em className="exception-badge warn">Review</em>
            </button>
            <button type="button" className="exception-row" onClick={() => onNavigate("finance")}>
              <span className="exception-icon good"><BadgeCheck size={16} /></span>
              <div className="exception-text">
                <strong>F&amp;I Performance Benchmark</strong>
                <p>Sydney Central 48.2% penetration eligible for group best practice</p>
              </div>
              <em className="exception-badge good">Share</em>
            </button>
          </div>
        </section>
      </div>

      <div className="overview-lower-grid">
        <section className="workspace-card flow-card">
          <div className="card-heading">
            <div>
              <span>Connected Dealership Flow</span>
              <strong>Real-Time Pipeline Across All 12 Branches</strong>
            </div>
            <span className="live-pill"><i /> Live Operations</span>
          </div>
          <div className="flow-stages">
            {[
              { icon: Users, label: "New Enquiries", value: "84", meta: "8m avg response SLA" },
              { icon: TrendingUp, label: "Active Deals", value: "126", meta: "$8.4m open pipeline" },
              { icon: CarFront, label: "Deliveries Due", value: "31", meta: "7 at-risk orders" },
              { icon: Wrench, label: "Workshop ROs", value: "72", meta: "86% bay utilisation" },
              { icon: DollarSign, label: "Settlements", value: "$1.2m", meta: "98.7% matched today" },
            ].map(({ icon: Icon, label, value, meta }, index) => (
              <div key={label} className="flow-stage">
                <span className="flow-stage-icon"><Icon size={20} /></span>
                <div className="flow-stage-content">
                  <em>Stage 0{index + 1}</em>
                  <strong>{value}</strong>
                  <p>{label}</p>
                  <small>{meta}</small>
                </div>
                {index < 4 && <ChevronRight size={18} className="flow-stage-arrow" />}
              </div>
            ))}
          </div>
        </section>

        <section className="workspace-card agenda-card">
          <div className="card-heading">
            <div>
              <span>Leadership Agenda</span>
              <strong>Key Operating Stand-ups Today</strong>
            </div>
            <CalendarClock size={20} />
          </div>
          <div className="agenda-items">
            <div className="agenda-item">
              <time>10:30</time>
              <div className="agenda-item-body">
                <strong>Delivery &amp; Fulfilment Risk Stand-up</strong>
                <span>Sales · Inventory Logistics · F&amp;I</span>
              </div>
            </div>
            <div className="agenda-item">
              <time>13:00</time>
              <div className="agenda-item-body">
                <strong>Workshop Capacity &amp; Parts Allocation</strong>
                <span>Fixed Operations · Parts Warehouse</span>
              </div>
            </div>
            <div className="agenda-item">
              <time>16:15</time>
              <div className="agenda-item-body">
                <strong>Group Trading Pulse &amp; Month-End Pace</strong>
                <span>All 12 Branch General Managers</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {briefingOpen && (
        <WorkflowModal
          title="Executive Daily Leadership Briefing"
          eyebrow="Generated from live DMS telemetry"
          completeLabel="Export briefing text"
          onClose={() => setBriefingOpen(false)}
          onComplete={downloadBriefing}
        >
          <div className="briefing-sheet">
            <header>
              <span>Pacific Motor Group · 21 August 2026</span>
              <strong>Five Key Operating Decisions for Today</strong>
            </header>
            <ol>
              <li>
                <b>01</b>
                <div>
                  <strong>Protect four customer promises before 11:00</strong>
                  <p>Workshop exceptions in Bay 04 and Bay 06 need assigned technician owners.</p>
                </div>
                <em className="tone-bad">Critical</em>
              </li>
              <li>
                <b>02</b>
                <div>
                  <strong>Notify seven vehicle delivery customers</strong>
                  <p>OEM shipping schedules updated overnight; approved communication templates prepared.</p>
                </div>
                <em className="tone-warn">Today</em>
              </li>
              <li>
                <b>03</b>
                <div>
                  <strong>Reprice aged pre-owned vehicle stock</strong>
                  <p>$640k of inventory has exceeded the 60-day holding threshold at North Shore.</p>
                </div>
                <em className="tone-warn">Review</em>
              </li>
            </ol>
            <div className="briefing-actions">
              <button
                type="button"
                className="button button--light"
                onClick={() => {
                  navigator.clipboard?.writeText(briefingText);
                  notify("Briefing copied to clipboard.");
                }}
              >
                <Copy size={15} /> Copy Summary Text
              </button>
              <a
                href={`mailto:olivia.lawson@prakashinfotech.com?subject=AutoAxis Executive Briefing&body=${encodeURIComponent(briefingText)}`}
                className="button button--light"
              >
                <Mail size={15} /> Email Briefing
              </a>
            </div>
            <footer>AutoAxis Dealership Management System · Designed by Prakash Infotech</footer>
          </div>
        </WorkflowModal>
      )}

      {toast && <Toast message={toast} />}
    </WorkspacePage>
  );
}

export function DomainView({ view }: { view: Exclude<DashView, "overview" | "customers" | "vehicles"> }) {
  const config = DOMAIN_CONFIG[view];
  const [selected, setSelected] = useState(0);
  const [modal, setModal] = useState(false);
  const [filtered, setFiltered] = useState(false);
  const [toast, setToast] = useState("");
  const [studioTab, setStudioTab] = useState(0);
  const [studioRecord, setStudioRecord] = useState(-1);
  const studio = OPERATING_STUDIOS[view];
  const activeStudioTab = studio?.tabs[studioTab];

  useEffect(() => {
    setStudioTab(0);
    setStudioRecord(-1);
    setSelected(0);
  }, [view]);

  const steps: Record<typeof view, string[]> = {
    sales: ["Enquiry", "Qualify", "Test drive", "Quote", "F&I", "Delivery"],
    service: ["Booking", "Check-in", "Diagnose", "Approve", "Repair", "Handover"],
    parts: ["Request", "VIN fit", "Reserve", "Pick", "Issue", "Replenish"],
    finance: ["KYC", "Compare", "Approve", "Insure", "Contract", "Settle"],
    marketing: ["Audience", "Consent", "Channel", "Launch", "Attribute", "Retain"],
    usedcars: ["Acquire", "Appraise", "Inspect", "Recondition", "Price", "Publish"],
    inventory: ["Order", "Allocate", "Transit", "Receive", "PDI", "Deliver"],
    branch: ["Compare", "Drill down", "Assign", "Recover", "Track", "Brief"],
    group: ["Compare", "Signal", "Drill down", "Assign", "Track", "Brief"],
    workforce: ["Plan", "Assign", "Roster", "Deliver", "Measure", "Coach"],
  };

  function complete(message: string) {
    setModal(false);
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  function exportQueue() {
    const lines = ["record,status,detail", ...config.queue.map((item) => `"${item.primary}","${item.status}","${item.meta}"`)];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${view}-work-queue.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    complete(`${config.title} work queue exported.`);
  }

  return (
    <WorkspacePage
      eyebrow={config.eyebrow}
      title={config.title}
      description={config.description}
      action={
        <button
          type="button"
          className="workspace-button workspace-button--dark"
          onClick={() => {
            setStudioRecord(-1);
            setModal(true);
          }}
        >
          {config.action} <ArrowRight size={15} />
        </button>
      }
    >
      <div className="executive-metrics-grid">
        {config.metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </div>

      {/* Domain Operating Studio Cockpit */}
      {studio && activeStudioTab && (
        <section className="workspace-card operating-studio">
          <header className="studio-header">
            <div>
              <span className="studio-eyebrow">Operating Cockpit</span>
              <h3 className="studio-title">{studio.title}</h3>
            </div>
            <span className="studio-badge"><Sparkles size={13} /> Connected Workflow</span>
          </header>

          <nav className="studio-tabs-nav" aria-label={`${studio.title} workflows`}>
            {studio.tabs.map((item, index) => (
              <button
                type="button"
                className={`studio-tab-item ${studioTab === index ? "active" : ""}`}
                key={item.label}
                onClick={() => {
                  setStudioTab(index);
                  setStudioRecord(-1);
                }}
              >
                <strong>{item.label}</strong>
                <small>{item.coverage.length} controls</small>
              </button>
            ))}
          </nav>

          <div className="studio-summary-bar">
            <div className="studio-summary-info">
              <span className="summary-tag">{activeStudioTab.label}</span>
              <p className="summary-desc">{activeStudioTab.description}</p>
            </div>
            <button
              type="button"
              className="button button--signal studio-action-btn"
              onClick={() => {
                setStudioRecord(-1);
                setModal(true);
              }}
            >
              {activeStudioTab.action} <ArrowRight size={15} />
            </button>
          </div>

          <div className="studio-coverage-strip">
            <span className="coverage-label">Workflow Capabilities:</span>
            {activeStudioTab.coverage.map((item) => (
              <span key={item} className="coverage-pill">
                <CheckCircle2 size={13} />
                {item}
              </span>
            ))}
          </div>

          <div className="studio-records-list">
            {activeStudioTab.records.map((record, index) => (
              <button
                type="button"
                key={record.name}
                className="studio-record-row"
                onClick={() => {
                  setStudioRecord(index);
                  setModal(true);
                }}
              >
                <i className="record-index">{String(index + 1).padStart(2, "0")}</i>
                <div className="record-meta-info">
                  <strong>{record.name}</strong>
                  <span>{record.meta}</span>
                </div>
                <em className="record-status-tag">{record.status}</em>
                <ArrowRight size={16} className="record-arrow" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Connected Workflow Lane */}
      <section className="workspace-card workflow-lane">
        <div className="card-heading">
          <div>
            <span>End-to-End Accountable Process</span>
            <strong>One Shared Record Through Every Departmental Handoff</strong>
          </div>
          <span className="live-pill"><i /> Active Flow</span>
        </div>
        <div className="workflow-steps-track">
          {steps[view].map((step, index) => (
            <button
              type="button"
              key={step}
              className={`workflow-step-btn ${index <= selected ? "active" : ""}`}
              onClick={() => setSelected(index)}
            >
              <i className="step-num">{index + 1}</i>
              <span>{step}</span>
              {index < steps[view].length - 1 && <ChevronRight size={15} className="step-arrow" />}
            </button>
          ))}
        </div>
      </section>

      {/* Work Queue & AutoAxis Signal Grid */}
      <div className="domain-work-grid">
        <section className="workspace-card queue-card">
          <div className="card-heading">
            <div>
              <span>{config.queueTitle}</span>
              <strong>{filtered ? "Critical and high-priority items only" : "Prioritised by customer and profit impact"}</strong>
            </div>
            <div className="queue-tools">
              <button
                type="button"
                className={`queue-filter-btn ${filtered ? "active" : ""}`}
                onClick={() => setFiltered((value) => !value)}
              >
                <Filter size={14} /> Filter
              </button>
              <button type="button" className="queue-export-btn" onClick={exportQueue}>
                <Download size={14} /> Export CSV
              </button>
            </div>
          </div>
          <div className="work-queue">
            {config.queue
              .filter((item) => !filtered || item.tone !== "good")
              .map((item, index) => (
                <button
                  type="button"
                  key={item.primary}
                  className={`work-queue-item ${selected === index ? "selected" : ""}`}
                  onClick={() => setSelected(index)}
                >
                  <span className={`queue-signal-icon tone-bg-${item.tone}`}>
                    <QueueIcon tone={item.tone} />
                  </span>
                  <div className="queue-item-info">
                    <strong>{item.primary}</strong>
                    <p>{item.secondary}</p>
                  </div>
                  <span className="queue-meta-text">{item.meta}</span>
                  <em className={`queue-status-badge tone-${item.tone}`}>{item.status}</em>
                  <ArrowRight size={15} className="queue-item-arrow" />
                </button>
              ))}
          </div>
        </section>

        <aside className="insight-card">
          <span className="insight-card-eyebrow">
            <Lightbulb size={16} /> AutoAxis Intelligent Signal
          </span>
          <h4 className="insight-card-title">{config.insightTitle}</h4>
          <p className="insight-card-text">{config.insight}</p>
          <button type="button" className="insight-action-button" onClick={() => setModal(true)}>
            Start Recommended Action <ArrowRight size={15} />
          </button>
        </aside>
      </div>

      <div className="domain-lower-grid">
        <section className="workspace-card activity-card">
          <div className="card-heading">
            <div>
              <span>Operational Cadence</span>
              <strong>Hourly Activity Profile Today</strong>
            </div>
            <BarChart3 size={18} />
          </div>
          <div className="activity-bars">
            {[72, 48, 88, 64, 81, 56, 92, 76, 68, 84, 61, 78].map((value, index) => (
              <i key={index} style={{ height: `${value}%` }} className={index === 10 ? "warn" : ""} />
            ))}
          </div>
          <div className="activity-axis">
            <span>08:00</span>
            <span>12:00</span>
            <span>16:00</span>
            <span>20:00</span>
          </div>
        </section>

        <section className="workspace-card focus-card">
          <div className="card-heading">
            <div>
              <span>Control &amp; Governance Checks</span>
              <strong>Shift Readiness Status</strong>
            </div>
            <Target size={18} />
          </div>
          <div className="focus-check-item">
            <CheckCircle2 size={18} className="text-teal" />
            <div>
              <strong>Accountable Owners Assigned</strong>
              <span>All critical work items in this workspace have assigned owners</span>
            </div>
          </div>
          <div className="focus-check-item">
            <CheckCircle2 size={18} className="text-teal" />
            <div>
              <strong>Customer Notification SLAs</strong>
              <span>Automated SMS and manual WhatsApp contacts are within targets</span>
            </div>
          </div>
          <div className="focus-check-item focus-check-item--alert">
            <AlertTriangle size={18} className="text-amber" />
            <div>
              <strong>One Threshold Warning</strong>
              <span>Review the flagged queue items before shift close</span>
            </div>
          </div>
        </section>
      </div>

      {modal && (
        <WorkflowModal
          title={activeStudioTab?.action ?? config.action}
          eyebrow={`${config.title} · Connected Workflow`}
          onClose={() => setModal(false)}
          onComplete={() => complete(`${activeStudioTab?.action ?? config.action} saved and assigned to work queue.`)}
        >
          <div className="workflow-progress">
            <b className="active">1. Context</b>
            <i />
            <b>2. Details</b>
            <i />
            <b>3. Review</b>
          </div>
          <div className="selected-context">
            <span>Linked Record Context</span>
            <strong>{studioRecord >= 0 ? activeStudioTab?.records[studioRecord]?.name : config.queue[selected]?.primary ?? config.title}</strong>
            <p>{studioRecord >= 0 ? activeStudioTab?.records[studioRecord]?.meta : config.queue[selected]?.secondary ?? config.description}</p>
          </div>
          <div className="workflow-form-grid">
            <label>
              <span>Accountable Owner</span>
              <input defaultValue={view === "workforce" ? "Sarah Cole · People & Culture" : "Sarah Cole"} />
            </label>
            <label>
              <span>Target Completion</span>
              <input defaultValue="Today · 16:00" />
            </label>
            <label>
              <span>{view === "inventory" || view === "usedcars" ? "Vehicle / VIN" : view === "workforce" ? "Team / Branch" : "Customer Channel"}</span>
              <input defaultValue={view === "inventory" || view === "usedcars" ? "Linked from selected record" : view === "workforce" ? "Sydney Central" : "Email + WhatsApp"} />
            </label>
            <label>
              <span>Next Operational Stage</span>
              <input defaultValue={studioRecord >= 0 ? activeStudioTab?.records[studioRecord]?.status : steps[view][Math.min(selected + 1, steps[view].length - 1)]} />
            </label>
          </div>
          <div className="workflow-callout">
            <CheckCircle2 size={18} />
            <div>
              <strong>Shared Record Integrity Maintained</strong>
              <p>Customer, vehicle, team member, documents, and financial impact remain synchronized across all workspaces.</p>
            </div>
          </div>
        </WorkflowModal>
      )}

      {toast && <Toast message={toast} />}
    </WorkspacePage>
  );
}

function QueueIcon({ tone }: { tone: "good" | "warn" | "bad" | "neutral" }) {
  if (tone === "good") return <CheckCircle2 size={16} />;
  if (tone === "bad") return <AlertTriangle size={16} />;
  if (tone === "warn") return <Clock3 size={16} />;
  return <Gauge size={16} />;
}
