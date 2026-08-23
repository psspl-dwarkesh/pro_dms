import { verifySessionToken } from "./auth.js";
import { HttpError } from "./errors.js";

export function authenticate(request, _response, next) {
  const header = request.headers.authorization ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return next(new HttpError(401, "AUTHENTICATION_REQUIRED", "Sign in to continue."));
  }

  try {
    request.auth = verifySessionToken(token);
    return next();
  } catch {
    return next(new HttpError(401, "SESSION_INVALID", "Your session has expired. Sign in again."));
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

// Only admins see every branch in the organization; every other role is scoped to its own branch.
export function isOrgWideRole(role) {
  return role === "admin";
}

export function branchScope(auth) {
  return isOrgWideRole(auth.role) ? null : auth.branchId;
}

// For writes: admins may target any branch in their organization; every other role is pinned to its own branch.
export function resolveWriteBranchId(auth, requestedBranchId) {
  if (isOrgWideRole(auth.role)) return requestedBranchId ?? auth.branchId ?? null;
  return auth.branchId ?? null;
}
