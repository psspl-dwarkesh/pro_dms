import { ArrowRight, CalendarDays, CarFront, Check, ClipboardList, Copy, FileText, Plus, Search, Trash2, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { apiDelete, apiGet, apiPatch, apiPost, ApiError } from "../../lib/api";
import { CurrencyField, DateField, DateTimeField, SelectField, TextArea, TextField } from "../components/forms";
import type { DashView, Lead, SalesOrder, Vehicle } from "../types";
import { CustomerPicker, VehiclePicker } from "./Pickers";
import { SearchState, Toast, WorkflowModal, WorkspacePage } from "./RecordViews";
import { useContextualActions } from "./SidebarActions";
import type { SidebarAction } from "./SidebarActions";
import "./sales360.css";

type TestDrive = { id: string; vehicleId: string; make?: string; model?: string; vin?: string; registration?: string; scheduledAt: string; status: string; feedback?: string };
type Quotation = { id: string; vehicleId?: string; make?: string; model?: string; amount: number; status: string; validUntil?: string; createdAt: string };
type FollowUp = { id: string; channel: string; summary: string; dueAt: string; completedAt?: string; createdAt: string };
type SalesLead = Lead & { customerMobile?: string; customerEmail?: string; testDrives: TestDrive[]; quotations: Quotation[]; followUps: FollowUp[]; salesOrder: SalesOrder | null };
type DialogKind = null | "lead" | "drive" | "quote" | "follow-up" | "order" | "delete";

const stages = ["new", "qualified", "test-drive", "quoted", "won", "lost"];
const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
const dateTime = new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "short" });

function useToast() {
  const [toast, setToast] = useState("");
  function notify(message: string) { setToast(message); window.setTimeout(() => setToast(""), 2800); }
  return { toast, notify };
}

