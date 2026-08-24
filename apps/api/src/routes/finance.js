import { Router } from "express";
import {
  createFinanceContract, createInsurancePolicy, listFinanceContracts, listInsurancePolicies,
  updateFinanceContract, updateInsurancePolicy,
} from "../db.js";
import { asyncRoute, HttpError } from "../errors.js";
import { recordAuditEvent } from "../audit.js";
import { createApplication, createApplicationDocument, createPayable, financeWorkspace, transitionApplication, transitionApplicationDocument, transitionPayable } from "../financeRepository.js";
import { branchScope } from "../middleware.js";
import { authorizePermission, CAPABILITIES } from "../permissions.js";
import { optionalNumber, requireEnum, requireNumber, requireString, requireUuid, paginationParams } from "../validate.js";

export const financeContractsRouter = Router();
export const insurancePoliciesRouter = Router();
export const financeWorkspaceRouter = Router();

const CONTRACT_STATUSES = ["submitted", "approved", "declined", "settled"];
const POLICY_STATUSES = ["quoted", "active", "lapsed", "cancelled"];
const APPLICATION_STATUSES = ["documents_pending", "submitted", "approved", "declined", "contracted", "paid_out"];
const PAYABLE_STATUSES = ["pending_approval", "approved", "scheduled", "paid", "disputed", "void"];
const DOCUMENT_STATUSES = ["requested", "received", "verified", "rejected"];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function requireIsoDate(value, field) {
  const date = requireString(value, field, { min: 10, max: 10 });
  if (!ISO_DATE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    throw new HttpError(400, "INVALID_INPUT", `${field} must be a valid ISO date.`, [{ field }]);
  }
  return date;
}

financeContractsRouter.use(authorizePermission(CAPABILITIES.FINANCE_SENSITIVE_READ));
insurancePoliciesRouter.use(authorizePermission(CAPABILITIES.FINANCE_SENSITIVE_READ));

financeWorkspaceRouter.use(authorizePermission(CAPABILITIES.FINANCE_SENSITIVE_READ));

financeWorkspaceRouter.get("/", asyncRoute(async (request, response) => {
  const { limit } = paginationParams(request.query, { defaultLimit: 50, maxLimit: 100 });
  response.json({ finance: await financeWorkspace(request.auth.organizationId, branchScope(request.auth), limit) });
}));

financeWorkspaceRouter.post("/applications", authorizePermission(CAPABILITIES.FINANCE_MANAGE), asyncRoute(async (request, response) => {
  const application = await createApplication(request.auth, {
    salesOrderId: request.body.salesOrderId ? requireUuid(request.body.salesOrderId, "Sales order id") : null,
    applicantName: requireString(request.body.applicantName, "Applicant name", { min: 2, max: 160 }),
    lender: requireString(request.body.lender, "Lender", { min: 2, max: 120 }),
    requestedAmount: requireNumber(request.body.requestedAmount, "Requested amount", { min: 0 }),
    assignedTo: requireString(request.body.assignedTo, "Owner", { min: 2, max: 120 }),
  });
  response.status(201);
  await auditFinance(request, response, "finance.application.create", "finance_application", application.id);
  response.json({ application });
}));

financeWorkspaceRouter.patch("/applications/:id", authorizePermission(CAPABILITIES.FINANCE_MANAGE), asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Application id");
  const status = requireEnum(request.body.status, "Status", APPLICATION_STATUSES);
  const application = await transitionApplication(request.auth, id, {
    status,
    decisionNote: request.body.decisionNote ? requireString(request.body.decisionNote, "Decision note", { max: 1000 }) : null,
    payoutReference: request.body.payoutReference ? requireString(request.body.payoutReference, "Payout reference", { max: 120 }) : null,
  });
  if (!application) throw new HttpError(404, "FINANCE_APPLICATION_NOT_FOUND", "Finance application not found.");
  await auditFinance(request, response, `finance.application.${status}`, "finance_application", id);
  response.json({ application });
}));

financeWorkspaceRouter.post("/applications/:id/documents", authorizePermission(CAPABILITIES.FINANCE_MANAGE), asyncRoute(async (request, response) => {
  const applicationId = requireUuid(request.params.id, "Application id");
  const document = await createApplicationDocument(request.auth, applicationId, requireString(request.body.documentType, "Document type", { min: 2, max: 120 }));
  if (!document) throw new HttpError(404, "FINANCE_APPLICATION_NOT_FOUND", "Finance application not found.");
  response.status(201);
  await auditFinance(request, response, "finance.document.request", "finance_application_document", document.id);
  response.json({ document });
}));

financeWorkspaceRouter.patch("/documents/:id", authorizePermission(CAPABILITIES.FINANCE_MANAGE), asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Document id");
  const status = requireEnum(request.body.status, "Status", DOCUMENT_STATUSES);
  const document = await transitionApplicationDocument(request.auth, id, status);
  if (!document) throw new HttpError(404, "FINANCE_DOCUMENT_NOT_FOUND", "Finance document not found.");
  await auditFinance(request, response, `finance.document.${status}`, "finance_application_document", id);
  response.json({ document });
}));

