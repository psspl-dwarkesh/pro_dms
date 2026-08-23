import { AlertTriangle, BadgeCheck, CalendarClock, Download, Filter, Package, Plus, Users, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { apiGet, apiPatch, apiPost, ApiError } from "../../lib/api";
import type { DashView, FinanceContract, InsurancePolicy, Lead, Overview, Part, SalesOrder, ServiceJob } from "../types";
import { CustomerPicker, VehiclePicker } from "./Pickers";
import { Toast, WorkflowModal, WorkspacePage } from "./RecordViews";

const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric" });

function MetricCard({ label, value, meta, tone = "neutral" }: { label: string; value: string; meta: string; tone?: "good" | "warn" | "bad" | "neutral" }) {
  return <div className="metric-card"><span>{label}</span><strong>{value}</strong><em className={`tone-${tone}`}>{meta}</em></div>;
}

function useToast() {
  const [toast, setToast] = useState("");
  function notify(message: string) { setToast(message); window.setTimeout(() => setToast(""), 2600); }
  return { toast, notify };
}

// ---------------------------------------------------------------------------
// Executive overview
// ---------------------------------------------------------------------------

export function OverviewView({ onNavigate }: { onNavigate: (view: DashView) => void }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    apiGet<{ overview: Overview }>("/api/v1/overview")
      .then((result) => setOverview(result.overview))
      .catch((cause) => setError(cause instanceof ApiError ? cause : new ApiError("Could not load the overview.", { status: 500 })));
  }, []);

  return (
    <WorkspacePage>
      {error && <p className="inline-error"><AlertTriangle size={14} />{error.message}</p>}
      {!overview && !error && <p className="record-search-state">Loading operating signals...</p>}
      {overview && (
        <>
          <div className="executive-metrics">
            <MetricCard label="Revenue this month" value={money.format(overview.revenueMtd)} meta="Sum of sales orders placed this month" tone={overview.revenueMtd > 0 ? "good" : "neutral"} />
            <MetricCard label="Units sold this month" value={String(overview.unitsSoldMtd)} meta="Sales orders placed this month" tone="neutral" />
            <MetricCard label="Open leads" value={String(overview.openLeads)} meta="Leads not yet won or lost" tone={overview.openLeads > 0 ? "warn" : "good"} />
            <MetricCard label="Active service jobs" value={String(overview.activeServiceJobs)} meta="Repair orders not yet closed" tone={overview.activeServiceJobs > 0 ? "warn" : "good"} />
          </div>
          <div className="overview-grid">
            <section className="workspace-card exception-card">
              <div className="card-heading"><div><span>Open work</span><strong>Where to focus next</strong></div></div>
              <div className="exception-list">
                <button type="button" onClick={() => onNavigate("sales")}><span className="exception-icon warn"><Users /></span><div><strong>{overview.openLeads} open leads</strong><p>Sales and CRM pipeline</p></div><em>Open</em></button>
                <button type="button" onClick={() => onNavigate("service")}><span className="exception-icon warn"><Wrench /></span><div><strong>{overview.activeServiceJobs} active service jobs</strong><p>Service workshop</p></div><em>Open</em></button>
                <button type="button" onClick={() => onNavigate("parts")}><span className="exception-icon bad"><Package /></span><div><strong>{overview.lowStockParts} parts at or below reorder point</strong><p>Parts control</p></div><em>Reorder</em></button>
                <button type="button" onClick={() => onNavigate("customers")}><span className="exception-icon good"><BadgeCheck /></span><div><strong>Customer 360</strong><p>Search and manage customers</p></div><em>Open</em></button>
              </div>
            </section>
            <section className="workspace-card agenda-card">
              <div className="card-heading"><div><span>Connected record spine</span><strong>Every module shares one record</strong></div><CalendarClock size={18} /></div>
              <div><p><strong>Customer 360</strong><span>Search a name, mobile, or email to see everything connected to that relationship.</span></p></div>
              <div><p><strong>Vehicle 360</strong><span>Search a VIN or registration to see ownership, service, and valuation history.</span></p></div>
            </section>
          </div>
        </>
      )}
    </WorkspacePage>
  );
}

// ---------------------------------------------------------------------------
// Sales (leads)
// ---------------------------------------------------------------------------

