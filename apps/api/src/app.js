import { randomUUID } from "node:crypto";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { databaseStatus, findCustomers, findVehicles, getCustomer360, getVehicle360, searchAllRecords } from "./db.js";
import { demoCustomers, demoOperationalRecords, demoVehicles, overview } from "./demo-data.js";
import { asyncRoute, errorEnvelope, HttpError } from "./errors.js";

export const app = express();

const allowedOrigins = new Set(
  String(process.env.WEB_ORIGIN ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

app.disable("x-powered-by");
app.use(helmet());
app.use((request, response, next) => {
  request.requestId = randomUUID();
  response.setHeader("X-Request-Id", request.requestId);
  next();
});
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.size === 0 || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new HttpError(403, "ORIGIN_NOT_ALLOWED", "This origin is not allowed."));
  },
}));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", asyncRoute(async (_request, response) => {
  const database = await databaseStatus();
  const degraded = database.status === "unavailable";
  response
    .status(degraded ? 503 : 200)
    .setHeader("Cache-Control", "no-store")
    .json({
      service: "autoaxis-api",
      status: degraded ? "degraded" : "ok",
      mode: database.status === "not-configured" ? "demonstration" : "connected",
      database,
    });
}));

app.get("/api/v1/overview", (_request, response) => response.json(overview));

function includesSearch(value, normalizedQuery) {
  return String(value ?? "").replace(/\s/g, "").toLowerCase().includes(normalizedQuery);
}

app.get("/api/v1/search", asyncRoute(async (request, response) => {
  const query = String(request.query.q ?? "").trim();
  const requestedLimit = Number(request.query.limit ?? 5);
  if (query.length < 2 || query.length > 120) {
    throw new HttpError(400, "INVALID_SEARCH_QUERY", "Enter between two and 120 characters.");
  }
  if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 10) {
    throw new HttpError(400, "INVALID_SEARCH_LIMIT", "Search limit must be between one and 10.");
  }

  const databaseResults = await searchAllRecords(query, requestedLimit);
  if (databaseResults) {
    const customerResults = databaseResults.customers.map((record) => ({ ...record, kind: "customer", view: "customers" }));
    const vehicleResults = databaseResults.vehicles.map((record) => ({ ...record, kind: "vehicle", view: "vehicles" }));
    const groups = [
      { id: "customers", label: "Customers", results: customerResults },
      { id: "vehicles", label: "Vehicles", results: vehicleResults },
      { id: "operations", label: "Operational records", results: databaseResults.operations },
    ];
    return response.json({ dataSource: "postgresql", query, total: groups.reduce((total, group) => total + group.results.length, 0), groups });
  }

  const normalized = query.replace(/\s/g, "").toLowerCase();
  const customerResults = demoCustomers
    .filter((customer) => [customer.displayName, customer.mobile, customer.email, ...customer.vehicles.flatMap((vehicle) => [vehicle.vin, vehicle.registration])].some((value) => includesSearch(value, normalized)))
    .slice(0, requestedLimit)
    .map((customer) => ({ id: customer.id, kind: "customer", title: customer.displayName, subtitle: `${customer.mobile} · ${customer.email}`, meta: customer.vehicles[0] ? `${customer.vehicles[0].make} ${customer.vehicles[0].model}` : "Customer record", view: "customers" }));
  const vehicleResults = demoVehicles
    .filter((vehicle) => [vehicle.vin, vehicle.registration, vehicle.make, vehicle.model, vehicle.ownerName].some((value) => includesSearch(value, normalized)))
    .slice(0, requestedLimit)
    .map((vehicle) => ({ id: vehicle.id, kind: "vehicle", title: `${vehicle.modelYear} ${vehicle.make} ${vehicle.model}`, subtitle: `${vehicle.registration} · ${vehicle.vin}`, meta: vehicle.ownerName, view: "vehicles" }));
  const operationResults = demoOperationalRecords
    .filter((record) => [record.id, record.title, record.subtitle, record.meta].some((value) => includesSearch(value, normalized)))
    .slice(0, requestedLimit);
  const groups = [
    { id: "customers", label: "Customers", results: customerResults },
    { id: "vehicles", label: "Vehicles", results: vehicleResults },
    { id: "operations", label: "Operational records", results: operationResults },
  ];
  return response.json({ dataSource: "demonstration", query, total: groups.reduce((total, group) => total + group.results.length, 0), groups });
}));

