import { randomUUID } from "node:crypto";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { databaseStatus } from "./db.js";
import { asyncRoute, errorEnvelope, HttpError } from "./errors.js";
import { authenticate } from "./middleware.js";
import { authRouter } from "./routes/auth.js";
import { branchesRouter } from "./routes/branches.js";
import { communicationsRouter } from "./routes/communications.js";
import { customersRouter } from "./routes/customers.js";
import { financeContractsRouter, insurancePoliciesRouter } from "./routes/finance.js";
import { organizationsRouter } from "./routes/organizations.js";
import { overviewRouter } from "./routes/overview.js";
import { partsRouter } from "./routes/parts.js";
import { leadsRouter, salesOrdersRouter } from "./routes/sales.js";
import { serviceJobsRouter } from "./routes/service.js";
import { usersRouter } from "./routes/users.js";
import { vehiclesRouter } from "./routes/vehicles.js";

export const app = express();

const allowedOrigins = new Set(
  String(process.env.WEB_ORIGIN ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);
// Vercel sets these automatically per-deployment; allowing them means the exact URL serving
// this request (production alias or a preview build) always works without a manual WEB_ORIGIN
// update, which is otherwise a common way to lock everyone out of login after a deploy.
if (process.env.VERCEL_PROJECT_PRODUCTION_URL) allowedOrigins.add(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
if (process.env.VERCEL_URL) allowedOrigins.add(`https://${process.env.VERCEL_URL}`);

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
      mode: database.status === "not-configured" ? "not-configured" : "connected",
      database,
    });
}));

// Authentication routes issue and verify their own tokens, so they run before the auth gate below.
app.use("/api/v1/auth", authRouter);

app.use("/api/v1", authenticate);

app.use("/api/v1/organizations", organizationsRouter);
app.use("/api/v1/branches", branchesRouter);
app.use("/api/v1/users", usersRouter);
app.use("/api/v1/overview", overviewRouter);
app.use("/api/v1/customers", customersRouter);
app.use("/api/v1/vehicles", vehiclesRouter);
app.use("/api/v1/leads", leadsRouter);
app.use("/api/v1/sales-orders", salesOrdersRouter);
app.use("/api/v1/service-jobs", serviceJobsRouter);
app.use("/api/v1/parts", partsRouter);
app.use("/api/v1/finance-contracts", financeContractsRouter);
app.use("/api/v1/insurance-policies", insurancePoliciesRouter);
app.use("/api/v1/communications", communicationsRouter);

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
