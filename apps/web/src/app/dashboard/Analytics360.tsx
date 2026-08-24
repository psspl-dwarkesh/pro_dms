import { AlertTriangle, ArrowRight, BarChart3, RefreshCw, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, ApiError } from "../../lib/api";
import type { DashView } from "../types";
import { WorkspacePage } from "./RecordViews";
import "./analytics360.css";

type AnalyticsArea = "analytics" | "branch" | "group" | "workforce";
type Metric = {
  id: string; label: string; value: number; format: "currency" | "number"; definition: string;
  dateRange: { from: string; to: string }; scope: string; lastRefresh: string; illustrative: boolean;
};
type AnalyticsData = {
  filters: { from: string; to: string; branchId: string | null };
  metadata: { title: string; disclosure: string; currency: string; scope: string; lastRefresh: string };
  metrics: Metric[];
  departments: Array<{ name: string; activity: number; activityLabel: string; value: number }>;
  branches: Array<{ id: string; name: string; units: number; sales_revenue: number; service_revenue: number; open_leads: number }>;
  trend: Array<{ period: string; sales_revenue: number; service_revenue: number }>;
  workforce: Array<{ person: string; role: string; jobs: number; completed_jobs: number; tracked_revenue: number }>;
  exceptions: Array<{ id: string; kind: string; title: string; detail: string; destination: DashView }>;
};

const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("en-AU");
const date = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric" });
const AREA_COPY: Record<AnalyticsArea, { eyebrow: string; title: string; summary: string }> = {
  analytics: { eyebrow: "Analytics 360 · Dealership", title: "Dealership performance", summary: "Department results, tracked contribution, operating trends, and exceptions across your authorized scope." },
  branch: { eyebrow: "Analytics 360 · Branch", title: "Branch performance", summary: "Compare sales, service revenue, pipeline pressure, and contribution signals by branch." },
  group: { eyebrow: "Analytics 360 · Group", title: "Group analysis", summary: "A consolidated, cross-branch view for group leaders. Results remain bounded to authorized dealership data." },
  workforce: { eyebrow: "Analytics 360 · Workforce", title: "Workforce productivity", summary: "Reporting on advisor and technician output only. People, schedules, roles, and rosters are managed in Administration." },
};

function toInputDate(value: Date) { return value.toISOString().slice(0, 10); }

