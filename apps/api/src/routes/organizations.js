import { Router } from "express";
import { getOrganization, updateOrganization } from "../db.js";
import { asyncRoute, HttpError } from "../errors.js";
import { authorize } from "../middleware.js";
import { optionalString } from "../validate.js";

export const organizationsRouter = Router();

organizationsRouter.get("/me", asyncRoute(async (request, response) => {
  const organization = await getOrganization(request.auth.organizationId);
  if (!organization) throw new HttpError(404, "ORGANIZATION_NOT_FOUND", "Company not found.");
  response.json({ organization });
}));

organizationsRouter.patch("/me", authorize("admin"), asyncRoute(async (request, response) => {
  const name = optionalString(request.body.name, 120);
  const timezone = optionalString(request.body.timezone, 60);
  const organization = await updateOrganization(request.auth.organizationId, { name, timezone });
  response.json({ organization });
}));
