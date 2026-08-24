import {
  ArrowRight, CalendarDays, CarFront, CircleUserRound, Copy, Download, FileText, Gauge,
  Mail, MapPin, MessageCircle, Phone, Plus, Search, Share2, ShieldCheck, WalletCards,
  StickyNote, UserPlus, Wrench, X, ClipboardCheck, CreditCard, Edit3, ListChecks,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiGet, ApiError } from "../../lib/api";
import { Brand } from "../components/Brand";
import { CLIENT_DEMO_CUSTOMER, CLIENT_DEMO_VEHICLE } from "../data";
import type { Customer360, DashView, Vehicle360 } from "../types";
import { Toast, WorkflowModal, WorkspacePage } from "./WorkspacePrimitives";

type RecordViewProps = { onNavigate: (view: DashView, recordId?: string) => void; initialRecordId?: string; onRecordSelect: (recordId: string) => void };
type ModalState = null | "opportunity" | "portal" | "customer" | "note" | "vehicle" | "appraisal" | "auction" | "rental" | "documents" | "edit-customer" | "task" | "booking" | "payment";

const CUSTOMER_DIRECTORY: Array<{ id: string; name: string; mobile: string; email: string; segment: string; vehicle: string; value: number; next: string }> = [
  { id: "30000000-0000-0000-0000-000000000001", name: "James Hartley", mobile: "+61 412 345 678", email: "james.hartley@prakashinfotech.com", segment: "VIP", vehicle: "BMW X5 · DMS-360", value: 127450, next: "Ownership review" },
  { id: "30000000-0000-0000-0000-000000000002", name: "Ava Nguyen", mobile: "+61 417 220 184", email: "ava.nguyen@prakashinfotech.com", segment: "Prospect", vehicle: "Audi Q7 enquiry", value: 148900, next: "Finance documents" },
  { id: "30000000-0000-0000-0000-000000000003", name: "Rohan Mehta", mobile: "+61 409 518 230", email: "rohan.mehta@prakashinfotech.com", segment: "Service due", vehicle: "Ford Ranger · PMG-814", value: 78450, next: "Trade value expires" },
  { id: "30000000-0000-0000-0000-000000000004", name: "Emily Chen", mobile: "+61 421 620 775", email: "emily.chen@prakashinfotech.com", segment: "VIP", vehicle: "Volvo XC60 · ECX-620", value: 96800, next: "Service approval" },
  { id: "30000000-0000-0000-0000-000000000005", name: "Noah Williams", mobile: "+61 431 882 417", email: "noah.williams@prakashinfotech.com", segment: "Prospect", vehicle: "Toyota LandCruiser enquiry", value: 119990, next: "Test drive tomorrow" },
  { id: "30000000-0000-0000-0000-000000000006", name: "Mia Thompson", mobile: "+61 402 771 906", email: "mia.thompson@prakashinfotech.com", segment: "Service due", vehicle: "Mazda CX-5 · MIA-425", value: 53400, next: "60,000 km service" },
  { id: "30000000-0000-0000-0000-000000000007", name: "Liam Wilson", mobile: "+61 418 450 992", email: "liam.wilson@prakashinfotech.com", segment: "VIP", vehicle: "Mercedes GLC · LMW-882", value: 184250, next: "Insurance renewal" },
];

const VEHICLE_DIRECTORY = [
  { id: "40000000-0000-0000-0000-000000000001", registration: "DMS-360", vin: "WBAKS4C50J0Z12345", make: "BMW", model: "X5", year: 2024, owner: "James Hartley", status: "Customer owned", location: "Sydney Central", value: 109500, next: "Appraisal ready" },
  { id: "40000000-0000-0000-0000-000000000003", registration: "PMG-814", vin: "MPBUMFF50PX498814", make: "Ford", model: "Ranger", year: 2023, owner: "Rohan Mehta", status: "Customer owned", location: "North Shore", value: 67200, next: "Recall check" },
  { id: "40000000-0000-0000-0000-000000000002", registration: "ANQ-707", vin: "WAUZZZ4M5PD002204", make: "Audi", model: "Q7", year: 2025, owner: "Ava Nguyen", status: "Enquiry", location: "Sydney Central", value: 148900, next: "Finance review" },
  { id: "40000000-0000-0000-0000-000000000004", registration: "ECX-620", vin: "YV1UZBFV7R1120012", make: "Volvo", model: "XC60", year: 2024, owner: "Emily Chen", status: "Customer owned", location: "Sydney Central", value: 88900, next: "Booking at 14:30" },
  { id: "40000000-0000-0000-0000-000000000007", registration: "LMW-882", vin: "W1NKM4HB8RF987772", make: "Mercedes-Benz", model: "GLC", year: 2024, owner: "Liam Wilson", status: "Customer owned", location: "North Shore", value: 121400, next: "Insurance renewal" },
  { id: "40000000-0000-0000-0000-000000000006", registration: "MIA-425", vin: "JM0KF4WLA004771906", make: "Mazda", model: "CX-5", year: 2022, owner: "Mia Thompson", status: "Customer owned", location: "Parramatta", value: 53400, next: "Service due" },
];

