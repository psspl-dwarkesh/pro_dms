import {
  ArrowRight, BadgeCheck, CarFront, CircleUserRound, Download,
  Gauge, Plus, Search, Share2,
  Trash2, WalletCards, Wrench, X,
} from "lucide-react";
import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { apiDelete, apiGet, apiPatch, apiPost, ApiError } from "../../lib/api";
import type {
  DashView, ServiceJob, Vehicle, Vehicle360,
} from "../types";
import { useContextualActions } from "./SidebarActions";
import type { SidebarAction } from "./SidebarActions";

// openId: when a global search result or a cross-record link (e.g. "Current owner", a vehicle
// inside a customer's Vehicles tab) hands this view a specific record id, it opens that exact
// record instead of defaulting to the first row in the directory. recordId on onNavigate is the
// matching half of that contract for outbound links.
export type RecordViewProps = { onNavigate: (view: DashView, recordId?: string) => void; openId?: string };

// Applies `openId` to `setSelectedId` once per distinct value, so repeat renders (list reloads,
// tab switches) do not stomp on a selection the user already made by clicking around the
// directory. A new distinct openId (a fresh search selection while already on this page) still
// takes effect.
export function useOpenIdSelection(openId: string | undefined, setSelectedId: (id: string) => void) {
  const appliedOpenId = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (openId && openId !== appliedOpenId.current) {
      appliedOpenId.current = openId;
      setSelectedId(openId);
    }
  }, [openId, setSelectedId]);
}

const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric" });

// `fields` names exactly what the underlying API query matches (see db.js#listCustomers /
// #listVehicles) so this line never claims coverage the search doesn't have. Views that reuse
// this component for a stage/status filter rather than free-text search can omit it.
export function SearchState({ loading, error, fields }: { loading: boolean; error: ApiError | null; fields?: string }) {
  if (loading) return <span className="record-search-state"><i className="loading-dot" />Searching connected records...</span>;
  if (error) return <span className="record-search-state record-search-state--error">{error.message}{error.requestId ? ` - ${error.requestId}` : ""}</span>;
  return <span className="record-search-state">{fields ? `Connected search - ${fields}.` : "Showing connected records."}</span>;
}

export function Timeline({ items }: { items: Array<{ occurredAt: string; type: string; summary: string }> }) {
  if (!items.length) return <div className="timeline-empty">No activity recorded yet.</div>;
  return <div className="record-timeline">{items.map((item, index) => <div key={`${item.occurredAt}-${index}`} className="timeline-event"><i /><div><span>{dateFormatter.format(new Date(item.occurredAt))} - {item.type}</span><strong>{item.summary}</strong></div></div>)}</div>;
}

export function OperationalTable({ columns, rows }: { columns: string[]; rows: Array<Array<string | number>> }) {
  const grid = { gridTemplateColumns: `repeat(${columns.length}, minmax(105px, 1fr))` };
  if (!rows.length) return <div className="timeline-empty">No records yet.</div>;
  return <div className="operational-table"><div className="operational-table-head" style={grid}>{columns.map((column) => <span key={column}>{column}</span>)}</div>{rows.map((row, index) => <div style={grid} key={index} className="operational-table-row">{row.map((value, valueIndex) => <span key={valueIndex} className={valueIndex === 0 ? "primary" : valueIndex === columns.length - 1 ? "status" : ""}>{value}</span>)}</div>)}</div>;
}

export function SectionToolbar({ title, detail, action, onAction }: { title: string; detail: string; action?: string; onAction?: () => void }) {
  return <div className="section-toolbar"><div><span>{title}</span><strong>{detail}</strong></div>{action && <button type="button" onClick={onAction}><Plus />{action}</button>}</div>;
}

export function Toast({ message }: { message: string }) {
  return <div className="workspace-toast" role="status"><BadgeCheck />{message}</div>;
}

// Focus containment for every workflow dialog: focus moves inside on open, Tab/Shift+Tab stay
// within the dialog, Escape closes it, the background is inert while it's open (body scroll
// locked), and focus returns to whatever triggered the dialog when it closes.
// `active` distinguishes an unmount-on-close dialog (default true -- the component only ever
// renders while open, e.g. WorkflowModal) from one that stays mounted with its visibility toggled
// by a boolean prop (e.g. a command palette rendered from a parent that never unmounts): pass the
// open/closed flag as `active` there so the trap engages and releases with it instead of firing
// once at the parent's own mount.
export function useDialogFocusTrap(dialogRef: { current: HTMLElement | null }, onClose: () => void, active = true) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    const triggerElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = dialogRef.current;
    const focusable = () =>
      Array.from(dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [])
        .filter((element) => !element.hidden);
    window.setTimeout(() => (focusable()[0] ?? dialog)?.focus(), 0);

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onCloseRef.current(); return; }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) { event.preventDefault(); dialog?.focus(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", handleKey, true);
    return () => {
      document.removeEventListener("keydown", handleKey, true);
      document.body.style.overflow = previousOverflow;
      triggerElement?.focus();
    };
  }, [active, dialogRef]);
}

