import { Router } from "express";
import { createCommunication, listCommunications } from "../db.js";
import { asyncRoute } from "../errors.js";
import { optionalString, requireEnum, requireString, requireUuid, paginationParams } from "../validate.js";

export const communicationsRouter = Router();

const CHANNELS = ["call", "whatsapp", "email", "sms"];
const DIRECTIONS = ["inbound", "outbound"];

communicationsRouter.get("/", asyncRoute(async (request, response) => {
  const customerId = request.query.customerId ? requireUuid(request.query.customerId, "Customer id") : null;
  const { limit, offset } = paginationParams(request.query);
  const communications = await listCommunications(request.auth.organizationId, customerId, { limit, offset });
  response.json({ communications });
}));

communicationsRouter.post("/", asyncRoute(async (request, response) => {
  const customerId = requireUuid(request.body.customerId, "Customer id");
  const channel = requireEnum(request.body.channel, "Channel", CHANNELS);
  const direction = requireEnum(request.body.direction, "Direction", DIRECTIONS);
  const subject = optionalString(request.body.subject, 160);
  const summary = requireString(request.body.summary, "Summary", { min: 2, max: 500 });
  const communication = await createCommunication(request.auth.organizationId, { customerId, channel, direction, subject, summary });
  response.status(201).json({ communication });
}));
