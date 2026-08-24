import { AlertTriangle, ArrowRightLeft, Filter, PackageCheck, Plus, ShoppingCart } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPatch, apiPost, ApiError } from "../../lib/api";
import type { Branch, Part, ServiceJob, Vehicle } from "../types";
import { Toast, WorkflowModal, WorkspacePage } from "./RecordViews";
import { useContextualActions } from "./SidebarActions";
import "./parts-workspace.css";

type WorkspacePart = Part & { supplierName: string | null; binLocation: string | null; reservedQuantity: number; availableQuantity: number; receivedAt: string; ageDays: number };
type Reservation = { id: string; partId: string; partName: string; sku: string; registration: string | null; repairOrderNumber: string | null; quantity: number; status: string };
type PurchaseOrder = { id: string; orderNumber: string; supplierName: string; status: string; expectedAt: string | null; quantityOrdered: number; quantityReceived: number; total: number };
type Transfer = { id: string; partName: string; sku: string; fromBranchName: string; toBranchName: string; quantity: number; status: string };
type PartsWorkspaceData = { parts: WorkspacePart[]; reservations: Reservation[]; purchaseOrders: PurchaseOrder[]; transfers: Transfer[] };
type Dialog = "part" | "reserve" | "purchase" | "transfer" | null;

const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
const date = new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" });

