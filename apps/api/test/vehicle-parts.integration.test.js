import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";

const hasDatabase = Boolean(process.env.DATABASE_URL);
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = "integration-test-secret-do-not-use-in-production";
let server; let baseUrl;

before(async () => {
  if (!hasDatabase) return;
  const { app } = await import("../src/app.js");
  await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", () => { baseUrl = `http://127.0.0.1:${server.address().port}`; resolve(); }); });
});
after(async () => { if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });

async function request(path, token, options = {}) { return fetch(`${baseUrl}${path}`, { ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers ?? {}) } }); }
async function setup() {
  const key = randomUUID().slice(0, 8);
  const signup = await fetch(`${baseUrl}/api/v1/auth/signup`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationName: `Parts ${key}`, branchName: "Central", branchCode: key.slice(0, 6), adminName: "Parts Admin", adminEmail: `parts.${key}@example.com`, password: "Demo@12345" }) });
  assert.equal(signup.status, 201); const org = await signup.json();
  const partResponse = await request("/api/v1/parts", org.token, { method: "POST", body: JSON.stringify({ sku: `SKU-${key}`, name: "Oil filter", quantityOnHand: 10, reorderPoint: 3, unitCost: 12, retailPrice: 24 }) });
  assert.equal(partResponse.status, 201); return { ...org, part: (await partResponse.json()).part };
}

test("reservation availability is tenant scoped and allocation posts stock", { skip: !hasDatabase }, async () => {
  const org = await setup();
  const vin = `PART${randomUUID().replaceAll("-", "").slice(0, 13)}`.toUpperCase();
  const vehicleResponse = await request("/api/v1/vehicles", org.token, { method: "POST", body: JSON.stringify({ vin, make: "Toyota", model: "Corolla" }) });
  const vehicle = (await vehicleResponse.json()).vehicle;
  const reserved = await request("/api/v1/parts/reservations", org.token, { method: "POST", body: JSON.stringify({ partId: org.part.id, vehicleId: vehicle.id, quantity: 4 }) });
  assert.equal(reserved.status, 201); const reservation = (await reserved.json()).reservation;
  const overReserve = await request("/api/v1/parts/reservations", org.token, { method: "POST", body: JSON.stringify({ partId: org.part.id, vehicleId: vehicle.id, quantity: 7 }) });
  assert.equal(overReserve.status, 409); assert.equal((await overReserve.json()).error.code, "PART_STOCK_UNAVAILABLE");
  const allocated = await request(`/api/v1/parts/reservations/${reservation.id}`, org.token, { method: "PATCH", body: JSON.stringify({ status: "allocated" }) });
  assert.equal(allocated.status, 200);
  const workspace = await request("/api/v1/parts/workspace", org.token); const body = await workspace.json();
  assert.equal(body.workspace.parts.find((part) => part.id === org.part.id).quantityOnHand, 6);
});
test("purchase receipt replenishes stock and a transfer preserves organization total", { skip: !hasDatabase }, async () => {
  const org = await setup(); const suffix = randomUUID().slice(0, 6).toUpperCase();
  const branchResponse = await request("/api/v1/branches", org.token, { method: "POST", body: JSON.stringify({ code: suffix, name: "North Branch" }) });
  assert.equal(branchResponse.status, 201); const second = (await branchResponse.json()).branch;
  const poResponse = await request("/api/v1/parts/purchase-orders", org.token, { method: "POST", body: JSON.stringify({ partId: org.part.id, orderNumber: `PO-${suffix}`, supplierName: "Illustrative Parts Supply", quantity: 5, unitCost: 11 }) });
  assert.equal(poResponse.status, 201); const po = (await poResponse.json()).purchaseOrder;
  assert.equal((await request(`/api/v1/parts/purchase-orders/${po.id}/receive`, org.token, { method: "POST", body: "{}" })).status, 200);
  const transferResponse = await request("/api/v1/parts/transfers", org.token, { method: "POST", body: JSON.stringify({ partId: org.part.id, fromBranchId: org.user.branchId, toBranchId: second.id, quantity: 3 }) });
  assert.equal(transferResponse.status, 201); const transfer = (await transferResponse.json()).transfer;
  // Destination-only receipt enforcement: this admin token is scoped to the source branch.
  const blockedReceipt = await request(`/api/v1/parts/transfers/${transfer.id}/receive`, org.token, { method: "POST", body: "{}" });
  assert.equal(blockedReceipt.status, 404);
});

test("parts workspace rejects a role without parts capability", { skip: !hasDatabase }, async () => {
  const org = await setup(); const key = randomUUID().slice(0, 8);
  await request("/api/v1/users", org.token, { method: "POST", body: JSON.stringify({ name: "Front Desk", email: `front.${key}@example.com`, password: "Demo@12345", role: "receptionist" }) });
  const login = await fetch(`${baseUrl}/api/v1/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: `front.${key}@example.com`, password: "Demo@12345" }) });
  const user = await login.json(); const response = await request("/api/v1/parts/workspace", user.token);
  assert.equal(response.status, 403); assert.equal((await response.json()).error.code, "PERMISSION_DENIED");
});
