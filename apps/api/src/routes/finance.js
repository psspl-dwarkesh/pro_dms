import { Router } from "express";
import {
  createFinanceContract, createInsurancePolicy, listFinanceContracts, listInsurancePolicies,
  updateFinanceContract, updateInsurancePolicy,
} from "../db.js";
import { asyncRoute, HttpError } from "../errors.js";
import { optionalNumber, requireEnum, requireNumber, requireString, requireUuid, paginationParams } from "../validate.js";

export const financeContractsRouter = Router();
export const insurancePoliciesRouter = Router();

const CONTRACT_STATUSES = ["submitted", "approved", "declined", "settled"];
const POLICY_STATUSES = ["quoted", "active", "lapsed", "cancelled"];

financeContractsRouter.get("/", asyncRoute(async (request, response) => {
  const { limit, offset } = paginationParams(request.query);
  const financeContracts = await listFinanceContracts(request.auth.organizationId, { limit, offset });
  response.json({ financeContracts });
}));

financeContractsRouter.post("/", asyncRoute(async (request, response) => {
  const salesOrderId = requireUuid(request.body.salesOrderId, "Sales order id");
  const provider = requireString(request.body.provider, "Provider", { min: 2, max: 120 });
  const productType = requireString(request.body.productType, "Product type", { min: 2, max: 60 });
  const amountFinanced = requireNumber(request.body.amountFinanced, "Amount financed", { min: 0 });
  const status = requireEnum(request.body.status ?? "submitted", "Status", CONTRACT_STATUSES);
  const financeContract = await createFinanceContract(request.auth.organizationId, { salesOrderId, provider, productType, amountFinanced, status });
  response.status(201).json({ financeContract });
}));

financeContractsRouter.patch("/:id", asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Finance contract id");
  const status = request.body.status ? requireEnum(request.body.status, "Status", CONTRACT_STATUSES) : null;
  const commission = optionalNumber(request.body.commission);
  const financeContract = await updateFinanceContract(request.auth.organizationId, id, { status, commission });
  if (!financeContract) throw new HttpError(404, "FINANCE_CONTRACT_NOT_FOUND", "Finance contract not found.");
  response.json({ financeContract });
}));

insurancePoliciesRouter.get("/", asyncRoute(async (request, response) => {
  const { limit, offset } = paginationParams(request.query);
  const insurancePolicies = await listInsurancePolicies(request.auth.organizationId, { limit, offset });
  response.json({ insurancePolicies });
}));

insurancePoliciesRouter.post("/", asyncRoute(async (request, response) => {
  const customerId = requireUuid(request.body.customerId, "Customer id");
  const vehicleId = requireUuid(request.body.vehicleId, "Vehicle id");
  const provider = requireString(request.body.provider, "Provider", { min: 2, max: 120 });
  const policyNumber = requireString(request.body.policyNumber, "Policy number", { min: 2, max: 60 });
  const status = requireEnum(request.body.status ?? "quoted", "Status", POLICY_STATUSES);
  const startsOn = requireString(request.body.startsOn, "Start date", { min: 8, max: 20 });
  const expiresOn = requireString(request.body.expiresOn, "Expiry date", { min: 8, max: 20 });
  const premium = optionalNumber(request.body.premium);
  const insurancePolicy = await createInsurancePolicy(request.auth.organizationId, { customerId, vehicleId, provider, policyNumber, status, startsOn, expiresOn, premium });
  response.status(201).json({ insurancePolicy });
}));

insurancePoliciesRouter.patch("/:id", asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Insurance policy id");
  const status = request.body.status ? requireEnum(request.body.status, "Status", POLICY_STATUSES) : null;
  const premium = optionalNumber(request.body.premium);
  const insurancePolicy = await updateInsurancePolicy(request.auth.organizationId, id, { status, premium });
  if (!insurancePolicy) throw new HttpError(404, "INSURANCE_POLICY_NOT_FOUND", "Insurance policy not found.");
  response.json({ insurancePolicy });
}));
