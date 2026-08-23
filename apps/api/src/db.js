import pg from "pg";

export function poolConnectionOptions(connectionString) {
  const [endpoint, query = ""] = String(connectionString).split("?", 2);
  const parameters = new URLSearchParams(query);
  const sslMode = parameters.get("sslmode");

  if (sslMode !== "require" && sslMode !== "verify-full") {
    return { connectionString };
  }

  parameters.delete("sslmode");
  const remainingQuery = parameters.toString();
  return {
    connectionString: remainingQuery ? `${endpoint}?${remainingQuery}` : endpoint,
    ssl: { rejectUnauthorized: true },
  };
}

export class DatabaseUnavailableError extends Error {
  constructor(options = undefined) {
    super("The database is temporarily unavailable.", options);
    this.name = "DatabaseUnavailableError";
    this.status = 503;
    this.code = "DATABASE_UNAVAILABLE";
    this.expose = true;
  }
}

export const pool = process.env.DATABASE_URL
  ? new pg.Pool({
      ...poolConnectionOptions(process.env.DATABASE_URL),
      max: Number(process.env.DATABASE_POOL_MAX ?? 5),
      connectionTimeoutMillis: Number(process.env.DATABASE_CONNECT_TIMEOUT_MS ?? 5000),
      idleTimeoutMillis: 10000,
      allowExitOnIdle: true,
    })
  : null;

// pg emits "error" on the pool when an already-connected, idle client fails in the background
// (dropped connection, Neon compute suspend/resume, network blip). Without this listener, Node
// treats that as an uncaught exception and kills the entire API process for every in-flight
// request, not just the affected one. Logging it here lets the pool recover the next query instead.
pool?.on("error", (error) => {
  console.error(JSON.stringify({ level: "error", message: "database pool idle client error", error: error.message }));
});

async function query(text, values = undefined) {
  if (!pool) throw new DatabaseUnavailableError();
  try {
    return await pool.query(text, values);
  } catch (cause) {
    if (cause instanceof DatabaseUnavailableError) throw cause;
    throw new DatabaseUnavailableError({ cause });
  }
}

export async function databaseStatus() {
  if (!pool) return { status: "not-configured" };
  const startedAt = performance.now();
  try {
    await pool.query("select 1");
    return { status: "connected", latencyMs: Math.round(performance.now() - startedAt) };
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      event: "database_health_failed",
      errorName: error?.name ?? "Error",
      errorCode: error?.code ?? "DATABASE_ERROR",
    }));
    return { status: "unavailable" };
  }
}

export function clampLimit(value, fallback = 25, max = 100) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

