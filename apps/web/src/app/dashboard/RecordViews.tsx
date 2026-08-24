import {
  ArrowRight, BadgeCheck, Plus, X,
} from "lucide-react";
import { ReactNode, useEffect, useRef } from "react";
import { ApiError } from "../../lib/api";
import type {
  DashView,
} from "../types";

// openId: when a global search result or a cross-record link (e.g. "Current owner", a vehicle
// inside a customer's Vehicles tab) hands this view a specific record id, it opens that exact
// record instead of defaulting to the first row in the directory. recordId on onNavigate is the
// matching half of that contract for outbound links.
export type RecordViewProps = { onNavigate: (view: DashView, recordId?: string) => void; openId?: string };

// Applies `openId` to `setSelectedId` once per distinct value, so repeat renders (list reloads,
// tab switches) do not stomp on a selection the user already made by clicking around the
// directory. A new distinct openId (a fresh search selection while already on this page) still
// takes effect.
export function useOpenIdSelection(openId: string | undefined, setSelectedId: (id: string) => void) {
  const appliedOpenId = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (openId && openId !== appliedOpenId.current) {
      appliedOpenId.current = openId;
      setSelectedId(openId);
    }
  }, [openId, setSelectedId]);
}

const dateFormatter = new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric" });

// `fields` names exactly what the underlying API query matches (see persistence#listCustomers /
// #listVehicles) so this line never claims coverage the search doesn't have. Views that reuse
// this component for a stage/status filter rather than free-text search can omit it.
export function SearchState({ loading, error, fields }: { loading: boolean; error: ApiError | null; fields?: string }) {
  if (loading) return <span className="record-search-state"><i className="loading-dot" />Searching connected records...</span>;
  if (error) return <span className="record-search-state record-search-state--error">{error.message}{error.requestId ? ` - ${error.requestId}` : ""}</span>;
  return <span className="record-search-state">{fields ? `Connected search - ${fields}.` : "Showing connected records."}</span>;
}

export function Timeline({ items }: { items: Array<{ occurredAt: string; type: string; summary: string }> }) {
  if (!items.length) return <div className="timeline-empty">No activity recorded yet.</div>;
  return <div className="record-timeline">{items.map((item, index) => <div key={`${item.occurredAt}-${index}`} className="timeline-event"><i /><div><span>{dateFormatter.format(new Date(item.occurredAt))} - {item.type}</span><strong>{item.summary}</strong></div></div>)}</div>;
}

export function OperationalTable({ columns, rows }: { columns: string[]; rows: Array<Array<string | number>> }) {
  const grid = { gridTemplateColumns: `repeat(${columns.length}, minmax(105px, 1fr))` };
  if (!rows.length) return <div className="timeline-empty">No records yet.</div>;
  return <div className="operational-table"><div className="operational-table-head" style={grid}>{columns.map((column) => <span key={column}>{column}</span>)}</div>{rows.map((row, index) => <div style={grid} key={index} className="operational-table-row">{row.map((value, valueIndex) => <span key={valueIndex} className={valueIndex === 0 ? "primary" : valueIndex === columns.length - 1 ? "status" : ""}>{value}</span>)}</div>)}</div>;
}

export function SectionToolbar({ title, detail, action, onAction }: { title: string; detail: string; action?: string; onAction?: () => void }) {
  return <div className="section-toolbar"><div><span>{title}</span><strong>{detail}</strong></div>{action && <button type="button" onClick={onAction}><Plus />{action}</button>}</div>;
}

export function Toast({ message }: { message: string }) {
  return <div className="workspace-toast" role="status"><BadgeCheck />{message}</div>;
}

// Focus containment for every workflow dialog: focus moves inside on open, Tab/Shift+Tab stay
// within the dialog, Escape closes it, the background is inert while it's open (body scroll
// locked), and focus returns to whatever triggered the dialog when it closes.
// `active` distinguishes an unmount-on-close dialog (default true -- the component only ever
// renders while open, e.g. WorkflowModal) from one that stays mounted with its visibility toggled
// by a boolean prop (e.g. a command palette rendered from a parent that never unmounts): pass the
// open/closed flag as `active` there so the trap engages and releases with it instead of firing
// once at the parent's own mount.
export function useDialogFocusTrap(dialogRef: { current: HTMLElement | null }, onClose: () => void, active = true) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    const triggerElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = dialogRef.current;
    const focusable = () =>
      Array.from(dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [])
        .filter((element) => !element.hidden);
    window.setTimeout(() => (focusable()[0] ?? dialog)?.focus(), 0);

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onCloseRef.current(); return; }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) { event.preventDefault(); dialog?.focus(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", handleKey, true);
    return () => {
      document.removeEventListener("keydown", handleKey, true);
      document.body.style.overflow = previousOverflow;
      triggerElement?.focus();
    };
  }, [active, dialogRef]);
}

export function WorkflowModal({ title, eyebrow, onClose, onComplete, children, completeLabel = "Save", busy = false }: { title: string; eyebrow: string; onClose: () => void; onComplete: () => void; children: ReactNode; completeLabel?: string; busy?: boolean }) {
  const dialogRef = useRef<HTMLElement>(null);
  useDialogFocusTrap(dialogRef, onClose);
  return <div className="modal-scrim" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && onClose()}><section ref={dialogRef} tabIndex={-1} className="workflow-modal" role="dialog" aria-modal="true" aria-labelledby="workflow-title"><header><div><span>{eyebrow}</span><h2 id="workflow-title">{title}</h2></div><button type="button" onClick={onClose} aria-label="Close dialog"><X /></button></header><div className="workflow-modal-body">{children}</div><footer><span><i /> Saved to your connected database</span><div><button type="button" onClick={onClose}>Cancel</button><button type="button" className="workspace-button workspace-button--dark" onClick={onComplete} disabled={busy}>{busy ? "Saving..." : completeLabel} <ArrowRight size={14} /></button></div></footer></section></div>;
}

export function InfoGrid({ items }: { items: string[][] }) {
  return <div className="info-grid">{items.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>;
}

export function WorkspacePage({ action, children }: { action?: ReactNode; children: ReactNode }) {
  return <div className="workspace-page">{action && <div className="workspace-page-toolbar">{action}</div>}{children}</div>;
}
