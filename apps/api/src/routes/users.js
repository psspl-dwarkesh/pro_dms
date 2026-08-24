import { Router } from "express";
import { hashPassword, ROLES } from "../auth.js";
import { authzGuardMessage, wouldRemoveLastAdmin } from "../authzGuards.js";
import { createUser, listUsers, updateOwnProfile, updateUser } from "../persistence.js";
import { asyncRoute, HttpError } from "../errors.js";
import { authorize } from "../middleware.js";
import { optionalString, requireEnum, requireString, requireUuid } from "../validate.js";

export const usersRouter = Router();

// Every authenticated role can read/update its own profile -- name only. Registered before the
// admin-only gate below so every role can reach it. It is intentionally narrower than the admin
// PATCH /:id route: persistence#updateOwnProfile cannot change role, branch, or active state, so a
// personal profile form can never become a privilege-escalation path (see AutoAxis remediation
// spec section 12.3 guardrails).
usersRouter.get("/me", asyncRoute(async (request, response) => {
  const users = await listUsers(request.auth.organizationId);
  const self = users.find((user) => user.id === request.auth.userId);
  if (!self) throw new HttpError(404, "USER_NOT_FOUND", "User not found.");
  response.json({ user: self });
}));

usersRouter.patch("/me", asyncRoute(async (request, response) => {
  const name = requireString(request.body.name, "Name", { min: 2, max: 120 });
  const user = await updateOwnProfile(request.auth.organizationId, request.auth.userId, { name });
  if (!user) throw new HttpError(404, "USER_NOT_FOUND", "User not found.");
  response.json({ user });
}));

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

  if (role !== null || isActive !== null) {
    const users = await listUsers(request.auth.organizationId);
    if (!users.some((user) => user.id === id)) throw new HttpError(404, "USER_NOT_FOUND", "User not found.");
    if (wouldRemoveLastAdmin(users, id, { nextRole: role, nextIsActive: isActive })) {
      throw new HttpError(409, "LAST_ADMIN_REQUIRED", authzGuardMessage.lastAdminRequired);
    }
  }

  const user = await updateUser(request.auth.organizationId, id, { role, branchId, isActive });
  if (!user) throw new HttpError(404, "USER_NOT_FOUND", "User not found.");
  response.json({ user });
}));
