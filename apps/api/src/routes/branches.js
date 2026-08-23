import { Router } from "express";
import { createBranch, listBranches } from "../db.js";
import { asyncRoute } from "../errors.js";
import { authorize } from "../middleware.js";
import { optionalString, requireString } from "../validate.js";

export const branchesRouter = Router();

branchesRouter.get("/", asyncRoute(async (request, response) => {
  const branches = await listBranches(request.auth.organizationId);
  response.json({ branches });
}));

branchesRouter.post("/", authorize("admin"), asyncRoute(async (request, response) => {
  const code = requireString(request.body.code, "Branch code", { min: 2, max: 12 }).toUpperCase();
  const name = requireString(request.body.name, "Branch name", { min: 2, max: 120 });
  const city = optionalString(request.body.city, 120);
  const branch = await createBranch(request.auth.organizationId, { code, name, city });
  response.status(201).json({ branch });
}));
