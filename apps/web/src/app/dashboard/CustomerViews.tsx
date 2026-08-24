import {
  AlertTriangle, ArrowRight, CalendarDays, CarFront, CheckCircle2, Circle, Copy, Download, Edit3,
  FileText, Mail, MapPin, MessageSquare, MoreHorizontal, Phone, Plus, Search, Share2, ShieldCheck,
  Trash2, UserPlus, WalletCards, Wrench, X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FormEvent, KeyboardEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { apiDelete, apiGet, apiPatch, apiPost, ApiError } from "../../lib/api";
import { WhatsAppIcon } from "../components/BrandIcons";
import type {
  Communication, ConsentChannel, ConsentStatus, Customer, Customer360, CustomerConsentEntry,
  CustomerDocument, CustomerNote, CustomerTask, DocumentStatus, SalesOrder, ServiceJob, TaskStatus,
} from "../types";
import {
  OperationalTable, RecordViewProps, SearchState, SectionToolbar, Timeline, Toast,
  useDialogFocusTrap, useOpenIdSelection, WorkflowModal, WorkspacePage,
} from "./RecordViews";
import { useContextualActions } from "./SidebarActions";
import type { SidebarAction } from "./SidebarActions";

const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric" });
const dateTimeFormatter = new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

const TABS = ["Overview", "Activity", "Vehicles", "Sales & finance", "Service & care", "Communications", "Notes", "Tasks", "Consent", "Documents"] as const;
type CustomerTabName = (typeof TABS)[number];

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// Manual-activation tab keyboard behavior, matching PortalShell's PortalTabShell: Arrow/Home/End
// move focus along the strip, and native button semantics activate on Enter/Space.
function moveTabFocus(event: KeyboardEvent<HTMLDivElement>) {
  if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
  const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  const current = tabs.findIndex((tabEl) => tabEl === document.activeElement);
  if (current === -1) return;
  event.preventDefault();
  const next =
    event.key === "Home" ? 0
    : event.key === "End" ? tabs.length - 1
    : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
  tabs[next]?.focus();
}

function useToast() {
  const [toast, setToast] = useState("");
  function notify(message: string) { setToast(message); window.setTimeout(() => setToast(""), 2600); }
  return { toast, notify };
}

async function copyToClipboard(value: string, label: string, notify: (message: string) => void) {
  try {
    await navigator.clipboard.writeText(value);
    notify(`${label} copied.`);
  } catch {
    notify(`Could not copy the ${label.toLowerCase()}.`);
  }
}

// A labelled, per-field copy affordance with success feedback - never an unexplained bare icon.
function CopyChip({ value, label, notify }: { value: string; label: string; notify: (message: string) => void }) {
  return (
    <button type="button" className="copy-chip" title={`Copy ${label.toLowerCase()}`} aria-label={`Copy ${label.toLowerCase()}`} onClick={() => copyToClipboard(value, label, notify)}>
      <Copy size={12} />
    </button>
  );
}

function exportCustomerSummary(customer: Customer360) {
  const rows: Array<[string, string]> = [
    ["Name", customer.displayName],
    ["Type", customer.customerType],
    ["Mobile", customer.mobile ?? ""],
    ["Email", customer.email ?? ""],
    ["Preferred channel", customer.preferredChannel ?? ""],
    ["Address", customer.address ?? ""],
    ["Lifetime value", String(customer.lifetimeValue)],
    ["Customer since", customer.customerSince],
  ];
  const csv = rows.map(([field, value]) => `"${field}","${value.replaceAll('"', '""')}"`).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${customer.displayName.toLowerCase().replaceAll(" ", "-")}-summary.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

type OverflowMenuItem = { id: string; label: string; icon: LucideIcon; onClick?: () => void; href?: string; tone?: "danger" };

// An accessible "More" menu: Escape closes and returns focus to the trigger, Arrow Up/Down move
// among items, and a click outside closes it. Fills the profile card's overflow slot so Edit,
// Share, Call, and Email stay as the only frequent buttons on the card itself.
function OverflowMenu({ label, items }: { label: string; items: OverflowMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const menuItems = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    menuItems[0]?.focus();

    function handleOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKey(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); return; }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      const current = menuItems.findIndex((item) => item === document.activeElement);
      const next = (current + (event.key === "ArrowDown" ? 1 : -1) + menuItems.length) % menuItems.length;
      menuItems[next]?.focus();
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div className="record-more-menu" ref={containerRef}>
      <button ref={triggerRef} type="button" aria-haspopup="menu" aria-expanded={open} aria-label={label} title={label} onClick={() => setOpen((value) => !value)}>
        <MoreHorizontal size={17} />
      </button>
      {open && (
        <div ref={menuRef} role="menu" aria-label={label} className="record-more-menu-popover">
          {items.map((item) => {
            const Icon = item.icon;
            const content = <><Icon size={15} /><span>{item.label}</span></>;
            return item.href ? (
              <a key={item.id} role="menuitem" tabIndex={-1} href={item.href} className={item.tone === "danger" ? "danger-action" : ""} onClick={() => setOpen(false)}>{content}</a>
            ) : (
              <button key={item.id} type="button" role="menuitem" tabIndex={-1} className={item.tone === "danger" ? "danger-action" : ""} onClick={() => { setOpen(false); item.onClick?.(); }}>{content}</button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Replaces window.confirm for destructive actions. Cancel is the first focusable element, so a
// destructive dialog opens focused on a neutral action rather than the confirm button.
function ConfirmDialog({ title, message, confirmLabel, tone = "default", busy, onCancel, onConfirm }: {
  title: string; message: ReactNode; confirmLabel: string; tone?: "default" | "danger"; busy?: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  useDialogFocusTrap(dialogRef, onCancel);
  return (
    <div className="modal-scrim" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && onCancel()}>
      <section ref={dialogRef} tabIndex={-1} className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message">
        <h2 id="confirm-dialog-title">{title}</h2>
        <p id="confirm-dialog-message">{message}</p>
        <div className="confirm-dialog-actions">
          <button type="button" className="workspace-button" onClick={onCancel}>Cancel</button>
          <button type="button" className={`workspace-button ${tone === "danger" ? "workspace-button--danger" : "workspace-button--dark"}`} onClick={onConfirm} disabled={busy}>{busy ? "Working..." : confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}

// Replaces the old silent navigator.share call, which could report "Summary shared" even after
// the user cancelled the OS share sheet. Copy-link and export always work; device share is an
// explicit, separately labelled action, and never claims success unless it actually completed.
function ShareCustomerModal({ customer, onClose, notify }: { customer: Customer360; onClose: () => void; notify: (message: string) => void }) {
  const dialogRef = useRef<HTMLElement>(null);
  useDialogFocusTrap(dialogRef, onClose);
  const shareUrl = `${window.location.origin}${window.location.pathname}?workspace=customers&recordId=${customer.id}`;
  const canDeviceShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function shareViaDevice() {
    try {
      await navigator.share({ title: customer.displayName, text: `AutoAxis customer record - ${customer.displayName}`, url: shareUrl });
      notify("Shared.");
    } catch {
      // The user cancelled the device share sheet, or it failed - never claim it was shared.
    }
  }

  return (
    <div className="modal-scrim" role="presentation" onMouseDown={(event) => event.currentTarget === event.target && onClose()}>
      <section ref={dialogRef} tabIndex={-1} className="workflow-modal share-modal" role="dialog" aria-modal="true" aria-labelledby="share-dialog-title">
        <header><div><span>Customer master</span><h2 id="share-dialog-title">Share {customer.displayName}</h2></div><button type="button" onClick={onClose} aria-label="Close dialog"><X /></button></header>
        <div className="workflow-modal-body share-modal-body">
          <label className="share-link-row">
            <span>Record link</span>
            <div>
              <input readOnly value={shareUrl} onFocus={(event) => event.currentTarget.select()} aria-label="Shareable record link" />
              <button type="button" onClick={() => copyToClipboard(shareUrl, "Link", notify)}><Copy size={14} />Copy link</button>
            </div>
          </label>
          <div className="share-modal-actions">
            <button type="button" onClick={() => { exportCustomerSummary(customer); notify("Summary exported."); }}><Download size={15} />Export as CSV</button>
            {customer.email ? (
              <a href={`mailto:${customer.email}?subject=${encodeURIComponent(customer.displayName)}&body=${encodeURIComponent(shareUrl)}`}><Mail size={15} />Email this record</a>
            ) : (
              <a aria-disabled="true" onClick={(event) => event.preventDefault()}><Mail size={15} />Email this record (no email on file)</a>
            )}
            {canDeviceShare && <button type="button" onClick={shareViaDevice}><Share2 size={15} />Share using device</button>}
          </div>
        </div>
        <footer><span /><div><button type="button" onClick={onClose}>Close</button></div></footer>
      </section>
    </div>
  );
}

// Debounced lookup against GET /api/v1/customers/duplicates. `mobile`/`email`/`displayName` are
// the exact live form values - pass them fresh on every render, not a memoized object, so the
// effect's own dependency list (the primitives, not the wrapper) stays the source of truth.
function useDuplicateCheck(mobile: string, email: string, displayName: string, excludeId?: string) {
  const [matches, setMatches] = useState<Customer[]>([]);

  useEffect(() => {
    const trimmedMobile = mobile.trim();
    const trimmedEmail = email.trim();
    const trimmedName = displayName.trim();
    if (!trimmedMobile && !trimmedEmail && !trimmedName) { setMatches([]); return; }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams();
      if (trimmedMobile) params.set("mobile", trimmedMobile);
      if (trimmedEmail) params.set("email", trimmedEmail);
      if (trimmedName) params.set("displayName", trimmedName);
      if (excludeId) params.set("excludeId", excludeId);
      apiGet<{ customers: Customer[] }>(`/api/v1/customers/duplicates?${params.toString()}`, { signal: controller.signal })
        .then((result) => setMatches(result.customers))
        .catch(() => setMatches([]));
    }, 350);
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, [mobile, email, displayName, excludeId]);

  return matches;
}

function DuplicateWarning({ matches, onOpenExisting }: { matches: Customer[]; onOpenExisting?: (id: string) => void }) {
  if (!matches.length) return null;
  return (
    <div className="duplicate-warning" role="status">
      <AlertTriangle size={16} />
      <div>
        <strong>{matches.length === 1 ? "A matching customer already exists" : `${matches.length} matching customers already exist`}</strong>
        <ul>
          {matches.map((match) => (
            <li key={match.id}>
              <span>{match.displayName} - {match.mobile ?? match.email ?? "no contact on file"}</span>
              {onOpenExisting && <button type="button" onClick={() => onOpenExisting(match.id)}>Open existing</button>}
            </li>
          ))}
        </ul>
        <p>Review before continuing. You can still save if this is genuinely a different customer.</p>
      </div>
    </div>
  );
}

function ChannelIcon({ channel }: { channel: string }) {
  if (channel === "whatsapp") return <WhatsAppIcon />;
  if (channel === "sms") return <MessageSquare />;
  if (channel === "call") return <Phone />;
  return <Mail />;
}

const CONSENT_CHANNEL_LABEL: Record<ConsentChannel, string> = { call: "Call", whatsapp: "WhatsApp", email: "Email", sms: "SMS" };
const CONSENT_STATUS_LABEL: Record<ConsentStatus, string> = { opted_in: "Opted in", opted_out: "Opted out", unknown: "Not recorded" };

// ---------------------------------------------------------------------------
// Customer 360
// ---------------------------------------------------------------------------

type CustomerModal =
  | null
  | "create-customer" | "edit-customer" | "create-lead" | "book-service" | "log-communication"
  | "create-task" | "add-document" | "share";

export function CustomerView({ onNavigate, openId }: RecordViewProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<ApiError | null>(null);
  const [query, setQuery] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(openId ?? null);
  useOpenIdSelection(openId, setSelectedId);
  const [customer, setCustomer] = useState<Customer360 | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [tab, setTab] = useState<CustomerTabName>("Overview");
  const [sales, setSales] = useState<SalesOrder[]>([]);
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [comms, setComms] = useState<Communication[]>([]);
  const [commFilters, setCommFilters] = useState({ channel: "", direction: "" });
  const [notes, setNotes] = useState<CustomerNote[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [tasks, setTasks] = useState<CustomerTask[]>([]);
  const [consent, setConsent] = useState<CustomerConsentEntry[]>([]);
  const [documents, setDocuments] = useState<CustomerDocument[]>([]);

  const [modal, setModal] = useState<CustomerModal>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast, notify } = useToast();

  function loadList(searchTerm: string) {
    setListLoading(true);
    setListError(null);
    apiGet<{ customers: Customer[] }>(`/api/v1/customers${searchTerm ? `?q=${encodeURIComponent(searchTerm)}` : ""}`)
      .then((result) => {
        setCustomers(result.customers);
        if (!selectedId && result.customers.length) setSelectedId(result.customers[0].id);
      })
      .catch((cause) => setListError(cause instanceof ApiError ? cause : new ApiError("Customer search failed.", { status: 500 })))
      .finally(() => setListLoading(false));
  }

  useEffect(() => { loadList(""); }, []);

  useEffect(() => {
    if (!selectedId) { setCustomer(null); return; }
    setDetailLoading(true);
    apiGet<{ customer: Customer360 }>(`/api/v1/customers/${selectedId}/360`)
      .then((result) => setCustomer(result.customer))
      .catch(() => setCustomer(null))
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  function loadComms() {
    if (!selectedId) return;
    const params = new URLSearchParams({ customerId: selectedId });
    if (commFilters.channel) params.set("channel", commFilters.channel);
    if (commFilters.direction) params.set("direction", commFilters.direction);
    apiGet<{ communications: Communication[] }>(`/api/v1/communications?${params.toString()}`).then((result) => setComms(result.communications)).catch(() => setComms([]));
  }

  useEffect(() => {
    if (!selectedId) return;
    if (tab === "Sales & finance") apiGet<{ salesOrders: SalesOrder[] }>(`/api/v1/sales-orders?customerId=${selectedId}`).then((result) => setSales(result.salesOrders)).catch(() => setSales([]));
    if (tab === "Service & care") apiGet<{ serviceJobs: ServiceJob[] }>(`/api/v1/service-jobs?customerId=${selectedId}`).then((result) => setJobs(result.serviceJobs)).catch(() => setJobs([]));
    if (tab === "Communications") loadComms();
    if (tab === "Notes") apiGet<{ notes: CustomerNote[] }>(`/api/v1/customers/${selectedId}/notes`).then((result) => setNotes(result.notes)).catch(() => setNotes([]));
    if (tab === "Tasks") apiGet<{ tasks: CustomerTask[] }>(`/api/v1/customers/${selectedId}/tasks`).then((result) => setTasks(result.tasks)).catch(() => setTasks([]));
    if (tab === "Consent") apiGet<{ consent: CustomerConsentEntry[] }>(`/api/v1/customers/${selectedId}/consent`).then((result) => setConsent(result.consent)).catch(() => setConsent([]));
    if (tab === "Documents") apiGet<{ documents: CustomerDocument[] }>(`/api/v1/customers/${selectedId}/documents`).then((result) => setDocuments(result.documents)).catch(() => setDocuments([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, selectedId, commFilters]);

  function searchCustomers(event: FormEvent) {
    event.preventDefault();
    loadList(query.trim());
  }

  function openExisting(id: string) {
    setModal(null);
    setSelectedId(id);
  }

  async function submitCreateCustomer(form: { customerType: string; displayName: string; mobile: string; email: string; preferredChannel: string; address: string }) {
    setSaving(true);
    try {
      const result = await apiPost<{ customer: Customer }>("/api/v1/customers", form);
      setModal(null);
      loadList(query.trim());
      setSelectedId(result.customer.id);
      notify("Customer created.");
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not create the customer.");
    } finally {
      setSaving(false);
    }
  }

  async function submitEditCustomer(form: { displayName: string; mobile: string; email: string; preferredChannel: string; address: string }) {
    if (!customer) return;
    setSaving(true);
    try {
      await apiPatch(`/api/v1/customers/${customer.id}`, form);
      setModal(null);
      loadList(query.trim());
      apiGet<{ customer: Customer360 }>(`/api/v1/customers/${customer.id}/360`).then((result) => setCustomer(result.customer));
      notify("Customer profile updated.");
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not update the customer.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCustomerRecord() {
    if (!customer) return;
    setSaving(true);
    try {
      await apiDelete(`/api/v1/customers/${customer.id}`);
      setConfirmDeleteOpen(false);
      setSelectedId(null);
      loadList(query.trim());
      notify("Customer deleted.");
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not delete the customer.");
    } finally {
      setSaving(false);
    }
  }

  async function submitCreateLead(form: { source: string; interestedVehicle: string; expectedValue: string }) {
    if (!customer) return;
    setSaving(true);
    try {
      await apiPost("/api/v1/leads", { customerId: customer.id, source: form.source, interestedVehicle: form.interestedVehicle, expectedValue: form.expectedValue ? Number(form.expectedValue) : undefined });
      setModal(null);
      notify("Opportunity created and added to the sales pipeline.");
      onNavigate("sales");
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not create the opportunity.");
    } finally {
      setSaving(false);
    }
  }

  async function submitBookService(form: { vehicleId: string; repairOrderNumber: string; advisor: string; complaint: string }) {
    if (!customer) return;
    setSaving(true);
    try {
      await apiPost("/api/v1/service-jobs", { customerId: customer.id, vehicleId: form.vehicleId, repairOrderNumber: form.repairOrderNumber, advisor: form.advisor, complaint: form.complaint });
      setModal(null);
      notify("Service booking confirmed.");
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not create the booking.");
    } finally {
      setSaving(false);
    }
  }

  async function submitLogCommunication(form: { channel: string; direction: string; subject: string; summary: string }) {
    if (!customer) return;
    setSaving(true);
    try {
      await apiPost("/api/v1/communications", { customerId: customer.id, ...form });
      setModal(null);
      loadComms();
      notify("Communication logged to the shared timeline.");
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not log the communication.");
    } finally {
      setSaving(false);
    }
  }

  async function submitCreateNote() {
    if (!customer || !noteDraft.trim()) return;
    setSaving(true);
    try {
      await apiPost(`/api/v1/customers/${customer.id}/notes`, { body: noteDraft.trim() });
      setNoteDraft("");
      apiGet<{ notes: CustomerNote[] }>(`/api/v1/customers/${customer.id}/notes`).then((result) => setNotes(result.notes));
      notify("Note added.");
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not add the note.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteNote(noteId: string) {
    if (!customer) return;
    try {
      await apiDelete(`/api/v1/customers/${customer.id}/notes/${noteId}`);
      setNotes((current) => current.filter((note) => note.id !== noteId));
      notify("Note removed.");
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not remove the note.");
    }
  }

  async function submitCreateTask(form: { title: string; assignedTo: string; dueAt: string }) {
    if (!customer) return;
    setSaving(true);
    try {
      await apiPost(`/api/v1/customers/${customer.id}/tasks`, form);
      setModal(null);
      apiGet<{ tasks: CustomerTask[] }>(`/api/v1/customers/${customer.id}/tasks`).then((result) => setTasks(result.tasks));
      notify("Task created.");
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not create the task.");
    } finally {
      setSaving(false);
    }
  }

  async function setTaskStatus(taskId: string, status: TaskStatus) {
    if (!customer) return;
    try {
      const result = await apiPatch<{ task: CustomerTask }>(`/api/v1/customers/${customer.id}/tasks/${taskId}`, { status });
      setTasks((current) => current.map((task) => (task.id === taskId ? result.task : task)));
      notify(status === "done" ? "Task marked done." : status === "cancelled" ? "Task cancelled." : "Task reopened.");
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not update the task.");
    }
  }

  async function submitConsent(channel: ConsentChannel, status: ConsentStatus) {
    if (!customer || status === "unknown") return;
    setSaving(true);
    try {
      await apiPost(`/api/v1/customers/${customer.id}/consent`, { channel, status, source: "Recorded in Customer 360" });
      apiGet<{ consent: CustomerConsentEntry[] }>(`/api/v1/customers/${customer.id}/consent`).then((result) => setConsent(result.consent));
      notify(`${CONSENT_CHANNEL_LABEL[channel]} consent updated.`);
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not update consent.");
    } finally {
      setSaving(false);
    }
  }

  async function submitCreateDocument(form: { documentType: string; label: string; storageReference: string }) {
    if (!customer) return;
    setSaving(true);
    try {
      await apiPost(`/api/v1/customers/${customer.id}/documents`, form);
      setModal(null);
      apiGet<{ documents: CustomerDocument[] }>(`/api/v1/customers/${customer.id}/documents`).then((result) => setDocuments(result.documents));
      notify("Document record added.");
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not add the document record.");
    } finally {
      setSaving(false);
    }
  }

  async function setDocumentStatus(documentId: string, status: DocumentStatus) {
    if (!customer) return;
    try {
      const result = await apiPatch<{ document: CustomerDocument }>(`/api/v1/customers/${customer.id}/documents/${documentId}`, { status });
      setDocuments((current) => current.map((doc) => (doc.id === documentId ? result.document : doc)));
      notify("Document status updated.");
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not update the document.");
    }
  }

  useContextualActions(() => {
    if (!customer) return [];
    const list: SidebarAction[] = [
      { id: "create-lead", label: "Create opportunity", detail: "Start a connected sales path", icon: UserPlus, onClick: () => setModal("create-lead") },
      { id: "book-service", label: "Book service", detail: "Vehicle and workshop context", icon: CalendarDays, onClick: () => setModal("book-service") },
    ];
    if (customer.mobile) list.push({ id: "whatsapp", label: "WhatsApp customer", detail: "Open a conversation", icon: WhatsAppIcon as LucideIcon, href: `https://wa.me/${customer.mobile.replace(/\D/g, "")}` });
    list.push({ id: "log-communication", label: "Log communication", detail: "Record a call, email or message", icon: Mail, onClick: () => setModal("log-communication") });
    return list;
  }, [customer]);

  const moreMenuItems = useMemo<OverflowMenuItem[]>(() => {
    if (!customer) return [];
    return [
      { id: "copy-id", label: "Copy customer number", icon: Copy, onClick: () => copyToClipboard(customer.id, "Customer number", notify) },
      { id: "export", label: "Export CSV", icon: Download, onClick: () => { exportCustomerSummary(customer); notify("CSV exported."); } },
      { id: "delete", label: "Delete customer", icon: Trash2, tone: "danger", onClick: () => setConfirmDeleteOpen(true) },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer]);

  return <WorkspacePage>
    <div className="record-workbench">
      <aside className="record-directory-panel">
        <header className="directory-panel-heading"><div><span>Customer directory</span><strong>{customers.length} connected records</strong></div><button type="button" onClick={() => setModal("create-customer")} aria-label="Create customer"><Plus /></button></header>
        <form className="record-search" onSubmit={searchCustomers}><Search size={18} /><input aria-label="Search customers" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, mobile, or email" />{query && <button className="search-clear" type="button" aria-label="Clear customer search" onClick={() => { setQuery(""); loadList(""); }}><X /></button>}<button className="search-submit" type="submit" disabled={listLoading}>Search</button></form>
        <SearchState loading={listLoading} error={listError} fields="name, mobile, or email" />
        <section className="customer-directory"><div className="customer-list-head"><span>Customer</span><span>Contact</span><span>Lifetime value</span></div>
          {customers.map((entry) => <button type="button" className={selectedId === entry.id ? "selected" : ""} key={entry.id} onClick={() => setSelectedId(entry.id)}><span className="customer-list-avatar">{entry.displayName.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><div><strong>{entry.displayName}</strong><small>{entry.mobile ?? entry.email ?? "No contact on file"}</small></div><span>{entry.preferredChannel ?? "-"}</span><b>{money.format(entry.lifetimeValue)}</b><ArrowRight /></button>)}
          {!listLoading && !customers.length && <div className="customer-list-empty"><Search />No matching customers. Create one to get started.</div>}
        </section>
      </aside>
      <section className="record-detail-panel">
        {detailLoading && <div className="empty-state"><Search /><strong>Loading customer</strong></div>}
        {!detailLoading && !customer && <div className="empty-state"><Search /><strong>No customer selected</strong><p>Search or create a customer to see their connected record.</p></div>}
        {!detailLoading && customer && <>
          <div className="record-layout">
            <section className="record-main-card">
              <div className="record-identity">
                <div className="record-avatar">{customer.displayName.split(" ").map((p) => p[0]).slice(0, 2).join("")}</div>
                <div>
                  <span>{customer.customerType} - customer since {new Date(customer.customerSince).getFullYear()}</span>
                  <h3>{customer.displayName}</h3>
                  <p>
                    {customer.mobile && <span className="identity-contact-item"><Phone size={14} />{customer.mobile}<CopyChip value={customer.mobile} label="Mobile number" notify={notify} /></span>}
                    {customer.email && <span className="identity-contact-item"><Mail size={14} />{customer.email}<CopyChip value={customer.email} label="Email address" notify={notify} /></span>}
                  </p>
                </div>
                <div className="record-actions-row">
                  <button type="button" className="workspace-button workspace-button--dark" onClick={() => setModal("edit-customer")}><Edit3 size={15} />Edit</button>
                  <button type="button" className="workspace-button" onClick={() => setModal("share")}><Share2 size={15} />Share</button>
                  {customer.mobile ? <a className="workspace-button" href={`tel:${customer.mobile}`}><Phone size={15} />Call</a> : <button type="button" className="workspace-button" disabled title="No mobile on file"><Phone size={15} />Call</button>}
                  {customer.email ? <a className="workspace-button" href={`mailto:${customer.email}`}><Mail size={15} />Email</a> : <button type="button" className="workspace-button" disabled title="No email on file"><Mail size={15} />Email</button>}
                  <OverflowMenu label="More actions" items={moreMenuItems} />
                </div>
              </div>
              <div className="record-tabs" role="tablist" aria-label={`${customer.displayName} record sections`} onKeyDown={moveTabFocus}>
                {TABS.map((item) => (
                  <button
                    role="tab"
                    id={`customer-tab-${slug(item)}`}
                    aria-selected={tab === item}
                    aria-controls="customer-tab-panel"
                    tabIndex={tab === item ? 0 : -1}
                    className={tab === item ? "active" : ""}
                    type="button"
                    key={item}
                    onClick={() => setTab(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <div id="customer-tab-panel" role="tabpanel" aria-labelledby={`customer-tab-${slug(tab)}`} tabIndex={-1}>
                {tab === "Overview" && <div className="record-facts"><div><WalletCards /><span>Lifetime value</span><strong>{money.format(customer.lifetimeValue)}</strong></div><div><CarFront /><span>Vehicles</span><strong>{customer.vehicles.length}</strong></div><div><Wrench /><span>Service visits</span><strong>{customer.serviceVisitCount}</strong></div><div><ShieldCheck /><span>Preferred channel</span><strong>{customer.preferredChannel ?? "Not set"}</strong></div></div>}
                {tab === "Activity" && <Timeline items={customer.timeline} />}
                {tab === "Vehicles" && <div className="linked-records">{customer.vehicles.map((vehicle) => <button type="button" key={vehicle.vin} onClick={() => onNavigate("vehicles", vehicle.id)}><CarFront /><div><strong>{vehicle.make} {vehicle.model}</strong><span>{vehicle.variant ?? ""} {vehicle.registration ?? vehicle.vin}</span></div><ArrowRight /></button>)}{!customer.vehicles.length && <div className="timeline-empty">No vehicles linked to this customer yet.</div>}</div>}
                {tab === "Sales & finance" && <><SectionToolbar title="Deals and opportunities" detail="Sales orders linked to this customer" action="New opportunity" onAction={() => setModal("create-lead")} /><OperationalTable columns={["Vehicle", "Value", "Status", "Ordered"]} rows={sales.map((order) => [`${order.make} ${order.model}`, money.format(order.totalAmount), order.status, dateFormatter.format(new Date(order.orderedAt))])} /></>}
                {tab === "Service & care" && <><SectionToolbar title="Service relationship" detail={`${jobs.length} repair orders on file`} action="Book service" onAction={() => setModal("book-service")} /><OperationalTable columns={["Repair order", "Vehicle", "Status", "Opened"]} rows={jobs.map((job) => [job.repairOrderNumber, `${job.make} ${job.model}`, job.status, dateFormatter.format(new Date(job.openedAt))])} /></>}
                {tab === "Communications" && <>
                  <div className="comm-toolbar">
                    <div className="comm-filters">
                      <select aria-label="Filter communications by channel" value={commFilters.channel} onChange={(event) => setCommFilters((current) => ({ ...current, channel: event.target.value }))}>
                        <option value="">All channels</option>
                        <option value="call">Call</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="email">Email</option>
                        <option value="sms">SMS</option>
                      </select>
                      <select aria-label="Filter communications by direction" value={commFilters.direction} onChange={(event) => setCommFilters((current) => ({ ...current, direction: event.target.value }))}>
                        <option value="">All directions</option>
                        <option value="inbound">Inbound</option>
                        <option value="outbound">Outbound</option>
                      </select>
                    </div>
                    <button type="button" onClick={() => setModal("log-communication")}><Plus size={15} />Log communication</button>
                  </div>
                  <div className="comm-list">
                    {comms.map((comm) => (
                      <article key={comm.id} className="comm-card">
                        <span className="comm-card-icon"><ChannelIcon channel={comm.channel} /></span>
                        <div className="comm-card-body">
                          <div className="comm-card-meta"><span className={comm.direction === "inbound" ? "direction-in" : "direction-out"}>{comm.direction}</span><span>{comm.channel}</span></div>
                          {comm.subject && <span className="comm-card-subject">{comm.subject}</span>}
                          <p className="comm-card-summary">{comm.summary}</p>
                        </div>
                        <span className="comm-card-date">{dateTimeFormatter.format(new Date(comm.occurredAt))}</span>
                      </article>
                    ))}
                    {!comms.length && <div className="timeline-empty">No communications logged yet for this filter.</div>}
                  </div>
                </>}
                {tab === "Notes" && <>
                  <SectionToolbar title="Notes" detail={`${notes.length} note${notes.length === 1 ? "" : "s"} on file`} />
                  <form className="notes-form" onSubmit={(event) => { event.preventDefault(); submitCreateNote(); }}>
                    <textarea aria-label="Add a note" placeholder="Add a note about this customer" value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} />
                    <button type="submit" disabled={!noteDraft.trim() || saving}>Add note</button>
                  </form>
                  <div className="notes-list">
                    {notes.map((note) => (
                      <article key={note.id} className="note-card">
                        <div>
                          <p>{note.body}</p>
                          <span className="note-card-meta">{note.authorName ?? "Unknown"} - {dateTimeFormatter.format(new Date(note.createdAt))}</span>
                        </div>
                        <button type="button" aria-label="Delete note" title="Delete note" onClick={() => deleteNote(note.id)}><Trash2 size={14} /></button>
                      </article>
                    ))}
                    {!notes.length && <div className="timeline-empty">No notes yet. Add the first one above.</div>}
                  </div>
                </>}
                {tab === "Tasks" && <>
                  <SectionToolbar title="Tasks" detail={`${tasks.filter((task) => task.status === "open").length} open of ${tasks.length}`} action="New task" onAction={() => setModal("create-task")} />
                  <div className="tasks-list">
                    {tasks.map((task) => {
                      const overdue = task.status === "open" && !!task.dueAt && new Date(task.dueAt).getTime() < Date.now();
                      const StatusIcon = task.status === "done" ? CheckCircle2 : Circle;
                      return (
                        <div key={task.id} className={`task-row ${overdue ? "is-overdue" : ""}`}>
                          <StatusIcon size={16} />
                          <div>
                            <strong className={task.status === "done" ? "is-done" : ""}>{task.title}</strong>
                            <span>{task.assignedTo ? `${task.assignedTo} - ` : ""}{task.dueAt ? `Due ${dateFormatter.format(new Date(task.dueAt))}` : "No due date"}{overdue ? " - overdue" : ""}</span>
                          </div>
                          <select aria-label={`Status for ${task.title}`} value={task.status} onChange={(event) => setTaskStatus(task.id, event.target.value as TaskStatus)}>
                            <option value="open">Open</option>
                            <option value="done">Done</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </div>
                      );
                    })}
                    {!tasks.length && <div className="timeline-empty">No tasks yet.</div>}
                  </div>
                </>}
                {tab === "Consent" && <>
                  <SectionToolbar title="Consent" detail="Per-channel marketing and contact consent" />
                  <div className="consent-grid">
                    {consent.map((entry) => (
                      <div key={entry.channel} className="consent-card">
                        <div className="consent-card-head">
                          <strong>{CONSENT_CHANNEL_LABEL[entry.channel]}</strong>
                          <span className={`consent-status consent-status--${entry.status}`}><i />{CONSENT_STATUS_LABEL[entry.status]}</span>
                        </div>
                        <p>{entry.recordedAt ? `${entry.source ? `${entry.source} - ` : ""}${dateFormatter.format(new Date(entry.recordedAt))}` : "No decision recorded yet."}</p>
                        <div className="consent-card-actions">
                          <button type="button" className={entry.status === "opted_in" ? "active" : ""} onClick={() => submitConsent(entry.channel, "opted_in")} disabled={saving}>Opt in</button>
                          <button type="button" className={entry.status === "opted_out" ? "active" : ""} onClick={() => submitConsent(entry.channel, "opted_out")} disabled={saving}>Opt out</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>}
                {tab === "Documents" && <>
                  <SectionToolbar title="Documents" detail={`${documents.length} record${documents.length === 1 ? "" : "s"} on file`} action="Add document record" onAction={() => setModal("add-document")} />
                  <div className="documents-list">
                    {documents.map((doc) => (
                      <div key={doc.id} className="document-row">
                        <FileText size={16} />
                        <div>
                          <strong>{doc.label}</strong>
                          <span>{doc.documentType.replaceAll("_", " ")}{doc.storageReference ? ` - ${doc.storageReference}` : ""} - {dateFormatter.format(new Date(doc.createdAt))}</span>
                        </div>
                        <select aria-label={`Status for ${doc.label}`} value={doc.status} onChange={(event) => setDocumentStatus(doc.id, event.target.value as DocumentStatus)}>
                          <option value="requested">Requested</option>
                          <option value="received">Received</option>
                          <option value="verified">Verified</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </div>
                    ))}
                    {!documents.length && <div className="timeline-empty">No document records yet.</div>}
                  </div>
                </>}
              </div>
            </section>
            <aside className="record-side-column">
              <div className="side-panel side-panel--light">
                <span>Contact context</span>
                {customer.address && <p className="contact-row"><MapPin />{customer.address}</p>}
                <div className="status-check"><i />{customer.email ? "Email on file" : "No email on file"}</div>
                <div className="status-check"><i />{customer.mobile ? "Mobile on file" : "No mobile on file"}</div>
              </div>
            </aside>
          </div>
        </>}
      </section>
    </div>

    {modal === "create-customer" && <CreateCustomerModal saving={saving} onClose={() => setModal(null)} onSubmit={submitCreateCustomer} onOpenExisting={openExisting} />}
    {modal === "edit-customer" && customer && <EditCustomerModal customer={customer} saving={saving} onClose={() => setModal(null)} onSubmit={submitEditCustomer} onOpenExisting={openExisting} />}
    {modal === "create-lead" && customer && <CreateLeadModal customerName={customer.displayName} saving={saving} onClose={() => setModal(null)} onSubmit={submitCreateLead} />}
    {modal === "book-service" && customer && <BookServiceModal vehicles={customer.vehicles} saving={saving} onClose={() => setModal(null)} onSubmit={submitBookService} />}
    {modal === "log-communication" && customer && <LogCommunicationModal saving={saving} onClose={() => setModal(null)} onSubmit={submitLogCommunication} />}
    {modal === "create-task" && customer && <CreateTaskModal saving={saving} onClose={() => setModal(null)} onSubmit={submitCreateTask} />}
    {modal === "add-document" && customer && <CreateDocumentModal saving={saving} onClose={() => setModal(null)} onSubmit={submitCreateDocument} />}
    {modal === "share" && customer && <ShareCustomerModal customer={customer} onClose={() => setModal(null)} notify={notify} />}
    {confirmDeleteOpen && customer && (
      <ConfirmDialog
        title="Delete customer"
        message={`Delete ${customer.displayName}? This cannot be undone.`}
        confirmLabel="Delete"
        tone="danger"
        busy={saving}
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={deleteCustomerRecord}
      />
    )}
    {toast && <Toast message={toast} />}
  </WorkspacePage>;
}

function CreateCustomerModal({ onClose, onSubmit, onOpenExisting, saving }: {
  saving: boolean; onClose: () => void; onOpenExisting: (id: string) => void;
  onSubmit: (form: { customerType: string; displayName: string; mobile: string; email: string; preferredChannel: string; address: string }) => void;
}) {
  const [form, setForm] = useState({ customerType: "individual", displayName: "", mobile: "", email: "", preferredChannel: "Email", address: "" });
  const matches = useDuplicateCheck(form.mobile, form.email, form.displayName);
  return <WorkflowModal title="Create customer record" eyebrow="Customer master" completeLabel={matches.length ? "Create anyway" : "Create customer"} busy={saving} onClose={onClose} onComplete={() => onSubmit(form)}>
    <div className="workflow-form-grid">
      <label><span>Customer type</span><select value={form.customerType} onChange={(event) => setForm({ ...form, customerType: event.target.value })}><option value="individual">Individual</option><option value="company">Company</option></select></label>
      <label><span>Full name</span><input required value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></label>
      <label><span>Mobile</span><input value={form.mobile} onChange={(event) => setForm({ ...form, mobile: event.target.value })} placeholder="+61 4xx xxx xxx" /></label>
      <label><span>Email</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
      <label><span>Preferred channel</span><input value={form.preferredChannel} onChange={(event) => setForm({ ...form, preferredChannel: event.target.value })} /></label>
      <label><span>Address</span><input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
    </div>
    <DuplicateWarning matches={matches} onOpenExisting={onOpenExisting} />
  </WorkflowModal>;
}

function EditCustomerModal({ customer, onClose, onSubmit, onOpenExisting, saving }: {
  customer: Customer360; saving: boolean; onClose: () => void; onOpenExisting: (id: string) => void;
  onSubmit: (form: { displayName: string; mobile: string; email: string; preferredChannel: string; address: string }) => void;
}) {
  const [form, setForm] = useState({ displayName: customer.displayName, mobile: customer.mobile ?? "", email: customer.email ?? "", preferredChannel: customer.preferredChannel ?? "", address: customer.address ?? "" });
  const matches = useDuplicateCheck(form.mobile, form.email, form.displayName, customer.id);
  return <WorkflowModal title={`Edit ${customer.displayName}`} eyebrow="Customer master" completeLabel={matches.length ? "Save anyway" : "Save changes"} busy={saving} onClose={onClose} onComplete={() => onSubmit(form)}>
    <div className="workflow-form-grid">
      <label><span>Full name</span><input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></label>
      <label><span>Mobile</span><input value={form.mobile} onChange={(event) => setForm({ ...form, mobile: event.target.value })} /></label>
      <label><span>Email</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
      <label><span>Preferred channel</span><select value={form.preferredChannel} onChange={(event) => setForm({ ...form, preferredChannel: event.target.value })}><option>Email</option><option>SMS</option><option>WhatsApp</option><option>Phone</option></select></label>
      <label><span>Address</span><input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
    </div>
    <DuplicateWarning matches={matches} onOpenExisting={onOpenExisting} />
  </WorkflowModal>;
}

function CreateLeadModal({ customerName, onClose, onSubmit, saving }: { customerName: string; saving: boolean; onClose: () => void; onSubmit: (form: { source: string; interestedVehicle: string; expectedValue: string }) => void }) {
  const [form, setForm] = useState({ source: "walk-in", interestedVehicle: "", expectedValue: "" });
  return <WorkflowModal title="Create connected opportunity" eyebrow={`Sales workflow - ${customerName}`} busy={saving} onClose={onClose} onComplete={() => onSubmit(form)}>
    <div className="workflow-form-grid">
      <label><span>Source</span><select value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })}><option value="walk-in">Walk-in</option><option value="phone">Phone</option><option value="web">Web enquiry</option><option value="referral">Referral</option></select></label>
      <label><span>Vehicle interest</span><input value={form.interestedVehicle} onChange={(event) => setForm({ ...form, interestedVehicle: event.target.value })} placeholder="e.g. BMW X5 upgrade" /></label>
      <label><span>Expected value (AUD)</span><input type="number" min="0" value={form.expectedValue} onChange={(event) => setForm({ ...form, expectedValue: event.target.value })} /></label>
    </div>
  </WorkflowModal>;
}

function BookServiceModal({ vehicles, onClose, onSubmit, saving }: { vehicles: Customer360["vehicles"]; saving: boolean; onClose: () => void; onSubmit: (form: { vehicleId: string; repairOrderNumber: string; advisor: string; complaint: string }) => void }) {
  const [form, setForm] = useState({ vehicleId: vehicles[0]?.id ?? "", repairOrderNumber: `RO-${Math.floor(Math.random() * 90000 + 10000)}`, advisor: "", complaint: "" });
  return <WorkflowModal title="Book service visit" eyebrow="Service booking" completeLabel="Confirm booking" busy={saving} onClose={onClose} onComplete={() => onSubmit(form)}>
    {!vehicles.length ? <p className="inline-error"><AlertTriangle size={14} />This customer has no linked vehicle yet. Add a vehicle first.</p> : <div className="workflow-form-grid">
      <label><span>Vehicle</span><select value={form.vehicleId} onChange={(event) => setForm({ ...form, vehicleId: event.target.value })}>{vehicles.map((vehicle) => <option key={vehicle.id ?? vehicle.vin} value={vehicle.id}>{vehicle.make} {vehicle.model} - {vehicle.registration ?? vehicle.vin}</option>)}</select></label>
      <label><span>Repair order number</span><input value={form.repairOrderNumber} onChange={(event) => setForm({ ...form, repairOrderNumber: event.target.value })} /></label>
      <label><span>Advisor</span><input value={form.advisor} onChange={(event) => setForm({ ...form, advisor: event.target.value })} /></label>
      <label className="workflow-form-full"><span>Complaint or work requested</span><input value={form.complaint} onChange={(event) => setForm({ ...form, complaint: event.target.value })} /></label>
    </div>}
  </WorkflowModal>;
}

function LogCommunicationModal({ onClose, onSubmit, saving }: { saving: boolean; onClose: () => void; onSubmit: (form: { channel: string; direction: string; subject: string; summary: string }) => void }) {
  const [form, setForm] = useState({ channel: "call", direction: "outbound", subject: "", summary: "" });
  return <WorkflowModal title="Log communication" eyebrow="Relationship timeline" completeLabel="Save" busy={saving} onClose={onClose} onComplete={() => onSubmit(form)}>
    <div className="workflow-form-grid">
      <label><span>Channel</span><select value={form.channel} onChange={(event) => setForm({ ...form, channel: event.target.value })}><option value="call">Call</option><option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="sms">SMS</option></select></label>
      <label><span>Direction</span><select value={form.direction} onChange={(event) => setForm({ ...form, direction: event.target.value })}><option value="outbound">Outbound</option><option value="inbound">Inbound</option></select></label>
      <label><span>Subject</span><input value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} /></label>
      <label className="workflow-form-full"><span>Summary</span><textarea required value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} /></label>
    </div>
  </WorkflowModal>;
}

function CreateTaskModal({ onClose, onSubmit, saving }: { saving: boolean; onClose: () => void; onSubmit: (form: { title: string; assignedTo: string; dueAt: string }) => void }) {
  const [form, setForm] = useState({ title: "", assignedTo: "", dueAt: "" });
  return <WorkflowModal title="Create task" eyebrow="Customer follow-up" completeLabel="Create task" busy={saving} onClose={onClose} onComplete={() => onSubmit(form)}>
    <div className="workflow-form-grid">
      <label className="workflow-form-full"><span>Task</span><input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Call back about finance approval" /></label>
      <label><span>Assigned to</span><input value={form.assignedTo} onChange={(event) => setForm({ ...form, assignedTo: event.target.value })} /></label>
      <label><span>Due date</span><input type="date" value={form.dueAt} onChange={(event) => setForm({ ...form, dueAt: event.target.value })} /></label>
    </div>
  </WorkflowModal>;
}

function CreateDocumentModal({ onClose, onSubmit, saving }: { saving: boolean; onClose: () => void; onSubmit: (form: { documentType: string; label: string; storageReference: string }) => void }) {
  const [form, setForm] = useState({ documentType: "id_proof", label: "", storageReference: "" });
  return <WorkflowModal title="Add document record" eyebrow="Document register" completeLabel="Add record" busy={saving} onClose={onClose} onComplete={() => onSubmit(form)}>
    <p className="workflow-form-note">Records that a document exists and where to find it - this does not upload a file.</p>
    <div className="workflow-form-grid">
      <label><span>Type</span><select value={form.documentType} onChange={(event) => setForm({ ...form, documentType: event.target.value })}>
        <option value="id_proof">ID proof</option>
        <option value="address_proof">Address proof</option>
        <option value="license">Licence</option>
        <option value="contract">Contract</option>
        <option value="other">Other</option>
      </select></label>
      <label><span>Label</span><input required value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} placeholder="e.g. Driver licence - front" /></label>
      <label className="workflow-form-full"><span>Reference or location</span><input value={form.storageReference} onChange={(event) => setForm({ ...form, storageReference: event.target.value })} placeholder="Filed at reception, vault reference, or external link" /></label>
    </div>
  </WorkflowModal>;
}