export function PartsWorkspace() {
  const [data, setData] = useState<PartsWorkspaceData | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [lowStock, setLowStock] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [workspace, branchResult, vehicleResult, jobResult] = await Promise.all([
        apiGet<{ workspace: PartsWorkspaceData }>(`/api/v1/parts/workspace${lowStock ? "?lowStock=true" : ""}`),
        apiGet<{ branches: Branch[] }>("/api/v1/branches"), apiGet<{ vehicles: Vehicle[] }>("/api/v1/vehicles?limit=100"),
        apiGet<{ serviceJobs: ServiceJob[] }>("/api/v1/service-jobs?limit=100"),
      ]);
      setData(workspace.workspace); setBranches(branchResult.branches); setVehicles(vehicleResult.vehicles); setJobs(jobResult.serviceJobs);
    } catch (cause) { setError(cause instanceof ApiError ? cause : new ApiError("Could not load parts operations.", { status: 500 })); }
    finally { setLoading(false); }
  }, [lowStock]);
  useEffect(() => { void load(); }, [load]);
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2800); };
  const complete = async (path: string, body: unknown, message: string) => { await apiPost(path, body); setDialog(null); await load(); notify(message); };
  useContextualActions(() => [
    { id: "add-part", label: "Add catalogue item", icon: Plus, onClick: () => setDialog("part") },
    { id: "reserve-part", label: "Reserve for vehicle or job", icon: PackageCheck, onClick: () => setDialog("reserve") },
    { id: "purchase-part", label: "Create purchase order", icon: ShoppingCart, onClick: () => setDialog("purchase") },
    { id: "transfer-part", label: "Transfer between branches", icon: ArrowRightLeft, onClick: () => setDialog("transfer") },
    { id: "low-stock", label: lowStock ? "Show all catalogue" : "Show reorder alerts", icon: Filter, onClick: () => setLowStock((value) => !value) },
  ], [lowStock]);

  const metrics = useMemo(() => {
    const parts = data?.parts ?? [];
    return { value: parts.reduce((sum, part) => sum + part.quantityOnHand * part.unitCost, 0), alerts: parts.filter((part) => part.availableQuantity <= part.reorderPoint).length, aged: parts.filter((part) => part.ageDays >= 90 && part.quantityOnHand > 0).length };
  }, [data]);

  return <WorkspacePage>
    <header className="parts-heading"><div><span>Vehicle 360 · Parts</span><h1>Parts operations</h1><p>Catalogue, live availability, reservations, repair-order allocation, purchasing and branch movement in one stock ledger.</p></div></header>
    {error && <div className="parts-error" role="alert"><AlertTriangle size={18} /><div><strong>{error.message}</strong><button type="button" onClick={() => void load()}>Try again</button></div></div>}
    <div className="parts-metrics" aria-label="Parts operating summary">
      <article><span>Catalogue</span><strong>{data?.parts.length ?? 0}</strong><small>SKUs in this view</small></article>
      <article><span>Stock value</span><strong>{money.format(metrics.value)}</strong><small>On-hand at recorded cost</small></article>
      <article><span>Reorder alerts</span><strong>{metrics.alerts}</strong><small>Available at or below threshold</small></article>
      <article><span>Ageing 90+ days</span><strong>{metrics.aged}</strong><small>SKUs with stock on hand</small></article>
    </div>
    {loading && <p className="record-search-state" aria-live="polite">Loading parts operations…</p>}
    {!loading && data && <>
      <section className="parts-panel"><header><div><span>Catalogue and stock</span><h2>{lowStock ? "Reorder queue" : "Branch availability"}</h2></div></header>
        <div className="parts-table-scroll" role="region" aria-label="Parts catalogue" tabIndex={0}><table><thead><tr><th>Part</th><th>Location</th><th>On hand</th><th>Reserved</th><th>Available</th><th>Reorder</th><th>Age</th><th>Value</th></tr></thead><tbody>{data.parts.map((part) => <tr key={part.id}><td><strong>{part.name}</strong><small>{part.sku}{part.supplierName ? ` · ${part.supplierName}` : ""}</small></td><td>{part.binLocation ?? "Unassigned"}</td><td>{part.quantityOnHand}</td><td>{part.reservedQuantity}</td><td><span className={part.availableQuantity <= part.reorderPoint ? "parts-status danger" : "parts-status good"}>{part.availableQuantity}</span></td><td>{part.reorderPoint}</td><td>{part.ageDays} days</td><td>{money.format(part.quantityOnHand * part.unitCost)}</td></tr>)}{!data.parts.length && <tr><td colSpan={8}>No parts match this view.</td></tr>}</tbody></table></div>
      </section>
      <div className="parts-grid">
        <Queue title="Reservations and allocations" empty="No active reservations." rows={data.reservations.map((item) => ({ id: item.id, title: `${item.partName} × ${item.quantity}`, detail: item.repairOrderNumber ?? item.registration ?? "Linked record", status: item.status, action: item.status === "reserved" ? () => apiPatch(`/api/v1/parts/reservations/${item.id}`, { status: "allocated" }).then(() => load()).then(() => notify("Stock allocated to the job.")) : undefined }))} />
        <Queue title="Purchasing" empty="No purchase orders." rows={data.purchaseOrders.map((item) => ({ id: item.id, title: `${item.orderNumber} · ${item.supplierName}`, detail: `${item.quantityReceived}/${item.quantityOrdered} received · ${money.format(item.total)}${item.expectedAt ? ` · due ${date.format(new Date(item.expectedAt))}` : ""}`, status: item.status, action: item.status === "ordered" ? () => complete(`/api/v1/parts/purchase-orders/${item.id}/receive`, {}, "Purchase order received into stock.") : undefined }))} />
        <Queue title="Branch transfers" empty="No transfers." rows={data.transfers.map((item) => ({ id: item.id, title: `${item.partName} × ${item.quantity}`, detail: `${item.fromBranchName} → ${item.toBranchName}`, status: item.status, action: item.status !== "received" ? () => complete(`/api/v1/parts/transfers/${item.id}/receive`, {}, "Transfer received at destination.") : undefined }))} />
      </div>
    </>}
    {dialog === "part" && <PartDialog onClose={() => setDialog(null)} onSave={(body) => complete("/api/v1/parts", body, "Catalogue item added.")} />}
    {dialog === "reserve" && <ReservationDialog parts={data?.parts ?? []} vehicles={vehicles} jobs={jobs} onClose={() => setDialog(null)} onSave={(body) => complete("/api/v1/parts/reservations", body, "Stock reserved.")} />}
    {dialog === "purchase" && <PurchaseDialog parts={data?.parts ?? []} onClose={() => setDialog(null)} onSave={(body) => complete("/api/v1/parts/purchase-orders", body, "Purchase order created.")} />}
    {dialog === "transfer" && <TransferDialog parts={data?.parts ?? []} branches={branches} onClose={() => setDialog(null)} onSave={(body) => complete("/api/v1/parts/transfers", body, "Transfer requested.")} />}
    {toast && <Toast message={toast} />}
  </WorkspacePage>;
}

