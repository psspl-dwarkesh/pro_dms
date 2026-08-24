import assert from "node:assert/strict";
import test from "node:test";
import { CAPABILITIES, hasPermission, roleCapabilities } from "../src/permissions.js";

test("admin holds every defined capability", () => {
  for (const capability of Object.values(CAPABILITIES)) {
    assert.equal(hasPermission("admin", capability), true, `admin should hold ${capability}`);
  }
});

test("receptionist cannot manage finance", () => {
  assert.equal(hasPermission("receptionist", CAPABILITIES.FINANCE_MANAGE), false);
});

test("finance_manager holds sensitive finance read but sales_manager does not", () => {
  assert.equal(hasPermission("finance_manager", CAPABILITIES.FINANCE_SENSITIVE_READ), true);
  assert.equal(hasPermission("sales_manager", CAPABILITIES.FINANCE_SENSITIVE_READ), false);
});

test("only admin and general_manager can read the audit log", () => {
  assert.equal(hasPermission("admin", CAPABILITIES.ADMIN_AUDIT_READ), true);
  assert.equal(hasPermission("general_manager", CAPABILITIES.ADMIN_AUDIT_READ), true);
  assert.equal(hasPermission("service_advisor", CAPABILITIES.ADMIN_AUDIT_READ), false);
  assert.equal(hasPermission("receptionist", CAPABILITIES.ADMIN_AUDIT_READ), false);
});

test("an unknown role holds no capabilities (deny by default)", () => {
  assert.equal(hasPermission("not-a-real-role", CAPABILITIES.CUSTOMERS_READ), false);
});

test("administration capabilities extend the existing deny-by-default role map", () => {
  assert.equal(hasPermission("admin", CAPABILITIES.ADMIN_WORKFORCE_MANAGE), true);
  assert.equal(hasPermission("general_manager", CAPABILITIES.ADMIN_WORKFORCE_MANAGE), false);
  assert.deepEqual(roleCapabilities("not-a-real-role"), []);
});
