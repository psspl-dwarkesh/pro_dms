import { AlertTriangle, Pause, Play, Plus, RefreshCw } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { ApiError, apiGet, apiPatch, apiPost } from "../../lib/api";
import { CurrencyField, DateTimeField, SelectField, TextArea, TextField } from "../components/forms";
import { WorkspacePage } from "./RecordViews";
import "./marketing360.css";

type Audience = { id: string; name: string; description: string | null; channel: string; member_count: number; consent_required: boolean };
type Campaign = { id: string; name: string; channel: string; status: string; objective: string; budget: number; starts_at: string | null; ends_at: string | null; sent_count: number; response_count: number; audience_name?: string; member_count?: number; branch_name?: string };
type Workspace = { campaigns: Campaign[]; audiences: Audience[] };
const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });

export function MarketingStatusBadge() { return <span className="marketing-live-badge">Live data</span>; }

export function MarketingView() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ name: "", audienceId: "", channel: "email", objective: "", budget: "0", startsAt: "", endsAt: "", status: "draft" });

  const load = useCallback(() => {
    setLoading(true); setError(null);
    apiGet<{ data: Workspace }>("/api/v1/marketing")
      .then((result) => { setWorkspace(result.data); setDraft((value) => ({ ...value, audienceId: value.audienceId || result.data.audiences[0]?.id || "" })); })
      .catch((cause) => setError(cause instanceof ApiError ? cause : new ApiError("Marketing data could not be loaded.", { status: 500 })))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  async function createCampaign(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(null);
    try {
      await apiPost("/api/v1/marketing/campaigns", { ...draft, budget: Number(draft.budget), startsAt: new Date(draft.startsAt).toISOString(), endsAt: new Date(draft.endsAt).toISOString() });
      setShowForm(false); setDraft((value) => ({ ...value, name: "", objective: "", budget: "0", startsAt: "", endsAt: "" })); load();
    } catch (cause) { setError(cause instanceof ApiError ? cause : new ApiError("Campaign could not be saved.", { status: 500 })); }
    finally { setSaving(false); }
  }

  async function toggle(campaign: Campaign) {
    try { await apiPatch(`/api/v1/marketing/campaigns/${campaign.id}/status`, { status: campaign.status === "active" ? "paused" : "active" }); load(); }
    catch (cause) { setError(cause instanceof ApiError ? cause : new ApiError("Campaign status could not be changed.", { status: 500 })); }
  }

  return <WorkspacePage>
    <header className="marketing-header"><div><span>Marketing 360</span><h1>Consent-aware campaign operations</h1><p>Build audiences and run outreach against the same customer relationships used by Sales and Customer 360.</p></div><button type="button" onClick={() => setShowForm((value) => !value)}><Plus size={16} />New campaign</button></header>
    {error && <div className="marketing-state" role="alert"><AlertTriangle /><span>{error.message}{error.requestId ? ` Reference: ${error.requestId}.` : ""}</span><button type="button" onClick={load}><RefreshCw size={15} />Retry</button></div>}
    {showForm && <form className="marketing-form" onSubmit={createCampaign}>
      <h2>Create persisted campaign</h2>
      <TextField label="Name" required maxLength={120} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
      <SelectField label="Audience" required value={draft.audienceId} onChange={(event) => { const audience = workspace?.audiences.find((item) => item.id === event.target.value); setDraft({ ...draft, audienceId: event.target.value, channel: audience?.channel ?? draft.channel }); }}>{workspace?.audiences.map((audience) => <option value={audience.id} key={audience.id}>{audience.name}</option>)}</SelectField>
      <SelectField label="Channel" value={draft.channel} onChange={(event) => setDraft({ ...draft, channel: event.target.value })}><option value="email">Email</option><option value="sms">SMS</option><option value="whatsapp">WhatsApp</option><option value="mixed">Mixed</option></SelectField>
      <CurrencyField label="Budget" step="1" value={draft.budget} onChange={(event) => setDraft({ ...draft, budget: event.target.value })} />
      <DateTimeField label="Starts" required value={draft.startsAt} onChange={(event) => setDraft({ ...draft, startsAt: event.target.value })} />
      <DateTimeField label="Ends" required value={draft.endsAt} onChange={(event) => setDraft({ ...draft, endsAt: event.target.value })} />
      <TextArea className="marketing-objective" label="Objective" required maxLength={240} value={draft.objective} onChange={(event) => setDraft({ ...draft, objective: event.target.value })} />
      <div><button type="button" onClick={() => setShowForm(false)}>Cancel</button><button type="submit" disabled={saving || !workspace?.audiences.length}>{saving ? "Saving…" : "Save campaign"}</button></div>
    </form>}
    {loading && <p className="marketing-loading" aria-live="polite">Loading live campaigns…</p>}
    {!loading && workspace && <>
      <section className="marketing-kpis" aria-label="Marketing summary"><article><span>Campaigns</span><strong>{workspace.campaigns.length}</strong></article><article><span>Active</span><strong>{workspace.campaigns.filter((item) => item.status === "active").length}</strong></article><article><span>Consented audience</span><strong>{workspace.audiences.reduce((sum, item) => sum + item.member_count, 0).toLocaleString()}</strong></article><article><span>Responses</span><strong>{workspace.campaigns.reduce((sum, item) => sum + item.response_count, 0).toLocaleString()}</strong></article></section>
      <div className="marketing-grid"><section><header><span>Campaign directory</span><h2>Live campaign control</h2></header><div className="marketing-campaigns">{workspace.campaigns.map((campaign) => <article key={campaign.id}><div><span className={`marketing-status ${campaign.status}`}>{campaign.status}</span><small>{campaign.channel} · {campaign.branch_name ?? "All branches"}</small></div><h3>{campaign.name}</h3><p>{campaign.objective}</p><dl><div><dt>Audience</dt><dd>{campaign.audience_name ?? "—"}</dd></div><div><dt>Budget</dt><dd>{money.format(campaign.budget)}</dd></div><div><dt>Sent</dt><dd>{campaign.sent_count}</dd></div><div><dt>Responses</dt><dd>{campaign.response_count}</dd></div></dl><button type="button" onClick={() => toggle(campaign)}>{campaign.status === "active" ? <Pause size={14} /> : <Play size={14} />}{campaign.status === "active" ? "Pause" : "Activate"}</button></article>)}{!workspace.campaigns.length && <p>No campaigns are recorded yet.</p>}</div></section>
      <aside><header><span>Audiences</span><h2>Consent-ready segments</h2></header>{workspace.audiences.map((audience) => <article key={audience.id}><strong>{audience.name}</strong><p>{audience.description}</p><span>{audience.member_count.toLocaleString()} people · {audience.channel} · {audience.consent_required ? "consent required" : "operational"}</span></article>)}</aside></div>
    </>}
  </WorkspacePage>;
}