export function Sales360({ onNavigate }: { onNavigate: (view: DashView, recordId?: string) => void }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lead, setLead] = useState<SalesLead | null>(null);
  const [stage, setStage] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [saving, setSaving] = useState(false);
  const { toast, notify } = useToast();

  function loadList() {
    setLoading(true); setError(null);
    apiGet<{ leads: Lead[] }>(`/api/v1/leads${stage ? `?stage=${stage}` : ""}`)
      .then(({ leads: rows }) => { setLeads(rows); setSelectedId((current) => current ?? rows[0]?.id ?? null); })
      .catch((cause) => setError(cause instanceof ApiError ? cause : new ApiError("Could not load the pipeline.", { status: 500 })))
      .finally(() => setLoading(false));
  }

  function loadLead(id: string) {
    setDetailLoading(true);
    apiGet<{ lead: SalesLead }>(`/api/v1/leads/${id}/360`)
      .then(({ lead: record }) => setLead(record)).catch(() => setLead(null)).finally(() => setDetailLoading(false));
  }

  useEffect(loadList, [stage]);
  useEffect(() => { if (selectedId) loadLead(selectedId); else setLead(null); }, [selectedId]);

  async function mutate(path: string, body: unknown, success: string) {
    if (!lead) return;
    setSaving(true);
    try { await apiPost(path, body); setDialog(null); loadLead(lead.id); loadList(); notify(success); }
    catch (cause) { notify(cause instanceof ApiError ? cause.message : "The change could not be saved."); }
    finally { setSaving(false); }
  }

  async function updateStage(nextStage: string) {
    if (!lead) return;
    try { await apiPatch(`/api/v1/leads/${lead.id}`, { stage: nextStage }); loadLead(lead.id); loadList(); notify(`Opportunity moved to ${nextStage}.`); }
    catch (cause) { notify(cause instanceof ApiError ? cause.message : "The stage could not be updated."); }
  }

  async function deleteLead() {
    if (!lead) return;
    setSaving(true);
    try { await apiDelete(`/api/v1/leads/${lead.id}`); setDialog(null); setSelectedId(null); setLead(null); loadList(); notify("Lead deleted."); }
    catch (cause) { notify(cause instanceof ApiError ? cause.message : "The lead could not be deleted."); }
    finally { setSaving(false); }
  }

  async function copy(label: string, value: string) {
    await navigator.clipboard.writeText(value); notify(`${label} copied.`);
  }

  useContextualActions(() => {
    const actions: SidebarAction[] = [{ id: "new-lead", label: "Create lead", icon: Plus, onClick: () => setDialog("lead") }];
    if (lead) actions.push(
      { id: "test-drive", label: "Schedule test drive", icon: CarFront, onClick: () => setDialog("drive") },
      { id: "quote", label: "Create quotation", icon: FileText, onClick: () => setDialog("quote") },
      { id: "follow-up", label: "Add follow-up", icon: CalendarDays, onClick: () => setDialog("follow-up") },
      { id: "delete", label: "Delete lead", icon: Trash2, tone: "danger", group: "This record", onClick: () => setDialog("delete") },
    );
    return actions;
  }, [lead]);

  const pipelineValue = useMemo(() => leads.filter((item) => !["won", "lost"].includes(item.stage)).reduce((sum, item) => sum + (item.expectedValue ?? 0), 0), [leads]);

  return <WorkspacePage>
    <div className="record-workbench sales360">
      <aside className="record-directory-panel">
        <header className="directory-panel-heading"><div><span>Opportunity pipeline</span><strong>{leads.length} records · {money.format(pipelineValue)} open</strong></div><button type="button" onClick={() => setDialog("lead")} aria-label="Create lead"><Plus /></button></header>
        <div className="record-search"><label><span className="sr-only">Filter by stage</span><select value={stage} onChange={(event) => setStage(event.target.value)}><option value="">All stages</option>{stages.map((item) => <option key={item}>{item}</option>)}</select></label></div>
        <SearchState loading={loading} error={error} />
        <section className="entity-directory" aria-label="Sales opportunities">
          {leads.map((item) => <button type="button" className={selectedId === item.id ? "selected" : ""} key={item.id} onClick={() => setSelectedId(item.id)}><span className="entity-list-icon"><UserRound /></span><div><strong>{item.customerName ?? "Unassigned customer"}</strong><small>{item.interestedVehicle ?? item.source}</small></div><em>{item.stage}</em><b>{item.expectedValue ? money.format(item.expectedValue) : "—"}</b><ArrowRight /></button>)}
          {!loading && !leads.length && <div className="customer-list-empty"><Search />No opportunities match this stage.</div>}
        </section>
      </aside>
      <section className="record-detail-panel">
        {detailLoading && <div className="empty-state"><Search /><strong>Loading sales journey</strong></div>}
        {!detailLoading && !lead && <div className="empty-state"><ClipboardList /><strong>No opportunity selected</strong><p>Create a lead to begin a connected enquiry-to-delivery journey.</p></div>}
        {!detailLoading && lead && <div className="sales360-detail">
          <section className="record-main-card">
            <div className="record-identity"><div className="record-avatar"><UserRound /></div><div><span>{lead.source} · opened {dateTime.format(new Date(lead.createdAt))}</span><h3>{lead.customerName ?? "Unassigned customer"}</h3><p>{lead.interestedVehicle ?? "Vehicle interest not recorded"}</p></div><label><span className="sr-only">Opportunity stage</span><select value={lead.stage} onChange={(event) => updateStage(event.target.value)}>{stages.map((item) => <option key={item}>{item}</option>)}</select></label></div>
            <div className="sales360-links">
              {lead.customerId && <button type="button" onClick={() => onNavigate("customers", lead.customerId!)}>Open connected Customer 360</button>}
              {lead.salesOrder?.vehicleId && <button type="button" onClick={() => onNavigate("vehicles", lead.salesOrder!.vehicleId)}>Open connected Vehicle 360</button>}
              {lead.customerMobile && <button type="button" onClick={() => copy("Mobile", lead.customerMobile!)}><Copy />Copy mobile <span>{lead.customerMobile}</span></button>}
              {lead.customerEmail && <button type="button" onClick={() => copy("Email", lead.customerEmail!)}><Copy />Copy email <span>{lead.customerEmail}</span></button>}
            </div>
            <div className="sales360-kpis"><div><span>Test drives</span><strong>{lead.testDrives.length}</strong></div><div><span>Quotations</span><strong>{lead.quotations.length}</strong></div><div><span>Open follow-ups</span><strong>{lead.followUps.filter((item) => !item.completedAt).length}</strong></div><div><span>Order</span><strong>{lead.salesOrder ? lead.salesOrder.status : "Not placed"}</strong></div></div>
          </section>
          <JourneySection title="Test drives" action="Schedule" onAction={() => setDialog("drive")} items={lead.testDrives.map((item) => ({ id: item.id, title: `${item.make ?? "Vehicle"} ${item.model ?? ""}`, detail: `${dateTime.format(new Date(item.scheduledAt))} · ${item.status}`, meta: item.registration ?? item.vin }))} />
          <JourneySection title="Quotations" action="New quote" onAction={() => setDialog("quote")} items={lead.quotations.map((item) => ({ id: item.id, title: money.format(item.amount), detail: `${item.status} · created ${dateTime.format(new Date(item.createdAt))}`, meta: item.validUntil ? `Valid until ${item.validUntil}` : undefined }))} />
          <JourneySection title="Follow-ups" action="Add follow-up" onAction={() => setDialog("follow-up")} items={lead.followUps.map((item) => ({ id: item.id, title: item.summary, detail: `${item.channel} · due ${dateTime.format(new Date(item.dueAt))}`, meta: item.completedAt ? "Completed" : "Open", complete: !item.completedAt ? () => apiPatch(`/api/v1/leads/${lead.id}/follow-ups/${item.id}`, { completed: true }).then(() => { loadLead(lead.id); notify("Follow-up completed."); }) : undefined }))} />
          <section className="sales360-order"><div><span>Order and delivery</span><strong>{lead.salesOrder ? `${money.format(lead.salesOrder.totalAmount)} · ${lead.salesOrder.status}` : "No order yet"}</strong></div>{!lead.salesOrder && lead.customerId && <button type="button" onClick={() => setDialog("order")}>Create order</button>}{lead.salesOrder && <button type="button" onClick={() => onNavigate("finance")}>Continue in Finance 360</button>}</section>
        </div>}
      </section>
    </div>
    {dialog === "lead" && <LeadDialog saving={saving} onClose={() => setDialog(null)} onSubmit={(body) => { setSaving(true); apiPost<{ lead: Lead }>("/api/v1/leads", body).then(({ lead: created }) => { setDialog(null); loadList(); setSelectedId(created.id); notify("Lead created."); }).catch((cause) => notify(cause instanceof ApiError ? cause.message : "Lead could not be created.")).finally(() => setSaving(false)); }} />}
    {dialog === "drive" && lead && <DriveDialog saving={saving} onClose={() => setDialog(null)} onSubmit={(body) => mutate(`/api/v1/leads/${lead.id}/test-drives`, body, "Test drive scheduled.")} />}
    {dialog === "quote" && lead && <QuoteDialog saving={saving} onClose={() => setDialog(null)} onSubmit={(body) => mutate(`/api/v1/leads/${lead.id}/quotations`, body, "Quotation created.")} />}
    {dialog === "follow-up" && lead && <FollowUpDialog saving={saving} onClose={() => setDialog(null)} onSubmit={(body) => mutate(`/api/v1/leads/${lead.id}/follow-ups`, body, "Follow-up added.")} />}
    {dialog === "order" && lead && <OrderDialog saving={saving} onClose={() => setDialog(null)} onSubmit={(body) => mutate("/api/v1/sales-orders", { ...body, customerId: lead.customerId, leadId: lead.id, status: "pending" }, "Order created.")} />}
    {dialog === "delete" && lead && <WorkflowModal title="Delete lead?" eyebrow="Destructive action" completeLabel="Delete lead" busy={saving} onClose={() => setDialog(null)} onComplete={deleteLead}><p>This permanently removes the lead for {lead.customerName ?? "this customer"}. Cancel if the record should be retained for audit or follow-up.</p></WorkflowModal>}
    {toast && <Toast message={toast} />}
  </WorkspacePage>;
}

