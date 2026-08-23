import {
  ArrowRight, CalendarDays, CarFront, CircleUserRound, Download, FileText,
  Mail, Phone, Plus, Search, ShieldCheck, Trash2, UserRound, Wrench,
} from "lucide-react";
import { useEffect, useState } from "react";
import { apiDelete, apiGet, apiPatch, apiPost, ApiError } from "../../lib/api";
import type {
  DashView, Lead, Lead360, SalesOrder, SalesOrder360,
  ServiceJob, ServiceJob360, Vehicle,
} from "../types";
import { CustomerPicker, VehiclePicker } from "./Pickers";
import { SearchState, Timeline, Toast, WorkflowModal, WorkspacePage } from "./RecordViews";
import type { SidebarAction } from "./SidebarActions";
import { useContextualActions } from "./SidebarActions";

const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric" });

function useToast() {
  const [toast, setToast] = useState("");
  function notify(message: string) { setToast(message); window.setTimeout(() => setToast(""), 2600); }
  return { toast, notify };
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
// Sales 360 - directory of leads, detail shows the full enquiry-to-delivery journey
// ---------------------------------------------------------------------------

const LEAD_STAGES = ["new", "qualified", "test-drive", "quoted", "won", "lost"];

type SalesModal = null | "create-lead" | "log-test-drive" | "convert-to-sale";
type SalesViewProps = { onNavigate: (view: DashView) => void };

export function SalesView({ onNavigate }: SalesViewProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<ApiError | null>(null);
  const [stageFilter, setStageFilter] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lead, setLead] = useState<Lead360 | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [modal, setModal] = useState<SalesModal>(null);
  const [saving, setSaving] = useState(false);
  const { toast, notify } = useToast();

  function loadList() {
    setListLoading(true);
    setListError(null);
    apiGet<{ leads: Lead[] }>(`/api/v1/leads${stageFilter ? `?stage=${stageFilter}` : ""}`)
      .then((result) => {
        setLeads(result.leads);
        if (!selectedId && result.leads.length) setSelectedId(result.leads[0].id);
      })
      .catch((cause) => setListError(cause instanceof ApiError ? cause : new ApiError("Could not load leads.", { status: 500 })))
      .finally(() => setListLoading(false));
  }

  function loadLead(id: string) {
    setDetailLoading(true);
    apiGet<{ lead: Lead360 }>(`/api/v1/leads/${id}/360`)
      .then((result) => setLead(result.lead))
      .catch(() => setLead(null))
      .finally(() => setDetailLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadList(); }, [stageFilter]);
  useEffect(() => { if (selectedId) loadLead(selectedId); else setLead(null); }, [selectedId]);

  async function createLead(form: { customerId: string; customerLabel: string; source: string; interestedVehicle: string; expectedValue: string }) {
    setSaving(true);
    try {
      const result = await apiPost<{ lead: Lead }>("/api/v1/leads", { customerId: form.customerId || undefined, source: form.source, interestedVehicle: form.interestedVehicle, expectedValue: form.expectedValue ? Number(form.expectedValue) : undefined });
      setModal(null);
      loadList();
      setSelectedId(result.lead.id);
      notify("Lead created.");
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not create the lead.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStage(stage: string) {
    if (!lead) return;
    try {
      await apiPatch(`/api/v1/leads/${lead.id}`, { stage });
      loadLead(lead.id);
      loadList();
      notify(`Lead moved to ${stage}.`);
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not update the lead.");
    }
  }

  async function deleteLead() {
    if (!lead) return;
    if (!window.confirm(`Delete this lead for ${lead.customerName ?? "an unassigned customer"}? This cannot be undone.`)) return;
    try {
      await apiDelete(`/api/v1/leads/${lead.id}`);
      setSelectedId(null);
      loadList();
      notify("Lead deleted.");
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not delete the lead.");
    }
  }

  async function logTestDrive(_form: { vehicleId: string; scheduledAt: string }) {
    // Test drive logging has no dedicated endpoint yet - tracked as a known gap, not silently dropped.
    notify("Test drive logging is not wired up to the API yet.");
    setModal(null);
  }

  async function convertToSale(form: { vehicleId: string; totalAmount: string }) {
    if (!lead || !lead.customerId) return;
    setSaving(true);
    try {
      await apiPost("/api/v1/sales-orders", { customerId: lead.customerId, vehicleId: form.vehicleId, leadId: lead.id, totalAmount: Number(form.totalAmount), status: "pending" });
      setModal(null);
      loadLead(lead.id);
      notify("Converted to a sale - open Finance and insurance to attach a contract or policy.");
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not convert this lead to a sale.");
    } finally {
      setSaving(false);
    }
  }

  useContextualActions(() => {
    if (!lead) return [];
    const list: SidebarAction[] = [
      { id: "log-test-drive", label: "Log test drive", detail: "Schedule or record a drive", icon: CalendarDays, onClick: () => setModal("log-test-drive") },
    ];
    if (lead.stage === "won" && !lead.salesOrder) list.push({ id: "convert-to-sale", label: "Convert to sale", detail: "Create the sales order", icon: ArrowRight, onClick: () => setModal("convert-to-sale") });
    if (lead.salesOrder) list.push({ id: "open-finance", label: "Open in Finance", detail: "View contract and insurance", icon: ShieldCheck, onClick: () => onNavigate("finance") });
    list.push({ id: "export", label: "Export", icon: Download, onClick: () => { exportCsv(lead.customerName ?? "lead"); notify("CSV exported."); }, group: "This record" });
    list.push({ id: "delete", label: "Delete", icon: Trash2, tone: "danger", onClick: deleteLead, group: "This record" });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead]);

  const openLeads = leads.filter((item) => item.stage !== "won" && item.stage !== "lost");
  const pipelineValue = openLeads.reduce((total, item) => total + (item.expectedValue ?? 0), 0);

  return <WorkspacePage>
    <div className="record-workbench">
      <aside className="record-directory-panel">
        <header className="directory-panel-heading"><div><span>Lead directory</span><strong>{leads.length} leads - {money.format(pipelineValue)} open pipeline</strong></div><button type="button" onClick={() => setModal("create-lead")} aria-label="Create lead"><Plus /></button></header>
        <div className="record-search" style={{ display: "grid", gridTemplateColumns: "1fr" }}>
          <select value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}><option value="">All stages</option>{LEAD_STAGES.map((stage) => <option key={stage} value={stage}>{stage}</option>)}</select>
        </div>
        <SearchState loading={listLoading} error={listError} />
        <section className="entity-directory">
          {leads.map((entry) => <button type="button" className={selectedId === entry.id ? "selected" : ""} key={entry.id} onClick={() => setSelectedId(entry.id)}><span className="entity-list-icon"><UserRound /></span><div><strong>{entry.customerName ?? "Unassigned customer"}</strong><small>{entry.interestedVehicle ?? entry.source}</small></div><em>{entry.stage}</em><b>{entry.expectedValue ? money.format(entry.expectedValue) : "-"}</b><ArrowRight /></button>)}
          {!listLoading && !leads.length && <div className="customer-list-empty"><Search />No leads yet. Create one to start the pipeline.</div>}
        </section>
      </aside>
      <section className="record-detail-panel">
        {detailLoading && <div className="empty-state"><Search /><strong>Loading lead</strong></div>}
        {!detailLoading && !lead && <div className="empty-state"><Search /><strong>No lead selected</strong><p>Create a lead to start tracking an opportunity.</p></div>}
        {!detailLoading && lead && <div className="record-layout">
          <section className="record-main-card">
            <div className="record-identity">
              <div className="record-avatar">{(lead.customerName ?? "??").split(" ").map((p) => p[0]).slice(0, 2).join("")}</div>
              <div><span>{lead.source} - enquired {dateFormatter.format(new Date(lead.createdAt))}</span><h3>{lead.customerName ?? "Unassigned customer"}</h3><p>{lead.customerMobile && <><Phone size={14} />{lead.customerMobile}</>}{lead.customerEmail && <><Mail size={14} />{lead.customerEmail}</>}</p></div>
              <select value={lead.stage} onChange={(event) => updateStage(event.target.value)}>{LEAD_STAGES.map((stage) => <option key={stage} value={stage}>{stage}</option>)}</select>
            </div>
            <div className="record-facts">
              <div><CarFront /><span>Interested vehicle</span><strong>{lead.interestedVehicle ?? "Not noted"}</strong></div>
              <div><CircleUserRound /><span>Expected value</span><strong>{lead.expectedValue ? money.format(lead.expectedValue) : "Not set"}</strong></div>
              <div><CalendarDays /><span>Test drives</span><strong>{lead.testDrives.length}</strong></div>
              <div><ArrowRight /><span>Sale</span>{lead.salesOrder ? <button type="button" onClick={() => onNavigate("finance")}>{money.format(lead.salesOrder.totalAmount)}</button> : <strong>Not converted</strong>}</div>
            </div>
            {lead.testDrives.length > 0 && <Timeline items={lead.testDrives.map((drive) => ({ occurredAt: drive.scheduledAt, type: "test drive", summary: `${drive.status}${drive.feedback ? ` - ${drive.feedback}` : ""}` }))} />}
          </section>
        </div>}
      </section>
    </div>
    {modal === "create-lead" && <CreateLeadDialog saving={saving} onClose={() => setModal(null)} onSubmit={createLead} />}
    {modal === "log-test-drive" && <LogTestDriveModal saving={saving} onClose={() => setModal(null)} onSubmit={logTestDrive} />}
    {modal === "convert-to-sale" && lead && <ConvertToSaleModal customerName={lead.customerName ?? "this customer"} saving={saving} onClose={() => setModal(null)} onSubmit={convertToSale} />}
    {toast && <Toast message={toast} />}
  </WorkspacePage>;
}

function CreateLeadDialog({ onClose, onSubmit, saving }: { saving: boolean; onClose: () => void; onSubmit: (form: { customerId: string; customerLabel: string; source: string; interestedVehicle: string; expectedValue: string }) => void }) {
  const [form, setForm] = useState({ customerId: "", customerLabel: "", source: "web", interestedVehicle: "", expectedValue: "" });
  return <WorkflowModal title="Create lead" eyebrow="Sales pipeline" completeLabel="Create lead" busy={saving} onClose={onClose} onComplete={() => onSubmit(form)}>
    <div className="workflow-form-grid">
      <label className="workflow-form-full"><span>Customer</span><CustomerPicker value={form.customerLabel} onSelect={(customer) => setForm({ ...form, customerId: customer.id, customerLabel: customer.displayName })} /></label>
      <label><span>Source</span><select value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })}><option value="web">Web enquiry</option><option value="walk-in">Walk-in</option><option value="phone">Phone</option><option value="referral">Referral</option></select></label>
      <label><span>Vehicle interest</span><input value={form.interestedVehicle} onChange={(event) => setForm({ ...form, interestedVehicle: event.target.value })} /></label>
      <label><span>Expected value (AUD)</span><input type="number" min="0" value={form.expectedValue} onChange={(event) => setForm({ ...form, expectedValue: event.target.value })} /></label>
    </div>
  </WorkflowModal>;
}

