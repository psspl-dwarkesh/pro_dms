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

async function query(text, values = undefined) {
  if (!pool) return null;
  try {
    return await pool.query(text, values);
  } catch (cause) {
    throw new DatabaseUnavailableError({ cause });
  }
}

function normalizeDemoContact(record) {
  if (!record) return record;
  return {
    ...record,
    email: record.email === "james.hartley@example.com" ? "james.hartley@prakashinfotech.com" : record.email,
  };
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

export async function findCustomers(searchTerm) {
  if (!pool) return null;
  const value = `%${searchTerm}%`;
  const result = await query(
    `select id, display_name as "displayName", customer_type as "customerType",
            mobile, email, lifetime_value::float as "lifetimeValue"
       from customers
      where display_name ilike $1 or mobile ilike $1 or email ilike $1
      order by lifetime_value desc limit 20`,
    [value],
  );
  return result.rows.map(normalizeDemoContact);
}

export async function getCustomer360(id) {
  if (!pool) return null;
  const customerResult = await query(
    `select id, display_name as "displayName", customer_type as "customerType",
            mobile, email, preferred_channel as "preferredChannel", address,
            lifetime_value::float as "lifetimeValue", created_at as "customerSince"
       from customers where id = $1`,
    [id],
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
    ...normalizeDemoContact(customerResult.rows[0]),
    vehicles: vehicles.rows,
    timeline: timeline.rows,
    serviceVisitCount: serviceVisits.rows[0].count,
  };
}

export async function findVehicles(searchTerm) {
  if (!pool) return null;
  const result = await query(
    `select id, vin, registration, make, model, variant, status
       from vehicles
      where vin ilike $1 or registration ilike $1 or make ilike $1 or model ilike $1
      order by model_year desc nulls last limit 20`,
    [`%${searchTerm}%`],
  );
  return result.rows;
}

export async function getVehicle360(id) {
  if (!pool) return null;
  const result = await query(
    `select v.id, v.vin, v.registration, v.make, v.model, v.variant, v.colour,
            v.model_year as "modelYear", v.odometer_km as "odometerKm",
            v.market_value::float as "marketValue", v.status,
            c.id as "ownerId", c.display_name as "ownerName", c.mobile as "ownerMobile"
       from vehicles v
       left join vehicle_ownerships vo on vo.vehicle_id = v.id and vo.ended_on is null
       left join customers c on c.id = vo.customer_id
      where v.id = $1`,
    [id],
  );
  if (!result.rowCount) return undefined;
  const history = await query(
    `select occurred_at as "occurredAt", interaction_type as type, summary
       from interactions where vehicle_id = $1 order by occurred_at desc limit 50`,
    [id],
  );
  return { ...result.rows[0], timeline: history.rows };
}
