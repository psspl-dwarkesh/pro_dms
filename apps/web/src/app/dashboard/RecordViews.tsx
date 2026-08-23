import {
  AlertTriangle, ArrowRight, BadgeCheck, CalendarDays, CarFront, CircleUserRound, Copy, Download, Edit3,
  Gauge, Mail, MapPin, Phone, Plus, Search, Share2, ShieldCheck,
  Trash2, UserPlus, WalletCards, Wrench, X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { apiDelete, apiGet, apiPatch, apiPost, ApiError } from "../../lib/api";
import { GmailIcon, WhatsAppIcon } from "../components/BrandIcons";
import type {
  Communication, Customer, Customer360, DashView, SalesOrder, ServiceJob, Vehicle, Vehicle360,
} from "../types";
import { useContextualActions } from "./SidebarActions";
import type { SidebarAction } from "./SidebarActions";

type RecordViewProps = { onNavigate: (view: DashView) => void };

const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric" });

function SearchState({ loading, error }: { loading: boolean; error: ApiError | null }) {
  if (loading) return <span className="record-search-state"><i className="loading-dot" />Searching connected records...</span>;
  if (error) return <span className="record-search-state record-search-state--error">{error.message}{error.requestId ? ` - ${error.requestId}` : ""}</span>;
  return <span className="record-search-state">Connected search - name, mobile, email, VIN, registration, make or model.</span>;
}

function Timeline({ items }: { items: Array<{ occurredAt: string; type: string; summary: string }> }) {
  if (!items.length) return <div className="timeline-empty">No activity recorded yet.</div>;
  return <div className="record-timeline">{items.map((item, index) => <div key={`${item.occurredAt}-${index}`} className="timeline-event"><i /><div><span>{dateFormatter.format(new Date(item.occurredAt))} - {item.type}</span><strong>{item.summary}</strong></div></div>)}</div>;
}

function OperationalTable({ columns, rows }: { columns: string[]; rows: Array<Array<string | number>> }) {
  const grid = { gridTemplateColumns: `repeat(${columns.length}, minmax(105px, 1fr))` };
  if (!rows.length) return <div className="timeline-empty">No records yet.</div>;
  return <div className="operational-table"><div className="operational-table-head" style={grid}>{columns.map((column) => <span key={column}>{column}</span>)}</div>{rows.map((row, index) => <div style={grid} key={index} className="operational-table-row">{row.map((value, valueIndex) => <span key={valueIndex} className={valueIndex === 0 ? "primary" : valueIndex === columns.length - 1 ? "status" : ""}>{value}</span>)}</div>)}</div>;
}

function SectionToolbar({ title, detail, action, onAction }: { title: string; detail: string; action?: string; onAction?: () => void }) {
  return <div className="section-toolbar"><div><span>{title}</span><strong>{detail}</strong></div>{action && <button type="button" onClick={onAction}><Plus />{action}</button>}</div>;
}

export function Toast({ message }: { message: string }) {
  return <div className="workspace-toast" role="status"><BadgeCheck />{message}</div>;
}

export function WorkflowModal({ title, eyebrow, onClose, onComplete, children, completeLabel = "Save", busy = false }: { title: string; eyebrow: string; onClose: () => void; onComplete: () => void; children: ReactNode; completeLabel?: string; busy?: boolean }) {
  return <div className="modal-scrim" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && onClose()}><section className="workflow-modal" role="dialog" aria-modal="true" aria-labelledby="workflow-title"><header><div><span>{eyebrow}</span><h2 id="workflow-title">{title}</h2></div><button type="button" onClick={onClose} aria-label="Close dialog"><X /></button></header><div className="workflow-modal-body">{children}</div><footer><span><i /> Saved to your connected database</span><div><button type="button" onClick={onClose}>Cancel</button><button type="button" className="workspace-button workspace-button--dark" onClick={onComplete} disabled={busy}>{busy ? "Saving..." : completeLabel} <ArrowRight size={14} /></button></div></footer></section></div>;
}

function useToast() {
  const [toast, setToast] = useState("");
  function notify(message: string) { setToast(message); window.setTimeout(() => setToast(""), 2600); }
  return { toast, notify };
}

async function shareRecord(recordName: string) {
  const text = `AutoAxis record summary - ${recordName}`;
  if (navigator.share) await navigator.share({ title: recordName, text }).catch(() => undefined);
  else await navigator.clipboard?.writeText(text);
}

