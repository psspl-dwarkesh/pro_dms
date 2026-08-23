import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const TOKEN_TTL = "7d";

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is required to issue or verify session tokens.");
  return secret;
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

export function signSessionToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      organizationId: user.organizationId,
      branchId: user.branchId,
      role: user.role,
    },
    jwtSecret(),
    { expiresIn: TOKEN_TTL },
  );
}

export function verifySessionToken(token) {
  const payload = jwt.verify(token, jwtSecret());
  return {
    userId: payload.sub,
    organizationId: payload.organizationId,
    branchId: payload.branchId ?? null,
    role: payload.role,
  };
}

export const ROLES = ["admin", "general_manager", "sales_manager", "bdc_rep", "finance_manager", "service_advisor", "receptionist"];

export function slugifyCompanyName(name) {
  const base = String(name)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "dealership";
}