export function Analytics360({ area, onNavigate }: { area: AnalyticsArea; onNavigate: (view: DashView, recordId?: string) => void }) {
  const today = useMemo(() => new Date(), []);
  const initialFrom = useMemo(() => { const value = new Date(today); value.setDate(value.getDate() - 29); return toInputDate(value); }, [today]);
  const [draft, setDraft] = useState({ from: initialFrom, to: toInputDate(today), branchId: "" });
  const [filters, setFilters] = useState(draft);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [branches, setBranches] = useState<AnalyticsData["branches"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const load = useCallback(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ from: filters.from, to: filters.to });
    if (filters.branchId) params.set("branchId", filters.branchId);
    setLoading(true);
    setError(null);
    apiGet<{ data: AnalyticsData }>(`/api/v1/analytics?${params}`, { signal: controller.signal, timeoutMs: 8000 })
      .then((result) => {
        setData(result.data);
        setBranches((current) => current.length ? current : result.data.branches);
      })
      .catch((cause) => setError(cause instanceof ApiError ? cause : new ApiError("Analytics could not be loaded.", { status: 500 })))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [filters]);

  useEffect(load, [load]);
  const copy = AREA_COPY[area];
  const showWorkforceFirst = area === "workforce";
  const showBranchesFirst = area === "branch" || area === "group";

  return (
    <WorkspacePage>
      <header className="analytics-header">
        <div><span>{copy.eyebrow}</span><h1>{copy.title}</h1><p>{copy.summary}</p></div>
        <span className="analytics-disclosure"><BarChart3 size={16} />Illustrative analysis</span>
      </header>

      <form className="analytics-filters" onSubmit={(event) => { event.preventDefault(); setFilters({ ...draft }); }}>
        <div className="analytics-filter-title"><SlidersHorizontal size={17} /><div><strong>Analysis filters</strong><span>Updates all KPIs, tables, and exceptions</span></div></div>
        <label><span>From date</span><input type="date" required value={draft.from} max={draft.to} onChange={(event) => setDraft({ ...draft, from: event.target.value })} /></label>
        <label><span>To date</span><input type="date" required value={draft.to} min={draft.from} max={toInputDate(today)} onChange={(event) => setDraft({ ...draft, to: event.target.value })} /></label>
        <label><span>Branch scope</span><select value={draft.branchId} onChange={(event) => setDraft({ ...draft, branchId: event.target.value })}><option value="">All authorized branches</option>{branches.map((branch) => <option value={branch.id} key={branch.id}>{branch.name}</option>)}</select></label>
        <button type="submit" className="analytics-apply">Apply filters</button>
      </form>

      {error && <section className="analytics-state" role="alert"><AlertTriangle /><div><strong>Analytics could not be loaded</strong><p>{error.message}{error.requestId ? ` Support reference: ${error.requestId}.` : ""}</p></div><button type="button" onClick={load}><RefreshCw size={15} />Retry</button></section>}
      {loading && <p className="analytics-loading" aria-live="polite">Loading authorized analysis…</p>}
      {!loading && !error && data && <>
        <section className="analytics-context" aria-label="Metric context"><strong>{data.metadata.title}</strong><span>{formatRange(data.filters.from, data.filters.to)}</span><span>{data.metadata.scope}</span><span>Last refreshed {formatRefresh(data.metadata.lastRefresh)}</span><p>{data.metadata.disclosure}</p></section>
        <div className="analytics-kpis">{data.metrics.map((metric) => <MetricCard metric={metric} key={metric.id} />)}</div>
        {showWorkforceFirst && <WorkforceTable rows={data.workforce} context={data} />}
        {showBranchesFirst && <BranchTable rows={data.branches} context={data} />}
        <TrendPanel rows={data.trend} context={data} />
        <div className="analytics-grid">
          <DepartmentTable rows={data.departments} context={data} />
          <ExceptionQueue rows={data.exceptions} onNavigate={onNavigate} context={data} />
        </div>
        {!showBranchesFirst && <BranchTable rows={data.branches} context={data} />}
        {!showWorkforceFirst && <WorkforceTable rows={data.workforce} context={data} />}
      </>}
    </WorkspacePage>
  );
}

function MetricCard({ metric }: { metric: Metric }) {
  return <article className="analytics-kpi"><span>{metric.label}</span><strong>{metric.format === "currency" ? money.format(metric.value) : number.format(metric.value)}</strong><small>{formatRange(metric.dateRange.from, metric.dateRange.to)} · {metric.scope}</small><details><summary>Definition and refresh</summary><p>{metric.definition}</p><p>Last refreshed {formatRefresh(metric.lastRefresh)}. {metric.illustrative ? "Illustrative analysis." : ""}</p></details></article>;
}

