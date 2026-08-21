import { AlertTriangle, ArrowRight, ArrowUpRight, BadgeCheck, BarChart3, CalendarClock, CarFront, CheckCircle2, Clock3, Copy, DollarSign, Download, Filter, Gauge, Lightbulb, Mail, Sparkles, Target, TrendingUp, Users, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DOMAIN_CONFIG, REVENUE_TREND } from "../data";
import type { DashView, DomainConfig } from "../types";
import { Toast, WorkflowModal, WorkspacePage } from "./RecordViews";

function MetricCard({ metric }: { metric: DomainConfig["metrics"][number] }) {
  return (
    <div className="metric-card">
      <span>{metric.label}</span>
      <strong>{metric.value}</strong>
      <em className={`tone-${metric.tone ?? "neutral"}`}>{metric.delta}</em>
    </div>
  );
}

const tooltipStyle = { background: "#102c3e", border: "1px solid rgba(255,255,255,.1)", borderRadius: "10px", color: "#f5f7f2", fontSize: 12 };

type Studio = { title: string; tabs: Array<{ label: string; description: string; action: string; coverage: string[]; records: Array<{ name: string; meta: string; status: string }> }> };

const OPERATING_STUDIOS: Partial<Record<DashView, Studio>> = {
  sales: { title: "New vehicle retail desk", tabs: [
    { label: "Enquiry & pipeline", description: "Capture, assign and qualify every lead with response ownership and a visible next step.", action: "Capture enquiry", coverage: ["Lead capture", "Assignment", "Pipeline", "Availability"], records: [{ name: "Ava Nguyen · Audi Q7", meta: "Web enquiry · 6m response", status: "Qualified" }, { name: "Rohan Mehta · Ranger", meta: "Trade-in · Sarah Cole", status: "Follow-up" }, { name: "Mia Wilson · Ioniq 5", meta: "OEM campaign · unassigned", status: "New" }] },
    { label: "Configure & drive", description: "Match live stock, configure model and variant, and control test-drive availability and outcomes.", action: "Schedule test drive", coverage: ["Vehicle match", "Variant selection", "Test drive", "Accessories"], records: [{ name: "Audi Q7 55 TFSI · Glacier White", meta: "Demo A-07 · 14:30", status: "Confirmed" }, { name: "BMW X5 xDrive40i · M Sport", meta: "Incoming · 26 Aug", status: "Configure" }, { name: "Ford Ranger Wildtrak · V6", meta: "Yard C-12 · available", status: "Ready" }] },
    { label: "Quote, KYC & F&I", description: "Build a controlled deal from quotation through identity, finance, insurance, accessories and booking.", action: "Build quotation", coverage: ["Quotation", "KYC", "Finance", "Insurance", "Booking", "Invoice"], records: [{ name: "Q-44128 · Ava Nguyen", meta: "$148,900 · 2 lender offers", status: "KYC due" }, { name: "Q-44119 · James Hartley", meta: "$127,450 · trade linked", status: "Approved" }, { name: "Q-44131 · Rohan Mehta", meta: "$78,450 · insurance pending", status: "Review" }] },
    { label: "Register & deliver", description: "Control registration, PDI, delivery checklist, customer handover and post-delivery follow-up.", action: "Open delivery", coverage: ["Registration", "PDI", "Checklist", "Handover", "Follow-up"], records: [{ name: "D-10982 · James Hartley", meta: "BMW X5 · 23 Aug 10:00", status: "Ready" }, { name: "D-10991 · Mia Wilson", meta: "Ioniq 5 · registration due", status: "At risk" }, { name: "D-10975 · Emily Chen", meta: "XC60 · follow-up tomorrow", status: "Delivered" }] },
  ]},
  usedcars: { title: "Pre-owned vehicle centre", tabs: [
    { label: "Acquire & appraise", description: "Source trade-ins and direct purchases with condition evidence, market comparables and a controlled offer.", action: "Start appraisal", coverage: ["Acquisition", "Trade-in", "Appraisal", "Auto valuation", "Market comparison"], records: [{ name: "2022 BMW X5 · DMS-360", meta: "48,620 km · 8 comparables", status: "$78,200" }, { name: "2021 Volvo XC90 · U-30418", meta: "64,100 km · direct purchase", status: "$66,500" }, { name: "2023 Mazda CX-60 · U-30462", meta: "18,440 km · trade-in", status: "Inspect" }] },
    { label: "Inspect & recondition", description: "Move every unit through a 200-point inspection, photos, workshop preparation and recon cost control.", action: "Open inspection", coverage: ["200-point check", "Photos/video", "Workshop prep", "Refurbishment", "Recon cost"], records: [{ name: "U-30462 · Mazda CX-60", meta: "184/200 · photos booked", status: "92%" }, { name: "U-30418 · Volvo XC90", meta: "$2,840 est. · $2,610 actual", status: "QC" }, { name: "U-30471 · Audi A4", meta: "Tyres + cosmetic repair", status: "Workshop" }] },
    { label: "Price & stock", description: "Set retail and wholesale positions using aging, margin, location and expected-versus-actual recon economics.", action: "Set retail price", coverage: ["Stocking", "Pricing", "Aging", "Location", "Profitability", "Margin"], records: [{ name: "U-30418 · Volvo XC90", meta: "64 days · 7% above market", status: "Reprice" }, { name: "U-30398 · BMW 330i", meta: "22 days · 9.8% margin", status: "On target" }, { name: "U-30462 · Mazda CX-60", meta: "2 days · $8,420 expected", status: "Price" }] },
    { label: "Publish & dispose", description: "Publish approved merchandising or route aged and non-retail units to a controlled wholesale auction.", action: "Publish vehicle", coverage: ["Marketplace publish", "Auction", "Reserve", "Buy/sell margin", "Actual resale"], records: [{ name: "U-30462 · Mazda CX-60", meta: "6 channels · 24 approved images", status: "Publish" }, { name: "U-30280 · Mercedes GLC", meta: "Auction reserve $48,500", status: "Approve" }, { name: "U-30398 · BMW 330i", meta: "$48,400 sold · $4,710 margin", status: "Sold" }] },
  ]},
  finance: { title: "Finance & insurance control", tabs: [
    { label: "Applications", description: "Compare lender offers, manage KYC evidence, conditions, contracts and settlement from the deal record.", action: "New application", coverage: ["KYC", "Lender compare", "Conditions", "Contract", "Settlement"], records: [{ name: "FI-62014 · Ava Nguyen", meta: "$112,000 · income evidence due", status: "Hold" }, { name: "FI-62018 · Rohan Mehta", meta: "2 offers · best 7.14%", status: "Compare" }] },
    { label: "Insurance", description: "Quote, bind and track policies with vehicle, customer, finance and delivery context attached.", action: "Create insurance quote", coverage: ["Policy tracking", "Quotation", "Insurer connection", "Workshop link"], records: [{ name: "INS-8841 · Audi Q7", meta: "3 quotes · delivery 23 Aug", status: "Select" }, { name: "INS-8829 · BMW X5", meta: "Comprehensive · active", status: "Bound" }] },
    { label: "Claims & renewals", description: "Control accident intake, claim progress, repair-order linkage and proactive renewal activity.", action: "Register claim", coverage: ["Renewal alert", "Claims", "Accident", "Repair order", "Customer update"], records: [{ name: "CLM-1844 · Volvo XC60", meta: "RO-18492 · assessor pending", status: "Open" }, { name: "RNW-9921 · BMW X5", meta: "Renews 14 Nov · contact consent", status: "Scheduled" }] },
    { label: "Commission", description: "Reconcile product attachment, insurer and lender commission against settled deals and reversals.", action: "Run reconciliation", coverage: ["Commission", "Product attachment", "Reversal", "Audit"], records: [{ name: "August commission run", meta: "31 deals · $84,220 gross", status: "Ready" }, { name: "REV-114 · cancelled policy", meta: "$1,240 reversal", status: "Review" }] },
  ]},
  inventory: { title: "Vehicle stock control", tabs: [
    { label: "Stock book", description: "One VIN-led book for new, used, incoming, allocated, reserved and available vehicles.", action: "Add stock vehicle", coverage: ["New stock", "Used stock", "VIN", "Incoming", "Reserved", "Valuation"], records: [{ name: "WBA11EU09R9Y40122 · BMW iX1", meta: "Incoming · allocated", status: "26 Aug" }, { name: "U-30462 · Mazda CX-60", meta: "Used · Sydney Central", status: "Available" }] },
    { label: "Yard & transfers", description: "Locate units by yard position and move stock between branches with accountable handover.", action: "Create transfer", coverage: ["Yard", "Location", "Transfer", "Branch", "Aging"], records: [{ name: "Ioniq 5 · Yard C-12", meta: "PDI parts reserved", status: "Located" }, { name: "9 SUVs · North Shore", meta: "Transfer to demand-matched branches", status: "Proposed" }] },
    { label: "Demo & test drive", description: "Control demonstrator assignment, availability, bookings, mileage and return condition.", action: "Assign demo vehicle", coverage: ["Demo vehicles", "Test-drive fleet", "Availability", "Mileage", "Condition"], records: [{ name: "Audi Q7 · Demo A-07", meta: "Test drive 14:30 · Ava Nguyen", status: "Booked" }, { name: "BMW i4 · Demo E-02", meta: "Return inspection due 17:00", status: "Out" }] },
    { label: "PDI & delivery", description: "Move incoming vehicles through receipt, PDI, registration dependencies and customer delivery status.", action: "Open PDI", coverage: ["Receipt", "PDI status", "Registration", "Delivery", "Aging alert"], records: [{ name: "BMW iX1 · PDI-22014", meta: "6/8 checks · software update", status: "In progress" }, { name: "Golf R · PDI-22008", meta: "Deal S-10982 · all clear", status: "Ready" }] },
  ]},
  workforce: { title: "Dealership workforce", tabs: [
    { label: "Team & attendance", description: "Role-based team directory with branch, roster, attendance and current workload.", action: "Add team member", coverage: ["Sales", "Advisors", "Technicians", "Parts", "Finance", "Attendance"], records: [{ name: "Sarah Cole · Sales manager", meta: "Sydney Central · present", status: "8 open" }, { name: "Noah Patel · Technician", meta: "EV certified · Bay 06", status: "Productive" }] },
    { label: "Targets & incentives", description: "Track individual and team targets, incentive attainment and auditable commission inputs.", action: "Set target", coverage: ["Targets", "Incentives", "Commission", "Attainment"], records: [{ name: "Sales team · August", meta: "94% revenue · 102% gross", status: "On track" }, { name: "Service advisors", meta: "91% labour recovery", status: "Coach" }] },
    { label: "Skills & training", description: "Maintain skill matrices, certification expiry and role-specific training plans.", action: "Assign training", coverage: ["Skill matrix", "Training", "Certification", "Succession"], records: [{ name: "EV safety certification", meta: "5 technicians · due 4 Sep", status: "Assign" }, { name: "F&I compliance annual", meta: "12 team members · 83% complete", status: "Due" }] },
    { label: "Productivity", description: "Connect output and quality to actual leads, deals, repair orders and parts work.", action: "Open coaching plan", coverage: ["Productivity", "Performance", "Quality", "Capacity"], records: [{ name: "Workshop team", meta: "91.4% productive · 2.1% comeback", status: "Strong" }, { name: "Lead response cohort", meta: "11m avg · target 10m", status: "Coach" }] },
  ]},
};

