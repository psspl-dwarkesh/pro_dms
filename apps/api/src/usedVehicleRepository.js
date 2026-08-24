import { pool } from "./db.js";
import { HttpError } from "./errors.js";

function database() {
  if (!pool) throw new HttpError(503, "DATABASE_UNAVAILABLE", "The database is unavailable. Try again later.");
  return pool;
}

function query(text, values) { return database().query(text, values); }

export async function listUsedVehicles(organizationId, branchId, { search, limit, offset }) {
  const values = [organizationId];
  let where = "v.organization_id = $1 and v.intake_at is not null and v.status <> 'sold'";
  if (branchId) { values.push(branchId); where += ` and v.branch_id = $${values.length}`; }
  if (search) { values.push(`%${search}%`); where += ` and (v.vin ilike $${values.length} or v.registration ilike $${values.length} or v.make ilike $${values.length} or v.model ilike $${values.length})`; }
  values.push(limit, offset);
  const result = await query(
    `select v.id as "vehicleId", v.vin, v.registration, v.make, v.model, v.variant, v.status as "vehicleStatus",
            v.acquisition_channel as "acquisitionChannel", v.acquisition_cost::float as "acquisitionCost", v.intake_at as "intakeAt",
            v.lot_location as "lotLocation", b.name as "branchName", u.inspection_status as "inspectionStatus",
            u.inspection_grade as "inspectionGrade", u.inspection_notes as "inspectionNotes", u.inspected_at as "inspectedAt",
            coalesce(u.recon_status, 'not-started') as "reconStatus", u.asking_price::float as "askingPrice",
            u.disposal_channel as "disposalChannel", u.wholesale_buyer as "wholesaleBuyer", u.wholesale_price::float as "wholesalePrice",
            extract(day from now() - v.intake_at)::int as "stockAgeDays",
            coalesce(sum(case when rt.status <> 'cancelled' then coalesce(rt.actual_cost, rt.estimated_cost) else 0 end), 0)::float as "reconCost",
            count(rt.id) filter (where rt.status not in ('completed','cancelled'))::int as "openReconTasks"
       from vehicles v
       left join branches b on b.id = v.branch_id
       left join used_vehicle_operations u on u.vehicle_id = v.id and u.organization_id = v.organization_id
       left join vehicle_recon_tasks rt on rt.vehicle_id = v.id and rt.organization_id = v.organization_id
      where ${where}
      group by v.id, b.name, u.id
      order by v.intake_at asc limit $${values.length - 1} offset $${values.length}`,
    values,
  );
  return result.rows;
}

export async function getUsedVehicle(organizationId, vehicleId) {
  const vehicle = await query("select id from vehicles where id = $1 and organization_id = $2", [vehicleId, organizationId]);
  if (!vehicle.rowCount) return undefined;
  const tasks = await query(
    `select id, vehicle_id as "vehicleId", category, description, supplier, estimated_cost::float as "estimatedCost",
            actual_cost::float as "actualCost", status, due_at as "dueAt", completed_at as "completedAt", created_at as "createdAt"
       from vehicle_recon_tasks where organization_id = $1 and vehicle_id = $2 order by created_at desc`,
    [organizationId, vehicleId],
  );
  return { tasks: tasks.rows };
}

export async function updateUsedVehicle(organizationId, vehicleId, userId, input) {
  const result = await query(
    `insert into used_vehicle_operations (organization_id, vehicle_id, inspection_status, inspection_grade, inspection_notes, inspected_at,
       recon_status, asking_price, price_updated_at, disposal_channel, wholesale_buyer, wholesale_price, disposed_at, created_by)
     select $1, id, coalesce($4, 'not-started'), $5, $6, case when $4 in ('passed','failed') then now() end,
       coalesce($7, 'not-started'), $8, case when $8 is not null then now() end, $9, $10, $11,
       case when $9 = 'wholesale' then now() end, $3 from vehicles where id = $2 and organization_id = $1
     on conflict (organization_id, vehicle_id) do update set
       inspection_status=coalesce($4, used_vehicle_operations.inspection_status), inspection_grade=coalesce($5, used_vehicle_operations.inspection_grade),
       inspection_notes=coalesce($6, used_vehicle_operations.inspection_notes), inspected_at=case when $4 in ('passed','failed') then now() else used_vehicle_operations.inspected_at end,
       recon_status=coalesce($7, used_vehicle_operations.recon_status), asking_price=coalesce($8, used_vehicle_operations.asking_price),
       price_updated_at=case when $8 is not null then now() else used_vehicle_operations.price_updated_at end,
       disposal_channel=coalesce($9, used_vehicle_operations.disposal_channel), wholesale_buyer=coalesce($10, used_vehicle_operations.wholesale_buyer),
       wholesale_price=coalesce($11, used_vehicle_operations.wholesale_price), disposed_at=case when $9='wholesale' then now() else used_vehicle_operations.disposed_at end,
       updated_at=now() returning vehicle_id as "vehicleId"`,
    [organizationId, vehicleId, userId, input.inspectionStatus, input.inspectionGrade, input.inspectionNotes, input.reconStatus, input.askingPrice, input.disposalChannel, input.wholesaleBuyer, input.wholesalePrice],
  );
  if (result.rowCount && input.disposalChannel === "wholesale") await query("update vehicles set status='sold' where id=$1 and organization_id=$2", [vehicleId, organizationId]);
  return result.rows[0];
}
export async function createReconTask(organizationId, vehicleId, userId, input) {
  const result = await query(
    `insert into vehicle_recon_tasks (organization_id, vehicle_id, category, description, supplier, estimated_cost, status, due_at, created_by)
     select $1, id, $3, $4, $5, $6, $7, $8, $9 from vehicles where id=$2 and organization_id=$1
     returning id, vehicle_id as "vehicleId", category, description, supplier, estimated_cost::float as "estimatedCost", actual_cost::float as "actualCost", status, due_at as "dueAt", created_at as "createdAt"`,
    [organizationId, vehicleId, input.category, input.description, input.supplier, input.estimatedCost, input.status, input.dueAt, userId],
  );
  return result.rows[0];
}

export async function updateReconTask(organizationId, vehicleId, taskId, input) {
  const result = await query(
    `update vehicle_recon_tasks set status=coalesce($4,status), actual_cost=coalesce($5,actual_cost),
       completed_at=case when $4='completed' then now() else completed_at end, updated_at=now()
     where id=$1 and vehicle_id=$2 and organization_id=$3
     returning id, vehicle_id as "vehicleId", category, description, supplier, estimated_cost::float as "estimatedCost", actual_cost::float as "actualCost", status, due_at as "dueAt", completed_at as "completedAt", created_at as "createdAt"`,
    [taskId, vehicleId, organizationId, input.status, input.actualCost],
  );
  return result.rows[0];
}