function JourneySection({ title, action, onAction, items }: { title: string; action: string; onAction: () => void; items: Array<{ id: string; title: string; detail: string; meta?: string; complete?: () => void }> }) {
  return <section className="sales360-section"><header><div><span>Sales journey</span><h3>{title}</h3></div><button type="button" onClick={onAction}><Plus />{action}</button></header>{items.length ? <div className="sales360-items">{items.map((item) => <article key={item.id}><div><strong>{item.title}</strong><span>{item.detail}</span>{item.meta && <small>{item.meta}</small>}</div>{item.complete && <button type="button" onClick={item.complete}><Check />Mark complete</button>}</article>)}</div> : <p>No {title.toLowerCase()} recorded yet.</p>}</section>;
}

function LeadDialog({ saving, onClose, onSubmit }: { saving: boolean; onClose: () => void; onSubmit: (body: object) => void }) { const [form, setForm] = useState({ customerId: "", customerLabel: "", source: "web", interestedVehicle: "", expectedValue: "" }); return <WorkflowModal title="Create lead" eyebrow="Sales 360" completeLabel="Create lead" busy={saving} onClose={onClose} onComplete={() => onSubmit({ ...form, customerLabel: undefined, expectedValue: form.expectedValue ? Number(form.expectedValue) : undefined })}><div className="workflow-form-grid"><CustomerPicker className="workflow-form-full" label="Customer" required selectedId={form.customerId} value={form.customerLabel} onClear={() => setForm({ ...form, customerId: "", customerLabel: "" })} onSelect={(customer) => setForm({ ...form, customerId: customer.id, customerLabel: customer.displayName })} /><SelectField label="Source" required value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}><option value="web">Web enquiry</option><option value="walk-in">Walk-in</option><option value="phone">Phone</option><option value="referral">Referral</option></SelectField><TextField label="Vehicle or model interest" value={form.interestedVehicle} onChange={(e) => setForm({ ...form, interestedVehicle: e.target.value })} /><CurrencyField label="Expected value" value={form.expectedValue} onChange={(e) => setForm({ ...form, expectedValue: e.target.value })} /></div></WorkflowModal>; }
function DriveDialog({ saving, onClose, onSubmit }: DialogProps) { const [form, setForm] = useState({ vehicleId: "", vehicleLabel: "", scheduledAt: "", status: "scheduled" }); return <WorkflowModal title="Schedule test drive" eyebrow="Sales journey" busy={saving} onClose={onClose} onComplete={() => onSubmit({ ...form, vehicleLabel: undefined })}><div className="workflow-form-grid"><VehiclePicker className="workflow-form-full" label="Vehicle" required selectedId={form.vehicleId} value={form.vehicleLabel} onClear={() => setForm({ ...form, vehicleId: "", vehicleLabel: "" })} onSelect={(vehicle: Vehicle) => setForm({ ...form, vehicleId: vehicle.id, vehicleLabel: `${vehicle.make} ${vehicle.model}` })} /><DateTimeField label="Scheduled time" required value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} /></div></WorkflowModal>; }
function QuoteDialog({ saving, onClose, onSubmit }: DialogProps) { const [form, setForm] = useState({ vehicleId: "", vehicleLabel: "", amount: "", status: "draft", validUntil: "" }); return <WorkflowModal title="Create quotation" eyebrow="Sales journey" completeLabel="Create quote" busy={saving} onClose={onClose} onComplete={() => onSubmit({ ...form, vehicleLabel: undefined, amount: Number(form.amount) })}><div className="workflow-form-grid"><VehiclePicker className="workflow-form-full" label="Vehicle" selectedId={form.vehicleId} value={form.vehicleLabel} onClear={() => setForm({ ...form, vehicleId: "", vehicleLabel: "" })} onSelect={(vehicle: Vehicle) => setForm({ ...form, vehicleId: vehicle.id, vehicleLabel: `${vehicle.make} ${vehicle.model}` })} /><CurrencyField label="Amount" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /><DateField label="Valid until" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} /></div></WorkflowModal>; }
function FollowUpDialog({ saving, onClose, onSubmit }: DialogProps) { const [form, setForm] = useState({ channel: "call", summary: "", dueAt: "" }); return <WorkflowModal title="Add follow-up" eyebrow="Sales journey" completeLabel="Add follow-up" busy={saving} onClose={onClose} onComplete={() => onSubmit(form)}><div className="workflow-form-grid"><SelectField label="Channel" required value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}><option>call</option><option>email</option><option>sms</option><option>whatsapp</option><option>in-person</option></SelectField><DateTimeField label="Due time" required value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} /><TextArea className="workflow-form-full" label="Next action" required value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} /></div></WorkflowModal>; }
function OrderDialog({ saving, onClose, onSubmit }: DialogProps) { const [form, setForm] = useState({ vehicleId: "", vehicleLabel: "", totalAmount: "" }); return <WorkflowModal title="Create sales order" eyebrow="Order and delivery" completeLabel="Create order" busy={saving} onClose={onClose} onComplete={() => onSubmit({ ...form, vehicleLabel: undefined, totalAmount: Number(form.totalAmount) })}><div className="workflow-form-grid"><VehiclePicker className="workflow-form-full" label="Vehicle" required selectedId={form.vehicleId} value={form.vehicleLabel} onClear={() => setForm({ ...form, vehicleId: "", vehicleLabel: "" })} onSelect={(vehicle: Vehicle) => setForm({ ...form, vehicleId: vehicle.id, vehicleLabel: `${vehicle.make} ${vehicle.model}` })} /><CurrencyField label="Total amount" required value={form.totalAmount} onChange={(e) => setForm({ ...form, totalAmount: e.target.value })} /></div></WorkflowModal>; }
type DialogProps = { saving: boolean; onClose: () => void; onSubmit: (body: Record<string, unknown>) => void };