export function OverviewView({ onNavigate }: { onNavigate: (view: DashView) => void }) {
  const [toast, setToast] = useState("");
  const [briefingOpen, setBriefingOpen] = useState(false);
  const briefingText = "AutoAxis daily briefing — Pacific Motor Group\n\n1. Revenue is 7.4% ahead of plan.\n2. Four workshop promises need intervention before 11:00.\n3. Seven customers need OEM delivery updates.\n4. $640k of used inventory is above 60 days.\n5. Sydney Central F&I performance is a group best-practice candidate.\n\nPrepared in the Prakash Infotech demonstration workspace.";
  function notify(message: string) { setToast(message); window.setTimeout(() => setToast(""), 2600); }
  function downloadBriefing() { const url = URL.createObjectURL(new Blob([briefingText], { type: "text/plain" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "autoaxis-daily-briefing.txt"; anchor.click(); URL.revokeObjectURL(url); setBriefingOpen(false); notify("Daily briefing downloaded and recorded."); }
  return (
    <WorkspacePage
      eyebrow="Pacific Motor Group · 21 August 2026"
      title="Executive pulse"
      description="The operating signals, exceptions, and opportunities that need a decision today."
      action={<button type="button" className="workspace-button workspace-button--dark" onClick={() => setBriefingOpen(true)}><Sparkles size={15} /> Prepare daily briefing</button>}
    >
      <div className="executive-metrics">
        <MetricCard metric={{ label: "Group revenue", value: "$48.7m", delta: "+7.4% vs plan", tone: "good" }} />
        <MetricCard metric={{ label: "Gross margin", value: "18.6%", delta: "+0.8 pts vs plan", tone: "good" }} />
        <MetricCard metric={{ label: "Workshop utilisation", value: "86%", delta: "12 approvals waiting", tone: "warn" }} />
        <MetricCard metric={{ label: "Customer promise risk", value: "11", delta: "4 critical today", tone: "bad" }} />
      </div>

      <div className="overview-grid">
        <section className="workspace-card trend-card">
          <div className="card-heading"><div><span>Revenue trajectory</span><strong>Actual vs operating plan</strong></div><button type="button" onClick={() => onNavigate("group")}>View P&amp;L <ArrowUpRight size={15} /></button></div>
          <div className="trend-summary"><strong>$7.8m</strong><span>August actual</span><em>105.4% of plan</em></div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={REVENUE_TREND} margin={{ top: 12, right: 6, left: -18, bottom: 0 }}>
                <defs><linearGradient id="executiveArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#20bcae" stopOpacity={0.3} /><stop offset="100%" stopColor="#20bcae" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid stroke="rgba(8,30,43,.08)" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#6e7e87", fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#6e7e87", fontSize: 11 }} tickFormatter={(value) => `$${value}m`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`$${value}m`]} />
                <Area type="monotone" dataKey="plan" stroke="#97a5ad" strokeDasharray="5 6" fill="transparent" strokeWidth={1.5} />
                <Area type="monotone" dataKey="actual" stroke="#0d8f86" fill="url(#executiveArea)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="workspace-card exception-card">
          <div className="card-heading"><div><span>Decision queue</span><strong>4 critical · 7 watch</strong></div><button type="button" onClick={() => onNavigate("group")}>All exceptions</button></div>
          <div className="exception-list">
            <button type="button" onClick={() => onNavigate("service")}><span className="exception-icon bad"><Wrench /></span><div><strong>Workshop promise risk</strong><p>4 repair orders need intervention</p></div><em>Critical</em></button>
            <button type="button" onClick={() => onNavigate("inventory")}><span className="exception-icon warn"><CarFront /></span><div><strong>OEM delivery movement</strong><p>7 customers require updates</p></div><em>Today</em></button>
            <button type="button" onClick={() => onNavigate("usedcars")}><span className="exception-icon warn"><Clock3 /></span><div><strong>Aged stock exposure</strong><p>$640k above 60 days</p></div><em>Review</em></button>
            <button type="button" onClick={() => onNavigate("finance")}><span className="exception-icon good"><BadgeCheck /></span><div><strong>F&amp;I performance</strong><p>Best-practice candidate</p></div><em>Share</em></button>
          </div>
        </section>
      </div>

      <div className="overview-lower-grid">
        <section className="workspace-card flow-card">
          <div className="card-heading"><div><span>Dealership flow</span><strong>Today across every department</strong></div><span className="live-pill"><i /> Live</span></div>
          <div className="flow-stages">
            {[
              { icon: Users, label: "New enquiries", value: "84", meta: "8m avg response" },
              { icon: TrendingUp, label: "Active deals", value: "126", meta: "$8.4m pipeline" },
              { icon: CarFront, label: "Deliveries", value: "31", meta: "7 at risk" },
              { icon: Wrench, label: "Repair orders", value: "72", meta: "86% utilised" },
              { icon: DollarSign, label: "Payments", value: "$1.2m", meta: "98.7% matched" },
            ].map(({ icon: Icon, label, value, meta }, index) => <div key={label} className="flow-stage"><span><Icon /></span><div><em>0{index + 1}</em><strong>{value}</strong><p>{label}</p><small>{meta}</small></div>{index < 4 && <ArrowRight />}</div>)}
          </div>
        </section>
        <section className="workspace-card agenda-card">
          <div className="card-heading"><div><span>Leadership agenda</span><strong>Next operating moments</strong></div><CalendarClock size={18} /></div>
          <div><time>10:30</time><p><strong>Delivery risk stand-up</strong><span>Sales · Inventory · F&amp;I</span></p></div>
          <div><time>13:00</time><p><strong>Workshop load review</strong><span>Service · Parts</span></p></div>
          <div><time>16:15</time><p><strong>Group trading pulse</strong><span>All branch leaders</span></p></div>
        </section>
      </div>
      {briefingOpen && <WorkflowModal title="Daily leadership briefing" eyebrow="Generated from current operating signals" completeLabel="Download briefing" onClose={() => setBriefingOpen(false)} onComplete={downloadBriefing}><div className="briefing-sheet"><header><span>Pacific Motor Group · 21 August 2026</span><strong>Five decisions for today</strong></header><ol><li><b>01</b><div><strong>Protect four customer promises</strong><p>Workshop exceptions need owners before 11:00.</p></div><em>Critical</em></li><li><b>02</b><div><strong>Contact seven delivery customers</strong><p>OEM timing changed overnight; approved templates are ready.</p></div><em>Today</em></li><li><b>03</b><div><strong>Reprice aged used inventory</strong><p>$640k of stock is above the 60-day group threshold.</p></div><em>Review</em></li></ol><div className="briefing-actions"><button type="button" onClick={() => { navigator.clipboard?.writeText(briefingText); notify("Briefing copied to clipboard."); }}><Copy />Copy summary</button><a href={`mailto:olivia.lawson@prakashinfotech.com?subject=AutoAxis daily briefing&body=${encodeURIComponent(briefingText)}`}><Mail />Email briefing</a></div><footer>Prepared in AutoAxis · Built by Prakash Infotech</footer></div></WorkflowModal>}
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
  useEffect(() => { setStudioTab(0); setStudioRecord(-1); setSelected(0); }, [view]);
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
  function complete(message: string) { setModal(false); setToast(message); window.setTimeout(() => setToast(""), 2600); }
  function exportQueue() {
    const lines = ["record,status,detail", ...config.queue.map((item) => `"${item.primary}","${item.status}","${item.meta}"`)];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${view}-work-queue.csv`; anchor.click(); URL.revokeObjectURL(url); complete(`${config.title} work queue exported.`);
  }
  return (
    <WorkspacePage eyebrow={config.eyebrow} title={config.title} description={config.description} action={<button type="button" className="workspace-button workspace-button--dark" onClick={() => { setStudioRecord(-1); setModal(true); }}>{config.action} <ArrowRight size={15} /></button>}>
      <div className="executive-metrics">{config.metrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}</div>
      {studio && activeStudioTab && <section className="workspace-card operating-studio"><header><div><span>Operating cockpit</span><strong>{studio.title}</strong></div><em>Connected demonstration</em></header><nav aria-label={`${studio.title} workflows`}>{studio.tabs.map((item, index) => <button type="button" className={studioTab === index ? "active" : ""} key={item.label} onClick={() => { setStudioTab(index); setStudioRecord(-1); }}>{item.label}<small>{item.coverage.length} controls</small></button>)}</nav><div className="studio-summary"><div><span>{activeStudioTab.label}</span><strong>{activeStudioTab.description}</strong></div><button type="button" onClick={() => { setStudioRecord(-1); setModal(true); }}>{activeStudioTab.action}<ArrowRight /></button></div><div className="studio-coverage">{activeStudioTab.coverage.map((item) => <span key={item}><CheckCircle2 />{item}</span>)}</div><div className="studio-records">{activeStudioTab.records.map((record, index) => <button type="button" key={record.name} onClick={() => { setStudioRecord(index); setModal(true); }}><i>{String(index + 1).padStart(2,"0")}</i><div><strong>{record.name}</strong><span>{record.meta}</span></div><em>{record.status}</em><ArrowRight /></button>)}</div></section>}
      <section className="workspace-card workflow-lane"><div className="card-heading"><div><span>Connected workflow</span><strong>One record through every accountable handoff</strong></div><span className="live-pill"><i /> Demonstration</span></div><div>{steps[view].map((step, index) => <button type="button" key={step} className={index <= selected ? "active" : ""} onClick={() => setSelected(index)}><i>{index + 1}</i><span>{step}</span>{index < steps[view].length - 1 && <ArrowRight />}</button>)}</div></section>
      <div className="domain-work-grid">
        <section className="workspace-card queue-card">
          <div className="card-heading"><div><span>{config.queueTitle}</span><strong>{filtered ? "Critical and watch items only" : "Prioritised by customer and profit impact"}</strong></div><div className="queue-tools"><button type="button" className={filtered ? "active" : ""} onClick={() => setFiltered((value) => !value)}><Filter />Filter</button><button type="button" onClick={exportQueue}><Download />Export</button></div></div>
          <div className="work-queue">
            {config.queue.filter((item) => !filtered || item.tone !== "good").map((item, index) => (
              <button type="button" key={item.primary} className={selected === index ? "selected" : ""} onClick={() => setSelected(index)}>
                <span className={`queue-signal tone-bg-${item.tone}`}><QueueIcon tone={item.tone} /></span>
                <div><strong>{item.primary}</strong><p>{item.secondary}</p></div>
                <span className="queue-meta">{item.meta}</span>
                <em className={`queue-status tone-${item.tone}`}>{item.status}</em>
                <ArrowRight size={15} />
              </button>
            ))}
          </div>
        </section>
        <aside className="insight-card">
          <span><Lightbulb size={15} /> AutoAxis signal</span>
          <strong>{config.insightTitle}</strong>
          <p>{config.insight}</p>
          <button type="button" onClick={() => setModal(true)}>Start recommended action <ArrowRight size={14} /></button>
        </aside>
      </div>
      <div className="domain-lower-grid">
        <section className="workspace-card activity-card">
          <div className="card-heading"><div><span>Operational cadence</span><strong>Today's completion profile</strong></div><BarChart3 size={17} /></div>
          <div className="activity-bars">
            {[72, 48, 88, 64, 81, 56, 92, 76, 68, 84, 61, 78].map((value, index) => <i key={index} style={{ height: `${value}%` }} className={index === 10 ? "warn" : ""} />)}
          </div>
          <div className="activity-axis"><span>08:00</span><span>12:00</span><span>16:00</span><span>20:00</span></div>
        </section>
        <section className="workspace-card focus-card">
          <div className="card-heading"><div><span>Control checks</span><strong>Shift readiness</strong></div><Target size={17} /></div>
          <div><CheckCircle2 /><p><strong>Owners assigned</strong><span>All critical work has an accountable owner</span></p></div>
          <div><CheckCircle2 /><p><strong>Customer updates</strong><span>Automated and manual contacts are current</span></p></div>
          <div className="attention"><AlertTriangle /><p><strong>One threshold outside plan</strong><span>Review the highlighted queue before close</span></p></div>
        </section>
      </div>
      {modal && <WorkflowModal title={activeStudioTab?.action ?? config.action} eyebrow={`${config.title} · connected workflow`} onClose={() => setModal(false)} onComplete={() => complete(`${activeStudioTab?.action ?? config.action} saved and assigned to the work queue.`)}><div className="workflow-progress"><b className="active">1. Context</b><i /><b>2. Details</b><i /><b>3. Review</b></div><div className="selected-context"><span>Linked context</span><strong>{studioRecord >= 0 ? activeStudioTab?.records[studioRecord]?.name : config.queue[selected]?.primary ?? config.title}</strong><p>{studioRecord >= 0 ? activeStudioTab?.records[studioRecord]?.meta : config.queue[selected]?.secondary ?? config.description}</p></div><div className="workflow-form-grid"><label><span>Accountable owner</span><input defaultValue={view === "workforce" ? "People & Culture" : "Sarah Cole"} /></label><label><span>Due</span><input defaultValue="Today · 16:00" /></label><label><span>{view === "inventory" || view === "usedcars" ? "Vehicle / VIN" : view === "workforce" ? "Team / branch" : "Customer channel"}</span><input defaultValue={view === "inventory" || view === "usedcars" ? "Linked from selected record" : view === "workforce" ? "Sydney Central" : "Email + WhatsApp"} /></label><label><span>Next status</span><input defaultValue={studioRecord >= 0 ? activeStudioTab?.records[studioRecord]?.status : steps[view][Math.min(selected + 1, steps[view].length - 1)]} /></label></div><div className="workflow-callout"><CheckCircle2 /><div><strong>Shared record context retained</strong><p>Customer, vehicle, team, documents and financial impact remain linked through the workflow.</p></div></div></WorkflowModal>}
      {toast && <Toast message={toast} />}
    </WorkspacePage>
  );
}

function QueueIcon({ tone }: { tone: "good" | "warn" | "bad" | "neutral" }) {
  if (tone === "good") return <CheckCircle2 />;
  if (tone === "bad") return <AlertTriangle />;
  if (tone === "warn") return <Clock3 />;
  return <Gauge />;
}
