import { Router } from "express";
import { recordAuditEvent } from "../audit.js";
import {
  createLead, createSalesOrder, deleteLead, getLead360, getSalesOrder360, listLeads, listSalesOrders, updateLead, updateSalesOrder,
} from "../persistence.js";
import { asyncRoute, HttpError } from "../errors.js";
import { authorize, branchScope, resolveWriteBranchId } from "../middleware.js";
import { authorizePermission, CAPABILITIES } from "../permissions.js";
import { completeFollowUp, createFollowUp, createQuotation, createTestDrive, getSalesJourney, salesLinksBelongToOrganization } from "../salesRepository.js";
import { optionalNumber, optionalString, requireEnum, requireNumber, requireString, requireUuid, paginationParams } from "../validate.js";

export const leadsRouter = Router();
export const salesOrdersRouter = Router();

const salesRoles = ["admin", "general_manager", "sales_manager", "bdc_rep", "finance_manager"];
leadsRouter.use(authorize(...salesRoles), authorizePermission(CAPABILITIES.SALES_MANAGE));
salesOrdersRouter.use(authorize(...salesRoles), authorizePermission(CAPABILITIES.SALES_MANAGE));

const LEAD_STAGES = ["new", "qualified", "test-drive", "quoted", "won", "lost"];
const ORDER_STATUSES = ["pending", "financed", "delivered", "cancelled"];

function requireIsoDateTime(value, field) {
  const text = requireString(value, field, { max: 40 });
  if (Number.isNaN(Date.parse(text))) throw new HttpError(400, "INVALID_INPUT", `${field} must be a valid date and time.`, [{ field }]);
  return new Date(text).toISOString();
}

async function requireScopedLinks(request, links) {
  if (!await salesLinksBelongToOrganization(request.auth.organizationId, links)) {
    throw new HttpError(404, "SALES_LINK_NOT_FOUND", "A connected sales record was not found.");
  }
}

function auditSalesMutation(request, action, targetType, targetId, branchId) {
  return recordAuditEvent({
    organizationId: request.auth.organizationId, branchId, actorUserId: request.auth.userId,
    actorRole: request.auth.role, action, method: request.method, path: request.path,
    statusCode: 201, targetType, targetId, requestId: request.requestId,
  });
}

leadsRouter.get("/", asyncRoute(async (request, response) => {
  const stage = optionalString(request.query.stage, 40);
  const { limit, offset } = paginationParams(request.query);
  const leads = await listLeads(request.auth.organizationId, branchScope(request.auth), { stage, limit, offset });
  response.json({ leads });
}));

leadsRouter.post("/", asyncRoute(async (request, response) => {
  const customerId = request.body.customerId ? requireUuid(request.body.customerId, "Customer id") : null;
  const source = requireString(request.body.source, "Source", { min: 2, max: 60 });
  const stage = requireEnum(request.body.stage ?? "new", "Stage", LEAD_STAGES);
  const interestedVehicle = optionalString(request.body.interestedVehicle, 120);
  const assignedTo = optionalString(request.body.assignedTo, 120);
  const expectedValue = optionalNumber(request.body.expectedValue);
  const branchId = resolveWriteBranchId(request.auth, request.body.branchId);
  await requireScopedLinks(request, { branchId, customerId });
  const lead = await createLead(request.auth.organizationId, branchId, { customerId, source, stage, interestedVehicle, assignedTo, expectedValue });
  response.status(201).json({ lead });
}));

leadsRouter.patch("/:id", asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Lead id");
  const stage = request.body.stage ? requireEnum(request.body.stage, "Stage", LEAD_STAGES) : null;
  const assignedTo = optionalString(request.body.assignedTo, 120);
  const expectedValue = optionalNumber(request.body.expectedValue);
  const lead = await updateLead(request.auth.organizationId, id, { stage, assignedTo, expectedValue });
  if (!lead) throw new HttpError(404, "LEAD_NOT_FOUND", "Lead not found.");
  response.json({ lead });
}));

leadsRouter.delete("/:id", asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Lead id");
  const deleted = await deleteLead(request.auth.organizationId, id);
  if (!deleted) throw new HttpError(404, "LEAD_NOT_FOUND", "Lead not found.");
  response.status(204).end();
}));

leadsRouter.get("/:id/360", asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Lead id");
  const lead = await getLead360(request.auth.organizationId, id);
  if (!lead) throw new HttpError(404, "LEAD_NOT_FOUND", "Lead not found.");
  const journey = await getSalesJourney(request.auth.organizationId, id);
  response.json({ lead: { ...lead, ...journey } });
}));

leadsRouter.post("/:id/test-drives", asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Lead id");
  const vehicleId = requireUuid(request.body.vehicleId, "Vehicle id");
  const scheduledAt = requireIsoDateTime(request.body.scheduledAt, "Scheduled time");
  const status = requireEnum(request.body.status ?? "scheduled", "Status", ["scheduled", "completed", "cancelled", "no-show"]);
  const feedback = optionalString(request.body.feedback, 500);
  const branchId = resolveWriteBranchId(request.auth, request.body.branchId);
  await requireScopedLinks(request, { branchId, vehicleId, leadId: id });
  const testDrive = await createTestDrive(request.auth.organizationId, branchId, id, { vehicleId, scheduledAt, status, feedback });
  if (!testDrive) throw new HttpError(404, "LEAD_NOT_FOUND", "Lead not found or has no connected customer.");
  await auditSalesMutation(request, "sales.test-drive.create", "test_drive", testDrive.id, branchId);
  response.status(201).json({ testDrive });
}));