const CUSTOMER_DEALS = [
  ["OP-2048", "BMW X5 ownership renewal", "$132,400", "Qualified", "Sarah Cole · Follow-up today"],
  ["S-10982", "2022 BMW X5 xDrive40i", "$127,450", "Delivered", "18 Jun 2022"],
];
const CUSTOMER_SERVICE = [
  ["RO-18506", "Scheduled maintenance + brake inspection", "18 Aug 2026", "$1,284", "Completed"],
  ["RO-17241", "Tyres, alignment and battery", "07 Feb 2026", "$2,116", "Completed"],
  ["BK-4208", "Ownership review + annual service", "12 Nov 2026", "—", "Booked"],
];
const CUSTOMER_DOCUMENTS = [
  ["Driver licence", "Identity", "Verified", "14 Aug 2026"], ["Purchase contract", "Sales", "Signed", "18 Jun 2022"],
  ["Finance payout authority", "Finance", "Awaiting signature", "20 Aug 2026"], ["Insurance policy", "Insurance", "Active", "14 Nov 2025"],
];
const VEHICLE_WORK = [
  ["RO-18506", "Annual service + brake inspection", "Closed", "18 Aug 2026", "$1,284"],
  ["INSP-1042", "200-point used vehicle inspection", "Ready", "Today", "$0"],
  ["RC-882", "Open recall campaign check", "Clear", "18 Aug 2026", "$0"],
  ["PDI-401", "Pre-delivery inspection", "Completed", "17 Jun 2022", "$420"],
];

function DataSourceBadge({ source }: { source: string }) {
  const connected = source === "postgresql";
  return <span className={`source-badge ${connected ? "source-badge--connected" : ""}`}><i />{connected ? "Neon live data" : "Demonstration data"}</span>;
}

function SearchState({ loading, error }: { loading: boolean; error: ApiError | null }) {
  if (loading) return <span className="record-search-state"><i className="loading-dot" />Searching connected records…</span>;
  if (error) return <span className="record-search-state record-search-state--error">{error.message}{error.requestId ? ` · ${error.requestId}` : ""}</span>;
  return <span className="record-search-state">Connected search · name, mobile, email, VIN, registration, make or model.</span>;
}

function Timeline({ items, filter }: { items: Array<{ occurredAt: string; type: string; summary: string }>; filter: string }) {
  const visible = filter === "All" ? items : items.filter((item) => item.type.toLowerCase().includes(filter.toLowerCase()));
  return <div className="record-timeline">{visible.length ? visible.map((item, index) => <div key={`${item.occurredAt}-${index}`} className="timeline-event"><i /><div><span>{new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(item.occurredAt))} · {item.type}</span><strong>{item.summary}</strong></div></div>) : <div className="timeline-empty">No activity in this category.</div>}</div>;
}

function ActionBar({ children }: { children: React.ReactNode }) {
  return <div className="record-action-bar">{children}</div>;
}

function OperationalTable({ columns, rows, onOpen }: { columns: string[]; rows: string[][]; onOpen?: (row: string[]) => void }) {
  const grid = { gridTemplateColumns: `repeat(${columns.length}, minmax(105px, 1fr))` };
  return <div className="operational-table"><div className="operational-table-head" style={grid}>{columns.map((column) => <span key={column}>{column}</span>)}</div>{rows.map((row) => <button type="button" style={grid} key={row[0]} onClick={() => onOpen?.(row)}>{row.map((value, index) => <span key={`${row[0]}-${columns[index]}`} className={index === 0 ? "primary" : index === columns.length - 1 ? "status" : ""}>{value}</span>)}<ArrowRight /></button>)}</div>;
}

function SectionToolbar({ title, detail, action, onAction }: { title: string; detail: string; action?: string; onAction?: () => void }) {
  return <div className="section-toolbar"><div><span>{title}</span><strong>{detail}</strong></div>{action && <button type="button" onClick={onAction}><Plus />{action}</button>}</div>;
}


function DemoFields({ kind, customerName = "James Hartley", vehicleLabel = "BMW X5 · DMS-360" }: { kind: "opportunity" | "vehicle" | "appraisal" | "auction" | "rental"; customerName?: string; vehicleLabel?: string }) {
  const definitions = {
    opportunity: [["Customer", customerName], ["Vehicle interest", vehicleLabel], ["Next step", "Ownership review"], ["Owner", "Sarah Cole"]],
    vehicle: [["Acquisition type", "New stock"], ["VIN", "WBA11EU09R9Y40122"], ["Branch", "Sydney Central"], ["Status", "Ordered / incoming"]],
    appraisal: [["Vehicle", vehicleLabel], ["Odometer", "48,620 km"], ["Condition", "Very good"], ["Trade estimate", "$78,200"]],
    auction: [["Vehicle", vehicleLabel], ["Channel", "Dealer wholesale"], ["Reserve", "$76,500"], ["Close", "26 Aug 2026 · 17:00"]],
    rental: [["Vehicle", vehicleLabel], ["Customer", customerName], ["Dates", "24–27 Aug 2026"], ["Rate", "$189 / day"]],
  }[kind];
  return <><div className="workflow-progress"><b className="active">1. Details</b><i /><b>2. Review</b><i /><b>3. Confirm</b></div><div className="workflow-form-grid">{definitions.map(([label, value]) => <label key={label}><span>{label}</span><input defaultValue={value} /></label>)}</div><div className="workflow-callout"><ShieldCheck /><div><strong>Connected context retained</strong><p>Customer, vehicle, branch and source are linked to the new workflow—no duplicate entry.</p></div></div></>;
}