export function WorkflowModal({ title, eyebrow, onClose, onComplete, children, completeLabel = "Save", busy = false }: { title: string; eyebrow: string; onClose: () => void; onComplete: () => void; children: ReactNode; completeLabel?: string; busy?: boolean }) {
  const dialogRef = useRef<HTMLElement>(null);
  useDialogFocusTrap(dialogRef, onClose);
  return <div className="modal-scrim" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && onClose()}><section ref={dialogRef} tabIndex={-1} className="workflow-modal" role="dialog" aria-modal="true" aria-labelledby="workflow-title"><header><div><span>{eyebrow}</span><h2 id="workflow-title">{title}</h2></div><button type="button" onClick={onClose} aria-label="Close dialog"><X /></button></header><div className="workflow-modal-body">{children}</div><footer><span><i /> Saved to your connected database</span><div><button type="button" onClick={onClose}>Cancel</button><button type="button" className="workspace-button workspace-button--dark" onClick={onComplete} disabled={busy}>{busy ? "Saving..." : completeLabel} <ArrowRight size={14} /></button></div></footer></section></div>;
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
// Vehicle 360
// ---------------------------------------------------------------------------

type VehicleModal = null | "create-vehicle" | "edit-vehicle" | "book-service";

export function VehicleView({ onNavigate, openId }: RecordViewProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<ApiError | null>(null);
  const [query, setQuery] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(openId ?? null);
  useOpenIdSelection(openId, setSelectedId);
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
    list.push({ id: "share", label: "Share", icon: Share2, onClick: () => shareRecord(`${vehicle.make} ${vehicle.model}`).then(() => notify("Summary shared.")), group: "This record" });
    list.push({ id: "export", label: "Export", icon: Download, onClick: () => { exportCsv(`${vehicle.make} ${vehicle.model}`); notify("CSV exported."); }, group: "This record" });
    list.push({ id: "delete", label: "Delete", icon: Trash2, tone: "danger", onClick: deleteVehicle, group: "This record" });
    return list;
  }, [vehicle]);

  const estimatedTrade = useMemo(() => (vehicle?.marketValue ? vehicle.marketValue * 0.93 : null), [vehicle]);
  const wholesaleFloor = useMemo(() => (vehicle?.marketValue ? vehicle.marketValue * 0.89 : null), [vehicle]);

  return <WorkspacePage>
    <div className="record-workbench">
      <aside className="record-directory-panel">
        <header className="directory-panel-heading"><div><span>Vehicle directory</span><strong>{vehicles.length} connected assets</strong></div><button type="button" onClick={() => setModal("create-vehicle")} aria-label="Add vehicle"><Plus /></button></header>
        <form className="record-search" onSubmit={searchVehicles}><Search /><input aria-label="Search vehicles" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="VIN, registration, make or model" />{query && <button className="search-clear" type="button" aria-label="Clear vehicle search" onClick={() => { setQuery(""); loadList(""); }}><X /></button>}<button className="search-submit" type="submit" disabled={listLoading}>Search</button></form>
        <SearchState loading={listLoading} error={listError} fields="VIN, registration, make, or model" />
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
              {tab === "Overview" && <div className="record-facts"><div><CarFront /><span>VIN</span><strong className="fact-small">{vehicle.vin}</strong></div><div><Gauge /><span>Odometer</span><strong>{vehicle.odometerKm ? `${new Intl.NumberFormat("en-AU").format(vehicle.odometerKm)} km` : "Not recorded"}</strong></div><div><WalletCards /><span>Market value</span><strong>{vehicle.marketValue ? money.format(vehicle.marketValue) : "Not set"}</strong></div><div><CircleUserRound /><span>Current owner</span>{vehicle.ownerId ? <button type="button" onClick={() => onNavigate("customers", vehicle.ownerId)}>{vehicle.ownerName}</button> : <strong>Unowned</strong>}</div></div>}
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
