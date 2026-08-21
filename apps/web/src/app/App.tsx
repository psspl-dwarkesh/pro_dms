import { lazy, Suspense, useState } from "react";
import LandingPage from "./LandingPage";
import type { AppView, DashView } from "./types";

const DashboardApp = lazy(() => import("./dashboard/DashboardApp"));

function WorkspaceLoader() {
  return (
    <div className="workspace-loader" role="status" aria-live="polite">
      <span className="workspace-loader-mark">A</span>
      <div><strong>Loading operations workspace</strong><span>Connecting shared customer and vehicle context…</span></div>
    </div>
  );
}

export default function App() {
  const [appView, setAppView] = useState<AppView>("landing");
  const [dashView, setDashView] = useState<DashView>("overview");

  function openWorkspace(view: DashView = "overview") {
    setDashView(view);
    setAppView("dashboard");
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  if (appView === "dashboard") {
    return (
      <Suspense fallback={<WorkspaceLoader />}>
        <DashboardApp initialView={dashView} onExit={() => setAppView("landing")} />
      </Suspense>
    );
  }

  return <LandingPage onOpenWorkspace={openWorkspace} />;
}