function exportCsv(recordName: string) {
  const blob = new Blob([`record,source\n"${recordName}","AutoAxis"\n`], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${recordName.toLowerCase().replaceAll(" ", "-")}-summary.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Customer 360
// ---------------------------------------------------------------------------

type CustomerModal = null | "create-customer" | "edit-customer" | "create-lead" | "book-service" | "log-communication";

export function CustomerView({ onNavigate }: RecordViewProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<ApiError | null>(null);
  const [query, setQuery] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [customer, setCustomer] = useState<Customer360 | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [tab, setTab] = useState("Overview");
  const [sales, setSales] = useState<SalesOrder[]>([]);
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [comms, setComms] = useState<Communication[]>([]);

  const [modal, setModal] = useState<CustomerModal>(null);
  const [saving, setSaving] = useState(false);
  const { toast, notify } = useToast();

  function loadList(searchTerm: string) {
    setListLoading(true);
    setListError(null);
    apiGet<{ customers: Customer[] }>(`/api/v1/customers${searchTerm ? `?q=${encodeURIComponent(searchTerm)}` : ""}`)
      .then((result) => {
        setCustomers(result.customers);
        if (!selectedId && result.customers.length) setSelectedId(result.customers[0].id);
      })
      .catch((cause) => setListError(cause instanceof ApiError ? cause : new ApiError("Customer search failed.", { status: 500 })))
      .finally(() => setListLoading(false));
  }

  useEffect(() => { loadList(""); }, []);

  useEffect(() => {
    if (!selectedId) { setCustomer(null); return; }
    setDetailLoading(true);
    apiGet<{ customer: Customer360 }>(`/api/v1/customers/${selectedId}/360`)
      .then((result) => setCustomer(result.customer))
      .catch(() => setCustomer(null))
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    if (tab === "Sales & finance") apiGet<{ salesOrders: SalesOrder[] }>(`/api/v1/sales-orders?customerId=${selectedId}`).then((result) => setSales(result.salesOrders)).catch(() => setSales([]));
    if (tab === "Service & care") apiGet<{ serviceJobs: ServiceJob[] }>(`/api/v1/service-jobs?customerId=${selectedId}`).then((result) => setJobs(result.serviceJobs)).catch(() => setJobs([]));
    if (tab === "Communications") apiGet<{ communications: Communication[] }>(`/api/v1/communications?customerId=${selectedId}`).then((result) => setComms(result.communications)).catch(() => setComms([]));
  }, [tab, selectedId]);

  function searchCustomers(event: FormEvent) {
    event.preventDefault();
    loadList(query.trim());
  }

  async function submitCreateCustomer(form: { customerType: string; displayName: string; mobile: string; email: string; preferredChannel: string; address: string }) {
    setSaving(true);
    try {
      const result = await apiPost<{ customer: Customer }>("/api/v1/customers", form);
      setModal(null);
      loadList(query.trim());
      setSelectedId(result.customer.id);
      notify("Customer created.");
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not create the customer.");
    } finally {
      setSaving(false);
    }
  }

  async function submitEditCustomer(form: { displayName: string; mobile: string; email: string; preferredChannel: string; address: string }) {
    if (!customer) return;
    setSaving(true);
    try {
      await apiPatch(`/api/v1/customers/${customer.id}`, form);
      setModal(null);
      loadList(query.trim());
      apiGet<{ customer: Customer360 }>(`/api/v1/customers/${customer.id}/360`).then((result) => setCustomer(result.customer));
      notify("Customer profile updated.");
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not update the customer.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCustomer() {
    if (!customer) return;
    if (!window.confirm(`Delete ${customer.displayName}? This cannot be undone.`)) return;
    try {
      await apiDelete(`/api/v1/customers/${customer.id}`);
      setSelectedId(null);
      loadList(query.trim());
      notify("Customer deleted.");
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not delete the customer.");
    }
  }

  async function submitCreateLead(form: { source: string; interestedVehicle: string; expectedValue: string }) {
    if (!customer) return;
    setSaving(true);
    try {
      await apiPost("/api/v1/leads", { customerId: customer.id, source: form.source, interestedVehicle: form.interestedVehicle, expectedValue: form.expectedValue ? Number(form.expectedValue) : undefined });
      setModal(null);
      notify("Opportunity created and added to the sales pipeline.");
      onNavigate("sales");
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not create the opportunity.");
    } finally {
      setSaving(false);
    }
  }

  async function submitBookService(form: { vehicleId: string; repairOrderNumber: string; advisor: string; complaint: string }) {
    if (!customer) return;
    setSaving(true);
    try {
      await apiPost("/api/v1/service-jobs", { customerId: customer.id, vehicleId: form.vehicleId, repairOrderNumber: form.repairOrderNumber, advisor: form.advisor, complaint: form.complaint });
      setModal(null);
      notify("Service booking confirmed.");
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not create the booking.");
    } finally {
      setSaving(false);
    }
  }

  async function submitLogCommunication(form: { channel: string; direction: string; subject: string; summary: string }) {
    if (!customer) return;
    setSaving(true);
    try {
      await apiPost("/api/v1/communications", { customerId: customer.id, ...form });
      setModal(null);
      apiGet<{ communications: Communication[] }>(`/api/v1/communications?customerId=${customer.id}`).then((result) => setComms(result.communications));
      notify("Communication logged to the shared timeline.");
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not log the communication.");
    } finally {
      setSaving(false);
    }
  }

  useContextualActions(() => {
    if (!customer) return [];
    const list: SidebarAction[] = [
      { id: "create-lead", label: "Create opportunity", detail: "Start a connected sales path", icon: UserPlus, onClick: () => setModal("create-lead") },
      { id: "book-service", label: "Book service", detail: "Vehicle and workshop context", icon: CalendarDays, onClick: () => setModal("book-service") },
    ];
    if (customer.mobile) list.push({ id: "whatsapp", label: "WhatsApp customer", detail: "Open a conversation", icon: WhatsAppIcon as LucideIcon, href: `https://wa.me/${customer.mobile.replace(/\D/g, "")}` });
    list.push({ id: "log-communication", label: "Log communication", detail: "Record a call, email or message", icon: Mail, onClick: () => setModal("log-communication") });
    list.push({ id: "edit-profile", label: "Edit profile", icon: Edit3, onClick: () => setModal("edit-customer") });
    if (customer.mobile) list.push({ id: "call", label: "Call", icon: Phone, href: `tel:${customer.mobile}` });
    if (customer.email) list.push({ id: "email", label: "Email", icon: GmailIcon as LucideIcon, href: `mailto:${customer.email}` });
    list.push({ id: "share", label: "Share", icon: Share2, onClick: () => shareRecord(customer.displayName).then(() => notify("Summary shared.")) });
    list.push({ id: "export", label: "Export", icon: Download, onClick: () => { exportCsv(customer.displayName); notify("CSV exported."); } });
    list.push({ id: "delete", label: "Delete", icon: Trash2, tone: "danger", onClick: deleteCustomer });
    return list;
  }, [customer]);

  return <WorkspacePage>
    <div className="record-workbench">
      <aside className="record-directory-panel">
        <header className="directory-panel-heading"><div><span>Customer directory</span><strong>{customers.length} connected records</strong></div><button type="button" onClick={() => setModal("create-customer")} aria-label="Create customer"><Plus /></button></header>
        <form className="record-search" onSubmit={searchCustomers}><Search size={18} /><input aria-label="Search customers" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, mobile, or email" />{query && <button className="search-clear" type="button" aria-label="Clear customer search" onClick={() => { setQuery(""); loadList(""); }}><X /></button>}<button className="search-submit" type="submit" disabled={listLoading}>Search</button></form>
        <SearchState loading={listLoading} error={listError} />
        <section className="customer-directory"><div className="customer-list-head"><span>Customer</span><span>Contact</span><span>Lifetime value</span></div>
          {customers.map((entry) => <button type="button" className={selectedId === entry.id ? "selected" : ""} key={entry.id} onClick={() => setSelectedId(entry.id)}><span className="customer-list-avatar">{entry.displayName.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><div><strong>{entry.displayName}</strong><small>{entry.mobile ?? entry.email ?? "No contact on file"}</small></div><span>{entry.preferredChannel ?? "-"}</span><b>{money.format(entry.lifetimeValue)}</b><ArrowRight /></button>)}
          {!listLoading && !customers.length && <div className="customer-list-empty"><Search />No matching customers. Create one to get started.</div>}
        </section>
      </aside>
      <section className="record-detail-panel">
        {detailLoading && <div className="empty-state"><Search /><strong>Loading customer</strong></div>}
        {!detailLoading && !customer && <div className="empty-state"><Search /><strong>No customer selected</strong><p>Search or create a customer to see their connected record.</p></div>}
        {!detailLoading && customer && <>
          <div className="record-layout">
            <section className="record-main-card">
              <div className="record-identity"><div className="record-avatar">{customer.displayName.split(" ").map((p) => p[0]).slice(0, 2).join("")}</div><div><span>{customer.customerType} - customer since {new Date(customer.customerSince).getFullYear()}</span><h3>{customer.displayName}</h3><p>{customer.mobile && <><Phone size={14} />{customer.mobile}</>}{customer.email && <><Mail size={14} />{customer.email}</>}</p></div><button type="button" onClick={() => navigator.clipboard?.writeText(customer.id)} aria-label="Copy customer ID"><Copy /></button></div>
              <div className="record-tabs" role="tablist">{["Overview", "Activity", "Vehicles", "Sales & finance", "Service & care", "Communications"].map((item) => <button role="tab" aria-selected={tab === item} className={tab === item ? "active" : ""} type="button" key={item} onClick={() => setTab(item)}>{item}</button>)}</div>
              {tab === "Overview" && <div className="record-facts"><div><WalletCards /><span>Lifetime value</span><strong>{money.format(customer.lifetimeValue)}</strong></div><div><CarFront /><span>Vehicles</span><strong>{customer.vehicles.length}</strong></div><div><Wrench /><span>Service visits</span><strong>{customer.serviceVisitCount}</strong></div><div><ShieldCheck /><span>Preferred channel</span><strong>{customer.preferredChannel ?? "Not set"}</strong></div></div>}
              {tab === "Activity" && <Timeline items={customer.timeline} />}
              {tab === "Vehicles" && <div className="linked-records">{customer.vehicles.map((vehicle) => <button type="button" key={vehicle.vin} onClick={() => onNavigate("vehicles")}><CarFront /><div><strong>{vehicle.make} {vehicle.model}</strong><span>{vehicle.variant ?? ""} {vehicle.registration ?? vehicle.vin}</span></div><ArrowRight /></button>)}{!customer.vehicles.length && <div className="timeline-empty">No vehicles linked to this customer yet.</div>}</div>}
              {tab === "Sales & finance" && <><SectionToolbar title="Deals and opportunities" detail="Sales orders linked to this customer" action="New opportunity" onAction={() => setModal("create-lead")} /><OperationalTable columns={["Vehicle", "Value", "Status", "Ordered"]} rows={sales.map((order) => [`${order.make} ${order.model}`, money.format(order.totalAmount), order.status, dateFormatter.format(new Date(order.orderedAt))])} /></>}
              {tab === "Service & care" && <><SectionToolbar title="Service relationship" detail={`${jobs.length} repair orders on file`} action="Book service" onAction={() => setModal("book-service")} /><OperationalTable columns={["Repair order", "Vehicle", "Status", "Opened"]} rows={jobs.map((job) => [job.repairOrderNumber, `${job.make} ${job.model}`, job.status, dateFormatter.format(new Date(job.openedAt))])} /></>}
              {tab === "Communications" && <><SectionToolbar title="Communication log" detail={`${comms.length} recorded interactions`} action="Log communication" onAction={() => setModal("log-communication")} /><OperationalTable columns={["Channel", "Direction", "Summary", "Date"]} rows={comms.map((comm) => [comm.channel, comm.direction, comm.summary, dateFormatter.format(new Date(comm.occurredAt))])} /></>}
            </section>
            <aside className="record-side-column">
              <div className="side-panel side-panel--light">
                <span>Contact context</span>
                {customer.address && <p className="contact-row"><MapPin />{customer.address}</p>}
                <div className="status-check"><i />{customer.email ? "Email on file" : "No email on file"}</div>
                <div className="status-check"><i />{customer.mobile ? "Mobile on file" : "No mobile on file"}</div>
              </div>
            </aside>
          </div>
        </>}
      </section>
    </div>

    {modal === "create-customer" && <CreateCustomerModal saving={saving} onClose={() => setModal(null)} onSubmit={submitCreateCustomer} />}
    {modal === "edit-customer" && customer && <EditCustomerModal customer={customer} saving={saving} onClose={() => setModal(null)} onSubmit={submitEditCustomer} />}
    {modal === "create-lead" && customer && <CreateLeadModal customerName={customer.displayName} saving={saving} onClose={() => setModal(null)} onSubmit={submitCreateLead} />}
    {modal === "book-service" && customer && <BookServiceModal vehicles={customer.vehicles} saving={saving} onClose={() => setModal(null)} onSubmit={submitBookService} />}
    {modal === "log-communication" && customer && <LogCommunicationModal saving={saving} onClose={() => setModal(null)} onSubmit={submitLogCommunication} />}
    {toast && <Toast message={toast} />}
  </WorkspacePage>;
}

function CreateCustomerModal({ onClose, onSubmit, saving }: { onClose: () => void; saving: boolean; onSubmit: (form: { customerType: string; displayName: string; mobile: string; email: string; preferredChannel: string; address: string }) => void }) {
  const [form, setForm] = useState({ customerType: "individual", displayName: "", mobile: "", email: "", preferredChannel: "Email", address: "" });
  return <WorkflowModal title="Create customer record" eyebrow="Customer master" completeLabel="Create customer" busy={saving} onClose={onClose} onComplete={() => onSubmit(form)}>
    <div className="workflow-form-grid">
      <label><span>Customer type</span><select value={form.customerType} onChange={(event) => setForm({ ...form, customerType: event.target.value })}><option value="individual">Individual</option><option value="company">Company</option></select></label>
      <label><span>Full name</span><input required value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></label>
      <label><span>Mobile</span><input value={form.mobile} onChange={(event) => setForm({ ...form, mobile: event.target.value })} placeholder="+61 4xx xxx xxx" /></label>
      <label><span>Email</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
      <label><span>Preferred channel</span><input value={form.preferredChannel} onChange={(event) => setForm({ ...form, preferredChannel: event.target.value })} /></label>
      <label><span>Address</span><input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
    </div>
  </WorkflowModal>;
}

function EditCustomerModal({ customer, onClose, onSubmit, saving }: { customer: Customer360; saving: boolean; onClose: () => void; onSubmit: (form: { displayName: string; mobile: string; email: string; preferredChannel: string; address: string }) => void }) {
  const [form, setForm] = useState({ displayName: customer.displayName, mobile: customer.mobile ?? "", email: customer.email ?? "", preferredChannel: customer.preferredChannel ?? "", address: customer.address ?? "" });
  return <WorkflowModal title={`Edit ${customer.displayName}`} eyebrow="Customer master" completeLabel="Save changes" busy={saving} onClose={onClose} onComplete={() => onSubmit(form)}>
    <div className="workflow-form-grid">
      <label><span>Full name</span><input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></label>
      <label><span>Mobile</span><input value={form.mobile} onChange={(event) => setForm({ ...form, mobile: event.target.value })} /></label>
      <label><span>Email</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
      <label><span>Preferred channel</span><select value={form.preferredChannel} onChange={(event) => setForm({ ...form, preferredChannel: event.target.value })}><option>Email</option><option>SMS</option><option>WhatsApp</option><option>Phone</option></select></label>
      <label><span>Address</span><input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
    </div>
  </WorkflowModal>;
}

function CreateLeadModal({ customerName, onClose, onSubmit, saving }: { customerName: string; saving: boolean; onClose: () => void; onSubmit: (form: { source: string; interestedVehicle: string; expectedValue: string }) => void }) {
  const [form, setForm] = useState({ source: "walk-in", interestedVehicle: "", expectedValue: "" });
  return <WorkflowModal title="Create connected opportunity" eyebrow={`Sales workflow - ${customerName}`} busy={saving} onClose={onClose} onComplete={() => onSubmit(form)}>
    <div className="workflow-form-grid">
      <label><span>Source</span><select value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })}><option value="walk-in">Walk-in</option><option value="phone">Phone</option><option value="web">Web enquiry</option><option value="referral">Referral</option></select></label>
      <label><span>Vehicle interest</span><input value={form.interestedVehicle} onChange={(event) => setForm({ ...form, interestedVehicle: event.target.value })} placeholder="e.g. BMW X5 upgrade" /></label>
      <label><span>Expected value (AUD)</span><input type="number" min="0" value={form.expectedValue} onChange={(event) => setForm({ ...form, expectedValue: event.target.value })} /></label>
    </div>
  </WorkflowModal>;
}

function BookServiceModal({ vehicles, onClose, onSubmit, saving }: { vehicles: Customer360["vehicles"]; saving: boolean; onClose: () => void; onSubmit: (form: { vehicleId: string; repairOrderNumber: string; advisor: string; complaint: string }) => void }) {
  const [form, setForm] = useState({ vehicleId: vehicles[0]?.id ?? "", repairOrderNumber: `RO-${Math.floor(Math.random() * 90000 + 10000)}`, advisor: "", complaint: "" });
  return <WorkflowModal title="Book service visit" eyebrow="Service booking" completeLabel="Confirm booking" busy={saving} onClose={onClose} onComplete={() => onSubmit(form)}>
    {!vehicles.length ? <p className="inline-error"><AlertTriangle size={14} />This customer has no linked vehicle yet. Add a vehicle first.</p> : <div className="workflow-form-grid">
      <label><span>Vehicle</span><select value={form.vehicleId} onChange={(event) => setForm({ ...form, vehicleId: event.target.value })}>{vehicles.map((vehicle) => <option key={vehicle.id ?? vehicle.vin} value={vehicle.id}>{vehicle.make} {vehicle.model} - {vehicle.registration ?? vehicle.vin}</option>)}</select></label>
      <label><span>Repair order number</span><input value={form.repairOrderNumber} onChange={(event) => setForm({ ...form, repairOrderNumber: event.target.value })} /></label>
      <label><span>Advisor</span><input value={form.advisor} onChange={(event) => setForm({ ...form, advisor: event.target.value })} /></label>
      <label className="workflow-form-full"><span>Complaint or work requested</span><input value={form.complaint} onChange={(event) => setForm({ ...form, complaint: event.target.value })} /></label>
    </div>}
  </WorkflowModal>;
}

function LogCommunicationModal({ onClose, onSubmit, saving }: { saving: boolean; onClose: () => void; onSubmit: (form: { channel: string; direction: string; subject: string; summary: string }) => void }) {
  const [form, setForm] = useState({ channel: "call", direction: "outbound", subject: "", summary: "" });
  return <WorkflowModal title="Log communication" eyebrow="Relationship timeline" completeLabel="Save" busy={saving} onClose={onClose} onComplete={() => onSubmit(form)}>
    <div className="workflow-form-grid">
      <label><span>Channel</span><select value={form.channel} onChange={(event) => setForm({ ...form, channel: event.target.value })}><option value="call">Call</option><option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="sms">SMS</option></select></label>
      <label><span>Direction</span><select value={form.direction} onChange={(event) => setForm({ ...form, direction: event.target.value })}><option value="outbound">Outbound</option><option value="inbound">Inbound</option></select></label>
      <label><span>Subject</span><input value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} /></label>
      <label className="workflow-form-full"><span>Summary</span><textarea required value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} /></label>
    </div>
  </WorkflowModal>;
}

