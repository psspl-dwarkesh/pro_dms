import { FormEvent, useEffect, useMemo, useState } from "react";
import { ClipboardCheck, DollarSign, Gavel, Plus, Search, Warehouse } from "lucide-react";
import { apiGet, apiPatch, apiPost, ApiError } from "../../lib/api";
import { CurrencyField, DateTimeField, SelectField, TextArea, TextField } from "../components/forms";
import type { ReconTask, UsedVehicleStock } from "../types";
import { OperationalTable, SearchState, Toast, WorkflowModal, WorkspacePage } from "./RecordViews";

const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
type Modal = "inspect" | "task" | "price" | "wholesale" | null;

export function UsedRecon() {
  const [vehicles, setVehicles] = useState<UsedVehicleStock[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [tasks, setTasks] = useState<ReconTask[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const selected = vehicles.find((item) => item.vehicleId === selectedId) ?? null;

  async function load() {
    setLoading(true); setError(null);
    try {
      const result = await apiGet<{ vehicles: UsedVehicleStock[] }>(`/api/v1/used-vehicles?q=${encodeURIComponent(query)}&limit=100`);
      setVehicles(result.vehicles); setSelectedId((current) => result.vehicles.some((v) => v.vehicleId === current) ? current : result.vehicles[0]?.vehicleId ?? "");
    } catch (cause) { setError(cause as ApiError); } finally { setLoading(false); }
  }
  useEffect(() => { const timer = window.setTimeout(load, 250); return () => window.clearTimeout(timer); }, [query]);
  useEffect(() => { if (!selectedId) { setTasks([]); return; } apiGet<{ tasks: ReconTask[] }>(`/api/v1/used-vehicles/${selectedId}`).then((r) => setTasks(r.tasks)).catch(() => setTasks([])); }, [selectedId]);
  const totals = useMemo(() => ({ stock: vehicles.length, ageing: vehicles.filter((v) => v.stockAgeDays >= 60).length, recon: vehicles.filter((v) => v.reconStatus === "in-progress" || v.openReconTasks > 0).length, value: vehicles.reduce((sum, v) => sum + (v.askingPrice ?? 0), 0) }), [vehicles]);
  function notify(message: string) { setToast(message); window.setTimeout(() => setToast(""), 2600); }
  async function patch(body: object, message: string) { if (!selected) return; setSaving(true); try { await apiPatch(`/api/v1/used-vehicles/${selected.vehicleId}`, body); setModal(null); notify(message); await load(); } catch (cause) { notify((cause as ApiError).message); } finally { setSaving(false); } }
  async function addTask(body: object) { if (!selected) return; setSaving(true); try { await apiPost(`/api/v1/used-vehicles/${selected.vehicleId}/recon-tasks`, body); setModal(null); notify("Recon task added."); const result = await apiGet<{ tasks: ReconTask[] }>(`/api/v1/used-vehicles/${selected.vehicleId}`); setTasks(result.tasks); await load(); } catch (cause) { notify((cause as ApiError).message); } finally { setSaving(false); } }
  async function completeTask(task: ReconTask) { const actualCost = task.actualCost ?? task.estimatedCost; await apiPatch(`/api/v1/used-vehicles/${task.vehicleId}/recon-tasks/${task.id}`, { status: "completed", actualCost }); notify("Recon task completed."); setTasks((items) => items.map((item) => item.id === task.id ? { ...item, status: "completed", actualCost } : item)); await load(); }

  return <WorkspacePage>
    <div className="used-heading"><div><span>Vehicle 360 · Used & Auction</span><h1>Used vehicle operations</h1><p>Acquire, inspect, recondition, price and dispose against one shared VIN record.</p></div></div>
    <div className="used-kpis"><article><Warehouse /><span>Current stock</span><strong>{totals.stock}</strong></article><article><ClipboardCheck /><span>In recon</span><strong>{totals.recon}</strong></article><article><Gavel /><span>60+ day stock</span><strong>{totals.ageing}</strong></article><article><DollarSign /><span>Retail asking value</span><strong>{money.format(totals.value)}</strong></article></div>
    <div className="used-layout">
      <section className="record-directory"><label className="record-search"><Search /><span className="sr-only">Search used stock</span><input aria-label="Search used stock" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="VIN, registration, make or model" /></label><SearchState loading={loading} error={error} fields="VIN, registration, make and model" />
        <div className="record-list">{vehicles.map((v) => <button type="button" key={v.vehicleId} className={v.vehicleId === selectedId ? "active" : ""} onClick={() => setSelectedId(v.vehicleId)}><strong>{v.make} {v.model}</strong><span>{v.registration ?? v.vin}</span><small>{v.stockAgeDays} days · {v.reconStatus}</small></button>)}</div>
      </section>
      <section className="used-detail">{selected ? <><header><div><span>{selected.vin}</span><h2>{selected.make} {selected.model} {selected.variant}</h2><p>{selected.branchName ?? "No branch"} · {selected.lotLocation ?? "Location not recorded"}</p></div><span className={`age-badge ${selected.stockAgeDays >= 60 ? "risk" : ""}`}>{selected.stockAgeDays} days in stock</span></header>
        <div className="used-actions"><button type="button" onClick={() => setModal("inspect")}><ClipboardCheck />Record inspection</button><button type="button" onClick={() => setModal("task")}><Plus />Add recon task</button><button type="button" onClick={() => setModal("price")}><DollarSign />Set retail price</button><button type="button" onClick={() => setModal("wholesale")}><Gavel />Wholesale disposal</button></div>
        <div className="info-grid"><div><span>Acquisition</span><strong>{selected.acquisitionChannel ?? "Not recorded"}</strong></div><div><span>Acquisition cost</span><strong>{selected.acquisitionCost == null ? "Not recorded" : money.format(selected.acquisitionCost)}</strong></div><div><span>Inspection</span><strong>{selected.inspectionStatus ?? "Not started"}{selected.inspectionGrade ? ` · ${selected.inspectionGrade}` : ""}</strong></div><div><span>Recon cost</span><strong>{money.format(selected.reconCost)}</strong></div><div><span>Asking price</span><strong>{selected.askingPrice == null ? "Not priced" : money.format(selected.askingPrice)}</strong></div><div><span>Projected margin</span><strong>{selected.askingPrice == null || selected.acquisitionCost == null ? "Not available" : money.format(selected.askingPrice - selected.acquisitionCost - selected.reconCost)}</strong></div></div>
        <h3>Reconditioning work</h3><OperationalTable columns={["Work", "Supplier", "Estimate", "Actual", "Status"]} rows={tasks.map((t) => [t.description, t.supplier ?? "—", money.format(t.estimatedCost), t.actualCost == null ? "—" : money.format(t.actualCost), t.status])} />
        {tasks.some((t) => !["completed","cancelled"].includes(t.status)) && <div className="task-complete-list">{tasks.filter((t) => !["completed","cancelled"].includes(t.status)).map((t) => <button type="button" key={t.id} onClick={() => completeTask(t)}>Complete {t.description}</button>)}</div>}
      </> : <div className="timeline-empty">No used stock matches this search. Intake a vehicle in Vehicle 360 to begin.</div>}</section>
    </div>
    {modal === "inspect" && <InspectionModal saving={saving} onClose={() => setModal(null)} onSubmit={(body) => patch(body, "Inspection saved.")} />}
    {modal === "task" && <TaskModal saving={saving} onClose={() => setModal(null)} onSubmit={addTask} />}
    {modal === "price" && <PriceModal saving={saving} onClose={() => setModal(null)} onSubmit={(body) => patch(body, "Retail price updated.")} />}
    {modal === "wholesale" && <WholesaleModal saving={saving} onClose={() => setModal(null)} onSubmit={(body) => patch(body, "Wholesale disposal recorded.")} />}
    {toast && <Toast message={toast} />}
  </WorkspacePage>;
}

function InspectionModal({ saving, onClose, onSubmit }: { saving: boolean; onClose: () => void; onSubmit: (body: object) => void }) { const [form,setForm]=useState({inspectionStatus:"passed",inspectionGrade:"good",inspectionNotes:""}); return <WorkflowModal title="Record used vehicle inspection" eyebrow="Condition gate" completeLabel="Save inspection" busy={saving} onClose={onClose} onComplete={() => onSubmit(form)}><div className="workflow-form-grid"><SelectField label="Outcome" value={form.inspectionStatus} onChange={(e)=>setForm({...form,inspectionStatus:e.target.value})}><option value="in-progress">In progress</option><option value="passed">Passed</option><option value="failed">Failed</option></SelectField><SelectField label="Condition grade" value={form.inspectionGrade} onChange={(e)=>setForm({...form,inspectionGrade:e.target.value})}>{["excellent","good","fair","poor"].map(x=><option key={x}>{x}</option>)}</SelectField><TextArea className="full" label="Inspection notes" required value={form.inspectionNotes} onChange={(e)=>setForm({...form,inspectionNotes:e.target.value})} /></div></WorkflowModal>; }
function TaskModal({ saving, onClose, onSubmit }: { saving: boolean; onClose: () => void; onSubmit: (body: object) => void }) { const [form,setForm]=useState({category:"mechanical",description:"",supplier:"",estimatedCost:"",dueAt:""}); function submit(e?:FormEvent){e?.preventDefault(); if(form.description.trim()) onSubmit({...form,estimatedCost:Number(form.estimatedCost||0),dueAt:form.dueAt||null,status:"planned"});} return <WorkflowModal title="Add reconditioning task" eyebrow="Recon plan" completeLabel="Add task" busy={saving} onClose={onClose} onComplete={()=>submit()}><div className="workflow-form-grid"><SelectField label="Category" value={form.category} onChange={(e)=>setForm({...form,category:e.target.value})}>{["mechanical","body","interior","tyres","detail","other"].map(x=><option key={x}>{x}</option>)}</SelectField><TextField label="Description" required value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})} /><TextField label="Supplier" value={form.supplier} onChange={(e)=>setForm({...form,supplier:e.target.value})} /><CurrencyField label="Estimated cost" value={form.estimatedCost} onChange={(e)=>setForm({...form,estimatedCost:e.target.value})} /><DateTimeField label="Due date" value={form.dueAt} onChange={(e)=>setForm({...form,dueAt:e.target.value})} /></div></WorkflowModal>; }
function PriceModal({ saving, onClose, onSubmit }: { saving:boolean; onClose:()=>void; onSubmit:(body:object)=>void }) { const [price,setPrice]=useState(""); return <WorkflowModal title="Set retail asking price" eyebrow="Pricing" completeLabel="Update price" busy={saving} onClose={onClose} onComplete={()=>price&&onSubmit({askingPrice:Number(price),disposalChannel:"retail"})}><CurrencyField label="Asking price" autoFocus required value={price} onChange={(e)=>setPrice(e.target.value)} /></WorkflowModal>; }
function WholesaleModal({ saving, onClose, onSubmit }: { saving:boolean; onClose:()=>void; onSubmit:(body:object)=>void }) { const [form,setForm]=useState({wholesaleBuyer:"",wholesalePrice:""}); return <WorkflowModal title="Record wholesale disposal" eyebrow="Stock disposal" completeLabel="Mark sold wholesale" busy={saving} onClose={onClose} onComplete={()=>form.wholesaleBuyer.trim()&&form.wholesalePrice&&onSubmit({disposalChannel:"wholesale",wholesaleBuyer:form.wholesaleBuyer,wholesalePrice:Number(form.wholesalePrice)})}><div className="workflow-form-grid"><TextField label="Wholesale buyer" required value={form.wholesaleBuyer} onChange={(e)=>setForm({...form,wholesaleBuyer:e.target.value})} /><CurrencyField label="Sale price" required value={form.wholesalePrice} onChange={(e)=>setForm({...form,wholesalePrice:e.target.value})} /></div></WorkflowModal>; }
