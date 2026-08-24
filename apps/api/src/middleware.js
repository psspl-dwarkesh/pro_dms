import { verifySessionToken } from "./auth.js";
import { getUserById } from "./persistence.js";
import { HttpError } from "./errors.js";

// Verifies the bearer token, then re-reads the user from the database on every request so a
// deactivation or role change takes effect immediately instead of waiting out the token's
// lifetime. The JWT is only trusted for identity (its subject) and to prove the request was
// authenticated recently; organizationId/branchId/role always come from the fresh database row,
// never from the token's (possibly stale) claims.
export async function authenticate(request, _response, next) {
  const header = request.headers.authorization ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return next(new HttpError(401, "AUTHENTICATION_REQUIRED", "Sign in to continue."));
  }

  let claims;
  try {
    claims = verifySessionToken(token);
  } catch {
    return next(new HttpError(401, "SESSION_INVALID", "Your session has expired. Sign in again."));
  }

  try {
    const user = await getUserById(claims.userId);
    if (!user) return next(new HttpError(401, "SESSION_INVALID", "Your session has expired. Sign in again."));
    if (!user.isActive) return next(new HttpError(401, "ACCOUNT_DEACTIVATED", "This account no longer has access. Contact an administrator."));
    request.auth = {
      userId: user.id,
      organizationId: user.organizationId,
      branchId: user.branchId,
      role: user.role,
    };
    return next();
  } catch (cause) {
    return next(cause);
  }
}

export function authorize(...roles) {
  return function authorizeRole(request, _response, next) {
    if (!request.auth) return next(new HttpError(401, "AUTHENTICATION_REQUIRED", "Sign in to continue."));
    if (!roles.includes(request.auth.role)) {
      return next(new HttpError(403, "ROLE_NOT_ALLOWED", "Your role cannot perform this action."));
    }
    return next();
  };
}

// Admins and general managers see every branch in the organization; every other role is scoped to its own branch.
export function isOrgWideRole(role) {
  return role === "admin" || role === "general_manager";
}

export function branchScope(auth) {
  return isOrgWideRole(auth.role) ? null : auth.branchId;
}

// For writes: admins may target any branch in their organization; every other role is pinned to its own branch.
export function resolveWriteBranchId(auth, requestedBranchId) {
  if (isOrgWideRole(auth.role)) return requestedBranchId ?? auth.branchId ?? null;
  return auth.branchId ?? null;
}
