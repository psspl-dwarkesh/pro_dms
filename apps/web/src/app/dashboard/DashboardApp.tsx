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
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet } from "../../lib/api";
import { roleLabel, useAuth } from "../auth/AuthContext";
import { Brand } from "../components/Brand";
import { ComingSoon } from "../components/ComingSoon";
import { Dialog, Popover } from "../components/overlays";
import {
  ADMIN_LABEL,
  ADMIN_VIEW,
  COMING_SOON_VIEWS,
  NAV_SECTIONS,
  PAGE_HELP,
  PAGE_RELATED,
  PORTAL_AREAS,
  PORTAL_BLURBS,
  ROLE_NAV,
  firstPermittedView,
  portalForView,
  portalLabel,
  viewLabel,
} from "../data";
import type { Customer, DashView, Overview, PortalId, Vehicle } from "../types";
import { Administration } from "./Administration";
import { Analytics360 } from "./Analytics360";
import { DomainView } from "./DashboardViews";
import { ServiceView } from "./Hubs";
import { Finance360 } from "./Finance360";
import { MarketingStatusBadge, MarketingView } from "./MarketingView";
import { PAGE_WORKFLOW, WorkflowDiagram } from "./PageWorkflows";
import { PortalTabShell } from "./PortalShell";
import { CustomerView } from "./CustomerViews";
import { SidebarActionsProvider } from "./SidebarActions";
import type { SidebarAction } from "./SidebarActions";
import { Sales360 } from "./Sales360";
import { VehicleView } from "./VehicleViews";
import { UsedRecon } from "./UsedRecon";
import "./workspace-typography.css";

type DashboardAppProps = {
  // null when the URL carries no ?workspace=: sign-in then lands on the first portal this role
  // permits rather than on a cross-portal home screen, which no longer exists.
  initialView: DashView | null;
  initialRecordId?: string;
  onNavigate: (view: DashView, recordId?: string) => void;
  onLogout: () => void;
};

const viewIcons: Record<DashView, LucideIcon> = {
  customers: CircleUserRound,
  vehicles: CarFront,
  service: Wrench,
  parts: PackageSearch,
  usedcars: Warehouse,
  sales: BriefcaseBusiness,
  finance: CircleDollarSign,
  marketing: Megaphone,
  analytics: BarChart3,
  branch: Building2,
  group: Globe2,
  workforce: Users,
  company: ShieldCheck,
};

const COMING_SOON_COPY: Partial<Record<DashView, { description: string; planned: string[] }>> = {
  usedcars: { description: "Vehicle 360's disposition page. Dedicated acquisition, reconditioning, and auction workflows are planned beyond the shared vehicle record.", planned: ["Trade-in and appraisal workflow", "Reconditioning cost tracking", "Marketplace publishing and auction"] },
  branch: { description: "A branch-level performance rollup across sales, service, and parts is planned once target data is modeled.", planned: ["Branch scorecards", "Department drill-down", "Local risk and action tracking"] },
  group: { description: "Multi-branch comparisons and group reporting are planned once more than one branch has active operating data.", planned: ["Cross-branch comparisons", "Consolidated forecasting", "OEM scorecards"] },
  workforce: { description: "Productivity and profitability analysis of workforce data is planned once employee records are modeled. Managing people - schedules, roles, roster - stays in Administration.", planned: ["Productivity by advisor and technician", "Contribution to department profitability", "Capacity and utilisation trends"] },
};

type SearchHit = { id: string; title: string; detail: string; view: DashView };

