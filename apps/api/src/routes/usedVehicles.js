import { Router } from "express";
import { asyncRoute, HttpError } from "../errors.js";
import { optionalIsoDateTime, optionalNumber, optionalString, paginationParams, requireEnum, requireNumber, requireString, requireUuid } from "../validate.js";
import { createReconTask, getUsedVehicle, listUsedVehicles, updateReconTask, updateUsedVehicle } from "../usedVehicleRepository.js";
import { branchScope } from "../middleware.js";
import { authorizePermission, CAPABILITIES } from "../permissions.js";

export const usedVehiclesRouter = Router();
const inspectionStatuses = ["not-started","in-progress","passed","failed"];
const grades = ["excellent","good","fair","poor"];
const reconStatuses = ["not-started","in-progress","ready","blocked"];
const taskStatuses = ["planned","approved","in-progress","completed","cancelled"];

usedVehiclesRouter.get("/", authorizePermission(CAPABILITIES.VEHICLES_READ), asyncRoute(async (request, response) => {
  const { limit, offset } = paginationParams(request.query);
  const vehicles = await listUsedVehicles(request.auth.organizationId, branchScope(request.auth), { search: optionalString(request.query.q, 120), limit, offset });
  response.json({ vehicles });
}));
usedVehiclesRouter.get("/:vehicleId", authorizePermission(CAPABILITIES.VEHICLES_READ), asyncRoute(async (request, response) => {
  const detail = await getUsedVehicle(request.auth.organizationId, requireUuid(request.params.vehicleId, "Vehicle id"));
  if (!detail) throw new HttpError(404, "VEHICLE_NOT_FOUND", "Vehicle not found.");
  response.json(detail);
}));
usedVehiclesRouter.patch("/:vehicleId", authorizePermission(CAPABILITIES.VEHICLES_MANAGE), asyncRoute(async (request, response) => {
  const vehicleId = requireUuid(request.params.vehicleId, "Vehicle id");
  const input = {
    inspectionStatus: request.body.inspectionStatus == null ? null : requireEnum(request.body.inspectionStatus, "Inspection status", inspectionStatuses),
    inspectionGrade: request.body.inspectionGrade == null ? null : requireEnum(request.body.inspectionGrade, "Inspection grade", grades),
    inspectionNotes: optionalString(request.body.inspectionNotes, 2000),
    reconStatus: request.body.reconStatus == null ? null : requireEnum(request.body.reconStatus, "Recon status", reconStatuses),
    askingPrice: optionalNumber(request.body.askingPrice), disposalChannel: request.body.disposalChannel == null ? null : requireEnum(request.body.disposalChannel, "Disposal channel", ["retail","auction","wholesale"]),
    wholesaleBuyer: optionalString(request.body.wholesaleBuyer, 160), wholesalePrice: optionalNumber(request.body.wholesalePrice),
  };
  if (input.disposalChannel === "wholesale" && (!input.wholesaleBuyer || input.wholesalePrice == null)) throw new HttpError(422, "WHOLESALE_DETAILS_REQUIRED", "Buyer and sale price are required for wholesale disposal.");
  const operation = await updateUsedVehicle(request.auth.organizationId, vehicleId, request.auth.userId, input);
  if (!operation) throw new HttpError(404, "VEHICLE_NOT_FOUND", "Vehicle not found.");
  response.json({ operation });
}));
usedVehiclesRouter.post("/:vehicleId/recon-tasks", authorizePermission(CAPABILITIES.VEHICLES_MANAGE), asyncRoute(async (request, response) => {
  const task = await createReconTask(request.auth.organizationId, requireUuid(request.params.vehicleId, "Vehicle id"), request.auth.userId, {
    category: requireEnum(request.body.category, "Category", ["mechanical","body","interior","tyres","detail","other"]),
    description: requireString(request.body.description, "Description", { min: 2, max: 500 }), supplier: optionalString(request.body.supplier, 160),
    estimatedCost: requireNumber(request.body.estimatedCost ?? 0, "Estimated cost", { min: 0 }), status: requireEnum(request.body.status ?? "planned", "Status", taskStatuses),
    dueAt: optionalIsoDateTime(request.body.dueAt, "Due date"),
  });
  if (!task) throw new HttpError(404, "VEHICLE_NOT_FOUND", "Vehicle not found.");
  response.status(201).json({ task });
}));
usedVehiclesRouter.patch("/:vehicleId/recon-tasks/:taskId", authorizePermission(CAPABILITIES.VEHICLES_MANAGE), asyncRoute(async (request, response) => {
  const task = await updateReconTask(request.auth.organizationId, requireUuid(request.params.vehicleId, "Vehicle id"), requireUuid(request.params.taskId, "Task id"), {
    status: request.body.status == null ? null : requireEnum(request.body.status, "Status", taskStatuses), actualCost: optionalNumber(request.body.actualCost),
  });
  if (!task) throw new HttpError(404, "RECON_TASK_NOT_FOUND", "Reconditioning task not found.");
  response.json({ task });
}));