app.get("/api/v1/customers/search", asyncRoute(async (request, response) => {
  const query = String(request.query.q ?? "").trim();
  if (query.length < 2 || query.length > 120) {
    throw new HttpError(400, "INVALID_SEARCH_QUERY", "Enter between two and 120 characters.");
  }

  const rows = await findCustomers(query);
  if (rows) return response.json({ dataSource: "postgresql", customers: rows });

  const normalized = query.replace(/\s/g, "").toLowerCase();
  const customers = demoCustomers.filter((customer) =>
    [customer.displayName, customer.mobile, customer.email]
      .some((value) => value.replace(/\s/g, "").toLowerCase().includes(normalized)),
  );
  return response.json({ dataSource: "demonstration", customers });
}));

app.get("/api/v1/customers/:id/360", asyncRoute(async (request, response) => {
  const customer = await getCustomer360(request.params.id);
  if (customer === undefined) throw new HttpError(404, "CUSTOMER_NOT_FOUND", "Customer not found.");
  if (customer) return response.json({ dataSource: "postgresql", customer });
  const demoRecord = demoCustomers.find((customer) => customer.id === request.params.id);
  if (!demoRecord) throw new HttpError(404, "CUSTOMER_NOT_FOUND", "Customer not found.");
  return response.json({ dataSource: "demonstration", customer: demoRecord });
}));

app.get("/api/v1/vehicles/search", asyncRoute(async (request, response) => {
  const query = String(request.query.q ?? "").trim();
  if (query.length < 2 || query.length > 120) {
    throw new HttpError(400, "INVALID_SEARCH_QUERY", "Enter between two and 120 characters.");
  }

  const rows = await findVehicles(query);
  if (rows) return response.json({ dataSource: "postgresql", vehicles: rows });

  const normalized = query.toLowerCase();
  const vehicles = demoVehicles.filter((item) =>
    [item.vin, item.registration, item.make, item.model]
      .some((value) => value.toLowerCase().includes(normalized)),
  );
  return response.json({ dataSource: "demonstration", vehicles });
}));

app.get("/api/v1/vehicles/:id/360", asyncRoute(async (request, response) => {
  const vehicle = await getVehicle360(request.params.id);
  if (vehicle === undefined) throw new HttpError(404, "VEHICLE_NOT_FOUND", "Vehicle not found.");
  if (vehicle) return response.json({ dataSource: "postgresql", vehicle });

  const demoVehicle = demoVehicles.find((item) => item.id === request.params.id);
  if (!demoVehicle) throw new HttpError(404, "VEHICLE_NOT_FOUND", "Vehicle not found.");
  return response.json({ dataSource: "demonstration", vehicle: demoVehicle });
}));

app.get("/api/v1/modules/:module/summary", (request, response) => {
  const modules = new Set(["sales", "service", "parts", "finance", "marketing", "usedcars", "inventory", "branch", "group"]);
  if (!modules.has(request.params.module)) throw new HttpError(404, "MODULE_NOT_FOUND", "Module not found.");
  return response.json({ dataSource: "demonstration", module: request.params.module, generatedAt: new Date().toISOString(), kpis: overview.kpis });
});

app.use((request, _response, next) => next(new HttpError(404, "ROUTE_NOT_FOUND", `Route ${request.method} ${request.path} was not found.`)));

app.use((error, request, response, _next) => {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  if (status >= 500) {
    console.error(JSON.stringify({
      level: "error",
      event: "request_failed",
      requestId: request.requestId,
      method: request.method,
      path: request.path,
      status,
      errorName: error?.name ?? "Error",
      errorCode: error?.code ?? "INTERNAL_ERROR",
    }));
  }
  response.status(status).json(errorEnvelope(error, request.requestId));
});
