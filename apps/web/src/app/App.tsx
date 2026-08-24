import { lazy, Suspense, useEffect, useState } from "react";
import LandingPage from "./LandingPage";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import LoginPage from "./auth/LoginPage";
import SignupPage from "./auth/SignupPage";
import { CrashFallback, ErrorBoundary } from "./components/ErrorBoundary";
import type { AppView, DashView } from "./types";

const DashboardApp = lazy(() => import("./dashboard/DashboardApp"));

const DASH_VIEWS: DashView[] = ["overview", "sales", "service", "parts", "finance", "vehicles", "customers", "marketing", "usedcars", "inventory", "branch", "group", "workforce", "company"];

function readRoute(): { appView: AppView; dashView: DashView; recordId?: string } {
  const params = new URLSearchParams(window.location.search);
  const candidate = params.get("workspace") as DashView | null;
  const recordId = params.get("record") ?? undefined;
  return candidate && DASH_VIEWS.includes(candidate)
    ? { appView: "dashboard", dashView: candidate, recordId }
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

  // recordId makes a search result or a customer<->vehicle cross-link a real, shareable,
  // refresh-safe URL (?workspace=customers&record=<id>) instead of only switching the workspace
  // and landing on whichever record happened to load first.
  function writeRoute(view?: DashView, targetRecordId?: string) {
    const url = new URL(window.location.href);
    if (view) url.searchParams.set("workspace", view);
    else url.searchParams.delete("workspace");
    if (targetRecordId) url.searchParams.set("record", targetRecordId);
    else url.searchParams.delete("record");
    window.history.pushState({ autoAxis: view ? "workspace" : "product", view, recordId: targetRecordId }, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function openWorkspace(view: DashView = "overview") {
    writeRoute(view);
    setDashView(view);
    setRecordId(undefined);
    setAppView("dashboard");
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function changeWorkspace(view: DashView, targetRecordId?: string) {
    if (view !== dashView || targetRecordId !== recordId) writeRoute(view, targetRecordId);
    setDashView(view);
    setRecordId(targetRecordId);
  }

  function openProductSite() {
    writeRoute();
    setAppView("landing");
    setRecordId(undefined);
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
      <ErrorBoundary
        fallback={(reset) => (
          <CrashFallback
            title="This workspace hit a problem"
            detail="Something went wrong rendering this page. Your session is still active — try again, or pick another workspace from the sidebar once it reloads."
            onRetry={() => {
              reset();
              changeWorkspace("overview");
            }}
          />
        )}
      >
        <Suspense fallback={<WorkspaceLoader />}>
          <DashboardApp initialView={dashView} initialRecordId={recordId} onNavigate={changeWorkspace} onLogout={handleLogout} />
        </Suspense>
      </ErrorBoundary>
    );
  }

  if (appView === "login") return <LoginPage onSuccess={handleAuthSuccess} onBackToSite={openProductSite} onGoToSignup={openSignup} />;
  if (appView === "signup") return <SignupPage onSuccess={handleAuthSuccess} onBackToSite={openProductSite} onGoToLogin={openLogin} />;

  return <LandingPage onOpenWorkspace={openWorkspace} onGoToLogin={openLogin} onGoToSignup={openSignup} />;
}

export default function App() {
  return (
    <ErrorBoundary
      fallback={(reset) => (
        <CrashFallback
          title="AutoAxis hit an unexpected problem"
          detail="Reloading usually clears this. If it keeps happening, sign out and back in."
          onRetry={() => {
            reset();
            window.location.reload();
          }}
        />
      )}
    >
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </ErrorBoundary>
  );
}
