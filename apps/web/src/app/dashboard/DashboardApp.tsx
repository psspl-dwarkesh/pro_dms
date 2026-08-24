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
import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../../lib/api";
import { Brand } from "../components/Brand";
import { NAV_SECTIONS } from "../data";
import type { DashView } from "../types";
import { DomainView, OverviewView } from "./DashboardViews";
import { CustomerView, Toast, VehicleView, WorkflowModal } from "./RecordViews";

type DashboardAppProps = { initialView: DashView; onNavigate: (view: DashView) => void; onExit: () => void };

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

const viewLabels = Object.fromEntries(NAV_SECTIONS.flatMap((section) => section.items.map((item) => [item.id, item.label]))) as Record<DashView, string>;

type Health = { service?: string; status?: string; database?: string | { status?: string } };

const GLOBAL_RECORDS: Array<{ title: string; detail: string; view: DashView; icon: typeof Search; keywords: string }> = [
  { title: "James Hartley", detail: "Customer · 04•• ••• 214 · 1 vehicle", view: "customers", icon: CircleUserRound, keywords: "james hartley customer mobile email" },
  { title: "Ava Nguyen", detail: "Customer · VIP · Audi Q7 enquiry", view: "customers", icon: CircleUserRound, keywords: "ava nguyen customer vip audi q7" },
  { title: "BMW X5 · DMS-360", detail: "Vehicle · WBA•••345 · James Hartley", view: "vehicles", icon: CarFront, keywords: "bmw x5 dms-360 vin registration james" },
  { title: "RO-18506", detail: "Repair order · digital approval waiting", view: "service", icon: Wrench, keywords: "ro-18506 repair service approval" },
  { title: "Deal S-10982", detail: "Sales · delivery pack ready", view: "sales", icon: BriefcaseBusiness, keywords: "deal s-10982 sales delivery" },
];

