export type AppView = "landing" | "login" | "signup" | "dashboard";

// The six primary portals, and nothing else, make up the primary sidebar. Each is a full
// 360-style hub with its own dashboard, directory, detail pages, and workflows.
// docs/six-portal-workspace-plan.md is the authoritative information architecture - read it
// before adding, renaming, or reordering anything in this union.
export type PortalId =
  | "customers"
  | "vehicles"
  | "sales"
  | "finance"
  | "marketing"
  | "analytics";

// Sub-areas that live *inside* a portal, reached from its contextual sidebar and internal tab
// shell rather than from the primary sidebar. Vehicle 360 owns service/parts/usedcars (workshop,
// parts, and the used/reconditioning/auction disposition workflow); Analytics 360 owns
// branch/group/workforce (the reporting slice only - managing people is Administration).
// The retired `overview` view is now Analytics 360's core area, and `inventory` folded into
// Vehicle 360's core area, so neither needs an id of its own any more.
export type PortalArea =
  | "service"
  | "parts"
  | "usedcars"
  | "branch"
  | "group"
  | "workforce";

// Administration is deliberately not a seventh portal: internal employees, partners, roles,
// permissions, branch/org settings, and audit history are reached from the account menu.
export type AdminView = "company";

// Every routable workspace id. Sub-area ids are unchanged from the pre-consolidation union, so
// existing ?workspace= deep links keep resolving - they now open the owning portal with that
// sub-area active instead of a top-level page of its own.
export type DashView = PortalId | PortalArea | AdminView;

export type Role = "admin" | "general_manager" | "sales_manager" | "bdc_rep" | "finance_manager" | "service_advisor" | "receptionist";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  organizationId: string;
  branchId: string | null;
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
};

export type Branch = {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  city: string | null;
};

export type UserAccount = {
  id: string;
  organizationId: string;
  branchId: string | null;
  branchName?: string | null;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
};

export type TimelineEvent = { occurredAt: string; type: string; summary: string };

export type Customer = {
  id: string;
  displayName: string;
  customerType: "individual" | "company";
  mobile: string | null;
  email: string | null;
  preferredChannel: string | null;
  address: string | null;
  lifetimeValue: number;
  customerSince: string;
};

export type Customer360 = Customer & {
  vehicles: Array<{
    id?: string;
    make: string;
    model: string;
    variant: string | null;
    vin: string;
    registration?: string | null;
  }>;
  timeline: TimelineEvent[];
  serviceVisitCount: number;
};

export type Vehicle = {
  id: string;
  vin: string;
  registration: string | null;
  make: string;
  model: string;
  variant: string | null;
  colour: string | null;
  modelYear: number | null;
  odometerKm: number | null;
  marketValue: number | null;
  status: string;
};

export type AcquisitionChannel = "trade-in" | "auction-purchase" | "direct-purchase" | "consignment";

export type Vehicle360 = Vehicle & {
  ownerId?: string;
  ownerName?: string | null;
  ownerMobile?: string | null;
  timeline: TimelineEvent[];
  branchId?: string | null;
  branchName?: string | null;
  lotLocation?: string | null;
  acquisitionChannel?: AcquisitionChannel | null;
  acquisitionCost?: number | null;
  intakeAt?: string | null;
};

// Vehicle 360 core relationship and disposition records. See
// database/021_vehicle_360_core.sql and apps/api/src/routes/vehicles.js.
export type VehicleOwnershipEntry = {
  id: string;
  vehicleId: string;
  customerId: string;
  customerName: string;
  customerMobile?: string | null;
  startedOn: string;
  endedOn: string | null;
  isPrimary: boolean;
  transferReason: string | null;
};

export type VehicleDocumentStatus = "requested" | "received" | "verified" | "rejected";

// Metadata and a storage reference only - no file bytes travel through this type.
export type VehicleDocument = {
  id: string;
  vehicleId: string;
  documentType: string;
  label: string;
  status: VehicleDocumentStatus;
  storageReference: string | null;
  uploadedBy: string | null;
  createdAt: string;
};

export type ConditionGrade = "excellent" | "good" | "fair" | "poor";
export type AppraisalStatus = "draft" | "offered" | "accepted" | "declined" | "expired";

export type VehicleAppraisal = {
  id: string;
  vehicleId: string;
  customerId: string | null;
  customerName?: string | null;
  conditionGrade: ConditionGrade;
  odometerKm: number | null;
  exteriorNotes: string | null;
  mechanicalNotes: string | null;
  offeredValue: number | null;
  status: AppraisalStatus;
  createdAt: string;
  decidedAt: string | null;
};

export type ValuationSource = "market" | "trade" | "wholesale" | "manual";

export type VehicleValuation = {
  id: string;
  vehicleId: string;
  source: ValuationSource;
  value: number;
  notes: string | null;
  valuedAt: string;
  createdBy: string | null;
};

export type AuctionListingStatus = "draft" | "listed" | "bidding" | "sold" | "unsold" | "cancelled";

export type VehicleAuctionBid = {
  id: string;
  listingId: string;
  bidderName: string;
  amount: number;
  placedAt: string;
};

export type VehicleAuctionListing = {
  id: string;
  vehicleId: string;
  status: AuctionListingStatus;
  auctionHouse: string | null;
  reservePrice: number | null;
  listedAt: string | null;
  closesAt: string | null;
  soldPrice: number | null;
  buyerNote: string | null;
  createdAt: string;
  bids: VehicleAuctionBid[];
};

