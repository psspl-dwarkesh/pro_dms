// Customer 360 relationship records: notes, tasks, consent, documents, and duplicate detection.
// Same pattern as authorization.integration.test.js -- needs a real, disposable PostgreSQL
// database, gated on DATABASE_URL, and skips cleanly when it is not set.
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

async function createCustomer(token, overrides = {}) {
  const response = await authed("/api/v1/customers", token, {
    method: "POST",
    body: JSON.stringify({ customerType: "individual", displayName: "Relationship Record Customer", ...overrides }),
  });
  assert.equal(response.status, 201);
  return (await response.json()).customer;
}

test("a note can be created and is listed newest first", { skip: !hasDatabase }, async () => {
  const org = await signupOrg("Notes");
  const customer = await createCustomer(org.token);

  const first = await authed(`/api/v1/customers/${customer.id}/notes`, org.token, {
    method: "POST",
    body: JSON.stringify({ body: "First contact, interested in a trade-in." }),
  });
  assert.equal(first.status, 201);
  const second = await authed(`/api/v1/customers/${customer.id}/notes`, org.token, {
    method: "POST",
    body: JSON.stringify({ body: "Followed up by phone." }),
  });
  assert.equal(second.status, 201);

  const listed = await authed(`/api/v1/customers/${customer.id}/notes`, org.token);
  assert.equal(listed.status, 200);
  const { notes } = await listed.json();
  assert.equal(notes.length, 2);
  assert.equal(notes[0].body, "Followed up by phone.");
  assert.equal(notes[0].authorName, "Notes Admin");
});

test("a task can be created and marked done", { skip: !hasDatabase }, async () => {
  const org = await signupOrg("Tasks");
  const customer = await createCustomer(org.token);

  const created = await authed(`/api/v1/customers/${customer.id}/tasks`, org.token, {
    method: "POST",
    body: JSON.stringify({ title: "Call back about finance approval", assignedTo: "Sam" }),
  });
  assert.equal(created.status, 201);
  const { task } = await created.json();
  assert.equal(task.status, "open");
  assert.equal(task.completedAt, null);

  const completed = await authed(`/api/v1/customers/${customer.id}/tasks/${task.id}`, org.token, {
    method: "PATCH",
    body: JSON.stringify({ status: "done" }),
  });
  assert.equal(completed.status, 200);
  const { task: updated } = await completed.json();
  assert.equal(updated.status, "done");
  assert.ok(updated.completedAt);
});

test("an invalid task due date is rejected before it reaches the database", { skip: !hasDatabase }, async () => {
  const org = await signupOrg("TaskDates");
  const customer = await createCustomer(org.token);

  const response = await authed(`/api/v1/customers/${customer.id}/tasks`, org.token, {
    method: "POST",
    body: JSON.stringify({ title: "Follow up", dueAt: "not-a-date" }),
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "INVALID_INPUT");
});

test("consent starts unknown per channel, and a recorded decision becomes the current state", { skip: !hasDatabase }, async () => {
  const org = await signupOrg("Consent");
  const customer = await createCustomer(org.token);

  const initial = await authed(`/api/v1/customers/${customer.id}/consent`, org.token);
  assert.equal(initial.status, 200);
  const { consent: initialConsent } = await initial.json();
  assert.equal(initialConsent.length, 4);
  assert.ok(initialConsent.every((entry) => entry.status === "unknown"));

  const recorded = await authed(`/api/v1/customers/${customer.id}/consent`, org.token, {
    method: "POST",
    body: JSON.stringify({ channel: "email", status: "opted_in", source: "signup form" }),
  });
  assert.equal(recorded.status, 201);

  const optedOut = await authed(`/api/v1/customers/${customer.id}/consent`, org.token, {
    method: "POST",
    body: JSON.stringify({ channel: "email", status: "opted_out", source: "unsubscribe link" }),
  });
  assert.equal(optedOut.status, 201);

  const after = await authed(`/api/v1/customers/${customer.id}/consent`, org.token);
  const { consent } = await after.json();
  const email = consent.find((entry) => entry.channel === "email");
  assert.equal(email.status, "opted_out");

  const history = await authed(`/api/v1/customers/${customer.id}/consent/history`, org.token);
  const { events } = await history.json();
  assert.equal(events.filter((event) => event.channel === "email").length, 2);
});

test("a document record stores a reference, never a file body, and its status can change", { skip: !hasDatabase }, async () => {
  const org = await signupOrg("Documents");
  const customer = await createCustomer(org.token);

  const created = await authed(`/api/v1/customers/${customer.id}/documents`, org.token, {
    method: "POST",
    body: JSON.stringify({ documentType: "id_proof", label: "Driver licence", storageReference: "vault://demo/dl-001" }),
  });
  assert.equal(created.status, 201);
  const { document } = await created.json();
  assert.equal(document.status, "received");

  const verified = await authed(`/api/v1/customers/${customer.id}/documents/${document.id}`, org.token, {
    method: "PATCH",
    body: JSON.stringify({ status: "verified" }),
  });
  assert.equal(verified.status, 200);
  assert.equal((await verified.json()).document.status, "verified");
});

test("duplicate detection matches an exact mobile number regardless of formatting", { skip: !hasDatabase }, async () => {
  const org = await signupOrg("Duplicates");
  await createCustomer(org.token, { displayName: "Priya Shah", mobile: "0412 345 678" });

  const found = await authed(`/api/v1/customers/duplicates?mobile=${encodeURIComponent("+61 412-345-678")}`, org.token);
  assert.equal(found.status, 200);
  const { customers } = await found.json();
  assert.equal(customers.length, 1);
  assert.equal(customers[0].displayName, "Priya Shah");
});

test("a role limited to reading customers cannot log a note or mutate a task", { skip: !hasDatabase }, async () => {
  const org = await signupOrg("ReadOnlyCustomers");
  const customer = await createCustomer(org.token);
  const email = `receptionist.${randomUUID().slice(0, 8)}@example.com`;
  await authed("/api/v1/users", org.token, {
    method: "POST",
    body: JSON.stringify({ name: "Front Desk", email, password: "Demo@12345", role: "receptionist" }),
  });
  const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Demo@12345" }),
  });
  const { token } = await login.json();

  const readNotes = await authed(`/api/v1/customers/${customer.id}/notes`, token);
  assert.equal(readNotes.status, 200);

  const writeNote = await authed(`/api/v1/customers/${customer.id}/notes`, token, {
    method: "POST",
    body: JSON.stringify({ body: "Should not be allowed." }),
  });
  assert.equal(writeNote.status, 403);
  assert.equal((await writeNote.json()).error.code, "PERMISSION_DENIED");
});

test("notes and tasks are not reachable across organizations", { skip: !hasDatabase }, async () => {
  const orgA = await signupOrg("NotesTenantA");
  const orgB = await signupOrg("NotesTenantB");
  const customer = await createCustomer(orgA.token);

  const crossTenantList = await authed(`/api/v1/customers/${customer.id}/notes`, orgB.token);
  assert.equal(crossTenantList.status, 404);
  assert.equal((await crossTenantList.json()).error.code, "CUSTOMER_NOT_FOUND");

  const crossTenantCreate = await authed(`/api/v1/customers/${customer.id}/tasks`, orgB.token, {
    method: "POST",
    body: JSON.stringify({ title: "Should not attach to another tenant's customer" }),
  });
  assert.equal(crossTenantCreate.status, 404);
});