function Queue({ title, empty, rows }: { title: string; empty: string; rows: { id: string; title: string; detail: string; status: string; action?: () => Promise<unknown> }[] }) {
  return <section className="parts-panel parts-queue"><header><h2>{title}</h2></header>{rows.map((row) => <article key={row.id}><div><strong>{row.title}</strong><small>{row.detail}</small></div><span className="parts-status">{row.status}</span>{row.action && <button type="button" onClick={() => void row.action?.()}>{row.status === "ordered" ? "Receive" : row.status === "reserved" ? "Allocate" : "Receive"}</button>}</article>)}{!rows.length && <p>{empty}</p>}</section>;
}

function DialogForm({ title, children, onClose, onSave }: { title: string; children: React.ReactNode; onClose: () => void; onSave: () => Promise<void> }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const fields = useRef<HTMLDivElement>(null);
  const submit = async () => {
    const invalid = fields.current?.querySelector<HTMLInputElement | HTMLSelectElement>("input:invalid,select:invalid");
    if (invalid) { invalid.reportValidity(); invalid.focus(); return; }
    setBusy(true); setError(""); try { await onSave(); } catch (cause) { setError(cause instanceof ApiError ? cause.message : "Could not save this change."); } finally { setBusy(false); }
  };
  return <WorkflowModal title={title} eyebrow="Parts operations" completeLabel="Save" busy={busy} onClose={onClose} onComplete={submit}>{error && <p className="inline-error" role="alert">{error}</p>}<div ref={fields} className="workflow-form-grid">{children}</div></WorkflowModal>;
}
const field = (label: string, props: React.InputHTMLAttributes<HTMLInputElement>) => <label><span>{label}</span><input {...props} /></label>;
const select = (label: string, value: string, onChange: (value: string) => void, options: { value: string; label: string }[]) => <label><span>{label}</span><select required value={value} onChange={(event) => onChange(event.target.value)}><option value="">Select…</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;

