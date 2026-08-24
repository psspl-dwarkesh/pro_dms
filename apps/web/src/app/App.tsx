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

function readRoute(): { appView: AppView; dashView: DashView } {
  const pathView = PATH_VIEWS[window.location.pathname.replace(/\/$/, "") || "/"];
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

  useEffect(() => {
    function handlePopState() {
      const route = readRoute();
      setAppView(route.appView);
      setDashView(route.dashView);
      window.scrollTo({ top: 0, behavior: "auto" });
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function writeRoute(view?: DashView) {
    const url = new URL(window.location.href);
    url.searchParams.delete("workspace");
    const pathname = view ? VIEW_PATHS[view] : "/";
    window.history.pushState({ autoAxis: view ? "workspace" : "product", view }, "", `${pathname}${url.search}${url.hash}`);
  }

  function openWorkspace(view: DashView = "overview") {
    writeRoute(view);
    setDashView(view);
    setAppView("dashboard");
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function changeWorkspace(view: DashView) {
    if (view !== dashView) writeRoute(view);
    setDashView(view);
  }

  function openProductSite() {
    writeRoute();
    setAppView("landing");
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  if (appView === "dashboard") {
    return (
      <Suspense fallback={<WorkspaceLoader />}>
        <DashboardApp initialView={dashView} onNavigate={changeWorkspace} onExit={openProductSite} />
      </Suspense>
    );
  }

  return <LandingPage onOpenWorkspace={openWorkspace} />;
}
