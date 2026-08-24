import { Router } from "express";
import { deletePart, listParts, updatePart } from "../persistence.js";
import { asyncRoute, HttpError } from "../errors.js";
import { authorizePermission, CAPABILITIES } from "../permissions.js";
import { createCataloguePart, createPurchaseOrder, createReservation, createTransfer, getPartsWorkspace, receivePurchaseOrder, receiveTransfer, updateReservation } from "../partsRepository.js";
import { optionalIsoDateTime, optionalNumber, optionalString, requireEnum, requireNumber, requireString, requireUuid, paginationParams } from "../validate.js";

export const partsRouter = Router();

partsRouter.use(authorizePermission(CAPABILITIES.PARTS_MANAGE));

partsRouter.get("/", asyncRoute(async (request, response) => {
  const search = optionalString(request.query.q, 120);
  const lowStock = request.query.lowStock === "true";
  const { limit, offset } = paginationParams(request.query);
  const parts = await listParts(request.auth.organizationId, { search, lowStock, limit, offset });
  response.json({ parts });
}));

partsRouter.get("/workspace", asyncRoute(async (request, response) => {
  const search = optionalString(request.query.q, 120);
  const lowStock = request.query.lowStock === "true";
  const { limit, offset } = paginationParams(request.query);
  const workspace = await getPartsWorkspace(request.auth.organizationId, request.auth.branchId, { search, lowStock, limit, offset });
  response.json({ workspace });
}));

partsRouter.post("/reservations", asyncRoute(async (request, response) => {
  const partId = requireUuid(request.body.partId, "Part id");
  const vehicleId = request.body.vehicleId ? requireUuid(request.body.vehicleId, "Vehicle id") : null;
  const serviceJobId = request.body.serviceJobId ? requireUuid(request.body.serviceJobId, "Repair order id") : null;
  if (!vehicleId && !serviceJobId) throw new HttpError(400, "INVALID_INPUT", "Choose a vehicle or repair order for the reservation.", [{ field: "vehicleId" }]);
  const quantity = requireNumber(request.body.quantity, "Quantity", { min: 1 });
  const notes = optionalString(request.body.notes, 500);
  const reservation = await createReservation(request.auth.organizationId, request.auth.branchId, request.auth.userId, { partId, vehicleId, serviceJobId, quantity, notes });
  response.status(201).json({ reservation });
}));

partsRouter.patch("/reservations/:id", asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Reservation id");
  const status = requireEnum(request.body.status, "Status", ["allocated", "released", "cancelled"]);
  const reservation = await updateReservation(request.auth.organizationId, request.auth.branchId, id, status, request.auth.userId);
  if (!reservation) throw new HttpError(404, "PART_RESERVATION_NOT_FOUND", "Part reservation not found.");
  response.json({ reservation });
}));

partsRouter.post("/purchase-orders", asyncRoute(async (request, response) => {
  const input = { partId: requireUuid(request.body.partId, "Part id"), orderNumber: requireString(request.body.orderNumber, "Order number", { min: 2, max: 60 }), supplierName: requireString(request.body.supplierName, "Supplier", { min: 2, max: 160 }), quantity: requireNumber(request.body.quantity, "Quantity", { min: 1 }), unitCost: requireNumber(request.body.unitCost, "Unit cost", { min: 0 }), expectedAt: optionalIsoDateTime(request.body.expectedAt, "Expected date") };
  const purchaseOrder = await createPurchaseOrder(request.auth.organizationId, request.auth.branchId, request.auth.userId, input);
  response.status(201).json({ purchaseOrder });
}));

partsRouter.post("/purchase-orders/:id/receive", asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Purchase order id");
  const purchaseOrder = await receivePurchaseOrder(request.auth.organizationId, request.auth.branchId, id, request.auth.userId);
  if (!purchaseOrder) throw new HttpError(404, "PURCHASE_ORDER_NOT_FOUND", "Purchase order not found.");
  response.json({ purchaseOrder });
}));

partsRouter.post("/transfers", asyncRoute(async (request, response) => {
  const input = { partId: requireUuid(request.body.partId, "Part id"), fromBranchId: requireUuid(request.body.fromBranchId, "Source branch id"), toBranchId: requireUuid(request.body.toBranchId, "Destination branch id"), quantity: requireNumber(request.body.quantity, "Quantity", { min: 1 }) };
  if (input.fromBranchId === input.toBranchId) throw new HttpError(400, "INVALID_INPUT", "Source and destination branches must differ.", [{ field: "toBranchId" }]);
  const transfer = await createTransfer(request.auth.organizationId, request.auth.userId, input);
  response.status(201).json({ transfer });
}));

partsRouter.post("/transfers/:id/receive", asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Transfer id");
  const transfer = await receiveTransfer(request.auth.organizationId, request.auth.branchId, id, request.auth.userId);
  if (!transfer) throw new HttpError(404, "PART_TRANSFER_NOT_FOUND", "Part transfer not found.");
  response.json({ transfer });
}));

partsRouter.post("/", asyncRoute(async (request, response) => {
  const sku = requireString(request.body.sku, "SKU", { min: 2, max: 60 });
  const name = requireString(request.body.name, "Part name", { min: 2, max: 160 });
  const quantityOnHand = requireNumber(request.body.quantityOnHand ?? 0, "Quantity on hand", { min: 0 });
  const reorderPoint = requireNumber(request.body.reorderPoint ?? 0, "Reorder point", { min: 0 });
  const unitCost = requireNumber(request.body.unitCost ?? 0, "Unit cost", { min: 0 });
  const retailPrice = requireNumber(request.body.retailPrice ?? 0, "Retail price", { min: 0 });
  const part = await createCataloguePart(request.auth.organizationId, request.auth.branchId, { sku, name, quantityOnHand, reorderPoint, unitCost, retailPrice });
  response.status(201).json({ part });
}));

partsRouter.patch("/:id", asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Part id");
  const quantityOnHand = optionalNumber(request.body.quantityOnHand);
  const reorderPoint = optionalNumber(request.body.reorderPoint);
  const unitCost = optionalNumber(request.body.unitCost);
  const retailPrice = optionalNumber(request.body.retailPrice);
  const part = await updatePart(request.auth.organizationId, id, { quantityOnHand, reorderPoint, unitCost, retailPrice });
  if (!part) throw new HttpError(404, "PART_NOT_FOUND", "Part not found.");
  response.json({ part });
}));

partsRouter.delete("/:id", asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Part id");
  const deleted = await deletePart(request.auth.organizationId, id);
  if (!deleted) throw new HttpError(404, "PART_NOT_FOUND", "Part not found.");
  response.status(204).end();
}));