function PartDialog({ onClose, onSave }: { onClose: () => void; onSave: (body: unknown) => Promise<void> }) { const [v, set] = useState({ sku: "", name: "", quantityOnHand: "0", reorderPoint: "0", unitCost: "0", retailPrice: "0" }); return <DialogForm title="Add catalogue item" onClose={onClose} onSave={() => onSave({ ...v, quantityOnHand: +v.quantityOnHand, reorderPoint: +v.reorderPoint, unitCost: +v.unitCost, retailPrice: +v.retailPrice })}>{field("SKU", { required: true, value: v.sku, onChange: e => set({ ...v, sku: e.target.value }) })}{field("Part name", { required: true, value: v.name, onChange: e => set({ ...v, name: e.target.value }) })}{field("Opening quantity", { type: "number", min: 0, value: v.quantityOnHand, onChange: e => set({ ...v, quantityOnHand: e.target.value }) })}{field("Reorder point", { type: "number", min: 0, value: v.reorderPoint, onChange: e => set({ ...v, reorderPoint: e.target.value }) })}{field("Unit cost (AUD)", { type: "number", min: 0, step: ".01", value: v.unitCost, onChange: e => set({ ...v, unitCost: e.target.value }) })}{field("Retail price (AUD)", { type: "number", min: 0, step: ".01", value: v.retailPrice, onChange: e => set({ ...v, retailPrice: e.target.value }) })}</DialogForm>; }
function ReservationDialog({ parts, vehicles, jobs, onClose, onSave }: { parts: WorkspacePart[]; vehicles: Vehicle[]; jobs: ServiceJob[]; onClose: () => void; onSave: (body: unknown) => Promise<void> }) { const [v, set] = useState({ partId: "", vehicleId: "", serviceJobId: "", quantity: "1" }); return <DialogForm title="Reserve part" onClose={onClose} onSave={() => onSave({ ...v, vehicleId: v.vehicleId || null, serviceJobId: v.serviceJobId || null, quantity: +v.quantity })}>{select("Part", v.partId, partId => set({ ...v, partId }), parts.map(p => ({ value: p.id, label: `${p.sku} · ${p.name} (${p.availableQuantity} available)` })))}{select("Vehicle (optional)", v.vehicleId, vehicleId => set({ ...v, vehicleId }), vehicles.map(x => ({ value: x.id, label: `${x.registration ?? x.vin} · ${x.make} ${x.model}` })))}{select("Repair order (optional)", v.serviceJobId, serviceJobId => set({ ...v, serviceJobId }), jobs.map(x => ({ value: x.id, label: `${x.repairOrderNumber} · ${x.status}` })))}{field("Quantity", { required: true, type: "number", min: 1, value: v.quantity, onChange: e => set({ ...v, quantity: e.target.value }) })}</DialogForm>; }
function PurchaseDialog({ parts, onClose, onSave }: { parts: WorkspacePart[]; onClose: () => void; onSave: (body: unknown) => Promise<void> }) { const [v, set] = useState({ partId: "", orderNumber: "", supplierName: "", quantity: "1", unitCost: "0", expectedAt: "" }); return <DialogForm title="Create purchase order" onClose={onClose} onSave={() => onSave({ ...v, quantity: +v.quantity, unitCost: +v.unitCost, expectedAt: v.expectedAt ? new Date(v.expectedAt).toISOString() : null })}>{select("Part", v.partId, partId => set({ ...v, partId }), parts.map(p => ({ value: p.id, label: `${p.sku} · ${p.name}` })))}{field("Order number", { required: true, value: v.orderNumber, onChange: e => set({ ...v, orderNumber: e.target.value }) })}{field("Supplier", { required: true, value: v.supplierName, onChange: e => set({ ...v, supplierName: e.target.value }) })}{field("Quantity", { required: true, type: "number", min: 1, value: v.quantity, onChange: e => set({ ...v, quantity: e.target.value }) })}{field("Unit cost (AUD)", { required: true, type: "number", min: 0, step: ".01", value: v.unitCost, onChange: e => set({ ...v, unitCost: e.target.value }) })}{field("Expected", { type: "datetime-local", value: v.expectedAt, onChange: e => set({ ...v, expectedAt: e.target.value }) })}</DialogForm>; }
function TransferDialog({ parts, branches, onClose, onSave }: { parts: WorkspacePart[]; branches: Branch[]; onClose: () => void; onSave: (body: unknown) => Promise<void> }) { const [v, set] = useState({ partId: "", fromBranchId: "", toBranchId: "", quantity: "1" }); return <DialogForm title="Transfer stock" onClose={onClose} onSave={() => onSave({ ...v, quantity: +v.quantity })}>{select("Part", v.partId, partId => set({ ...v, partId }), parts.map(p => ({ value: p.id, label: `${p.sku} · ${p.name}` })))}{select("From branch", v.fromBranchId, fromBranchId => set({ ...v, fromBranchId }), branches.map(b => ({ value: b.id, label: b.name })))}{select("To branch", v.toBranchId, toBranchId => set({ ...v, toBranchId }), branches.map(b => ({ value: b.id, label: b.name })))}{field("Quantity", { required: true, type: "number", min: 1, value: v.quantity, onChange: e => set({ ...v, quantity: e.target.value }) })}</DialogForm>; }
