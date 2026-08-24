import { Router } from "express";
import { hashPassword, signSessionToken, slugifyCompanyName, verifyPassword } from "../auth.js";
import { createOrganizationWithAdmin, findUserByEmail, getOrganization, getUserById } from "../persistence.js";
import { asyncRoute, HttpError } from "../errors.js";
import { authenticate } from "../middleware.js";
import { optionalString, requireString } from "../validate.js";

export const authRouter = Router();

authRouter.post("/signup", asyncRoute(async (request, response) => {
  const organizationName = requireString(request.body.organizationName, "Company name", { min: 2, max: 120 });
  const branchName = requireString(request.body.branchName, "First branch name", { min: 2, max: 120 });
  const branchCity = optionalString(request.body.branchCity, 120);
  const branchCode = requireString(request.body.branchCode, "Branch code", { min: 2, max: 12 }).toUpperCase();
  const adminName = requireString(request.body.adminName, "Your name", { min: 2, max: 120 });
  const adminEmail = requireString(request.body.adminEmail, "Work email", { min: 5, max: 160 }).toLowerCase();
  const password = requireString(request.body.password, "Password", { min: 8, max: 200 });

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
    throw new HttpError(400, "INVALID_INPUT", "Enter a valid work email.", [{ field: "adminEmail" }]);
  }

  const passwordHash = await hashPassword(password);
  const slug = slugifyCompanyName(organizationName);

  const { organization, branch, user } = await createOrganizationWithAdmin({
    organizationName,
    slug,
    branchName,
    branchCity,
    branchCode,
    adminName,
    adminEmail,
    passwordHash,
  });

  const token = signSessionToken({ id: user.id, organizationId: organization.id, branchId: branch.id, role: user.role });
  response.status(201).json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, organizationId: organization.id, branchId: branch.id },
    organization: { id: organization.id, name: organization.name, slug: organization.slug },
  });
}));

authRouter.post("/login", asyncRoute(async (request, response) => {
  const email = requireString(request.body.email, "Email", { min: 3, max: 160 }).toLowerCase();
  const password = requireString(request.body.password, "Password", { min: 1, max: 200 });

  const user = await findUserByEmail(email);
  const valid = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !valid || !user.isActive) {
    throw new HttpError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  }

  const organization = await getOrganization(user.organizationId);
  const token = signSessionToken(user);
  response.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, organizationId: user.organizationId, branchId: user.branchId },
    organization: organization ? { id: organization.id, name: organization.name, slug: organization.slug } : null,
  });
}));

authRouter.get("/me", authenticate, asyncRoute(async (request, response) => {
  const [user, organization] = await Promise.all([
    getUserById(request.auth.userId),
    getOrganization(request.auth.organizationId),
  ]);
  if (!user || !user.isActive) throw new HttpError(401, "SESSION_INVALID", "Your session has expired. Sign in again.");
  response.json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role, organizationId: user.organizationId, branchId: user.branchId },
    organization: organization ? { id: organization.id, name: organization.name, slug: organization.slug } : null,
  });
}));
