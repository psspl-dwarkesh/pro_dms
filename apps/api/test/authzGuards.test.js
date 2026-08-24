import assert from "node:assert/strict";
import test from "node:test";
import { wouldRemoveLastAdmin } from "../src/authzGuards.js";

const admin1 = { id: "u1", role: "admin", isActive: true };
const admin2 = { id: "u2", role: "admin", isActive: true };
const salesManager = { id: "u3", role: "sales_manager", isActive: true };
const inactiveAdmin = { id: "u4", role: "admin", isActive: false };

test("deactivating the sole active admin is blocked", () => {
  assert.equal(wouldRemoveLastAdmin([admin1, salesManager], "u1", { nextIsActive: false }), true);
});

test("demoting the sole active admin to a non-admin role is blocked", () => {
  assert.equal(wouldRemoveLastAdmin([admin1, salesManager], "u1", { nextRole: "sales_manager" }), true);
});

test("deactivating one of two active admins is allowed", () => {
  assert.equal(wouldRemoveLastAdmin([admin1, admin2, salesManager], "u1", { nextIsActive: false }), false);
});

test("editing a non-admin's role never trips the guard", () => {
  assert.equal(wouldRemoveLastAdmin([admin1, salesManager], "u3", { nextRole: "receptionist", nextIsActive: false }), false);
});

test("reactivating a previously inactive admin is always allowed", () => {
  assert.equal(wouldRemoveLastAdmin([inactiveAdmin, salesManager], "u4", { nextIsActive: true }), false);
});

test("an org with zero active admins already is reported as blocked for any target", () => {
  assert.equal(wouldRemoveLastAdmin([inactiveAdmin, salesManager], "u3", { nextRole: "admin", nextIsActive: false }), true);
});

test("promoting a user to admin while active can resolve a zero-admin state", () => {
  assert.equal(wouldRemoveLastAdmin([inactiveAdmin, salesManager], "u3", { nextRole: "admin", nextIsActive: true }), false);
});
