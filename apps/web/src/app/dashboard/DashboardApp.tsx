import {
  ArrowRight,
  ArrowLeft,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  Building2,
  CarFront,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  CircleUserRound,
  CircleHelp,
  Edit3,
  Globe2,
  LayoutDashboard,
  Menu,
  Mail,
  Megaphone,
  PackageSearch,
  Search,
  Settings,
  UserRound,
  Users,
  Warehouse,
  Wrench,
  X,
} from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { apiGet, ApiError } from "../../lib/api";
import { Brand } from "../components/Brand";
import { WORKSPACE_HUBS } from "../data";
import type { DashView, GlobalSearchRecord, GlobalSearchResponse } from "../types";
import { Toast, WorkflowModal } from "./WorkspacePrimitives";

const OverviewView = lazy(() => import("./DashboardViews").then((module) => ({ default: module.OverviewView })));
const DomainView = lazy(() => import("./DashboardViews").then((module) => ({ default: module.DomainView })));
const CustomerView = lazy(() => import("./RecordViews").then((module) => ({ default: module.CustomerView })));
const VehicleView = lazy(() => import("./RecordViews").then((module) => ({ default: module.VehicleView })));

type DashboardAppProps = { initialView: DashView; initialRecordId?: string; onNavigate: (view: DashView, recordId?: string) => void; onExit: () => void };

const viewIcons: Record<DashView, typeof LayoutDashboard> = {
  overview: LayoutDashboard,
  sales: BriefcaseBusiness,
  service: Wrench,
  parts: PackageSearch,
  finance: CircleDollarSign,
  vehicles: CarFront,
  customers: CircleUserRound,
  marketing: Megaphone,
  usedcars: BarChart3,
  inventory: Warehouse,
  branch: Building2,
  group: Globe2,
  workforce: Users,
};

const viewLabels = Object.fromEntries(WORKSPACE_HUBS.flatMap((hub) => hub.items.map((item) => [item.id, item.label]))) as Record<DashView, string>;

type Health = { service?: string; status?: string; database?: string | { status?: string } };

