import { Router } from "express";
import { getOverview } from "../persistence.js";
import { asyncRoute } from "../errors.js";
import { branchScope } from "../middleware.js";

export const overviewRouter = Router();

overviewRouter.get("/", asyncRoute(async (request, response) => {
  const overview = await getOverview(request.auth.organizationId, branchScope(request.auth));
  response.json({ overview });
}));
