import { Router } from "express";
import { ROLES } from "../auth.js";
import { recordAuditEvent } from "../audit.js";
import { HttpError, asyncRoute } from "../errors.js";
import { authorizePermission, CAPABILITIES, roleCapabilities } from "../permissions.js";
import { optionalString, paginationParams, requireEnum, requireNumber, requireString, requireUuid } from "../validate.js";
import {
  createInvitation, createSchedule, createWorkload, getAdministrationOverview,
  replaceMemberBranchAccess, updateAdminSettings, updateBranchSettings, updateInvitation,
  updateSchedule, updateWorkload,
} from "../administrationRepository.js";

export const administrationRouter = Router();
administrationRouter.use(authorizePermission(CAPABILITIES.ADMIN_MEMBERS_MANAGE));

function isoDate(value, field) {
  const text = requireString(value, field, { min: 10, max: 40 });
  if (Number.isNaN(Date.parse(text))) throw new HttpError(400, "INVALID_INPUT", `${field} must be a valid date.`, [{ field }]);
  return new Date(text).toISOString();
}

async function audit(request, action, targetType, targetId, metadata = {}) {
  await recordAuditEvent({ organizationId: request.auth.organizationId, branchId: request.auth.branchId,
    actorUserId: request.auth.userId, actorRole: request.auth.role, action, method: request.method,
    path: request.path, statusCode: 200, targetType, targetId, requestId: request.requestId, metadata });
}

administrationRouter.get("/", asyncRoute(async (request, response) => {
  const pagination = paginationParams(request.query);
  const data = await getAdministrationOverview(request.auth.organizationId, pagination);
  response.json({ ...data, roles: ROLES.map((role) => ({ role, capabilities: roleCapabilities(role) })) });
}));

administrationRouter.post("/invitations", asyncRoute(async (request, response) => {
  const input = { displayName: requireString(request.body.displayName, "Display name", { min: 2, max: 120 }),
    email: requireString(request.body.email, "Email", { min: 5, max: 160 }).toLowerCase(),
    role: requireEnum(request.body.role, "Role", ROLES), branchId: request.body.branchId ? requireUuid(request.body.branchId, "Branch") : null };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) throw new HttpError(400, "INVALID_INPUT", "Enter a valid email.", [{ field: "email" }]);
  const invitation = await createInvitation(request.auth.organizationId, request.auth.userId, input);
  if (!invitation) throw new HttpError(404, "BRANCH_NOT_FOUND", "Branch not found.");
  await audit(request, "administration.invitation.created", "invitation", invitation.id, { role: input.role });
  response.status(201).json({ invitation });
}));

administrationRouter.patch("/invitations/:id", asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Invitation id");
  const status = requireEnum(request.body.status, "Status", ["pending", "revoked"]);
  const invitation = await updateInvitation(request.auth.organizationId, id, status);
  if (!invitation) throw new HttpError(404, "INVITATION_NOT_FOUND", "Invitation not found.");
  await audit(request, `administration.invitation.${status}`, "invitation", id);
  response.json({ invitation });
}));

administrationRouter.put("/members/:id/branch-access", asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Member id");
  const branchIds = Array.isArray(request.body.branchIds) ? request.body.branchIds.map((value) => requireUuid(value, "Branch")) : [];
  const result = await replaceMemberBranchAccess(request.auth.organizationId, id, [...new Set(branchIds)], request.auth.userId);
  if (!result) throw new HttpError(404, "MEMBER_OR_BRANCH_NOT_FOUND", "Member or branch not found.");
  await audit(request, "administration.member.branch_access_updated", "user", id, { branchCount: result.length });
  response.json({ branchIds: result });
}));

