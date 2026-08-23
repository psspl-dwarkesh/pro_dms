export type AppView = "landing" | "login" | "signup" | "dashboard";

export type DashView =
  | "overview"
  | "sales"
  | "service"
  | "parts"
  | "finance"
  | "vehicles"
  | "customers"
  | "marketing"
  | "usedcars"
  | "inventory"
  | "branch"
  | "group"
  | "workforce"
  | "company";

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

export type Vehicle360 = Vehicle & {
  ownerId?: string;
  ownerName?: string | null;
  ownerMobile?: string | null;
  timeline: TimelineEvent[];
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

export type Overview = {
  openLeads: number;
  unitsSoldMtd: number;
  activeServiceJobs: number;
  lowStockParts: number;
  revenueMtd: number;
};
