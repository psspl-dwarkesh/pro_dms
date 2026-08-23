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

test("health reports a safe database mode without a configured database", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.service, "autoaxis-api");
  assert.equal(body.database.status, "not-configured");
  assert.ok(response.headers.get("x-request-id"));
});

test("signup validation errors use the public error envelope", async () => {
  const response = await fetch(`${baseUrl}/api/v1/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ organizationName: "x" }),
  });
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.equal(body.error.code, "INVALID_INPUT");
  assert.ok(body.error.requestId);
  assert.equal(typeof body.error.message, "string");
});

test("protected routes require authentication", async () => {
  const response = await fetch(`${baseUrl}/api/v1/customers`);
  const body = await response.json();
  assert.equal(response.status, 401);
  assert.equal(body.error.code, "AUTHENTICATION_REQUIRED");
});

test("an invalid bearer token is rejected", async () => {
  const response = await fetch(`${baseUrl}/api/v1/customers`, {
    headers: { Authorization: "Bearer not-a-real-token" },
  });
  const body = await response.json();
  assert.equal(response.status, 401);
  assert.equal(body.error.code, "SESSION_INVALID");
});

test("not-found routes use a stable code", async () => {
  const response = await fetch(`${baseUrl}/api/unknown`);
  const body = await response.json();
  assert.equal(response.status, 404);
  assert.equal(body.error.code, "ROUTE_NOT_FOUND");
});
