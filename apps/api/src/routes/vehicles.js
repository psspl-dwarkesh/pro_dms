import { Router } from "express";
import { createVehicle, deleteVehicle, getVehicle360, listVehicles, updateVehicle } from "../db.js";
import { asyncRoute, HttpError } from "../errors.js";
import { optionalNumber, optionalString, requireString, requireUuid, paginationParams } from "../validate.js";

export const vehiclesRouter = Router();

const STOCK_STATUSES = ["active", "customer-owned", "in-stock", "demo", "reserved", "sold"];

vehiclesRouter.get("/", asyncRoute(async (request, response) => {
  const search = optionalString(request.query.q, 120);
  const status = optionalString(request.query.status, 40);
  const { limit, offset } = paginationParams(request.query);
  const vehicles = await listVehicles(request.auth.organizationId, { search, status, limit, offset });
  response.json({ vehicles });
}));

vehiclesRouter.post("/", asyncRoute(async (request, response) => {
  const vin = requireString(request.body.vin, "VIN", { min: 5, max: 32 }).toUpperCase();
  const make = requireString(request.body.make, "Make", { min: 1, max: 60 });
  const model = requireString(request.body.model, "Model", { min: 1, max: 60 });
  const registration = optionalString(request.body.registration, 20);
  const variant = optionalString(request.body.variant, 60);
  const colour = optionalString(request.body.colour, 40);
  const modelYear = optionalNumber(request.body.modelYear);
  const odometerKm = optionalNumber(request.body.odometerKm);
  const marketValue = optionalNumber(request.body.marketValue);
  const status = request.body.status ? requireString(request.body.status, "Status", { min: 1, max: 40 }) : "active";
  const vehicle = await createVehicle(request.auth.organizationId, { vin, registration, make, model, variant, colour, modelYear, odometerKm, marketValue, status });
  response.status(201).json({ vehicle });
}));

vehiclesRouter.get("/:id/360", asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Vehicle id");
  const vehicle = await getVehicle360(request.auth.organizationId, id);
  if (!vehicle) throw new HttpError(404, "VEHICLE_NOT_FOUND", "Vehicle not found.");
  response.json({ vehicle });
}));

vehiclesRouter.patch("/:id", asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Vehicle id");
  const registration = optionalString(request.body.registration, 20);
  const colour = optionalString(request.body.colour, 40);
  const odometerKm = optionalNumber(request.body.odometerKm);
  const marketValue = optionalNumber(request.body.marketValue);
  const status = request.body.status ? requireString(request.body.status, "Status", { min: 1, max: 40 }) : null;
  const vehicle = await updateVehicle(request.auth.organizationId, id, { registration, colour, odometerKm, marketValue, status });
  if (!vehicle) throw new HttpError(404, "VEHICLE_NOT_FOUND", "Vehicle not found.");
  response.json({ vehicle });
}));

vehiclesRouter.delete("/:id", asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Vehicle id");
  const deleted = await deleteVehicle(request.auth.organizationId, id);
  if (!deleted) throw new HttpError(404, "VEHICLE_NOT_FOUND", "Vehicle not found.");
  response.status(204).end();
}));

export { STOCK_STATUSES };
