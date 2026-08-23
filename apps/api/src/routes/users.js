import { Router } from "express";
import { hashPassword, ROLES } from "../auth.js";
import { createUser, listUsers, updateUser } from "../db.js";
import { asyncRoute } from "../errors.js";
import { authorize } from "../middleware.js";
import { optionalString, requireEnum, requireString, requireUuid } from "../validate.js";

export const usersRouter = Router();

usersRouter.use(authorize("admin"));

usersRouter.get("/", asyncRoute(async (request, response) => {
  const users = await listUsers(request.auth.organizationId);
  response.json({ users });
}));

usersRouter.post("/", asyncRoute(async (request, response) => {
  const name = requireString(request.body.name, "Name", { min: 2, max: 120 });
  const email = requireString(request.body.email, "Email", { min: 5, max: 160 }).toLowerCase();
  const password = requireString(request.body.password, "Password", { min: 8, max: 200 });
  const role = requireEnum(request.body.role, "Role", ROLES);
  const branchId = optionalString(request.body.branchId, 36);

  const passwordHash = await hashPassword(password);
  const user = await createUser(request.auth.organizationId, { name, email, passwordHash, role, branchId });
  response.status(201).json({ user });
}));

usersRouter.patch("/:id", asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "User id");
  const role = request.body.role ? requireEnum(request.body.role, "Role", ROLES) : null;
  const branchId = optionalString(request.body.branchId, 36);
  const isActive = typeof request.body.isActive === "boolean" ? request.body.isActive : null;
  const user = await updateUser(request.auth.organizationId, id, { role, branchId, isActive });
  response.json({ user });
}));
