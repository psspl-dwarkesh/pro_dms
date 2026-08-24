import type { KeyboardEvent, ReactNode } from "react";
import type { DashView } from "../types";

// The internal tab shell a multi-area portal renders: one labelled tab per sub-area the signed-in
// role can reach, plus a single slot holding whichever sub-area is active. The strip owns
// navigation only - sub-area screens are re-parented into the slot unchanged, so moving a screen
// in here never changes what it does.
//
// Vehicle 360 and Analytics 360 use this today. A portal with one area (Customer 360, Sales 360,
// Finance 360, Marketing 360) renders its page directly and picks the strip up automatically once
// its own chat adds a second area to PORTAL_AREAS in data.ts.
//
// Tabs use manual activation: arrows, Home, and End move focus along the strip, and Enter or Space
// activates - so keyboard users are not dragged through a route change per keypress.
export function PortalTabShell({ label, areas, activeView, onSelect, children }: {
  label: string;
  areas: Array<{ id: DashView; label: string }>;
  activeView: DashView;
  onSelect: (view: DashView) => void;
  children: ReactNode;
}) {
  function moveFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
    const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    const current = tabs.findIndex((tab) => tab === document.activeElement);
    if (current === -1) return;
    event.preventDefault();
    const next =
      event.key === "Home" ? 0
      : event.key === "End" ? tabs.length - 1
      : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next]?.focus();
  }

  return (
    <div className="portal-tab-shell">
      <div className="portal-tabs" role="tablist" aria-label={`${label} pages`} onKeyDown={moveFocus}>
        {areas.map((area) => (
          <button
            type="button"
            role="tab"
            key={area.id}
            id={`portal-tab-${area.id}`}
            aria-selected={area.id === activeView}
            aria-controls="portal-tab-panel"
            tabIndex={area.id === activeView ? 0 : -1}
            onClick={() => onSelect(area.id)}
          >
            {area.label}
          </button>
        ))}
      </div>
      <div
        className="portal-tab-panel"
        id="portal-tab-panel"
        role="tabpanel"
        aria-labelledby={`portal-tab-${activeView}`}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  );
}