function TrendPanel({ rows, context }: { rows: AnalyticsData["trend"]; context: AnalyticsData }) {
  const max = Math.max(1, ...rows.flatMap((row) => [row.sales_revenue, row.service_revenue]));
  return <section className="analytics-panel"><header><div><span>Revenue trend</span><h2>Sales and service by week</h2></div><p>Operational revenue recorded in the selected period · AUD</p></header>
    {rows.length ? <><div className="analytics-bars" role="img" aria-label="Weekly sales and service revenue. Equivalent values are available in the table below.">{rows.map((row) => <div key={row.period} className="analytics-bar-group"><div><i className="sales-bar" style={{ height: `${Math.max(3, row.sales_revenue / max * 100)}%` }} /><i className="service-bar" style={{ height: `${Math.max(3, row.service_revenue / max * 100)}%` }} /></div><span>{new Date(`${row.period}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}</span></div>)}</div><AccessibleTable label="Revenue trend data" headers={["Week starting", "Sales revenue", "Service revenue"]} rows={rows.map((row) => [formatDate(row.period), money.format(row.sales_revenue), money.format(row.service_revenue)])} /></> : <EmptyState text="No sales or service revenue is recorded for this period." />}
    <MetricContext context={context} definition="Weekly sums of sales-order totals and labour-plus-parts totals for repair orders opened in the selected period." />
  </section>;
}

function DepartmentTable({ rows, context }: { rows: AnalyticsData["departments"]; context: AnalyticsData }) { return <section className="analytics-panel"><header><div><span>Department analysis</span><h2>Operating contribution</h2></div><p>Recorded activity and revenue; not net profit</p></header><AccessibleTable label="Department analysis" headers={["Department", "Activity", "Tracked value"]} rows={rows.map((row) => [row.name, `${number.format(row.activity)} ${row.activityLabel}`, money.format(row.value)])} /><MetricContext context={context} definition="Sales-order totals, service labour plus parts, and finance commission recorded for eligible orders. Costs and overhead are excluded." /></section>; }
function BranchTable({ rows, context }: { rows: AnalyticsData["branches"]; context: AnalyticsData }) { return <section className="analytics-panel"><header><div><span>Branch analysis</span><h2>Authorized branch comparison</h2></div><p>Sales orders, revenue, service, and unresolved pipeline</p></header>{rows.length ? <AccessibleTable label="Branch comparison" headers={["Branch", "Units", "Sales revenue", "Service revenue", "Open leads"]} rows={rows.map((row) => [row.name, number.format(row.units), money.format(row.sales_revenue), money.format(row.service_revenue), number.format(row.open_leads)])} /> : <EmptyState text="No branches are available in your authorized scope." />}<MetricContext context={context} definition="Per-branch sales orders and service jobs in the selected period; open leads are unresolved as of the selected end date." /></section>; }
function WorkforceTable({ rows, context }: { rows: AnalyticsData["workforce"]; context: AnalyticsData }) { return <section className="analytics-panel"><header><div><span>Workforce productivity</span><h2>Advisor and technician output</h2></div><p>Analysis only · manage people in Administration</p></header>{rows.length ? <AccessibleTable label="Workforce productivity" headers={["Team member", "Role", "Jobs", "Completed", "Tracked service revenue"]} rows={rows.map((row) => [row.person, row.role, number.format(row.jobs), number.format(row.completed_jobs), money.format(row.tracked_revenue)])} /> : <EmptyState text="No advisor or technician activity is recorded for this period." />}<MetricContext context={context} definition="Repair orders grouped by recorded advisor and technician name; completed means the repair order status is closed. This is not a people-management score." /></section>; }

function ExceptionQueue({ rows, onNavigate, context }: { rows: AnalyticsData["exceptions"]; onNavigate: (view: DashView, recordId?: string) => void; context: AnalyticsData }) {
  return <section className="analytics-panel"><header><div><span>Exception queue</span><h2>Records needing attention</h2></div><p>Up to 25 authorized records</p></header><div className="analytics-exceptions">{rows.map((row) => <button type="button" key={`${row.kind}-${row.id}`} onClick={() => onNavigate(row.destination, row.id)}><span><strong>{row.title}</strong><small>{row.detail}</small></span><span>Drill down <ArrowRight size={14} /></span></button>)}{!rows.length && <EmptyState text="No configured exceptions are present in this scope." />}</div><MetricContext context={context} definition="Open service jobs past promise time, unresolved leads older than seven days, and organization-wide parts at or below reorder point when group scope is authorized." /></section>;
}

function MetricContext({ context, definition }: { context: AnalyticsData; definition: string }) { return <p className="analytics-metric-context"><strong>Definition:</strong> {definition} <strong>Range:</strong> {formatRange(context.filters.from, context.filters.to)}. <strong>Scope:</strong> {context.metadata.scope}. <strong>Currency:</strong> {context.metadata.currency}. <strong>Last refresh:</strong> {formatRefresh(context.metadata.lastRefresh)}. Illustrative analysis.</p>; }

function AccessibleTable({ label, headers, rows }: { label: string; headers: string[]; rows: string[][] }) { return <div className="analytics-table-scroll" role="region" aria-label={label} tabIndex={0}><table className="analytics-table"><caption>{label}</caption><thead><tr>{headers.map((header) => <th scope="col" key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={`${row[0]}-${rowIndex}`}>{row.map((cell, index) => index === 0 ? <th scope="row" key={cell}>{cell}</th> : <td key={`${cell}-${index}`}>{cell}</td>)}</tr>)}</tbody></table></div>; }
function EmptyState({ text }: { text: string }) { return <p className="analytics-empty">{text}</p>; }
function formatDate(value: string) { return date.format(new Date(`${value}T00:00:00`)); }
function formatRange(from: string, to: string) { return `${formatDate(from)} – ${formatDate(to)}`; }
function formatRefresh(value: string) { return new Date(value).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" }); }
