import {
  BadgeCheck, Plus,
} from "lucide-react";
import { ReactNode, useEffect, useRef } from "react";
import { apiDownload, ApiError } from "../../lib/api";
import { WorkflowDialog } from "../components/overlays";
import type {
  DashView,
} from "../types";

// Shared by the customer and vehicle document registers (Customer 360 / Vehicle 360 Documents
// tabs) - kept alongside these two so both stay in lockstep instead of drifting apart.
export const DOCUMENT_FILE_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
export const MAX_DOCUMENT_FILE_BYTES = 5 * 1024 * 1024;

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Reads a File into the base64 payload the document-upload endpoints expect (see
// validate.js#optionalFileUpload), stripping the "data:<mime>;base64," prefix FileReader adds.
export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function downloadDocumentFile(path: string, fileName: string, notify: (message: string) => void) {
  try {
    const blob = await apiDownload(path);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  } catch {
    notify("Could not download the file.");
  }
}

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

export function WorkflowModal({ title, eyebrow, onClose, onComplete, children, completeLabel = "Save", busy = false }: { title: string; eyebrow: string; onClose: () => void; onComplete: () => void; children: ReactNode; completeLabel?: string; busy?: boolean }) {
  return <WorkflowDialog title={title} eyebrow={eyebrow} onClose={onClose} onComplete={onComplete} completeLabel={completeLabel} busy={busy}>{children}</WorkflowDialog>;
}

export function InfoGrid({ items }: { items: string[][] }) {
  return <div className="info-grid">{items.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>;
}

export function WorkspacePage({ action, children }: { action?: ReactNode; children: ReactNode }) {
  return <div className="workspace-page">{action && <div className="workspace-page-toolbar">{action}</div>}{children}</div>;
}
