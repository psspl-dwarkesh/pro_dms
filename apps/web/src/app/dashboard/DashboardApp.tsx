import {
  ArrowRight,
  BarChart3,
  Bell,
  Building2,
  BriefcaseBusiness,
  CarFront,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  CircleUserRound,
  Globe2,
  HelpCircle,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Menu,
  Megaphone,
  PackageSearch,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  Warehouse,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet } from "../../lib/api";
import { roleLabel, useAuth } from "../auth/AuthContext";
import { Brand } from "../components/Brand";
import { ComingSoon } from "../components/ComingSoon";
import { COMING_SOON_VIEWS, NAV_SECTIONS, PAGE_HELP, PAGE_RELATED, ROLE_NAV } from "../data";
import type { Customer, DashView, Overview, Vehicle } from "../types";
import { CompanyAdmin } from "./CompanyAdmin";
import { DomainView, OverviewView } from "./DashboardViews";
import { CustomerView, VehicleView } from "./RecordViews";
import { SidebarActionsProvider } from "./SidebarActions";
import type { SidebarAction } from "./SidebarActions";

type DashboardAppProps = { initialView: DashView; onNavigate: (view: DashView) => void; onLogout: () => void };

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
  company: ShieldCheck,
};

const COMING_SOON_COPY: Partial<Record<DashView, { description: string; planned: string[] }>> = {
  marketing: { description: "Consent-aware audiences, journeys, and attribution reporting are planned for this workspace once the campaign data model ships.", planned: ["Audience builder from ownership and service signals", "Email, SMS, and WhatsApp journeys", "Attribution against pipeline and retention"] },
  usedcars: { description: "Dedicated acquisition, reconditioning, and remarketing workflows for used stock are planned beyond the shared Vehicle 360 record.", planned: ["Trade-in and appraisal workflow", "Reconditioning cost tracking", "Marketplace publishing and auction"] },
  inventory: { description: "Yard location, transfers, and delivery-readiness tracking beyond the Vehicle 360 record are planned next.", planned: ["Yard and bay location tracking", "Branch-to-branch transfers", "PDI and delivery checklists"] },
  branch: { description: "A branch-level performance rollup across sales, service, and parts is planned once workforce and target data is modeled.", planned: ["Branch scorecards", "Department drill-down", "Local risk and action tracking"] },
  group: { description: "Multi-branch comparisons and group reporting are planned once more than one branch has active operating data.", planned: ["Cross-branch comparisons", "Consolidated forecasting", "OEM scorecards"] },
  workforce: { description: "Team, roster, and incentive tracking is planned once employee records are modeled.", planned: ["Team directory and roster", "Targets and incentives", "Skills and certification tracking"] },
};

type Health = { service?: string; status?: string; database?: string | { status?: string } };
type SearchHit = { title: string; detail: string; view: DashView };

