import { Router } from "express";
import { createServiceJob, getServiceJob360, listServiceJobs, updateServiceJob } from "../db.js";
import { asyncRoute, HttpError } from "../errors.js";
import { branchScope, resolveWriteBranchId } from "../middleware.js";
import { optionalNumber, optionalString, requireEnum, requireString, requireUuid, paginationParams } from "../validate.js";

export const serviceJobsRouter = Router();

const JOB_STATUSES = ["booked", "checked-in", "diagnosing", "awaiting-approval", "in-progress", "quality-check", "closed"];

serviceJobsRouter.get("/", asyncRoute(async (request, response) => {
  const status = optionalString(request.query.status, 40);
  const customerId = request.query.customerId ? requireUuid(request.query.customerId, "Customer id") : null;
  const vehicleId = request.query.vehicleId ? requireUuid(request.query.vehicleId, "Vehicle id") : null;
  const { limit, offset } = paginationParams(request.query);
  const serviceJobs = await listServiceJobs(request.auth.organizationId, branchScope(request.auth), { status, customerId, vehicleId, limit, offset });
  response.json({ serviceJobs });
}));

serviceJobsRouter.post("/", asyncRoute(async (request, response) => {
  const customerId = requireUuid(request.body.customerId, "Customer id");
  const vehicleId = requireUuid(request.body.vehicleId, "Vehicle id");
  const repairOrderNumber = requireString(request.body.repairOrderNumber, "Repair order number", { min: 2, max: 40 });
  const status = requireEnum(request.body.status ?? "booked", "Status", JOB_STATUSES);
  const advisor = optionalString(request.body.advisor, 120);
  const technician = optionalString(request.body.technician, 120);
  const complaint = optionalString(request.body.complaint, 400);
  const promisedAt = request.body.promisedAt ?? null;
  const branchId = resolveWriteBranchId(request.auth, request.body.branchId);
  const serviceJob = await createServiceJob(request.auth.organizationId, branchId, { customerId, vehicleId, repairOrderNumber, status, advisor, technician, complaint, promisedAt });
  response.status(201).json({ serviceJob });
}));

serviceJobsRouter.patch("/:id", asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Service job id");
  const status = request.body.status ? requireEnum(request.body.status, "Status", JOB_STATUSES) : null;
  const technician = optionalString(request.body.technician, 120);
  const labourTotal = optionalNumber(request.body.labourTotal);
  const partsTotal = optionalNumber(request.body.partsTotal);
  const closedAt = status === "closed" ? new Date().toISOString() : (request.body.closedAt ?? null);
  const serviceJob = await updateServiceJob(request.auth.organizationId, id, { status, technician, labourTotal, partsTotal, closedAt });
  if (!serviceJob) throw new HttpError(404, "SERVICE_JOB_NOT_FOUND", "Service job not found.");
  response.json({ serviceJob });
}));

serviceJobsRouter.get("/:id/360", asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Service job id");
  const serviceJob = await getServiceJob360(request.auth.organizationId, id);
  if (!serviceJob) throw new HttpError(404, "SERVICE_JOB_NOT_FOUND", "Service job not found.");
  response.json({ serviceJob });
}));
