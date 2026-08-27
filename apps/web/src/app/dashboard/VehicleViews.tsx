import {
  AlertTriangle, ArrowRight, CarFront, ClipboardList, Copy, Download, Edit3, FileText, Gauge, Gavel,
  KeyRound, MoreHorizontal, Plus, Search, Share2, Trash2, TrendingUp, UserRound, Warehouse, Wrench, X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ChangeEvent, FormEvent, KeyboardEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { apiDelete, apiGet, apiPatch, apiPost, ApiError } from "../../lib/api";
import { CurrencyField, DateField, DateTimeField, SelectField, TextArea, TextField } from "../components/forms";
import { ActionMenu, AlertDialog, Dialog } from "../components/overlays";
import type {
  AcquisitionChannel, AppraisalStatus, AuctionListingStatus, Branch, ConditionGrade, Customer,
  DispositionStatus, DispositionType, ServiceJob, ValuationSource, Vehicle, Vehicle360,
  VehicleAppraisal, VehicleAuctionListing, VehicleDisposition, VehicleDocument, VehicleDocumentStatus,
  VehicleOwnershipEntry, VehicleValuation,
} from "../types";
import { CustomerPicker } from "./Pickers";
import {
  DOCUMENT_FILE_ACCEPT, downloadDocumentFile, formatFileSize, InfoGrid, MAX_DOCUMENT_FILE_BYTES,
  OperationalTable, readFileAsBase64, RecordViewProps, SearchState, SectionToolbar, Timeline, Toast,
  useOpenIdSelection, WorkflowModal, WorkspacePage,
} from "./RecordViews";
import { useContextualActions } from "./SidebarActions";
import type { SidebarAction } from "./SidebarActions";

const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
const kmFormatter = new Intl.NumberFormat("en-AU");
const dateFormatter = new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric" });
const dateTimeFormatter = new Intl.DateTimeFormat("en-AU", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

const TABS = ["Overview", "Ownership", "Lifecycle", "Documents", "Appraisal", "Valuation", "Stock & location", "Auction", "Rental & demo", "Work orders"] as const;
type VehicleTabName = (typeof TABS)[number];

// Manual-activation tab keyboard behavior, matching PortalTabShell: Arrow/Home/End move focus
// along the strip, and native button semantics activate on Enter/Space.
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
// Every copyable field on a vehicle record (VIN, registration, owner mobile) uses this.
function CopyChip({ value, label, notify }: { value: string; label: string; notify: (message: string) => void }) {
  return (
    <button type="button" className="copy-chip" title={`Copy ${label.toLowerCase()}`} aria-label={`Copy ${label.toLowerCase()}`} onClick={() => copyToClipboard(value, label, notify)}>
      <Copy size={12} />
    </button>
  );
}

function exportVehicleSummary(vehicle: Vehicle360) {
  const rows: Array<[string, string]> = [
    ["VIN", vehicle.vin],
    ["Registration", vehicle.registration ?? ""],
    ["Make", vehicle.make],
    ["Model", vehicle.model],
    ["Variant", vehicle.variant ?? ""],
    ["Status", vehicle.status],
    ["Odometer (km)", vehicle.odometerKm ? String(vehicle.odometerKm) : ""],
    ["Market value", vehicle.marketValue ? String(vehicle.marketValue) : ""],
    ["Owner", vehicle.ownerName ?? ""],
    ["Branch", vehicle.branchName ?? ""],
    ["Lot location", vehicle.lotLocation ?? ""],
  ];
  const csv = rows.map(([field, value]) => `"${field}","${value.replaceAll('"', '""')}"`).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${vehicle.vin.toLowerCase()}-summary.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

// Shared destructive confirmation keeps focus on a neutral action before the irreversible one.
// destructive dialog opens focused on a neutral action rather than the confirm button.
function ConfirmDialog({ title, message, confirmLabel, tone = "default", busy, onCancel, onConfirm }: {
  title: string; message: ReactNode; confirmLabel: string; tone?: "default" | "danger"; busy?: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  return <AlertDialog title={title} message={message} confirmLabel={confirmLabel} tone={tone} busy={busy} onCancel={onCancel} onConfirm={onConfirm} />;
}

// Replaces a silent navigator.share call, which could report success even after the user
// cancelled the OS share sheet. Copy-link and export always work; device share is an explicit,
// separately labelled action that never claims success unless it actually completed.
function ShareVehicleModal({ vehicle, onClose, notify }: { vehicle: Vehicle360; saving?: boolean; onClose: () => void; notify: (message: string) => void }) {
  const shareUrl = `${window.location.origin}${window.location.pathname}?workspace=vehicles&recordId=${vehicle.id}`;
  const canDeviceShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const title = `${vehicle.make} ${vehicle.model}`;

  async function shareViaDevice() {
    try {
      await navigator.share({ title, text: `AutoAxis vehicle record - ${title}`, url: shareUrl });
      notify("Shared.");
    } catch {
      // The user cancelled the device share sheet, or it failed - never claim it was shared.
    }
  }

  return (
    <Dialog title={`Share ${title}`} eyebrow="Vehicle record" onClose={onClose} className="workflow-modal share-modal">
        <div className="share-modal-body">
          <label className="share-link-row">
            <span>Record link</span>
            <div>
              <input readOnly value={shareUrl} onFocus={(event) => event.currentTarget.select()} aria-label="Shareable record link" />
              <button type="button" onClick={() => copyToClipboard(shareUrl, "Link", notify)}><Copy size={14} />Copy link</button>
            </div>
          </label>
          <div className="share-modal-actions">
            <button type="button" onClick={() => { exportVehicleSummary(vehicle); notify("CSV exported."); }}><Download size={15} />Export as CSV</button>
            <button type="button" aria-disabled={!canDeviceShare} onClick={canDeviceShare ? shareViaDevice : undefined}><Share2 size={15} />{canDeviceShare ? "Share via device" : "Device share not available"}</button>
          </div>
        </div>
    </Dialog>
  );
}

type OverflowMenuItem = { id: string; label: string; icon: LucideIcon; onClick?: () => void; href?: string; tone?: "danger" };

// An accessible "More" menu: Escape closes and returns focus to the trigger, Arrow Up/Down move
// among items, and a click outside closes it.
function OverflowMenu({ label, items }: { label: string; items: OverflowMenuItem[] }) {
  return <ActionMenu label={label} trigger={<MoreHorizontal size={17} />} items={items.map((item) => ({ id: item.id, label: item.label, icon: <item.icon size={15} />, href: item.href, onAction: item.onClick, tone: item.tone }))} />;
}

function useBranches() {
  const [branches, setBranches] = useState<Branch[]>([]);
  useEffect(() => { apiGet<{ branches: Branch[] }>("/api/v1/branches").then((result) => setBranches(result.branches)).catch(() => setBranches([])); }, []);
  return branches;
}

// ---------------------------------------------------------------------------
// Vehicle 360
// ---------------------------------------------------------------------------

type VehicleModal =
  | null | "create-vehicle" | "edit-vehicle" | "share" | "delete"
  | "transfer-ownership" | "add-document" | "add-appraisal" | "add-valuation"
  | "stock-location" | "list-auction" | "record-bid" | "close-auction"
  | "checkout-disposition" | "check-in-disposition"
  | "book-service";

export function VehicleView({ onNavigate, openId }: RecordViewProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<ApiError | null>(null);
  const [query, setQuery] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(openId ?? null);
  useOpenIdSelection(openId, setSelectedId);
  const [vehicle, setVehicle] = useState<Vehicle360 | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [tab, setTab] = useState<VehicleTabName>("Overview");
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [ownership, setOwnership] = useState<VehicleOwnershipEntry[]>([]);
  const [documents, setDocuments] = useState<VehicleDocument[]>([]);
  const [appraisals, setAppraisals] = useState<VehicleAppraisal[]>([]);
  const [valuations, setValuations] = useState<VehicleValuation[]>([]);
  const [listings, setListings] = useState<VehicleAuctionListing[]>([]);
  const [dispositions, setDispositions] = useState<VehicleDisposition[]>([]);
  const [activeListingId, setActiveListingId] = useState<string | null>(null);
  const [activeDispositionId, setActiveDispositionId] = useState<string | null>(null);

  const [modal, setModal] = useState<VehicleModal>(null);
  const [saving, setSaving] = useState(false);
  const { toast, notify } = useToast();
  const branches = useBranches();

  function loadList(searchTerm: string) {
    setListLoading(true);
    setListError(null);
    apiGet<{ vehicles: Vehicle[] }>(`/api/v1/vehicles${searchTerm ? `?q=${encodeURIComponent(searchTerm)}` : ""}`)
      .then((result) => {
        setVehicles(result.vehicles);
        if (!selectedId && result.vehicles.length) setSelectedId(result.vehicles[0].id);
      })
      .catch((cause) => setListError(cause instanceof ApiError ? cause : new ApiError("Vehicle search failed.", { status: 500 })))
      .finally(() => setListLoading(false));
  }

  function loadVehicle(id: string) {
    setDetailLoading(true);
    return apiGet<{ vehicle: Vehicle360 }>(`/api/v1/vehicles/${id}/360`)
      .then((result) => setVehicle(result.vehicle))
      .catch(() => setVehicle(null))
      .finally(() => setDetailLoading(false));
  }

  useEffect(() => { loadList(""); }, []);
  useEffect(() => { if (selectedId) loadVehicle(selectedId); else setVehicle(null); }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    if (tab === "Work orders") apiGet<{ serviceJobs: ServiceJob[] }>(`/api/v1/service-jobs?vehicleId=${selectedId}`).then((result) => setJobs(result.serviceJobs)).catch(() => setJobs([]));
    if (tab === "Ownership") apiGet<{ ownership: VehicleOwnershipEntry[] }>(`/api/v1/vehicles/${selectedId}/ownership`).then((result) => setOwnership(result.ownership)).catch(() => setOwnership([]));
    if (tab === "Documents") apiGet<{ documents: VehicleDocument[] }>(`/api/v1/vehicles/${selectedId}/documents`).then((result) => setDocuments(result.documents)).catch(() => setDocuments([]));
    if (tab === "Appraisal") apiGet<{ appraisals: VehicleAppraisal[] }>(`/api/v1/vehicles/${selectedId}/appraisals`).then((result) => setAppraisals(result.appraisals)).catch(() => setAppraisals([]));
    if (tab === "Valuation") apiGet<{ valuations: VehicleValuation[] }>(`/api/v1/vehicles/${selectedId}/valuations`).then((result) => setValuations(result.valuations)).catch(() => setValuations([]));
    if (tab === "Auction") apiGet<{ listings: VehicleAuctionListing[] }>(`/api/v1/vehicles/${selectedId}/auction-listings`).then((result) => setListings(result.listings)).catch(() => setListings([]));
    if (tab === "Rental & demo") apiGet<{ dispositions: VehicleDisposition[] }>(`/api/v1/vehicles/${selectedId}/dispositions`).then((result) => setDispositions(result.dispositions)).catch(() => setDispositions([]));
  }, [tab, selectedId]);

  function reloadTabData() {
    if (!selectedId) return;
    if (tab === "Ownership") apiGet<{ ownership: VehicleOwnershipEntry[] }>(`/api/v1/vehicles/${selectedId}/ownership`).then((result) => setOwnership(result.ownership)).catch(() => undefined);
    if (tab === "Documents") apiGet<{ documents: VehicleDocument[] }>(`/api/v1/vehicles/${selectedId}/documents`).then((result) => setDocuments(result.documents)).catch(() => undefined);
    if (tab === "Appraisal") apiGet<{ appraisals: VehicleAppraisal[] }>(`/api/v1/vehicles/${selectedId}/appraisals`).then((result) => setAppraisals(result.appraisals)).catch(() => undefined);
    if (tab === "Valuation") apiGet<{ valuations: VehicleValuation[] }>(`/api/v1/vehicles/${selectedId}/valuations`).then((result) => setValuations(result.valuations)).catch(() => undefined);
    if (tab === "Auction") apiGet<{ listings: VehicleAuctionListing[] }>(`/api/v1/vehicles/${selectedId}/auction-listings`).then((result) => setListings(result.listings)).catch(() => undefined);
    if (tab === "Rental & demo") apiGet<{ dispositions: VehicleDisposition[] }>(`/api/v1/vehicles/${selectedId}/dispositions`).then((result) => setDispositions(result.dispositions)).catch(() => undefined);
  }

  function searchVehicles(event: FormEvent) {
    event.preventDefault();
    loadList(query.trim());
  }

  async function submitCreateVehicle(form: {
    vin: string; make: string; model: string; variant: string; colour: string; registration: string; status: string;
    branchId: string; lotLocation: string; acquisitionChannel: string; acquisitionCost: string; intakeAt: string;
  }) {
    setSaving(true);
    try {
      const result = await apiPost<{ vehicle: Vehicle }>("/api/v1/vehicles", {
        ...form,
        branchId: form.branchId || undefined,
        acquisitionChannel: form.acquisitionChannel || undefined,
        acquisitionCost: form.acquisitionCost ? Number(form.acquisitionCost) : undefined,
        intakeAt: form.intakeAt || undefined,
      });
      setModal(null);
      loadList(query.trim());
      setSelectedId(result.vehicle.id);
      notify("Vehicle added to inventory.");
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not create the vehicle.");
    } finally {
      setSaving(false);
    }
  }

  async function submitEditVehicle(form: { registration: string; colour: string; odometerKm: string }) {
    if (!vehicle) return;
    setSaving(true);
    try {
      await apiPatch(`/api/v1/vehicles/${vehicle.id}`, { ...form, odometerKm: form.odometerKm ? Number(form.odometerKm) : undefined });
      setModal(null);
      loadVehicle(vehicle.id);
      loadList(query.trim());
      notify("Vehicle record updated.");
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not update the vehicle.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(status: string) {
    if (!vehicle) return;
    try {
      await apiPatch(`/api/v1/vehicles/${vehicle.id}`, { status });
      loadVehicle(vehicle.id);
      loadList(query.trim());
      notify(`Status set to ${status.replaceAll("-", " ")}.`);
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not update the status.");
    }
  }

  async function submitStockLocation(form: { branchId: string; lotLocation: string; status: string; acquisitionChannel: string; acquisitionCost: string }) {
    if (!vehicle) return;
    setSaving(true);
    try {
      await apiPatch(`/api/v1/vehicles/${vehicle.id}`, {
        branchId: form.branchId || undefined,
        lotLocation: form.lotLocation || undefined,
        status: form.status || undefined,
        acquisitionChannel: form.acquisitionChannel || undefined,
        acquisitionCost: form.acquisitionCost ? Number(form.acquisitionCost) : undefined,
      });
      setModal(null);
      loadVehicle(vehicle.id);
      loadList(query.trim());
      notify("Stock and location updated.");
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not update stock and location.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteVehicle() {
    if (!vehicle) return;
    setSaving(true);
    try {
      await apiDelete(`/api/v1/vehicles/${vehicle.id}`);
      setModal(null);
      setSelectedId(null);
      loadList(query.trim());
      notify("Vehicle deleted.");
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not delete the vehicle.");
    } finally {
      setSaving(false);
    }
  }

  async function submitTransferOwnership(form: { customerId: string; transferReason: string }) {
    if (!vehicle || !form.customerId) return;
    setSaving(true);
    try {
      await apiPost(`/api/v1/vehicles/${vehicle.id}/ownership/transfer`, { customerId: form.customerId, transferReason: form.transferReason || undefined });
      setModal(null);
      loadVehicle(vehicle.id);
      reloadTabData();
      notify("Ownership transferred.");
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not transfer ownership.");
    } finally {
      setSaving(false);
    }
  }

  async function submitAddDocument(form: { documentType: string; label: string; storageReference: string; fileName?: string; fileMimeType?: string; fileData?: string }) {
    if (!vehicle) return;
    setSaving(true);
    try {
      await apiPost(`/api/v1/vehicles/${vehicle.id}/documents`, form);
      setModal(null);
      reloadTabData();
      notify("Document added.");
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not add the document.");
    } finally {
      setSaving(false);
    }
  }

  async function updateDocumentStatus(documentId: string, status: VehicleDocumentStatus) {
    if (!vehicle) return;
    try {
      await apiPatch(`/api/v1/vehicles/${vehicle.id}/documents/${documentId}`, { status });
      reloadTabData();
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not update the document.");
    }
  }

  async function submitAddAppraisal(form: { customerId: string; conditionGrade: ConditionGrade; odometerKm: string; exteriorNotes: string; mechanicalNotes: string; offeredValue: string }) {
    if (!vehicle) return;
    setSaving(true);
    try {
      await apiPost(`/api/v1/vehicles/${vehicle.id}/appraisals`, {
        ...form,
        customerId: form.customerId || undefined,
        odometerKm: form.odometerKm ? Number(form.odometerKm) : undefined,
        offeredValue: form.offeredValue ? Number(form.offeredValue) : undefined,
      });
      setModal(null);
      reloadTabData();
      notify("Appraisal recorded.");
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not record the appraisal.");
    } finally {
      setSaving(false);
    }
  }

  async function updateAppraisalStatus(appraisalId: string, status: AppraisalStatus) {
    if (!vehicle) return;
    try {
      await apiPatch(`/api/v1/vehicles/${vehicle.id}/appraisals/${appraisalId}`, { status });
      reloadTabData();
      if (status === "accepted") { loadVehicle(vehicle.id); notify("Appraisal accepted and logged as a trade valuation."); }
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not update the appraisal.");
    }
  }

  async function submitAddValuation(form: { source: ValuationSource; value: string; notes: string }) {
    if (!vehicle || !form.value) return;
    setSaving(true);
    try {
      await apiPost(`/api/v1/vehicles/${vehicle.id}/valuations`, { ...form, value: Number(form.value) });
      setModal(null);
      reloadTabData();
      if (form.source === "market") loadVehicle(vehicle.id);
      notify("Valuation recorded.");
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not record the valuation.");
    } finally {
      setSaving(false);
    }
  }

  async function submitListAuction(form: { auctionHouse: string; reservePrice: string; closesAt: string }) {
    if (!vehicle) return;
    setSaving(true);
    try {
      await apiPost(`/api/v1/vehicles/${vehicle.id}/auction-listings`, {
        auctionHouse: form.auctionHouse || undefined,
        reservePrice: form.reservePrice ? Number(form.reservePrice) : undefined,
        closesAt: form.closesAt || undefined,
        status: "listed",
      });
      setModal(null);
      loadVehicle(vehicle.id);
      reloadTabData();
      notify("Listed for auction.");
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not create the auction listing.");
    } finally {
      setSaving(false);
    }
  }

  async function updateAuctionListing(listingId: string, status: AuctionListingStatus) {
    if (!vehicle) return;
    try {
      await apiPatch(`/api/v1/vehicles/${vehicle.id}/auction-listings/${listingId}`, { status });
      loadVehicle(vehicle.id);
      reloadTabData();
      notify(`Listing ${status}.`);
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not update the listing.");
    }
  }

  async function submitRecordBid(form: { bidderName: string; amount: string }) {
    if (!vehicle || !activeListingId || !form.amount) return;
    setSaving(true);
    try {
      await apiPost(`/api/v1/vehicles/${vehicle.id}/auction-listings/${activeListingId}/bids`, { ...form, amount: Number(form.amount) });
      setModal(null);
      setActiveListingId(null);
      reloadTabData();
      notify("Bid recorded.");
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not record the bid.");
    } finally {
      setSaving(false);
    }
  }

  async function submitCheckout(form: { dispositionType: DispositionType; customerId: string; odometerOut: string; notes: string }) {
    if (!vehicle) return;
    setSaving(true);
    try {
      await apiPost(`/api/v1/vehicles/${vehicle.id}/dispositions`, {
        ...form,
        customerId: form.customerId || undefined,
        odometerOut: form.odometerOut ? Number(form.odometerOut) : undefined,
      });
      setModal(null);
      loadVehicle(vehicle.id);
      reloadTabData();
      notify(`Checked out for ${form.dispositionType}.`);
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not check out the vehicle.");
    } finally {
      setSaving(false);
    }
  }

  async function submitCheckIn(form: { status: DispositionStatus; odometerIn: string; notes: string }) {
    if (!vehicle || !activeDispositionId) return;
    setSaving(true);
    try {
      await apiPatch(`/api/v1/vehicles/${vehicle.id}/dispositions/${activeDispositionId}`, { ...form, odometerIn: form.odometerIn ? Number(form.odometerIn) : undefined });
      setModal(null);
      setActiveDispositionId(null);
      loadVehicle(vehicle.id);
      reloadTabData();
      notify(form.status === "completed" ? "Vehicle checked in." : "Checkout cancelled.");
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not update the checkout.");
    } finally {
      setSaving(false);
    }
  }

  async function submitRecordSale(form: { soldPrice: string; buyerNote: string }) {
    if (!vehicle || !activeListingId) return;
    setSaving(true);
    try {
      await apiPatch(`/api/v1/vehicles/${vehicle.id}/auction-listings/${activeListingId}`, { status: "sold", soldPrice: Number(form.soldPrice), buyerNote: form.buyerNote || undefined });
      setModal(null);
      setActiveListingId(null);
      loadVehicle(vehicle.id);
      reloadTabData();
      notify("Listing marked sold.");
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not update the listing.");
    } finally {
      setSaving(false);
    }
  }

  async function submitBookService(form: { repairOrderNumber: string; advisor: string; complaint: string }) {
    if (!vehicle || !vehicle.ownerId) return;
    setSaving(true);
    try {
      await apiPost("/api/v1/service-jobs", { customerId: vehicle.ownerId, vehicleId: vehicle.id, repairOrderNumber: form.repairOrderNumber, advisor: form.advisor, complaint: form.complaint });
      setModal(null);
      notify("Workshop booking confirmed.");
    } catch (cause) {
      notify(cause instanceof ApiError ? cause.message : "Could not create the booking.");
    } finally {
      setSaving(false);
    }
  }

  const hasActiveDisposition = dispositions.some((entry) => entry.status === "active");
  const hasActiveListing = listings.some((entry) => entry.status === "listed" || entry.status === "bidding");
  const availableForDisposition = vehicle ? !["sold", "rental", "demo", "auction"].includes(vehicle.status) : false;

  useContextualActions(() => {
    if (!vehicle) return [];
    const list: SidebarAction[] = [
      { id: "add-to-stock", label: "Add to stock", detail: "Create a VIN master record", icon: Plus, onClick: () => setModal("create-vehicle") },
      { id: "transfer-ownership", label: "Transfer ownership", detail: "Record a new registered owner", icon: UserRound, onClick: () => setModal("transfer-ownership") },
      { id: "add-document", label: "Add document", detail: "Registration, insurance, invoice...", icon: FileText, onClick: () => setModal("add-document") },
      { id: "add-appraisal", label: "New appraisal", detail: "Trade-in condition and offer", icon: ClipboardList, onClick: () => setModal("add-appraisal") },
      { id: "add-valuation", label: "Add valuation", detail: "Market, trade, or wholesale", icon: TrendingUp, onClick: () => setModal("add-valuation") },
    ];
    if (availableForDisposition) list.push({ id: "checkout", label: "Check out for rental/demo", icon: KeyRound, onClick: () => setModal("checkout-disposition") });
    if (vehicle.ownerId) list.push({ id: "book-workshop", label: "Book workshop", detail: "Service or inspection", icon: Wrench, onClick: () => setModal("book-service") });
    list.push({ id: "edit-vehicle", label: "Edit vehicle", icon: Edit3, onClick: () => setModal("edit-vehicle"), group: "This record" });
    list.push({ id: "share", label: "Share", icon: Share2, onClick: () => setModal("share"), group: "This record" });
    list.push({ id: "export", label: "Export", icon: Download, onClick: () => { exportVehicleSummary(vehicle); notify("CSV exported."); }, group: "This record" });
    list.push({ id: "delete", label: "Delete", icon: Trash2, tone: "danger", onClick: () => setModal("delete"), group: "This record" });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle, availableForDisposition]);

  const estimatedTrade = useMemo(() => (vehicle?.marketValue ? vehicle.marketValue * 0.93 : null), [vehicle]);
  const wholesaleFloor = useMemo(() => (vehicle?.marketValue ? vehicle.marketValue * 0.89 : null), [vehicle]);

  return <WorkspacePage>
    <div className="record-workbench">
      <aside className="record-directory-panel">
        <header className="directory-panel-heading"><div><span>Vehicle directory</span><strong>{vehicles.length} connected assets</strong></div><button type="button" onClick={() => setModal("create-vehicle")} aria-label="Add vehicle"><Plus /></button></header>
        <form className="record-search" onSubmit={searchVehicles}><Search /><input aria-label="Search vehicles" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="VIN, registration, make or model" />{query && <button className="search-clear" type="button" aria-label="Clear vehicle search" onClick={() => { setQuery(""); loadList(""); }}><X /></button>}<button className="search-submit" type="submit" disabled={listLoading}>Search</button></form>
        <SearchState loading={listLoading} error={listError} fields="VIN, registration, make, or model" />
        <section className="vehicle-directory"><div className="vehicle-list-head"><span>Vehicle</span><span>Status</span><span>Value</span></div>
          {vehicles.map((entry) => <button type="button" className={selectedId === entry.id ? "selected" : ""} key={entry.id} onClick={() => setSelectedId(entry.id)}><span className="vehicle-list-icon"><CarFront /></span><div><strong>{entry.modelYear ?? ""} {entry.make} {entry.model}</strong><small>{entry.registration ?? entry.vin.slice(-8)}</small></div><span>{entry.status}</span><b>{entry.marketValue ? money.format(entry.marketValue) : "-"}</b><ArrowRight /></button>)}
          {!listLoading && !vehicles.length && <div className="customer-list-empty"><Search />No matching vehicles. Add one to get started.</div>}
        </section>
      </aside>
      <section className="record-detail-panel">
        {detailLoading && <div className="empty-state"><Search /><strong>Loading vehicle</strong></div>}
        {!detailLoading && !vehicle && <div className="empty-state"><Search /><strong>No vehicle selected</strong><p>Search or add a vehicle to see its connected record.</p></div>}
        {!detailLoading && vehicle && <div className="record-layout">
          <section className="record-main-card">
            <div className="vehicle-hero">
              <div className="vehicle-silhouette"><CarFront /></div>
              <div><span>{vehicle.modelYear ?? "Year unknown"}</span><h3>{vehicle.make} {vehicle.model}</h3><p>{vehicle.variant ?? ""} {vehicle.colour ?? ""}</p></div>
              <div className="record-actions-row">
                <button type="button" className="workspace-button workspace-button--dark" onClick={() => setModal("edit-vehicle")}><Edit3 size={15} />Edit</button>
                <button type="button" className="workspace-button" onClick={() => setModal("share")}><Share2 size={15} />Share</button>
                <select aria-label="Vehicle status" value={vehicle.status} onChange={(event) => updateStatus(event.target.value)}>
                  {["in-stock", "customer-owned", "reserved", "demo", "rental", "auction", "sold"].map((status) => <option key={status} value={status}>{status.replaceAll("-", " ")}</option>)}
                </select>
                <OverflowMenu label={`More actions for ${vehicle.make} ${vehicle.model}`} items={[
                  { id: "export", label: "Export CSV", icon: Download, onClick: () => { exportVehicleSummary(vehicle); notify("CSV exported."); } },
                  { id: "delete", label: "Delete vehicle", icon: Trash2, tone: "danger", onClick: () => setModal("delete") },
                ]} />
              </div>
            </div>
            <div className="record-tabs" role="tablist" aria-label={`${vehicle.make} ${vehicle.model} tabs`} onKeyDown={moveTabFocus}>
              {TABS.map((item) => <button role="tab" aria-selected={tab === item} tabIndex={tab === item ? 0 : -1} className={tab === item ? "active" : ""} type="button" key={item} onClick={() => setTab(item)}>{item}</button>)}
            </div>

            {tab === "Overview" && <>
              <div className="record-facts">
                <div><CarFront /><span>VIN</span><strong className="fact-small">{vehicle.vin}<CopyChip value={vehicle.vin} label="VIN" notify={notify} /></strong></div>
                <div><Gauge /><span>Odometer</span><strong>{vehicle.odometerKm ? `${kmFormatter.format(vehicle.odometerKm)} km` : "Not recorded"}</strong></div>
                <div><TrendingUp /><span>Market value</span><strong>{vehicle.marketValue ? money.format(vehicle.marketValue) : "Not set"}</strong></div>
                <div><UserRound /><span>Current owner</span>{vehicle.ownerId ? <button type="button" onClick={() => onNavigate("customers", vehicle.ownerId)}>{vehicle.ownerName}</button> : <strong>Unowned</strong>}</div>
              </div>
              <InfoGrid items={[
                ["Registration", vehicle.registration ?? "Unregistered"],
                ["Branch and location", vehicle.branchName ? `${vehicle.branchName}${vehicle.lotLocation ? ` — ${vehicle.lotLocation}` : ""}` : "Not assigned"],
                ["Intake", vehicle.acquisitionChannel ? `${vehicle.acquisitionChannel.replaceAll("-", " ")}${vehicle.intakeAt ? `, ${dateFormatter.format(new Date(vehicle.intakeAt))}` : ""}` : "Not recorded"],
              ]} />
            </>}

            {tab === "Ownership" && <>
              <SectionToolbar title="Ownership history" detail={`${ownership.length} recorded owner${ownership.length === 1 ? "" : "s"}`} action="Transfer ownership" onAction={() => setModal("transfer-ownership")} />
              <div className="ownership-list">
                {ownership.map((entry) => (
                  <div className="ownership-row" key={entry.id}>
                    <UserRound />
                    <div>
                      <strong>{entry.customerName}{entry.isPrimary && entry.endedOn === null && <span className="role-badge">Current</span>}</strong>
                      <span>{dateFormatter.format(new Date(entry.startedOn))} — {entry.endedOn ? dateFormatter.format(new Date(entry.endedOn)) : "present"}{entry.transferReason ? ` · ${entry.transferReason}` : ""}</span>
                    </div>
                    {entry.customerMobile && <span className="fact-small">{entry.customerMobile}<CopyChip value={entry.customerMobile} label="Owner mobile" notify={notify} /></span>}
                  </div>
                ))}
                {!ownership.length && <div className="timeline-empty">No ownership recorded yet.</div>}
              </div>
            </>}

            {tab === "Lifecycle" && <Timeline items={vehicle.timeline} />}

            {tab === "Documents" && <>
              <SectionToolbar title="Documents on file" detail={`${documents.length} document${documents.length === 1 ? "" : "s"}`} action="Add document" onAction={() => setModal("add-document")} />
              <div className="documents-list">
                {documents.map((document) => (
                  <div className="document-row" key={document.id}>
                    <FileText />
                    <div><strong>{document.label}</strong><span>{document.documentType}{document.storageReference ? ` · ${document.storageReference}` : ""}{document.fileSizeBytes ? ` · ${formatFileSize(document.fileSizeBytes)}` : ""}</span></div>
                    {document.fileName ? (
                      <button type="button" className="workspace-button" title={`Download ${document.fileName}`} onClick={() => vehicle && downloadDocumentFile(`/api/v1/vehicles/${vehicle.id}/documents/${document.id}/file`, document.fileName!, notify)}><Download size={14} />Download</button>
                    ) : <span className="document-no-file">No file attached</span>}
                    <select aria-label={`Status for ${document.label}`} value={document.status} onChange={(event) => updateDocumentStatus(document.id, event.target.value as VehicleDocumentStatus)}>
                      {(["requested", "received", "verified", "rejected"] as VehicleDocumentStatus[]).map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </div>
                ))}
                {!documents.length && <div className="timeline-empty">No documents on file yet.</div>}
              </div>
            </>}

            {tab === "Appraisal" && <>
              <SectionToolbar title="Trade-in appraisals" detail={`${appraisals.length} on file`} action="New appraisal" onAction={() => setModal("add-appraisal")} />
              <div className="appraisal-list">
                {appraisals.map((appraisal) => (
                  <div className="appraisal-card" key={appraisal.id}>
                    <div className="appraisal-card-head">
                      <strong>Condition: {appraisal.conditionGrade}</strong>
                      <select aria-label="Appraisal status" value={appraisal.status} disabled={appraisal.status !== "draft" && appraisal.status !== "offered"} onChange={(event) => updateAppraisalStatus(appraisal.id, event.target.value as AppraisalStatus)}>
                        {(["draft", "offered", "accepted", "declined", "expired"] as AppraisalStatus[]).map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                    </div>
                    <p>{appraisal.customerName ? `For ${appraisal.customerName} · ` : ""}{appraisal.odometerKm ? `${kmFormatter.format(appraisal.odometerKm)} km · ` : ""}{appraisal.offeredValue ? `Offered ${money.format(appraisal.offeredValue)}` : "No offer recorded"}</p>
                    {(appraisal.exteriorNotes || appraisal.mechanicalNotes) && <p className="appraisal-notes">{[appraisal.exteriorNotes, appraisal.mechanicalNotes].filter(Boolean).join(" · ")}</p>}
                    <span className="note-card-meta">{dateFormatter.format(new Date(appraisal.createdAt))}{appraisal.decidedAt ? ` — decided ${dateFormatter.format(new Date(appraisal.decidedAt))}` : ""}</span>
                  </div>
                ))}
                {!appraisals.length && <div className="timeline-empty">No appraisals recorded yet.</div>}
              </div>
            </>}

            {tab === "Valuation" && <>
              <div className="valuation-panel">
                <div><span>Retail market</span><strong>{vehicle.marketValue ? money.format(vehicle.marketValue) : "Not set"}</strong></div>
                {estimatedTrade && <div><span>Estimated trade value</span><strong>{money.format(estimatedTrade)}</strong><em>Estimated at 93% of market value</em></div>}
                {wholesaleFloor && <div><span>Estimated wholesale floor</span><strong>{money.format(wholesaleFloor)}</strong><em>Estimated at 89% of market value</em></div>}
                <button type="button" onClick={() => setModal("add-valuation")}>Add valuation <ArrowRight /></button>
              </div>
              <SectionToolbar title="Valuation history" detail={`${valuations.length} recorded`} />
              <OperationalTable columns={["Source", "Value", "Notes", "Date"]} rows={valuations.map((entry) => [entry.source, money.format(entry.value), entry.notes ?? "-", dateFormatter.format(new Date(entry.valuedAt))])} />
            </>}

            {tab === "Stock & location" && <>
              <InfoGrid items={[
                ["Branch", vehicle.branchName ?? "Not assigned"],
                ["Lot location", vehicle.lotLocation ?? "Not recorded"],
                ["Current status", vehicle.status.replaceAll("-", " ")],
                ["Acquisition channel", vehicle.acquisitionChannel?.replaceAll("-", " ") ?? "Not recorded"],
                ["Acquisition cost", vehicle.acquisitionCost ? money.format(vehicle.acquisitionCost) : "Not recorded"],
                ["Intake date", vehicle.intakeAt ? dateFormatter.format(new Date(vehicle.intakeAt)) : "Not recorded"],
              ]} />
              <div className="valuation-panel"><button type="button" onClick={() => setModal("stock-location")}><Warehouse size={14} />Update stock &amp; location <ArrowRight /></button></div>
            </>}

            {tab === "Auction" && <>
              <SectionToolbar title="Auction listings" detail={hasActiveListing ? "Currently listed" : `${listings.length} on file`} action={hasActiveListing || !availableForDisposition ? undefined : "List for auction"} onAction={() => setModal("list-auction")} />
              <div className="auction-list">
                {listings.map((listing) => (
                  <div className="auction-card" key={listing.id}>
                    <div className="appraisal-card-head">
                      <strong><Gavel size={14} /> {listing.auctionHouse ?? "Auction listing"} — {listing.status}</strong>
                      {(listing.status === "listed" || listing.status === "bidding") && <div className="auction-card-actions">
                        <button type="button" onClick={() => { setActiveListingId(listing.id); setModal("record-bid"); }}>Record bid</button>
                        <button type="button" onClick={() => updateAuctionListing(listing.id, "unsold")}>Mark unsold</button>
                        <button type="button" onClick={() => { setActiveListingId(listing.id); setModal("close-auction"); }}>Mark sold</button>
                      </div>}
                    </div>
                    <p>{listing.reservePrice ? `Reserve ${money.format(listing.reservePrice)}` : "No reserve set"}{listing.soldPrice ? ` · Sold ${money.format(listing.soldPrice)}` : ""}{listing.closesAt ? ` · Closes ${dateTimeFormatter.format(new Date(listing.closesAt))}` : ""}</p>
                    {listing.bids.length > 0 && <div className="auction-bids">{listing.bids.map((bid) => <span key={bid.id}>{bid.bidderName}: {money.format(bid.amount)}</span>)}</div>}
                  </div>
                ))}
                {!listings.length && <div className="timeline-empty">Not listed for auction.</div>}
              </div>
            </>}

            {tab === "Rental & demo" && <>
              <SectionToolbar title="Rental and demo checkouts" detail={hasActiveDisposition ? "Currently checked out" : `${dispositions.length} on file`} action={hasActiveDisposition || !availableForDisposition ? undefined : "Check out vehicle"} onAction={() => setModal("checkout-disposition")} />
              <div className="disposition-list">
                {dispositions.map((entry) => (
                  <div className="disposition-card" key={entry.id}>
                    <div className="appraisal-card-head">
                      <strong><KeyRound size={14} /> {entry.dispositionType} — {entry.status}</strong>
                      {entry.status === "active" && <button type="button" onClick={() => { setActiveDispositionId(entry.id); setModal("check-in-disposition"); }}>Check in</button>}
                    </div>
                    <p>{entry.customerName ? `${entry.customerName} · ` : ""}{dateTimeFormatter.format(new Date(entry.startsAt))}{entry.endsAt ? ` — ${dateTimeFormatter.format(new Date(entry.endsAt))}` : ""}</p>
                    {(entry.odometerOut || entry.odometerIn) && <p className="appraisal-notes">{entry.odometerOut ? `Out ${kmFormatter.format(entry.odometerOut)} km` : ""}{entry.odometerIn ? ` · In ${kmFormatter.format(entry.odometerIn)} km` : ""}</p>}
                  </div>
                ))}
                {!dispositions.length && <div className="timeline-empty">No rental or demo checkouts yet.</div>}
              </div>
            </>}

            {tab === "Work orders" && <>
              <SectionToolbar title="Workshop history" detail={`${jobs.length} repair orders on file`} action={vehicle.ownerId ? "Book workshop" : undefined} onAction={() => setModal("book-service")} />
              <OperationalTable columns={["Repair order", "Status", "Opened", "Labour"]} rows={jobs.map((job) => [job.repairOrderNumber, job.status, dateFormatter.format(new Date(job.openedAt)), money.format(job.labourTotal)])} />
            </>}
          </section>
        </div>}
      </section>
    </div>

    {modal === "create-vehicle" && <CreateVehicleModal branches={branches} saving={saving} onClose={() => setModal(null)} onSubmit={submitCreateVehicle} />}
    {modal === "edit-vehicle" && vehicle && <EditVehicleModal vehicle={vehicle} saving={saving} onClose={() => setModal(null)} onSubmit={submitEditVehicle} />}
    {modal === "share" && vehicle && <ShareVehicleModal vehicle={vehicle} onClose={() => setModal(null)} notify={notify} />}
    {modal === "delete" && vehicle && <ConfirmDialog title={`Delete ${vehicle.make} ${vehicle.model}?`} message="This cannot be undone. Linked ownership, service, or sales records will block deletion." confirmLabel="Delete vehicle" tone="danger" busy={saving} onCancel={() => setModal(null)} onConfirm={deleteVehicle} />}
    {modal === "transfer-ownership" && <TransferOwnershipModal saving={saving} onClose={() => setModal(null)} onSubmit={submitTransferOwnership} />}
    {modal === "add-document" && <AddDocumentModal saving={saving} onClose={() => setModal(null)} onSubmit={submitAddDocument} />}
    {modal === "add-appraisal" && <AddAppraisalModal saving={saving} onClose={() => setModal(null)} onSubmit={submitAddAppraisal} />}
    {modal === "add-valuation" && <AddValuationModal saving={saving} onClose={() => setModal(null)} onSubmit={submitAddValuation} />}
    {modal === "stock-location" && vehicle && <StockLocationModal vehicle={vehicle} branches={branches} saving={saving} onClose={() => setModal(null)} onSubmit={submitStockLocation} />}
    {modal === "list-auction" && <ListAuctionModal saving={saving} onClose={() => setModal(null)} onSubmit={submitListAuction} />}
    {modal === "record-bid" && <RecordBidModal saving={saving} onClose={() => { setModal(null); setActiveListingId(null); }} onSubmit={submitRecordBid} />}
    {modal === "close-auction" && <RecordSaleModal saving={saving} onClose={() => { setModal(null); setActiveListingId(null); }} onSubmit={submitRecordSale} />}
    {modal === "checkout-disposition" && <CheckoutDispositionModal saving={saving} onClose={() => setModal(null)} onSubmit={submitCheckout} />}
    {modal === "check-in-disposition" && <CheckInDispositionModal saving={saving} onClose={() => { setModal(null); setActiveDispositionId(null); }} onSubmit={submitCheckIn} />}
    {modal === "book-service" && vehicle && <VehicleServiceModal saving={saving} onClose={() => setModal(null)} onSubmit={submitBookService} />}
    {toast && <Toast message={toast} />}
  </WorkspacePage>;
}

// ---------------------------------------------------------------------------
// Modals
// ---------------------------------------------------------------------------

function CreateVehicleModal({ branches, onClose, onSubmit, saving }: {
  branches: Branch[]; saving: boolean; onClose: () => void;
  onSubmit: (form: { vin: string; make: string; model: string; variant: string; colour: string; registration: string; status: string; branchId: string; lotLocation: string; acquisitionChannel: string; acquisitionCost: string; intakeAt: string }) => void;
}) {
  const [form, setForm] = useState({
    vin: "", make: "", model: "", variant: "", colour: "", registration: "", status: "in-stock",
    branchId: "", lotLocation: "", acquisitionChannel: "", acquisitionCost: "", intakeAt: new Date().toISOString().slice(0, 10),
  });
  return <WorkflowModal title="Add vehicle to inventory" eyebrow="Vehicle intake" completeLabel="Create vehicle" busy={saving} onClose={onClose} onComplete={() => onSubmit(form)}>
    <div className="workflow-form-grid">
      <TextField label="VIN" required value={form.vin} onChange={(event) => setForm({ ...form, vin: event.target.value.toUpperCase() })} />
      <TextField label="Registration" value={form.registration} onChange={(event) => setForm({ ...form, registration: event.target.value })} />
      <TextField label="Make" required value={form.make} onChange={(event) => setForm({ ...form, make: event.target.value })} />
      <TextField label="Model" required value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} />
      <TextField label="Variant" value={form.variant} onChange={(event) => setForm({ ...form, variant: event.target.value })} />
      <TextField label="Colour" value={form.colour} onChange={(event) => setForm({ ...form, colour: event.target.value })} />
      <SelectField label="Status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="in-stock">In stock</option><option value="demo">Demo</option><option value="reserved">Reserved</option><option value="customer-owned">Customer owned</option></SelectField>
      <SelectField label="Branch" value={form.branchId} onChange={(event) => setForm({ ...form, branchId: event.target.value })}><option value="">Not assigned</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</SelectField>
      <TextField label="Lot location" value={form.lotLocation} onChange={(event) => setForm({ ...form, lotLocation: event.target.value })} placeholder="e.g. Bay 12" />
      <SelectField label="Acquisition channel" value={form.acquisitionChannel} onChange={(event) => setForm({ ...form, acquisitionChannel: event.target.value })}><option value="">Not recorded</option><option value="trade-in">Trade-in</option><option value="auction-purchase">Auction purchase</option><option value="direct-purchase">Direct purchase</option><option value="consignment">Consignment</option></SelectField>
      <CurrencyField label="Acquisition cost" value={form.acquisitionCost} onChange={(event) => setForm({ ...form, acquisitionCost: event.target.value })} />
      <DateField label="Intake date" value={form.intakeAt} onChange={(event) => setForm({ ...form, intakeAt: event.target.value })} />
    </div>
  </WorkflowModal>;
}

function EditVehicleModal({ vehicle, onClose, onSubmit, saving }: { vehicle: Vehicle360; saving: boolean; onClose: () => void; onSubmit: (form: { registration: string; colour: string; odometerKm: string }) => void }) {
  const [form, setForm] = useState({ registration: vehicle.registration ?? "", colour: vehicle.colour ?? "", odometerKm: vehicle.odometerKm?.toString() ?? "" });
  return <WorkflowModal title="Edit vehicle" eyebrow="Vehicle record" completeLabel="Save changes" busy={saving} onClose={onClose} onComplete={() => onSubmit(form)}>
    <div className="workflow-form-grid">
      <TextField label="Registration" value={form.registration} onChange={(event) => setForm({ ...form, registration: event.target.value })} />
      <TextField label="Colour" value={form.colour} onChange={(event) => setForm({ ...form, colour: event.target.value })} />
      <TextField label="Odometer (km)" type="number" min="0" value={form.odometerKm} onChange={(event) => setForm({ ...form, odometerKm: event.target.value })} />
    </div>
    <p className="workflow-form-note">Status changes from the record header; market value updates from the Valuation tab.</p>
  </WorkflowModal>;
}

function TransferOwnershipModal({ onClose, onSubmit, saving }: { saving: boolean; onClose: () => void; onSubmit: (form: { customerId: string; transferReason: string }) => void }) {
  const [form, setForm] = useState({ customerId: "", customerLabel: "", transferReason: "" });
  return <WorkflowModal title="Transfer ownership" eyebrow="Vehicle ownership" completeLabel="Transfer ownership" busy={saving} onClose={onClose} onComplete={() => onSubmit(form)}>
    <div className="workflow-form-grid">
      <CustomerPicker className="workflow-form-full" label="New owner" required selectedId={form.customerId} value={form.customerLabel} onClear={() => setForm({ ...form, customerId: "", customerLabel: "" })} onSelect={(customer: Customer) => setForm({ ...form, customerId: customer.id, customerLabel: customer.displayName })} />
      <TextField className="workflow-form-full" label="Reason" value={form.transferReason} onChange={(event) => setForm({ ...form, transferReason: event.target.value })} placeholder="e.g. Sold, traded in, gifted" />
    </div>
    {!form.customerId && <p className="inline-error"><AlertTriangle size={14} />Select the new owner from the picker above.</p>}
  </WorkflowModal>;
}

function AddDocumentModal({ onClose, onSubmit, saving }: {
  saving: boolean; onClose: () => void;
  onSubmit: (form: { documentType: string; label: string; storageReference: string; fileName?: string; fileMimeType?: string; fileData?: string }) => void;
}) {
  const [form, setForm] = useState({ documentType: "registration_certificate", label: "", storageReference: "" });
  const [file, setFile] = useState<{ name: string; mimeType: string; data: string; size: number } | null>(null);
  const [fileError, setFileError] = useState("");

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    event.target.value = "";
    if (!picked) return;
    if (picked.size > MAX_DOCUMENT_FILE_BYTES) {
      setFileError(`${picked.name} is larger than ${formatFileSize(MAX_DOCUMENT_FILE_BYTES)}.`);
      return;
    }
    setFileError("");
    const data = await readFileAsBase64(picked);
    setFile({ name: picked.name, mimeType: picked.type, data, size: picked.size });
  }

  return <WorkflowModal title="Add document" eyebrow="Vehicle documents" completeLabel="Add document" busy={saving} onClose={onClose} onComplete={() => onSubmit({
    ...form,
    fileName: file?.name, fileMimeType: file?.mimeType, fileData: file?.data,
  })}>
    <p className="workflow-form-note">Attach a scanned file (JPEG, PNG, or PDF up to {formatFileSize(MAX_DOCUMENT_FILE_BYTES)}), or just record where the physical document is filed.</p>
    <div className="workflow-form-grid">
      <SelectField label="Document type" value={form.documentType} onChange={(event) => setForm({ ...form, documentType: event.target.value })}>
        <option value="registration_certificate">Registration certificate</option>
        <option value="insurance">Insurance</option>
        <option value="invoice">Purchase invoice</option>
        <option value="inspection_report">Inspection report</option>
        <option value="valuation_report">Valuation report</option>
        <option value="other">Other</option>
      </SelectField>
      <TextField label="Label" required value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} placeholder="e.g. NSW registration papers" />
      <TextField className="workflow-form-full" label="Storage reference" value={form.storageReference} onChange={(event) => setForm({ ...form, storageReference: event.target.value })} placeholder="Link or reference to where the file lives" />
      <label className="document-file-field workflow-form-full">
        <span>File (optional)</span>
        <input type="file" accept={DOCUMENT_FILE_ACCEPT} onChange={handleFileChange} />
        {file && <span className="document-file-chip"><FileText size={13} />{file.name} - {formatFileSize(file.size)}<button type="button" aria-label="Remove selected file" onClick={() => setFile(null)}><X size={12} /></button></span>}
      </label>
    </div>
    {fileError && <p className="inline-error"><AlertTriangle size={14} />{fileError}</p>}
  </WorkflowModal>;
}

function AddAppraisalModal({ onClose, onSubmit, saving }: {
  saving: boolean; onClose: () => void;
  onSubmit: (form: { customerId: string; conditionGrade: ConditionGrade; odometerKm: string; exteriorNotes: string; mechanicalNotes: string; offeredValue: string }) => void;
}) {
  const [form, setForm] = useState({ customerId: "", customerLabel: "", conditionGrade: "good" as ConditionGrade, odometerKm: "", exteriorNotes: "", mechanicalNotes: "", offeredValue: "" });
  return <WorkflowModal title="New trade-in appraisal" eyebrow="Vehicle appraisal" completeLabel="Save appraisal" busy={saving} onClose={onClose} onComplete={() => onSubmit(form)}>
    <div className="workflow-form-grid">
      <CustomerPicker className="workflow-form-full" label="Customer" selectedId={form.customerId} value={form.customerLabel} onClear={() => setForm({ ...form, customerId: "", customerLabel: "" })} onSelect={(customer: Customer) => setForm({ ...form, customerId: customer.id, customerLabel: customer.displayName })} />
      <SelectField label="Condition grade" value={form.conditionGrade} onChange={(event) => setForm({ ...form, conditionGrade: event.target.value as ConditionGrade })}><option value="excellent">Excellent</option><option value="good">Good</option><option value="fair">Fair</option><option value="poor">Poor</option></SelectField>
      <TextField label="Odometer (km)" type="number" min="0" value={form.odometerKm} onChange={(event) => setForm({ ...form, odometerKm: event.target.value })} />
      <CurrencyField label="Offered value" value={form.offeredValue} onChange={(event) => setForm({ ...form, offeredValue: event.target.value })} />
      <TextArea className="workflow-form-full" label="Exterior notes" value={form.exteriorNotes} onChange={(event) => setForm({ ...form, exteriorNotes: event.target.value })} />
      <TextArea className="workflow-form-full" label="Mechanical notes" value={form.mechanicalNotes} onChange={(event) => setForm({ ...form, mechanicalNotes: event.target.value })} />
    </div>
  </WorkflowModal>;
}

function AddValuationModal({ onClose, onSubmit, saving }: { saving: boolean; onClose: () => void; onSubmit: (form: { source: ValuationSource; value: string; notes: string }) => void }) {
  const [form, setForm] = useState({ source: "market" as ValuationSource, value: "", notes: "" });
  return <WorkflowModal title="Add valuation" eyebrow="Vehicle valuation" completeLabel="Save valuation" busy={saving} onClose={onClose} onComplete={() => onSubmit(form)}>
    <div className="workflow-form-grid">
      <SelectField label="Source" value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value as ValuationSource })}><option value="market">Market</option><option value="trade">Trade</option><option value="wholesale">Wholesale</option><option value="manual">Manual</option></SelectField>
      <CurrencyField label="Value" required value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} />
      <TextArea className="workflow-form-full" label="Notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
    </div>
    {form.source === "market" && <p className="workflow-form-note">A market valuation also updates the vehicle's current market value shown on the Overview tab.</p>}
  </WorkflowModal>;
}

function StockLocationModal({ vehicle, branches, onClose, onSubmit, saving }: {
  vehicle: Vehicle360; branches: Branch[]; saving: boolean; onClose: () => void;
  onSubmit: (form: { branchId: string; lotLocation: string; status: string; acquisitionChannel: string; acquisitionCost: string }) => void;
}) {
  const [form, setForm] = useState({
    branchId: vehicle.branchId ?? "", lotLocation: vehicle.lotLocation ?? "", status: vehicle.status,
    acquisitionChannel: vehicle.acquisitionChannel ?? "", acquisitionCost: vehicle.acquisitionCost?.toString() ?? "",
  });
  return <WorkflowModal title="Update stock and location" eyebrow="Vehicle 360" completeLabel="Save changes" busy={saving} onClose={onClose} onComplete={() => onSubmit(form)}>
    <div className="workflow-form-grid">
      <SelectField label="Branch" value={form.branchId} onChange={(event) => setForm({ ...form, branchId: event.target.value })}><option value="">Not assigned</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</SelectField>
      <TextField label="Lot location" value={form.lotLocation} onChange={(event) => setForm({ ...form, lotLocation: event.target.value })} />
      <SelectField label="Status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>{["in-stock", "customer-owned", "reserved", "demo", "rental", "auction", "sold"].map((status) => <option key={status} value={status}>{status.replaceAll("-", " ")}</option>)}</SelectField>
      <SelectField label="Acquisition channel" value={form.acquisitionChannel} onChange={(event) => setForm({ ...form, acquisitionChannel: event.target.value as AcquisitionChannel })}><option value="">Not recorded</option><option value="trade-in">Trade-in</option><option value="auction-purchase">Auction purchase</option><option value="direct-purchase">Direct purchase</option><option value="consignment">Consignment</option></SelectField>
      <CurrencyField label="Acquisition cost" value={form.acquisitionCost} onChange={(event) => setForm({ ...form, acquisitionCost: event.target.value })} />
    </div>
  </WorkflowModal>;
}

function ListAuctionModal({ onClose, onSubmit, saving }: { saving: boolean; onClose: () => void; onSubmit: (form: { auctionHouse: string; reservePrice: string; closesAt: string }) => void }) {
  const [form, setForm] = useState({ auctionHouse: "", reservePrice: "", closesAt: "" });
  return <WorkflowModal title="List for auction" eyebrow="Auction disposition" completeLabel="List vehicle" busy={saving} onClose={onClose} onComplete={() => onSubmit(form)}>
    <div className="workflow-form-grid">
      <TextField label="Auction house" value={form.auctionHouse} onChange={(event) => setForm({ ...form, auctionHouse: event.target.value })} />
      <CurrencyField label="Reserve price" value={form.reservePrice} onChange={(event) => setForm({ ...form, reservePrice: event.target.value })} />
      <DateTimeField className="workflow-form-full" label="Closes at" value={form.closesAt} onChange={(event) => setForm({ ...form, closesAt: event.target.value })} />
    </div>
  </WorkflowModal>;
}

function RecordBidModal({ onClose, onSubmit, saving }: { saving: boolean; onClose: () => void; onSubmit: (form: { bidderName: string; amount: string }) => void }) {
  const [form, setForm] = useState({ bidderName: "", amount: "" });
  return <WorkflowModal title="Record bid" eyebrow="Auction disposition" completeLabel="Record bid" busy={saving} onClose={onClose} onComplete={() => onSubmit(form)}>
    <div className="workflow-form-grid">
      <TextField label="Bidder name" required value={form.bidderName} onChange={(event) => setForm({ ...form, bidderName: event.target.value })} />
      <CurrencyField label="Amount" required value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
    </div>
  </WorkflowModal>;
}

function RecordSaleModal({ onClose, onSubmit, saving }: { saving: boolean; onClose: () => void; onSubmit: (form: { soldPrice: string; buyerNote: string }) => void }) {
  const [form, setForm] = useState({ soldPrice: "", buyerNote: "" });
  return <WorkflowModal title="Record auction sale" eyebrow="Auction disposition" completeLabel="Mark sold" busy={saving} onClose={onClose} onComplete={() => onSubmit(form)}>
    <div className="workflow-form-grid">
      <CurrencyField label="Sold price" required value={form.soldPrice} onChange={(event) => setForm({ ...form, soldPrice: event.target.value })} />
      <TextArea className="workflow-form-full" label="Buyer note" value={form.buyerNote} onChange={(event) => setForm({ ...form, buyerNote: event.target.value })} />
    </div>
  </WorkflowModal>;
}

function CheckInDispositionModal({ onClose, onSubmit, saving }: { saving: boolean; onClose: () => void; onSubmit: (form: { status: DispositionStatus; odometerIn: string; notes: string }) => void }) {
  const [form, setForm] = useState({ status: "completed" as DispositionStatus, odometerIn: "", notes: "" });
  return <WorkflowModal title="Check in vehicle" eyebrow="Rental / demo disposition" completeLabel="Save" busy={saving} onClose={onClose} onComplete={() => onSubmit(form)}>
    <div className="workflow-form-grid">
      <SelectField label="Outcome" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as DispositionStatus })}><option value="completed">Completed - returned</option><option value="cancelled">Cancelled</option></SelectField>
      <TextField label="Odometer in (km)" type="number" min="0" value={form.odometerIn} onChange={(event) => setForm({ ...form, odometerIn: event.target.value })} />
      <TextArea className="workflow-form-full" label="Notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
    </div>
  </WorkflowModal>;
}