financeWorkspaceRouter.post("/payables", authorizePermission(CAPABILITIES.FINANCE_MANAGE), asyncRoute(async (request, response) => {
  const payable = await createPayable(request.auth, {
    supplierName: requireString(request.body.supplierName, "Supplier", { min: 2, max: 160 }),
    invoiceNumber: requireString(request.body.invoiceNumber, "Invoice number", { min: 1, max: 80 }),
    description: request.body.description ? requireString(request.body.description, "Description", { max: 500 }) : null,
    amount: requireNumber(request.body.amount, "Amount", { min: 0 }),
    currency: requireEnum(request.body.currency ?? "AUD", "Currency", ["AUD", "INR", "USD", "NZD"]),
    dueOn: requireIsoDate(request.body.dueOn, "Due date"),
    assignedTo: requireString(request.body.assignedTo, "Owner", { min: 2, max: 120 }),
  });
  response.status(201);
  await auditFinance(request, response, "finance.payable.create", "finance_payable", payable.id);
  response.json({ payable });
}));

financeWorkspaceRouter.patch("/payables/:id", authorizePermission(CAPABILITIES.FINANCE_MANAGE), asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Payable id");
  const status = requireEnum(request.body.status, "Status", PAYABLE_STATUSES);
  const payable = await transitionPayable(request.auth, id, status);
  if (!payable) throw new HttpError(404, "FINANCE_PAYABLE_NOT_FOUND", "Payable not found.");
  await auditFinance(request, response, `finance.payable.${status}`, "finance_payable", id);
  response.json({ payable });
}));

async function auditFinance(request, response, action, targetType, targetId) {
  await recordAuditEvent({ organizationId: request.auth.organizationId, branchId: request.auth.branchId, actorUserId: request.auth.userId,
    actorRole: request.auth.role, action, method: request.method, path: request.path, statusCode: response.statusCode, targetType, targetId, requestId: request.requestId });
}

financeContractsRouter.get("/", asyncRoute(async (request, response) => {
  const { limit, offset } = paginationParams(request.query);
  const financeContracts = await listFinanceContracts(request.auth.organizationId, { limit, offset });
  response.json({ financeContracts });
}));

financeContractsRouter.post("/", authorizePermission(CAPABILITIES.FINANCE_MANAGE), asyncRoute(async (request, response) => {
  const salesOrderId = requireUuid(request.body.salesOrderId, "Sales order id");
  const provider = requireString(request.body.provider, "Provider", { min: 2, max: 120 });
  const productType = requireString(request.body.productType, "Product type", { min: 2, max: 60 });
  const amountFinanced = requireNumber(request.body.amountFinanced, "Amount financed", { min: 0 });
  const status = requireEnum(request.body.status ?? "submitted", "Status", CONTRACT_STATUSES);
  const financeContract = await createFinanceContract(request.auth.organizationId, { salesOrderId, provider, productType, amountFinanced, status });
  response.status(201).json({ financeContract });
}));

financeContractsRouter.patch("/:id", authorizePermission(CAPABILITIES.FINANCE_MANAGE), asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Finance contract id");
  const status = request.body.status ? requireEnum(request.body.status, "Status", CONTRACT_STATUSES) : null;
  const commission = optionalNumber(request.body.commission);
  const financeContract = await updateFinanceContract(request.auth.organizationId, id, { status, commission });
  if (!financeContract) throw new HttpError(404, "FINANCE_CONTRACT_NOT_FOUND", "Finance contract not found.");
  response.json({ financeContract });
}));

insurancePoliciesRouter.get("/", asyncRoute(async (request, response) => {
  const { limit, offset } = paginationParams(request.query);
  const insurancePolicies = await listInsurancePolicies(request.auth.organizationId, { limit, offset });
  response.json({ insurancePolicies });
}));

insurancePoliciesRouter.post("/", authorizePermission(CAPABILITIES.FINANCE_MANAGE), asyncRoute(async (request, response) => {
  const customerId = requireUuid(request.body.customerId, "Customer id");
  const vehicleId = requireUuid(request.body.vehicleId, "Vehicle id");
  const provider = requireString(request.body.provider, "Provider", { min: 2, max: 120 });
  const policyNumber = requireString(request.body.policyNumber, "Policy number", { min: 2, max: 60 });
  const status = requireEnum(request.body.status ?? "quoted", "Status", POLICY_STATUSES);
  const startsOn = requireString(request.body.startsOn, "Start date", { min: 8, max: 20 });
  const expiresOn = requireString(request.body.expiresOn, "Expiry date", { min: 8, max: 20 });
  const premium = optionalNumber(request.body.premium);
  const insurancePolicy = await createInsurancePolicy(request.auth.organizationId, { customerId, vehicleId, provider, policyNumber, status, startsOn, expiresOn, premium });
  response.status(201).json({ insurancePolicy });
}));

insurancePoliciesRouter.patch("/:id", authorizePermission(CAPABILITIES.FINANCE_MANAGE), asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Insurance policy id");
  const status = request.body.status ? requireEnum(request.body.status, "Status", POLICY_STATUSES) : null;
  const premium = optionalNumber(request.body.premium);
  const insurancePolicy = await updateInsurancePolicy(request.auth.organizationId, id, { status, premium });
  if (!insurancePolicy) throw new HttpError(404, "INSURANCE_POLICY_NOT_FOUND", "Insurance policy not found.");
  response.json({ insurancePolicy });
}));
