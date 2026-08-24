import { Router } from "express";
import { asyncRoute, HttpError } from "../errors.js";
import { branchScope } from "../middleware.js";
import { createMarketingCampaign, getMarketingWorkspace, updateMarketingCampaignStatus } from "../marketingRepository.js";
import { authorizePermission, CAPABILITIES } from "../permissions.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CHANNELS = new Set(["email", "sms", "whatsapp", "mixed"]);
const STATUSES = new Set(["draft", "scheduled", "active", "paused", "completed", "cancelled"]);
export const marketingRouter = Router();

marketingRouter.use(authorizePermission(CAPABILITIES.MARKETING_MANAGE));
marketingRouter.get("/", asyncRoute(async (request, response) => {
  response.json({ data: await getMarketingWorkspace(request.auth.organizationId, branchScope(request.auth)) });
}));

marketingRouter.post("/campaigns", asyncRoute(async (request, response) => {
  const body = request.body ?? {};
  if (!UUID.test(String(body.audienceId ?? "")) || !String(body.name ?? "").trim() || !CHANNELS.has(body.channel) || !String(body.objective ?? "").trim()) {
    throw new HttpError(400, "INVALID_CAMPAIGN", "Choose an audience, name, channel, and objective.");
  }
  const startsAt = new Date(body.startsAt);
  const endsAt = new Date(body.endsAt);
  if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime()) || endsAt <= startsAt) {
    throw new HttpError(400, "INVALID_CAMPAIGN_DATES", "The campaign end must be after its start.");
  }
  const campaign = await createMarketingCampaign(request.auth.organizationId, branchScope(request.auth), {
    audienceId: body.audienceId, name: String(body.name).trim().slice(0, 120), channel: body.channel,
    objective: String(body.objective).trim().slice(0, 240), budget: Math.max(0, Number(body.budget) || 0),
    startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), status: body.status === "scheduled" ? "scheduled" : "draft",
  });
  if (!campaign) throw new HttpError(404, "AUDIENCE_NOT_FOUND", "Audience not found.");
  response.status(201).json({ data: campaign });
}));

marketingRouter.patch("/campaigns/:id/status", asyncRoute(async (request, response) => {
  if (!UUID.test(request.params.id) || !STATUSES.has(request.body?.status)) throw new HttpError(400, "INVALID_CAMPAIGN_STATUS", "Choose a valid campaign status.");
  const campaign = await updateMarketingCampaignStatus(request.auth.organizationId, branchScope(request.auth), request.params.id, request.body.status);
  if (!campaign) throw new HttpError(404, "CAMPAIGN_NOT_FOUND", "Campaign not found.");
  response.json({ data: campaign });
}));
