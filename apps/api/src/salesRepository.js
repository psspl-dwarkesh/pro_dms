import { pool } from "./db.js";

async function query(text, values) {
  if (!pool) throw Object.assign(new Error("Database is not configured."), { code: "DATABASE_UNAVAILABLE", status: 503 });
  return pool.query(text, values);
}

export async function salesLinksBelongToOrganization(organizationId, { branchId, customerId, vehicleId, leadId }) {
  const checks = await Promise.all([
    branchId ? query("select 1 from branches where id = $1 and organization_id = $2", [branchId, organizationId]) : null,
    customerId ? query("select 1 from customers where id = $1 and organization_id = $2", [customerId, organizationId]) : null,
    vehicleId ? query("select 1 from vehicles where id = $1 and organization_id = $2", [vehicleId, organizationId]) : null,
    leadId ? query("select 1 from leads where id = $1 and organization_id = $2", [leadId, organizationId]) : null,
  ]);
  return checks.every((result) => result === null || result.rowCount > 0);
}

export async function createTestDrive(organizationId, branchId, leadId, { vehicleId, scheduledAt, status, feedback }) {
  const result = await query(
    `insert into test_drives (organization_id, branch_id, lead_id, customer_id, vehicle_id, scheduled_at, status, feedback)
     select $1, $2, l.id, l.customer_id, $4, $5, $6, $7 from leads l
      where l.id = $3 and l.organization_id = $1 and l.customer_id is not null
     returning id, vehicle_id as "vehicleId", scheduled_at as "scheduledAt", status, feedback`,
    [organizationId, branchId, leadId, vehicleId, scheduledAt, status, feedback],
  );
  return result.rows[0];
}

export async function createQuotation(organizationId, branchId, leadId, { vehicleId, amount, status, validUntil }) {
  const result = await query(
    `insert into sales_quotations (organization_id, branch_id, lead_id, vehicle_id, amount, status, valid_until)
     select $1, $2, l.id, $4, $5, $6, $7 from leads l where l.id = $3 and l.organization_id = $1
     returning id, vehicle_id as "vehicleId", amount::float, status, valid_until as "validUntil", created_at as "createdAt"`,
    [organizationId, branchId, leadId, vehicleId, amount, status, validUntil],
  );
  return result.rows[0];
}

export async function createFollowUp(organizationId, branchId, actorUserId, leadId, { channel, summary, dueAt }) {
  const result = await query(
    `insert into sales_follow_ups (organization_id, branch_id, lead_id, owner_user_id, channel, summary, due_at)
     select $1, $2, l.id, $3, $5, $6, $7 from leads l where l.id = $4 and l.organization_id = $1
     returning id, channel, summary, due_at as "dueAt", completed_at as "completedAt", created_at as "createdAt"`,
    [organizationId, branchId, actorUserId, leadId, channel, summary, dueAt],
  );
  return result.rows[0];
}

export async function completeFollowUp(organizationId, leadId, followUpId) {
  const result = await query(
    `update sales_follow_ups set completed_at = now()
      where id = $1 and lead_id = $2 and organization_id = $3 and completed_at is null
      returning id, channel, summary, due_at as "dueAt", completed_at as "completedAt", created_at as "createdAt"`,
    [followUpId, leadId, organizationId],
  );
  return result.rows[0];
}

export async function getSalesJourney(organizationId, leadId) {
  const [testDrives, quotations, followUps] = await Promise.all([
    query(`select t.id, t.vehicle_id as "vehicleId", v.make, v.model, v.vin, v.registration,
                  t.scheduled_at as "scheduledAt", t.status, t.feedback
             from test_drives t left join vehicles v on v.id = t.vehicle_id and v.organization_id = t.organization_id
            where t.organization_id = $1 and t.lead_id = $2 order by t.scheduled_at desc`, [organizationId, leadId]),
    query(`select q.id, q.vehicle_id as "vehicleId", v.make, v.model, q.amount::float, q.status,
                  q.valid_until as "validUntil", q.created_at as "createdAt"
             from sales_quotations q left join vehicles v on v.id = q.vehicle_id and v.organization_id = q.organization_id
            where q.organization_id = $1 and q.lead_id = $2 order by q.created_at desc`, [organizationId, leadId]),
    query(`select id, channel, summary, due_at as "dueAt", completed_at as "completedAt", created_at as "createdAt"
             from sales_follow_ups where organization_id = $1 and lead_id = $2 order by due_at`, [organizationId, leadId]),
  ]);
  return { testDrives: testDrives.rows, quotations: quotations.rows, followUps: followUps.rows };
}
