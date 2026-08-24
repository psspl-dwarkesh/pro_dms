import assert from "node:assert/strict";
import test from "node:test";
import { CAPABILITIES, hasPermission } from "../src/permissions.js";
import { parseAnalyticsQuery } from "../src/routes/analytics.js";

const orgWide = { role: "general_manager", branchId: null };

test("analytics query supplies a bounded 30-day default range", () => {
  assert.deepEqual(parseAnalyticsQuery({}, orgWide, new Date("2026-08-24T10:00:00Z")), {
    from: "2026-07-26",
    to: "2026-08-24",
    branchId: null,
  });
});

test("analytics query rejects invalid and overlong ranges", () => {
  assert.throws(() => parseAnalyticsQuery({ from: "2026-02-30", to: "2026-03-01" }, orgWide), { code: "INVALID_ANALYTICS_DATE" });
  assert.throws(() => parseAnalyticsQuery({ from: "2025-01-01", to: "2026-08-24" }, orgWide), { code: "INVALID_ANALYTICS_RANGE" });
});

test("branch-scoped users cannot request another branch", () => {
  const branchId = "11111111-1111-4111-8111-111111111111";
  const otherBranch = "22222222-2222-4222-8222-222222222222";
  assert.equal(parseAnalyticsQuery({ branchId }, { role: "sales_manager", branchId }).branchId, branchId);
  assert.throws(() => parseAnalyticsQuery({ branchId: otherBranch }, { role: "sales_manager", branchId }), { code: "BRANCH_SCOPE_DENIED" });
});

test("analytics is limited to explicitly approved management roles", () => {
  for (const role of ["admin", "general_manager", "sales_manager", "finance_manager"]) {
    assert.equal(hasPermission(role, CAPABILITIES.ANALYTICS_READ), true, `${role} should read analytics`);
  }
  for (const role of ["bdc_rep", "service_advisor", "receptionist"]) {
    assert.equal(hasPermission(role, CAPABILITIES.ANALYTICS_READ), false, `${role} should not read analytics`);
  }
});
