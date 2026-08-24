import { DatabaseUnavailableError, pool } from "./db.js";

async function run(text, values) {
  if (!pool) throw new DatabaseUnavailableError();
  try { return await pool.query(text, values); }
  catch (cause) { throw new DatabaseUnavailableError({ cause }); }
}

export async function getPartsWorkspace(organizationId, branchId, { search, lowStock, limit, offset }) {
  const values = [organizationId, branchId];
  let filter = "p.organization_id = $1";
  if (search) { values.push(`%${search}%`); filter += ` and (p.sku ilike $${values.length} or p.name ilike $${values.length} or coalesce(p.supplier_name, '') ilike $${values.length})`; }
  if (lowStock) filter += " and coalesce(bs.quantity_on_hand, 0) - coalesce(r.reserved, 0) <= p.reorder_point";
  values.push(limit, offset);
  const [parts, reservations, purchaseOrders, transfers] = await Promise.all([
    run(`select p.id, p.sku, p.name, p.description, p.supplier_name as "supplierName", p.bin_location as "binLocation",
                coalesce(bs.quantity_on_hand, 0) as "quantityOnHand", coalesce(r.reserved, 0)::int as "reservedQuantity",
                (coalesce(bs.quantity_on_hand, 0) - coalesce(r.reserved, 0))::int as "availableQuantity",
                p.reorder_point as "reorderPoint", p.unit_cost::float as "unitCost", p.retail_price::float as "retailPrice",
                p.received_at as "receivedAt", greatest(0, extract(day from now() - p.received_at))::int as "ageDays"
           from parts p
           left join part_branch_stock bs on bs.part_id=p.id and bs.organization_id=p.organization_id and bs.branch_id=$2
           left join (select part_id, sum(quantity)::int reserved from part_reservations where organization_id=$1 and status='reserved' and (branch_id=$2 or $2 is null) group by part_id) r on r.part_id=p.id
          where ${filter} order by p.name limit $${values.length - 1} offset $${values.length}`, values),
    run(`select r.id, r.part_id as "partId", p.sku, p.name as "partName", r.vehicle_id as "vehicleId", v.registration,
                r.service_job_id as "serviceJobId", sj.repair_order_number as "repairOrderNumber", r.quantity, r.status, r.notes, r.reserved_at as "reservedAt"
           from part_reservations r join parts p on p.id=r.part_id left join vehicles v on v.id=r.vehicle_id
           left join service_jobs sj on sj.id=r.service_job_id
          where r.organization_id=$1 and (r.branch_id=$2 or $2 is null) and r.status in ('reserved','allocated') order by r.reserved_at desc limit 50`, [organizationId, branchId]),
    run(`select po.id, po.order_number as "orderNumber", po.supplier_name as "supplierName", po.status, po.expected_at as "expectedAt", po.created_at as "createdAt",
                coalesce(sum(i.quantity_ordered),0)::int as "quantityOrdered", coalesce(sum(i.quantity_received),0)::int as "quantityReceived",
                coalesce(sum(i.quantity_ordered*i.unit_cost),0)::float as total
           from part_purchase_orders po left join part_purchase_order_items i on i.purchase_order_id=po.id
          where po.organization_id=$1 and (po.branch_id=$2 or $2 is null) group by po.id order by po.created_at desc limit 25`, [organizationId, branchId]),
    run(`select t.id, t.part_id as "partId", p.sku, p.name as "partName", fb.name as "fromBranchName", tb.name as "toBranchName",
                t.quantity, t.status, t.requested_at as "requestedAt", t.received_at as "receivedAt"
           from part_transfers t join parts p on p.id=t.part_id join branches fb on fb.id=t.from_branch_id join branches tb on tb.id=t.to_branch_id
          where t.organization_id=$1 and ($2 is null or t.from_branch_id=$2 or t.to_branch_id=$2) order by t.requested_at desc limit 25`, [organizationId, branchId]),
  ]);
  return { parts: parts.rows, reservations: reservations.rows, purchaseOrders: purchaseOrders.rows, transfers: transfers.rows };
}

async function transaction(work) {
  if (!pool) throw new DatabaseUnavailableError();
  const client = await pool.connect();
  try { await client.query("begin"); const result = await work(client); await client.query("commit"); return result; }
  catch (cause) { await client.query("rollback"); if (cause?.status) throw cause; throw new DatabaseUnavailableError({ cause }); }
  finally { client.release(); }
}

