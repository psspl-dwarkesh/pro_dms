import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { app } from "../src/app.js";

let server;
let baseUrl;

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
      const address = server.address();
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

test("health returns a safe database mode", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.service, "autoaxis-api");
  assert.equal(body.database.status, "not-configured");
  assert.ok(response.headers.get("x-request-id"));
});

test("validation errors use the public error envelope", async () => {
  const response = await fetch(`${baseUrl}/api/v1/customers/search?q=x`);
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.error.code, "INVALID_SEARCH_QUERY");
  assert.ok(body.error.requestId);
  assert.equal(typeof body.error.message, "string");
});

test("demonstration customer search remains available when the database is not configured", async () => {
  const response = await fetch(`${baseUrl}/api/v1/customers/search?q=James`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.dataSource, "demonstration");
  assert.equal(body.customers.length, 1);
});

test("global search returns bounded grouped demonstration records", async () => {
  const response = await fetch(`${baseUrl}/api/v1/search?q=BMW&limit=3`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.dataSource, "demonstration");
  assert.deepEqual(body.groups.map((group) => group.id), ["customers", "vehicles", "operations"]);
  assert.ok(body.total >= 2);
  assert.ok(body.groups.every((group) => group.results.length <= 3));
  assert.ok(body.groups.flatMap((group) => group.results).every((record) => record.id && record.kind && record.view));
});

test("global search validates its result limit", async () => {
  const response = await fetch(`${baseUrl}/api/v1/search?q=BMW&limit=50`);
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.error.code, "INVALID_SEARCH_LIMIT");
});

test("demonstration search results open the exact customer record", async () => {
  const searchResponse = await fetch(`${baseUrl}/api/v1/search?q=Ava%20Nguyen`);
  const search = await searchResponse.json();
  const result = search.groups.find((group) => group.id === "customers").results[0];
  const detailResponse = await fetch(`${baseUrl}/api/v1/customers/${result.id}/360`);
  const detail = await detailResponse.json();
  assert.equal(detailResponse.status, 200);
  assert.equal(detail.customer.displayName, "Ava Nguyen");
  assert.equal(detail.customer.id, result.id);
});

test("demonstration vehicle results retain the linked customer record", async () => {
  const searchResponse = await fetch(`${baseUrl}/api/v1/search?q=ANQ-707`);
  const search = await searchResponse.json();
  const result = search.groups.find((group) => group.id === "vehicles").results[0];
  const detailResponse = await fetch(`${baseUrl}/api/v1/vehicles/${result.id}/360`);
  const detail = await detailResponse.json();
  assert.equal(detailResponse.status, 200);
  assert.equal(detail.vehicle.registration, "ANQ-707");
  assert.equal(detail.vehicle.ownerName, "Ava Nguyen");
  assert.equal(detail.vehicle.ownerId, "30000000-0000-0000-0000-000000000002");
});

test("not-found routes use a stable code", async () => {
  const response = await fetch(`${baseUrl}/api/unknown`);
  const body = await response.json();
  assert.equal(response.status, 404);
  assert.equal(body.error.code, "ROUTE_NOT_FOUND");
});