function LogTestDriveModal({ onClose, onSubmit, saving }: { saving: boolean; onClose: () => void; onSubmit: (form: { vehicleId: string; scheduledAt: string }) => void }) {
  const [form, setForm] = useState({ vehicleId: "", vehicleLabel: "", scheduledAt: "" });
  return <WorkflowModal title="Log test drive" eyebrow="Sales pipeline" completeLabel="Log drive" busy={saving} onClose={onClose} onComplete={() => onSubmit(form)}>
    <div className="workflow-form-grid">
      <label className="workflow-form-full"><span>Vehicle</span><VehiclePicker value={form.vehicleLabel} onSelect={(vehicle: Vehicle) => setForm({ ...form, vehicleId: vehicle.id, vehicleLabel: `${vehicle.make} ${vehicle.model}` })} /></label>
      <label className="workflow-form-full"><span>Scheduled for</span><input type="datetime-local" value={form.scheduledAt} onChange={(event) => setForm({ ...form, scheduledAt: event.target.value })} /></label>
    </div>
  </WorkflowModal>;
}

function ConvertToSaleModal({ customerName, onClose, onSubmit, saving }: { customerName: string; saving: boolean; onClose: () => void; onSubmit: (form: { vehicleId: string; totalAmount: string }) => void }) {
  const [form, setForm] = useState({ vehicleId: "", vehicleLabel: "", totalAmount: "" });
  return <WorkflowModal title="Convert to sale" eyebrow={`Sales pipeline - ${customerName}`} completeLabel="Create sale" busy={saving} onClose={onClose} onComplete={() => onSubmit(form)}>
    <div className="workflow-form-grid">
      <label className="workflow-form-full"><span>Vehicle</span><VehiclePicker value={form.vehicleLabel} onSelect={(vehicle: Vehicle) => setForm({ ...form, vehicleId: vehicle.id, vehicleLabel: `${vehicle.make} ${vehicle.model}` })} /></label>
      <label className="workflow-form-full"><span>Total amount (AUD)</span><input required type="number" min="0" value={form.totalAmount} onChange={(event) => setForm({ ...form, totalAmount: event.target.value })} /></label>
    </div>
  </WorkflowModal>;
}