export function clampOffset(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

// ---------------------------------------------------------------------------
// Organizations and authentication
// ---------------------------------------------------------------------------

export async function findUserByEmail(email) {
  const result = await query(
    `select id, organization_id as "organizationId", branch_id as "branchId", name, email,
            password_hash as "passwordHash", role, is_active as "isActive"
       from users where lower(email) = lower($1)`,
    [email],
  );
  return result.rows[0];
}

export async function getUserById(id) {
  const result = await query(
    `select id, organization_id as "organizationId", branch_id as "branchId", name, email, role, is_active as "isActive"
       from users where id = $1`,
    [id],
  );
  return result.rows[0];
}

export async function getOrganization(organizationId) {
  const result = await query(
    `select id, name, slug, timezone, created_at as "createdAt" from organizations where id = $1`,
    [organizationId],
  );
  return result.rows[0];
}

export async function updateOrganization(organizationId, { name, timezone }) {
  const result = await query(
    `update organizations set name = coalesce($2, name), timezone = coalesce($3, timezone)
      where id = $1
      returning id, name, slug, timezone, created_at as "createdAt"`,
    [organizationId, name ?? null, timezone ?? null],
  );
  return result.rows[0];
}

export async function createOrganizationWithAdmin({ organizationName, slug, branchName, branchCity, branchCode, adminName, adminEmail, passwordHash }) {
  if (!pool) throw new DatabaseUnavailableError();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const org = await client.query(
      `insert into organizations (name, slug) values ($1, $2)
       returning id, name, slug, timezone, created_at as "createdAt"`,
      [organizationName, slug],
    );
    const branch = await client.query(
      `insert into branches (organization_id, code, name, city) values ($1, $2, $3, $4)
       returning id, organization_id as "organizationId", code, name, city`,
      [org.rows[0].id, branchCode, branchName, branchCity ?? null],
    );
    const user = await client.query(
      `insert into users (organization_id, branch_id, name, email, password_hash, role)
       values ($1, $2, $3, $4, $5, 'admin')
       returning id, organization_id as "organizationId", branch_id as "branchId", name, email, role`,
      [org.rows[0].id, branch.rows[0].id, adminName, adminEmail, passwordHash],
    );
    await client.query("commit");
    return { organization: org.rows[0], branch: branch.rows[0], user: user.rows[0] };
  } catch (cause) {
    await client.query("rollback");
    if (cause?.code === "23505" && cause.constraint === "users_email_unique") {
      throw Object.assign(new Error("An account with that email already exists."), { status: 409, code: "EMAIL_IN_USE", expose: true });
    }
    if (cause?.code === "23505" && cause.constraint === "organizations_slug_unique") {
      throw Object.assign(new Error("A company with that name already has a workspace. Try a different company name."), { status: 409, code: "COMPANY_NAME_IN_USE", expose: true });
    }
    throw new DatabaseUnavailableError({ cause });
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Branches
// ---------------------------------------------------------------------------

export async function listBranches(organizationId) {
  const result = await query(
    `select id, organization_id as "organizationId", code, name, city
       from branches where organization_id = $1 order by name asc`,
    [organizationId],
  );
  return result.rows;
}

export async function createBranch(organizationId, { code, name, city }) {
  const result = await query(
    `insert into branches (organization_id, code, name, city) values ($1, $2, $3, $4)
     returning id, organization_id as "organizationId", code, name, city`,
    [organizationId, code, name, city ?? null],
  );
  return result.rows[0];
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function listUsers(organizationId) {
  const result = await query(
    `select u.id, u.organization_id as "organizationId", u.branch_id as "branchId", u.name, u.email,
            u.role, u.is_active as "isActive", u.created_at as "createdAt", b.name as "branchName"
       from users u left join branches b on b.id = u.branch_id
      where u.organization_id = $1
      order by u.created_at desc`,
    [organizationId],
  );
  return result.rows;
}

export async function createUser(organizationId, { name, email, passwordHash, role, branchId }) {
  const result = await query(
    `insert into users (organization_id, branch_id, name, email, password_hash, role)
     values ($1, $2, $3, $4, $5, $6)
     returning id, organization_id as "organizationId", branch_id as "branchId", name, email, role, is_active as "isActive", created_at as "createdAt"`,
    [organizationId, branchId ?? null, name, email, passwordHash, role],
  ).catch((cause) => {
    if (cause?.cause?.code === "23505") {
      throw Object.assign(new Error("An account with that email already exists."), { status: 409, code: "EMAIL_IN_USE", expose: true });
    }
    throw cause;
  });
  return result.rows[0];
}

export async function updateUser(organizationId, id, { role, branchId, isActive }) {
  const result = await query(
    `update users set role = coalesce($3, role), branch_id = coalesce($4, branch_id), is_active = coalesce($5, is_active)
      where id = $1 and organization_id = $2
      returning id, organization_id as "organizationId", branch_id as "branchId", name, email, role, is_active as "isActive"`,
    [id, organizationId, role ?? null, branchId ?? null, isActive ?? null],
  );
  return result.rows[0];
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

function normalizeBranchFilter(values, branchId, column) {
  if (!branchId) return "";
  values.push(branchId);
  return ` and ${column} = $${values.length}`;
}

export async function listCustomers(organizationId, { search, limit, offset }) {
  const values = [organizationId];
  let where = "organization_id = $1";
  if (search) {
    values.push(`%${search}%`);
    where += ` and (display_name ilike $${values.length} or mobile ilike $${values.length} or email ilike $${values.length})`;
  }
  values.push(limit, offset);
  const result = await query(
    `select id, display_name as "displayName", customer_type as "customerType", mobile, email,
            preferred_channel as "preferredChannel", address, lifetime_value::float as "lifetimeValue",
            created_at as "customerSince"
       from customers where ${where}
      order by created_at desc limit $${values.length - 1} offset $${values.length}`,
    values,
  );
  return result.rows;
}

export async function createCustomer(organizationId, { customerType, displayName, mobile, email, preferredChannel, address }) {
  const result = await query(
    `insert into customers (organization_id, customer_type, display_name, mobile, email, preferred_channel, address)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning id, display_name as "displayName", customer_type as "customerType", mobile, email,
               preferred_channel as "preferredChannel", address, lifetime_value::float as "lifetimeValue",
               created_at as "customerSince"`,
    [organizationId, customerType, displayName, mobile ?? null, email ?? null, preferredChannel ?? null, address ?? null],
  ).catch((cause) => {
    if (cause?.cause?.code === "23505") {
      throw Object.assign(new Error("A customer with that mobile number already exists."), { status: 409, code: "CUSTOMER_MOBILE_IN_USE", expose: true });
    }
    throw cause;
  });
  return result.rows[0];
}

export async function updateCustomer(organizationId, id, { displayName, mobile, email, preferredChannel, address, lifetimeValue }) {
  const result = await query(
    `update customers set
       display_name = coalesce($3, display_name),
       mobile = coalesce($4, mobile),
       email = coalesce($5, email),
       preferred_channel = coalesce($6, preferred_channel),
       address = coalesce($7, address),
       lifetime_value = coalesce($8, lifetime_value)
      where id = $1 and organization_id = $2
      returning id, display_name as "displayName", customer_type as "customerType", mobile, email,
                preferred_channel as "preferredChannel", address, lifetime_value::float as "lifetimeValue",
                created_at as "customerSince"`,
    [id, organizationId, displayName ?? null, mobile ?? null, email ?? null, preferredChannel ?? null, address ?? null, lifetimeValue ?? null],
  );
  return result.rows[0];
}

export async function deleteCustomer(organizationId, id) {
  const result = await query("delete from customers where id = $1 and organization_id = $2", [id, organizationId]).catch((cause) => {
    if (cause?.cause?.code === "23503") {
      throw Object.assign(new Error("This customer has linked records and cannot be deleted."), { status: 409, code: "CUSTOMER_IN_USE", expose: true });
    }
    throw cause;
  });
  return result.rowCount > 0;
}

export async function getCustomer360(organizationId, id) {
  const customerResult = await query(
    `select id, display_name as "displayName", customer_type as "customerType",
            mobile, email, preferred_channel as "preferredChannel", address,
            lifetime_value::float as "lifetimeValue", created_at as "customerSince"
       from customers where id = $1 and organization_id = $2`,
    [id, organizationId],
  );
  if (!customerResult.rowCount) return undefined;

  const [vehicles, timeline, serviceVisits] = await Promise.all([
    query(
      `select v.id, v.vin, v.registration, v.make, v.model, v.variant, v.colour,
              v.model_year as "modelYear", v.odometer_km as "odometerKm",
              v.market_value::float as "marketValue", v.status
         from vehicles v join vehicle_ownerships vo on vo.vehicle_id = v.id
        where vo.customer_id = $1 order by vo.started_on desc limit 20`,
      [id],
    ),
    query(
      `select occurred_at as "occurredAt", interaction_type as type, summary
         from interactions where customer_id = $1 order by occurred_at desc limit 50`,
      [id],
    ),
    query("select count(*)::int as count from service_jobs where customer_id = $1", [id]),
  ]);

  return {
    ...customerResult.rows[0],
    vehicles: vehicles.rows,
    timeline: timeline.rows,
    serviceVisitCount: serviceVisits.rows[0].count,
  };
}

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

export async function listVehicles(organizationId, { search, status, limit, offset }) {
  const values = [organizationId];
  let where = "organization_id = $1";
  if (search) {
    values.push(`%${search}%`);
    where += ` and (vin ilike $${values.length} or registration ilike $${values.length} or make ilike $${values.length} or model ilike $${values.length})`;
  }
  if (status) {
    values.push(status);
    where += ` and status = $${values.length}`;
  }
  values.push(limit, offset);
  const result = await query(
    `select id, vin, registration, make, model, variant, colour, model_year as "modelYear",
            odometer_km as "odometerKm", market_value::float as "marketValue", status,
            created_at as "createdAt"
       from vehicles where ${where}
      order by created_at desc limit $${values.length - 1} offset $${values.length}`,
    values,
  );
  return result.rows;
}

export async function createVehicle(organizationId, { vin, registration, make, model, variant, colour, modelYear, odometerKm, marketValue, status }) {
  const result = await query(
    `insert into vehicles (organization_id, vin, registration, make, model, variant, colour, model_year, odometer_km, market_value, status)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     returning id, vin, registration, make, model, variant, colour, model_year as "modelYear",
               odometer_km as "odometerKm", market_value::float as "marketValue", status`,
    [organizationId, vin, registration ?? null, make, model, variant ?? null, colour ?? null, modelYear ?? null, odometerKm ?? null, marketValue ?? null, status ?? "active"],
  ).catch((cause) => {
    if (cause?.cause?.code === "23505") {
      throw Object.assign(new Error("A vehicle with that VIN already exists."), { status: 409, code: "VEHICLE_VIN_IN_USE", expose: true });
    }
    throw cause;
  });
  return result.rows[0];
}

export async function updateVehicle(organizationId, id, { registration, colour, odometerKm, marketValue, status }) {
  const result = await query(
    `update vehicles set
       registration = coalesce($3, registration),
       colour = coalesce($4, colour),
       odometer_km = coalesce($5, odometer_km),
       market_value = coalesce($6, market_value),
       status = coalesce($7, status)
      where id = $1 and organization_id = $2
      returning id, vin, registration, make, model, variant, colour, model_year as "modelYear",
                odometer_km as "odometerKm", market_value::float as "marketValue", status`,
    [id, organizationId, registration ?? null, colour ?? null, odometerKm ?? null, marketValue ?? null, status ?? null],
  );
  return result.rows[0];
}

export async function deleteVehicle(organizationId, id) {
  const result = await query("delete from vehicles where id = $1 and organization_id = $2", [id, organizationId]).catch((cause) => {
    if (cause?.cause?.code === "23503") {
      throw Object.assign(new Error("This vehicle has linked records and cannot be deleted."), { status: 409, code: "VEHICLE_IN_USE", expose: true });
    }
    throw cause;
  });
  return result.rowCount > 0;
}

export async function getVehicle360(organizationId, id) {
  const result = await query(
    `select v.id, v.vin, v.registration, v.make, v.model, v.variant, v.colour,
            v.model_year as "modelYear", v.odometer_km as "odometerKm",
            v.market_value::float as "marketValue", v.status,
            c.id as "ownerId", c.display_name as "ownerName", c.mobile as "ownerMobile"
       from vehicles v
       left join vehicle_ownerships vo on vo.vehicle_id = v.id and vo.ended_on is null
       left join customers c on c.id = vo.customer_id
      where v.id = $1 and v.organization_id = $2`,
    [id, organizationId],
  );
  if (!result.rowCount) return undefined;
  const history = await query(
    `select occurred_at as "occurredAt", interaction_type as type, summary
       from interactions where vehicle_id = $1 order by occurred_at desc limit 50`,
    [id],
  );
  return { ...result.rows[0], timeline: history.rows };
}

// ---------------------------------------------------------------------------
// Leads and sales orders
// ---------------------------------------------------------------------------

export async function listLeads(organizationId, branchId, { stage, limit, offset }) {
  const values = [organizationId];
  let where = "l.organization_id = $1";
  where += normalizeBranchFilter(values, branchId, "l.branch_id");
  if (stage) {
    values.push(stage);
    where += ` and l.stage = $${values.length}`;
  }
  values.push(limit, offset);
  const result = await query(
    `select l.id, l.branch_id as "branchId", l.customer_id as "customerId", c.display_name as "customerName",
            l.source, l.stage, l.interested_vehicle as "interestedVehicle", l.assigned_to as "assignedTo",
            l.expected_value::float as "expectedValue", l.created_at as "createdAt"
       from leads l left join customers c on c.id = l.customer_id
      where ${where}
      order by l.created_at desc limit $${values.length - 1} offset $${values.length}`,
    values,
  );
  return result.rows;
}

export async function createLead(organizationId, branchId, { customerId, source, stage, interestedVehicle, assignedTo, expectedValue }) {
  const result = await query(
    `insert into leads (organization_id, branch_id, customer_id, source, stage, interested_vehicle, assigned_to, expected_value)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning id, branch_id as "branchId", customer_id as "customerId", source, stage,
               interested_vehicle as "interestedVehicle", assigned_to as "assignedTo",
               expected_value::float as "expectedValue", created_at as "createdAt"`,
    [organizationId, branchId ?? null, customerId ?? null, source, stage, interestedVehicle ?? null, assignedTo ?? null, expectedValue ?? null],
  );
  return result.rows[0];
}

export async function updateLead(organizationId, id, { stage, assignedTo, expectedValue }) {
  const result = await query(
    `update leads set stage = coalesce($3, stage), assigned_to = coalesce($4, assigned_to),
            expected_value = coalesce($5, expected_value)
      where id = $1 and organization_id = $2
      returning id, branch_id as "branchId", customer_id as "customerId", source, stage,
                interested_vehicle as "interestedVehicle", assigned_to as "assignedTo",
                expected_value::float as "expectedValue", created_at as "createdAt"`,
    [id, organizationId, stage ?? null, assignedTo ?? null, expectedValue ?? null],
  );
  return result.rows[0];
}

export async function deleteLead(organizationId, id) {
  const result = await query("delete from leads where id = $1 and organization_id = $2", [id, organizationId]);
  return result.rowCount > 0;
}

export async function listSalesOrders(organizationId, branchId, { status, customerId, limit, offset }) {
  const values = [organizationId];
  let where = "s.organization_id = $1";
  where += normalizeBranchFilter(values, branchId, "s.branch_id");
  if (status) {
    values.push(status);
    where += ` and s.status = $${values.length}`;
  }
  if (customerId) {
    values.push(customerId);
    where += ` and s.customer_id = $${values.length}`;
  }
  values.push(limit, offset);
  const result = await query(
    `select s.id, s.branch_id as "branchId", s.customer_id as "customerId", c.display_name as "customerName",
            s.vehicle_id as "vehicleId", v.make, v.model, s.status, s.total_amount::float as "totalAmount",
            s.ordered_at as "orderedAt", s.delivered_at as "deliveredAt"
       from sales_orders s
       join customers c on c.id = s.customer_id
       join vehicles v on v.id = s.vehicle_id
      where ${where}
      order by s.ordered_at desc limit $${values.length - 1} offset $${values.length}`,
    values,
  );
  return result.rows;
}

export async function createSalesOrder(organizationId, branchId, { customerId, vehicleId, status, totalAmount, orderedAt }) {
  const result = await query(
    `insert into sales_orders (organization_id, branch_id, customer_id, vehicle_id, status, total_amount, ordered_at)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning id, branch_id as "branchId", customer_id as "customerId", vehicle_id as "vehicleId",
               status, total_amount::float as "totalAmount", ordered_at as "orderedAt", delivered_at as "deliveredAt"`,
    [organizationId, branchId ?? null, customerId, vehicleId, status, totalAmount, orderedAt ?? new Date().toISOString()],
  );
  return result.rows[0];
}

export async function updateSalesOrder(organizationId, id, { status, deliveredAt }) {
  const result = await query(
    `update sales_orders set status = coalesce($3, status), delivered_at = coalesce($4, delivered_at)
      where id = $1 and organization_id = $2
      returning id, branch_id as "branchId", customer_id as "customerId", vehicle_id as "vehicleId",
                status, total_amount::float as "totalAmount", ordered_at as "orderedAt", delivered_at as "deliveredAt"`,
    [id, organizationId, status ?? null, deliveredAt ?? null],
  );
  return result.rows[0];
}

// ---------------------------------------------------------------------------
// Service jobs
// ---------------------------------------------------------------------------

export async function listServiceJobs(organizationId, branchId, { status, customerId, vehicleId, limit, offset }) {
  const values = [organizationId];
  let where = "sj.organization_id = $1";
  where += normalizeBranchFilter(values, branchId, "sj.branch_id");
  if (status) {
    values.push(status);
    where += ` and sj.status = $${values.length}`;
  }
  if (customerId) {
    values.push(customerId);
    where += ` and sj.customer_id = $${values.length}`;
  }
  if (vehicleId) {
    values.push(vehicleId);
    where += ` and sj.vehicle_id = $${values.length}`;
  }
  values.push(limit, offset);
  const result = await query(
    `select sj.id, sj.branch_id as "branchId", sj.customer_id as "customerId", c.display_name as "customerName",
            sj.vehicle_id as "vehicleId", v.make, v.model, sj.repair_order_number as "repairOrderNumber",
            sj.status, sj.advisor, sj.technician, sj.complaint,
            sj.labour_total::float as "labourTotal", sj.parts_total::float as "partsTotal",
            sj.opened_at as "openedAt", sj.promised_at as "promisedAt", sj.closed_at as "closedAt"
       from service_jobs sj
       join customers c on c.id = sj.customer_id
       join vehicles v on v.id = sj.vehicle_id
      where ${where}
      order by sj.opened_at desc limit $${values.length - 1} offset $${values.length}`,
    values,
  );
  return result.rows;
}

export async function createServiceJob(organizationId, branchId, { customerId, vehicleId, repairOrderNumber, status, advisor, technician, complaint, promisedAt }) {
  const result = await query(
    `insert into service_jobs (organization_id, branch_id, customer_id, vehicle_id, repair_order_number, status, advisor, technician, complaint, opened_at, promised_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), $10)
     returning id, branch_id as "branchId", customer_id as "customerId", vehicle_id as "vehicleId",
               repair_order_number as "repairOrderNumber", status, advisor, technician, complaint,
               labour_total::float as "labourTotal", parts_total::float as "partsTotal",
               opened_at as "openedAt", promised_at as "promisedAt", closed_at as "closedAt"`,
    [organizationId, branchId ?? null, customerId, vehicleId, repairOrderNumber, status, advisor ?? null, technician ?? null, complaint ?? null, promisedAt ?? null],
  ).catch((cause) => {
    if (cause?.cause?.code === "23505") {
      throw Object.assign(new Error("A repair order with that number already exists."), { status: 409, code: "REPAIR_ORDER_IN_USE", expose: true });
    }
    throw cause;
  });
  return result.rows[0];
}

export async function updateServiceJob(organizationId, id, { status, technician, labourTotal, partsTotal, closedAt }) {
  const result = await query(
    `update service_jobs set status = coalesce($3, status), technician = coalesce($4, technician),
            labour_total = coalesce($5, labour_total), parts_total = coalesce($6, parts_total),
            closed_at = coalesce($7, closed_at)
      where id = $1 and organization_id = $2
      returning id, branch_id as "branchId", customer_id as "customerId", vehicle_id as "vehicleId",
                repair_order_number as "repairOrderNumber", status, advisor, technician, complaint,
                labour_total::float as "labourTotal", parts_total::float as "partsTotal",
                opened_at as "openedAt", promised_at as "promisedAt", closed_at as "closedAt"`,
    [id, organizationId, status ?? null, technician ?? null, labourTotal ?? null, partsTotal ?? null, closedAt ?? null],
  );
  return result.rows[0];
}

// ---------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------

export async function listParts(organizationId, { search, lowStock, limit, offset }) {
  const values = [organizationId];
  let where = "organization_id = $1";
  if (search) {
    values.push(`%${search}%`);
    where += ` and (sku ilike $${values.length} or name ilike $${values.length})`;
  }
  if (lowStock) where += " and quantity_on_hand <= reorder_point";
  values.push(limit, offset);
  const result = await query(
    `select id, sku, name, quantity_on_hand as "quantityOnHand", reorder_point as "reorderPoint",
            unit_cost::float as "unitCost", retail_price::float as "retailPrice"
       from parts where ${where}
      order by name asc limit $${values.length - 1} offset $${values.length}`,
    values,
  );
  return result.rows;
}

export async function createPart(organizationId, { sku, name, quantityOnHand, reorderPoint, unitCost, retailPrice }) {
  const result = await query(
    `insert into parts (organization_id, sku, name, quantity_on_hand, reorder_point, unit_cost, retail_price)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning id, sku, name, quantity_on_hand as "quantityOnHand", reorder_point as "reorderPoint",
               unit_cost::float as "unitCost", retail_price::float as "retailPrice"`,
    [organizationId, sku, name, quantityOnHand ?? 0, reorderPoint ?? 0, unitCost ?? 0, retailPrice ?? 0],
  ).catch((cause) => {
    if (cause?.cause?.code === "23505") {
      throw Object.assign(new Error("A part with that SKU already exists."), { status: 409, code: "PART_SKU_IN_USE", expose: true });
    }
    throw cause;
  });
  return result.rows[0];
}

export async function updatePart(organizationId, id, { quantityOnHand, reorderPoint, unitCost, retailPrice }) {
  const result = await query(
    `update parts set quantity_on_hand = coalesce($3, quantity_on_hand), reorder_point = coalesce($4, reorder_point),
            unit_cost = coalesce($5, unit_cost), retail_price = coalesce($6, retail_price)
      where id = $1 and organization_id = $2
      returning id, sku, name, quantity_on_hand as "quantityOnHand", reorder_point as "reorderPoint",
                unit_cost::float as "unitCost", retail_price::float as "retailPrice"`,
    [id, organizationId, quantityOnHand ?? null, reorderPoint ?? null, unitCost ?? null, retailPrice ?? null],
  );
  return result.rows[0];
}

export async function deletePart(organizationId, id) {
  const result = await query("delete from parts where id = $1 and organization_id = $2", [id, organizationId]).catch((cause) => {
    if (cause?.cause?.code === "23503") {
      throw Object.assign(new Error("This part has linked records and cannot be deleted."), { status: 409, code: "PART_IN_USE", expose: true });
    }
    throw cause;
  });
  return result.rowCount > 0;
}

// ---------------------------------------------------------------------------
// Finance contracts and insurance policies (organization scope via a join)
// ---------------------------------------------------------------------------

export async function listFinanceContracts(organizationId, { limit, offset }) {
  const result = await query(
    `select fc.id, fc.sales_order_id as "salesOrderId", fc.provider, fc.product_type as "productType",
            fc.amount_financed::float as "amountFinanced", fc.status, fc.commission::float as "commission",
            c.display_name as "customerName"
       from finance_contracts fc
       join sales_orders so on so.id = fc.sales_order_id
       join customers c on c.id = so.customer_id
      where so.organization_id = $1
      order by so.ordered_at desc limit $2 offset $3`,
    [organizationId, limit, offset],
  );
  return result.rows;
}

export async function createFinanceContract(organizationId, { salesOrderId, provider, productType, amountFinanced, status }) {
  const owned = await query("select id from sales_orders where id = $1 and organization_id = $2", [salesOrderId, organizationId]);
  if (!owned.rowCount) throw Object.assign(new Error("Sales order not found."), { status: 404, code: "SALES_ORDER_NOT_FOUND", expose: true });
  const result = await query(
    `insert into finance_contracts (sales_order_id, provider, product_type, amount_financed, status)
     values ($1, $2, $3, $4, $5)
     returning id, sales_order_id as "salesOrderId", provider, product_type as "productType",
               amount_financed::float as "amountFinanced", status, commission::float as "commission"`,
    [salesOrderId, provider, productType, amountFinanced, status],
  );
  return result.rows[0];
}

export async function updateFinanceContract(organizationId, id, { status, commission }) {
  const result = await query(
    `update finance_contracts fc set status = coalesce($3, fc.status), commission = coalesce($4, fc.commission)
       from sales_orders so
      where fc.id = $1 and fc.sales_order_id = so.id and so.organization_id = $2
      returning fc.id, fc.sales_order_id as "salesOrderId", fc.provider, fc.product_type as "productType",
                fc.amount_financed::float as "amountFinanced", fc.status, fc.commission::float as "commission"`,
    [id, organizationId, status ?? null, commission ?? null],
  );
  return result.rows[0];
}

export async function listInsurancePolicies(organizationId, { limit, offset }) {
  const result = await query(
    `select ip.id, ip.customer_id as "customerId", c.display_name as "customerName", ip.vehicle_id as "vehicleId",
            ip.provider, ip.policy_number as "policyNumber", ip.status, ip.starts_on as "startsOn",
            ip.expires_on as "expiresOn", ip.premium::float as "premium"
       from insurance_policies ip
       join customers c on c.id = ip.customer_id
      where c.organization_id = $1
      order by ip.expires_on asc limit $2 offset $3`,
    [organizationId, limit, offset],
  );
  return result.rows;
}

export async function createInsurancePolicy(organizationId, { customerId, vehicleId, provider, policyNumber, status, startsOn, expiresOn, premium }) {
  const owned = await query("select id from customers where id = $1 and organization_id = $2", [customerId, organizationId]);
  if (!owned.rowCount) throw Object.assign(new Error("Customer not found."), { status: 404, code: "CUSTOMER_NOT_FOUND", expose: true });
  const result = await query(
    `insert into insurance_policies (customer_id, vehicle_id, provider, policy_number, status, starts_on, expires_on, premium)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning id, customer_id as "customerId", vehicle_id as "vehicleId", provider, policy_number as "policyNumber",
               status, starts_on as "startsOn", expires_on as "expiresOn", premium::float as "premium"`,
    [customerId, vehicleId, provider, policyNumber, status, startsOn, expiresOn, premium ?? null],
  );
  return result.rows[0];
}

export async function updateInsurancePolicy(organizationId, id, { status, premium }) {
  const result = await query(
    `update insurance_policies ip set status = coalesce($3, ip.status), premium = coalesce($4, ip.premium)
       from customers c
      where ip.id = $1 and ip.customer_id = c.id and c.organization_id = $2
      returning ip.id, ip.customer_id as "customerId", ip.vehicle_id as "vehicleId", ip.provider,
                ip.policy_number as "policyNumber", ip.status, ip.starts_on as "startsOn",
                ip.expires_on as "expiresOn", ip.premium::float as "premium"`,
    [id, organizationId, status ?? null, premium ?? null],
  );
  return result.rows[0];
}

// ---------------------------------------------------------------------------
// Communications
// ---------------------------------------------------------------------------

export async function listCommunications(organizationId, customerId, { limit, offset }) {
  const values = [organizationId];
  let where = "c.organization_id = $1";
  if (customerId) {
    values.push(customerId);
    where += ` and comm.customer_id = $${values.length}`;
  }
  values.push(limit, offset);
  const result = await query(
    `select comm.id, comm.customer_id as "customerId", comm.channel, comm.direction, comm.subject,
            comm.summary, comm.occurred_at as "occurredAt"
       from communications comm
       join customers c on c.id = comm.customer_id
      where ${where}
      order by comm.occurred_at desc limit $${values.length - 1} offset $${values.length}`,
    values,
  );
  return result.rows;
}

export async function createCommunication(organizationId, { customerId, channel, direction, subject, summary }) {
  const owned = await query("select id from customers where id = $1 and organization_id = $2", [customerId, organizationId]);
  if (!owned.rowCount) throw Object.assign(new Error("Customer not found."), { status: 404, code: "CUSTOMER_NOT_FOUND", expose: true });
  const result = await query(
    `insert into communications (customer_id, channel, direction, subject, summary)
     values ($1, $2, $3, $4, $5)
     returning id, customer_id as "customerId", channel, direction, subject, summary, occurred_at as "occurredAt"`,
    [customerId, channel, direction, subject ?? null, summary],
  );
  return result.rows[0];
}

// ---------------------------------------------------------------------------
// Overview aggregates (org and, where the role requires it, branch scoped)
// ---------------------------------------------------------------------------

export async function getOverview(organizationId, branchId) {
  const leadValues = [organizationId];
  let leadWhere = "organization_id = $1";
  leadWhere += normalizeBranchFilter(leadValues, branchId, "branch_id");

  const salesValues = [organizationId];
  let salesWhere = "organization_id = $1 and ordered_at >= date_trunc('month', now())";
  salesWhere += normalizeBranchFilter(salesValues, branchId, "branch_id");

  const serviceValues = [organizationId];
  let serviceWhere = "organization_id = $1 and closed_at is null";
  serviceWhere += normalizeBranchFilter(serviceValues, branchId, "branch_id");

  const [openLeads, unitsSoldMtd, activeServiceJobs, lowStockParts, revenueMtd] = await Promise.all([
    query(`select count(*)::int as count from leads where ${leadWhere} and stage not in ('won', 'lost')`, leadValues),
    query(`select count(*)::int as count from sales_orders where ${salesWhere}`, salesValues),
    query(`select count(*)::int as count from service_jobs where ${serviceWhere}`, serviceValues),
    query("select count(*)::int as count from parts where organization_id = $1 and quantity_on_hand <= reorder_point", [organizationId]),
    query(`select coalesce(sum(total_amount), 0)::float as total from sales_orders where ${salesWhere}`, salesValues),
  ]);

  return {
    openLeads: openLeads.rows[0].count,
    unitsSoldMtd: unitsSoldMtd.rows[0].count,
    activeServiceJobs: activeServiceJobs.rows[0].count,
    lowStockParts: lowStockParts.rows[0].count,
    revenueMtd: revenueMtd.rows[0].total,
  };
}
