import { Router } from "express";
import { createPart, deletePart, listParts, updatePart } from "../db.js";
import { asyncRoute, HttpError } from "../errors.js";
import { optionalNumber, optionalString, requireNumber, requireString, requireUuid, paginationParams } from "../validate.js";

export const partsRouter = Router();

partsRouter.get("/", asyncRoute(async (request, response) => {
  const search = optionalString(request.query.q, 120);
  const lowStock = request.query.lowStock === "true";
  const { limit, offset } = paginationParams(request.query);
  const parts = await listParts(request.auth.organizationId, { search, lowStock, limit, offset });
  response.json({ parts });
}));

partsRouter.post("/", asyncRoute(async (request, response) => {
  const sku = requireString(request.body.sku, "SKU", { min: 2, max: 60 });
  const name = requireString(request.body.name, "Part name", { min: 2, max: 160 });
  const quantityOnHand = requireNumber(request.body.quantityOnHand ?? 0, "Quantity on hand", { min: 0 });
  const reorderPoint = requireNumber(request.body.reorderPoint ?? 0, "Reorder point", { min: 0 });
  const unitCost = requireNumber(request.body.unitCost ?? 0, "Unit cost", { min: 0 });
  const retailPrice = requireNumber(request.body.retailPrice ?? 0, "Retail price", { min: 0 });
  const part = await createPart(request.auth.organizationId, { sku, name, quantityOnHand, reorderPoint, unitCost, retailPrice });
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