export default function DashboardApp({ initialView, initialRecordId, onNavigate, onLogout }: DashboardAppProps) {
  const { user, organization } = useAuth();
  const landingView = useMemo(() => firstPermittedView(user?.role), [user]);
  const [view, setView] = useState<DashView>(initialView ?? landingView);
  const [recordId, setRecordId] = useState<string | undefined>(initialRecordId);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [commandResults, setCommandResults] = useState<SearchHit[]>([]);
  const [commandLoading, setCommandLoading] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [workspacePreview, setWorkspacePreview] = useState<PortalId | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [pageActions, setPageActions] = useState<SidebarAction[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);
  const topbarRef = useRef<HTMLElement>(null);
  const helpTriggerRef = useRef<HTMLButtonElement>(null);
  const helpPopoverRef = useRef<HTMLDivElement>(null);
  const workspaceMenuRef = useRef<HTMLElement>(null);
  const workspaceCloseTimerRef = useRef<number | undefined>(undefined);
  const landedRef = useRef(false);

  const allowedViews = useMemo(() => new Set(user ? ROLE_NAV[user.role] : []), [user]);
  // A portal earns its place in the primary sidebar when the role can reach at least one of its
  // areas - so granting Vehicle 360's workshop page does not have to grant its auction page too.
  const navSections = useMemo(
    () => NAV_SECTIONS
      .map((section) => ({ ...section, items: section.items.filter((item) => PORTAL_AREAS[item.id].some((area) => allowedViews.has(area.id))) }))
      .filter((section) => section.items.length > 0),
    [allowedViews],
  );
  const activePortal = portalForView(view);
  const portalPages = useMemo(
    () => (activePortal ? PORTAL_AREAS[activePortal].filter((area) => allowedViews.has(area.id)) : []),
    [activePortal, allowedViews],
  );

  useEffect(() => { if (initialView) setView(initialView); }, [initialView]);
  useEffect(() => setRecordId(initialRecordId), [initialRecordId]);
  // Sign-in with no ?workspace= in the URL: land on this role's first portal and write it into the
  // URL straight away, so the very first screen is as shareable and refresh-safe as any other.
  useEffect(() => {
    if (initialView || landedRef.current) return;
    landedRef.current = true;
    onNavigate(landingView);
  }, [initialView, landingView, onNavigate]);
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
      if (topbarRef.current?.contains(target) || workspaceMenuRef.current?.contains(target) || helpPopoverRef.current?.contains(target)) return;
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
          ...customerResult.customers.map((customer) => ({ id: customer.id, title: customer.displayName, detail: `Customer - ${customer.mobile ?? customer.email ?? "no contact on file"}`, view: "customers" as DashView })),
          ...vehicleResult.vehicles.map((vehicle) => ({ id: vehicle.id, title: `${vehicle.make} ${vehicle.model}`, detail: `Vehicle - ${vehicle.registration ?? vehicle.vin}`, view: "vehicles" as DashView })),
        ]);
        setCommandLoading(false);
      });
    }, 300);
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, [commandQuery]);
  // A legacy or hand-edited ?workspace= this role cannot reach falls back to its landing portal
  // instead of quietly rendering someone else's workspace at the wrong URL.
  useEffect(() => {
    if (!user || !allowedViews.size || allowedViews.has(view)) return;
    navigate(landingView);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, view, allowedViews, landingView]);
  useEffect(() => () => window.clearTimeout(workspaceCloseTimerRef.current), []);

  // The topbar names the portal; the tab strip names the page inside it.
  const currentLabel = activePortal ? portalLabel(activePortal) : viewLabel(view);
  const currentPageLabel = viewLabel(view);
  // A coming-soon page sends you back to its own portal's core page when that one is live (Group
  // analytics returns to Analytics 360's Dealership), otherwise to this role's landing portal.
  const backView = activePortal && activePortal !== view && !COMING_SOON_VIEWS.has(activePortal) && allowedViews.has(activePortal) ? activePortal : landingView;

  function navigate(next: DashView, nextRecordId?: string) {
    if (next !== view) setPageActions([]);
    setView(next);
    setRecordId(nextRecordId);
    onNavigate(next, nextRecordId);
    setMobileOpen(false);
    setWorkspaceMenuOpen(false);
    setHelpOpen(false);
  }

  function openPortal(portal: PortalId) {
    const firstPage = PORTAL_AREAS[portal].find((area) => allowedViews.has(area.id));
    if (firstPage) navigate(firstPage.id);
  }

  function showWorkspaceMenu(portal: PortalId | null = activePortal) {
    window.clearTimeout(workspaceCloseTimerRef.current);
    if (portal) setWorkspacePreview(portal);
    setWorkspaceMenuOpen(true);
  }

  function scheduleWorkspaceMenuClose() {
    window.clearTimeout(workspaceCloseTimerRef.current);
    workspaceCloseTimerRef.current = window.setTimeout(() => setWorkspaceMenuOpen(false), 180);
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

  // The active portal's own pages, mirroring the internal tab strip so the contextual sidebar and
  // the tabs never disagree about where you are. Single-page portals show nothing here.
  function renderPagesSection() {
    if (portalPages.length < 2) return null;
    return (
      <div key="pages">
        {!collapsed && <span className="nav-section-label">{currentLabel} pages</span>}
        {portalPages.map((area) => {
          const Icon = viewIcons[area.id];
          return (
            <button type="button" key={area.id} title={area.label} aria-current={view === area.id ? "page" : undefined} className={view === area.id ? "active" : ""} onClick={() => navigate(area.id)}>
              <Icon size={17} />{!collapsed && <span>{area.label}</span>}
            </button>
          );
        })}
      </div>
    );
  }

  function renderContextualSidebar() {
    // Cross-portal only: this portal's own pages are already listed above and in the tab strip.
    const related = (PAGE_RELATED[view] ?? []).filter((id) => allowedViews.has(id) && portalForView(id) !== activePortal);
    const relatedSection = related.length > 0 && (
      <div key="related">
        {!collapsed && <span className="nav-section-label">Related</span>}
        {related.map((id) => {
          const Icon = viewIcons[id];
          return <button title={viewLabel(id)} type="button" key={id} onClick={() => navigate(id)}><Icon size={17} />{!collapsed && <span>{viewLabel(id)}</span>}{!collapsed && id === "marketing" && <MarketingStatusBadge />}</button>;
        })}
      </div>
    );

    if (COMING_SOON_VIEWS.has(view)) {
      // The page body already lists planned features in full, so the sidebar only offers a way
      // onward - this portal's live pages and related portals - instead of repeating that list.
      return <>{renderPagesSection()}{relatedSection}</>;
    }

    const quickActions = pageActions.filter((action) => (action.group ?? "Quick actions") === "Quick actions");
    const recordActions = pageActions.filter((action) => action.group === "This record");
    return (
      <>
        {renderPagesSection()}
        {renderActionSection("Quick actions", quickActions)}
        {renderActionSection("This record", recordActions)}
        {relatedSection}
      </>
    );
  }

  // One slot per area. Every screen here is an existing component, re-parented unchanged: this
  // phase moves where a page is reached from, never what it does.
  function renderArea(area: DashView) {
    if (area === "customers") return <CustomerView onNavigate={navigate} openId={recordId} />;
    if (area === "vehicles") return <VehicleView onNavigate={navigate} openId={recordId} />;
    if (area === "service") return <ServiceView onNavigate={navigate} />;
    if (area === "parts") return <DomainView view="parts" />;
    if (area === "usedcars") return <UsedRecon />;
    if (area === "sales") return <Sales360 onNavigate={navigate} />;
    if (area === "finance") return <Finance360 />;
    if (area === "marketing") return <MarketingView />;
    if (area === "analytics" || area === "branch" || area === "group" || area === "workforce") return <Analytics360 area={area} onNavigate={navigate} />;
    if (area === ADMIN_VIEW) return <Administration />;
    const copy = COMING_SOON_COPY[area as DashView];
    return (
      <ComingSoon
        title={viewLabel(area)}
        description={copy?.description ?? "This page is planned next."}
        planned={copy?.planned ?? []}
        backView={backView}
        backLabel={`Back to ${viewLabel(backView)}`}
        onNavigate={navigate}
      />
    );
  }

  function renderView() {
    if (!user) return null;
    if (!allowedViews.size) return <div className="workspace-page"><p className="record-search-state">Your role has no workspaces assigned. Ask an administrator to grant access.</p></div>;
    // The redirect effect above is already moving to the landing portal.
    if (!allowedViews.has(view)) return <div className="workspace-page"><p className="record-search-state">Opening your workspace...</p></div>;
    const body = renderArea(view);
    if (activePortal && portalPages.length > 1) {
      return <PortalTabShell label={currentLabel} areas={portalPages} activeView={view} onSelect={navigate}>{body}</PortalTabShell>;
    }
    return body;
  }

  const CurrentViewIcon = viewIcons[activePortal ?? view];
  const orgInitials = (organization?.name ?? "AX").split(" ").map((part) => part[0]).slice(0, 3).join("").toUpperCase();
  const userInitials = (user?.name ?? "?").split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  const pageHelp = PAGE_HELP[view] ?? {
    summary: COMING_SOON_COPY[view]?.description ?? "This page is planned next.",
    canDo: (COMING_SOON_COPY[view]?.planned ?? []).map((item) => `Planned: ${item}`),
  };
  const workflowSteps = PAGE_WORKFLOW[view];
  const previewPortal = workspacePreview ?? activePortal ?? navSections[0]?.items[0]?.id ?? null;
  const previewPages = previewPortal ? PORTAL_AREAS[previewPortal].filter((area) => allowedViews.has(area.id)) : [];

  return (
    <SidebarActionsProvider value={{ setActions: setPageActions }}>
      <div className="operations-shell">
        <button type="button" className={`mobile-scrim ${mobileOpen ? "visible" : ""}`} aria-label="Close navigation" onClick={() => setMobileOpen(false)} />
        {/* Primary sidebar: the six portals, icon plus text label, never icon-only. */}
        <aside className="portal-sidebar" aria-label="Portals">
          <div className="portal-brand"><Brand inverse /></div>
          <nav className="portal-nav">
            {navSections.map((section) => (
              <div key={section.label}>
                <span className="nav-section-label">{section.label}</span>
                {section.items.map((item) => {
                  const Icon = viewIcons[item.id];
                  return (
                    <button type="button" key={item.id} title={item.label} aria-current={activePortal === item.id ? "page" : undefined} className={activePortal === item.id ? "active" : ""} onClick={() => openPortal(item.id)}>
                      <Icon size={17} /><span>{item.label}</span>{item.id === "marketing" && <MarketingStatusBadge />}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>
        {/* Contextual secondary sidebar: the active portal's pages, its live actions, related portals. */}
        <aside className={`operations-sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
          <div className="sidebar-brand"><Brand inverse compact={collapsed} />{!collapsed && <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X /></button>}</div>
          {!collapsed && <div className="group-switcher"><span>{orgInitials}</span><div><strong>{organization?.name ?? "Your company"}</strong><small>{overview ? `${overview.activeServiceJobs} active jobs - ${overview.openLeads} open leads` : "Loading operations"}</small></div></div>}
          <nav className="operations-nav mobile-workspace-list" aria-label="Portals">
            {navSections.map((section) => (
              <div key={section.label}>
                {!collapsed && <span className="nav-section-label">{section.label}</span>}
                {section.items.map((item) => {
                  const Icon = viewIcons[item.id];
                  return <button type="button" key={item.id} title={item.label} aria-current={activePortal === item.id ? "page" : undefined} className={activePortal === item.id ? "active" : ""} onClick={() => openPortal(item.id)}><Icon size={17} />{!collapsed && <span>{item.label}</span>}{!collapsed && item.id === "marketing" && <MarketingStatusBadge />}</button>;
                })}
              </div>
            ))}
          </nav>
          <nav className="operations-nav" aria-label={`${currentPageLabel} pages and actions`}>
            {renderContextualSidebar()}
          </nav>
          <button type="button" className="collapse-button" aria-label={collapsed ? "Expand contextual sidebar" : "Collapse contextual sidebar"} title={collapsed ? "Expand contextual sidebar" : "Collapse contextual sidebar"} onClick={() => setCollapsed((value) => !value)}>{collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}</button>
        </aside>

        <div className="operations-main">
          <header className="operations-topbar" ref={topbarRef}>
            <div className="topbar-left">
              <button type="button" className="mobile-nav-trigger" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu /></button>
              <span className="mobile-topbar-brand"><Brand compact /></span>
              <span className="topbar-divider" />
              <button type="button" className="workspace-switcher" aria-expanded={workspaceMenuOpen} onPointerEnter={() => showWorkspaceMenu()} onPointerLeave={scheduleWorkspaceMenuClose} onFocus={() => showWorkspaceMenu()} onClick={() => showWorkspaceMenu()}><span className="workspace-switcher-icon"><CurrentViewIcon /></span><span><small>Portal</small><strong>{currentLabel}</strong>{activePortal === "marketing" && <MarketingStatusBadge />}</span><ChevronDown /></button>
              <button ref={helpTriggerRef} type="button" aria-label="What is this page?" aria-expanded={helpOpen} className="icon-button page-help-trigger" onClick={() => setHelpOpen((value) => !value)}><HelpCircle size={17} /></button>
            </div>
            <div className="topbar-actions">
              <button type="button" className="global-search" onClick={() => setCommandOpen(true)}><Search size={16} /><span>Search customer, VIN...</span><kbd>Ctrl K</kbd></button>
              <button type="button" aria-label="Notifications" className="icon-button" onClick={() => setNoticeOpen((value) => !value)}><Bell size={17} />{overview && (overview.activeServiceJobs > 0 || overview.lowStockParts > 0) && <i />}</button>
              <button type="button" className="user-menu" aria-expanded={profileOpen} onClick={() => setProfileOpen((value) => !value)}><span>{userInitials}</span><div><strong>{user?.name ?? "Loading"}</strong><small>{user ? roleLabel(user.role) : ""}</small></div><ChevronDown size={14} /></button>
            </div>
            {helpOpen && (
              <Popover ref={helpPopoverRef} isOpen triggerRef={helpTriggerRef} onOpenChange={setHelpOpen} placement="bottom start" className="page-help-popover" aria-label={`About ${currentPageLabel}`}>
                <span>{currentPageLabel}</span>
                <p>{pageHelp.summary}</p>
                <ul>{pageHelp.canDo.map((item) => <li key={item}>{item}</li>)}</ul>
                {workflowSteps && (
                  <details className="workflow-disclosure">
                    <summary>See how this works</summary>
                    <WorkflowDiagram steps={workflowSteps} />
                  </details>
                )}
              </Popover>
            )}
            {noticeOpen && (
              <div className="notification-popover">
                <span>Operations notifications</span>
                {overview ? (
                  <>
                    {allowedViews.has("service") && <button type="button" onClick={() => navigate("service")}><b>{overview.activeServiceJobs} active service jobs</b><small>Open in Vehicle 360 - Service and workshop</small></button>}
                    {allowedViews.has("parts") && <button type="button" onClick={() => navigate("parts")}><b>{overview.lowStockParts} parts at or below reorder point</b><small>Open in Vehicle 360 - Parts</small></button>}
                    {allowedViews.has("sales") && <button type="button" onClick={() => navigate("sales")}><b>{overview.openLeads} open leads</b><small>Open in Sales 360</small></button>}
                  </>
                ) : <span className="notification-empty">Live operational counts are temporarily unavailable.</span>}
              </div>
            )}
            {profileOpen && (
              <div className="profile-popover">
                <header className="profile-popover-header"><span>{userInitials}</span><p><strong>{user?.name}</strong><small>{user?.email}</small></p></header>
                {/* Administration is not a portal: employees, roles, branches, and audit history
                    are account/settings concerns, reached from here rather than the sidebar. */}
                {allowedViews.has(ADMIN_VIEW) && (
                  <button type="button" aria-current={view === ADMIN_VIEW ? "page" : undefined} onClick={() => { setProfileOpen(false); navigate(ADMIN_VIEW); }}><ShieldCheck size={15} />{ADMIN_LABEL}</button>
                )}
                <button type="button" onClick={onLogout}><LogOut size={15} />Sign out</button>
                <a href="mailto:support@prakashinfotech.com"><UserRound size={15} />Prakash support</a>
                <footer>Workspace by <strong>Prakash Software Solutions</strong></footer>
              </div>
            )}
          </header>
          {workspaceMenuOpen && (
            <section className="workspace-menu" aria-label="Choose a portal" ref={workspaceMenuRef} onPointerEnter={() => showWorkspaceMenu()} onPointerLeave={scheduleWorkspaceMenuClose}>
              <header><div><span>Portal navigator</span><strong>Move to the work, not another app.</strong></div><button type="button" onClick={() => setWorkspaceMenuOpen(false)} aria-label="Close portal navigator"><X /></button></header>
              <div className="workspace-menu-body">
                <div className="workspace-menu-groups">
                  {navSections.map((section) => (
                    <div key={section.label}>
                      <span>{section.label}</span>
                      {section.items.map((item) => {
                        const Icon = viewIcons[item.id];
                        return <button type="button" key={item.id} className={activePortal === item.id ? "active" : ""} onPointerEnter={() => setWorkspacePreview(item.id)} onFocus={() => setWorkspacePreview(item.id)} onClick={() => openPortal(item.id)}><i><Icon /></i><span><strong>{item.label}{item.id === "marketing" && <MarketingStatusBadge />}</strong><small>{PORTAL_BLURBS[item.id]}</small></span><ArrowRight /></button>;
                      })}
                    </div>
                  ))}
                </div>
                {previewPortal && (
                  <aside className="workspace-menu-preview" aria-label={`${portalLabel(previewPortal)} pages`}>
                    <span>Pages in this portal</span>
                    <strong>{portalLabel(previewPortal)}</strong>
                    <p>{PORTAL_BLURBS[previewPortal]}</p>
                    <nav>
                      {previewPages.map((area) => {
                        const Icon = viewIcons[area.id];
                        return <button type="button" key={area.id} className={view === area.id ? "active" : ""} onClick={() => navigate(area.id)}><Icon /><span><strong>{area.label}</strong><small>{view === area.id ? "Current page" : `Open ${area.label}`}</small></span><ArrowRight /></button>;
                      })}
                    </nav>
                  </aside>
                )}
              </div>
            </section>
          )}
          <main className="operations-content">{renderView()}</main>
        </div>
        {commandOpen && (
          <Dialog title="Global record search" onClose={() => setCommandOpen(false)} className="command-palette">
            <div className="command-palette-content">
              <header><Search /><input autoFocus value={commandQuery} onChange={(event) => setCommandQuery(event.target.value)} placeholder="Search customer, mobile, VIN, registration, make or model" /><kbd>ESC</kbd></header>
              <span>{commandLoading ? "Searching..." : commandQuery.trim().length < 2 ? "Type at least two characters to search connected records." : `${commandResults.length} matching records`}</span>
              {commandResults.map((record) => <button type="button" key={`${record.view}-${record.id}`} onClick={() => { navigate(record.view, record.id); setCommandOpen(false); setCommandQuery(""); }}><CircleUserRound /><div><strong>{record.title}</strong><small>{record.detail}</small></div><ArrowRight /></button>)}
              {!commandLoading && commandQuery.trim().length >= 2 && !commandResults.length && <div className="command-empty"><Search /><strong>No matching records</strong><span>Try a customer name, mobile, VIN, registration, or model.</span></div>}
            </div>
          </Dialog>
        )}
      </div>
    </SidebarActionsProvider>
  );
}