// ---------------------------------------------------------------------------
// Vehicle 360
// ---------------------------------------------------------------------------

type VehicleModal = null | "create-vehicle" | "edit-vehicle" | "book-service";

export function VehicleView({ onNavigate }: RecordViewProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<ApiError | null>(null);
  const [query, setQuery] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle360 | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [tab, setTab] = useState("Overview");
  const [jobs, setJobs] = useState<ServiceJob[]>([]);

  const [modal, setModal] = useState<VehicleModal>(null);
  const [saving, setSaving] = useState(false);
  const { toast, notify } = useToast();

  function loadList(searchTerm: string) {
    setListLoading(true);
    setListError(null);
    apiGet<{ vehicles: Vehicle[] }>(`/api/v1/vehicles${searchTerm ? `?q=${encodeURIComponent(searchTerm)}` : ""}`)
      .then((result) => {
        setVehicles(result.vehicles);
        if (!selectedId && result.vehicles.length) setSelectedId(result.vehicles[0].id);
      })
      .catch((cause) => setListError(cause instanceof ApiError ? cause : new ApiError("Vehicle search failed.", { status: 500 })))
      .finally(() => setListLoading(false));
  }

  useEffect(() => { loadList(""); }, []);

  useEffect(() => {
    if (!selectedId) { setVehicle(null); return; }
    setDetailLoading(true);
    apiGet<{ vehicle: Vehicle360 }>(`/api/v1/vehicles/${selectedId}/360`)
      .then((result) => setVehicle(result.vehicle))
      .catch(() => setVehicle(null))
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId || tab !== "Work orders") return;
    apiGet<{ serviceJobs: ServiceJob[] }>(`/api/v1/service-jobs?vehicleId=${selectedId}`).then((result) => setJobs(result.serviceJobs)).catch(() => setJobs([]));
  }, [tab, selectedId]);

  function searchVehicles(event: FormEvent) {
    event.preventDefault();
    loadList(query.trim());
  }

  async function submitCreateVehicle(form: { vin: string; make: string; model: string; variant: string; colour: string; registration: string; status: string }) {
    setSaving(true);
    try {
      const result = await apiPost<{ vehicle: Vehicle }>("/api/v1/vehicles", form);
      setModal(null);
      loadList(query.trim());
      setSelectedId(result.vehicle.id);
      notify("Vehicle added to inventory.");
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not create the vehicle.");
    } finally {
      setSaving(false);
    }
  }

  async function submitEditVehicle(form: { registration: string; colour: string; odometerKm: string; marketValue: string; status: string }) {
    if (!vehicle) return;
    setSaving(true);
    try {
      await apiPatch(`/api/v1/vehicles/${vehicle.id}`, { ...form, odometerKm: form.odometerKm ? Number(form.odometerKm) : undefined, marketValue: form.marketValue ? Number(form.marketValue) : undefined });
      setModal(null);
      apiGet<{ vehicle: Vehicle360 }>(`/api/v1/vehicles/${vehicle.id}/360`).then((result) => setVehicle(result.vehicle));
      loadList(query.trim());
      notify("Vehicle record updated.");
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not update the vehicle.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteVehicle() {
    if (!vehicle) return;
    if (!window.confirm(`Delete ${vehicle.make} ${vehicle.model}? This cannot be undone.`)) return;
    try {
      await apiDelete(`/api/v1/vehicles/${vehicle.id}`);
      setSelectedId(null);
      loadList(query.trim());
      notify("Vehicle deleted.");
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not delete the vehicle.");
    }
  }

  async function submitBookService(form: { repairOrderNumber: string; advisor: string; complaint: string }) {
    if (!vehicle || !vehicle.ownerId) return;
    setSaving(true);
    try {
      await apiPost("/api/v1/service-jobs", { customerId: vehicle.ownerId, vehicleId: vehicle.id, repairOrderNumber: form.repairOrderNumber, advisor: form.advisor, complaint: form.complaint });
      setModal(null);
      notify("Workshop booking confirmed.");
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not create the booking.");
    } finally {
      setSaving(false);
    }
  }

  useContextualActions(() => {
    if (!vehicle) return [];
    const list: SidebarAction[] = [
      { id: "add-to-stock", label: "Add to stock", detail: "Create a VIN master record", icon: Plus, onClick: () => setModal("create-vehicle") },
      { id: "update-valuation", label: "Update valuation", detail: "Odometer, colour and market value", icon: Gauge, onClick: () => setModal("edit-vehicle") },
    ];
    if (vehicle.ownerId) list.push({ id: "book-workshop", label: "Book workshop", detail: "Service or inspection", icon: Wrench, onClick: () => setModal("book-service") });
    list.push({ id: "share", label: "Share", icon: Share2, onClick: () => shareRecord(`${vehicle.make} ${vehicle.model}`).then(() => notify("Summary shared.")) });
    list.push({ id: "export", label: "Export", icon: Download, onClick: () => { exportCsv(`${vehicle.make} ${vehicle.model}`); notify("CSV exported."); } });
    list.push({ id: "delete", label: "Delete", icon: Trash2, tone: "danger", onClick: deleteVehicle });
    return list;
  }, [vehicle]);

  const estimatedTrade = useMemo(() => (vehicle?.marketValue ? vehicle.marketValue * 0.93 : null), [vehicle]);
  const wholesaleFloor = useMemo(() => (vehicle?.marketValue ? vehicle.marketValue * 0.89 : null), [vehicle]);

  return <WorkspacePage>
    <div className="record-workbench">
      <aside className="record-directory-panel">
        <header className="directory-panel-heading"><div><span>Vehicle directory</span><strong>{vehicles.length} connected assets</strong></div><button type="button" onClick={() => setModal("create-vehicle")} aria-label="Add vehicle"><Plus /></button></header>
        <form className="record-search" onSubmit={searchVehicles}><Search /><input aria-label="Search vehicles" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="VIN, registration, make or model" />{query && <button className="search-clear" type="button" aria-label="Clear vehicle search" onClick={() => { setQuery(""); loadList(""); }}><X /></button>}<button className="search-submit" type="submit" disabled={listLoading}>Search</button></form>
        <SearchState loading={listLoading} error={listError} />
        <section className="vehicle-directory"><div className="vehicle-list-head"><span>Vehicle</span><span>Status</span><span>Value</span></div>
          {vehicles.map((entry) => <button type="button" className={selectedId === entry.id ? "selected" : ""} key={entry.id} onClick={() => setSelectedId(entry.id)}><span className="vehicle-list-icon"><CarFront /></span><div><strong>{entry.modelYear ?? ""} {entry.make} {entry.model}</strong><small>{entry.registration ?? entry.vin.slice(-8)}</small></div><span>{entry.status}</span><b>{entry.marketValue ? money.format(entry.marketValue) : "-"}</b><ArrowRight /></button>)}
          {!listLoading && !vehicles.length && <div className="customer-list-empty"><Search />No matching vehicles. Add one to get started.</div>}
        </section>
      </aside>
      <section className="record-detail-panel">
        {detailLoading && <div className="empty-state"><Search /><strong>Loading vehicle</strong></div>}
        {!detailLoading && !vehicle && <div className="empty-state"><Search /><strong>No vehicle selected</strong><p>Search or add a vehicle to see its connected record.</p></div>}
        {!detailLoading && vehicle && <>
          <div className="record-layout">
            <section className="record-main-card">
              <div className="vehicle-hero"><div className="vehicle-silhouette"><CarFront /></div><div><span>{vehicle.modelYear ?? "Year unknown"} - {vehicle.status.replaceAll("-", " ")}</span><h3>{vehicle.make} {vehicle.model}</h3><p>{vehicle.variant ?? ""} {vehicle.colour ?? ""}</p></div><div><span>Registration</span><strong>{vehicle.registration ?? "Unregistered"}</strong></div></div>
              <div className="record-tabs" role="tablist">{["Overview", "Lifecycle", "Work orders", "Valuation", "Ownership"].map((item) => <button role="tab" aria-selected={tab === item} className={tab === item ? "active" : ""} type="button" key={item} onClick={() => setTab(item)}>{item}</button>)}</div>
              {tab === "Overview" && <div className="record-facts"><div><CarFront /><span>VIN</span><strong className="fact-small">{vehicle.vin}</strong></div><div><Gauge /><span>Odometer</span><strong>{vehicle.odometerKm ? `${new Intl.NumberFormat("en-AU").format(vehicle.odometerKm)} km` : "Not recorded"}</strong></div><div><WalletCards /><span>Market value</span><strong>{vehicle.marketValue ? money.format(vehicle.marketValue) : "Not set"}</strong></div><div><CircleUserRound /><span>Current owner</span>{vehicle.ownerId ? <button type="button" onClick={() => onNavigate("customers")}>{vehicle.ownerName}</button> : <strong>Unowned</strong>}</div></div>}
              {tab === "Lifecycle" && <Timeline items={vehicle.timeline} />}
              {tab === "Work orders" && <><SectionToolbar title="Workshop history" detail={`${jobs.length} repair orders on file`} action={vehicle.ownerId ? "Book workshop" : undefined} onAction={() => setModal("book-service")} /><OperationalTable columns={["Repair order", "Status", "Opened", "Labour"]} rows={jobs.map((job) => [job.repairOrderNumber, job.status, dateFormatter.format(new Date(job.openedAt)), money.format(job.labourTotal)])} /></>}
              {tab === "Valuation" && <div className="valuation-panel"><div><span>Retail market</span><strong>{vehicle.marketValue ? money.format(vehicle.marketValue) : "Not set"}</strong></div>{estimatedTrade && <div><span>Estimated trade value</span><strong>{money.format(estimatedTrade)}</strong><em>Estimated at 93% of market value</em></div>}{wholesaleFloor && <div><span>Estimated wholesale floor</span><strong>{money.format(wholesaleFloor)}</strong><em>Estimated at 89% of market value</em></div>}<button type="button" onClick={() => setModal("edit-vehicle")}>Update valuation <ArrowRight /></button></div>}
              {tab === "Ownership" && <InfoGrid items={[["Current owner", vehicle.ownerName ?? "Unowned"], ["Contact", vehicle.ownerMobile ?? "Not on file"], ["Status", vehicle.status]]} />}
            </section>
          </div>
        </>}
      </section>
    </div>
    {modal === "create-vehicle" && <CreateVehicleModal saving={saving} onClose={() => setModal(null)} onSubmit={submitCreateVehicle} />}
    {modal === "edit-vehicle" && vehicle && <EditVehicleModal vehicle={vehicle} saving={saving} onClose={() => setModal(null)} onSubmit={submitEditVehicle} />}
    {modal === "book-service" && vehicle && <VehicleServiceModal saving={saving} onClose={() => setModal(null)} onSubmit={submitBookService} />}
    {toast && <Toast message={toast} />}
  </WorkspacePage>;
}

function CreateVehicleModal({ onClose, onSubmit, saving }: { saving: boolean; onClose: () => void; onSubmit: (form: { vin: string; make: string; model: string; variant: string; colour: string; registration: string; status: string }) => void }) {
  const [form, setForm] = useState({ vin: "", make: "", model: "", variant: "", colour: "", registration: "", status: "in-stock" });
  return <WorkflowModal title="Add vehicle to inventory" eyebrow="Vehicle intake" completeLabel="Create vehicle" busy={saving} onClose={onClose} onComplete={() => onSubmit(form)}>
    <div className="workflow-form-grid">
      <label><span>VIN</span><input required value={form.vin} onChange={(event) => setForm({ ...form, vin: event.target.value.toUpperCase() })} /></label>
      <label><span>Registration</span><input value={form.registration} onChange={(event) => setForm({ ...form, registration: event.target.value })} /></label>
      <label><span>Make</span><input required value={form.make} onChange={(event) => setForm({ ...form, make: event.target.value })} /></label>
      <label><span>Model</span><input required value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} /></label>
      <label><span>Variant</span><input value={form.variant} onChange={(event) => setForm({ ...form, variant: event.target.value })} /></label>
      <label><span>Colour</span><input value={form.colour} onChange={(event) => setForm({ ...form, colour: event.target.value })} /></label>
      <label><span>Status</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="in-stock">In stock</option><option value="demo">Demo</option><option value="reserved">Reserved</option><option value="customer-owned">Customer owned</option></select></label>
    </div>
  </WorkflowModal>;
}