export async function createCataloguePart(organizationId, branchId, input) {
  return transaction(async (client) => {
    try {
      const result = await client.query(`insert into parts (organization_id,sku,name,quantity_on_hand,reorder_point,unit_cost,retail_price)
        values ($1,$2,$3,$4,$5,$6,$7) returning id,sku,name,quantity_on_hand as "quantityOnHand",reorder_point as "reorderPoint",unit_cost::float as "unitCost",retail_price::float as "retailPrice"`,
        [organizationId, input.sku, input.name, input.quantityOnHand, input.reorderPoint, input.unitCost, input.retailPrice]);
      if (branchId) await client.query("insert into part_branch_stock (organization_id,branch_id,part_id,quantity_on_hand) values ($1,$2,$3,$4)", [organizationId, branchId, result.rows[0].id, input.quantityOnHand]);
      return result.rows[0];
    } catch (cause) {
      if (cause?.code === "23505") throw Object.assign(new Error("A part with that SKU already exists."), { status: 409, code: "PART_SKU_IN_USE", expose: true });
      throw cause;
    }
  });
}

async function ownedPart(client, organizationId, partId) {
  const result = await client.query("select * from parts where id=$1 and organization_id=$2 for update", [partId, organizationId]);
  if (!result.rowCount) throw Object.assign(new Error("Part not found."), { status: 404, code: "PART_NOT_FOUND", expose: true });
  return result.rows[0];
}

export async function createReservation(organizationId, branchId, actorUserId, input) {
  return transaction(async (client) => {
    const part = await ownedPart(client, organizationId, input.partId);
    const stock = await client.query("select coalesce(quantity_on_hand,$3)::int quantity from part_branch_stock where organization_id=$1 and branch_id=$2 and part_id=$4", [organizationId, branchId, part.quantity_on_hand, input.partId]);
    const reserved = await client.query("select coalesce(sum(quantity),0)::int quantity from part_reservations where organization_id=$1 and branch_id=$2 and part_id=$3 and status='reserved'", [organizationId, branchId, input.partId]);
    const available = (stock.rows[0]?.quantity ?? part.quantity_on_hand) - reserved.rows[0].quantity;
    if (input.quantity > available) throw Object.assign(new Error("Not enough available stock for this reservation."), { status: 409, code: "PART_STOCK_UNAVAILABLE", expose: true });
    if (input.vehicleId) {
      const vehicle = await client.query("select id from vehicles where id=$1 and organization_id=$2", [input.vehicleId, organizationId]);
      if (!vehicle.rowCount) throw Object.assign(new Error("Vehicle not found."), { status: 404, code: "VEHICLE_NOT_FOUND", expose: true });
    }
    if (input.serviceJobId) {
      const job = await client.query("select id,vehicle_id from service_jobs where id=$1 and organization_id=$2", [input.serviceJobId, organizationId]);
      if (!job.rowCount) throw Object.assign(new Error("Repair order not found."), { status: 404, code: "SERVICE_JOB_NOT_FOUND", expose: true });
      if (input.vehicleId && job.rows[0].vehicle_id !== input.vehicleId) throw Object.assign(new Error("The repair order is linked to a different vehicle."), { status: 422, code: "PART_ALLOCATION_VEHICLE_MISMATCH", expose: true });
    }
    const result = await client.query(`insert into part_reservations (organization_id,branch_id,part_id,vehicle_id,service_job_id,quantity,notes,reserved_by)
      values ($1,$2,$3,$4,$5,$6,$7,$8) returning id,part_id as "partId",vehicle_id as "vehicleId",service_job_id as "serviceJobId",quantity,status,notes,reserved_at as "reservedAt"`,
      [organizationId, branchId, input.partId, input.vehicleId, input.serviceJobId, input.quantity, input.notes, actorUserId]);
    return result.rows[0];
  });
}