export default function DashboardApp({ initialView, onNavigate, onLogout }: DashboardAppProps) {
  const { user, organization } = useAuth();
  const [view, setView] = useState<DashView>(initialView);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [health, setHealth] = useState<"checking" | "connected" | "not-configured" | "unavailable">("checking");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [commandResults, setCommandResults] = useState<SearchHit[]>([]);
  const [commandLoading, setCommandLoading] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [pageActions, setPageActions] = useState<SidebarAction[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);
  const topbarRef = useRef<HTMLElement>(null);
  const workspaceMenuRef = useRef<HTMLElement>(null);

  const allowedViews = useMemo(() => new Set(user ? ROLE_NAV[user.role] : []), [user]);
  const navSections = useMemo(
    () => NAV_SECTIONS.map((section) => ({ ...section, items: section.items.filter((item) => allowedViews.has(item.id)) })).filter((section) => section.items.length > 0),
    [allowedViews],
  );
  const viewLabels = useMemo(() => Object.fromEntries(NAV_SECTIONS.flatMap((section) => section.items.map((item) => [item.id, item.label]))) as Record<DashView, string>, []);

  useEffect(() => setView(initialView), [initialView]);
  useEffect(() => {
    const controller = new AbortController();
    apiGet<Health>("/api/health", { signal: controller.signal, timeoutMs: 4000 })
      .then((result) => {
        const database = typeof result.database === "string" ? result.database : result.database?.status;
        setHealth(database === "connected" ? "connected" : database === "not-configured" ? "not-configured" : "unavailable");
      })
      .catch(() => setHealth("unavailable"));
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    apiGet<{ overview: Overview }>("/api/v1/overview", { signal: controller.signal, timeoutMs: 6000 })
      .then((result) => setOverview(result.overview))
      .catch(() => setOverview(null));
    return () => controller.abort();
  }, [view]);
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setCommandOpen(true); }
      if (event.key === "Escape") { setCommandOpen(false); setMobileOpen(false); setNoticeOpen(false); setProfileOpen(false); setWorkspaceMenuOpen(false); setHelpOpen(false); }
    }
    window.addEventListener("keydown", handleKey); return () => window.removeEventListener("keydown", handleKey);
  }, []);
  useEffect(() => {
    if (!helpOpen && !noticeOpen && !profileOpen && !workspaceMenuOpen) return;
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node;
      if (topbarRef.current?.contains(target) || workspaceMenuRef.current?.contains(target)) return;
      setHelpOpen(false); setNoticeOpen(false); setProfileOpen(false); setWorkspaceMenuOpen(false);
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [helpOpen, noticeOpen, profileOpen, workspaceMenuOpen]);
  useEffect(() => {
    const query = commandQuery.trim();
    if (query.length < 2) { setCommandResults([]); setCommandLoading(false); return; }
    const controller = new AbortController();
    setCommandLoading(true);
    const timeout = window.setTimeout(() => {
      Promise.all([
        apiGet<{ customers: Customer[] }>(`/api/v1/customers?q=${encodeURIComponent(query)}&limit=5`, { signal: controller.signal }).catch(() => ({ customers: [] })),
        apiGet<{ vehicles: Vehicle[] }>(`/api/v1/vehicles?q=${encodeURIComponent(query)}&limit=5`, { signal: controller.signal }).catch(() => ({ vehicles: [] })),
      ]).then(([customerResult, vehicleResult]) => {
        setCommandResults([
          ...customerResult.customers.map((customer) => ({ title: customer.displayName, detail: `Customer - ${customer.mobile ?? customer.email ?? "no contact on file"}`, view: "customers" as DashView })),
          ...vehicleResult.vehicles.map((vehicle) => ({ title: `${vehicle.make} ${vehicle.model}`, detail: `Vehicle - ${vehicle.registration ?? vehicle.vin}`, view: "vehicles" as DashView })),
        ]);
        setCommandLoading(false);
      });
    }, 300);
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, [commandQuery]);

  const currentLabel = useMemo(() => viewLabels[view] ?? "Executive pulse", [view, viewLabels]);

  function navigate(next: DashView) {
    if (next !== view) setPageActions([]);
    setView(next);
    onNavigate(next);
    setMobileOpen(false);
    setWorkspaceMenuOpen(false);
    setHelpOpen(false);
  }

  function renderActionSection(label: string, actions: SidebarAction[]) {
    if (!actions.length) return null;
    return (
      <div key={label}>
        {!collapsed && <span className="nav-section-label">{label}</span>}
        {actions.map((action) => {
          const Icon = action.icon;
          const content = <><Icon size={17} />{!collapsed && <span>{action.label}</span>}</>;
          return action.href ? (
            <a key={action.id} title={action.label} href={action.href} target={action.href.startsWith("http") ? "_blank" : undefined} rel={action.href.startsWith("http") ? "noreferrer" : undefined} className={action.tone === "danger" ? "danger-action" : ""}>{content}</a>
          ) : (
            <button key={action.id} type="button" title={action.label} className={action.tone === "danger" ? "danger-action" : ""} onClick={action.onClick}>{content}</button>
          );
        })}
      </div>
    );
  }

  function renderContextualSidebar() {
    const related = (PAGE_RELATED[view] ?? []).filter((id) => allowedViews.has(id));
    const relatedSection = related.length > 0 && (
      <div key="related">
        {!collapsed && <span className="nav-section-label">Related</span>}
        {related.map((id) => {
          const Icon = viewIcons[id];
          return <button title={viewLabels[id]} type="button" key={id} onClick={() => navigate(id)}><Icon size={17} />{!collapsed && <span>{viewLabels[id]}</span>}</button>;
        })}
      </div>
    );

    if (COMING_SOON_VIEWS.has(view)) {
      // The page body already lists planned features in full, so the sidebar only offers a way
      // onward (related workspaces) instead of repeating that same list a second time.
      return relatedSection || null;
    }

    const quickActions = pageActions.filter((action) => (action.group ?? "Quick actions") === "Quick actions");
    const recordActions = pageActions.filter((action) => action.group === "This record");
    return (
      <>
        {renderActionSection("Quick actions", quickActions)}
        {renderActionSection("This record", recordActions)}
        {relatedSection}
      </>
    );
  }

  function renderView() {
    if (!user || !allowedViews.has(view)) return <OverviewView onNavigate={navigate} />;
    if (view === "overview") return <OverviewView onNavigate={navigate} />;
    if (view === "customers") return <CustomerView onNavigate={navigate} />;
    if (view === "vehicles") return <VehicleView onNavigate={navigate} />;
    if (view === "company") return <CompanyAdmin />;
    if (COMING_SOON_VIEWS.has(view)) {
      const copy = COMING_SOON_COPY[view];
      return <ComingSoon title={viewLabels[view]} description={copy?.description ?? "This workspace is planned next."} planned={copy?.planned ?? []} onNavigate={navigate} />;
    }
    return <DomainView view={view as "sales" | "service" | "parts" | "finance"} />;
  }

  const CurrentViewIcon = viewIcons[view] ?? LayoutDashboard;
  const orgInitials = (organization?.name ?? "AX").split(" ").map((part) => part[0]).slice(0, 3).join("").toUpperCase();
  const userInitials = (user?.name ?? "?").split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  const pageHelp = PAGE_HELP[view] ?? {
    summary: COMING_SOON_COPY[view]?.description ?? "This workspace is planned next.",
    canDo: (COMING_SOON_COPY[view]?.planned ?? []).map((item) => `Planned: ${item}`),
  };
  const healthLabel = health === "connected" ? "Database connected" : health === "not-configured" ? "Database not configured" : health === "checking" ? "Checking connection..." : "Database unavailable";

  return (
    <SidebarActionsProvider value={{ setActions: setPageActions }}>
      <div className="operations-shell">
        <button type="button" className={`mobile-scrim ${mobileOpen ? "visible" : ""}`} aria-label="Close navigation" onClick={() => setMobileOpen(false)} />
        <aside className={`operations-sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
          <div className="sidebar-brand"><Brand inverse compact={collapsed} />{!collapsed && <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X /></button>}</div>
          {!collapsed && <div className="group-switcher"><span>{orgInitials}</span><div><strong>{organization?.name ?? "Your company"}</strong><small>{overview ? `${overview.activeServiceJobs} active jobs - ${overview.openLeads} open leads` : "Loading operations"}</small></div></div>}
          <button type="button" className="all-workspaces-link" title="All workspaces" onClick={() => setWorkspaceMenuOpen((value) => !value)}><LayoutGrid size={15} />{!collapsed && <span>All workspaces</span>}</button>
          <nav className="operations-nav" aria-label={`${currentLabel} actions`}>
            {renderContextualSidebar()}
          </nav>
          <button type="button" className="collapse-button" aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} title={collapsed ? "Expand navigation" : "Collapse navigation"} onClick={() => setCollapsed((value) => !value)}>{collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}</button>
        </aside>
  
        <div className="operations-main">
          <header className="operations-topbar" ref={topbarRef}>
            <div className="topbar-left">
              <button type="button" className="mobile-nav-trigger" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu /></button>
              <span className="mobile-topbar-brand"><Brand compact /></span>
              <span className="topbar-divider" />
              <button type="button" className="workspace-switcher" aria-expanded={workspaceMenuOpen} onClick={() => setWorkspaceMenuOpen((value) => !value)}><span className="workspace-switcher-icon"><CurrentViewIcon /></span><span><small>Workspace</small><strong>{currentLabel}</strong></span><ChevronDown /></button>
              <button type="button" aria-label="What is this page?" aria-expanded={helpOpen} className="icon-button page-help-trigger" onClick={() => setHelpOpen((value) => !value)}><HelpCircle size={17} /></button>
            </div>
            <div className="topbar-actions">
              <button type="button" className="global-search" onClick={() => setCommandOpen(true)}><Search size={16} /><span>Search customer, VIN...</span><kbd>Ctrl K</kbd></button>
              <button type="button" aria-label="Notifications" className="icon-button" onClick={() => setNoticeOpen((value) => !value)}><Bell size={17} />{overview && (overview.activeServiceJobs > 0 || overview.lowStockParts > 0) && <i />}</button>
              <button type="button" className="user-menu" aria-expanded={profileOpen} onClick={() => setProfileOpen((value) => !value)}><span>{userInitials}</span><div><strong>{user?.name ?? "Loading"}</strong><small>{user ? roleLabel(user.role) : ""}</small></div><ChevronDown size={14} /></button>
            </div>
            {helpOpen && (
              <div className="page-help-popover" role="dialog" aria-label={`About ${currentLabel}`}>
                <span>{currentLabel}</span>
                <p>{pageHelp.summary}</p>
                <ul>{pageHelp.canDo.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
            )}
            {noticeOpen && (
              <div className="notification-popover">
                <span>Operations notifications</span>
                {overview ? (
                  <>
                    <button type="button" onClick={() => navigate("service")}><b>{overview.activeServiceJobs} active service jobs</b><small>Open in Service workshop</small></button>
                    <button type="button" onClick={() => navigate("parts")}><b>{overview.lowStockParts} parts at or below reorder point</b><small>Open in Parts control</small></button>
                    <button type="button" onClick={() => navigate("sales")}><b>{overview.openLeads} open leads</b><small>Open in Sales and CRM</small></button>
                  </>
                ) : <span className="notification-empty">Connect the database to see live counts.</span>}
              </div>
            )}
            {profileOpen && (
              <div className="profile-popover">
                <div><span>{userInitials}</span><p><strong>{user?.name}</strong><small>{user?.email}</small></p></div>
                <div className="profile-meta"><span className="role-badge">{user ? roleLabel(user.role) : ""}</span><span>{organization?.name}</span></div>
                <div className="profile-status"><span className={`db-status db-status-${health}`} aria-hidden="true" />{healthLabel}</div>
                <button type="button" onClick={onLogout}><LogOut size={15} />Sign out</button>
                <a href="mailto:support@prakashinfotech.com"><UserRound size={15} />Prakash support</a>
                <footer>Workspace by <strong>Prakash Software Solutions</strong></footer>
              </div>
            )}
          </header>
          {workspaceMenuOpen && (
            <section className="workspace-menu" aria-label="Choose a workspace" ref={workspaceMenuRef}>
              <header><div><span>Workspace navigator</span><strong>Move to the work, not another app.</strong></div><button type="button" onClick={() => setWorkspaceMenuOpen(false)} aria-label="Close workspace navigator"><X /></button></header>
              <div className="workspace-menu-groups">
                {navSections.map((section) => (
                  <div key={section.label}>
                    <span>{section.label}</span>
                    {section.items.map((item) => {
                      const Icon = viewIcons[item.id];
                      return <button type="button" key={item.id} className={view === item.id ? "active" : ""} onClick={() => navigate(item.id)}><i><Icon /></i><span><strong>{item.label}</strong><small>{item.id === "customers" ? "Relationship, consent and value" : item.id === "vehicles" ? "VIN lifecycle and condition" : item.id === "overview" ? "Decisions and exceptions" : "Open connected operations"}</small></span><ArrowRight /></button>;
                    })}
                  </div>
                ))}
              </div>
            </section>
          )}
          <main className="operations-content">{renderView()}</main>
        </div>
        {commandOpen && (
          <div className="command-scrim" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && setCommandOpen(false)}>
            <section className="command-palette" role="dialog" aria-modal="true" aria-label="Global record search">
              <header><Search /><input autoFocus value={commandQuery} onChange={(event) => setCommandQuery(event.target.value)} placeholder="Search customer, mobile, VIN, registration, make or model" /><kbd>ESC</kbd></header>
              <span>{commandLoading ? "Searching..." : commandQuery.trim().length < 2 ? "Type at least two characters to search connected records." : `${commandResults.length} matching records`}</span>
              {commandResults.map((record) => <button type="button" key={`${record.view}-${record.title}`} onClick={() => { navigate(record.view); setCommandOpen(false); setCommandQuery(""); }}><CircleUserRound /><div><strong>{record.title}</strong><small>{record.detail}</small></div><ArrowRight /></button>)}
              {!commandLoading && commandQuery.trim().length >= 2 && !commandResults.length && <div className="command-empty"><Search /><strong>No matching records</strong><span>Try a customer name, mobile, VIN, registration, or model.</span></div>}
            </section>
          </div>
        )}
      </div>
    </SidebarActionsProvider>
  );
}