function EditVehicleModal({ vehicle, onClose, onSubmit, saving }: { vehicle: Vehicle360; saving: boolean; onClose: () => void; onSubmit: (form: { registration: string; colour: string; odometerKm: string; marketValue: string; status: string }) => void }) {
  const [form, setForm] = useState({ registration: vehicle.registration ?? "", colour: vehicle.colour ?? "", odometerKm: vehicle.odometerKm?.toString() ?? "", marketValue: vehicle.marketValue?.toString() ?? "", status: vehicle.status });
  return <WorkflowModal title="Update vehicle" eyebrow="Vehicle record" completeLabel="Save changes" busy={saving} onClose={onClose} onComplete={() => onSubmit(form)}>
    <div className="workflow-form-grid">
      <label><span>Registration</span><input value={form.registration} onChange={(event) => setForm({ ...form, registration: event.target.value })} /></label>
      <label><span>Colour</span><input value={form.colour} onChange={(event) => setForm({ ...form, colour: event.target.value })} /></label>
      <label><span>Odometer (km)</span><input type="number" min="0" value={form.odometerKm} onChange={(event) => setForm({ ...form, odometerKm: event.target.value })} /></label>
      <label><span>Market value (AUD)</span><input type="number" min="0" value={form.marketValue} onChange={(event) => setForm({ ...form, marketValue: event.target.value })} /></label>
      <label><span>Status</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="in-stock">In stock</option><option value="demo">Demo</option><option value="reserved">Reserved</option><option value="customer-owned">Customer owned</option><option value="sold">Sold</option></select></label>
    </div>
  </WorkflowModal>;
}

