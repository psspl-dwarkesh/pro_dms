import { AlertCircle, BadgeDollarSign, CalendarClock, Copy, FileCheck2, Plus, RefreshCw, ReceiptText, ShieldCheck } from "lucide-react";
import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import { apiGet, apiPatch, apiPost, ApiError } from "../../lib/api";
import { Toast, WorkflowModal } from "./RecordViews";
import { useContextualActions } from "./SidebarActions";
import "./finance360.css";

type ApplicationDocument = { id: string; documentType: string; status: string };
type Application = { id: string; applicantName: string; lender: string; requestedAmount: number; status: string; assignedTo?: string; documentCount: number; receivedDocumentCount: number; payoutReference?: string; updatedAt: string; documents: ApplicationDocument[] };
type Contract = { id: string; salesOrderId: string; provider: string; productType: string; amountFinanced: number; status: string; commission: number; customerName: string; make: string; model: string; registration?: string };
type Payable = { id: string; supplierName: string; invoiceNumber: string; description?: string; amount: number; currency: string; dueOn: string; status: string; assignedTo?: string };
type Policy = { id: string; provider: string; policyNumber: string; status: string; startsOn: string; expiresOn: string; premium?: number; customerName: string; make: string; model: string; registration?: string };
type FinanceData = { applications: Application[]; contracts: Contract[]; policies: Policy[]; payables: Payable[] };
type Tab = "applications" | "contracts" | "insurance" | "payables";
type Modal = null | "application" | "payable" | { documentFor: string };

const money = (amount: number, currency = "AUD") => new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
const date = new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric" });