export type UsedVehicleStock = {
  vehicleId: string; vin: string; registration: string | null; make: string; model: string; variant: string | null;
  vehicleStatus: string; acquisitionChannel: AcquisitionChannel | null; acquisitionCost: number | null; intakeAt: string;
  lotLocation: string | null; branchName: string | null; inspectionStatus: string | null; inspectionGrade: ConditionGrade | null;
  inspectionNotes: string | null; inspectedAt: string | null; reconStatus: string; askingPrice: number | null;
  disposalChannel: string | null; wholesaleBuyer: string | null; wholesalePrice: number | null; stockAgeDays: number;
  reconCost: number; openReconTasks: number;
};

export type ReconTask = {
  id: string; vehicleId: string; category: string; description: string; supplier: string | null;
  estimatedCost: number; actualCost: number | null; status: string; dueAt: string | null; completedAt?: string | null; createdAt: string;
};

export type DispositionType = "rental" | "demo";
export type DispositionStatus = "active" | "completed" | "cancelled";

export type VehicleDisposition = {
  id: string;
  vehicleId: string;
  dispositionType: DispositionType;
  customerId: string | null;
  customerName?: string | null;
  startsAt: string;
  endsAt: string | null;
  status: DispositionStatus;
  odometerOut: number | null;
  odometerIn: number | null;
  notes: string | null;
  createdAt: string;
};

export type Lead = {
  id: string;
  branchId: string | null;
  customerId: string | null;
  customerName: string | null;
  source: string;
  stage: string;
  interestedVehicle: string | null;
  assignedTo: string | null;
  expectedValue: number | null;
  createdAt: string;
};

export type TestDrive = {
  id: string;
  vehicleId: string | null;
  scheduledAt: string;
  status: string;
  feedback: string | null;
};

export type Lead360 = Lead & {
  customerMobile: string | null;
  customerEmail: string | null;
  testDrives: TestDrive[];
  salesOrder: { id: string; status: string; totalAmount: number; orderedAt: string; deliveredAt: string | null } | null;
};

export type SalesOrder = {
  id: string;
  branchId: string | null;
  customerId: string;
  customerName: string;
  vehicleId: string;
  make: string;
  model: string;
  leadId: string | null;
  status: string;
  totalAmount: number;
  orderedAt: string;
  deliveredAt: string | null;
};

export type SalesOrder360 = {
  id: string;
  branchId: string | null;
  status: string;
  totalAmount: number;
  orderedAt: string;
  deliveredAt: string | null;
  leadId: string | null;
  customerId: string;
  customerName: string;
  customerMobile: string | null;
  customerEmail: string | null;
  vehicleId: string;
  vin: string;
  registration: string | null;
  make: string;
  model: string;
  variant: string | null;
  financeContract: FinanceContract | null;
  insurancePolicies: InsurancePolicy[];
};

export type ServiceJob = {
  id: string;
  branchId: string | null;
  customerId: string;
  customerName: string;
  vehicleId: string;
  make: string;
  model: string;
  repairOrderNumber: string;
  status: string;
  advisor: string | null;
  technician: string | null;
  complaint: string | null;
  labourTotal: number;
  partsTotal: number;
  openedAt: string;
  promisedAt: string | null;
  closedAt: string | null;
};

export type ServiceJob360 = ServiceJob & {
  customerMobile: string | null;
  customerEmail: string | null;
  vin: string;
  registration: string | null;
  variant: string | null;
  odometerKm: number | null;
};

export type Part = {
  id: string;
  sku: string;
  name: string;
  quantityOnHand: number;
  reorderPoint: number;
  unitCost: number;
  retailPrice: number;
};

export type FinanceContract = {
  id: string;
  salesOrderId: string;
  provider: string;
  productType: string;
  amountFinanced: number;
  status: string;
  commission: number;
  customerName: string;
};

export type InsurancePolicy = {
  id: string;
  customerId: string;
  customerName: string;
  vehicleId: string;
  provider: string;
  policyNumber: string;
  status: string;
  startsOn: string;
  expiresOn: string;
  premium: number | null;
};

export type Communication = {
  id: string;
  customerId: string;
  channel: string;
  direction: string;
  subject: string | null;
  summary: string;
  occurredAt: string;
};

// Customer 360 relationship records: notes, tasks, consent, and documents. See
// database/013_customer_relationship_records.sql and apps/api/src/routes/customers.js.
export type CustomerNote = {
  id: string;
  customerId: string;
  body: string;
  createdAt: string;
  authorUserId: string | null;
  authorName?: string | null;
};

export type TaskStatus = "open" | "done" | "cancelled";

export type CustomerTask = {
  id: string;
  customerId: string;
  title: string;
  assignedTo: string | null;
  dueAt: string | null;
  status: TaskStatus;
  createdAt: string;
  completedAt: string | null;
};

export type ConsentChannel = "call" | "whatsapp" | "email" | "sms";
export type ConsentStatus = "opted_in" | "opted_out" | "unknown";

// The current state for one channel. `unknown` means no decision has ever been recorded - never
// treat that as either opted in or opted out.
export type CustomerConsentEntry = {
  channel: ConsentChannel;
  status: ConsentStatus;
  source: string | null;
  recordedAt: string | null;
  recordedBy?: string | null;
};

export type DocumentStatus = "requested" | "received" | "verified" | "rejected";

// Metadata and a storage reference only - no file bytes travel through this type. See
// database/013_customer_relationship_records.sql.
export type CustomerDocument = {
  id: string;
  customerId: string;
  documentType: string;
  label: string;
  status: DocumentStatus;
  storageReference: string | null;
  uploadedBy: string | null;
  createdAt: string;
};

export type Overview = {
  openLeads: number;
  unitsSoldMtd: number;
  activeServiceJobs: number;
  lowStockParts: number;
  revenueMtd: number;
};
