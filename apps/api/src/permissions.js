import { HttpError } from "./errors.js";

// A capability model layered on top of the existing role check() constraint in the `users` table
// (see auth.js ROLES and database/009_role_model_expansion.sql). This does not replace the
// existing per-route `authorize(...roles)` calls -- those keep working unchanged. It gives new,
// finer-grained endpoints (starting with audit-event reads) a named permission to check instead of
// a hard-coded role list, and gives every other module a documented place to register capabilities
// as they build real CRUD for their domain, instead of re-deriving role lists ad hoc per route.
//
// Keep this list additive: introducing a new capability for an existing route is safe, but
// removing or renarrowing one changes who can already do something today.
export const CAPABILITIES = Object.freeze({
  CUSTOMERS_READ: "customers.read",
  CUSTOMERS_MANAGE: "customers.manage",
  VEHICLES_READ: "vehicles.read",
  VEHICLES_MANAGE: "vehicles.manage",
  SALES_MANAGE: "sales.manage",
  SERVICE_MANAGE: "service.manage",
  PARTS_MANAGE: "parts.manage",
  FINANCE_MANAGE: "finance.manage",
  FINANCE_SENSITIVE_READ: "finance.sensitive.read",
  ADMIN_MEMBERS_MANAGE: "admin.members.manage",
  ADMIN_ROLES_MANAGE: "admin.roles.manage",
  ADMIN_WORKFORCE_MANAGE: "admin.workforce.manage",
  ADMIN_SETTINGS_MANAGE: "admin.settings.manage",
  ADMIN_AUDIT_READ: "admin.audit.read",
});

// Least privilege, deny by default: a role only gets what it is explicitly listed for below.
const ROLE_CAPABILITIES = {
  admin: Object.values(CAPABILITIES),
  general_manager: [
    CAPABILITIES.CUSTOMERS_READ,
    CAPABILITIES.CUSTOMERS_MANAGE,
    CAPABILITIES.VEHICLES_READ,
    CAPABILITIES.VEHICLES_MANAGE,
    CAPABILITIES.SALES_MANAGE,
    CAPABILITIES.SERVICE_MANAGE,
    CAPABILITIES.PARTS_MANAGE,
    CAPABILITIES.FINANCE_MANAGE,
    CAPABILITIES.ADMIN_AUDIT_READ,
  ],
  sales_manager: [CAPABILITIES.CUSTOMERS_READ, CAPABILITIES.CUSTOMERS_MANAGE, CAPABILITIES.VEHICLES_READ, CAPABILITIES.SALES_MANAGE],
  bdc_rep: [CAPABILITIES.CUSTOMERS_READ, CAPABILITIES.CUSTOMERS_MANAGE, CAPABILITIES.SALES_MANAGE],
  finance_manager: [
    CAPABILITIES.CUSTOMERS_READ,
    CAPABILITIES.VEHICLES_READ,
    CAPABILITIES.SALES_MANAGE,
    CAPABILITIES.FINANCE_MANAGE,
    CAPABILITIES.FINANCE_SENSITIVE_READ,
  ],
  service_advisor: [CAPABILITIES.CUSTOMERS_READ, CAPABILITIES.VEHICLES_READ, CAPABILITIES.VEHICLES_MANAGE, CAPABILITIES.SERVICE_MANAGE, CAPABILITIES.PARTS_MANAGE],
  receptionist: [CAPABILITIES.CUSTOMERS_READ, CAPABILITIES.VEHICLES_READ],
};

export function hasPermission(role, capability) {
  return Boolean(ROLE_CAPABILITIES[role]?.includes(capability));
}

export function roleCapabilities(role) {
  return [...(ROLE_CAPABILITIES[role] ?? [])];
}

export function authorizePermission(capability) {
  return function authorizeCapability(request, _response, next) {
    if (!request.auth) return next(new HttpError(401, "AUTHENTICATION_REQUIRED", "Sign in to continue."));
    if (!hasPermission(request.auth.role, capability)) {
      return next(new HttpError(403, "PERMISSION_DENIED", "Your role cannot perform this action."));
    }
    return next();
  };
}