export function Finance360() {
  const [data, setData] = useState<FinanceData>({ applications: [], contracts: [], policies: [], payables: [] });
  const [tab, setTab] = useState<Tab>("applications");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [toast, setToast] = useState("");

  function notify(message: string) { setToast(message); window.setTimeout(() => setToast(""), 2800); }
  function load() {
    setLoading(true); setError(null);
    apiGet<{ finance: FinanceData }>("/api/v1/finance?limit=100")
      .then((result) => setData(result.finance))
      .catch((cause) => setError(cause instanceof ApiError ? cause : new ApiError("Finance 360 could not be loaded.", { status: 500 })))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);
  useContextualActions(() => [
    { id: "new-application", label: "New finance application", icon: BadgeDollarSign, onClick: () => setModal("application") },
    { id: "new-payable", label: "Record bill or payable", icon: ReceiptText, onClick: () => setModal("payable") },
    { id: "refresh-finance", label: "Refresh Finance 360", icon: RefreshCw, onClick: load, group: "This record" },
  ], []);

  const metrics = useMemo(() => ({
    decisions: data.applications.filter((item) => ["submitted", "documents_pending"].includes(item.status)).length,
    payouts: data.applications.filter((item) => item.status === "approved").reduce((sum, item) => sum + item.requestedAmount, 0),
    renewals: data.policies.filter((item) => item.status === "active" && new Date(item.expiresOn) <= new Date(Date.now() + 90 * 86400000)).length,
    payables: data.payables.filter((item) => !["paid", "void"].includes(item.status)).reduce((sum, item) => sum + item.amount, 0),
  }), [data]);

  async function transition(kind: "applications" | "payables", id: string, status: string) {
    try { await apiPatch(`/api/v1/finance/${kind}/${id}`, { status }); await load(); notify(`Status updated to ${status.replaceAll("_", " ")}.`); }
    catch (cause) { notify(cause instanceof ApiError ? cause.message : "The status could not be updated."); }
  }
  async function copy(label: string, value: string) { try { await navigator.clipboard.writeText(value); notify(`${label} copied.`); } catch { notify(`${label} could not be copied.`); } }
  function handleTabs(event: KeyboardEvent<HTMLDivElement>) {
    const tabs: Tab[] = ["applications", "contracts", "insurance", "payables"];
    const current = tabs.indexOf(tab);
    const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : event.key === "ArrowRight" ? (current + 1) % tabs.length : event.key === "ArrowLeft" ? (current - 1 + tabs.length) % tabs.length : -1;
    if (next >= 0) { event.preventDefault(); setTab(tabs[next]); document.getElementById(`finance-tab-${tabs[next]}`)?.focus(); }
  }

  return <div className="finance360 workspace-page">
    <header className="finance-hero"><div><span>Finance 360</span><h2>Applications, approvals and money movement</h2><p>One controlled queue for documents, lending decisions, contracts, insurance renewals, payouts, bills and payables.</p></div><button className="workspace-button workspace-button--dark" type="button" onClick={() => setModal("application")}><Plus />New application</button></header>
    <section className="finance-metrics" aria-label="Finance workload summary">
      <article><FileCheck2 /><span>Awaiting action</span><strong>{metrics.decisions}</strong><small>applications</small></article>
      <article><BadgeDollarSign /><span>Approved to pay out</span><strong>{money(metrics.payouts)}</strong><small>pending settlement</small></article>
      <article><ShieldCheck /><span>Renewals due</span><strong>{metrics.renewals}</strong><small>within 90 days</small></article>
      <article><ReceiptText /><span>Open payables</span><strong>{money(metrics.payables)}</strong><small>bills not paid</small></article>
    </section>
    <div className="finance-tabs" role="tablist" aria-label="Finance 360 work queues" onKeyDown={handleTabs}>
      {(["applications", "contracts", "insurance", "payables"] as Tab[]).map((item) => <button id={`finance-tab-${item}`} aria-controls={`finance-panel-${item}`} role="tab" aria-selected={tab === item} tabIndex={tab === item ? 0 : -1} type="button" key={item} onClick={() => setTab(item)}>{{ applications: "Applications & payouts", contracts: "Contracts", insurance: "Insurance & renewals", payables: "Bills & payables" }[item]}</button>)}
    </div>
    {loading && <div className="finance-state"><RefreshCw />Loading connected finance records...</div>}
    {error && <div className="finance-state finance-error"><AlertCircle /><div><strong>{error.message}</strong><span>{error.requestId ? `Request ${error.requestId}. ` : ""}Check the connection and retry.</span></div><button type="button" onClick={load}>Retry</button></div>}
    {!loading && !error && <section id={`finance-panel-${tab}`} role="tabpanel" aria-labelledby={`finance-tab-${tab}`} className="finance-queue">
      {tab === "applications" && <ApplicationQueue items={data.applications} onTransition={transition} onCopy={copy} onRequestDocument={(documentFor) => setModal({ documentFor })} onDocumentStatus={async (id, status) => { await apiPatch(`/api/v1/finance/documents/${id}`, { status }); await load(); notify(`Document marked ${status}.`); }} />}
      {tab === "contracts" && <ContractQueue items={data.contracts} onCopy={copy} />}
      {tab === "insurance" && <PolicyQueue items={data.policies} onCopy={copy} />}
      {tab === "payables" && <PayableQueue items={data.payables} onTransition={transition} onCopy={copy} onCreate={() => setModal("payable")} />}
    </section>}
    {modal === "application" && <ApplicationDialog onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); notify("Finance application created."); }} />}
    {modal === "payable" && <PayableDialog onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); notify("Bill recorded for approval."); }} />}
    {typeof modal === "object" && modal && <DocumentDialog applicationId={modal.documentFor} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); notify("Document request added."); }} />}
    {toast && <Toast message={toast} />}
  </div>;
}