function useRecordActions(recordName: string) {
  const [toast, setToast] = useState("");
  function notify(message: string) { setToast(message); window.setTimeout(() => setToast(""), 2600); }
  async function share() {
    const text = `AutoAxis demonstration summary · ${recordName}`;
    if (navigator.share) await navigator.share({ title: recordName, text }).catch(() => undefined);
    else await navigator.clipboard?.writeText(text);
    notify("Secure summary prepared and share activity recorded.");
  }
  function exportRecord() {
    const blob = new Blob([`record,type,source\n"${recordName}","360 summary","AutoAxis demonstration"\n`], { type: "text/csv" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${recordName.toLowerCase().replaceAll(" ", "-")}-summary.csv`; anchor.click(); URL.revokeObjectURL(url);
    notify("CSV summary exported.");
  }
  return { toast, notify, share, exportRecord };
}

export function CustomerView({ onNavigate, initialRecordId, onRecordSelect }: RecordViewProps) {
  const [customer, setCustomer] = useState<Customer360>(CLIENT_DEMO_CUSTOMER);
  const [source, setSource] = useState("demonstration");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [empty, setEmpty] = useState(false);
  const [tab, setTab] = useState("Overview");
  const [filter, setFilter] = useState("All");
  const [modal, setModal] = useState<ModalState>(null);
  const [segment, setSegment] = useState("All");
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const actions = useRecordActions(customer.displayName);
  const visibleCustomers = CUSTOMER_DIRECTORY.filter((entry) => {
    const matchesSegment = segment === "All" || entry.segment === segment;
    const search = query.trim().toLowerCase();
    return matchesSegment && (!search || `${entry.name} ${entry.mobile} ${entry.email} ${entry.vehicle}`.toLowerCase().includes(search));
  });
  const primaryVehicle = customer.vehicles[0];
  const vehicleLabel = primaryVehicle ? `${primaryVehicle.make} ${primaryVehicle.model} · ${primaryVehicle.registration ?? primaryVehicle.vin}` : "No linked vehicle";
  const householdLabel = `${customer.displayName.split(" ").at(-1)} household · shared relationship`;
  const customerDeals = CUSTOMER_DEALS.map((row, index) => index === 0 ? [row[0], `${primaryVehicle?.make ?? "Vehicle"} ${primaryVehicle?.model ?? "ownership"} review`, row[2], row[3], row[4]] : index === 1 ? [row[0], vehicleLabel, row[2], row[3], row[4]] : row);

  async function loadCustomerRecord(id: string, signal?: AbortSignal) {
    setLoading(true); setError(null); setEmpty(false);
    try {
      const detail = await apiGet<{ dataSource: string; customer: Customer360 }>(`/api/v1/customers/${encodeURIComponent(id)}/360`, { signal });
      setCustomer(detail.customer); setSource(detail.dataSource);
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof ApiError ? cause : new ApiError("Customer record could not be loaded.", { status: 500 }));
    } finally { if (!signal?.aborted) setLoading(false); }
  }

  useEffect(() => {
    if (!initialRecordId || initialRecordId === customer.id) return;
    const controller = new AbortController();
    loadCustomerRecord(initialRecordId, controller.signal);
    return () => controller.abort();
  }, [initialRecordId]);

  function selectCustomer(entry: typeof CUSTOMER_DIRECTORY[number]) {
    setCustomer({ ...CLIENT_DEMO_CUSTOMER, id: entry.id, displayName: entry.name, mobile: entry.mobile, email: entry.email, lifetimeValue: entry.value, preferredChannel: entry.segment === "Service due" ? "SMS" : "Email" });
    setSource(entry.name === "James Hartley" ? "demonstration" : "directory");
    setEmpty(false); setDirectoryOpen(false); onRecordSelect(entry.id); loadCustomerRecord(entry.id);
  }

  async function searchCustomer(event: FormEvent) {
    event.preventDefault();
    if (query.trim().length < 2) { setError(new ApiError("Enter at least two characters.", { status: 400, code: "INVALID_SEARCH" })); return; }
    setLoading(true); setError(null); setEmpty(false);
    try {
      const search = await apiGet<{ dataSource: string; customers: Array<{ id: string }> }>(`/api/v1/customers/search?q=${encodeURIComponent(query.trim())}`);
      if (!search.customers.length) { setEmpty(true); return; }
      const detail = await apiGet<{ dataSource: string; customer: Customer360 }>(`/api/v1/customers/${search.customers[0].id}/360`);
      setCustomer(detail.customer); setSource(detail.dataSource); setDirectoryOpen(false); onRecordSelect(detail.customer.id);
    } catch (cause) { setError(cause instanceof ApiError ? cause : new ApiError("Customer search failed.", { status: 500 })); }
    finally { setLoading(false); }
  }

  return <WorkspacePage title="Customer 360" eyebrow="Relationship intelligence" description="Search a mobile number. See the household, vehicles, value, consent and every connected interaction." action={<DataSourceBadge source={source} />}>
    <button type="button" className="mobile-directory-trigger" aria-expanded={directoryOpen} onClick={() => setDirectoryOpen((value) => !value)}><CircleUserRound /><span><strong>Browse customer directory</strong><small>{visibleCustomers.length} relationships · search or change record</small></span><ArrowRight /></button>
    <div className="record-workbench">
      <aside className={`record-directory-panel ${directoryOpen ? "mobile-visible" : ""}`}>
        <header className="directory-panel-heading"><div><span>Customer directory</span><strong>{visibleCustomers.length} connected records</strong></div><div className="directory-heading-actions"><button className="record-directory-close" type="button" onClick={() => setDirectoryOpen(false)} aria-label="Close customer directory"><X /></button><button type="button" onClick={() => setModal("customer")} aria-label="Create customer"><Plus /></button></div></header>
        <form className="record-search" onSubmit={searchCustomer}><Search size={18} /><input aria-label="Search customers" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, mobile, or email" />{query && <button className="search-clear" type="button" aria-label="Clear customer search" onClick={() => { setQuery(""); setError(null); setEmpty(false); }}><X /></button>}<button className="search-submit" type="submit" disabled={loading}>Search</button></form>
        <SearchState loading={loading} error={error} />
        <div className="directory-filter-scroll"><div className="filter-chips">{["All","VIP","Service due","Prospect"].map((item) => <button type="button" className={segment === item ? "active" : ""} onClick={() => setSegment(item)} key={item}>{item}</button>)}</div></div>
        <section className="customer-directory"><div className="customer-list-head"><span>Customer</span><span>Vehicle / interest</span><span>Lifetime value</span><span>Next action</span></div>{visibleCustomers.map((entry) => <button type="button" className={customer.displayName === entry.name ? "selected" : ""} key={entry.name} onClick={() => selectCustomer(entry)}><span className="customer-list-avatar">{entry.name.split(" ").map((part) => part[0]).join("")}</span><div><strong>{entry.name}</strong><small>{entry.mobile} · {entry.segment}</small></div><span>{entry.vehicle}</span><b>{new Intl.NumberFormat("en-AU",{style:"currency",currency:"AUD",maximumFractionDigits:0}).format(entry.value)}</b><em>{entry.next}</em><ArrowRight /></button>)}{!visibleCustomers.length && <div className="customer-list-empty"><Search />No matching directory records.</div>}</section>
      </aside>
      <section className="record-detail-panel">
        {!empty && <><div className="record-primary-actions"><button type="button" onClick={() => setModal("opportunity")}><span><UserPlus /></span><div><strong>Create opportunity</strong><small>Start a connected sales path</small></div><ArrowRight /></button><button type="button" onClick={() => setModal("booking")}><span><CalendarDays /></span><div><strong>Book service</strong><small>Vehicle, advisor and mobility</small></div><ArrowRight /></button><a href={`https://wa.me/${customer.mobile.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"><span><MessageCircle /></span><div><strong>WhatsApp customer</strong><small>Record the conversation</small></div><ArrowRight /></a><button type="button" onClick={() => setModal("portal")}><span><CircleUserRound /></span><div><strong>Portal preview</strong><small>Customer self-service view</small></div><ArrowRight /></button></div><ActionBar><button type="button" onClick={() => setModal("customer")}><UserPlus />New customer</button><button type="button" onClick={() => setModal("edit-customer")}><Edit3 />Edit profile</button><a href={`tel:${customer.mobile}`}><Phone />Call</a><a href={`mailto:${customer.email}?subject=Your AutoAxis ownership review`}><Mail />Email</a><button type="button" onClick={() => setModal("task")}><ListChecks />Task</button><button type="button" onClick={() => setModal("note")}><StickyNote />Note</button><button type="button" onClick={actions.share}><Share2 />Share</button><button type="button" onClick={actions.exportRecord}><Download />Export</button></ActionBar></>}
        {empty ? <div className="empty-state"><Search /><strong>No customers found</strong><p>Try a different name, mobile number, or email.</p></div> : <div className="record-layout">
      <section className="record-main-card">
        <div className="record-identity"><div className="record-avatar">{customer.displayName.split(" ").map((p) => p[0]).slice(0,2).join("")}</div><div><span>Individual · verified · customer since {new Date(customer.customerSince).getFullYear()}</span><h3>{customer.displayName}</h3><p><Phone size={14} />{customer.mobile}<Mail size={14} />{customer.email}</p></div><button type="button" onClick={() => navigator.clipboard?.writeText(customer.id)} aria-label="Copy customer ID"><Copy /></button></div>
        <div className="record-tabs" role="tablist">{["Overview","Activity","Vehicles","Sales & finance","Service & care","Documents"].map((item) => <button role="tab" aria-selected={tab === item} className={tab === item ? "active" : ""} type="button" key={item} onClick={() => setTab(item)}>{item}</button>)}</div>
        {tab === "Overview" && <><div className="record-facts"><div><WalletCards /><span>Lifetime value</span><strong>{new Intl.NumberFormat("en-AU",{style:"currency",currency:"AUD",maximumFractionDigits:0}).format(customer.lifetimeValue)}</strong></div><div><CarFront /><span>Vehicles</span><strong>{customer.vehicles.length}</strong></div><div><Wrench /><span>Service visits</span><strong>{customer.serviceVisitCount}</strong></div><div><ShieldCheck /><span>Consent</span><strong>{customer.preferredChannel} · active</strong></div></div><InfoGrid items={[["Relationship",householdLabel],["Open enquiry",`${primaryVehicle?.make ?? "Vehicle"} ${primaryVehicle?.model ?? "ownership"} review · illustrative`],["Insurance","Comprehensive · renews 14 Nov"],["Warranty","Factory coverage active"],["Complaints","None unresolved"],["Communication",`${customer.preferredChannel} preferred · consent active`]]} /></>}
        {tab === "Activity" && <><div className="record-section-heading"><div><span>Relationship timeline</span><strong>Every department, one chronology</strong></div><div className="filter-chips">{["All","service","sale","communication"].map((item) => <button type="button" className={filter === item ? "active" : ""} onClick={() => setFilter(item)} key={item}>{item}</button>)}</div></div><Timeline items={customer.timeline} filter={filter} /></>}
        {tab === "Vehicles" && <div className="linked-records">{customer.vehicles.map((vehicle) => <button type="button" key={vehicle.vin} onClick={() => onNavigate("vehicles", vehicle.id)}><CarFront /><div><strong>{vehicle.make} {vehicle.model}</strong><span>{vehicle.variant} · {vehicle.registration ?? vehicle.vin}</span></div><ArrowRight /></button>)}</div>}
        {tab === "Sales & finance" && <><SectionToolbar title="Deals and opportunities" detail="Complete commercial relationship" action="New opportunity" onAction={() => setModal("opportunity")} /><OperationalTable columns={["Reference","Vehicle / opportunity","Value","Stage","Owner / date"]} rows={customerDeals} onOpen={() => setModal("opportunity")} /><div className="detail-summary-strip"><div><CreditCard /><span>Finance</span><strong>$46,820 payout</strong><small>36 months remaining · illustrative</small></div><div><ShieldCheck /><span>Insurance</span><strong>Comprehensive</strong><small>Renewal 14 Nov · illustrative</small></div><div><WalletCards /><span>Accessories</span><strong>$4,860</strong><small>Protection, tow pack, mats · illustrative</small></div></div></>}
        {tab === "Service & care" && <><SectionToolbar title="Service relationship" detail="9 visits · $14,680 customer-pay value" action="Book service" onAction={() => setModal("booking")} /><OperationalTable columns={["Reference","Work performed","Date","Value","Status"]} rows={CUSTOMER_SERVICE} onOpen={() => setModal("booking")} /><InfoGrid items={[["Next service","12 Nov 2026 · annual service"],["Preferred advisor","Daniel Brooks"],["Retention risk","Low · all servicing retained"],["Last NPS","9 / 10 · promoter"],["Open complaint","None"],["Mobility preference","Loan vehicle required"]]} /></>}
        {tab === "Documents" && <><SectionToolbar title="Customer document wallet" detail="Identity, contracts and consent in one place" action="Request document" onAction={() => setModal("documents")} /><OperationalTable columns={["Document","Category","Status","Updated"]} rows={CUSTOMER_DOCUMENTS} onOpen={() => setModal("documents")} /></>}
      </section>
      <aside className="record-side-column"><div className="side-panel"><span>Next best action</span><strong>Service-to-trade review</strong><p>Positive equity, service history and ownership age indicate a qualified upgrade conversation.</p><button type="button" onClick={() => setModal("opportunity")}>Create opportunity <ArrowRight /></button></div><div className="side-panel side-panel--light"><span>Contact context</span><p className="contact-row"><MapPin />{customer.address}</p><p className="contact-row"><CalendarDays />Follow-up due 24 Aug</p><div className="status-check"><i />Email consent active</div><div className="status-check"><i />Identity verified</div></div></aside>
        </div>}
      </section>
    </div>
    {modal === "opportunity" && <WorkflowModal title="Create connected opportunity" eyebrow="Sales workflow" onClose={() => setModal(null)} onComplete={() => { setModal(null); actions.notify("Opportunity AX-2048 created and pinned in Sales."); onNavigate("sales"); }}><DemoFields kind="opportunity" customerName={customer.displayName} vehicleLabel={vehicleLabel} /></WorkflowModal>}
    {modal === "portal" && <WorkflowModal title="Customer portal preview" eyebrow="Customer self-service" completeLabel="Send secure link" onClose={() => setModal(null)} onComplete={() => { setModal(null); actions.notify("Secure portal link queued by email."); }}><div className="portal-preview"><Brand /><span>Welcome back, {customer.displayName.split(" ")[0]}</span><strong>Your {primaryVehicle ? `${primaryVehicle.make} ${primaryVehicle.model}` : "vehicle"} is ready for an ownership review.</strong><div><b>Next service</b><em>Nov 2026</em></div><div><b>Warranty</b><em>Active</em></div><button type="button">Book service</button></div></WorkflowModal>}
    {modal === "customer" && <WorkflowModal title="Create customer record" eyebrow="Customer master" completeLabel="Create customer" onClose={() => setModal(null)} onComplete={() => { setModal(null); actions.notify("Customer record created and duplicate check completed."); }}><div className="workflow-form-grid"><label><span>Customer type</span><input defaultValue="Individual" /></label><label><span>Full name</span><input defaultValue="New customer" /></label><label><span>Mobile</span><input defaultValue="+61 " /></label><label><span>Email</span><input defaultValue="customer@prakashinfotech.com" /></label><label><span>Preferred channel</span><input defaultValue="WhatsApp" /></label><label><span>Home branch</span><input defaultValue="Sydney Central" /></label></div><div className="workflow-callout"><ShieldCheck /><div><strong>No possible duplicate found</strong><p>Mobile and email are checked before a customer master record is created.</p></div></div></WorkflowModal>}
    {modal === "note" && <WorkflowModal title={`Add note for ${customer.displayName}`} eyebrow="Relationship timeline" completeLabel="Save note" onClose={() => setModal(null)} onComplete={() => { setModal(null); actions.notify("Customer note saved to the shared timeline."); }}><label className="note-field"><span>Note visible to Sales, Service and Customer Care</span><textarea defaultValue="Customer requested an ownership review after the next service visit." /></label><div className="workflow-form-grid"><label><span>Follow-up date</span><input defaultValue="24 Aug 2026" /></label><label><span>Owner</span><input defaultValue="Olivia Lawson" /></label></div></WorkflowModal>}
    {modal === "edit-customer" && <WorkflowModal title={`Edit ${customer.displayName}`} eyebrow="Customer master" completeLabel="Save changes" onClose={() => setModal(null)} onComplete={() => { setModal(null); actions.notify("Customer profile, preferences and consent updated."); }}><div className="workflow-form-grid"><label><span>Full name</span><input defaultValue={customer.displayName} /></label><label><span>Mobile</span><input defaultValue={customer.mobile} /></label><label><span>Email</span><input type="email" defaultValue={customer.email} /></label><label><span>Preferred channel</span><select defaultValue={customer.preferredChannel}><option>Email</option><option>SMS</option><option>WhatsApp</option><option>Phone</option></select></label><label><span>Customer segment</span><select defaultValue="VIP"><option>VIP</option><option>Retail</option><option>Fleet</option><option>Prospect</option></select></label><label><span>Home branch</span><select defaultValue="Sydney Central"><option>Sydney Central</option><option>North Shore</option><option>Parramatta</option></select></label></div><div className="consent-grid"><label><input type="checkbox" defaultChecked /> Email marketing</label><label><input type="checkbox" defaultChecked /> SMS service updates</label><label><input type="checkbox" defaultChecked /> WhatsApp conversations</label><label><input type="checkbox" defaultChecked /> Data-sharing consent</label></div></WorkflowModal>}
    {modal === "task" && <WorkflowModal title="Create customer task" eyebrow="Team follow-up" completeLabel="Assign task" onClose={() => setModal(null)} onComplete={() => { setModal(null); actions.notify("Follow-up task assigned to Sarah Cole for today."); }}><div className="workflow-form-grid"><label><span>Task</span><input defaultValue="Complete ownership review" /></label><label><span>Department</span><select defaultValue="Sales"><option>Sales</option><option>Service</option><option>Finance</option><option>Customer care</option></select></label><label><span>Owner</span><input defaultValue="Sarah Cole" /></label><label><span>Due</span><input type="datetime-local" defaultValue="2026-08-24T10:30" /></label><label><span>Priority</span><select defaultValue="High"><option>High</option><option>Normal</option><option>Low</option></select></label><label><span>Related record</span><input defaultValue={vehicleLabel} /></label></div></WorkflowModal>}
    {modal === "booking" && <WorkflowModal title="Book service visit" eyebrow="Service booking" completeLabel="Confirm booking" onClose={() => setModal(null)} onComplete={() => { setModal(null); actions.notify("Service booking BK-4214 confirmed with loan vehicle."); }}><div className="workflow-form-grid"><label><span>Vehicle</span><input defaultValue={vehicleLabel} /></label><label><span>Service package</span><select defaultValue="Annual service"><option>Annual service</option><option>Express service</option><option>Diagnostic</option><option>Recall</option></select></label><label><span>Date</span><input type="date" defaultValue="2026-11-12" /></label><label><span>Arrival</span><input type="time" defaultValue="08:00" /></label><label><span>Advisor</span><input defaultValue="Daniel Brooks" /></label><label><span>Mobility</span><select defaultValue="Loan vehicle"><option>Loan vehicle</option><option>Customer waiting</option><option>Pickup and delivery</option></select></label></div></WorkflowModal>}
    {modal === "documents" && <WorkflowModal title="Customer document request" eyebrow="Document wallet" completeLabel="Send secure request" onClose={() => setModal(null)} onComplete={() => { setModal(null); actions.notify("Secure finance document request sent by email and WhatsApp."); }}><div className="document-list">{["Driver licence","Proof of address","Finance payout letter","Signed privacy consent"].map((item) => <label key={item}><input type="checkbox" defaultChecked /><FileText /><span>{item}</span><em>Request</em></label>)}</div></WorkflowModal>}
    {actions.toast && <Toast message={actions.toast} />}
  </WorkspacePage>;
}

export function VehicleView({ onNavigate, initialRecordId, onRecordSelect }: RecordViewProps) {
  const [vehicle, setVehicle] = useState<Vehicle360>(CLIENT_DEMO_VEHICLE);
  const [source, setSource] = useState("demonstration");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [empty, setEmpty] = useState(false);
  const [tab, setTab] = useState("Overview");
  const [filter, setFilter] = useState("All");
  const [modal, setModal] = useState<ModalState>(null);
  const [stockFilter, setStockFilter] = useState("All");
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const actions = useRecordActions(`${vehicle.make} ${vehicle.model}`);
  const value = useMemo(() => new Intl.NumberFormat("en-AU",{style:"currency",currency:"AUD",maximumFractionDigits:0}),[]);
  const visibleVehicles = VEHICLE_DIRECTORY.filter((entry) => {
    const search = query.trim().toLowerCase();
    return (stockFilter === "All" || entry.status === stockFilter) && (!search || `${entry.registration} ${entry.vin} ${entry.make} ${entry.model} ${entry.owner}`.toLowerCase().includes(search));
  });

  async function loadVehicleRecord(id: string, signal?: AbortSignal) {
    setLoading(true); setError(null); setEmpty(false);
    try {
      const detail = await apiGet<{ dataSource: string; vehicle: Vehicle360 }>(`/api/v1/vehicles/${encodeURIComponent(id)}/360`, { signal });
      setVehicle(detail.vehicle); setSource(detail.dataSource);
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof ApiError ? cause : new ApiError("Vehicle record could not be loaded.", { status: 500 }));
    } finally { if (!signal?.aborted) setLoading(false); }
  }

  useEffect(() => {
    if (!initialRecordId || initialRecordId === vehicle.id) return;
    const controller = new AbortController();
    loadVehicleRecord(initialRecordId, controller.signal);
    return () => controller.abort();
  }, [initialRecordId]);

  function selectVehicle(entry: typeof VEHICLE_DIRECTORY[number]) {
    setVehicle({ ...CLIENT_DEMO_VEHICLE, id: entry.id, vin: entry.vin, registration: entry.registration, make: entry.make, model: entry.model, modelYear: entry.year, ownerName: entry.owner, marketValue: entry.value, status: entry.status.toLowerCase().replaceAll(" ", "-") });
    setSource(entry.registration === "DMS-360" ? "demonstration" : "directory"); setEmpty(false); setDirectoryOpen(false); onRecordSelect(entry.id); loadVehicleRecord(entry.id);
  }

  async function searchVehicle(event: FormEvent) {
    event.preventDefault(); if (query.trim().length < 2) { setError(new ApiError("Enter at least two characters.", { status: 400 })); return; }
    setLoading(true); setError(null); setEmpty(false);
    try { const search = await apiGet<{dataSource:string;vehicles:Array<{id:string}>}>(`/api/v1/vehicles/search?q=${encodeURIComponent(query.trim())}`); if(!search.vehicles.length){setEmpty(true);return;} const detail=await apiGet<{dataSource:string;vehicle:Vehicle360}>(`/api/v1/vehicles/${search.vehicles[0].id}/360`); setVehicle(detail.vehicle); setSource(detail.dataSource); setDirectoryOpen(false); onRecordSelect(detail.vehicle.id); }
    catch(cause){setError(cause instanceof ApiError?cause:new ApiError("Vehicle search failed.",{status:500}));} finally{setLoading(false);}
  }
  const complete = (message: string) => { setModal(null); actions.notify(message); };
  return <WorkspacePage title="Vehicle 360" eyebrow="VIN lifecycle intelligence" description="One trusted history from OEM order and ownership through service, condition, valuation and resale." action={<DataSourceBadge source={source} />}>
    <button type="button" className="mobile-directory-trigger" aria-expanded={directoryOpen} onClick={() => setDirectoryOpen((value) => !value)}><CarFront /><span><strong>Browse vehicle directory</strong><small>{visibleVehicles.length} assets · search or change record</small></span><ArrowRight /></button>
    <div className="record-workbench">
      <aside className={`record-directory-panel ${directoryOpen ? "mobile-visible" : ""}`}>
        <header className="directory-panel-heading"><div><span>Vehicle directory</span><strong>{visibleVehicles.length} connected assets</strong></div><div className="directory-heading-actions"><button className="record-directory-close" type="button" onClick={() => setDirectoryOpen(false)} aria-label="Close vehicle directory"><X /></button><button type="button" onClick={() => setModal("vehicle")} aria-label="Add vehicle"><Plus /></button></div></header>
        <form className="record-search" onSubmit={searchVehicle}><Search /><input aria-label="Search vehicles" value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="VIN, registration, make or model" />{query && <button className="search-clear" type="button" aria-label="Clear vehicle search" onClick={() => { setQuery(""); setError(null); setEmpty(false); }}><X /></button>}<button className="search-submit" type="submit" disabled={loading}>Search</button></form><SearchState loading={loading} error={error} />
        <div className="directory-filter-scroll"><div className="filter-chips">{["All","Customer owned","Enquiry"].map((item) => <button type="button" className={stockFilter === item ? "active" : ""} onClick={() => setStockFilter(item)} key={item}>{item}</button>)}</div></div>
        <section className="vehicle-directory"><div className="vehicle-list-head"><span>Vehicle</span><span>Owner / status</span><span>Location</span><span>Value</span><span>Next action</span></div>{visibleVehicles.map((entry) => <button type="button" className={vehicle.registration === entry.registration ? "selected" : ""} key={entry.vin} onClick={() => selectVehicle(entry)}><span className="vehicle-list-icon"><CarFront /></span><div><strong>{entry.year} {entry.make} {entry.model}</strong><small>{entry.registration} · {entry.vin.slice(-8)}</small></div><span><b>{entry.owner}</b><small>{entry.status}</small></span><span>{entry.location}</span><b>{value.format(entry.value)}</b><em>{entry.next}</em><ArrowRight /></button>)}{!visibleVehicles.length && <div className="customer-list-empty"><Search />No matching assets.</div>}</section>
      </aside>
      <section className="record-detail-panel">
        {!empty && <><div className="record-primary-actions"><button type="button" onClick={() => setModal("vehicle")}><span><Plus /></span><div><strong>Add to stock</strong><small>Create the VIN master</small></div><ArrowRight /></button><button type="button" onClick={() => setModal("appraisal")}><span><Gauge /></span><div><strong>Start appraisal</strong><small>Condition and market value</small></div><ArrowRight /></button><button type="button" onClick={() => setModal("booking")}><span><Wrench /></span><div><strong>Book workshop</strong><small>Service, PDI or reconditioning</small></div><ArrowRight /></button><button type="button" onClick={() => setModal("auction")}><span><CarFront /></span><div><strong>Auction vehicle</strong><small>Controlled wholesale disposal</small></div><ArrowRight /></button></div><ActionBar><button type="button" onClick={() => setModal("rental")}><CalendarDays />Rent / demo</button><button type="button" onClick={actions.share}><Share2 />Share</button><button type="button" onClick={actions.exportRecord}><Download />Export</button></ActionBar></>}
        {empty ? <div className="empty-state"><Search /><strong>No vehicles found</strong><p>Try a different VIN, registration, make or model.</p></div> : <div className="record-layout"><section className="record-main-card">
      <div className="vehicle-hero"><div className="vehicle-silhouette"><CarFront /></div><div><span>{vehicle.modelYear} · {vehicle.status.replaceAll("-"," ")}</span><h3>{vehicle.make} {vehicle.model}</h3><p>{vehicle.variant} · {vehicle.colour}</p></div><div><span>Registration</span><strong>{vehicle.registration}</strong></div></div>
      <div className="record-tabs" role="tablist">{["Overview","Lifecycle","Work orders","Valuation","Ownership","Documents"].map((item)=><button role="tab" aria-selected={tab===item} className={tab===item?"active":""} type="button" key={item} onClick={()=>setTab(item)}>{item}</button>)}</div>
      {tab==="Overview" && <><div className="record-facts"><div><CarFront /><span>VIN</span><strong className="fact-small">{vehicle.vin}</strong></div><div><Gauge /><span>Odometer</span><strong>{new Intl.NumberFormat("en-AU").format(vehicle.odometerKm)} km</strong></div><div><WalletCards /><span>Market value</span><strong>{value.format(vehicle.marketValue)}</strong></div><div><CircleUserRound /><span>Current owner</span><button type="button" onClick={()=>onNavigate("customers", vehicle.ownerId)}>{vehicle.ownerName}</button></div></div><InfoGrid items={[["Vehicle health","92 / 100 · no critical faults"],["Warranty","Factory · expires Jun 2027"],["Insurance","Comprehensive · verified"],["Accident history","No reported accidents"],["Parts replaced","Brake pads · tyres · battery"],["Current location","Sydney Central · customer owned"]]} /></>}
      {tab==="Lifecycle" && <><div className="record-section-heading"><div><span>Vehicle lifecycle</span><strong>Verified events across every owner</strong></div><div className="filter-chips">{["All","service","ownership","sale"].map((item)=><button type="button" className={filter===item?"active":""} onClick={()=>setFilter(item)} key={item}>{item}</button>)}</div></div><Timeline items={vehicle.timeline} filter={filter} /></>}
      {tab==="Work orders" && <><SectionToolbar title="Workshop and inspection history" detail="Repair orders, campaigns, PDI and condition checks" action="Book workshop" onAction={() => setModal("booking")} /><OperationalTable columns={["Reference","Work performed","Status","Date","Value"]} rows={VEHICLE_WORK} onOpen={() => setModal("booking")} /><div className="detail-summary-strip"><div><Wrench /><span>Service retention</span><strong>100%</strong><small>9 of 9 visits in group</small></div><div><ClipboardCheck /><span>Inspection</span><strong>192 / 200</strong><small>No safety-critical items</small></div><div><Gauge /><span>Health score</span><strong>92 / 100</strong><small>Battery watch only</small></div></div></>}
      {tab==="Valuation" && <div className="valuation-panel"><div><span>Retail market</span><strong>{value.format(vehicle.marketValue)}</strong><em>+1.8% in 30 days</em></div><div><span>Trade estimate</span><strong>{value.format(vehicle.marketValue-6300)}</strong><em>Confidence: high</em></div><div><span>Wholesale floor</span><strong>{value.format(vehicle.marketValue-9200)}</strong><em>8 recent comparables</em></div><button type="button" onClick={()=>setModal("appraisal")}>Start condition appraisal <ArrowRight /></button></div>}
      {tab==="Ownership" && <InfoGrid items={[["Current owner",vehicle.ownerName],["Previous owner","Pacific Motor Group demonstrator"],["Purchase date","18 Jun 2022"],["Purchase branch","Sydney Central"],["Registration","NSW · expires 18 Jun 2027"],["Ownership status","Verified · no finance flag"]]} />}
      {tab==="Documents" && <><SectionToolbar title="Vehicle document vault" detail="Seven verified records across ownership and service" action="Upload document" onAction={() => setModal("documents")} /><OperationalTable columns={["Document","Source","Status","Updated"]} rows={[["Registration certificate","Transport NSW","Verified","18 Jun 2026"],["Purchase contract","Sales","Signed","18 Jun 2022"],["Factory warranty","OEM","Active","18 Jun 2022"],["Insurance certificate","Customer","Verified","14 Nov 2025"],["Latest service invoice","Service","Paid","18 Aug 2026"],["200-point inspection","Used vehicles","Complete","21 Aug 2026"]]} onOpen={() => setModal("documents")} /></>}
    </section><aside className="record-side-column"><div className="side-panel"><span>Connected signal</span><strong>Service-to-trade ready</strong><p>Inspection, positive equity and ownership age support a proactive appraisal now.</p><button type="button" onClick={()=>setModal("appraisal")}>Start appraisal <ArrowRight /></button></div><div className="side-panel side-panel--light"><span>Operational state</span>{["Ownership verified","Warranty active","No open recalls","Service history complete"].map((item)=><div className="status-check" key={item}><i />{item}</div>)}<button type="button" className="panel-link" onClick={()=>setModal("documents")}><FileText />Open 7 documents</button></div></aside></div>}
      </section>
    </div>
    {modal && !["documents","portal","opportunity","booking"].includes(modal) && <WorkflowModal title={modal==="vehicle"?"Add vehicle to inventory":modal==="appraisal"?"Condition appraisal":modal==="auction"?"Send to auction":"Create rental / demonstrator booking"} eyebrow={modal==="vehicle"?"Vehicle intake":modal==="appraisal"?"Used vehicle workflow":modal==="auction"?"Wholesale disposition":"Vehicle availability"} onClose={()=>setModal(null)} onComplete={()=>complete(modal==="vehicle"?"Vehicle saved and Vehicle 360 created.":modal==="appraisal"?"Appraisal AP-1042 saved at $78,200.":modal==="auction"?"Auction lot AU-882 published with $76,500 reserve.":"Rental booking RB-220 confirmed.")}><DemoFields kind={modal as "vehicle"|"appraisal"|"auction"|"rental"} customerName={vehicle.ownerName} vehicleLabel={`${vehicle.modelYear} ${vehicle.make} ${vehicle.model} · ${vehicle.registration}`} /></WorkflowModal>}
    {modal==="documents" && <WorkflowModal title="Vehicle documents" eyebrow="Verified deal pack" completeLabel="Download selected" onClose={()=>setModal(null)} onComplete={()=>complete("Selected documents prepared for download.")}><div className="document-list">{["Purchase contract","Registration certificate","Warranty policy","Insurance verification","Service invoice · 18 Aug"].map((item)=><label key={item}><input type="checkbox" defaultChecked /><FileText /><span>{item}</span><em>Verified</em></label>)}</div></WorkflowModal>}
    {modal==="booking" && <WorkflowModal title="Create workshop booking" eyebrow="Vehicle operations" completeLabel="Confirm booking" onClose={()=>setModal(null)} onComplete={()=>complete("Workshop booking BK-4216 confirmed and owner notified.")}><div className="workflow-form-grid"><label><span>Vehicle</span><input defaultValue={`${vehicle.make} ${vehicle.model} · ${vehicle.registration}`} /></label><label><span>Work type</span><select defaultValue="Inspection"><option>Inspection</option><option>Scheduled service</option><option>Diagnostic</option><option>PDI</option><option>Reconditioning</option></select></label><label><span>Date</span><input type="date" defaultValue="2026-08-26" /></label><label><span>Technician team</span><select defaultValue="Team A"><option>Team A</option><option>Team B</option><option>Express lane</option></select></label><label><span>Estimate</span><input defaultValue="$680" /></label><label><span>Owner approval</span><select defaultValue="Send digital approval"><option>Send digital approval</option><option>Already approved</option><option>Internal work</option></select></label></div></WorkflowModal>}
    {actions.toast && <Toast message={actions.toast} />}
  </WorkspacePage>;
}

function InfoGrid({ items }: { items: string[][] }) { return <div className="info-grid">{items.map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>; }