function CheckoutDispositionModal({ onClose, onSubmit, saving }: {
  saving: boolean; onClose: () => void;
  onSubmit: (form: { dispositionType: DispositionType; customerId: string; odometerOut: string; notes: string }) => void;
}) {
  const [form, setForm] = useState({ dispositionType: "demo" as DispositionType, customerId: "", customerLabel: "", odometerOut: "", notes: "" });
  return <WorkflowModal title="Check out vehicle" eyebrow="Rental / demo disposition" completeLabel="Check out" busy={saving} onClose={onClose} onComplete={() => onSubmit(form)}>
    <div className="workflow-form-grid">
      <SelectField label="Type" value={form.dispositionType} onChange={(event) => setForm({ ...form, dispositionType: event.target.value as DispositionType })}><option value="demo">Demo</option><option value="rental">Rental</option></SelectField>
      <TextField label="Odometer out (km)" type="number" min="0" value={form.odometerOut} onChange={(event) => setForm({ ...form, odometerOut: event.target.value })} />
      <CustomerPicker className="workflow-form-full" label="Customer" selectedId={form.customerId} value={form.customerLabel} onClear={() => setForm({ ...form, customerId: "", customerLabel: "" })} onSelect={(customer: Customer) => setForm({ ...form, customerId: customer.id, customerLabel: customer.displayName })} />
      <TextArea className="workflow-form-full" label="Notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
    </div>
  </WorkflowModal>;
}

function VehicleServiceModal({ onClose, onSubmit, saving }: { saving: boolean; onClose: () => void; onSubmit: (form: { repairOrderNumber: string; advisor: string; complaint: string }) => void }) {
  const [form, setForm] = useState({ repairOrderNumber: `RO-${Math.floor(Math.random() * 90000 + 10000)}`, advisor: "", complaint: "" });
  return <WorkflowModal title="Create workshop booking" eyebrow="Vehicle operations" completeLabel="Confirm booking" busy={saving} onClose={onClose} onComplete={() => onSubmit(form)}>
    <div className="workflow-form-grid">
      <TextField label="Repair order number" value={form.repairOrderNumber} onChange={(event) => setForm({ ...form, repairOrderNumber: event.target.value })} />
      <TextField label="Advisor" value={form.advisor} onChange={(event) => setForm({ ...form, advisor: event.target.value })} />
      <TextArea className="workflow-form-full" label="Work requested" value={form.complaint} onChange={(event) => setForm({ ...form, complaint: event.target.value })} />
    </div>
  </WorkflowModal>;
}
