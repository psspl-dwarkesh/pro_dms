import {
  ArrowRight, BadgeCheck, CalendarDays, CarFront, CircleUserRound, Copy, Download, FileText, Gauge,
  Mail, MapPin, MessageCircle, Phone, Plus, Search, Share2, ShieldCheck, WalletCards,
  StickyNote, UserPlus, Wrench, X, ClipboardCheck, CreditCard, Edit3, ListChecks,
  ChevronRight, Sparkles, CheckCircle2, ExternalLink,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { apiGet, ApiError } from "../../lib/api";
import { Brand } from "../components/Brand";
import { CLIENT_DEMO_CUSTOMER, CLIENT_DEMO_VEHICLE } from "../data";
import type { Customer360, DashView, Vehicle360 } from "../types";

type RecordViewProps = { onNavigate: (view: DashView) => void };
type ModalState = null | "opportunity" | "portal" | "customer" | "note" | "vehicle" | "appraisal" | "auction" | "rental" | "documents" | "edit-customer" | "task" | "booking" | "payment";

const CUSTOMER_DIRECTORY: Array<{ name: string; mobile: string; email: string; segment: string; vehicle: string; value: number; next: string }> = [
  { name: "James Hartley", mobile: "+61 412 345 678", email: "james.hartley@prakashinfotech.com", segment: "VIP", vehicle: "BMW X5 · DMS-360", value: 127450, next: "Ownership review" },
  { name: "Ava Nguyen", mobile: "+61 417 220 184", email: "ava.nguyen@prakashinfotech.com", segment: "Prospect", vehicle: "Audi Q7 enquiry", value: 148900, next: "Finance documents" },
  { name: "Rohan Mehta", mobile: "+61 409 518 230", email: "rohan.mehta@prakashinfotech.com", segment: "Service due", vehicle: "Ford Ranger · PMG-814", value: 78450, next: "Trade value expires" },
  { name: "Emily Chen", mobile: "+61 421 620 775", email: "emily.chen@prakashinfotech.com", segment: "VIP", vehicle: "Volvo XC60 · ECX-620", value: 96800, next: "Service approval" },
  { name: "Noah Williams", mobile: "+61 431 882 417", email: "noah.williams@prakashinfotech.com", segment: "Prospect", vehicle: "Toyota LandCruiser enquiry", value: 119990, next: "Test drive tomorrow" },
  { name: "Mia Thompson", mobile: "+61 402 771 906", email: "mia.thompson@prakashinfotech.com", segment: "Service due", vehicle: "Mazda CX-5 · MIA-425", value: 53400, next: "60,000 km service" },
  { name: "Liam Wilson", mobile: "+61 418 450 992", email: "liam.wilson@prakashinfotech.com", segment: "VIP", vehicle: "Mercedes GLC · LMW-882", value: 184250, next: "Insurance renewal" },
];

const VEHICLE_DIRECTORY = [
  { registration: "DMS-360", vin: "WBA11EU09R9Y40122", make: "BMW", model: "X5", year: 2022, owner: "James Hartley", status: "Customer owned", location: "Sydney Central", value: 84500, next: "Appraisal ready" },
  { registration: "PMG-814", vin: "MPBUMFF50PX498814", make: "Ford", model: "Ranger", year: 2023, owner: "Rohan Mehta", status: "Customer owned", location: "North Shore", value: 67200, next: "Recall check" },
  { registration: "STK-204", vin: "WAUZZZ4M5PD002204", make: "Audi", model: "Q7", year: 2025, owner: "Unallocated", status: "In stock", location: "Yard A · Bay 14", value: 148900, next: "Price review" },
  { registration: "DEMO-12", vin: "YV1UZBFV7R1120012", make: "Volvo", model: "XC60", year: 2024, owner: "Pacific Motor Group", status: "Demo", location: "Sydney Central", value: 88900, next: "Booking at 14:30" },
  { registration: "RSV-772", vin: "W1NKM4HB8RF987772", make: "Mercedes", model: "GLC", year: 2024, owner: "Liam Wilson", status: "Reserved", location: "PDI workshop", value: 121400, next: "Delivery checklist" },
  { registration: "USE-441", vin: "JTMCB3FV10D124441", make: "Toyota", model: "RAV4", year: 2021, owner: "Used stock", status: "In stock", location: "Used yard · Bay 7", value: 42900, next: "Photography due" },
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
  ["Driver licence", "Identity", "Verified", "14 Aug 2026"],
  ["Purchase contract", "Sales", "Signed", "18 Jun 2022"],
  ["Finance payout authority", "Finance", "Awaiting signature", "20 Aug 2026"],
  ["Insurance policy", "Insurance", "Active", "14 Nov 2025"],
];
const VEHICLE_WORK = [
  ["RO-18506", "Annual service + brake inspection", "Closed", "18 Aug 2026", "$1,284"],
  ["INSP-1042", "200-point used vehicle inspection", "Ready", "Today", "$0"],
  ["RC-882", "Open recall campaign check", "Clear", "18 Aug 2026", "$0"],
  ["PDI-401", "Pre-delivery inspection", "Completed", "17 Jun 2022", "$420"],
];

function DataSourceBadge({ source }: { source: string }) {
  const connected = source === "postgresql";
  return (
    <span className={`source-badge ${connected ? "source-badge--connected" : ""}`}>
      <i />
      {connected ? "Neon live PostgreSQL" : "Demonstration data"}
    </span>
  );
}

function SearchState({ loading, error }: { loading: boolean; error: ApiError | null }) {
  if (loading) return <span className="record-search-state"><i className="loading-dot" />Searching connected database records…</span>;
  if (error) return <span className="record-search-state record-search-state--error">{error.message}{error.requestId ? ` · ${error.requestId}` : ""}</span>;
  return null;
}

function Timeline({ items, filter }: { items: Array<{ occurredAt: string; type: string; summary: string }>; filter: string }) {
  const visible = filter === "All" ? items : items.filter((item) => item.type.toLowerCase().includes(filter.toLowerCase()));
  return (
    <div className="record-timeline">
      {visible.length ? (
        visible.map((item, index) => (
          <div key={`${item.occurredAt}-${index}`} className="timeline-event">
            <i />
            <div>
              <span>{new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(item.occurredAt))} · {item.type}</span>
              <strong>{item.summary}</strong>
            </div>
          </div>
        ))
      ) : (
        <div className="timeline-empty">No activity in this category.</div>
      )}
    </div>
  );
}

function OperationalTable({ columns, rows, onOpen }: { columns: string[]; rows: string[][]; onOpen?: (row: string[]) => void }) {
  const grid = { gridTemplateColumns: `repeat(${columns.length}, minmax(110px, 1fr))` };
  return (
    <div className="operational-table">
      <div className="operational-table-head" style={grid}>
        {columns.map((column) => <span key={column}>{column}</span>)}
      </div>
      {rows.map((row) => (
        <button type="button" style={grid} key={row[0]} onClick={() => onOpen?.(row)}>
          {row.map((value, index) => (
            <span key={`${row[0]}-${columns[index]}`} className={index === 0 ? "primary" : index === columns.length - 1 ? "status" : ""}>
              {value}
            </span>
          ))}
          <ArrowRight size={14} />
        </button>
      ))}
    </div>
  );
}

