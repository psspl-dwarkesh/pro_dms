import { AlertTriangle, BadgeCheck, CalendarClock, Filter, Package, Plus, Users, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { apiGet, apiPatch, apiPost, ApiError } from "../../lib/api";
import type { DashView, Overview, Part } from "../types";
import { Toast, WorkflowModal, WorkspacePage } from "./RecordViews";
import { useContextualActions } from "./SidebarActions";

const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });

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

  useContextualActions(() => [
    { id: "add-part", label: "Add part", icon: Plus, onClick: () => setModal(true) },
    { id: "toggle-low-stock", label: lowStockOnly ? "Show all parts" : "Show low stock only", icon: Filter, onClick: () => setLowStockOnly((value) => !value) },
  ], [lowStockOnly]);

  return (
    <WorkspacePage>
      {error && <p className="inline-error"><AlertTriangle size={14} />{error.message}</p>}
      <div className="executive-metrics">
        <MetricCard label="Parts on file" value={String(parts.length)} meta="Total SKUs" tone="neutral" />
        <MetricCard label="Stock value" value={money.format(stockValue)} meta="Unit cost times quantity on hand" tone="neutral" />
        <MetricCard label="At or below reorder point" value={String(lowStockCount)} meta="Needs replenishment" tone={lowStockCount > 0 ? "bad" : "good"} />
      </div>
      <section className="workspace-card queue-card">
        <div className="card-heading"><div><span>Parts inventory</span><strong>{loading ? "Loading..." : `${parts.length} parts`}</strong></div></div>
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

export function DomainView({ view }: { view: "parts" }) {
  if (view === "parts") return <PartsView />;
  return null;
}
