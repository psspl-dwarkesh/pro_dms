import { Router } from "express";
import {
  createLead, createSalesOrder, deleteLead, listLeads, listSalesOrders, updateLead, updateSalesOrder,
} from "../db.js";
import { asyncRoute, HttpError } from "../errors.js";
import { branchScope, resolveWriteBranchId } from "../middleware.js";
import { optionalNumber, optionalString, requireEnum, requireNumber, requireString, requireUuid, paginationParams } from "../validate.js";

export const leadsRouter = Router();
export const salesOrdersRouter = Router();

const LEAD_STAGES = ["new", "qualified", "test-drive", "quoted", "won", "lost"];
const ORDER_STATUSES = ["pending", "financed", "delivered", "cancelled"];

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
  const status = requireEnum(request.body.status ?? "pending", "Status", ORDER_STATUSES);
  const totalAmount = requireNumber(request.body.totalAmount, "Total amount", { min: 0 });
  const branchId = resolveWriteBranchId(request.auth, request.body.branchId);
  const salesOrder = await createSalesOrder(request.auth.organizationId, branchId, { customerId, vehicleId, status, totalAmount });
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