administrationRouter.post("/schedules", asyncRoute(async (request, response) => {
  const input = { userId: requireUuid(request.body.userId, "Member"), branchId: requireUuid(request.body.branchId, "Branch"),
    startsAt: isoDate(request.body.startsAt, "Start"), endsAt: isoDate(request.body.endsAt, "End"),
    status: requireEnum(request.body.status ?? "scheduled", "Status", ["scheduled", "confirmed", "leave"]), note: optionalString(request.body.note, 500) };
  if (input.endsAt <= input.startsAt) throw new HttpError(422, "INVALID_SCHEDULE_RANGE", "End must be after start.", [{ field: "endsAt" }]);
  const schedule = await createSchedule(request.auth.organizationId, request.auth.userId, input);
  if (!schedule) throw new HttpError(404, "MEMBER_OR_BRANCH_NOT_FOUND", "Member or branch not found.");
  await audit(request, "administration.schedule.created", "schedule", schedule.id);
  response.status(201).json({ schedule });
}));

administrationRouter.patch("/schedules/:id", asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Schedule id");
  const status = requireEnum(request.body.status, "Status", ["scheduled", "confirmed", "leave", "cancelled"]);
  const schedule = await updateSchedule(request.auth.organizationId, id, status);
  if (!schedule) throw new HttpError(404, "SCHEDULE_NOT_FOUND", "Schedule not found.");
  await audit(request, "administration.schedule.updated", "schedule", id, { status }); response.json({ schedule });
}));

administrationRouter.post("/workloads", asyncRoute(async (request, response) => {
  const input = { userId: requireUuid(request.body.userId, "Member"), branchId: request.body.branchId ? requireUuid(request.body.branchId, "Branch") : null,
    title: requireString(request.body.title, "Work item", { min: 2, max: 180 }), priority: requireEnum(request.body.priority ?? "normal", "Priority", ["low", "normal", "high", "urgent"]),
    dueAt: request.body.dueAt ? isoDate(request.body.dueAt, "Due date") : null };
  const workload = await createWorkload(request.auth.organizationId, request.auth.userId, input);
  if (!workload) throw new HttpError(404, "MEMBER_OR_BRANCH_NOT_FOUND", "Member or branch not found.");
  await audit(request, "administration.workload.created", "workload", workload.id, { priority: input.priority });
  response.status(201).json({ workload });
}));

administrationRouter.patch("/workloads/:id", asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Workload id");
  const status = requireEnum(request.body.status, "Status", ["queued", "in_progress", "blocked", "completed"]);
  const workload = await updateWorkload(request.auth.organizationId, id, status);
  if (!workload) throw new HttpError(404, "WORKLOAD_NOT_FOUND", "Workload not found.");
  await audit(request, "administration.workload.updated", "workload", id, { status }); response.json({ workload });
}));

administrationRouter.patch("/settings", asyncRoute(async (request, response) => {
  const input = { name: optionalString(request.body.name, 120), timezone: optionalString(request.body.timezone, 60),
    locale: requireString(request.body.locale, "Locale", { min: 2, max: 20 }), currency: requireString(request.body.currency, "Currency", { min: 3, max: 3 }).toUpperCase(),
    weekStartsOn: requireNumber(request.body.weekStartsOn, "Week starts on", { min: 0, max: 6 }) };
  const settings = await updateAdminSettings(request.auth.organizationId, request.auth.userId, input);
  await audit(request, "administration.organization.settings_updated", "organization", request.auth.organizationId);
  response.json({ settings });
}));

administrationRouter.patch("/branches/:id/settings", asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Branch id");
  const input = { timezone: optionalString(request.body.timezone, 60), weeklyCapacityHours: requireNumber(request.body.weeklyCapacityHours, "Weekly capacity", { min: 0, max: 10000 }) };
  const settings = await updateBranchSettings(request.auth.organizationId, id, request.auth.userId, input);
  if (!settings) throw new HttpError(404, "BRANCH_NOT_FOUND", "Branch not found.");
  await audit(request, "administration.branch.settings_updated", "branch", id); response.json({ settings });
}));