function VehicleServiceModal({ onClose, onSubmit, saving }: { saving: boolean; onClose: () => void; onSubmit: (form: { repairOrderNumber: string; advisor: string; complaint: string }) => void }) {
  const [form, setForm] = useState({ repairOrderNumber: `RO-${Math.floor(Math.random() * 90000 + 10000)}`, advisor: "", complaint: "" });
  return <WorkflowModal title="Create workshop booking" eyebrow="Vehicle operations" completeLabel="Confirm booking" busy={saving} onClose={onClose} onComplete={() => onSubmit(form)}>
    <div className="workflow-form-grid">
      <label><span>Repair order number</span><input value={form.repairOrderNumber} onChange={(event) => setForm({ ...form, repairOrderNumber: event.target.value })} /></label>
      <label><span>Advisor</span><input value={form.advisor} onChange={(event) => setForm({ ...form, advisor: event.target.value })} /></label>
      <label className="workflow-form-full"><span>Work requested</span><input value={form.complaint} onChange={(event) => setForm({ ...form, complaint: event.target.value })} /></label>
    </div>
  </WorkflowModal>;
}

function InfoGrid({ items }: { items: string[][] }) {
  return <div className="info-grid">{items.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>;
}

export function WorkspacePage({ action, children }: { action?: ReactNode; children: ReactNode }) {
  return <div className="workspace-page">{action && <div className="workspace-page-toolbar">{action}</div>}{children}</div>;
}
