import { lazy, Suspense, useEffect, useState } from "react";
import LandingPage from "./LandingPage";
import type { AppView, DashView } from "./types";

const DashboardApp = lazy(() => import("./dashboard/DashboardApp"));

const DASH_VIEWS: DashView[] = ["overview", "sales", "service", "parts", "finance", "vehicles", "customers", "marketing", "usedcars", "inventory", "branch", "group", "workforce"];

function readRoute(): { appView: AppView; dashView: DashView } {
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
    if (view) url.searchParams.set("workspace", view);
    else url.searchParams.delete("workspace");
    window.history.pushState({ autoAxis: view ? "workspace" : "product", view }, "", `${url.pathname}${url.search}${url.hash}`);
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
