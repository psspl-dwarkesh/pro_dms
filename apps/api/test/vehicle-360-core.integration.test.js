// Vehicle 360 core: intake, ownership transfer, documents, appraisal, valuation, stock/location,
// auction, and rental/demo disposition. Same pattern as authorization.integration.test.js -- needs
// a real, disposable PostgreSQL database, gated on DATABASE_URL, and skips cleanly when it is not
// set.
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

async function createVehicle(token, overrides = {}) {
  const vin = `TESTVIN${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
  const response = await authed("/api/v1/vehicles", token, {
    method: "POST",
    body: JSON.stringify({ vin, make: "Toyota", model: "Camry", ...overrides }),
  });
  assert.equal(response.status, 201);
  return (await response.json()).vehicle;
}

async function createCustomer(token, overrides = {}) {
  const response = await authed("/api/v1/customers", token, {
    method: "POST",
    body: JSON.stringify({ customerType: "individual", displayName: "Vehicle 360 Customer", ...overrides }),
  });
  assert.equal(response.status, 201);
  return (await response.json()).customer;
}

test("intake records the acquisition channel, cost, and stock location", { skip: !hasDatabase }, async () => {
  const org = await signupOrg("Intake");
  const vehicle = await createVehicle(org.token, {
    branchId: org.user.branchId,
    lotLocation: "Bay 4",
    acquisitionChannel: "trade-in",
    acquisitionCost: 18000,
  });

  const detail = await authed(`/api/v1/vehicles/${vehicle.id}/360`, org.token);
  assert.equal(detail.status, 200);
  const { vehicle: fetched } = await detail.json();
  assert.equal(fetched.acquisitionChannel, "trade-in");
  assert.equal(fetched.acquisitionCost, 18000);
  assert.equal(fetched.lotLocation, "Bay 4");
  assert.ok(fetched.branchName);
});

test("transferring ownership ends the previous entry and becomes the current owner", { skip: !hasDatabase }, async () => {
  const org = await signupOrg("Ownership");
  const vehicle = await createVehicle(org.token);
  const first = await createCustomer(org.token, { displayName: "First Owner" });
  const second = await createCustomer(org.token, { displayName: "Second Owner" });

  const firstTransfer = await authed(`/api/v1/vehicles/${vehicle.id}/ownership/transfer`, org.token, {
    method: "POST",
    body: JSON.stringify({ customerId: first.id }),
  });
  assert.equal(firstTransfer.status, 201);

  const secondTransfer = await authed(`/api/v1/vehicles/${vehicle.id}/ownership/transfer`, org.token, {
    method: "POST",
    body: JSON.stringify({ customerId: second.id, transferReason: "Sold privately" }),
  });
  assert.equal(secondTransfer.status, 201);

  const history = await authed(`/api/v1/vehicles/${vehicle.id}/ownership`, org.token);
  const { ownership } = await history.json();
  assert.equal(ownership.length, 2);
  const current = ownership.find((entry) => entry.endedOn === null);
  assert.equal(current.customerName, "Second Owner");
  assert.equal(current.transferReason, "Sold privately");

  const detail = await authed(`/api/v1/vehicles/${vehicle.id}/360`, org.token);
  const { vehicle: fetched } = await detail.json();
  assert.equal(fetched.ownerName, "Second Owner");
});

test("a document stores a reference, never a file body, and its status can change", { skip: !hasDatabase }, async () => {
  const org = await signupOrg("VehicleDocuments");
  const vehicle = await createVehicle(org.token);

  const created = await authed(`/api/v1/vehicles/${vehicle.id}/documents`, org.token, {
    method: "POST",
    body: JSON.stringify({ documentType: "registration_certificate", label: "NSW rego papers", storageReference: "vault://demo/rego-001" }),
  });
  assert.equal(created.status, 201);
  const { document } = await created.json();
  assert.equal(document.status, "received");

  const verified = await authed(`/api/v1/vehicles/${vehicle.id}/documents/${document.id}`, org.token, {
    method: "PATCH",
    body: JSON.stringify({ status: "verified" }),
  });
  assert.equal(verified.status, 200);
  assert.equal((await verified.json()).document.status, "verified");
});

test("accepting a trade-in appraisal logs a trade valuation automatically", { skip: !hasDatabase }, async () => {
  const org = await signupOrg("Appraisal");
  const vehicle = await createVehicle(org.token);

  const created = await authed(`/api/v1/vehicles/${vehicle.id}/appraisals`, org.token, {
    method: "POST",
    body: JSON.stringify({ conditionGrade: "good", odometerKm: 45000, offeredValue: 21000 }),
  });
  assert.equal(created.status, 201);
  const { appraisal } = await created.json();
  assert.equal(appraisal.status, "draft");

  const accepted = await authed(`/api/v1/vehicles/${vehicle.id}/appraisals/${appraisal.id}`, org.token, {
    method: "PATCH",
    body: JSON.stringify({ status: "accepted" }),
  });
  assert.equal(accepted.status, 200);
  const { appraisal: updated } = await accepted.json();
  assert.equal(updated.status, "accepted");
  assert.ok(updated.decidedAt);

  const valuations = await authed(`/api/v1/vehicles/${vehicle.id}/valuations`, org.token);
  const { valuations: rows } = await valuations.json();
  assert.ok(rows.some((row) => row.source === "trade" && row.value === 21000));
});

test("a market valuation refreshes the vehicle's cached market value", { skip: !hasDatabase }, async () => {
  const org = await signupOrg("Valuation");
  const vehicle = await createVehicle(org.token, { marketValue: 30000 });

  const created = await authed(`/api/v1/vehicles/${vehicle.id}/valuations`, org.token, {
    method: "POST",
    body: JSON.stringify({ source: "market", value: 32500, notes: "Refreshed from a comparable sale" }),
  });
  assert.equal(created.status, 201);

  const detail = await authed(`/api/v1/vehicles/${vehicle.id}/360`, org.token);
  const { vehicle: fetched } = await detail.json();
  assert.equal(fetched.marketValue, 32500);
});

test("an invalid stock status is rejected before it reaches the database", { skip: !hasDatabase }, async () => {
  const org = await signupOrg("StockStatus");
  const vehicle = await createVehicle(org.token);

  const response = await authed(`/api/v1/vehicles/${vehicle.id}`, org.token, {
    method: "PATCH",
    body: JSON.stringify({ status: "not-a-real-status" }),
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, "INVALID_INPUT");
});

test("an auction listing moves the vehicle to auction status, and a bid moves it to bidding", { skip: !hasDatabase }, async () => {
  const org = await signupOrg("Auction");
  const vehicle = await createVehicle(org.token);

  const listed = await authed(`/api/v1/vehicles/${vehicle.id}/auction-listings`, org.token, {
    method: "POST",
    body: JSON.stringify({ auctionHouse: "Manheim", reservePrice: 15000, status: "listed" }),
  });
  assert.equal(listed.status, 201);
  const { listing } = await listed.json();
  assert.equal(listing.status, "listed");

  const afterListing = await authed(`/api/v1/vehicles/${vehicle.id}/360`, org.token);
  assert.equal((await afterListing.json()).vehicle.status, "auction");

  const bid = await authed(`/api/v1/vehicles/${vehicle.id}/auction-listings/${listing.id}/bids`, org.token, {
    method: "POST",
    body: JSON.stringify({ bidderName: "Wholesale Buyer Co", amount: 15500 }),
  });
  assert.equal(bid.status, 201);

  const listings = await authed(`/api/v1/vehicles/${vehicle.id}/auction-listings`, org.token);
  const { listings: rows } = await listings.json();
  assert.equal(rows[0].status, "bidding");
  assert.equal(rows[0].bids.length, 1);

  const sold = await authed(`/api/v1/vehicles/${vehicle.id}/auction-listings/${listing.id}`, org.token, {
    method: "PATCH",
    body: JSON.stringify({ status: "sold", soldPrice: 15500 }),
  });
  assert.equal(sold.status, 200);
  const afterSale = await authed(`/api/v1/vehicles/${vehicle.id}/360`, org.token);
  assert.equal((await afterSale.json()).vehicle.status, "sold");
});

test("a vehicle cannot be listed for auction while checked out for a demo", { skip: !hasDatabase }, async () => {
  const org = await signupOrg("Availability");
  const vehicle = await createVehicle(org.token);

  const checkout = await authed(`/api/v1/vehicles/${vehicle.id}/dispositions`, org.token, {
    method: "POST",
    body: JSON.stringify({ dispositionType: "demo", odometerOut: 1000 }),
  });
  assert.equal(checkout.status, 201);

  const blockedListing = await authed(`/api/v1/vehicles/${vehicle.id}/auction-listings`, org.token, {
    method: "POST",
    body: JSON.stringify({ status: "listed" }),
  });
  assert.equal(blockedListing.status, 409);
  assert.equal((await blockedListing.json()).error.code, "VEHICLE_UNAVAILABLE");

  const blockedSecondCheckout = await authed(`/api/v1/vehicles/${vehicle.id}/dispositions`, org.token, {
    method: "POST",
    body: JSON.stringify({ dispositionType: "rental" }),
  });
  assert.equal(blockedSecondCheckout.status, 409);
});

test("checking a vehicle back in updates its odometer and restores stock status", { skip: !hasDatabase }, async () => {
  const org = await signupOrg("CheckIn");
  const vehicle = await createVehicle(org.token, { odometerKm: 5000 });

  const checkout = await authed(`/api/v1/vehicles/${vehicle.id}/dispositions`, org.token, {
    method: "POST",
    body: JSON.stringify({ dispositionType: "demo", odometerOut: 5000 }),
  });
  const { disposition } = await checkout.json();

  const afterCheckout = await authed(`/api/v1/vehicles/${vehicle.id}/360`, org.token);
  assert.equal((await afterCheckout.json()).vehicle.status, "demo");

  const checkIn = await authed(`/api/v1/vehicles/${vehicle.id}/dispositions/${disposition.id}`, org.token, {
    method: "PATCH",
    body: JSON.stringify({ status: "completed", odometerIn: 5120 }),
  });
  assert.equal(checkIn.status, 200);

  const afterCheckIn = await authed(`/api/v1/vehicles/${vehicle.id}/360`, org.token);
  const { vehicle: fetched } = await afterCheckIn.json();
  assert.equal(fetched.status, "in-stock");
  assert.equal(fetched.odometerKm, 5120);
});

test("a role limited to reading vehicles cannot record an appraisal or transfer ownership", { skip: !hasDatabase }, async () => {
  const org = await signupOrg("ReadOnlyVehicles");
  const vehicle = await createVehicle(org.token);
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

  const read = await authed(`/api/v1/vehicles/${vehicle.id}/appraisals`, token);
  assert.equal(read.status, 200);

  const write = await authed(`/api/v1/vehicles/${vehicle.id}/appraisals`, token, {
    method: "POST",
    body: JSON.stringify({ conditionGrade: "good" }),
  });
  assert.equal(write.status, 403);
  assert.equal((await write.json()).error.code, "PERMISSION_DENIED");
});

test("vehicle sub-resources are not reachable across organizations", { skip: !hasDatabase }, async () => {
  const orgA = await signupOrg("VehicleTenantA");
  const orgB = await signupOrg("VehicleTenantB");
  const vehicle = await createVehicle(orgA.token);

  const crossTenantRead = await authed(`/api/v1/vehicles/${vehicle.id}/documents`, orgB.token);
  assert.equal(crossTenantRead.status, 404);
  assert.equal((await crossTenantRead.json()).error.code, "VEHICLE_NOT_FOUND");

  const crossTenantCreate = await authed(`/api/v1/vehicles/${vehicle.id}/valuations`, orgB.token, {
    method: "POST",
    body: JSON.stringify({ source: "manual", value: 1000 }),
  });
  assert.equal(crossTenantCreate.status, 404);
});
