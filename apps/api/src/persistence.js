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

// Self-service profile edit: deliberately narrower than updateUser -- it can never change role,
// branch, or active state, so a personal profile form can never become a privilege-escalation path.
export async function updateOwnProfile(organizationId, id, { name }) {
  const result = await query(
    `update users set name = coalesce($3, name)
      where id = $1 and organization_id = $2
      returning id, organization_id as "organizationId", branch_id as "branchId", name, email, role, is_active as "isActive"`,
    [id, organizationId, name ?? null],
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

// Bare digits only, so "04 1234 5678", "+61 4 1234 5678", and "0412345678" compare equal when
// checking for duplicates.
function normalizedDigits(value) {
  const digits = value ? value.replace(/\D/g, "") : "";
  return digits.startsWith("61") && digits.length === 11 ? `0${digits.slice(2)}` : digits;
}

// Surfaces existing customers that look like the same person or company before a create/edit
// commits -- the remediation spec's entity-selection rule (7.4) permits "Create new ..." only
// after duplicate checking. Matches are exact (normalized mobile, case-insensitive email, or
// case-insensitive display name), not fuzzy: a false-positive block is worse than an occasional
// missed near-duplicate. Capped at 5 and excludes the record being edited when `excludeId` is set.
export async function findPotentialDuplicateCustomers(organizationId, { mobile, email, displayName, excludeId }) {
  const mobileDigits = normalizedDigits(mobile);
  const trimmedEmail = email ? email.trim().toLowerCase() : "";
  const trimmedName = displayName ? displayName.trim() : "";
  if (!mobileDigits && !trimmedEmail && !trimmedName) return [];

  const values = [organizationId];
  const conditions = [];
  if (mobileDigits) {
    values.push(mobileDigits);
    conditions.push(`case
      when regexp_replace(coalesce(mobile, ''), '\\D', '', 'g') like '61_________'
      then '0' || substring(regexp_replace(mobile, '\\D', '', 'g') from 3)
      else regexp_replace(coalesce(mobile, ''), '\\D', '', 'g')
    end = $${values.length}`);
  }
  if (trimmedEmail) {
    values.push(trimmedEmail);
    conditions.push(`lower(email) = $${values.length}`);
  }
  if (trimmedName) {
    values.push(trimmedName);
    conditions.push(`lower(display_name) = lower($${values.length})`);
  }
  let where = `organization_id = $1 and (${conditions.join(" or ")})`;
  if (excludeId) {
    values.push(excludeId);
    where += ` and id <> $${values.length}`;
  }

  const result = await query(
    `select id, display_name as "displayName", customer_type as "customerType", mobile, email,
            preferred_channel as "preferredChannel", address, lifetime_value::float as "lifetimeValue",
            created_at as "customerSince"
       from customers where ${where}
      order by created_at desc limit 5`,
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

export async function createVehicle(organizationId, { vin, registration, make, model, variant, colour, modelYear, odometerKm, marketValue, status, branchId, lotLocation, acquisitionChannel, acquisitionCost, intakeAt }) {
  const result = await query(
    `insert into vehicles (organization_id, vin, registration, make, model, variant, colour, model_year, odometer_km, market_value, status, branch_id, lot_location, acquisition_channel, acquisition_cost, intake_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, coalesce($16, now()))
     returning id, vin, registration, make, model, variant, colour, model_year as "modelYear",
               odometer_km as "odometerKm", market_value::float as "marketValue", status,
               branch_id as "branchId", lot_location as "lotLocation", acquisition_channel as "acquisitionChannel",
               acquisition_cost::float as "acquisitionCost", intake_at as "intakeAt"`,
    [organizationId, vin, registration ?? null, make, model, variant ?? null, colour ?? null, modelYear ?? null, odometerKm ?? null, marketValue ?? null, status ?? "active", branchId ?? null, lotLocation ?? null, acquisitionChannel ?? null, acquisitionCost ?? null, intakeAt ?? null],
  ).catch((cause) => {
    if (cause?.cause?.code === "23505") {
      throw Object.assign(new Error("A vehicle with that VIN already exists."), { status: 409, code: "VEHICLE_VIN_IN_USE", expose: true });
    }
    throw cause;
  });
  await recordVehicleEvent(result.rows[0].id, null, "intake", `Added to inventory${acquisitionChannel ? ` via ${acquisitionChannel}` : ""}`);
  return result.rows[0];
}

export async function updateVehicle(organizationId, id, { registration, colour, odometerKm, marketValue, status, branchId, lotLocation, acquisitionChannel, acquisitionCost }) {
  const result = await query(
    `update vehicles set
       registration = coalesce($3, registration),
       colour = coalesce($4, colour),
       odometer_km = coalesce($5, odometer_km),
       market_value = coalesce($6, market_value),
       status = coalesce($7, status),
       branch_id = coalesce($8, branch_id),
       lot_location = coalesce($9, lot_location),
       acquisition_channel = coalesce($10, acquisition_channel),
       acquisition_cost = coalesce($11, acquisition_cost)
      where id = $1 and organization_id = $2
      returning id, vin, registration, make, model, variant, colour, model_year as "modelYear",
                odometer_km as "odometerKm", market_value::float as "marketValue", status,
                branch_id as "branchId", lot_location as "lotLocation", acquisition_channel as "acquisitionChannel",
                acquisition_cost::float as "acquisitionCost", intake_at as "intakeAt"`,
    [id, organizationId, registration ?? null, colour ?? null, odometerKm ?? null, marketValue ?? null, status ?? null, branchId ?? null, lotLocation ?? null, acquisitionChannel ?? null, acquisitionCost ?? null],
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
            v.branch_id as "branchId", b.name as "branchName", v.lot_location as "lotLocation",
            v.acquisition_channel as "acquisitionChannel", v.acquisition_cost::float as "acquisitionCost",
            v.intake_at as "intakeAt",
            c.id as "ownerId", c.display_name as "ownerName", c.mobile as "ownerMobile"
       from vehicles v
       left join branches b on b.id = v.branch_id
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
            s.vehicle_id as "vehicleId", v.make, v.model, s.lead_id as "leadId", s.status, s.total_amount::float as "totalAmount",
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

export async function createSalesOrder(organizationId, branchId, { customerId, vehicleId, leadId, status, totalAmount, orderedAt }) {
  const result = await query(
    `insert into sales_orders (organization_id, branch_id, customer_id, vehicle_id, lead_id, status, total_amount, ordered_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning id, branch_id as "branchId", customer_id as "customerId", vehicle_id as "vehicleId", lead_id as "leadId",
               status, total_amount::float as "totalAmount", ordered_at as "orderedAt", delivered_at as "deliveredAt"`,
    [organizationId, branchId ?? null, customerId, vehicleId, leadId ?? null, status, totalAmount, orderedAt ?? new Date().toISOString()],
  );
  return result.rows[0];
}

export async function getLead360(organizationId, id) {
  const leadResult = await query(
    `select l.id, l.branch_id as "branchId", l.customer_id as "customerId", c.display_name as "customerName",
            c.mobile as "customerMobile", c.email as "customerEmail",
            l.source, l.stage, l.interested_vehicle as "interestedVehicle", l.assigned_to as "assignedTo",
            l.expected_value::float as "expectedValue", l.created_at as "createdAt"
       from leads l left join customers c on c.id = l.customer_id
      where l.id = $1 and l.organization_id = $2`,
    [id, organizationId],
  );
  if (!leadResult.rowCount) return undefined;

  const [testDrives, salesOrder] = await Promise.all([
    query(
      `select id, vehicle_id as "vehicleId", scheduled_at as "scheduledAt", status, feedback
         from test_drives where lead_id = $1 order by scheduled_at desc`,
      [id],
    ),
    query(
      `select s.id, s.status, s.total_amount::float as "totalAmount", s.ordered_at as "orderedAt", s.delivered_at as "deliveredAt"
         from sales_orders s where s.lead_id = $1 and s.organization_id = $2`,
      [id, organizationId],
    ),
  ]);

  return { ...leadResult.rows[0], testDrives: testDrives.rows, salesOrder: salesOrder.rows[0] ?? null };
}

export async function getSalesOrder360(organizationId, id) {
  const orderResult = await query(
    `select s.id, s.branch_id as "branchId", s.status, s.total_amount::float as "totalAmount",
            s.ordered_at as "orderedAt", s.delivered_at as "deliveredAt", s.lead_id as "leadId",
            c.id as "customerId", c.display_name as "customerName", c.mobile as "customerMobile", c.email as "customerEmail",
            v.id as "vehicleId", v.vin, v.registration, v.make, v.model, v.variant
       from sales_orders s
       join customers c on c.id = s.customer_id
       join vehicles v on v.id = s.vehicle_id
      where s.id = $1 and s.organization_id = $2`,
    [id, organizationId],
  );
  if (!orderResult.rowCount) return undefined;
  const order = orderResult.rows[0];

  const [contract, policies] = await Promise.all([
    query(
      `select id, provider, product_type as "productType", amount_financed::float as "amountFinanced", status, commission::float as "commission"
         from finance_contracts where sales_order_id = $1`,
      [id],
    ),
    query(
      `select id, provider, policy_number as "policyNumber", status, starts_on as "startsOn", expires_on as "expiresOn", premium::float as "premium"
         from insurance_policies where customer_id = $1 and vehicle_id = $2 order by expires_on desc`,
      [order.customerId, order.vehicleId],
    ),
  ]);

  return { ...order, financeContract: contract.rows[0] ?? null, insurancePolicies: policies.rows };
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

export async function getServiceJob360(organizationId, id) {
  const result = await query(
    `select sj.id, sj.branch_id as "branchId", sj.repair_order_number as "repairOrderNumber",
            sj.status, sj.advisor, sj.technician, sj.complaint,
            sj.labour_total::float as "labourTotal", sj.parts_total::float as "partsTotal",
            sj.opened_at as "openedAt", sj.promised_at as "promisedAt", sj.closed_at as "closedAt",
            c.id as "customerId", c.display_name as "customerName", c.mobile as "customerMobile", c.email as "customerEmail",
            v.id as "vehicleId", v.vin, v.registration, v.make, v.model, v.variant, v.odometer_km as "odometerKm"
       from service_jobs sj
       join customers c on c.id = sj.customer_id
       join vehicles v on v.id = sj.vehicle_id
      where sj.id = $1 and sj.organization_id = $2`,
    [id, organizationId],
  );
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

export async function createPart(organizationId, branchId, { sku, name, quantityOnHand, reorderPoint, unitCost, retailPrice }) {
  if (!pool) throw new DatabaseUnavailableError();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await client.query(
      `insert into parts (organization_id, sku, name, quantity_on_hand, reorder_point, unit_cost, retail_price)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning id, sku, name, quantity_on_hand as "quantityOnHand", reorder_point as "reorderPoint",
                 unit_cost::float as "unitCost", retail_price::float as "retailPrice"`,
      [organizationId, sku, name, quantityOnHand ?? 0, reorderPoint ?? 0, unitCost ?? 0, retailPrice ?? 0],
    );
    if (branchId) await client.query("insert into part_branch_stock (organization_id,branch_id,part_id,quantity_on_hand) values ($1,$2,$3,$4)", [organizationId, branchId, result.rows[0].id, quantityOnHand ?? 0]);
    await client.query("commit");
    return result.rows[0];
  } catch (cause) {
    await client.query("rollback");
    if (cause?.code === "23505") throw Object.assign(new Error("A part with that SKU already exists."), { status: 409, code: "PART_SKU_IN_USE", expose: true });
    throw new DatabaseUnavailableError({ cause });
  } finally { client.release(); }
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

export async function listCommunications(organizationId, customerId, { channel, direction, limit, offset }) {
  const values = [organizationId];
  let where = "c.organization_id = $1";
  if (customerId) {
    values.push(customerId);
    where += ` and comm.customer_id = $${values.length}`;
  }
  if (channel) {
    values.push(channel);
    where += ` and comm.channel = $${values.length}`;
  }
  if (direction) {
    values.push(direction);
    where += ` and comm.direction = $${values.length}`;
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
// Customer notes, tasks, consent, and documents (database/013_customer_relationship_records.sql)
// ---------------------------------------------------------------------------

async function assertCustomerOwned(organizationId, customerId) {
  const owned = await query("select id from customers where id = $1 and organization_id = $2", [customerId, organizationId]);
  if (!owned.rowCount) throw Object.assign(new Error("Customer not found."), { status: 404, code: "CUSTOMER_NOT_FOUND", expose: true });
}

export async function listCustomerNotes(organizationId, customerId, { limit, offset }) {
  await assertCustomerOwned(organizationId, customerId);
  const result = await query(
    `select cn.id, cn.customer_id as "customerId", cn.body, cn.created_at as "createdAt",
            cn.author_user_id as "authorUserId", u.name as "authorName"
       from customer_notes cn
       left join users u on u.id = cn.author_user_id
      where cn.organization_id = $1 and cn.customer_id = $2
      order by cn.created_at desc limit $3 offset $4`,
    [organizationId, customerId, limit, offset],
  );
  return result.rows;
}

export async function createCustomerNote(organizationId, customerId, { body, authorUserId }) {
  await assertCustomerOwned(organizationId, customerId);
  const result = await query(
    `insert into customer_notes (organization_id, customer_id, author_user_id, body)
     values ($1, $2, $3, $4)
     returning id, customer_id as "customerId", body, created_at as "createdAt", author_user_id as "authorUserId"`,
    [organizationId, customerId, authorUserId ?? null, body],
  );
  return result.rows[0];
}

export async function deleteCustomerNote(organizationId, customerId, noteId) {
  const result = await query(
    "delete from customer_notes where id = $1 and customer_id = $2 and organization_id = $3",
    [noteId, customerId, organizationId],
  );
  return result.rowCount > 0;
}

export async function listCustomerTasks(organizationId, customerId, { limit, offset }) {
  await assertCustomerOwned(organizationId, customerId);
  const result = await query(
    `select id, customer_id as "customerId", title, assigned_to as "assignedTo", due_at as "dueAt",
            status, created_at as "createdAt", completed_at as "completedAt"
       from customer_tasks
      where organization_id = $1 and customer_id = $2
      order by (status = 'open') desc, due_at asc nulls last, created_at desc
      limit $3 offset $4`,
    [organizationId, customerId, limit, offset],
  );
  return result.rows;
}

export async function createCustomerTask(organizationId, customerId, { title, assignedTo, dueAt, createdBy }) {
  await assertCustomerOwned(organizationId, customerId);
  const result = await query(
    `insert into customer_tasks (organization_id, customer_id, title, assigned_to, due_at, created_by)
     values ($1, $2, $3, $4, $5, $6)
     returning id, customer_id as "customerId", title, assigned_to as "assignedTo", due_at as "dueAt",
               status, created_at as "createdAt", completed_at as "completedAt"`,
    [organizationId, customerId, title, assignedTo ?? null, dueAt ?? null, createdBy ?? null],
  );
  return result.rows[0];
}

export async function updateCustomerTaskStatus(organizationId, customerId, taskId, status) {
  const result = await query(
    `update customer_tasks set status = $4, completed_at = case when $4 = 'open' then null else now() end
      where id = $1 and customer_id = $2 and organization_id = $3
      returning id, customer_id as "customerId", title, assigned_to as "assignedTo", due_at as "dueAt",
                status, created_at as "createdAt", completed_at as "completedAt"`,
    [taskId, customerId, organizationId, status],
  );
  return result.rows[0];
}

// Every consent channel a customer can be asked about, in the order the UI always shows them --
// so a channel with no recorded decision yet still renders as "not yet recorded" rather than
// silently disappearing from the list.
const CONSENT_CHANNELS = ["call", "whatsapp", "email", "sms"];

// Consent is an append-only event log (see the migration): this reduces it to the current state
// per channel, defaulting an unrecorded channel to "unknown" rather than guessing opted in or out.
export async function getCustomerConsent(organizationId, customerId) {
  await assertCustomerOwned(organizationId, customerId);
  const result = await query(
    `select distinct on (channel) channel, status, source, recorded_at as "recordedAt", recorded_by as "recordedBy"
       from customer_consents
      where organization_id = $1 and customer_id = $2
      order by channel, recorded_at desc`,
    [organizationId, customerId],
  );
  const current = new Map(result.rows.map((row) => [row.channel, row]));
  return CONSENT_CHANNELS.map((channel) => current.get(channel) ?? { channel, status: "unknown", source: null, recordedAt: null, recordedBy: null });
}

export async function listCustomerConsentHistory(organizationId, customerId, { limit, offset }) {
  await assertCustomerOwned(organizationId, customerId);
  const result = await query(
    `select id, channel, status, source, recorded_at as "recordedAt", recorded_by as "recordedBy"
       from customer_consents
      where organization_id = $1 and customer_id = $2
      order by recorded_at desc limit $3 offset $4`,
    [organizationId, customerId, limit, offset],
  );
  return result.rows;
}

export async function recordCustomerConsent(organizationId, customerId, { channel, status, source, recordedBy }) {
  await assertCustomerOwned(organizationId, customerId);
  const result = await query(
    `insert into customer_consents (organization_id, customer_id, channel, status, source, recorded_by)
     values ($1, $2, $3, $4, $5, $6)
     returning id, channel, status, source, recorded_at as "recordedAt", recorded_by as "recordedBy"`,
    [organizationId, customerId, channel, status, source ?? null, recordedBy ?? null],
  );
  return result.rows[0];
}

export async function listCustomerDocuments(organizationId, customerId, { limit, offset }) {
  await assertCustomerOwned(organizationId, customerId);
  const result = await query(
    `select id, customer_id as "customerId", document_type as "documentType", label, status,
            storage_reference as "storageReference", uploaded_by as "uploadedBy", created_at as "createdAt"
       from customer_documents
      where organization_id = $1 and customer_id = $2
      order by created_at desc limit $3 offset $4`,
    [organizationId, customerId, limit, offset],
  );
  return result.rows;
}

export async function createCustomerDocument(organizationId, customerId, { documentType, label, status, storageReference, uploadedBy }) {
  await assertCustomerOwned(organizationId, customerId);
  const result = await query(
    `insert into customer_documents (organization_id, customer_id, document_type, label, status, storage_reference, uploaded_by)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning id, customer_id as "customerId", document_type as "documentType", label, status,
               storage_reference as "storageReference", uploaded_by as "uploadedBy", created_at as "createdAt"`,
    [organizationId, customerId, documentType, label, status ?? "received", storageReference ?? null, uploadedBy ?? null],
  );
  return result.rows[0];
}

export async function updateCustomerDocumentStatus(organizationId, customerId, documentId, status) {
  const result = await query(
    `update customer_documents set status = $4
      where id = $1 and customer_id = $2 and organization_id = $3
      returning id, customer_id as "customerId", document_type as "documentType", label, status,
                storage_reference as "storageReference", uploaded_by as "uploadedBy", created_at as "createdAt"`,
    [documentId, customerId, organizationId, status],
  );
  return result.rows[0];
}

// ---------------------------------------------------------------------------
// Vehicle 360 core: ownership transfer, documents, appraisal, valuation, stock/location, auction,
// and rental/demo disposition (database/021_vehicle_360_core.sql)
// ---------------------------------------------------------------------------

async function assertVehicleOwned(organizationId, vehicleId) {
  const owned = await query("select id from vehicles where id = $1 and organization_id = $2", [vehicleId, organizationId]);
  if (!owned.rowCount) throw Object.assign(new Error("Vehicle not found."), { status: 404, code: "VEHICLE_NOT_FOUND", expose: true });
}

// Every workflow below writes one row into the vehicle's shared timeline (the same `interactions`
// table the existing Lifecycle tab already reads), so that tab reflects the whole record rather
// than only service history. customer_id is optional (see the migration) -- an auction listing or
// a valuation update may have no customer attached yet.
async function recordVehicleEvent(vehicleId, customerId, type, summary) {
  await query(
    `insert into interactions (customer_id, vehicle_id, interaction_type, occurred_at, summary)
     values ($1, $2, $3, now(), $4)`,
    [customerId ?? null, vehicleId, type, summary],
  );
}

// A vehicle can only be checked out for one rental/demo, or listed at auction, at a time. Enforced
// here before the write, and again by the database (vehicle_dispositions_one_active) in case two
// requests race.
async function assertVehicleAvailableForDisposition(organizationId, vehicleId) {
  const activeDisposition = await query(
    "select id from vehicle_dispositions where vehicle_id = $1 and organization_id = $2 and status = 'active'",
    [vehicleId, organizationId],
  );
  if (activeDisposition.rowCount) {
    throw Object.assign(new Error("This vehicle is already checked out on an active rental or demo."), { status: 409, code: "VEHICLE_UNAVAILABLE", expose: true });
  }
  const activeAuction = await query(
    "select id from vehicle_auction_listings where vehicle_id = $1 and organization_id = $2 and status in ('listed', 'bidding')",
    [vehicleId, organizationId],
  );
  if (activeAuction.rowCount) {
    throw Object.assign(new Error("This vehicle has an active auction listing."), { status: 409, code: "VEHICLE_UNAVAILABLE", expose: true });
  }
}

// ---------------------------------------------------------------------------
// Ownership history and transfer
// ---------------------------------------------------------------------------

export async function listVehicleOwnership(organizationId, vehicleId) {
  await assertVehicleOwned(organizationId, vehicleId);
  const result = await query(
    `select vo.id, vo.vehicle_id as "vehicleId", vo.customer_id as "customerId", c.display_name as "customerName",
            c.mobile as "customerMobile", vo.started_on as "startedOn", vo.ended_on as "endedOn",
            vo.is_primary as "isPrimary", vo.transfer_reason as "transferReason"
       from vehicle_ownerships vo
       join customers c on c.id = vo.customer_id
      where vo.organization_id = $1 and vo.vehicle_id = $2
      order by vo.started_on desc, vo.id desc`,
    [organizationId, vehicleId],
  );
  return result.rows;
}

export async function transferVehicleOwnership(organizationId, vehicleId, { customerId, startedOn, transferReason, recordedBy }) {
  await assertVehicleOwned(organizationId, vehicleId);
  const owner = await query('select display_name as "displayName" from customers where id = $1 and organization_id = $2', [customerId, organizationId]);
  if (!owner.rowCount) throw Object.assign(new Error("Customer not found."), { status: 404, code: "CUSTOMER_NOT_FOUND", expose: true });

  const effectiveDate = startedOn ?? new Date().toISOString();
  await query(
    `update vehicle_ownerships set ended_on = $3
      where vehicle_id = $1 and organization_id = $2 and ended_on is null`,
    [vehicleId, organizationId, effectiveDate],
  );
  const inserted = await query(
    `insert into vehicle_ownerships (organization_id, vehicle_id, customer_id, started_on, is_primary, transfer_reason, recorded_by)
     values ($1, $2, $3, $4, true, $5, $6)
     returning id, vehicle_id as "vehicleId", customer_id as "customerId", started_on as "startedOn",
               ended_on as "endedOn", is_primary as "isPrimary", transfer_reason as "transferReason"`,
    [organizationId, vehicleId, customerId, effectiveDate, transferReason ?? null, recordedBy ?? null],
  );
  await recordVehicleEvent(vehicleId, customerId, "ownership-transfer", `Ownership transferred to ${owner.rows[0].displayName}${transferReason ? ` — ${transferReason}` : ""}`);
  return { ...inserted.rows[0], customerName: owner.rows[0].displayName };
}

// ---------------------------------------------------------------------------
// Documents (metadata and a storage reference only -- see database/021_vehicle_360_core.sql)
// ---------------------------------------------------------------------------

export async function listVehicleDocuments(organizationId, vehicleId, { limit, offset }) {
  await assertVehicleOwned(organizationId, vehicleId);
  const result = await query(
    `select id, vehicle_id as "vehicleId", document_type as "documentType", label, status,
            storage_reference as "storageReference", uploaded_by as "uploadedBy", created_at as "createdAt"
       from vehicle_documents
      where organization_id = $1 and vehicle_id = $2
      order by created_at desc limit $3 offset $4`,
    [organizationId, vehicleId, limit, offset],
  );
  return result.rows;
}

export async function createVehicleDocument(organizationId, vehicleId, { documentType, label, status, storageReference, uploadedBy }) {
  await assertVehicleOwned(organizationId, vehicleId);
  const result = await query(
    `insert into vehicle_documents (organization_id, vehicle_id, document_type, label, status, storage_reference, uploaded_by)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning id, vehicle_id as "vehicleId", document_type as "documentType", label, status,
               storage_reference as "storageReference", uploaded_by as "uploadedBy", created_at as "createdAt"`,
    [organizationId, vehicleId, documentType, label, status ?? "received", storageReference ?? null, uploadedBy ?? null],
  );
  return result.rows[0];
}

export async function updateVehicleDocumentStatus(organizationId, vehicleId, documentId, status) {
  const result = await query(
    `update vehicle_documents set status = $4
      where id = $1 and vehicle_id = $2 and organization_id = $3
      returning id, vehicle_id as "vehicleId", document_type as "documentType", label, status,
                storage_reference as "storageReference", uploaded_by as "uploadedBy", created_at as "createdAt"`,
    [documentId, vehicleId, organizationId, status],
  );
  return result.rows[0];
}

// ---------------------------------------------------------------------------
// Trade-in / acquisition appraisal
// ---------------------------------------------------------------------------

export async function listVehicleAppraisals(organizationId, vehicleId, { limit, offset }) {
  await assertVehicleOwned(organizationId, vehicleId);
  const result = await query(
    `select va.id, va.vehicle_id as "vehicleId", va.customer_id as "customerId", c.display_name as "customerName",
            va.condition_grade as "conditionGrade", va.odometer_km as "odometerKm", va.exterior_notes as "exteriorNotes",
            va.mechanical_notes as "mechanicalNotes", va.offered_value::float as "offeredValue", va.status,
            va.created_at as "createdAt", va.decided_at as "decidedAt"
       from vehicle_appraisals va
       left join customers c on c.id = va.customer_id
      where va.organization_id = $1 and va.vehicle_id = $2
      order by va.created_at desc limit $3 offset $4`,
    [organizationId, vehicleId, limit, offset],
  );
  return result.rows;
}

export async function createVehicleAppraisal(organizationId, vehicleId, { customerId, appraiserId, conditionGrade, odometerKm, exteriorNotes, mechanicalNotes, offeredValue, status }) {
  await assertVehicleOwned(organizationId, vehicleId);
  const result = await query(
    `insert into vehicle_appraisals (organization_id, vehicle_id, customer_id, appraiser_id, condition_grade, odometer_km, exterior_notes, mechanical_notes, offered_value, status)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     returning id, vehicle_id as "vehicleId", customer_id as "customerId", condition_grade as "conditionGrade",
               odometer_km as "odometerKm", exterior_notes as "exteriorNotes", mechanical_notes as "mechanicalNotes",
               offered_value::float as "offeredValue", status, created_at as "createdAt", decided_at as "decidedAt"`,
    [organizationId, vehicleId, customerId ?? null, appraiserId ?? null, conditionGrade, odometerKm ?? null, exteriorNotes ?? null, mechanicalNotes ?? null, offeredValue ?? null, status ?? "draft"],
  );
  await recordVehicleEvent(vehicleId, customerId, "appraisal", `Trade-in appraisal recorded — condition ${conditionGrade}${offeredValue ? `, offered ${offeredValue}` : ""}`);
  return result.rows[0];
}

// Accepting an appraisal also logs its offered value as a 'trade' valuation, so the Valuation
// tab's history reflects the decision without a second manual entry.
export async function updateVehicleAppraisalStatus(organizationId, vehicleId, appraisalId, status, decidedBy) {
  const result = await query(
    `update vehicle_appraisals set status = $4, decided_at = case when $4 in ('accepted', 'declined', 'expired') then now() else decided_at end
      where id = $1 and vehicle_id = $2 and organization_id = $3
      returning id, vehicle_id as "vehicleId", customer_id as "customerId", condition_grade as "conditionGrade",
                odometer_km as "odometerKm", exterior_notes as "exteriorNotes", mechanical_notes as "mechanicalNotes",
                offered_value::float as "offeredValue", status, created_at as "createdAt", decided_at as "decidedAt"`,
    [appraisalId, vehicleId, organizationId, status],
  );
  const appraisal = result.rows[0];
  if (appraisal && status === "accepted" && appraisal.offeredValue) {
    await createVehicleValuation(organizationId, vehicleId, { source: "trade", value: appraisal.offeredValue, notes: "From accepted trade-in appraisal", createdBy: decidedBy });
    await recordVehicleEvent(vehicleId, appraisal.customerId, "appraisal-accepted", `Trade-in appraisal accepted at ${appraisal.offeredValue}`);
  }
  return appraisal;
}

// ---------------------------------------------------------------------------
// Valuation history
// ---------------------------------------------------------------------------

export async function listVehicleValuations(organizationId, vehicleId, { limit, offset }) {
  await assertVehicleOwned(organizationId, vehicleId);
  const result = await query(
    `select id, vehicle_id as "vehicleId", source, value::float as value, notes,
            valued_at as "valuedAt", created_by as "createdBy"
       from vehicle_valuations
      where organization_id = $1 and vehicle_id = $2
      order by valued_at desc limit $3 offset $4`,
    [organizationId, vehicleId, limit, offset],
  );
  return result.rows;
}

// vehicles.market_value stays the cached "current" figure existing readers rely on; a fresh
// 'market' valuation refreshes it here so the two never drift apart.
export async function createVehicleValuation(organizationId, vehicleId, { source, value, notes, createdBy }) {
  await assertVehicleOwned(organizationId, vehicleId);
  const result = await query(
    `insert into vehicle_valuations (organization_id, vehicle_id, source, value, notes, created_by)
     values ($1, $2, $3, $4, $5, $6)
     returning id, vehicle_id as "vehicleId", source, value::float as value, notes, valued_at as "valuedAt", created_by as "createdBy"`,
    [organizationId, vehicleId, source, value, notes ?? null, createdBy ?? null],
  );
  if (source === "market") {
    await query("update vehicles set market_value = $3 where id = $1 and organization_id = $2", [vehicleId, organizationId, value]);
  }
  await recordVehicleEvent(vehicleId, null, "valuation", `${source} valuation recorded — ${value}`);
  return result.rows[0];
}

// ---------------------------------------------------------------------------
// Auction disposition
// ---------------------------------------------------------------------------

export async function listVehicleAuctionListings(organizationId, vehicleId, { limit, offset }) {
  await assertVehicleOwned(organizationId, vehicleId);
  const listings = await query(
    `select id, vehicle_id as "vehicleId", status, auction_house as "auctionHouse", reserve_price::float as "reservePrice",
            listed_at as "listedAt", closes_at as "closesAt", sold_price::float as "soldPrice", buyer_note as "buyerNote",
            created_at as "createdAt"
       from vehicle_auction_listings
      where organization_id = $1 and vehicle_id = $2
      order by created_at desc limit $3 offset $4`,
    [organizationId, vehicleId, limit, offset],
  );
  if (!listings.rowCount) return [];
  const bids = await query(
    `select id, listing_id as "listingId", bidder_name as "bidderName", amount::float as amount, placed_at as "placedAt"
       from vehicle_auction_bids where listing_id = any($1::uuid[]) order by amount desc, placed_at desc`,
    [listings.rows.map((row) => row.id)],
  );
  const bidsByListing = new Map();
  for (const bid of bids.rows) {
    if (!bidsByListing.has(bid.listingId)) bidsByListing.set(bid.listingId, []);
    bidsByListing.get(bid.listingId).push(bid);
  }
  return listings.rows.map((listing) => ({ ...listing, bids: bidsByListing.get(listing.id) ?? [] }));
}

export async function createVehicleAuctionListing(organizationId, vehicleId, { auctionHouse, reservePrice, closesAt, status, createdBy }) {
  await assertVehicleOwned(organizationId, vehicleId);
  const initialStatus = status ?? "draft";
  if (initialStatus === "listed" || initialStatus === "bidding") await assertVehicleAvailableForDisposition(organizationId, vehicleId);
  const result = await query(
    `insert into vehicle_auction_listings (organization_id, vehicle_id, status, auction_house, reserve_price, listed_at, closes_at, created_by)
     values ($1, $2, $3, $4, $5, case when $3 in ('listed', 'bidding') then now() else null end, $6, $7)
     returning id, vehicle_id as "vehicleId", status, auction_house as "auctionHouse", reserve_price::float as "reservePrice",
               listed_at as "listedAt", closes_at as "closesAt", sold_price::float as "soldPrice", buyer_note as "buyerNote",
               created_at as "createdAt"`,
    [organizationId, vehicleId, initialStatus, auctionHouse ?? null, reservePrice ?? null, closesAt ?? null, createdBy ?? null],
  );
  if (initialStatus === "listed" || initialStatus === "bidding") {
    await query("update vehicles set status = 'auction' where id = $1 and organization_id = $2", [vehicleId, organizationId]);
    await recordVehicleEvent(vehicleId, null, "auction-listed", `Listed for auction${auctionHouse ? ` with ${auctionHouse}` : ""}`);
  }
  return { ...result.rows[0], bids: [] };
}

export async function updateVehicleAuctionListing(organizationId, vehicleId, listingId, { status, reservePrice, closesAt, soldPrice, buyerNote }) {
  const existing = await query(
    "select status from vehicle_auction_listings where id = $1 and vehicle_id = $2 and organization_id = $3",
    [listingId, vehicleId, organizationId],
  );
  if (!existing.rowCount) return undefined;
  if (status && (status === "listed" || status === "bidding") && !["listed", "bidding"].includes(existing.rows[0].status)) {
    await assertVehicleAvailableForDisposition(organizationId, vehicleId);
  }

  const result = await query(
    `update vehicle_auction_listings set
       status = coalesce($4, status),
       reserve_price = coalesce($5, reserve_price),
       closes_at = coalesce($6, closes_at),
       sold_price = coalesce($7, sold_price),
       buyer_note = coalesce($8, buyer_note),
       listed_at = case when $4 in ('listed', 'bidding') and listed_at is null then now() else listed_at end,
       updated_at = now()
      where id = $1 and vehicle_id = $2 and organization_id = $3
      returning id, vehicle_id as "vehicleId", status, auction_house as "auctionHouse", reserve_price::float as "reservePrice",
                listed_at as "listedAt", closes_at as "closesAt", sold_price::float as "soldPrice", buyer_note as "buyerNote",
                created_at as "createdAt"`,
    [listingId, vehicleId, organizationId, status ?? null, reservePrice ?? null, closesAt ?? null, soldPrice ?? null, buyerNote ?? null],
  );
  const listing = result.rows[0];
  if (!listing) return undefined;

  if (status === "sold") {
    await query("update vehicles set status = 'sold' where id = $1 and organization_id = $2", [vehicleId, organizationId]);
    await recordVehicleEvent(vehicleId, null, "auction-sold", `Sold at auction for ${listing.soldPrice ?? listing.reservePrice ?? "an undisclosed price"}`);
  } else if (status === "unsold" || status === "cancelled") {
    await query("update vehicles set status = 'in-stock' where id = $1 and organization_id = $2 and status = 'auction'", [vehicleId, organizationId]);
    await recordVehicleEvent(vehicleId, null, "auction-closed", `Auction listing ${status}`);
  } else if (status === "listed" || status === "bidding") {
    await query("update vehicles set status = 'auction' where id = $1 and organization_id = $2", [vehicleId, organizationId]);
  }

  const bids = await query(
    `select id, listing_id as "listingId", bidder_name as "bidderName", amount::float as amount, placed_at as "placedAt"
       from vehicle_auction_bids where listing_id = $1 order by amount desc, placed_at desc`,
    [listingId],
  );
  return { ...listing, bids: bids.rows };
}

export async function createVehicleAuctionBid(organizationId, vehicleId, listingId, { bidderName, amount }) {
  const listing = await query(
    "select status from vehicle_auction_listings where id = $1 and vehicle_id = $2 and organization_id = $3",
    [listingId, vehicleId, organizationId],
  );
  if (!listing.rowCount) throw Object.assign(new Error("Auction listing not found."), { status: 404, code: "AUCTION_LISTING_NOT_FOUND", expose: true });
  if (!["listed", "bidding"].includes(listing.rows[0].status)) {
    throw Object.assign(new Error("This auction listing is not open for bids."), { status: 409, code: "AUCTION_NOT_OPEN", expose: true });
  }
  const result = await query(
    `insert into vehicle_auction_bids (listing_id, bidder_name, amount)
     values ($1, $2, $3)
     returning id, listing_id as "listingId", bidder_name as "bidderName", amount::float as amount, placed_at as "placedAt"`,
    [listingId, bidderName, amount],
  );
  await query("update vehicle_auction_listings set status = 'bidding', updated_at = now() where id = $1 and status = 'listed'", [listingId]);
  await recordVehicleEvent(vehicleId, null, "auction-bid", `Bid recorded — ${bidderName} at ${amount}`);
  return result.rows[0];
}

// ---------------------------------------------------------------------------
// Rental / demo disposition
// ---------------------------------------------------------------------------

export async function listVehicleDispositions(organizationId, vehicleId, { limit, offset }) {
  await assertVehicleOwned(organizationId, vehicleId);
  const result = await query(
    `select vd.id, vd.vehicle_id as "vehicleId", vd.disposition_type as "dispositionType", vd.customer_id as "customerId",
            c.display_name as "customerName", vd.starts_at as "startsAt", vd.ends_at as "endsAt", vd.status,
            vd.odometer_out as "odometerOut", vd.odometer_in as "odometerIn", vd.notes, vd.created_at as "createdAt"
       from vehicle_dispositions vd
       left join customers c on c.id = vd.customer_id
      where vd.organization_id = $1 and vd.vehicle_id = $2
      order by vd.starts_at desc limit $3 offset $4`,
    [organizationId, vehicleId, limit, offset],
  );
  return result.rows;
}

export async function createVehicleDisposition(organizationId, vehicleId, { dispositionType, customerId, startsAt, odometerOut, notes, createdBy }) {
  await assertVehicleOwned(organizationId, vehicleId);
  await assertVehicleAvailableForDisposition(organizationId, vehicleId);
  const result = await query(
    `insert into vehicle_dispositions (organization_id, vehicle_id, disposition_type, customer_id, starts_at, odometer_out, notes, created_by)
     values ($1, $2, $3, $4, coalesce($5, now()), $6, $7, $8)
     returning id, vehicle_id as "vehicleId", disposition_type as "dispositionType", customer_id as "customerId",
               starts_at as "startsAt", ends_at as "endsAt", status, odometer_out as "odometerOut",
               odometer_in as "odometerIn", notes, created_at as "createdAt"`,
    [organizationId, vehicleId, dispositionType, customerId ?? null, startsAt ?? null, odometerOut ?? null, notes ?? null, createdBy ?? null],
  ).catch((cause) => {
    if (cause?.cause?.code === "23505") {
      throw Object.assign(new Error("This vehicle is already checked out on an active rental or demo."), { status: 409, code: "VEHICLE_UNAVAILABLE", expose: true });
    }
    throw cause;
  });
  await query("update vehicles set status = $3 where id = $1 and organization_id = $2", [vehicleId, organizationId, dispositionType]);
  await recordVehicleEvent(vehicleId, customerId, dispositionType === "rental" ? "rental-checkout" : "demo-checkout", `Checked out for ${dispositionType}${customerId ? "" : " (no customer attached)"}`);
  return result.rows[0];
}

export async function updateVehicleDisposition(organizationId, vehicleId, dispositionId, { status, odometerIn, notes }) {
  const result = await query(
    `update vehicle_dispositions set
       status = coalesce($4, status),
       odometer_in = coalesce($5, odometer_in),
       notes = coalesce($6, notes),
       ends_at = case when $4 in ('completed', 'cancelled') then now() else ends_at end
      where id = $1 and vehicle_id = $2 and organization_id = $3
      returning id, vehicle_id as "vehicleId", disposition_type as "dispositionType", customer_id as "customerId",
                starts_at as "startsAt", ends_at as "endsAt", status, odometer_out as "odometerOut",
                odometer_in as "odometerIn", notes, created_at as "createdAt"`,
    [dispositionId, vehicleId, organizationId, status ?? null, odometerIn ?? null, notes ?? null],
  );
  const disposition = result.rows[0];
  if (!disposition) return undefined;

  if (status === "completed" || status === "cancelled") {
    const values = [vehicleId, organizationId];
    let odometerSet = "";
    if (odometerIn) { values.push(odometerIn); odometerSet = `, odometer_km = $${values.length}`; }
    await query(`update vehicles set status = 'in-stock'${odometerSet} where id = $1 and organization_id = $2`, values);
    await recordVehicleEvent(vehicleId, disposition.customerId, "disposition-checkin", `${disposition.dispositionType === "rental" ? "Rental" : "Demo"} ${status}${odometerIn ? ` — returned at ${odometerIn} km` : ""}`);
  }
  return disposition;
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

// ---------------------------------------------------------------------------
// Audit events
// ---------------------------------------------------------------------------

export async function listAuditEvents(organizationId, { limit, offset }) {
  const result = await query(
    `select ae.id, ae.actor_user_id as "actorUserId", u.name as "actorName", ae.actor_role as "actorRole",
            ae.action, ae.method, ae.path, ae.status_code as "statusCode", ae.target_type as "targetType",
            ae.target_id as "targetId", ae.request_id as "requestId", ae.occurred_at as "occurredAt"
       from audit_events ae
       left join users u on u.id = ae.actor_user_id
      where ae.organization_id = $1
      order by ae.occurred_at desc
      limit $2 offset $3`,
    [organizationId, limit, offset],
  );
  return result.rows;
}
