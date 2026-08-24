import { pool } from "./db.js";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Best-effort append-only audit write. Never throws into the caller: a failed audit insert must
// not fail or mask the real request/response, but it is logged once so the gap is visible in
// server logs (see docs/rules/errors.md -- log unexpected failures once with request id, no PII).
export async function recordAuditEvent({
  organizationId,
  branchId = null,
  actorUserId = null,
  actorRole = null,
  action,
  method,
  path,
  statusCode,
  targetType = null,
  targetId = null,
  requestId = null,
  metadata = {},
}) {
  if (!pool || !organizationId) return;
  try {
    await pool.query(
      `insert into audit_events
         (organization_id, branch_id, actor_user_id, actor_role, action, method, path, status_code, target_type, target_id, request_id, metadata)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [organizationId, branchId, actorUserId, actorRole, action, method, path, statusCode, targetType, targetId, requestId, JSON.stringify(metadata)],
    );
  } catch (cause) {
    console.error(JSON.stringify({
      level: "error",
      event: "audit_write_failed",
      requestId,
      action,
      errorName: cause?.name ?? "Error",
    }));
  }
}

// Derives a generic action name from the route, e.g. "customers.write" for any mutating request
// under /api/v1/customers. Domain routes can log a more specific action (with a real targetType/
// targetId) by calling recordAuditEvent directly; this middleware guarantees every mutation is
// captured even before a route does that.
function deriveAction(path) {
  const segment = path.split("/").filter(Boolean)[2]; // /api/v1/<segment>/...
  return segment ? `${segment}.write` : "request.write";
}

// Mount after `authenticate` so `request.auth` is populated. Fires on response finish so it never
// delays the response, and only for state-changing methods -- reads are not audited here.
export function auditRequests(request, response, next) {
  if (!MUTATING_METHODS.has(request.method)) return next();
  response.on("finish", () => {
    void recordAuditEvent({
      organizationId: request.auth?.organizationId,
      branchId: request.auth?.branchId ?? null,
      actorUserId: request.auth?.userId ?? null,
      actorRole: request.auth?.role ?? null,
      action: deriveAction(request.path),
      method: request.method,
      path: request.path,
      statusCode: response.statusCode,
      targetId: request.params?.id ?? null,
      requestId: request.requestId ?? null,
    });
  });
  next();
}