function ApplicationQueue({ items, onTransition, onCopy, onRequestDocument, onDocumentStatus }: { items: Application[]; onTransition: (kind: "applications", id: string, status: string) => void; onCopy: (label: string, value: string) => void; onRequestDocument: (id: string) => void; onDocumentStatus: (id: string, status: string) => void }) {
  if (!items.length) return <Empty title="No applications yet" detail="Create an application to begin document collection and approval." />;
  return <div className="finance-card-list">{items.map((item) => <article className="finance-card finance-card--application" key={item.id}><div className="finance-card-main"><span className={`finance-status status-${item.status}`}>{item.status.replaceAll("_", " ")}</span><h3>{item.applicantName}</h3><p>{item.lender} · Owner: {item.assignedTo || "Unassigned"}</p><div className="finance-progress"><span style={{ width: `${item.documentCount ? (item.receivedDocumentCount / item.documentCount) * 100 : 0}%` }} /></div><small>{item.receivedDocumentCount} of {item.documentCount} requested documents received</small><div className="finance-documents">{item.documents.map((document) => <div key={document.id}><span>{document.documentType}</span><label><span className="sr-only">Status for {document.documentType}</span><select value={document.status} onChange={(event) => void onDocumentStatus(document.id, event.target.value)}>{["requested", "received", "verified", "rejected"].map((status) => <option key={status}>{status}</option>)}</select></label></div>)}<button type="button" onClick={() => onRequestDocument(item.id)}><Plus />Request document</button></div></div><div className="finance-card-value"><strong>{money(item.requestedAmount)}</strong><span>Updated {date.format(new Date(item.updatedAt))}</span>{item.payoutReference && <button type="button" onClick={() => onCopy("Payout reference", item.payoutReference!)}><Copy />Copy payout reference</button>}</div><div className="finance-card-actions"><label><span>Next status</span><select aria-label={`Update ${item.applicantName} application status`} value={item.status} onChange={(event) => onTransition("applications", item.id, event.target.value)}>{["documents_pending","submitted","approved","declined","contracted","paid_out"].map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label></div></article>)}</div>;
}

function ContractQueue({ items, onCopy }: { items: Contract[]; onCopy: (label: string, value: string) => void }) { if (!items.length) return <Empty title="No finance contracts" detail="Contracts created from approved deals will appear here." />; return <div className="finance-card-list">{items.map((item) => <article className="finance-card" key={item.id}><BadgeDollarSign /><div className="finance-card-main"><span className={`finance-status status-${item.status}`}>{item.status}</span><h3>{item.customerName}</h3><p>{item.productType} · {item.make} {item.model} · {item.registration || "Registration not recorded"}</p></div><div className="finance-card-value"><strong>{money(item.amountFinanced)}</strong><span>{item.provider}</span><button type="button" onClick={() => onCopy("Sales order ID", item.salesOrderId)}><Copy />Copy sales order ID</button></div></article>)}</div>; }

function PolicyQueue({ items, onCopy }: { items: Policy[]; onCopy: (label: string, value: string) => void }) { if (!items.length) return <Empty title="No insurance policies" detail="Quotes, active policies, and renewals will appear here." />; return <div className="finance-card-list">{items.map((item) => <article className="finance-card" key={item.id}><ShieldCheck /><div className="finance-card-main"><span className={`finance-status status-${item.status}`}>{item.status} · expires {date.format(new Date(item.expiresOn))}</span><h3>{item.customerName}</h3><p>{item.make} {item.model} · {item.registration || "Registration not recorded"}</p></div><div className="finance-card-value"><strong>{item.provider}</strong><span>{item.premium != null ? money(item.premium) : "Premium not recorded"}</span><button type="button" onClick={() => onCopy("Policy number", item.policyNumber)}><Copy />Copy policy number</button></div></article>)}</div>; }

function PayableQueue({ items, onTransition, onCopy, onCreate }: { items: Payable[]; onTransition: (kind: "payables", id: string, status: string) => void; onCopy: (label: string, value: string) => void; onCreate: () => void }) { if (!items.length) return <Empty title="No bills or payables" detail="Record a supplier bill to start its approval trail." action="Record bill" onAction={onCreate} />; return <div className="finance-card-list">{items.map((item) => <article className="finance-card" key={item.id}><ReceiptText /><div className="finance-card-main"><span className={`finance-status status-${item.status}`}>{item.status.replaceAll("_", " ")}</span><h3>{item.supplierName}</h3><p>{item.description || "Supplier invoice"} · Due {date.format(new Date(item.dueOn))}</p></div><div className="finance-card-value"><strong>{money(item.amount, item.currency)}</strong><button type="button" onClick={() => onCopy("Invoice number", item.invoiceNumber)}><Copy />Copy invoice number</button></div><div className="finance-card-actions"><label><span>Payment status</span><select aria-label={`Update invoice ${item.invoiceNumber} status`} value={item.status} onChange={(event) => onTransition("payables", item.id, event.target.value)}>{["pending_approval","approved","scheduled","paid","disputed","void"].map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></label></div></article>)}</div>; }

function Empty({ title, detail, action, onAction }: { title: string; detail: string; action?: string; onAction?: () => void }) { return <div className="finance-empty"><CalendarClock /><strong>{title}</strong><p>{detail}</p>{action && <button type="button" onClick={onAction}><Plus />{action}</button>}</div>; }

function ApplicationDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) { const [form, setForm] = useState({ applicantName: "", lender: "", requestedAmount: "", assignedTo: "" }); const [error, setError] = useState(""); const [saving, setSaving] = useState(false); async function submit(event?: FormEvent) { event?.preventDefault(); if (!form.applicantName || !form.lender || !form.requestedAmount || !form.assignedTo) { setError("Complete every required field."); return; } setSaving(true); try { await apiPost("/api/v1/finance/applications", { ...form, requestedAmount: Number(form.requestedAmount) }); onSaved(); } catch (cause) { setError(cause instanceof ApiError ? cause.message : "Application could not be created."); setSaving(false); } } return <WorkflowModal title="New finance application" eyebrow="Document collection and approval" completeLabel="Create application" busy={saving} onClose={onClose} onComplete={() => void submit()}><form className="finance-form" onSubmit={submit}>{error && <div className="finance-inline-error" role="alert">{error}</div>}<label><span>Applicant name (required)</span><input autoFocus required value={form.applicantName} onChange={(e) => setForm({ ...form, applicantName: e.target.value })} /></label><label><span>Lender (required)</span><input required value={form.lender} onChange={(e) => setForm({ ...form, lender: e.target.value })} /></label><label><span>Requested amount in AUD (required)</span><input required min="0" type="number" value={form.requestedAmount} onChange={(e) => setForm({ ...form, requestedAmount: e.target.value })} /></label><label><span>Application owner (required)</span><input required value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} /></label></form></WorkflowModal>; }

function PayableDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) { const [form, setForm] = useState({ supplierName: "", invoiceNumber: "", description: "", amount: "", currency: "AUD", dueOn: "", assignedTo: "" }); const [error, setError] = useState(""); const [saving, setSaving] = useState(false); async function submit(event?: FormEvent) { event?.preventDefault(); if (!form.supplierName || !form.invoiceNumber || !form.amount || !form.dueOn || !form.assignedTo) { setError("Complete every required field."); return; } setSaving(true); try { await apiPost("/api/v1/finance/payables", { ...form, amount: Number(form.amount) }); onSaved(); } catch (cause) { setError(cause instanceof ApiError ? cause.message : "The bill could not be recorded."); setSaving(false); } } return <WorkflowModal title="Record bill or payable" eyebrow="Supplier approval queue" completeLabel="Record bill" busy={saving} onClose={onClose} onComplete={() => void submit()}><form className="finance-form" onSubmit={submit}>{error && <div className="finance-inline-error" role="alert">{error}</div>}<label><span>Supplier (required)</span><input autoFocus required value={form.supplierName} onChange={(e) => setForm({ ...form, supplierName: e.target.value })} /></label><label><span>Invoice number (required)</span><input required value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} /></label><label className="finance-form-wide"><span>Description</span><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label><label><span>Amount (required)</span><input required min="0" step="0.01" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label><label><span>Currency (required)</span><select required value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}><option>AUD</option><option>INR</option><option>USD</option><option>NZD</option></select></label><label><span>Due date (required)</span><input required type="date" value={form.dueOn} onChange={(e) => setForm({ ...form, dueOn: e.target.value })} /></label><label><span>Approval owner (required)</span><input required value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} /></label></form></WorkflowModal>; }

function DocumentDialog({ applicationId, onClose, onSaved }: { applicationId: string; onClose: () => void; onSaved: () => void }) { const [documentType, setDocumentType] = useState(""); const [error, setError] = useState(""); const [saving, setSaving] = useState(false); async function submit(event?: FormEvent) { event?.preventDefault(); if (!documentType.trim()) { setError("Enter the document required."); return; } setSaving(true); try { await apiPost(`/api/v1/finance/applications/${applicationId}/documents`, { documentType }); onSaved(); } catch (cause) { setError(cause instanceof ApiError ? cause.message : "The document request could not be added."); setSaving(false); } } return <WorkflowModal title="Request application document" eyebrow="Document collection" completeLabel="Add request" busy={saving} onClose={onClose} onComplete={() => void submit()}><form className="finance-form" onSubmit={submit}>{error && <div className="finance-inline-error" role="alert">{error}</div>}<label className="finance-form-wide"><span>Document type (required)</span><input autoFocus required value={documentType} onChange={(event) => setDocumentType(event.target.value)} placeholder="For example, proof of income" /></label></form></WorkflowModal>; }