export async function updateReservation(organizationId, branchId, id, status, actorUserId) {
  return transaction(async (client) => {
    const found = await client.query(`select r.*, p.quantity_on_hand, p.retail_price from part_reservations r join parts p on p.id=r.part_id
      where r.id=$1 and r.organization_id=$2 and (r.branch_id=$3 or $3 is null) for update`, [id, organizationId, branchId]);
    if (!found.rowCount) return undefined;
    const row = found.rows[0];
    if (status === "allocated" && row.status !== "reserved") throw Object.assign(new Error("Only reserved stock can be allocated."), { status: 409, code: "INVALID_RESERVATION_STATE", expose: true });
    if (status === "allocated") {
      const stock = await client.query(`insert into part_branch_stock (organization_id,branch_id,part_id,quantity_on_hand)
        values ($1,$2,$3,$4) on conflict (organization_id,branch_id,part_id) do update set quantity_on_hand=part_branch_stock.quantity_on_hand-$5,updated_at=now()
        where part_branch_stock.quantity_on_hand >= $5 returning quantity_on_hand`, [organizationId, row.branch_id, row.part_id, row.quantity_on_hand, row.quantity]);
      if (!stock.rowCount) throw Object.assign(new Error("Stock changed and is no longer available."), { status: 409, code: "PART_STOCK_UNAVAILABLE", expose: true });
      await client.query("update parts set quantity_on_hand=greatest(0,quantity_on_hand-$3),updated_at=now() where id=$1 and organization_id=$2", [row.part_id, organizationId, row.quantity]);
      await client.query(`insert into part_stock_movements (organization_id,branch_id,part_id,quantity_delta,movement_type,reference_type,reference_id,actor_user_id)
        values ($1,$2,$3,$4,'reservation-allocation','reservation',$5,$6)`, [organizationId, row.branch_id, row.part_id, -row.quantity, id, actorUserId]);
      if (row.service_job_id) await client.query("update service_jobs set parts_total=parts_total+$3 where id=$1 and organization_id=$2", [row.service_job_id, organizationId, Number(row.retail_price) * row.quantity]);
    }
    const result = await client.query("update part_reservations set status=$4,updated_at=now() where id=$1 and organization_id=$2 and (branch_id=$3 or $3 is null) returning id,part_id as \"partId\",quantity,status", [id, organizationId, branchId, status]);
    return result.rows[0];
  });
}

export async function createPurchaseOrder(organizationId, branchId, actorUserId, input) {
  return transaction(async (client) => {
    await ownedPart(client, organizationId, input.partId);
    const po = await client.query(`insert into part_purchase_orders (organization_id,branch_id,order_number,supplier_name,status,expected_at,created_by)
      values ($1,$2,$3,$4,'ordered',$5,$6) returning id,order_number as "orderNumber",supplier_name as "supplierName",status,expected_at as "expectedAt",created_at as "createdAt"`,
      [organizationId, branchId, input.orderNumber, input.supplierName, input.expectedAt, actorUserId]);
    await client.query("insert into part_purchase_order_items (purchase_order_id,part_id,quantity_ordered,unit_cost) values ($1,$2,$3,$4)", [po.rows[0].id, input.partId, input.quantity, input.unitCost]);
    return po.rows[0];
  });
}

export async function receivePurchaseOrder(organizationId, branchId, id, actorUserId) {
  return transaction(async (client) => {
    const order = await client.query("select * from part_purchase_orders where id=$1 and organization_id=$2 and (branch_id=$3 or $3 is null) for update", [id, organizationId, branchId]);
    if (!order.rowCount) return undefined;
    if (!["ordered", "part-received"].includes(order.rows[0].status)) throw Object.assign(new Error("This purchase order cannot be received."), { status: 409, code: "INVALID_PURCHASE_ORDER_STATE", expose: true });
    const items = await client.query("select * from part_purchase_order_items where purchase_order_id=$1", [id]);
    for (const item of items.rows) {
      const delta = item.quantity_ordered - item.quantity_received;
      if (delta <= 0) continue;
      await client.query(`insert into part_branch_stock (organization_id,branch_id,part_id,quantity_on_hand) values ($1,$2,$3,$4)
        on conflict (organization_id,branch_id,part_id) do update set quantity_on_hand=part_branch_stock.quantity_on_hand+$4,updated_at=now()`, [organizationId, order.rows[0].branch_id, item.part_id, delta]);
      await client.query("update parts set quantity_on_hand=quantity_on_hand+$3,unit_cost=$4,received_at=now(),updated_at=now() where id=$1 and organization_id=$2", [item.part_id, organizationId, delta, item.unit_cost]);
      await client.query("update part_purchase_order_items set quantity_received=quantity_ordered where id=$1", [item.id]);
      await client.query(`insert into part_stock_movements (organization_id,branch_id,part_id,quantity_delta,movement_type,reference_type,reference_id,actor_user_id)
        values ($1,$2,$3,$4,'purchase-receipt','purchase-order',$5,$6)`, [organizationId, order.rows[0].branch_id, item.part_id, delta, id, actorUserId]);
    }
    const updated = await client.query("update part_purchase_orders set status='received',updated_at=now() where id=$1 returning id,order_number as \"orderNumber\",status", [id]);
    return updated.rows[0];
  });
}

