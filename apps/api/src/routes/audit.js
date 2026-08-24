import { Router } from "express";
import { listAuditEvents } from "../persistence.js";
import { asyncRoute } from "../errors.js";
import { authorizePermission, CAPABILITIES } from "../permissions.js";
import { paginationParams } from "../validate.js";

export const auditRouter = Router();

auditRouter.get("/", authorizePermission(CAPABILITIES.ADMIN_AUDIT_READ), asyncRoute(async (request, response) => {
  const { limit, offset } = paginationParams(request.query);
  const events = await listAuditEvents(request.auth.organizationId, { limit, offset });
  response.json({ events });
}));
