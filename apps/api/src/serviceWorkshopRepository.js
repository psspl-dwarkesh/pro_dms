import { pool } from "./db.js";
import { HttpError } from "./errors.js";

function query(text, values) {
  if (!pool) throw new HttpError(503, "DATABASE_UNAVAILABLE", "The database is unavailable. Try again later.");
  return pool.query(text, values);
}

export async function getWorkshopDetail(organizationId, branchId, id) {
  const branchValues = branchId ? [organizationId, id, branchId] : [organizationId, id];
  const branchClause = branchId ? " and sj.branch_id = $3" : "";
  const job = await query(
    `select sj.id, sj.branch_id as "branchId", sj.repair_order_number as "repairOrderNumber", sj.status,
            sj.advisor, sj.technician, sj.complaint, sj.labour_total::float as "labourTotal",
            sj.parts_total::float as "partsTotal", sj.opened_at as "openedAt", sj.promised_at as "promisedAt",
            sj.closed_at as "closedAt", sj.invoice_status as "invoiceStatus", sj.invoice_number as "invoiceNumber",
            sj.invoice_total::float as "invoiceTotal", sj.invoiced_at as "invoicedAt",
            c.id as "customerId", c.display_name as "customerName", c.mobile as "customerMobile",
            v.id as "vehicleId", v.vin, v.registration, v.make, v.model, v.variant, v.odometer_km as "odometerKm"
       from service_jobs sj join customers c on c.id = sj.customer_id join vehicles v on v.id = sj.vehicle_id
      where sj.organization_id = $1 and sj.id = $2${branchClause}`,
    branchValues,
  );
  if (!job.rows[0]) return null;
  const [inspections, estimates, events] = await Promise.all([
    query(`select id, area, result, notes, inspected_by as "inspectedBy", inspected_at as "inspectedAt" from service_inspections where organization_id = $1 and service_job_id = $2 order by inspected_at desc limit 100`, [organizationId, id]),
    query(`select id, description, amount::float as amount, status, approved_by as "approvedBy", approved_at as "approvedAt", created_at as "createdAt" from service_estimates where organization_id = $1 and service_job_id = $2 order by created_at desc limit 50`, [organizationId, id]),
    query(`select id, event_type as "eventType", summary, actor_name as "actorName", occurred_at as "occurredAt" from service_job_events where organization_id = $1 and service_job_id = $2 order by occurred_at desc limit 100`, [organizationId, id]),
  ]);
  return { ...job.rows[0], inspections: inspections.rows, estimates: estimates.rows, events: events.rows };
}

async function assertJob(organizationId, branchId, id) {
  const values = [organizationId, id];
  let sql = "select branch_id from service_jobs where organization_id = $1 and id = $2";
  if (branchId) { values.push(branchId); sql += " and branch_id = $3"; }
  return (await query(sql, values)).rows[0];
}

export async function addInspection(organizationId, branchId, id, input) {
  const job = await assertJob(organizationId, branchId, id); if (!job) return null;
  const result = await query(`insert into service_inspections (organization_id, branch_id, service_job_id, area, result, notes, inspected_by) values ($1,$2,$3,$4,$5,$6,$7) returning id, area, result, notes, inspected_by as "inspectedBy", inspected_at as "inspectedAt"`, [organizationId, job.branch_id, id, input.area, input.result, input.notes, input.inspectedBy]);
  await query(`insert into service_job_events (organization_id, branch_id, service_job_id, event_type, summary, actor_name) values ($1,$2,$3,'inspection',$4,$5)`, [organizationId, job.branch_id, id, `${input.area}: ${input.result}`, input.inspectedBy]);
  return result.rows[0];
}

export async function addEstimate(organizationId, branchId, id, input) {
  const job = await assertJob(organizationId, branchId, id); if (!job) return null;
  const result = await query(`insert into service_estimates (organization_id, branch_id, service_job_id, description, amount, status) values ($1,$2,$3,$4,$5,'sent') returning id, description, amount::float as amount, status, created_at as "createdAt"`, [organizationId, job.branch_id, id, input.description, input.amount]);
  await query(`update service_jobs set status = 'awaiting-approval' where organization_id = $1 and id = $2`, [organizationId, id]);
  return result.rows[0];
}

export async function decideEstimate(organizationId, branchId, jobId, estimateId, input) {
  const job = await assertJob(organizationId, branchId, jobId); if (!job) return null;
  const result = await query(`update service_estimates set status=$4, approved_by=$5, approved_at=case when $4='approved' then now() else null end where organization_id=$1 and service_job_id=$2 and id=$3 and status='sent' returning id, description, amount::float as amount, status, approved_by as "approvedBy", approved_at as "approvedAt"`, [organizationId, jobId, estimateId, input.decision, input.approvedBy]);
  if (result.rows[0]) await query(`insert into service_job_events (organization_id, branch_id, service_job_id, event_type, summary, actor_name) values ($1,$2,$3,'approval',$4,$5)`, [organizationId, job.branch_id, jobId, `Estimate ${input.decision}`, input.approvedBy]);
  return result.rows[0];
}

export async function issueInvoice(organizationId, branchId, id, input) {
  const job = await assertJob(organizationId, branchId, id); if (!job) return null;
  const result = await query(`update service_jobs set invoice_status='issued', invoice_number=$3, invoice_total=labour_total+parts_total, invoiced_at=now() where organization_id=$1 and id=$2 and invoice_status='not-ready' returning invoice_status as "invoiceStatus", invoice_number as "invoiceNumber", invoice_total::float as "invoiceTotal", invoiced_at as "invoicedAt"`, [organizationId, id, input.invoiceNumber]);
  return result.rows[0];
}