export default function DashboardApp({ initialView, initialRecordId, onNavigate, onExit }: DashboardAppProps) {
  const [view, setView] = useState<DashView>(initialView);
  const [activeRecordId, setActiveRecordId] = useState(initialRecordId);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [health, setHealth] = useState<"checking" | "connected" | "demo" | "unavailable">("checking");
  const [commandOpen, setCommandOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [commandResponse, setCommandResponse] = useState<GlobalSearchResponse | null>(null);
  const [commandLoading, setCommandLoading] = useState(false);
  const [commandError, setCommandError] = useState<ApiError | null>(null);
  const [commandSelection, setCommandSelection] = useState(0);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [profileEdit, setProfileEdit] = useState(false);
  const [profile, setProfile] = useState({ name: "Olivia Lawson", role: "Group operations", email: "olivia.lawson@prakashinfotech.com", branch: "All branches" });
  const [toast, setToast] = useState("");
  const commandDialogRef = useRef<HTMLElement>(null);

  useEffect(() => setView(initialView), [initialView]);
  useEffect(() => setActiveRecordId(initialRecordId), [initialRecordId]);
  useEffect(() => {
    const controller = new AbortController();
    apiGet<Health>("/api/health", { signal: controller.signal, timeoutMs: 4000 })
      .then((result) => {
        const database = typeof result.database === "string" ? result.database : result.database?.status;
        setHealth(database === "connected" ? "connected" : database === "not-configured" ? "demo" : "unavailable");
      })
      .catch(() => setHealth("unavailable"));
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!commandOpen || commandQuery.trim().length < 2) { setCommandResponse(null); setCommandLoading(false); setCommandError(null); setCommandSelection(0); return; }
    const controller = new AbortController();
    setCommandResponse(null); setCommandLoading(true); setCommandError(null); setCommandSelection(0);
    const timer = window.setTimeout(() => {
      apiGet<GlobalSearchResponse>(`/api/v1/search?q=${encodeURIComponent(commandQuery.trim())}&limit=5`, { signal: controller.signal, timeoutMs: 6000 })
        .then((result) => { setCommandResponse(result); setCommandSelection(0); })
        .catch((cause) => { if (!controller.signal.aborted) setCommandError(cause instanceof ApiError ? cause : new ApiError("Search could not be completed.", { status: 500 })); })
        .finally(() => { if (!controller.signal.aborted) setCommandLoading(false); });
    }, 220);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [commandOpen, commandQuery]);
  useEffect(() => {
    if (!commandOpen) return;
    const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function trapFocus(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const dialog = commandDialogRef.current;
      const items = Array.from(dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? []).filter((element) => !element.hidden);
      if (!items.length) { event.preventDefault(); dialog?.focus(); return; }
      const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", trapFocus, true);
    return () => { document.removeEventListener("keydown", trapFocus, true); document.body.style.overflow = previousOverflow; activeElement?.focus(); };
  }, [commandOpen]);
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setCommandOpen(true); }
      if (event.key === "Escape") { setCommandOpen(false); setMobileOpen(false); setNoticeOpen(false); setProfileOpen(false); setWorkspaceMenuOpen(false); setGuideOpen(false); }
    }
    window.addEventListener("keydown", handleKey); return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const currentLabel = useMemo(() => viewLabels[view] ?? "Executive pulse", [view]);
  const currentHub = useMemo(() => WORKSPACE_HUBS.find((hub) => hub.items.some((item) => item.id === view)) ?? WORKSPACE_HUBS[0], [view]);
  const commandResults = useMemo(() => commandResponse?.groups.flatMap((group) => group.results) ?? [], [commandResponse]);

  function navigate(next: DashView, selectedRecordId?: string) {
    setView(next);
    setActiveRecordId(selectedRecordId);
    onNavigate(next, selectedRecordId);
    setMobileOpen(false);
    setWorkspaceMenuOpen(false);
    document.querySelector(".operations-content")?.scrollTo({ top: 0, behavior: "auto" });
  }

  function renderView() {
    if (view === "overview") return <OverviewView onNavigate={navigate} />;
    if (view === "customers") return <CustomerView onNavigate={navigate} initialRecordId={activeRecordId} onRecordSelect={(id) => navigate("customers", id)} />;
    if (view === "vehicles") return <VehicleView onNavigate={navigate} initialRecordId={activeRecordId} onRecordSelect={(id) => navigate("vehicles", id)} />;
    return <DomainView view={view} />;
  }

  function openSearchResult(record: GlobalSearchRecord) {
    const recordId = record.kind === "customer" || record.kind === "vehicle" ? record.id : undefined;
    navigate(record.view, recordId);
    setCommandOpen(false); setCommandQuery(""); setCommandResponse(null);
  }

  function handleCommandKey(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && commandResults.length) { event.preventDefault(); setCommandSelection((value) => (value + 1) % commandResults.length); }
    else if (event.key === "ArrowUp" && commandResults.length) { event.preventDefault(); setCommandSelection((value) => (value - 1 + commandResults.length) % commandResults.length); }
    else if (event.key === "Enter" && commandResults[commandSelection]) { event.preventDefault(); openSearchResult(commandResults[commandSelection]); }
  }

  const CurrentViewIcon = viewIcons[view];

  return (
    <div className="operations-shell">
      <button type="button" className={`mobile-scrim ${mobileOpen ? "visible" : ""}`} aria-label="Close navigation" onClick={() => setMobileOpen(false)} />
      <aside className={`operations-sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-brand"><Brand inverse compact={collapsed} />{!collapsed && <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X /></button>}</div>
        {!collapsed && <button type="button" className="group-switcher" onClick={() => navigate("group")}><span>PMG</span><div><strong>Pacific Motor Group</strong><small>12 branches · Australia</small></div><ChevronDown size={15} /></button>}
        <nav className="operations-nav hub-navigation" aria-label="Operations hubs">
          {!collapsed && <span className="nav-section-label">Dealership operating hubs</span>}
          {WORKSPACE_HUBS.map((hub) => {
            const hubActive = hub.id === currentHub.id;
            const primary = hub.items[0];
            const Icon = viewIcons[primary.id];
            return <div className={`hub-nav-group ${hubActive ? "active" : ""}`} key={hub.id}>
              <button title={`${hub.label} — ${hub.summary}`} aria-current={hubActive ? "page" : undefined} type="button" className={`hub-nav-button ${hubActive ? "active" : ""}`} onClick={() => navigate(primary.id)}><Icon size={18} /><span><strong>{hub.label}</strong>{!collapsed && <small>{hub.summary}</small>}</span>{hubActive && !collapsed && <i />}</button>
              {!collapsed && hubActive && hub.items.length > 1 && <div className="hub-child-nav">{hub.items.map((item) => <button type="button" key={item.id} className={view === item.id ? "active" : ""} onClick={() => navigate(item.id)}><span>{item.label}</span></button>)}</div>}
            </div>;
          })}
        </nav>
        <div className="sidebar-footer">
          {!collapsed && <div className={`health-indicator health-${health}`}><i /><div><strong>{health === "connected" ? "Neon connected" : health === "demo" ? "Demo data mode" : health === "checking" ? "Checking systems" : "API unavailable"}</strong><span>{health === "connected" ? "PostgreSQL operational" : health === "demo" ? "Safe showcase fallback" : health === "checking" ? "Verifying data path" : "Retry from health check"}</span></div></div>}
          <button type="button" className="collapse-button" aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} onClick={() => setCollapsed((value) => !value)}>{collapsed ? <ChevronRight /> : <><ChevronLeft /><span>Collapse navigation</span></>}</button>
        </div>
      </aside>

      <div className="operations-main">
        <header className="operations-topbar">
          <div className="topbar-left">
            <button type="button" className="mobile-nav-trigger" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu /></button>
            <span className="mobile-topbar-brand"><Brand compact /></span>
            <button type="button" className="back-to-site" onClick={onExit} aria-label="Return to product site"><ArrowLeft size={15} /><span>Product site</span></button>
            <span className="topbar-divider" />
            <button type="button" className="workspace-switcher" aria-expanded={workspaceMenuOpen} onClick={() => setWorkspaceMenuOpen((value) => !value)}><span className="workspace-switcher-icon"><CurrentViewIcon /></span><span><small>Workspace</small><strong>{currentLabel}</strong></span><ChevronDown /></button>
          </div>
          <div className="topbar-actions">
            <button type="button" className="global-search" onClick={() => setCommandOpen(true)}><Search size={16} /><span>Search customer, VIN, RO…</span><kbd>Ctrl K</kbd></button>
            <button type="button" aria-label="Notifications" className="icon-button" onClick={() => setNoticeOpen((value) => !value)}><Bell size={17} /><i /></button>
            <button type="button" aria-label="Edit workspace profile" className="icon-button" onClick={() => setProfileEdit(true)}><Settings size={17} /></button>
            <button type="button" className="user-menu" aria-expanded={profileOpen} onClick={() => setProfileOpen((value) => !value)}><span>{profile.name.split(" ").map((part) => part[0]).slice(0,2).join("")}</span><div><strong>{profile.name}</strong><small>{profile.role}</small></div><ChevronDown size={14} /></button>
          </div>
          {noticeOpen && <div className="notification-popover"><span>Operations notifications</span><button type="button" onClick={() => navigate("service")}><b>4 workshop promises at risk</b><small>Review before 11:00</small></button><button type="button" onClick={() => navigate("inventory")}><b>7 OEM delivery updates</b><small>Customers need contact</small></button></div>}
          {profileOpen && <div className="profile-popover"><div><span>{profile.name.split(" ").map((part) => part[0]).slice(0,2).join("")}</span><p><strong>{profile.name}</strong><small>{profile.email}</small></p></div><button type="button" onClick={() => { setProfileEdit(true); setProfileOpen(false); }}><Edit3 />Edit profile</button><button type="button" onClick={() => { navigate("branch"); setProfileOpen(false); }}><UserRound />My branch workspace</button><a href="mailto:support@prakashinfotech.com"><Mail />Prakash support</a><footer>Workspace by <strong>Prakash Infotech</strong></footer></div>}
        </header>
        {workspaceMenuOpen && <section className="workspace-menu" aria-label="Choose a workspace"><header><div><span>Workspace navigator</span><strong>Nine connected hubs. One customer and vehicle truth.</strong></div><button type="button" onClick={() => setWorkspaceMenuOpen(false)} aria-label="Close workspace navigator"><X /></button></header><div className="workspace-menu-groups workspace-hub-grid">{WORKSPACE_HUBS.map((hub) => { const Icon = viewIcons[hub.items[0].id]; return <div className={hub.id === currentHub.id ? "active" : ""} key={hub.id}><span>{hub.label}</span><p>{hub.summary}</p>{hub.items.map((item) => <button type="button" key={item.id} className={view === item.id ? "active" : ""} onClick={() => navigate(item.id)}><i><Icon /></i><span><strong>{item.label}</strong><small>{item.detail}</small></span><ArrowRight /></button>)}</div>; })}</div></section>}
        <div className="workspace-context-bar"><nav aria-label="Breadcrumb"><button type="button" onClick={() => navigate("overview")}>Home</button><ChevronRight /><span>{currentHub.label}</span>{currentLabel !== currentHub.label && <><ChevronRight /><strong>{currentLabel}</strong></>}</nav><button type="button" className="workspace-guide-trigger" aria-expanded={guideOpen} onClick={() => setGuideOpen((value) => !value)}><CircleHelp />How this workspace works</button>{guideOpen && <section className="workspace-guide"><header><span>Workspace guide</span><button type="button" aria-label="Close workspace guide" onClick={() => setGuideOpen(false)}><X /></button></header><strong>{currentHub.label}</strong><p>{currentHub.summary}. Start with the highlighted priorities, open a record, then use its contextual actions to carry work into the next department.</p><div><span>01</span><p><b>Find the record or exception</b><small>Use the directory, queue, filters or global search.</small></p></div><div><span>02</span><p><b>Choose the next accountable action</b><small>Large action cards show the most important workflows.</small></p></div><div><span>03</span><p><b>Keep shared context</b><small>Customer 360 and Vehicle 360 remain linked through every handoff.</small></p></div></section>}</div>
        <main className="operations-content"><Suspense fallback={<div className="view-loader" role="status"><span>A</span><div><strong>Opening {currentLabel}</strong><small>Loading the connected operating context…</small></div></div>}>{renderView()}</Suspense></main>
      </div>
      {commandOpen && <div className="command-scrim" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && setCommandOpen(false)}><section ref={commandDialogRef} tabIndex={-1} className="command-palette command-palette--grouped" role="dialog" aria-modal="true" aria-label="Global record search" aria-busy={commandLoading}><header><Search /><input autoFocus role="combobox" aria-autocomplete="list" aria-controls="command-results" aria-expanded={Boolean(commandResults.length)} aria-activedescendant={commandResults[commandSelection] ? `command-result-${commandSelection}` : undefined} value={commandQuery} onChange={(event) => setCommandQuery(event.target.value)} onKeyDown={handleCommandKey} placeholder="Search customer, mobile, VIN, registration, repair order or deal" />{commandQuery && <button type="button" className="command-clear" aria-label="Clear global search" onClick={() => setCommandQuery("")}><X /></button>}<kbd>ESC</kbd></header><div className="command-search-meta"><span>{commandQuery.trim().length < 2 ? "Enter at least two characters" : commandLoading ? "Searching connected records…" : commandError ? "Search unavailable" : `${commandResponse?.total ?? 0} matching records`}</span>{commandResponse && <em className={commandResponse.dataSource === "postgresql" ? "connected" : "demo"}>{commandResponse.dataSource === "postgresql" ? "Live data" : "Demonstration data"}</em>}</div><div id="command-results" role="listbox" aria-label="Search results" className="command-result-groups">{commandResponse?.groups.filter((group) => group.results.length).map((group) => <section key={group.id}><header><span>{group.label}</span><em>{group.results.length}</em></header>{group.results.map((record) => { const flatIndex = commandResults.findIndex((item) => item.kind === record.kind && item.id === record.id); const Icon = record.kind === "customer" ? CircleUserRound : record.kind === "vehicle" ? CarFront : record.kind === "repair-order" ? Wrench : BriefcaseBusiness; return <button id={`command-result-${flatIndex}`} role="option" aria-selected={commandSelection === flatIndex} className={commandSelection === flatIndex ? "selected" : ""} type="button" key={`${record.kind}-${record.id}`} onMouseEnter={() => setCommandSelection(flatIndex)} onClick={() => openSearchResult(record)}><i><Icon /></i><div><strong>{record.title}</strong><small>{record.subtitle}</small><em>{record.meta}</em></div><ArrowRight /></button>; })}</section>)}</div>{commandLoading && <div className="command-state" role="status"><span className="loading-dot" /><strong>Searching every connected record</strong><small>Customers, vehicles and operational references</small></div>}{commandError && <div className="command-state command-state--error" role="alert"><Search /><strong>{commandError.message}</strong><small>{commandError.requestId ? `Support reference ${commandError.requestId}` : "Check the API connection and try again."}</small><button type="button" onClick={() => setCommandQuery((value) => `${value} `)}>Retry search</button></div>}{!commandLoading && !commandError && commandQuery.trim().length >= 2 && commandResponse?.total === 0 && <div className="command-empty"><Search /><strong>No matching records</strong><span>Try a customer name, mobile, VIN, registration, RO or deal number.</span></div>}{commandQuery.trim().length < 2 && <div className="command-empty command-empty--start"><Search /><strong>Search the whole dealership</strong><span>Results are grouped by customer, vehicle and operational record. Use ↑ ↓ and Enter to open.</span></div>}</section></div>}
      {profileEdit && <WorkflowModal title="Edit workspace profile" eyebrow="Prakash Infotech account" completeLabel="Save profile" onClose={() => setProfileEdit(false)} onComplete={() => { setProfileEdit(false); setToast("Profile and workspace preferences updated."); window.setTimeout(() => setToast(""), 2600); }}><div className="profile-edit-form"><label><span>Display name</span><input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></label><label><span>Role</span><input value={profile.role} onChange={(event) => setProfile({ ...profile, role: event.target.value })} /></label><label><span>Email</span><input type="email" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} /></label><label><span>Default branch</span><select value={profile.branch} onChange={(event) => setProfile({ ...profile, branch: event.target.value })}><option>All branches</option><option>Sydney Central</option><option>North Shore</option><option>Parramatta</option></select></label><label className="profile-check"><input type="checkbox" defaultChecked /><span>Email the daily briefing at 08:00</span></label><label className="profile-check"><input type="checkbox" defaultChecked /><span>Notify me about critical customer promises</span></label></div></WorkflowModal>}
      {toast && <Toast message={toast} />}
    </div>
  );
}
