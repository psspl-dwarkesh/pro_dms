import { createContext, useContext, useEffect } from "react";
import type { DependencyList, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

// Lets a page component (Customer 360, Sales, etc.) publish its own quick actions
// into the contextual sidebar that DashboardApp renders alongside it, without
// threading the action list through props on every page component.
export type SidebarAction = {
  id: string;
  label: string;
  detail?: string;
  icon: LucideIcon;
  onClick?: () => void;
  href?: string;
  tone?: "danger";
};

type SidebarActionsContextValue = { setActions: (actions: SidebarAction[]) => void };

const SidebarActionsContext = createContext<SidebarActionsContextValue>({ setActions: () => undefined });

export function SidebarActionsProvider({ value, children }: { value: SidebarActionsContextValue; children: ReactNode }) {
  return <SidebarActionsContext.Provider value={value}>{children}</SidebarActionsContext.Provider>;
}

// factory is only invoked when `deps` change, same contract as useEffect/useMemo -
// list every value the returned actions close over (selected record, loaded rows, filters, ...).
export function useContextualActions(factory: () => SidebarAction[], deps: DependencyList) {
  const { setActions } = useContext(SidebarActionsContext);
  useEffect(() => {
    setActions(factory());
    return () => setActions([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