const LEAD_STAGES = ["new", "qualified", "test-drive", "quoted", "won", "lost"];

function SalesView() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [stageFilter, setStageFilter] = useState("");
  const [modal, setModal] = useState<null | "create" | number>(null);
  const [saving, setSaving] = useState(false);
  const { toast, notify } = useToast();

  function load() {
    setLoading(true);
    apiGet<{ leads: Lead[] }>(`/api/v1/leads${stageFilter ? `?stage=${stageFilter}` : ""}`)
      .then((result) => setLeads(result.leads))
      .catch((cause) => setError(cause instanceof ApiError ? cause : new ApiError("Could not load leads.", { status: 500 })))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [stageFilter]);

  const openLeads = leads.filter((lead) => lead.stage !== "won" && lead.stage !== "lost");
  const pipelineValue = openLeads.reduce((total, lead) => total + (lead.expectedValue ?? 0), 0);

  async function createLead(form: { customerId: string; customerLabel: string; source: string; interestedVehicle: string; expectedValue: string }) {
    setSaving(true);
    try {
      await apiPost("/api/v1/leads", { customerId: form.customerId || undefined, source: form.source, interestedVehicle: form.interestedVehicle, expectedValue: form.expectedValue ? Number(form.expectedValue) : undefined });
      setModal(null);
      load();
      notify("Lead created.");
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not create the lead.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStage(lead: Lead, stage: string) {
    try {
      await apiPatch(`/api/v1/leads/${lead.id}`, { stage });
      load();
      notify(`Lead moved to ${stage}.`);
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not update the lead.");
    }
  }

  function exportQueue() {
    const lines = ["lead,customer,stage,expected_value", ...leads.map((lead) => `"${lead.source}","${lead.customerName ?? ""}","${lead.stage}","${lead.expectedValue ?? 0}"`)];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "leads.csv"; anchor.click(); URL.revokeObjectURL(url);
    notify("Leads exported.");
  }

  return (
    <WorkspacePage action={<button type="button" className="workspace-button workspace-button--dark" onClick={() => setModal("create")}><Plus size={15} /> Create lead</button>}>
      {error && <p className="inline-error"><AlertTriangle size={14} />{error.message}</p>}
      <div className="executive-metrics">
        <MetricCard label="Open leads" value={String(openLeads.length)} meta={`${leads.length} total leads`} tone="neutral" />
        <MetricCard label="Open pipeline value" value={money.format(pipelineValue)} meta="Sum of expected value on open leads" tone="good" />
        <MetricCard label="Won" value={String(leads.filter((lead) => lead.stage === "won").length)} meta="Leads marked won" tone="good" />
        <MetricCard label="Lost" value={String(leads.filter((lead) => lead.stage === "lost").length)} meta="Leads marked lost" tone="bad" />
      </div>
      <section className="workspace-card queue-card">
        <div className="card-heading">
          <div><span>Lead pipeline</span><strong>{loading ? "Loading..." : `${leads.length} leads`}</strong></div>
          <div className="queue-tools">
            <select value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}><option value="">All stages</option>{LEAD_STAGES.map((stage) => <option key={stage} value={stage}>{stage}</option>)}</select>
            <button type="button" onClick={exportQueue}><Download />Export</button>
          </div>
        </div>
        <div className="work-queue">
          {leads.map((lead) => (
            <div className="work-queue-row" key={lead.id}>
              <div><strong>{lead.customerName ?? "Unassigned customer"}</strong><p>{lead.interestedVehicle ?? lead.source}</p></div>
              <span className="queue-meta">{lead.expectedValue ? money.format(lead.expectedValue) : "-"}</span>
              <select value={lead.stage} onChange={(event) => updateStage(lead, event.target.value)}>{LEAD_STAGES.map((stage) => <option key={stage} value={stage}>{stage}</option>)}</select>
            </div>
          ))}
          {!loading && !leads.length && <div className="timeline-empty">No leads yet. Create one to start the pipeline.</div>}
        </div>
      </section>
      {modal === "create" && <CreateLeadDialog saving={saving} onClose={() => setModal(null)} onSubmit={createLead} />}
      {toast && <Toast message={toast} />}
    </WorkspacePage>
  );
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

// ---------------------------------------------------------------------------
// Service (repair orders)
// ---------------------------------------------------------------------------

const JOB_STATUSES = ["booked", "checked-in", "diagnosing", "awaiting-approval", "in-progress", "quality-check", "closed"];

function ServiceView() {
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast, notify } = useToast();

  function load() {
    setLoading(true);
    apiGet<{ serviceJobs: ServiceJob[] }>(`/api/v1/service-jobs${statusFilter ? `?status=${statusFilter}` : ""}`)
      .then((result) => setJobs(result.serviceJobs))
      .catch((cause) => setError(cause instanceof ApiError ? cause : new ApiError("Could not load service jobs.", { status: 500 })))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [statusFilter]);

  const active = jobs.filter((job) => job.status !== "closed");
  const revenue = jobs.reduce((total, job) => total + job.labourTotal + job.partsTotal, 0);

  async function createJob(form: { customerId: string; vehicleId: string; repairOrderNumber: string; advisor: string; complaint: string }) {
    setSaving(true);
    try {
      await apiPost("/api/v1/service-jobs", form);
      setModal(false);
      load();
      notify("Repair order created.");
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not create the repair order.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(job: ServiceJob, status: string) {
    try {
      await apiPatch(`/api/v1/service-jobs/${job.id}`, { status });
      load();
      notify(`Repair order ${job.repairOrderNumber} moved to ${status}.`);
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not update the repair order.");
    }
  }

  return (
    <WorkspacePage action={<button type="button" className="workspace-button workspace-button--dark" onClick={() => setModal(true)}><Plus size={15} /> New booking</button>}>
      {error && <p className="inline-error"><AlertTriangle size={14} />{error.message}</p>}
      <div className="executive-metrics">
        <MetricCard label="Active jobs" value={String(active.length)} meta={`${jobs.length} total repair orders`} tone="neutral" />
        <MetricCard label="Workshop revenue" value={money.format(revenue)} meta="Labour and parts across all jobs" tone="good" />
        <MetricCard label="Awaiting approval" value={String(jobs.filter((job) => job.status === "awaiting-approval").length)} meta="Repair orders on hold" tone="warn" />
        <MetricCard label="Closed" value={String(jobs.filter((job) => job.status === "closed").length)} meta="Completed repair orders" tone="good" />
      </div>
      <section className="workspace-card queue-card">
        <div className="card-heading">
          <div><span>Repair orders</span><strong>{loading ? "Loading..." : `${jobs.length} jobs`}</strong></div>
          <div className="queue-tools"><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All statuses</option>{JOB_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></div>
        </div>
        <div className="work-queue">
          {jobs.map((job) => (
            <div className="work-queue-row" key={job.id}>
              <div><strong>{job.repairOrderNumber} - {job.customerName}</strong><p>{job.make} {job.model} - {job.complaint ?? "No complaint on file"}</p></div>
              <span className="queue-meta">{money.format(job.labourTotal + job.partsTotal)}</span>
              <select value={job.status} onChange={(event) => updateStatus(job, event.target.value)}>{JOB_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select>
            </div>
          ))}
          {!loading && !jobs.length && <div className="timeline-empty">No repair orders yet.</div>}
        </div>
      </section>
      {modal && <CreateServiceJobDialog saving={saving} onClose={() => setModal(false)} onSubmit={createJob} />}
      {toast && <Toast message={toast} />}
    </WorkspacePage>
  );
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
// Parts
// ---------------------------------------------------------------------------

function PartsView() {
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast, notify } = useToast();

  function load() {
    setLoading(true);
    apiGet<{ parts: Part[] }>(`/api/v1/parts${lowStockOnly ? "?lowStock=true" : ""}`)
      .then((result) => setParts(result.parts))
      .catch((cause) => setError(cause instanceof ApiError ? cause : new ApiError("Could not load parts.", { status: 500 })))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [lowStockOnly]);

  const stockValue = parts.reduce((total, part) => total + part.unitCost * part.quantityOnHand, 0);
  const lowStockCount = parts.filter((part) => part.quantityOnHand <= part.reorderPoint).length;

  async function createPart(form: { sku: string; name: string; quantityOnHand: string; reorderPoint: string; unitCost: string; retailPrice: string }) {
    setSaving(true);
    try {
      await apiPost("/api/v1/parts", { ...form, quantityOnHand: Number(form.quantityOnHand), reorderPoint: Number(form.reorderPoint), unitCost: Number(form.unitCost), retailPrice: Number(form.retailPrice) });
      setModal(false);
      load();
      notify("Part added.");
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not create the part.");
    } finally {
      setSaving(false);
    }
  }

  async function adjustStock(part: Part, delta: number) {
    try {
      await apiPatch(`/api/v1/parts/${part.id}`, { quantityOnHand: Math.max(0, part.quantityOnHand + delta) });
      load();
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not update stock.");
    }
  }

  return (
    <WorkspacePage action={<button type="button" className="workspace-button workspace-button--dark" onClick={() => setModal(true)}><Plus size={15} /> Add part</button>}>
      {error && <p className="inline-error"><AlertTriangle size={14} />{error.message}</p>}
      <div className="executive-metrics">
        <MetricCard label="Parts on file" value={String(parts.length)} meta="Total SKUs" tone="neutral" />
        <MetricCard label="Stock value" value={money.format(stockValue)} meta="Unit cost times quantity on hand" tone="neutral" />
        <MetricCard label="At or below reorder point" value={String(lowStockCount)} meta="Needs replenishment" tone={lowStockCount > 0 ? "bad" : "good"} />
      </div>
      <section className="workspace-card queue-card">
        <div className="card-heading"><div><span>Parts inventory</span><strong>{loading ? "Loading..." : `${parts.length} parts`}</strong></div><div className="queue-tools"><button type="button" className={lowStockOnly ? "active" : ""} onClick={() => setLowStockOnly((value) => !value)}><Filter />Low stock only</button></div></div>
        <div className="work-queue">
          {parts.map((part) => (
            <div className="work-queue-row" key={part.id}>
              <div><strong>{part.name}</strong><p>{part.sku}</p></div>
              <span className="queue-meta">{part.quantityOnHand} on hand - reorder at {part.reorderPoint}</span>
              <div className="stock-adjust"><button type="button" onClick={() => adjustStock(part, -1)}>-</button><button type="button" onClick={() => adjustStock(part, 1)}>+</button></div>
            </div>
          ))}
          {!loading && !parts.length && <div className="timeline-empty">No parts on file yet.</div>}
        </div>
      </section>
      {modal && <CreatePartDialog saving={saving} onClose={() => setModal(false)} onSubmit={createPart} />}
      {toast && <Toast message={toast} />}
    </WorkspacePage>
  );
}

function CreatePartDialog({ onClose, onSubmit, saving }: { saving: boolean; onClose: () => void; onSubmit: (form: { sku: string; name: string; quantityOnHand: string; reorderPoint: string; unitCost: string; retailPrice: string }) => void }) {
  const [form, setForm] = useState({ sku: "", name: "", quantityOnHand: "0", reorderPoint: "0", unitCost: "0", retailPrice: "0" });
  return <WorkflowModal title="Add part" eyebrow="Parts control" completeLabel="Add part" busy={saving} onClose={onClose} onComplete={() => onSubmit(form)}>
    <div className="workflow-form-grid">
      <label><span>SKU</span><input required value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} /></label>
      <label><span>Name</span><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
      <label><span>Quantity on hand</span><input type="number" min="0" value={form.quantityOnHand} onChange={(event) => setForm({ ...form, quantityOnHand: event.target.value })} /></label>
      <label><span>Reorder point</span><input type="number" min="0" value={form.reorderPoint} onChange={(event) => setForm({ ...form, reorderPoint: event.target.value })} /></label>
      <label><span>Unit cost (AUD)</span><input type="number" min="0" value={form.unitCost} onChange={(event) => setForm({ ...form, unitCost: event.target.value })} /></label>
      <label><span>Retail price (AUD)</span><input type="number" min="0" value={form.retailPrice} onChange={(event) => setForm({ ...form, retailPrice: event.target.value })} /></label>
    </div>
  </WorkflowModal>;
}

// ---------------------------------------------------------------------------
// Finance and insurance
// ---------------------------------------------------------------------------

function FinanceView() {
  const [contracts, setContracts] = useState<FinanceContract[]>([]);
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [tab, setTab] = useState<"contracts" | "policies">("contracts");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [modal, setModal] = useState<null | "contract" | "policy">(null);
  const [saving, setSaving] = useState(false);
  const { toast, notify } = useToast();

  function load() {
    setLoading(true);
    Promise.all([
      apiGet<{ financeContracts: FinanceContract[] }>("/api/v1/finance-contracts"),
      apiGet<{ insurancePolicies: InsurancePolicy[] }>("/api/v1/insurance-policies"),
    ])
      .then(([financeResult, insuranceResult]) => { setContracts(financeResult.financeContracts); setPolicies(insuranceResult.insurancePolicies); })
      .catch((cause) => setError(cause instanceof ApiError ? cause : new ApiError("Could not load finance data.", { status: 500 })))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const financedTotal = contracts.reduce((total, contract) => total + contract.amountFinanced, 0);
  const activePolicies = policies.filter((policy) => policy.status === "active").length;

  async function createContract(form: { salesOrderId: string; provider: string; productType: string; amountFinanced: string }) {
    setSaving(true);
    try {
      await apiPost("/api/v1/finance-contracts", { ...form, amountFinanced: Number(form.amountFinanced) });
      setModal(null);
      load();
      notify("Finance contract created.");
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not create the finance contract.");
    } finally {
      setSaving(false);
    }
  }

  async function createPolicy(form: { customerId: string; vehicleId: string; provider: string; policyNumber: string; startsOn: string; expiresOn: string; premium: string }) {
    setSaving(true);
    try {
      await apiPost("/api/v1/insurance-policies", { ...form, premium: form.premium ? Number(form.premium) : undefined });
      setModal(null);
      load();
      notify("Insurance policy created.");
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not create the insurance policy.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <WorkspacePage action={<button type="button" className="workspace-button workspace-button--dark" onClick={() => setModal(tab === "contracts" ? "contract" : "policy")}><Plus size={15} /> {tab === "contracts" ? "New contract" : "New policy"}</button>}>
      {error && <p className="inline-error"><AlertTriangle size={14} />{error.message}</p>}
      <div className="executive-metrics">
        <MetricCard label="Finance contracts" value={String(contracts.length)} meta="Total contracts on file" tone="neutral" />
        <MetricCard label="Amount financed" value={money.format(financedTotal)} meta="Sum across all contracts" tone="good" />
        <MetricCard label="Active insurance policies" value={String(activePolicies)} meta={`${policies.length} total policies`} tone="good" />
      </div>
      <div className="record-tabs" role="tablist"><button role="tab" aria-selected={tab === "contracts"} className={tab === "contracts" ? "active" : ""} type="button" onClick={() => setTab("contracts")}>Finance contracts</button><button role="tab" aria-selected={tab === "policies"} className={tab === "policies" ? "active" : ""} type="button" onClick={() => setTab("policies")}>Insurance policies</button></div>
      {tab === "contracts" && (
        <section className="workspace-card queue-card">
          <div className="work-queue">
            {contracts.map((contract) => <div className="work-queue-row" key={contract.id}><div><strong>{contract.customerName}</strong><p>{contract.provider} - {contract.productType}</p></div><span className="queue-meta">{money.format(contract.amountFinanced)}</span><em className="queue-status">{contract.status}</em></div>)}
            {!loading && !contracts.length && <div className="timeline-empty">No finance contracts yet.</div>}
          </div>
        </section>
      )}
      {tab === "policies" && (
        <section className="workspace-card queue-card">
          <div className="work-queue">
            {policies.map((policy) => <div className="work-queue-row" key={policy.id}><div><strong>{policy.customerName}</strong><p>{policy.provider} - {policy.policyNumber}</p></div><span className="queue-meta">Expires {dateFormatter.format(new Date(policy.expiresOn))}</span><em className="queue-status">{policy.status}</em></div>)}
            {!loading && !policies.length && <div className="timeline-empty">No insurance policies yet.</div>}
          </div>
        </section>
      )}
      {modal === "contract" && <CreateFinanceContractDialog saving={saving} onClose={() => setModal(null)} onSubmit={createContract} />}
      {modal === "policy" && <CreateInsurancePolicyDialog saving={saving} onClose={() => setModal(null)} onSubmit={createPolicy} />}
      {toast && <Toast message={toast} />}
    </WorkspacePage>
  );
}

function CreateFinanceContractDialog({ onClose, onSubmit, saving }: { saving: boolean; onClose: () => void; onSubmit: (form: { salesOrderId: string; provider: string; productType: string; amountFinanced: string }) => void }) {
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [form, setForm] = useState({ salesOrderId: "", provider: "", productType: "loan", amountFinanced: "" });
  useEffect(() => { apiGet<{ salesOrders: SalesOrder[] }>("/api/v1/sales-orders?limit=20").then((result) => setSalesOrders(result.salesOrders)).catch(() => setSalesOrders([])); }, []);
  return <WorkflowModal title="Create finance contract" eyebrow="Finance workflow" completeLabel="Create contract" busy={saving} onClose={onClose} onComplete={() => onSubmit(form)}>
    <div className="workflow-form-grid">
      <label className="workflow-form-full"><span>Sales order</span><select required value={form.salesOrderId} onChange={(event) => setForm({ ...form, salesOrderId: event.target.value })}><option value="">Select a sales order</option>{salesOrders.map((order) => <option key={order.id} value={order.id}>{order.customerName} - {order.make} {order.model} - {money.format(order.totalAmount)}</option>)}</select></label>
      {!salesOrders.length && <p className="workflow-form-full inline-error"><AlertTriangle size={14} />No sales orders yet. Create one from a customer record first.</p>}
      <label><span>Provider</span><input required value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value })} /></label>
      <label><span>Product type</span><select value={form.productType} onChange={(event) => setForm({ ...form, productType: event.target.value })}><option value="loan">Loan</option><option value="lease">Lease</option><option value="balloon">Balloon</option></select></label>
      <label><span>Amount financed (AUD)</span><input required type="number" min="0" value={form.amountFinanced} onChange={(event) => setForm({ ...form, amountFinanced: event.target.value })} /></label>
    </div>
  </WorkflowModal>;
}

function CreateInsurancePolicyDialog({ onClose, onSubmit, saving }: { saving: boolean; onClose: () => void; onSubmit: (form: { customerId: string; vehicleId: string; provider: string; policyNumber: string; startsOn: string; expiresOn: string; premium: string }) => void }) {
  const [form, setForm] = useState({ customerId: "", customerLabel: "", vehicleId: "", vehicleLabel: "", provider: "", policyNumber: "", startsOn: "", expiresOn: "", premium: "" });
  return <WorkflowModal title="Create insurance policy" eyebrow="Insurance workflow" completeLabel="Create policy" busy={saving} onClose={onClose} onComplete={() => onSubmit(form)}>
    <div className="workflow-form-grid">
      <label className="workflow-form-full"><span>Customer</span><CustomerPicker value={form.customerLabel} onSelect={(customer) => setForm({ ...form, customerId: customer.id, customerLabel: customer.displayName })} /></label>
      <label className="workflow-form-full"><span>Vehicle</span><VehiclePicker value={form.vehicleLabel} onSelect={(vehicle) => setForm({ ...form, vehicleId: vehicle.id, vehicleLabel: `${vehicle.make} ${vehicle.model}` })} /></label>
      <label><span>Provider</span><input required value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value })} /></label>
      <label><span>Policy number</span><input required value={form.policyNumber} onChange={(event) => setForm({ ...form, policyNumber: event.target.value })} /></label>
      <label><span>Starts on</span><input required type="date" value={form.startsOn} onChange={(event) => setForm({ ...form, startsOn: event.target.value })} /></label>
      <label><span>Expires on</span><input required type="date" value={form.expiresOn} onChange={(event) => setForm({ ...form, expiresOn: event.target.value })} /></label>
      <label><span>Premium (AUD)</span><input type="number" min="0" value={form.premium} onChange={(event) => setForm({ ...form, premium: event.target.value })} /></label>
    </div>
  </WorkflowModal>;
}

// ---------------------------------------------------------------------------

export function DomainView({ view }: { view: "sales" | "service" | "parts" | "finance" }) {
  if (view === "sales") return <SalesView />;
  if (view === "service") return <ServiceView />;
  if (view === "parts") return <PartsView />;
  return <FinanceView />;
}