export async function createTransfer(organizationId, actorUserId, input) {
  return transaction(async (client) => {
    const part = await ownedPart(client, organizationId, input.partId);
    const branches = await client.query("select id from branches where organization_id=$1 and id=any($2::uuid[])", [organizationId, [input.fromBranchId, input.toBranchId]]);
    if (branches.rowCount !== 2) throw Object.assign(new Error("A transfer branch was not found."), { status: 404, code: "BRANCH_NOT_FOUND", expose: true });
    await client.query(`insert into part_branch_stock (organization_id,branch_id,part_id,quantity_on_hand) values ($1,$2,$3,$4)
      on conflict (organization_id,branch_id,part_id) do nothing`, [organizationId, input.fromBranchId, input.partId, part.quantity_on_hand]);
    const stock = await client.query("select quantity_on_hand::int quantity from part_branch_stock where organization_id=$1 and branch_id=$2 and part_id=$3", [organizationId, input.fromBranchId, input.partId]);
    if ((stock.rows[0]?.quantity ?? part.quantity_on_hand) < input.quantity) throw Object.assign(new Error("The source branch does not have enough stock."), { status: 409, code: "PART_STOCK_UNAVAILABLE", expose: true });
    const result = await client.query(`insert into part_transfers (organization_id,part_id,from_branch_id,to_branch_id,quantity,status,requested_by)
      values ($1,$2,$3,$4,$5,'requested',$6) returning id,part_id as "partId",from_branch_id as "fromBranchId",to_branch_id as "toBranchId",quantity,status,requested_at as "requestedAt"`,
      [organizationId, input.partId, input.fromBranchId, input.toBranchId, input.quantity, actorUserId]);
    return result.rows[0];
  });
}

export async function receiveTransfer(organizationId, branchId, id, actorUserId) {
  return transaction(async (client) => {
    const transfer = await client.query("select * from part_transfers where id=$1 and organization_id=$2 and ($3 is null or to_branch_id=$3) for update", [id, organizationId, branchId]);
    if (!transfer.rowCount) return undefined;
    const row = transfer.rows[0];
    if (!["requested", "in-transit"].includes(row.status)) throw Object.assign(new Error("This transfer cannot be received."), { status: 409, code: "INVALID_TRANSFER_STATE", expose: true });
    const source = await client.query(`insert into part_branch_stock (organization_id,branch_id,part_id,quantity_on_hand) values ($1,$2,$3,0)
      on conflict (organization_id,branch_id,part_id) do update set quantity_on_hand=part_branch_stock.quantity_on_hand-$4,updated_at=now()
      where part_branch_stock.quantity_on_hand >= $4 returning quantity_on_hand`, [organizationId, row.from_branch_id, row.part_id, row.quantity]);
    if (!source.rowCount) throw Object.assign(new Error("The source branch no longer has enough stock."), { status: 409, code: "PART_STOCK_UNAVAILABLE", expose: true });
    await client.query(`insert into part_branch_stock (organization_id,branch_id,part_id,quantity_on_hand) values ($1,$2,$3,$4)
      on conflict (organization_id,branch_id,part_id) do update set quantity_on_hand=part_branch_stock.quantity_on_hand+$4,updated_at=now()`, [organizationId, row.to_branch_id, row.part_id, row.quantity]);
    await client.query(`insert into part_stock_movements (organization_id,branch_id,part_id,quantity_delta,movement_type,reference_type,reference_id,actor_user_id)
      values ($1,$2,$3,$4,'transfer-out','transfer',$5,$6),($1,$7,$3,$8,'transfer-in','transfer',$5,$6)`, [organizationId, row.from_branch_id, row.part_id, -row.quantity, id, actorUserId, row.to_branch_id, row.quantity]);
    const result = await client.query("update part_transfers set status='received',received_at=now() where id=$1 returning id,part_id as \"partId\",quantity,status,received_at as \"receivedAt\"", [id]);
    return result.rows[0];
  });
}