leadsRouter.post("/:id/quotations", asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Lead id");
  const vehicleId = request.body.vehicleId ? requireUuid(request.body.vehicleId, "Vehicle id") : null;
  const amount = requireNumber(request.body.amount, "Amount", { min: 0 });
  const status = requireEnum(request.body.status ?? "draft", "Status", ["draft", "sent", "accepted", "declined", "expired"]);
  const validUntil = optionalString(request.body.validUntil, 20);
  const branchId = resolveWriteBranchId(request.auth, request.body.branchId);
  await requireScopedLinks(request, { branchId, vehicleId, leadId: id });
  const quotation = await createQuotation(request.auth.organizationId, branchId, id, { vehicleId, amount, status, validUntil });
  if (!quotation) throw new HttpError(404, "LEAD_NOT_FOUND", "Lead not found.");
  await auditSalesMutation(request, "sales.quotation.create", "sales_quotation", quotation.id, branchId);
  response.status(201).json({ quotation });
}));

leadsRouter.post("/:id/follow-ups", asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Lead id");
  const channel = requireEnum(request.body.channel, "Channel", ["call", "email", "sms", "whatsapp", "in-person"]);
  const summary = requireString(request.body.summary, "Summary", { min: 2, max: 500 });
  const dueAt = requireIsoDateTime(request.body.dueAt, "Due time");
  const branchId = resolveWriteBranchId(request.auth, request.body.branchId);
  await requireScopedLinks(request, { branchId, leadId: id });
  const followUp = await createFollowUp(request.auth.organizationId, branchId, request.auth.userId, id, { channel, summary, dueAt });
  if (!followUp) throw new HttpError(404, "LEAD_NOT_FOUND", "Lead not found.");
  await auditSalesMutation(request, "sales.follow-up.create", "sales_follow_up", followUp.id, branchId);
  response.status(201).json({ followUp });
}));

leadsRouter.patch("/:id/follow-ups/:followUpId", asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Lead id");
  const followUpId = requireUuid(request.params.followUpId, "Follow-up id");
  if (request.body.completed !== true) throw new HttpError(400, "INVALID_INPUT", "Completed must be true.", [{ field: "completed" }]);
  const followUp = await completeFollowUp(request.auth.organizationId, id, followUpId);
  if (!followUp) throw new HttpError(404, "FOLLOW_UP_NOT_FOUND", "Follow-up not found.");
  await auditSalesMutation(request, "sales.follow-up.complete", "sales_follow_up", followUp.id, request.auth.branchId);
  response.json({ followUp });
}));

salesOrdersRouter.get("/", asyncRoute(async (request, response) => {
  const status = optionalString(request.query.status, 40);
  const customerId = request.query.customerId ? requireUuid(request.query.customerId, "Customer id") : null;
  const { limit, offset } = paginationParams(request.query);
  const orders = await listSalesOrders(request.auth.organizationId, branchScope(request.auth), { status, customerId, limit, offset });
  response.json({ salesOrders: orders });
}));

salesOrdersRouter.post("/", asyncRoute(async (request, response) => {
  const customerId = requireUuid(request.body.customerId, "Customer id");
  const vehicleId = requireUuid(request.body.vehicleId, "Vehicle id");
  const leadId = request.body.leadId ? requireUuid(request.body.leadId, "Lead id") : null;
  const status = requireEnum(request.body.status ?? "pending", "Status", ORDER_STATUSES);
  const totalAmount = requireNumber(request.body.totalAmount, "Total amount", { min: 0 });
  const branchId = resolveWriteBranchId(request.auth, request.body.branchId);
  await requireScopedLinks(request, { branchId, customerId, vehicleId, leadId });
  const salesOrder = await createSalesOrder(request.auth.organizationId, branchId, { customerId, vehicleId, leadId, status, totalAmount });
  response.status(201).json({ salesOrder });
}));

salesOrdersRouter.patch("/:id", asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Sales order id");
  const status = request.body.status ? requireEnum(request.body.status, "Status", ORDER_STATUSES) : null;
  const deliveredAt = request.body.deliveredAt ?? null;
  const salesOrder = await updateSalesOrder(request.auth.organizationId, id, { status, deliveredAt });
  if (!salesOrder) throw new HttpError(404, "SALES_ORDER_NOT_FOUND", "Sales order not found.");
  response.json({ salesOrder });
}));

salesOrdersRouter.get("/:id/360", asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Sales order id");
  const salesOrder = await getSalesOrder360(request.auth.organizationId, id);
  if (!salesOrder) throw new HttpError(404, "SALES_ORDER_NOT_FOUND", "Sales order not found.");
  response.json({ salesOrder });
}));
