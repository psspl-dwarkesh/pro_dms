import { lazy, Suspense, useEffect, useState } from "react";
import LandingPage from "./LandingPage";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import LoginPage from "./auth/LoginPage";
import SignupPage from "./auth/SignupPage";
import type { AppView, DashView } from "./types";

const DashboardApp = lazy(() => import("./dashboard/DashboardApp"));

const DASH_VIEWS: DashView[] = ["overview", "sales", "service", "parts", "finance", "vehicles", "customers", "marketing", "usedcars", "inventory", "branch", "group", "workforce", "company"];

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
      <div><strong>Loading operations workspace</strong><span>Connecting shared customer and vehicle context...</span></div>
    </div>
  );
}

function AppShell() {
  const { status, logout } = useAuth();
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

  function openLogin() {
    setAppView("login");
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function openSignup() {
    setAppView("signup");
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function handleAuthSuccess() {
    writeRoute(dashView);
    setAppView("dashboard");
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function handleLogout() {
    logout();
    openProductSite();
  }

  if (status === "loading") return <WorkspaceLoader />;

  if (appView === "dashboard" && status !== "authenticated") {
    return <LoginPage onSuccess={handleAuthSuccess} onBackToSite={openProductSite} onGoToSignup={openSignup} />;
  }

  if (appView === "dashboard") {
    return (
      <Suspense fallback={<WorkspaceLoader />}>
        <DashboardApp initialView={dashView} onNavigate={changeWorkspace} onLogout={handleLogout} />
      </Suspense>
    );
  }

  if (appView === "login") return <LoginPage onSuccess={handleAuthSuccess} onBackToSite={openProductSite} onGoToSignup={openSignup} />;
  if (appView === "signup") return <SignupPage onSuccess={handleAuthSuccess} onBackToSite={openProductSite} onGoToLogin={openLogin} />;

  return <LandingPage onOpenWorkspace={openWorkspace} onGoToLogin={openLogin} onGoToSignup={openSignup} />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
