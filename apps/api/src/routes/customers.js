import { Router } from "express";
import { createCustomer, deleteCustomer, getCustomer360, listCustomers, updateCustomer } from "../db.js";
import { asyncRoute, HttpError } from "../errors.js";
import { optionalNumber, optionalString, requireEnum, requireString, requireUuid, paginationParams } from "../validate.js";

export const customersRouter = Router();

customersRouter.get("/", asyncRoute(async (request, response) => {
  const search = optionalString(request.query.q, 120);
  const { limit, offset } = paginationParams(request.query);
  const customers = await listCustomers(request.auth.organizationId, { search, limit, offset });
  response.json({ customers });
}));

customersRouter.post("/", asyncRoute(async (request, response) => {
  const customerType = requireEnum(request.body.customerType, "Customer type", ["individual", "company"]);
  const displayName = requireString(request.body.displayName, "Name", { min: 2, max: 160 });
  const mobile = optionalString(request.body.mobile, 32);
  const email = optionalString(request.body.email, 160);
  const preferredChannel = optionalString(request.body.preferredChannel, 40);
  const address = optionalString(request.body.address, 240);
  const customer = await createCustomer(request.auth.organizationId, { customerType, displayName, mobile, email, preferredChannel, address });
  response.status(201).json({ customer });
}));

customersRouter.get("/:id/360", asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Customer id");
  const customer = await getCustomer360(request.auth.organizationId, id);
  if (!customer) throw new HttpError(404, "CUSTOMER_NOT_FOUND", "Customer not found.");
  response.json({ customer });
}));

customersRouter.patch("/:id", asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Customer id");
  const displayName = optionalString(request.body.displayName, 160);
  const mobile = optionalString(request.body.mobile, 32);
  const email = optionalString(request.body.email, 160);
  const preferredChannel = optionalString(request.body.preferredChannel, 40);
  const address = optionalString(request.body.address, 240);
  const lifetimeValue = optionalNumber(request.body.lifetimeValue);
  const customer = await updateCustomer(request.auth.organizationId, id, { displayName, mobile, email, preferredChannel, address, lifetimeValue });
  if (!customer) throw new HttpError(404, "CUSTOMER_NOT_FOUND", "Customer not found.");
  response.json({ customer });
}));

customersRouter.delete("/:id", asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Customer id");
  const deleted = await deleteCustomer(request.auth.organizationId, id);
  if (!deleted) throw new HttpError(404, "CUSTOMER_NOT_FOUND", "Customer not found.");
  response.status(204).end();
}));
