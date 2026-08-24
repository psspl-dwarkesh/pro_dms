// Full-stack authorization and tenant-isolation checks. These need a real, disposable PostgreSQL
// database (they sign up real organizations) so they are gated on DATABASE_URL and skip cleanly
// when it is not set -- exactly the state of this repository's default sandbox. Point
// DATABASE_URL at a dev/test database (never production) to run them for real:
//   DATABASE_URL=postgresql://... npm test --workspace=@autoaxis/api
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";

const hasDatabase = Boolean(process.env.DATABASE_URL);
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = "integration-test-secret-do-not-use-in-production";

let app;
let server;
let baseUrl;

before(async () => {
  if (!hasDatabase) return;
  ({ app } = await import("../src/app.js"));
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

async function signupOrg(label) {
  const unique = randomUUID().slice(0, 8);
  const response = await fetch(`${baseUrl}/api/v1/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      organizationName: `${label} ${unique}`,
      branchName: "Head Office",
      branchCity: "Sydney",
      branchCode: unique.slice(0, 6).toUpperCase(),
      adminName: `${label} Admin`,
      adminEmail: `${label.toLowerCase()}.${unique}@example.com`,
      password: "Demo@12345",
    }),
  });
  assert.equal(response.status, 201, `signup for ${label} should succeed`);
  return response.json();
}

async function authed(path, token, options = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers ?? {}) },
  });
}

async function waitFor(assertion, { timeoutMs = 2000, intervalMs = 50 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      return await assertion();
    } catch (error) {
      if (Date.now() > deadline) throw error;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
}

test("a guessed record id from another organization is not found, not leaked", { skip: !hasDatabase }, async () => {
  const orgA = await signupOrg("TenantA");
  const orgB = await signupOrg("TenantB");

  const created = await authed("/api/v1/customers", orgA.token, {
    method: "POST",
    body: JSON.stringify({ customerType: "individual", displayName: "Isolation Test Customer" }),
  });
  assert.equal(created.status, 201);
  const { customer } = await created.json();

  const ownRead = await authed(`/api/v1/customers/${customer.id}/360`, orgA.token);
  assert.equal(ownRead.status, 200);

  const crossTenantRead = await authed(`/api/v1/customers/${customer.id}/360`, orgB.token);
  assert.equal(crossTenantRead.status, 404);
  const body = await crossTenantRead.json();
  assert.equal(body.error.code, "CUSTOMER_NOT_FOUND");
});

test("the last active admin in an organization cannot be deactivated or demoted", { skip: !hasDatabase }, async () => {
  const org = await signupOrg("SoloAdmin");

  const blocked = await authed(`/api/v1/users/${org.user.id}`, org.token, {
    method: "PATCH",
    body: JSON.stringify({ isActive: false }),
  });
  assert.equal(blocked.status, 409);
  assert.equal((await blocked.json()).error.code, "LAST_ADMIN_REQUIRED");

  const blockedDemote = await authed(`/api/v1/users/${org.user.id}`, org.token, {
    method: "PATCH",
    body: JSON.stringify({ role: "receptionist" }),
  });
  assert.equal(blockedDemote.status, 409);

  const secondAdmin = await authed("/api/v1/users", org.token, {
    method: "POST",
    body: JSON.stringify({ name: "Backup Admin", email: `backup.${randomUUID().slice(0, 8)}@example.com`, password: "Demo@12345", role: "admin" }),
  });
  assert.equal(secondAdmin.status, 201);

  const nowAllowed = await authed(`/api/v1/users/${org.user.id}`, org.token, {
    method: "PATCH",
    body: JSON.stringify({ isActive: false }),
  });
  assert.equal(nowAllowed.status, 200);
});

test("deactivating a user immediately revokes their existing session token", { skip: !hasDatabase }, async () => {
  const org = await signupOrg("Revocation");
  const email = `staff.${randomUUID().slice(0, 8)}@example.com`;

  const created = await authed("/api/v1/users", org.token, {
    method: "POST",
    body: JSON.stringify({ name: "Front Desk", email, password: "Demo@12345", role: "receptionist" }),
  });
  assert.equal(created.status, 201);

  const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Demo@12345" }),
  });
  assert.equal(login.status, 200);
  const { token: staffToken } = await login.json();

  const beforeDeactivation = await authed("/api/v1/customers", staffToken);
  assert.equal(beforeDeactivation.status, 200);

  const { user: created2 } = await created.json();
  const deactivated = await authed(`/api/v1/users/${created2.id}`, org.token, {
    method: "PATCH",
    body: JSON.stringify({ isActive: false }),
  });
  assert.equal(deactivated.status, 200);

  const afterDeactivation = await authed("/api/v1/customers", staffToken);
  assert.equal(afterDeactivation.status, 401);
  assert.equal((await afterDeactivation.json()).error.code, "ACCOUNT_DEACTIVATED");
});

test("a self profile edit cannot change role, branch, or active state", { skip: !hasDatabase }, async () => {
  const org = await signupOrg("SelfEdit");

  const edited = await authed("/api/v1/users/me", org.token, {
    method: "PATCH",
    body: JSON.stringify({ name: "Renamed Admin", role: "receptionist", isActive: false }),
  });
  assert.equal(edited.status, 200);
  const { user } = await edited.json();
  assert.equal(user.name, "Renamed Admin");
  assert.equal(user.role, "admin");
  assert.equal(user.isActive, true);
});

test("a mutation is recorded in the organization's audit log", { skip: !hasDatabase }, async () => {
  const org = await signupOrg("AuditTrail");

  const created = await authed("/api/v1/customers", org.token, {
    method: "POST",
    body: JSON.stringify({ customerType: "individual", displayName: "Audited Customer" }),
  });
  assert.equal(created.status, 201);

  await waitFor(async () => {
    const events = await authed("/api/v1/audit-events", org.token);
    assert.equal(events.status, 200);
    const { events: rows } = await events.json();
    assert.ok(rows.some((row) => row.action === "customers.write" && row.statusCode === 201));
  });
});

test("a role without admin.audit.read cannot read the audit log", { skip: !hasDatabase }, async () => {
  const org = await signupOrg("AuditPermission");
  const email = `receptionist.${randomUUID().slice(0, 8)}@example.com`;
  await authed("/api/v1/users", org.token, {
    method: "POST",
    body: JSON.stringify({ name: "No Audit Access", email, password: "Demo@12345", role: "receptionist" }),
  });
  const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Demo@12345" }),
  });
  const { token } = await login.json();

  const denied = await authed("/api/v1/audit-events", token);
  assert.equal(denied.status, 403);
  assert.equal((await denied.json()).error.code, "PERMISSION_DENIED");
});