function SectionToolbar({ title, detail, action, onAction }: { title: string; detail: string; action?: string; onAction?: () => void }) {
  return (
    <div className="section-toolbar">
      <div>
        <span>{title}</span>
        <strong>{detail}</strong>
      </div>
      {action && (
        <button type="button" className="toolbar-btn" onClick={onAction}>
          <Plus size={14} />
          {action}
        </button>
      )}
    </div>
  );
}

export function Toast({ message }: { message: string }) {
  return <div className="workspace-toast" role="status"><BadgeCheck size={18} />{message}</div>;
}

export function WorkflowModal({ title, eyebrow, onClose, onComplete, children, completeLabel = "Save demonstration" }: { title: string; eyebrow: string; onClose: () => void; onComplete: () => void; children: React.ReactNode; completeLabel?: string }) {
  return (
    <div className="modal-scrim" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
      <section className="workflow-modal" role="dialog" aria-modal="true" aria-labelledby="workflow-title">
        <header>
          <div>
            <span>{eyebrow}</span>
            <h2 id="workflow-title">{title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close dialog"><X size={18} /></button>
        </header>
        <div className="workflow-modal-body">{children}</div>
        <footer>
          <span><i /> Demonstration workflow · changes reset on page reload</span>
          <div>
            <button type="button" className="modal-cancel-btn" onClick={onClose}>Cancel</button>
            <button type="button" className="workspace-button workspace-button--dark" onClick={onComplete}>
              {completeLabel} <ArrowRight size={15} />
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function DemoFields({ kind }: { kind: "opportunity" | "vehicle" | "appraisal" | "auction" | "rental" }) {
  const definitions = {
    opportunity: [["Customer", "James Hartley"], ["Vehicle interest", "BMW X5 upgrade"], ["Next step", "Ownership review"], ["Owner", "Sarah Cole"]],
    vehicle: [["Acquisition type", "New stock"], ["VIN", "WBA11EU09R9Y40122"], ["Branch", "Sydney Central"], ["Status", "Ordered / incoming"]],
    appraisal: [["Vehicle", "2022 BMW X5 xDrive40i"], ["Odometer", "48,620 km"], ["Condition", "Very good"], ["Trade estimate", "$78,200"]],
    auction: [["Vehicle", "2022 BMW X5 xDrive40i"], ["Channel", "Dealer wholesale"], ["Reserve", "$76,500"], ["Close", "26 Aug 2026 · 17:00"]],
    rental: [["Vehicle", "BMW X5 · DMS-360"], ["Customer", "James Hartley"], ["Dates", "24–27 Aug 2026"], ["Rate", "$189 / day"]],
  }[kind];
  return (
    <>
      <div className="workflow-progress"><b className="active">1. Details</b><i /><b>2. Review</b><i /><b>3. Confirm</b></div>
      <div className="workflow-form-grid">
        {definitions.map(([label, value]) => (
          <label key={label}>
            <span>{label}</span>
            <input defaultValue={value} />
          </label>
        ))}
      </div>
      <div className="workflow-callout">
        <ShieldCheck size={18} />
        <div>
          <strong>Connected context retained</strong>
          <p>Customer, vehicle, branch, and source are linked to the new workflow with no duplicate entry.</p>
        </div>
      </div>
    </>
  );
}

function useRecordActions(recordName: string) {
  const [toast, setToast] = useState("");
  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }
  async function share() {
    const text = `AutoAxis DMS record summary · ${recordName}`;
    if (navigator.share) await navigator.share({ title: recordName, text }).catch(() => undefined);
    else await navigator.clipboard?.writeText(text);
    notify("Secure summary prepared and share activity recorded.");
  }
  function exportRecord() {
    const blob = new Blob([`record,type,source\n"${recordName}","360 summary","AutoAxis demonstration"\n`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${recordName.toLowerCase().replaceAll(" ", "-")}-summary.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify("CSV summary exported.");
  }
  return { toast, notify, share, exportRecord };
}

export function CustomerView({ onNavigate }: RecordViewProps) {
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
  const [mobileDetailActive, setMobileDetailActive] = useState(false);
  const actions = useRecordActions(customer.displayName);

  const visibleCustomers = useMemo(() => {
    return CUSTOMER_DIRECTORY.filter((entry) => {
      const matchesSegment = segment === "All" || entry.segment === segment;
      const search = query.trim().toLowerCase();
      return matchesSegment && (!search || `${entry.name} ${entry.mobile} ${entry.email} ${entry.vehicle}`.toLowerCase().includes(search));
    });
  }, [segment, query]);

  function selectCustomer(entry: typeof CUSTOMER_DIRECTORY[number]) {
    setCustomer({
      ...CLIENT_DEMO_CUSTOMER,
      displayName: entry.name,
      mobile: entry.mobile,
      email: entry.email,
      lifetimeValue: entry.value,
      preferredChannel: entry.segment === "Service due" ? "SMS" : "Email",
    });
    setSource(entry.name === "James Hartley" ? "demonstration" : "directory");
    setEmpty(false);
    setMobileDetailActive(true);
  }

  async function searchCustomer(event: FormEvent) {
    event.preventDefault();
    if (query.trim().length < 2) {
      setError(new ApiError("Enter at least two characters to search.", { status: 400, code: "INVALID_SEARCH" }));
      return;
    }
    setLoading(true);
    setError(null);
    setEmpty(false);
    try {
      const search = await apiGet<{ dataSource: string; customers: Array<{ id: string }> }>(`/api/v1/customers/search?q=${encodeURIComponent(query.trim())}`);
      if (!search.customers.length) {
        setEmpty(true);
        return;
      }
      const detail = await apiGet<{ dataSource: string; customer: Customer360 }>(`/api/v1/customers/${search.customers[0].id}/360`);
      setCustomer(detail.customer);
      setSource(detail.dataSource);
      setMobileDetailActive(true);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause : new ApiError("Customer search failed.", { status: 500 }));
    } finally {
      setLoading(false);
    }
  }

  return (
    <WorkspacePage
      title="Customer 360"
      eyebrow="Relationship intelligence"
      description="Single customer master connecting phone, vehicle ownership, household equity, and cross-department timeline."
      action={
        <div className="workspace-header-actions">
          <DataSourceBadge source={source} />
          <button type="button" className="workspace-button workspace-button--dark" onClick={() => setModal("customer")}>
            <UserPlus size={15} /> Add customer
          </button>
        </div>
      }
    >
      <div className={`master-detail-container ${mobileDetailActive ? "mobile-detail-shown" : ""}`}>
        {/* Left Master Directory Panel */}
        <aside className="master-list-panel">
          <div className="master-panel-header">
            <div className="master-panel-title">
              <strong>Customer Directory</strong>
              <span>{visibleCustomers.length} records</span>
            </div>
            <button type="button" className="panel-add-btn" title="Add new customer" onClick={() => setModal("customer")}>
              <Plus size={16} />
            </button>
          </div>

          <form className="master-search-form" onSubmit={searchCustomer}>
            <div className="master-search-input-wrap">
              <Search size={16} className="search-icon" />
              <input
                aria-label="Search customers"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Search name, mobile, email..."
              />
              {query && (
                <button
                  type="button"
                  className="search-clear-btn"
                  aria-label="Clear search"
                  onClick={() => {
                    setQuery("");
                    setError(null);
                    setEmpty(false);
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <button type="submit" className="master-search-submit" disabled={loading}>
              {loading ? "..." : "Search"}
            </button>
          </form>

          <SearchState loading={loading} error={error} />

          <div className="filter-pills-bar">
            {["All", "VIP", "Service due", "Prospect"].map((item) => (
              <button
                type="button"
                className={`filter-pill ${segment === item ? "active" : ""}`}
                onClick={() => setSegment(item)}
                key={item}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="master-items-scroll">
            {visibleCustomers.map((entry) => {
              const isSelected = customer.displayName === entry.name;
              return (
                <button
                  type="button"
                  className={`master-item-card ${isSelected ? "selected" : ""}`}
                  key={entry.name}
                  onClick={() => selectCustomer(entry)}
                >
                  <div className="master-item-avatar">
                    {entry.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}
                  </div>
                  <div className="master-item-info">
                    <div className="master-item-top">
                      <strong>{entry.name}</strong>
                      <span className={`segment-tag segment-${entry.segment.toLowerCase().replace(/\s+/g, "-")}`}>
                        {entry.segment}
                      </span>
                    </div>
                    <span className="master-item-sub">{entry.mobile} · {entry.vehicle}</span>
                    <div className="master-item-bottom">
                      <b>{new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(entry.value)}</b>
                      <em>{entry.next}</em>
                    </div>
                  </div>
                  <ChevronRight size={15} className="master-item-chevron" />
                </button>
              );
            })}
            {!visibleCustomers.length && (
              <div className="master-empty-state">
                <Search size={22} />
                <strong>No matching directory records</strong>
                <p>Press search to query Neon database or clear filters.</p>
              </div>
            )}
          </div>
        </aside>

        {/* Right Detail Cockpit Panel */}
        <main className="detail-cockpit-panel">
          {mobileDetailActive && (
            <button type="button" className="mobile-back-to-list-btn" onClick={() => setMobileDetailActive(false)}>
              &larr; Back to customer directory
            </button>
          )}

          {empty ? (
            <div className="cockpit-empty-state">
              <Search size={36} />
              <h3>No Customer Record Found</h3>
              <p>Try searching with another name, phone number, or email address.</p>
              <button type="button" className="button button--signal" onClick={() => setModal("customer")}>
                <UserPlus size={16} /> Create New Customer Record
              </button>
            </div>
          ) : (
            <>
              {/* Cockpit Identity Header */}
              <div className="cockpit-identity-card">
                <div className="cockpit-identity-main">
                  <div className="cockpit-avatar">
                    {customer.displayName.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                  </div>
                  <div className="cockpit-identity-details">
                    <div className="cockpit-identity-meta">
                      <span>Individual · Customer since {new Date(customer.customerSince).getFullYear()}</span>
                      <span className="verified-badge"><CheckCircle2 size={12} /> Verified Profile</span>
                    </div>
                    <h2>{customer.displayName}</h2>
                    <div className="cockpit-contact-chips">
                      <a href={`tel:${customer.mobile}`} className="contact-chip">
                        <Phone size={13} /> {customer.mobile}
                      </a>
                      <a href={`mailto:${customer.email}`} className="contact-chip">
                        <Mail size={13} /> {customer.email}
                      </a>
                      <span className="contact-chip contact-chip--channel">
                        <MessageCircle size={13} /> {customer.preferredChannel} Preferred
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="copy-id-btn"
                    onClick={() => {
                      navigator.clipboard?.writeText(customer.id);
                      actions.notify("Customer UUID copied to clipboard.");
                    }}
                    title="Copy customer UUID"
                  >
                    <Copy size={15} />
                    <span>Copy ID</span>
                  </button>
                </div>

                {/* Primary Action Toolbar */}
                <div className="cockpit-action-toolbar">
                  <button type="button" className="action-btn action-btn--primary" onClick={() => setModal("opportunity")}>
                    <Plus size={14} /> New Opportunity
                  </button>
                  <button type="button" className="action-btn" onClick={() => setModal("booking")}>
                    <Wrench size={14} /> Book Service
                  </button>
                  <button type="button" className="action-btn" onClick={() => setModal("task")}>
                    <ListChecks size={14} /> Create Task
                  </button>
                  <button type="button" className="action-btn" onClick={() => setModal("note")}>
                    <StickyNote size={14} /> Add Note
                  </button>
                  <button type="button" className="action-btn" onClick={() => setModal("edit-customer")}>
                    <Edit3 size={14} /> Edit Profile
                  </button>
                  <a href={`https://wa.me/${customer.mobile.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="action-btn">
                    <MessageCircle size={14} /> WhatsApp
                  </a>
                  <button type="button" className="action-btn" onClick={actions.share}>
                    <Share2 size={14} /> Share
                  </button>
                  <button type="button" className="action-btn" onClick={actions.exportRecord}>
                    <Download size={14} /> Export CSV
                  </button>
                  <button type="button" className="action-btn" onClick={() => setModal("portal")}>
                    <ExternalLink size={14} /> Customer Portal
                  </button>
                </div>
              </div>

              {/* Cockpit Quick Metric Facts */}
              <div className="cockpit-facts-grid">
                <div className="fact-tile">
                  <WalletCards size={20} className="fact-icon text-teal" />
                  <div className="fact-content">
                    <span>Lifetime Value</span>
                    <strong>{new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(customer.lifetimeValue)}</strong>
                  </div>
                </div>
                <div className="fact-tile">
                  <CarFront size={20} className="fact-icon text-signal" />
                  <div className="fact-content">
                    <span>Linked Vehicles</span>
                    <strong>{customer.vehicles.length} units</strong>
                  </div>
                </div>
                <div className="fact-tile">
                  <Wrench size={20} className="fact-icon text-amber" />
                  <div className="fact-content">
                    <span>Service History</span>
                    <strong>{customer.serviceVisitCount} visits</strong>
                  </div>
                </div>
                <div className="fact-tile">
                  <ShieldCheck size={20} className="fact-icon text-teal" />
                  <div className="fact-content">
                    <span>Privacy Consent</span>
                    <strong>{customer.preferredChannel} · Active</strong>
                  </div>
                </div>
              </div>

              {/* Main Content Layout (Tabs + Side Insight Column) */}
              <div className="cockpit-body-grid">
                <div className="cockpit-main-column">
                  <div className="cockpit-nav-tabs" role="tablist">
                    {["Overview", "Activity", "Vehicles", "Sales & finance", "Service & care", "Documents"].map((item) => (
                      <button
                        role="tab"
                        aria-selected={tab === item}
                        className={`cockpit-tab-btn ${tab === item ? "active" : ""}`}
                        type="button"
                        key={item}
                        onClick={() => setTab(item)}
                      >
                        {item}
                      </button>
                    ))}
                  </div>

                  <div className="cockpit-tab-content">
                    {tab === "Overview" && (
                      <div className="tab-pane-overview">
                        <InfoGrid
                          items={[
                            ["Relationship Profile", "Hartley household · 2 family members"],
                            ["Open Opportunity", "BMW X5 ownership renewal · Qualified"],
                            ["Insurance Status", "Comprehensive · Renews 14 Nov 2026"],
                            ["Warranty Coverage", "Factory manufacturer warranty active"],
                            ["Unresolved Issues", "Zero open complaints"],
                            ["Preferred Channels", "WhatsApp + Email verified"],
                          ]}
                        />
                      </div>
                    )}

                    {tab === "Activity" && (
                      <div className="tab-pane-activity">
                        <div className="activity-filter-bar">
                          <span>Relationship Timeline</span>
                          <div className="filter-pills-bar">
                            {["All", "service", "sale", "communication"].map((item) => (
                              <button
                                type="button"
                                className={`filter-pill ${filter === item ? "active" : ""}`}
                                onClick={() => setFilter(item)}
                                key={item}
                              >
                                {item}
                              </button>
                            ))}
                          </div>
                        </div>
                        <Timeline items={customer.timeline} filter={filter} />
                      </div>
                    )}

                    {tab === "Vehicles" && (
                      <div className="tab-pane-vehicles">
                        <SectionToolbar title="Linked Vehicles" detail="Owned and previously owned vehicles" />
                        <div className="linked-vehicles-grid">
                          {customer.vehicles.map((vehicle) => (
                            <button
                              type="button"
                              className="vehicle-linked-card"
                              key={vehicle.vin}
                              onClick={() => onNavigate("vehicles")}
                            >
                              <div className="vehicle-card-icon"><CarFront size={22} /></div>
                              <div className="vehicle-card-info">
                                <strong>{vehicle.make} {vehicle.model}</strong>
                                <span>{vehicle.variant} · Reg: {vehicle.registration ?? "Pending"}</span>
                                <small>VIN: {vehicle.vin}</small>
                              </div>
                              <ArrowRight size={16} className="vehicle-card-arrow" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {tab === "Sales & finance" && (
                      <div className="tab-pane-deals">
                        <SectionToolbar
                          title="Deals and Commercial Opportunities"
                          detail="Complete dealership sales lifecycle"
                          action="New opportunity"
                          onAction={() => setModal("opportunity")}
                        />
                        <OperationalTable
                          columns={["Reference", "Vehicle / Opportunity", "Value", "Stage", "Owner / Date"]}
                          rows={CUSTOMER_DEALS}
                          onOpen={() => setModal("opportunity")}
                        />
                        <div className="detail-summary-strip">
                          <div>
                            <CreditCard size={18} />
                            <span>Finance Payout</span>
                            <strong>$46,820 balance</strong>
                            <small>36 months · 7.1% APR</small>
                          </div>
                          <div>
                            <ShieldCheck size={18} />
                            <span>Insurance</span>
                            <strong>Comprehensive</strong>
                            <small>Renews 14 Nov · 0 claims</small>
                          </div>
                          <div>
                            <WalletCards size={18} />
                            <span>Accessories</span>
                            <strong>$4,860</strong>
                            <small>Protection pack & mats</small>
                          </div>
                        </div>
                      </div>
                    )}

                    {tab === "Service & care" && (
                      <div className="tab-pane-service">
                        <SectionToolbar
                          title="Workshop Service History"
                          detail="9 visits · $14,680 total investment"
                          action="Book service"
                          onAction={() => setModal("booking")}
                        />
                        <OperationalTable
                          columns={["Reference", "Work Performed", "Date", "Value", "Status"]}
                          rows={CUSTOMER_SERVICE}
                          onOpen={() => setModal("booking")}
                        />
                        <InfoGrid
                          items={[
                            ["Next Scheduled Service", "12 Nov 2026 · Annual Service"],
                            ["Preferred Service Advisor", "Daniel Brooks · Master Advisor"],
                            ["Retention Assessment", "100% Group Retention · Low Risk"],
                            ["Net Promoter Score", "9 / 10 · Brand Promoter"],
                            ["Open Safety Recalls", "None outstanding"],
                            ["Mobility Preference", "Loan vehicle required on bookings"],
                          ]}
                        />
                      </div>
                    )}

                    {tab === "Documents" && (
                      <div className="tab-pane-documents">
                        <SectionToolbar
                          title="Customer Document Vault"
                          detail="Identity verification, contracts, and signed consent"
                          action="Request document"
                          onAction={() => setModal("documents")}
                        />
                        <OperationalTable
                          columns={["Document Title", "Category", "Verification Status", "Updated"]}
                          rows={CUSTOMER_DOCUMENTS}
                          onOpen={() => setModal("documents")}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Side Info & Next Best Action Column */}
                <aside className="cockpit-side-column">
                  <div className="insight-action-card">
                    <span className="insight-eyebrow"><Sparkles size={14} /> Next Best Action</span>
                    <h4>Service-to-Trade Renewal</h4>
                    <p>Vehicle equity is positive, and 48-month ownership milestone is approaching. Customer is primed for an X5 upgrade review.</p>
                    <button type="button" className="insight-action-btn" onClick={() => setModal("opportunity")}>
                      Initiate Upgrade Review <ArrowRight size={14} />
                    </button>
                  </div>

                  <div className="contact-summary-card">
                    <span className="card-subhead">Location & Compliance</span>
                    <div className="contact-info-row">
                      <MapPin size={15} />
                      <span>{customer.address}</span>
                    </div>
                    <div className="contact-info-row">
                      <CalendarDays size={15} />
                      <span>Next Follow-up: 24 Aug 2026</span>
                    </div>
                    <div className="compliance-checks">
                      <div className="compliance-tag"><CheckCircle2 size={13} /> Email Consent Active</div>
                      <div className="compliance-tag"><CheckCircle2 size={13} /> Identity Verified (100 pts)</div>
                      <div className="compliance-tag"><CheckCircle2 size={13} /> WhatsApp Opt-in Confirmed</div>
                    </div>
                  </div>
                </aside>
              </div>
            </>
          )}
        </main>
      </div>

      {/* Interactive Workflow Modals */}
      {modal === "opportunity" && (
        <WorkflowModal title="Create Connected Opportunity" eyebrow="Sales workflow" onClose={() => setModal(null)} onComplete={() => { setModal(null); actions.notify("Opportunity AX-2048 created and pinned in Sales."); onNavigate("sales"); }}>
          <DemoFields kind="opportunity" />
        </WorkflowModal>
      )}
      {modal === "portal" && (
        <WorkflowModal title="Customer Portal Experience" eyebrow="Digital self-service" completeLabel="Send secure access link" onClose={() => setModal(null)} onComplete={() => { setModal(null); actions.notify("Secure portal magic link queued by email."); }}>
          <div className="portal-preview">
            <Brand />
            <span>Welcome back, {customer.displayName}</span>
            <strong>Your vehicle is ready for an annual ownership review.</strong>
            <div><b>Next Service</b><em>12 Nov 2026</em></div>
            <div><b>Warranty</b><em>Active through 2027</em></div>
            <button type="button" className="button button--signal">Book Service Appointment</button>
          </div>
        </WorkflowModal>
      )}
      {modal === "customer" && (
        <WorkflowModal title="Create New Customer Record" eyebrow="Customer master entry" completeLabel="Create customer" onClose={() => setModal(null)} onComplete={() => { setModal(null); actions.notify("Customer record created and duplicate check completed."); }}>
          <div className="workflow-form-grid">
            <label><span>Customer Type</span><input defaultValue="Individual" /></label>
            <label><span>Full Legal Name</span><input defaultValue="New Customer" /></label>
            <label><span>Mobile Number</span><input defaultValue="+61 4" /></label>
            <label><span>Email Address</span><input defaultValue="client@prakashinfotech.com" /></label>
            <label><span>Preferred Channel</span><input defaultValue="WhatsApp" /></label>
            <label><span>Home Branch</span><input defaultValue="Sydney Central" /></label>
          </div>
          <div className="workflow-callout">
            <ShieldCheck size={18} />
            <div>
              <strong>Duplicate Prevention Check</strong>
              <p>Mobile number and email are checked against existing accounts before record creation.</p>
            </div>
          </div>
        </WorkflowModal>
      )}
      {modal === "note" && (
        <WorkflowModal title={`Add Timeline Note for ${customer.displayName}`} eyebrow="Relationship chronology" completeLabel="Save note" onClose={() => setModal(null)} onComplete={() => { setModal(null); actions.notify("Customer note saved to shared timeline."); }}>
          <label className="note-field">
            <span>Note visible to Sales, Service, and F&I</span>
            <textarea defaultValue="Customer requested an ownership review after the next service visit." />
          </label>
          <div className="workflow-form-grid">
            <label><span>Follow-up Date</span><input defaultValue="24 Aug 2026" /></label>
            <label><span>Accountable Owner</span><input defaultValue="Olivia Lawson" /></label>
          </div>
        </WorkflowModal>
      )}
      {modal === "edit-customer" && (
        <WorkflowModal title={`Edit Profile — ${customer.displayName}`} eyebrow="Customer master update" completeLabel="Save changes" onClose={() => setModal(null)} onComplete={() => { setModal(null); actions.notify("Customer profile, preferences, and consent updated."); }}>
          <div className="workflow-form-grid">
            <label><span>Full Legal Name</span><input defaultValue={customer.displayName} /></label>
            <label><span>Mobile Number</span><input defaultValue={customer.mobile} /></label>
            <label><span>Email Address</span><input type="email" defaultValue={customer.email} /></label>
            <label>
              <span>Preferred Channel</span>
              <select defaultValue={customer.preferredChannel}>
                <option>Email</option>
                <option>SMS</option>
                <option>WhatsApp</option>
                <option>Phone</option>
              </select>
            </label>
            <label>
              <span>Customer Segment</span>
              <select defaultValue="VIP">
                <option>VIP</option>
                <option>Retail</option>
                <option>Fleet</option>
                <option>Prospect</option>
              </select>
            </label>
            <label>
              <span>Assigned Branch</span>
              <select defaultValue="Sydney Central">
                <option>Sydney Central</option>
                <option>North Shore</option>
                <option>Parramatta</option>
              </select>
            </label>
          </div>
          <div className="consent-grid">
            <label><input type="checkbox" defaultChecked /> Email Marketing Opt-in</label>
            <label><input type="checkbox" defaultChecked /> SMS Service Notifications</label>
            <label><input type="checkbox" defaultChecked /> WhatsApp Interactive Chat</label>
            <label><input type="checkbox" defaultChecked /> Data Sharing Consent</label>
          </div>
        </WorkflowModal>
      )}
      {modal === "task" && (
        <WorkflowModal title="Create Operational Task" eyebrow="Cross-department follow-up" completeLabel="Assign task" onClose={() => setModal(null)} onComplete={() => { setModal(null); actions.notify("Follow-up task assigned to Sarah Cole."); }}>
          <div className="workflow-form-grid">
            <label><span>Task Title</span><input defaultValue="Complete ownership equity review" /></label>
            <label>
              <span>Department</span>
              <select defaultValue="Sales">
                <option>Sales</option>
                <option>Service</option>
                <option>Finance</option>
                <option>Customer Care</option>
              </select>
            </label>
            <label><span>Assigned Owner</span><input defaultValue="Sarah Cole" /></label>
            <label><span>Due Date & Time</span><input type="datetime-local" defaultValue="2026-08-24T10:30" /></label>
            <label>
              <span>Priority</span>
              <select defaultValue="High">
                <option>High</option>
                <option>Normal</option>
                <option>Low</option>
              </select>
            </label>
            <label><span>Linked Asset</span><input defaultValue="BMW X5 · DMS-360" /></label>
          </div>
        </WorkflowModal>
      )}
      {modal === "booking" && (
        <WorkflowModal title="Schedule Workshop Booking" eyebrow="Fixed operations booking" completeLabel="Confirm booking" onClose={() => setModal(null)} onComplete={() => { setModal(null); actions.notify("Service booking BK-4214 confirmed with loan vehicle reserved."); }}>
          <div className="workflow-form-grid">
            <label><span>Vehicle</span><input defaultValue="BMW X5 · DMS-360" /></label>
            <label>
              <span>Service Package</span>
              <select defaultValue="Annual service">
                <option>Annual service</option>
                <option>Express service</option>
                <option>Diagnostic inspection</option>
                <option>Safety recall</option>
              </select>
            </label>
            <label><span>Appointment Date</span><input type="date" defaultValue="2026-11-12" /></label>
            <label><span>Arrival Time</span><input type="time" defaultValue="08:00" /></label>
            <label><span>Service Advisor</span><input defaultValue="Daniel Brooks" /></label>
            <label>
              <span>Mobility Option</span>
              <select defaultValue="Loan vehicle">
                <option>Loan vehicle reserved</option>
                <option>Customer waiting</option>
                <option>Valet pickup & delivery</option>
              </select>
            </label>
          </div>
        </WorkflowModal>
      )}
      {modal === "documents" && (
        <WorkflowModal title="Request Customer Documents" eyebrow="Document wallet request" completeLabel="Send secure request" onClose={() => setModal(null)} onComplete={() => { setModal(null); actions.notify("Secure document upload link sent by WhatsApp and Email."); }}>
          <div className="document-list">
            {["Driver Licence (Front & Back)", "Proof of Residential Address", "Finance Payout Authorization Letter", "Signed Privacy & Credit Consent"].map((item) => (
              <label key={item}>
                <input type="checkbox" defaultChecked />
                <FileText size={16} />
                <span>{item}</span>
                <em>Request</em>
              </label>
            ))}
          </div>
        </WorkflowModal>
      )}
      {actions.toast && <Toast message={actions.toast} />}
    </WorkspacePage>
  );
}

export function VehicleView({ onNavigate }: RecordViewProps) {
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
  const [mobileDetailActive, setMobileDetailActive] = useState(false);
  const actions = useRecordActions(`${vehicle.make} ${vehicle.model}`);
  const valueFormatter = useMemo(() => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }), []);

  const visibleVehicles = useMemo(() => {
    return VEHICLE_DIRECTORY.filter((entry) => {
      const search = query.trim().toLowerCase();
      const matchesStock = stockFilter === "All" || entry.status === stockFilter;
      return matchesStock && (!search || `${entry.registration} ${entry.vin} ${entry.make} ${entry.model} ${entry.owner}`.toLowerCase().includes(search));
    });
  }, [stockFilter, query]);

  function selectVehicle(entry: typeof VEHICLE_DIRECTORY[number]) {
    setVehicle({
      ...CLIENT_DEMO_VEHICLE,
      vin: entry.vin,
      registration: entry.registration,
      make: entry.make,
      model: entry.model,
      modelYear: entry.year,
      ownerName: entry.owner,
      marketValue: entry.value,
      status: entry.status.toLowerCase().replaceAll(" ", "-"),
    });
    setSource(entry.registration === "DMS-360" ? "demonstration" : "directory");
    setEmpty(false);
    setMobileDetailActive(true);
  }

  async function searchVehicle(event: FormEvent) {
    event.preventDefault();
    if (query.trim().length < 2) {
      setError(new ApiError("Enter at least two characters.", { status: 400 }));
      return;
    }
    setLoading(true);
    setError(null);
    setEmpty(false);
    try {
      const search = await apiGet<{ dataSource: string; vehicles: Array<{ id: string }> }>(`/api/v1/vehicles/search?q=${encodeURIComponent(query.trim())}`);
      if (!search.vehicles?.length) {
        setEmpty(true);
        return;
      }
      const detail = await apiGet<{ dataSource: string; vehicle: Vehicle360 }>(`/api/v1/vehicles/${search.vehicles[0].id}/360`);
      setVehicle(detail.vehicle);
      setSource(detail.dataSource);
      setMobileDetailActive(true);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause : new ApiError("Vehicle search failed.", { status: 500 }));
    } finally {
      setLoading(false);
    }
  }

  const completeAction = (message: string) => {
    setModal(null);
    actions.notify(message);
  };

  return (
    <WorkspacePage
      title="Vehicle 360"
      eyebrow="VIN lifecycle intelligence"
      description="Single vehicle master tracking order origin, registration, condition appraisals, service history, and margin."
      action={
        <div className="workspace-header-actions">
          <DataSourceBadge source={source} />
          <button type="button" className="workspace-button workspace-button--dark" onClick={() => setModal("vehicle")}>
            <Plus size={15} /> Add vehicle
          </button>
        </div>
      }
    >
      <div className={`master-detail-container ${mobileDetailActive ? "mobile-detail-shown" : ""}`}>
        {/* Left Master Vehicle Directory Panel */}
        <aside className="master-list-panel">
          <div className="master-panel-header">
            <div className="master-panel-title">
              <strong>Vehicle Inventory</strong>
              <span>{visibleVehicles.length} units</span>
            </div>
            <button type="button" className="panel-add-btn" title="Add vehicle to inventory" onClick={() => setModal("vehicle")}>
              <Plus size={16} />
            </button>
          </div>

          <form className="master-search-form" onSubmit={searchVehicle}>
            <div className="master-search-input-wrap">
              <Search size={16} className="search-icon" />
              <input
                aria-label="Search vehicles"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="VIN, Rego, Make, Model..."
              />
              {query && (
                <button
                  type="button"
                  className="search-clear-btn"
                  aria-label="Clear search"
                  onClick={() => {
                    setQuery("");
                    setError(null);
                    setEmpty(false);
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <button type="submit" className="master-search-submit" disabled={loading}>
              {loading ? "..." : "Search"}
            </button>
          </form>

          <SearchState loading={loading} error={error} />

          <div className="filter-pills-bar">
            {["All", "Customer owned", "In stock", "Demo", "Reserved"].map((item) => (
              <button
                type="button"
                className={`filter-pill ${stockFilter === item ? "active" : ""}`}
                onClick={() => setStockFilter(item)}
                key={item}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="master-items-scroll">
            {visibleVehicles.map((entry) => {
              const isSelected = vehicle.registration === entry.registration;
              return (
                <button
                  type="button"
                  className={`master-item-card ${isSelected ? "selected" : ""}`}
                  key={entry.vin}
                  onClick={() => selectVehicle(entry)}
                >
                  <div className="master-item-avatar master-item-avatar--vehicle">
                    <CarFront size={18} />
                  </div>
                  <div className="master-item-info">
                    <div className="master-item-top">
                      <strong>{entry.year} {entry.make} {entry.model}</strong>
                      <span className="stock-tag">{entry.status}</span>
                    </div>
                    <span className="master-item-sub">{entry.registration} · VIN {entry.vin.slice(-8)}</span>
                    <div className="master-item-bottom">
                      <b>{valueFormatter.format(entry.value)}</b>
                      <em>{entry.location}</em>
                    </div>
                  </div>
                  <ChevronRight size={15} className="master-item-chevron" />
                </button>
              );
            })}
            {!visibleVehicles.length && (
              <div className="master-empty-state">
                <Search size={22} />
                <strong>No matching vehicles found</strong>
                <p>Change filters or search connected PostgreSQL.</p>
              </div>
            )}
          </div>
        </aside>

        {/* Right Vehicle Detail Cockpit */}
        <main className="detail-cockpit-panel">
          {mobileDetailActive && (
            <button type="button" className="mobile-back-to-list-btn" onClick={() => setMobileDetailActive(false)}>
              &larr; Back to vehicle inventory
            </button>
          )}

          {empty ? (
            <div className="cockpit-empty-state">
              <CarFront size={36} />
              <h3>No Vehicle Record Found</h3>
              <p>Check the VIN, registration or make/model query.</p>
              <button type="button" className="button button--signal" onClick={() => setModal("vehicle")}>
                <Plus size={16} /> Add Vehicle Record
              </button>
            </div>
          ) : (
            <>
              {/* Vehicle Hero Card */}
              <div className="cockpit-identity-card">
                <div className="cockpit-identity-main">
                  <div className="cockpit-avatar cockpit-avatar--vehicle">
                    <CarFront size={28} />
                  </div>
                  <div className="cockpit-identity-details">
                    <div className="cockpit-identity-meta">
                      <span>{vehicle.modelYear} Model Year · {vehicle.status.replaceAll("-", " ")}</span>
                      <span className="verified-badge"><ShieldCheck size={12} /> Verified Asset Record</span>
                    </div>
                    <h2>{vehicle.make} {vehicle.model}</h2>
                    <div className="cockpit-contact-chips">
                      <span className="contact-chip contact-chip--rego">
                        Reg: <strong>{vehicle.registration}</strong>
                      </span>
                      <span className="contact-chip">
                        {vehicle.variant} · {vehicle.colour}
                      </span>
                      <span className="contact-chip">
                        VIN: {vehicle.vin}
                      </span>
                    </div>
                  </div>
                  <div className="vehicle-hero-value">
                    <span>Market Valuation</span>
                    <strong>{valueFormatter.format(vehicle.marketValue)}</strong>
                  </div>
                </div>

                {/* Primary Action Toolbar */}
                <div className="cockpit-action-toolbar">
                  <button type="button" className="action-btn action-btn--primary" onClick={() => setModal("appraisal")}>
                    <Gauge size={14} /> Start Appraisal
                  </button>
                  <button type="button" className="action-btn" onClick={() => setModal("booking")}>
                    <Wrench size={14} /> Book Workshop
                  </button>
                  <button type="button" className="action-btn" onClick={() => setModal("auction")}>
                    <CarFront size={14} /> Wholesale Auction
                  </button>
                  <button type="button" className="action-btn" onClick={() => setModal("rental")}>
                    <CalendarDays size={14} /> Demonstrator / Demo
                  </button>
                  <button type="button" className="action-btn" onClick={() => setModal("vehicle")}>
                    <Plus size={14} /> Stock Intake
                  </button>
                  <button type="button" className="action-btn" onClick={actions.share}>
                    <Share2 size={14} /> Share
                  </button>
                  <button type="button" className="action-btn" onClick={actions.exportRecord}>
                    <Download size={14} /> Export CSV
                  </button>
                </div>
              </div>

              {/* Facts Grid */}
              <div className="cockpit-facts-grid">
                <div className="fact-tile">
                  <CarFront size={20} className="fact-icon text-signal" />
                  <div className="fact-content">
                    <span>VIN Number</span>
                    <strong className="fact-mono">{vehicle.vin}</strong>
                  </div>
                </div>
                <div className="fact-tile">
                  <Gauge size={20} className="fact-icon text-amber" />
                  <div className="fact-content">
                    <span>Odometer Reading</span>
                    <strong>{new Intl.NumberFormat("en-AU").format(vehicle.odometerKm)} km</strong>
                  </div>
                </div>
                <div className="fact-tile">
                  <WalletCards size={20} className="fact-icon text-teal" />
                  <div className="fact-content">
                    <span>Retail Market</span>
                    <strong>{valueFormatter.format(vehicle.marketValue)}</strong>
                  </div>
                </div>
                <div className="fact-tile">
                  <CircleUserRound size={20} className="fact-icon text-teal" />
                  <div className="fact-content">
                    <span>Current Registered Owner</span>
                    <button type="button" className="fact-owner-link" onClick={() => onNavigate("customers")}>
                      {vehicle.ownerName} &rarr;
                    </button>
                  </div>
                </div>
              </div>

              {/* Main Body Grid */}
              <div className="cockpit-body-grid">
                <div className="cockpit-main-column">
                  <div className="cockpit-nav-tabs" role="tablist">
                    {["Overview", "Lifecycle", "Work orders", "Valuation", "Ownership", "Documents"].map((item) => (
                      <button
                        role="tab"
                        aria-selected={tab === item}
                        className={`cockpit-tab-btn ${tab === item ? "active" : ""}`}
                        type="button"
                        key={item}
                        onClick={() => setTab(item)}
                      >
                        {item}
                      </button>
                    ))}
                  </div>

                  <div className="cockpit-tab-content">
                    {tab === "Overview" && (
                      <div className="tab-pane-overview">
                        <InfoGrid
                          items={[
                            ["Vehicle Diagnostic Health", "92 / 100 · No critical DTC fault codes"],
                            ["Factory Warranty Status", "Active manufacturer coverage through Jun 2027"],
                            ["Insurance Verification", "Comprehensive verified with NRMA"],
                            ["Accident & Damage History", "PPSR clear · 0 recorded structural claims"],
                            ["Recent Replacements", "OEM Brake pads, Continental tyres, AGM battery"],
                            ["Location & Branch", "Sydney Central · Customer vehicle"],
                          ]}
                        />
                      </div>
                    )}

                    {tab === "Lifecycle" && (
                      <div className="tab-pane-activity">
                        <div className="activity-filter-bar">
                          <span>Vehicle Lifecycle Chronology</span>
                          <div className="filter-pills-bar">
                            {["All", "service", "ownership", "sale"].map((item) => (
                              <button
                                type="button"
                                className={`filter-pill ${filter === item ? "active" : ""}`}
                                onClick={() => setFilter(item)}
                                key={item}
                              >
                                {item}
                              </button>
                            ))}
                          </div>
                        </div>
                        <Timeline items={vehicle.timeline} filter={filter} />
                      </div>
                    )}

                    {tab === "Work orders" && (
                      <div className="tab-pane-deals">
                        <SectionToolbar
                          title="Workshop & Inspection History"
                          detail="Repair orders, campaigns, PDI and condition checks"
                          action="Book workshop"
                          onAction={() => setModal("booking")}
                        />
                        <OperationalTable
                          columns={["Reference", "Work Performed", "Status", "Date", "Cost / Value"]}
                          rows={VEHICLE_WORK}
                          onOpen={() => setModal("booking")}
                        />
                        <div className="detail-summary-strip">
                          <div>
                            <Wrench size={18} />
                            <span>Service Retention</span>
                            <strong>100% Group</strong>
                            <small>9 of 9 services completed</small>
                          </div>
                          <div>
                            <ClipboardCheck size={18} />
                            <span>200-Point Inspection</span>
                            <strong>192 / 200</strong>
                            <small>Zero safety-critical defects</small>
                          </div>
                          <div>
                            <Gauge size={18} />
                            <span>Overall Health Score</span>
                            <strong>92 / 100</strong>
                            <small>Battery health watch</small>
                          </div>
                        </div>
                      </div>
                    )}

                    {tab === "Valuation" && (
                      <div className="tab-pane-valuation">
                        <div className="valuation-metrics-grid">
                          <div className="val-card">
                            <span>Retail Market Value</span>
                            <strong>{valueFormatter.format(vehicle.marketValue)}</strong>
                            <em>+1.8% in last 30 days</em>
                          </div>
                          <div className="val-card">
                            <span>Trade-in Appraisal Estimate</span>
                            <strong>{valueFormatter.format(vehicle.marketValue - 6300)}</strong>
                            <em>High confidence (8 comparables)</em>
                          </div>
                          <div className="val-card">
                            <span>Wholesale Floor Reserve</span>
                            <strong>{valueFormatter.format(vehicle.marketValue - 9200)}</strong>
                            <em>Guaranteed auction floor</em>
                          </div>
                        </div>
                        <button type="button" className="button button--dark val-appraise-btn" onClick={() => setModal("appraisal")}>
                          <Gauge size={16} /> Start Condition Appraisal Walkaround &rarr;
                        </button>
                      </div>
                    )}

                    {tab === "Ownership" && (
                      <div className="tab-pane-overview">
                        <InfoGrid
                          items={[
                            ["Current Registered Owner", vehicle.ownerName],
                            ["Previous Registered Owner", "Pacific Motor Group Demonstrator Fleet"],
                            ["Original Purchase Date", "18 Jun 2022"],
                            ["Delivering Branch", "Sydney Central PMG"],
                            ["State Registration", "NSW · Expires 18 Jun 2027"],
                            ["Encumbrance Status", "Clear title · PPSR certificate issued"],
                          ]}
                        />
                      </div>
                    )}

                    {tab === "Documents" && (
                      <div className="tab-pane-documents">
                        <SectionToolbar
                          title="Vehicle Document Vault"
                          detail="6 verified records across ownership and workshop history"
                          action="Upload document"
                          onAction={() => setModal("documents")}
                        />
                        <OperationalTable
                          columns={["Document Title", "Issuing Source", "Status", "Updated Date"]}
                          rows={[
                            ["Registration Certificate", "Transport for NSW", "Verified", "18 Jun 2026"],
                            ["Purchase Contract Pack", "Sales Department", "Signed", "18 Jun 2022"],
                            ["Factory Warranty Schedule", "OEM Australia", "Active", "18 Jun 2022"],
                            ["Comprehensive Insurance Policy", "NRMA Insurance", "Verified", "14 Nov 2025"],
                            ["Scheduled Service Invoice", "Fixed Operations", "Paid", "18 Aug 2026"],
                            ["200-Point Pre-Purchase Inspection", "Used Vehicle Centre", "Completed", "21 Aug 2026"],
                          ]}
                          onOpen={() => setModal("documents")}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Side Connected Signal Column */}
                <aside className="cockpit-side-column">
                  <div className="insight-action-card">
                    <span className="insight-eyebrow"><Sparkles size={14} /> Connected Signal</span>
                    <h4>Ready for Trade Appraisal</h4>
                    <p>Clean inspection record, low odometer mileage, and high retail demand make this asset an immediate acquisition candidate.</p>
                    <button type="button" className="insight-action-btn" onClick={() => setModal("appraisal")}>
                      Start Condition Appraisal <ArrowRight size={14} />
                    </button>
                  </div>

                  <div className="contact-summary-card">
                    <span className="card-subhead">Operational Verification</span>
                    <div className="compliance-checks">
                      <div className="compliance-tag"><CheckCircle2 size={13} /> Ownership Title Verified</div>
                      <div className="compliance-tag"><CheckCircle2 size={13} /> Factory Warranty Active</div>
                      <div className="compliance-tag"><CheckCircle2 size={13} /> Zero Open Recalls</div>
                      <div className="compliance-tag"><CheckCircle2 size={13} /> Complete Service Book</div>
                    </div>
                    <button type="button" className="panel-text-link" onClick={() => setModal("documents")}>
                      <FileText size={14} /> Open 6 verified documents
                    </button>
                  </div>
                </aside>
              </div>
            </>
          )}
        </main>
      </div>

      {/* Interactive Workflow Modals */}
      {modal && !["documents", "portal", "opportunity", "booking"].includes(modal) && (
        <WorkflowModal
          title={
            modal === "vehicle"
              ? "Add Vehicle to Inventory"
              : modal === "appraisal"
              ? "Vehicle Condition Appraisal"
              : modal === "auction"
              ? "Send to Wholesale Auction"
              : "Create Demonstrator / Rental Booking"
          }
          eyebrow={
            modal === "vehicle"
              ? "Vehicle Intake"
              : modal === "appraisal"
              ? "Used Vehicle Workflow"
              : modal === "auction"
              ? "Wholesale Disposition"
              : "Vehicle Availability"
          }
          onClose={() => setModal(null)}
          onComplete={() =>
            completeAction(
              modal === "vehicle"
                ? "Vehicle saved to inventory and Vehicle 360 generated."
                : modal === "appraisal"
                ? "Appraisal AP-1042 saved at $78,200."
                : modal === "auction"
                ? "Auction lot AU-882 published with $76,500 reserve."
                : "Demonstrator booking RB-220 confirmed."
            )
          }
        >
          <DemoFields kind={modal as "vehicle" | "appraisal" | "auction" | "rental"} />
        </WorkflowModal>
      )}
      {modal === "documents" && (
        <WorkflowModal
          title="Vehicle Document Vault"
          eyebrow="Verified deal & history pack"
          completeLabel="Download selected files"
          onClose={() => setModal(null)}
          onComplete={() => completeAction("Selected vehicle documents compiled for download.")}
        >
          <div className="document-list">
            {["Purchase Contract Pack", "NSW Registration Certificate", "OEM Factory Warranty Policy", "NRMA Insurance Verification", "Service Invoice · 18 Aug 2026"].map((item) => (
              <label key={item}>
                <input type="checkbox" defaultChecked />
                <FileText size={16} />
                <span>{item}</span>
                <em>Verified</em>
              </label>
            ))}
          </div>
        </WorkflowModal>
      )}
      {modal === "booking" && (
        <WorkflowModal
          title="Create Workshop Repair Order"
          eyebrow="Fixed operations scheduling"
          completeLabel="Confirm workshop booking"
          onClose={() => setModal(null)}
          onComplete={() => completeAction("Workshop repair order RO-18512 confirmed and technician notified.")}
        >
          <div className="workflow-form-grid">
            <label><span>Vehicle</span><input defaultValue={`${vehicle.make} ${vehicle.model} · ${vehicle.registration}`} /></label>
            <label>
              <span>Work Type</span>
              <select defaultValue="Inspection">
                <option>200-point inspection</option>
                <option>Scheduled maintenance</option>
                <option>Diagnostic troubleshooting</option>
                <option>Pre-delivery inspection (PDI)</option>
                <option>Refurbishment & reconditioning</option>
              </select>
            </label>
            <label><span>Booking Date</span><input type="date" defaultValue="2026-08-26" /></label>
            <label>
              <span>Workshop Bay</span>
              <select defaultValue="Team A">
                <option>Bay 04 · Master Diagnostic</option>
                <option>Bay 06 · Express Lane</option>
                <option>Bay 11 · EV Certified</option>
              </select>
            </label>
            <label><span>Estimated Total</span><input defaultValue="$680 AUD" /></label>
            <label>
              <span>Customer Approval</span>
              <select defaultValue="Send digital approval">
                <option>Send digital approval via SMS</option>
                <option>Pre-authorized by customer</option>
                <option>Internal dealership work</option>
              </select>
            </label>
          </div>
        </WorkflowModal>
      )}
      {actions.toast && <Toast message={actions.toast} />}
    </WorkspacePage>
  );
}

function InfoGrid({ items }: { items: string[][] }) {
  return (
    <div className="info-grid">
      {items.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

export function WorkspacePage({ title, eyebrow, description, action, children }: { title: string; eyebrow: string; description: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="workspace-page">
      <header className="workspace-page-header">
        <div>
          <span>{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {action && <div className="workspace-page-action">{action}</div>}
      </header>
      {children}
    </div>
  );
}