// ---------------------------------------------------------------------------
// Service 360 - directory of repair orders, detail shows the full job context
// ---------------------------------------------------------------------------

const JOB_STATUSES = ["booked", "checked-in", "diagnosing", "awaiting-approval", "in-progress", "quality-check", "closed"];

export function ServiceView({ onNavigate }: { onNavigate: (view: DashView) => void }) {
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<ApiError | null>(null);
  const [statusFilter, setStatusFilter] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [job, setJob] = useState<ServiceJob360 | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast, notify } = useToast();

  function loadList() {
    setListLoading(true);
    setListError(null);
    apiGet<{ serviceJobs: ServiceJob[] }>(`/api/v1/service-jobs${statusFilter ? `?status=${statusFilter}` : ""}`)
      .then((result) => {
        setJobs(result.serviceJobs);
        if (!selectedId && result.serviceJobs.length) setSelectedId(result.serviceJobs[0].id);
      })
      .catch((cause) => setListError(cause instanceof ApiError ? cause : new ApiError("Could not load service jobs.", { status: 500 })))
      .finally(() => setListLoading(false));
  }

  function loadJob(id: string) {
    setDetailLoading(true);
    apiGet<{ serviceJob: ServiceJob360 }>(`/api/v1/service-jobs/${id}/360`)
      .then((result) => setJob(result.serviceJob))
      .catch(() => setJob(null))
      .finally(() => setDetailLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadList(); }, [statusFilter]);
  useEffect(() => { if (selectedId) loadJob(selectedId); else setJob(null); }, [selectedId]);

  async function createJob(form: { customerId: string; vehicleId: string; repairOrderNumber: string; advisor: string; complaint: string }) {
    setSaving(true);
    try {
      const result = await apiPost<{ serviceJob: ServiceJob }>("/api/v1/service-jobs", form);
      setModal(false);
      loadList();
      setSelectedId(result.serviceJob.id);
      notify("Repair order created.");
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not create the repair order.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(status: string) {
    if (!job) return;
    try {
      await apiPatch(`/api/v1/service-jobs/${job.id}`, { status });
      loadJob(job.id);
      loadList();
      notify(`Repair order ${job.repairOrderNumber} moved to ${status}.`);
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not update the repair order.");
    }
  }

  useContextualActions(() => {
    if (!job) return [];
    const list: SidebarAction[] = [
      { id: "new-booking", label: "New booking", icon: Plus, onClick: () => setModal(true) },
    ];
    if (job.customerId) list.push({ id: "open-customer", label: "Open customer", detail: "View Customer 360", icon: CircleUserRound, onClick: () => onNavigate("customers") });
    list.push({ id: "export", label: "Export", icon: Download, onClick: () => { exportCsv(job.repairOrderNumber); notify("CSV exported."); }, group: "This record" });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job]);

  const active = jobs.filter((item) => item.status !== "closed");
  const revenue = jobs.reduce((total, item) => total + item.labourTotal + item.partsTotal, 0);

  return <WorkspacePage>
    <div className="record-workbench">
      <aside className="record-directory-panel">
        <header className="directory-panel-heading"><div><span>Workshop directory</span><strong>{active.length} active - {money.format(revenue)} total</strong></div><button type="button" onClick={() => setModal(true)} aria-label="New booking"><Plus /></button></header>
        <div className="record-search" style={{ display: "grid", gridTemplateColumns: "1fr" }}>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All statuses</option>{JOB_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select>
        </div>
        <SearchState loading={listLoading} error={listError} />
        <section className="entity-directory">
          {jobs.map((entry) => <button type="button" className={selectedId === entry.id ? "selected" : ""} key={entry.id} onClick={() => setSelectedId(entry.id)}><span className="entity-list-icon"><Wrench /></span><div><strong>{entry.repairOrderNumber} - {entry.customerName}</strong><small>{entry.make} {entry.model}</small></div><em>{entry.status}</em><b>{money.format(entry.labourTotal + entry.partsTotal)}</b><ArrowRight /></button>)}
          {!listLoading && !jobs.length && <div className="customer-list-empty"><Search />No repair orders yet. Book one to get started.</div>}
        </section>
      </aside>
      <section className="record-detail-panel">
        {detailLoading && <div className="empty-state"><Search /><strong>Loading repair order</strong></div>}
        {!detailLoading && !job && <div className="empty-state"><Search /><strong>No repair order selected</strong><p>Book a repair order to see its connected record.</p></div>}
        {!detailLoading && job && <div className="record-layout">
          <section className="record-main-card">
            <div className="record-identity">
              <div className="record-avatar"><Wrench size={20} /></div>
              <div><span>{job.make} {job.model}{job.variant ? ` ${job.variant}` : ""} - {job.registration ?? job.vin}</span><h3>{job.repairOrderNumber}</h3><p>{job.customerName}{job.customerMobile && <><Phone size={14} />{job.customerMobile}</>}</p></div>
              <select value={job.status} onChange={(event) => updateStatus(event.target.value)}>{JOB_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select>
            </div>
            <div className="record-facts">
              <div><UserRound /><span>Advisor</span><strong>{job.advisor ?? "Unassigned"}</strong></div>
              <div><Wrench /><span>Technician</span><strong>{job.technician ?? "Unassigned"}</strong></div>
              <div><FileText /><span>Complaint</span><strong className="fact-small">{job.complaint ?? "None on file"}</strong></div>
              <div><CircleUserRound /><span>Odometer</span><strong>{job.odometerKm ? `${new Intl.NumberFormat("en-AU").format(job.odometerKm)} km` : "Not recorded"}</strong></div>
            </div>
            <div className="record-facts">
              <div><span>Labour</span><strong>{money.format(job.labourTotal)}</strong></div>
              <div><span>Parts</span><strong>{money.format(job.partsTotal)}</strong></div>
              <div><span>Opened</span><strong>{dateFormatter.format(new Date(job.openedAt))}</strong></div>
              <div><span>{job.closedAt ? "Closed" : "Promised"}</span><strong>{job.closedAt ? dateFormatter.format(new Date(job.closedAt)) : job.promisedAt ? dateFormatter.format(new Date(job.promisedAt)) : "Not set"}</strong></div>
            </div>
          </section>
        </div>}
      </section>
    </div>
    {modal && <CreateServiceJobDialog saving={saving} onClose={() => setModal(false)} onSubmit={createJob} />}
    {toast && <Toast message={toast} />}
  </WorkspacePage>;
}

function CreateServiceJobDialog({ onClose, onSubmit, saving }: { saving: boolean; onClose: () => void; onSubmit: (form: { customerId: string; vehicleId: string; repairOrderNumber: string; advisor: string; complaint: string }) => void }) {
  const [form, setForm] = useState({ customerId: "", customerLabel: "", vehicleId: "", vehicleLabel: "", repairOrderNumber: `RO-${Math.floor(Math.random() * 90000 + 10000)}`, advisor: "", complaint: "" });
  return <WorkflowModal title="Create repair order" eyebrow="Service booking" completeLabel="Create booking" busy={saving} onClose={onClose} onComplete={() => onSubmit(form)}>
    <div className="workflow-form-grid">
      <label className="workflow-form-full"><span>Customer</span><CustomerPicker value={form.customerLabel} onSelect={(customer) => setForm({ ...form, customerId: customer.id, customerLabel: customer.displayName })} /></label>
      <label className="workflow-form-full"><span>Vehicle</span><VehiclePicker value={form.vehicleLabel} onSelect={(vehicle) => setForm({ ...form, vehicleId: vehicle.id, vehicleLabel: `${vehicle.make} ${vehicle.model}` })} /></label>
      <label><span>Repair order number</span><input value={form.repairOrderNumber} onChange={(event) => setForm({ ...form, repairOrderNumber: event.target.value })} /></label>
      <label><span>Advisor</span><input value={form.advisor} onChange={(event) => setForm({ ...form, advisor: event.target.value })} /></label>
      <label className="workflow-form-full"><span>Complaint or work requested</span><input value={form.complaint} onChange={(event) => setForm({ ...form, complaint: event.target.value })} /></label>
    </div>
  </WorkflowModal>;
}

// ---------------------------------------------------------------------------
// Finance 360 - directory of sales orders (deals), detail shows the contract and any policies
// ---------------------------------------------------------------------------

const ORDER_STATUSES = ["pending", "financed", "delivered", "cancelled"];
type FinanceModal = null | "create-order" | "create-contract" | "create-policy";

export function FinanceView() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<ApiError | null>(null);
  const [statusFilter, setStatusFilter] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [order, setOrder] = useState<SalesOrder360 | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [modal, setModal] = useState<FinanceModal>(null);
  const [saving, setSaving] = useState(false);
  const { toast, notify } = useToast();

  function loadList() {
    setListLoading(true);
    setListError(null);
    apiGet<{ salesOrders: SalesOrder[] }>(`/api/v1/sales-orders${statusFilter ? `?status=${statusFilter}` : ""}`)
      .then((result) => {
        setOrders(result.salesOrders);
        if (!selectedId && result.salesOrders.length) setSelectedId(result.salesOrders[0].id);
      })
      .catch((cause) => setListError(cause instanceof ApiError ? cause : new ApiError("Could not load deals.", { status: 500 })))
      .finally(() => setListLoading(false));
  }

  function loadOrder(id: string) {
    setDetailLoading(true);
    apiGet<{ salesOrder: SalesOrder360 }>(`/api/v1/sales-orders/${id}/360`)
      .then((result) => setOrder(result.salesOrder))
      .catch(() => setOrder(null))
      .finally(() => setDetailLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadList(); }, [statusFilter]);
  useEffect(() => { if (selectedId) loadOrder(selectedId); else setOrder(null); }, [selectedId]);

  async function createOrder(form: { customerId: string; vehicleId: string; totalAmount: string }) {
    setSaving(true);
    try {
      const result = await apiPost<{ salesOrder: SalesOrder }>("/api/v1/sales-orders", { customerId: form.customerId, vehicleId: form.vehicleId, totalAmount: Number(form.totalAmount), status: "pending" });
      setModal(null);
      loadList();
      setSelectedId(result.salesOrder.id);
      notify("Deal created.");
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not create the deal.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(status: string) {
    if (!order) return;
    try {
      await apiPatch(`/api/v1/sales-orders/${order.id}`, { status });
      loadOrder(order.id);
      loadList();
      notify(`Deal moved to ${status}.`);
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not update the deal.");
    }
  }

  async function createContract(form: { provider: string; productType: string; amountFinanced: string }) {
    if (!order) return;
    setSaving(true);
    try {
      await apiPost("/api/v1/finance-contracts", { salesOrderId: order.id, ...form, amountFinanced: Number(form.amountFinanced) });
      setModal(null);
      loadOrder(order.id);
      notify("Finance contract created.");
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not create the finance contract.");
    } finally {
      setSaving(false);
    }
  }

  async function createPolicy(form: { provider: string; policyNumber: string; startsOn: string; expiresOn: string; premium: string }) {
    if (!order) return;
    setSaving(true);
    try {
      await apiPost("/api/v1/insurance-policies", { customerId: order.customerId, vehicleId: order.vehicleId, ...form, premium: form.premium ? Number(form.premium) : undefined });
      setModal(null);
      loadOrder(order.id);
      notify("Insurance policy created.");
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not create the insurance policy.");
    } finally {
      setSaving(false);
    }
  }

  useContextualActions(() => {
    if (!order) return [];
    const list: SidebarAction[] = [];
    if (!order.financeContract) list.push({ id: "create-contract", label: "Create finance contract", icon: FileText, onClick: () => setModal("create-contract") });
    list.push({ id: "create-policy", label: "Create insurance policy", icon: ShieldCheck, onClick: () => setModal("create-policy") });
    list.push({ id: "export", label: "Export", icon: Download, onClick: () => { exportCsv(`${order.customerName}-deal`); notify("CSV exported."); }, group: "This record" });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order]);

  return <WorkspacePage>
    <div className="record-workbench">
      <aside className="record-directory-panel">
        <header className="directory-panel-heading"><div><span>Deal directory</span><strong>{orders.length} deals</strong></div><button type="button" onClick={() => setModal("create-order")} aria-label="Create deal"><Plus /></button></header>
        <div className="record-search" style={{ display: "grid", gridTemplateColumns: "1fr" }}>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All statuses</option>{ORDER_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select>
        </div>
        <SearchState loading={listLoading} error={listError} />
        <section className="entity-directory">
          {orders.map((entry) => <button type="button" className={selectedId === entry.id ? "selected" : ""} key={entry.id} onClick={() => setSelectedId(entry.id)}><span className="entity-list-icon"><ShieldCheck /></span><div><strong>{entry.customerName}</strong><small>{entry.make} {entry.model}</small></div><em>{entry.status}</em><b>{money.format(entry.totalAmount)}</b><ArrowRight /></button>)}
          {!listLoading && !orders.length && <div className="customer-list-empty"><Search />No deals yet. Create one, or convert a won lead from Sales and CRM.</div>}
        </section>
      </aside>
      <section className="record-detail-panel">
        {detailLoading && <div className="empty-state"><Search /><strong>Loading deal</strong></div>}
        {!detailLoading && !order && <div className="empty-state"><Search /><strong>No deal selected</strong><p>Create a deal, or convert a won lead from Sales and CRM.</p></div>}
        {!detailLoading && order && <div className="record-layout">
          <section className="record-main-card">
            <div className="record-identity">
              <div className="record-avatar"><CarFront size={20} /></div>
              <div><span>{order.make} {order.model}{order.variant ? ` ${order.variant}` : ""} - {order.registration ?? order.vin}</span><h3>{order.customerName}</h3><p>{order.customerMobile && <><Phone size={14} />{order.customerMobile}</>}{order.customerEmail && <><Mail size={14} />{order.customerEmail}</>}</p></div>
              <select value={order.status} onChange={(event) => updateStatus(event.target.value)}>{ORDER_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select>
            </div>
            <div className="record-facts">
              <div><ShieldCheck /><span>Total amount</span><strong>{money.format(order.totalAmount)}</strong></div>
              <div><CalendarDays /><span>Ordered</span><strong>{dateFormatter.format(new Date(order.orderedAt))}</strong></div>
              <div><CalendarDays /><span>Delivered</span><strong>{order.deliveredAt ? dateFormatter.format(new Date(order.deliveredAt)) : "Not yet"}</strong></div>
              <div><ArrowRight /><span>Origin</span><strong>{order.leadId ? "Converted from a lead" : "Created directly"}</strong></div>
            </div>
            <div className="record-section-heading"><div><span>Finance</span><strong>{order.financeContract ? order.financeContract.provider : "No contract yet"}</strong></div></div>
            {order.financeContract ? <div className="record-facts">
              <div><span>Product</span><strong>{order.financeContract.productType}</strong></div>
              <div><span>Amount financed</span><strong>{money.format(order.financeContract.amountFinanced)}</strong></div>
              <div><span>Status</span><strong>{order.financeContract.status}</strong></div>
              <div><span>Commission</span><strong>{money.format(order.financeContract.commission)}</strong></div>
            </div> : <div className="timeline-empty">No finance contract on this deal yet.</div>}
            <div className="record-section-heading"><div><span>Insurance</span><strong>{order.insurancePolicies.length} polic{order.insurancePolicies.length === 1 ? "y" : "ies"}</strong></div></div>
            {order.insurancePolicies.length > 0 ? order.insurancePolicies.map((policy) => (
              <div className="record-facts" key={policy.id}>
                <div><span>Provider</span><strong>{policy.provider}</strong></div>
                <div><span>Policy number</span><strong className="fact-small">{policy.policyNumber}</strong></div>
                <div><span>Status</span><strong>{policy.status}</strong></div>
                <div><span>Expires</span><strong>{dateFormatter.format(new Date(policy.expiresOn))}</strong></div>
              </div>
            )) : <div className="timeline-empty">No insurance policy on file for this customer and vehicle.</div>}
          </section>
        </div>}
      </section>
    </div>
    {modal === "create-order" && <CreateSalesOrderDialog saving={saving} onClose={() => setModal(null)} onSubmit={createOrder} />}
    {modal === "create-contract" && order && <CreateFinanceContractModal saving={saving} onClose={() => setModal(null)} onSubmit={createContract} />}
    {modal === "create-policy" && order && <CreateInsurancePolicyModal customerName={order.customerName} saving={saving} onClose={() => setModal(null)} onSubmit={createPolicy} />}
    {toast && <Toast message={toast} />}
  </WorkspacePage>;
}

function CreateSalesOrderDialog({ onClose, onSubmit, saving }: { saving: boolean; onClose: () => void; onSubmit: (form: { customerId: string; vehicleId: string; totalAmount: string }) => void }) {
  const [form, setForm] = useState({ customerId: "", customerLabel: "", vehicleId: "", vehicleLabel: "", totalAmount: "" });
  return <WorkflowModal title="Create deal" eyebrow="Finance and insurance" completeLabel="Create deal" busy={saving} onClose={onClose} onComplete={() => onSubmit(form)}>
    <div className="workflow-form-grid">
      <label className="workflow-form-full"><span>Customer</span><CustomerPicker value={form.customerLabel} onSelect={(customer) => setForm({ ...form, customerId: customer.id, customerLabel: customer.displayName })} /></label>
      <label className="workflow-form-full"><span>Vehicle</span><VehiclePicker value={form.vehicleLabel} onSelect={(vehicle) => setForm({ ...form, vehicleId: vehicle.id, vehicleLabel: `${vehicle.make} ${vehicle.model}` })} /></label>
      <label className="workflow-form-full"><span>Total amount (AUD)</span><input required type="number" min="0" value={form.totalAmount} onChange={(event) => setForm({ ...form, totalAmount: event.target.value })} /></label>
    </div>
  </WorkflowModal>;
}

function CreateFinanceContractModal({ onClose, onSubmit, saving }: { saving: boolean; onClose: () => void; onSubmit: (form: { provider: string; productType: string; amountFinanced: string }) => void }) {
  const [form, setForm] = useState({ provider: "", productType: "loan", amountFinanced: "" });
  return <WorkflowModal title="Create finance contract" eyebrow="This deal" completeLabel="Create contract" busy={saving} onClose={onClose} onComplete={() => onSubmit(form)}>
    <div className="workflow-form-grid">
      <label><span>Provider</span><input required value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value })} /></label>
      <label><span>Product type</span><select value={form.productType} onChange={(event) => setForm({ ...form, productType: event.target.value })}><option value="loan">Loan</option><option value="lease">Lease</option><option value="balloon">Balloon</option></select></label>
      <label><span>Amount financed (AUD)</span><input required type="number" min="0" value={form.amountFinanced} onChange={(event) => setForm({ ...form, amountFinanced: event.target.value })} /></label>
    </div>
  </WorkflowModal>;
}

function CreateInsurancePolicyModal({ customerName, onClose, onSubmit, saving }: { customerName: string; saving: boolean; onClose: () => void; onSubmit: (form: { provider: string; policyNumber: string; startsOn: string; expiresOn: string; premium: string }) => void }) {
  const [form, setForm] = useState({ provider: "", policyNumber: "", startsOn: "", expiresOn: "", premium: "" });
  return <WorkflowModal title="Create insurance policy" eyebrow={`This deal - ${customerName}`} completeLabel="Create policy" busy={saving} onClose={onClose} onComplete={() => onSubmit(form)}>
    <div className="workflow-form-grid">
      <label><span>Provider</span><input required value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value })} /></label>
      <label><span>Policy number</span><input required value={form.policyNumber} onChange={(event) => setForm({ ...form, policyNumber: event.target.value })} /></label>
      <label><span>Starts on</span><input required type="date" value={form.startsOn} onChange={(event) => setForm({ ...form, startsOn: event.target.value })} /></label>
      <label><span>Expires on</span><input required type="date" value={form.expiresOn} onChange={(event) => setForm({ ...form, expiresOn: event.target.value })} /></label>
      <label><span>Premium (AUD)</span><input type="number" min="0" value={form.premium} onChange={(event) => setForm({ ...form, premium: event.target.value })} /></label>
    </div>
  </WorkflowModal>;
}
