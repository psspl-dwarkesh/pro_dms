import { AlertTriangle, BadgeCheck, CalendarClock, Package, Users, Wrench } from "lucide-react";
import { useEffect, useState } from "react";
import { apiGet, ApiError } from "../../lib/api";
import type { DashView, Overview } from "../types";
import { PartsWorkspace } from "./PartsWorkspace";
import { WorkspacePage } from "./RecordViews";

const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });

function MetricCard({ label, value, meta, tone = "neutral" }: { label: string; value: string; meta: string; tone?: "good" | "warn" | "bad" | "neutral" }) {
  return <div className="metric-card"><span>{label}</span><strong>{value}</strong><em className={`tone-${tone}`}>{meta}</em></div>;
}

// ---------------------------------------------------------------------------
// Analytics 360 - Dealership
// ---------------------------------------------------------------------------
// Unchanged screen, new home: this was the standalone "Executive pulse" nav item and is now
// Analytics 360's core page, re-parented into that portal's tab shell. See
// docs/six-portal-workspace-plan.md. The name is kept so the Analytics 360 chat can rename it
// alongside the rest of that portal's build-out rather than in a shared-file commit.

export function OverviewView({ onNavigate }: { onNavigate: (view: DashView, recordId?: string) => void }) {
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
                <button type="button" onClick={() => onNavigate("sales")}><span className="exception-icon warn"><Users /></span><div><strong>{overview.openLeads} open leads</strong><p>Sales 360 pipeline</p></div><em>Open</em></button>
                <button type="button" onClick={() => onNavigate("service")}><span className="exception-icon warn"><Wrench /></span><div><strong>{overview.activeServiceJobs} active service jobs</strong><p>Vehicle 360 - Service and workshop</p></div><em>Open</em></button>
                <button type="button" onClick={() => onNavigate("parts")}><span className="exception-icon bad"><Package /></span><div><strong>{overview.lowStockParts} parts at or below reorder point</strong><p>Vehicle 360 - Parts</p></div><em>Reorder</em></button>
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
export function DomainView({ view }: { view: "parts" }) {
  if (view === "parts") return <PartsWorkspace />;
  return null;
}
