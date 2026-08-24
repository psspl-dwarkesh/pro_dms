import { lazy, Suspense, useEffect, useState } from "react";
import LandingPage from "./LandingPage";
import type { AppView, DashView } from "./types";

const DashboardApp = lazy(() => import("./dashboard/DashboardApp"));

const DASH_VIEWS: DashView[] = ["overview", "sales", "service", "parts", "finance", "vehicles", "customers", "marketing", "usedcars", "inventory", "branch", "group", "workforce"];

const VIEW_PATHS: Record<DashView, string> = {
  overview: "/app/home",
  customers: "/app/customers",
  vehicles: "/app/vehicles",
  sales: "/app/sales",
  finance: "/app/sales/finance",
  service: "/app/fixed-operations",
  parts: "/app/fixed-operations/parts",
  inventory: "/app/inventory-used",
  usedcars: "/app/inventory-used/used",
  marketing: "/app/growth",
  group: "/app/insights/group",
  branch: "/app/insights/branch",
  workforce: "/app/workforce-admin",
};

const PATH_VIEWS = Object.fromEntries(Object.entries(VIEW_PATHS).map(([view, path]) => [path, view])) as Record<string, DashView>;

function readRoute(): { appView: AppView; dashView: DashView; recordId?: string } {
  const pathname = window.location.pathname.replace(/\/$/, "") || "/";
  if (pathname.startsWith(`${VIEW_PATHS.customers}/`)) return { appView: "dashboard", dashView: "customers", recordId: decodeURIComponent(pathname.slice(VIEW_PATHS.customers.length + 1)) };
  if (pathname.startsWith(`${VIEW_PATHS.vehicles}/`)) return { appView: "dashboard", dashView: "vehicles", recordId: decodeURIComponent(pathname.slice(VIEW_PATHS.vehicles.length + 1)) };
  const pathView = PATH_VIEWS[pathname];
  if (pathView) return { appView: "dashboard", dashView: pathView };
  const candidate = new URLSearchParams(window.location.search).get("workspace") as DashView | null;
  return candidate && DASH_VIEWS.includes(candidate)
    ? { appView: "dashboard", dashView: candidate }
    : { appView: "landing", dashView: "overview" };
}

function WorkspaceLoader() {
  return (
    <div className="workspace-loader" role="status" aria-live="polite">
      <span className="workspace-loader-mark">A</span>
      <div><strong>Loading operations workspace</strong><span>Connecting shared customer and vehicle context…</span></div>
    </div>
  );
}

export default function App() {
  const initialRoute = readRoute();
  const [appView, setAppView] = useState<AppView>(initialRoute.appView);
  const [dashView, setDashView] = useState<DashView>(initialRoute.dashView);
  const [recordId, setRecordId] = useState<string | undefined>(initialRoute.recordId);

  useEffect(() => {
    function handlePopState() {
      const route = readRoute();
      setAppView(route.appView);
      setDashView(route.dashView);
      setRecordId(route.recordId);
      window.scrollTo({ top: 0, behavior: "auto" });
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function writeRoute(view?: DashView, selectedRecordId?: string) {
    const url = new URL(window.location.href);
    url.searchParams.delete("workspace");
    const basePath = view ? VIEW_PATHS[view] : "/";
    const pathname = view && selectedRecordId && (view === "customers" || view === "vehicles") ? `${basePath}/${encodeURIComponent(selectedRecordId)}` : basePath;
    window.history.pushState({ autoAxis: view ? "workspace" : "product", view }, "", `${pathname}${url.search}${url.hash}`);
  }

  function openWorkspace(view: DashView = "overview") {
    writeRoute(view);
    setDashView(view);
    setRecordId(undefined);
    setAppView("dashboard");
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function changeWorkspace(view: DashView, selectedRecordId?: string) {
    if (view !== dashView || selectedRecordId !== recordId) writeRoute(view, selectedRecordId);
    setDashView(view);
    setRecordId(selectedRecordId);
  }

  function openProductSite() {
    writeRoute();
    setAppView("landing");
    setRecordId(undefined);
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  if (appView === "dashboard") {
    return (
      <Suspense fallback={<WorkspaceLoader />}>
        <DashboardApp initialView={dashView} initialRecordId={recordId} onNavigate={changeWorkspace} onExit={openProductSite} />
      </Suspense>
    );
  }

  return <LandingPage onOpenWorkspace={openWorkspace} />;
}