export default function DashboardApp({ initialView, onNavigate, onExit }: DashboardAppProps) {
  const [view, setView] = useState<DashView>(initialView);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [health, setHealth] = useState<"checking" | "connected" | "demo" | "unavailable">("checking");
  const [commandOpen, setCommandOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileEdit, setProfileEdit] = useState(false);
  const [profile, setProfile] = useState({ name: "Olivia Lawson", role: "Group operations", email: "olivia.lawson@prakashinfotech.com", branch: "All branches" });
  const [toast, setToast] = useState("");

  useEffect(() => setView(initialView), [initialView]);
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
    function handleKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setCommandOpen(true); }
      if (event.key === "Escape") { setCommandOpen(false); setMobileOpen(false); setNoticeOpen(false); setProfileOpen(false); setWorkspaceMenuOpen(false); }
    }
    window.addEventListener("keydown", handleKey); return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const currentLabel = useMemo(() => viewLabels[view] ?? "Executive pulse", [view]);
  const commandResults = useMemo(() => {
    const search = commandQuery.trim().toLowerCase();
    return search ? GLOBAL_RECORDS.filter((record) => `${record.title} ${record.detail} ${record.keywords}`.toLowerCase().includes(search)) : GLOBAL_RECORDS.slice(0, 4);
  }, [commandQuery]);

  function navigate(next: DashView) {
    setView(next);
    onNavigate(next);
    setMobileOpen(false);
    setWorkspaceMenuOpen(false);
    document.querySelector(".operations-content")?.scrollTo({ top: 0, behavior: "auto" });
  }

  function renderView() {
    if (view === "overview") return <OverviewView onNavigate={navigate} />;
    if (view === "customers") return <CustomerView onNavigate={navigate} />;
    if (view === "vehicles") return <VehicleView onNavigate={navigate} />;
    return <DomainView view={view} />;
  }

  const CurrentViewIcon = viewIcons[view];

  return (
    <div className="operations-shell">
      <button type="button" className={`mobile-scrim ${mobileOpen ? "visible" : ""}`} aria-label="Close navigation" onClick={() => setMobileOpen(false)} />
      <aside className={`operations-sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-brand"><Brand inverse compact={collapsed} />{!collapsed && <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X /></button>}</div>
        {!collapsed && <button type="button" className="group-switcher" onClick={() => navigate("group")}><span>PMG</span><div><strong>Pacific Motor Group</strong><small>12 branches · Australia</small></div><ChevronDown size={15} /></button>}
        <nav className="operations-nav" aria-label="Operations navigation">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label}>
              {!collapsed && <span className="nav-section-label">{section.label}</span>}
              {section.items.map((item) => {
                const Icon = viewIcons[item.id];
                return <button title={item.label} aria-current={view === item.id ? "page" : undefined} type="button" key={item.id} className={view === item.id ? "active" : ""} onClick={() => navigate(item.id)}><Icon size={17} /><span>{item.label}</span>{view === item.id && !collapsed && <i />}</button>;
              })}
            </div>
          ))}
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
        {workspaceMenuOpen && <section className="workspace-menu" aria-label="Choose a workspace"><header><div><span>Workspace navigator</span><strong>Move to the work—not another app.</strong></div><button type="button" onClick={() => setWorkspaceMenuOpen(false)} aria-label="Close workspace navigator"><X /></button></header><div className="workspace-menu-groups">{NAV_SECTIONS.map((section) => <div key={section.label}><span>{section.label}</span>{section.items.map((item) => { const Icon = viewIcons[item.id]; return <button type="button" key={item.id} className={view === item.id ? "active" : ""} onClick={() => navigate(item.id)}><i><Icon /></i><span><strong>{item.label}</strong><small>{item.id === "customers" ? "Relationship, consent and value" : item.id === "vehicles" ? "VIN lifecycle and condition" : item.id === "overview" ? "Decisions and exceptions" : "Open connected operations"}</small></span><ArrowRight /></button>; })}</div>)}</div></section>}
        <main className="operations-content">{renderView()}</main>
      </div>
      {commandOpen && <div className="command-scrim" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && setCommandOpen(false)}><section className="command-palette" role="dialog" aria-modal="true" aria-label="Global record search"><header><Search /><input autoFocus value={commandQuery} onChange={(event) => setCommandQuery(event.target.value)} placeholder="Search customer, mobile, VIN, registration or repair order" />{commandQuery && <button type="button" className="command-clear" aria-label="Clear global search" onClick={() => setCommandQuery("")}><X /></button>}<kbd>ESC</kbd></header><span>{commandQuery ? `${commandResults.length} matching records` : "Quick demonstration records"}</span>{commandResults.map((record) => { const Icon = record.icon; return <button type="button" key={record.title} onClick={() => { navigate(record.view); setCommandOpen(false); setCommandQuery(""); }}><Icon /><div><strong>{record.title}</strong><small>{record.detail}</small></div><ArrowRight /></button>; })}{!commandResults.length && <div className="command-empty"><Search /><strong>No matching records</strong><span>Try a customer name, mobile, VIN, registration, RO or deal number.</span></div>}</section></div>}
      {profileEdit && <WorkflowModal title="Edit workspace profile" eyebrow="Prakash Infotech account" completeLabel="Save profile" onClose={() => setProfileEdit(false)} onComplete={() => { setProfileEdit(false); setToast("Profile and workspace preferences updated."); window.setTimeout(() => setToast(""), 2600); }}><div className="profile-edit-form"><label><span>Display name</span><input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></label><label><span>Role</span><input value={profile.role} onChange={(event) => setProfile({ ...profile, role: event.target.value })} /></label><label><span>Email</span><input type="email" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} /></label><label><span>Default branch</span><select value={profile.branch} onChange={(event) => setProfile({ ...profile, branch: event.target.value })}><option>All branches</option><option>Sydney Central</option><option>North Shore</option><option>Parramatta</option></select></label><label className="profile-check"><input type="checkbox" defaultChecked /><span>Email the daily briefing at 08:00</span></label><label className="profile-check"><input type="checkbox" defaultChecked /><span>Notify me about critical customer promises</span></label></div></WorkflowModal>}
      {toast && <Toast message={toast} />}
    </div>
  );
}
