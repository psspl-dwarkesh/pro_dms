import { DatabaseUnavailableError, pool } from "./db.js";

async function query(text, values = undefined) {
  if (!pool) throw new DatabaseUnavailableError();
  try { return await pool.query(text, values); }
  catch (cause) { if (cause instanceof DatabaseUnavailableError) throw cause; throw new DatabaseUnavailableError({ cause }); }
}

export async function getAdministrationOverview(organizationId, { limit = 50, offset = 0 } = {}) {
  const [members, branches, invitations, schedules, workloads, settings, audit] = await Promise.all([
    query(`select u.id, u.name, u.email, u.role, u.is_active as "isActive", u.branch_id as "branchId",
                  b.name as "branchName", u.created_at as "createdAt",
                  coalesce(json_agg(json_build_object('id', ab.id, 'name', ab.name, 'code', ab.code))
                    filter (where ab.id is not null), '[]') as "branchAccess"
             from users u
             left join branches b on b.id = u.branch_id and b.organization_id = u.organization_id
             left join member_branch_access mba on mba.user_id = u.id and mba.organization_id = u.organization_id
             left join branches ab on ab.id = mba.branch_id and ab.organization_id = u.organization_id
            where u.organization_id = $1
            group by u.id, b.name order by u.name`, [organizationId]),
    query(`select b.id, b.code, b.name, b.city,
                  bas.timezone, coalesce(bas.weekly_capacity_hours, 0)::float as "weeklyCapacityHours"
             from branches b left join branch_admin_settings bas on bas.branch_id = b.id
            where b.organization_id = $1 order by b.name`, [organizationId]),
    query(`select id, branch_id as "branchId", email, display_name as "displayName", role, status,
                  expires_at as "expiresAt", created_at as "createdAt"
             from member_invitations where organization_id = $1 order by created_at desc limit 50`, [organizationId]),
    query(`select ws.id, ws.branch_id as "branchId", b.name as "branchName", ws.user_id as "userId",
                  u.name as "userName", ws.starts_at as "startsAt", ws.ends_at as "endsAt", ws.status, ws.note
             from work_schedules ws join users u on u.id = ws.user_id join branches b on b.id = ws.branch_id
            where ws.organization_id = $1 and ws.ends_at >= now() - interval '7 days'
            order by ws.starts_at asc limit 100`, [organizationId]),
    query(`select wa.id, wa.branch_id as "branchId", b.name as "branchName", wa.user_id as "userId",
                  u.name as "userName", wa.title, wa.status, wa.priority, wa.due_at as "dueAt"
             from workload_assignments wa join users u on u.id = wa.user_id left join branches b on b.id = wa.branch_id
            where wa.organization_id = $1 and wa.status <> 'completed'
            order by case wa.priority when 'urgent' then 1 when 'high' then 2 when 'normal' then 3 else 4 end,
                     wa.due_at nulls last limit 100`, [organizationId]),
    query(`select o.id, o.name, o.slug, o.timezone, coalesce(s.locale, 'en-AU') as locale,
                  coalesce(s.currency, 'AUD') as currency, coalesce(s.week_starts_on, 1) as "weekStartsOn"
             from organizations o left join organization_admin_settings s on s.organization_id = o.id
            where o.id = $1`, [organizationId]),
    query(`select ae.id, ae.actor_user_id as "actorUserId", u.name as "actorName", ae.actor_role as "actorRole",
                  ae.action, ae.method, ae.status_code as "statusCode", ae.target_type as "targetType",
                  ae.target_id as "targetId", ae.request_id as "requestId", ae.occurred_at as "occurredAt"
             from audit_events ae left join users u on u.id = ae.actor_user_id
            where ae.organization_id = $1 order by ae.occurred_at desc limit $2 offset $3`, [organizationId, limit, offset]),
  ]);
  return { members: members.rows, branches: branches.rows, invitations: invitations.rows, schedules: schedules.rows,
    workloads: workloads.rows, settings: settings.rows[0], auditEvents: audit.rows };
}

export async function createInvitation(organizationId, actorUserId, input) {
  const result = await query(`insert into member_invitations
      (organization_id, branch_id, email, display_name, role, invited_by, expires_at)
    select $1, b.id, $3, $4, $5, $6, now() + interval '7 days'
      from (select 1) seed left join branches b on b.id = $2 and b.organization_id = $1
     where $2::uuid is null or b.id is not null
    returning id, branch_id as "branchId", email, display_name as "displayName", role, status,
              expires_at as "expiresAt", created_at as "createdAt"`,
  [organizationId, input.branchId, input.email, input.displayName, input.role, actorUserId]);
  return result.rows[0];
}

export async function updateInvitation(organizationId, id, status) {
  const result = await query(`update member_invitations set status = $3, updated_at = now()
    where id = $1 and organization_id = $2 returning id, status`, [id, organizationId, status]);
  return result.rows[0];
}

export async function replaceMemberBranchAccess(organizationId, userId, branchIds, actorUserId) {
  if (!pool) throw new DatabaseUnavailableError();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const owned = await client.query("select id from users where id = $1 and organization_id = $2", [userId, organizationId]);
    if (!owned.rowCount) { await client.query("rollback"); return null; }
    const branches = await client.query("select id from branches where organization_id = $1 and id = any($2::uuid[])", [organizationId, branchIds]);
    if (branches.rowCount !== branchIds.length) { await client.query("rollback"); return null; }
    await client.query("delete from member_branch_access where organization_id = $1 and user_id = $2", [organizationId, userId]);
    for (const branchId of branchIds) await client.query(`insert into member_branch_access
      (organization_id, user_id, branch_id, granted_by) values ($1, $2, $3, $4)`, [organizationId, userId, branchId, actorUserId]);
    await client.query("commit");
    return branchIds;
  } catch (cause) { await client.query("rollback"); throw cause; } finally { client.release(); }
}

export async function createSchedule(organizationId, actorUserId, input) {
  const result = await query(`insert into work_schedules
      (organization_id, branch_id, user_id, starts_at, ends_at, status, note, created_by)
    select $1, b.id, u.id, $4, $5, $6, $7, $8 from users u join branches b on b.id = $2
     where u.id = $3 and u.organization_id = $1 and b.organization_id = $1
    returning id`, [organizationId, input.branchId, input.userId, input.startsAt, input.endsAt, input.status, input.note, actorUserId]);
  return result.rows[0];
}

export async function updateSchedule(organizationId, id, status) {
  const result = await query(`update work_schedules set status = $3, updated_at = now()
    where id = $1 and organization_id = $2 returning id`, [id, organizationId, status]);
  return result.rows[0];
}

export async function createWorkload(organizationId, actorUserId, input) {
  const result = await query(`insert into workload_assignments
      (organization_id, branch_id, user_id, title, status, priority, due_at, created_by)
    select $1, b.id, u.id, $4, 'queued', $5, $6, $7 from users u left join branches b on b.id = $2
     where u.id = $3 and u.organization_id = $1 and ($2::uuid is null or b.organization_id = $1)
    returning id`, [organizationId, input.branchId, input.userId, input.title, input.priority, input.dueAt, actorUserId]);
  return result.rows[0];
}

export async function updateWorkload(organizationId, id, status) {
  const result = await query(`update workload_assignments set status = $3, updated_at = now()
    where id = $1 and organization_id = $2 returning id`, [id, organizationId, status]);
  return result.rows[0];
}

export async function updateAdminSettings(organizationId, actorUserId, input) {
  await query(`update organizations set name = coalesce($2, name), timezone = coalesce($3, timezone) where id = $1`,
    [organizationId, input.name, input.timezone]);
  const result = await query(`insert into organization_admin_settings
      (organization_id, locale, currency, week_starts_on, updated_by, updated_at)
    values ($1, $2, $3, $4, $5, now()) on conflict (organization_id) do update set
      locale = excluded.locale, currency = excluded.currency, week_starts_on = excluded.week_starts_on,
      updated_by = excluded.updated_by, updated_at = now()
    returning locale, currency, week_starts_on as "weekStartsOn"`,
  [organizationId, input.locale, input.currency, input.weekStartsOn, actorUserId]);
  return result.rows[0];
}

export async function updateBranchSettings(organizationId, branchId, actorUserId, input) {
  const result = await query(`insert into branch_admin_settings
      (branch_id, organization_id, timezone, weekly_capacity_hours, updated_by, updated_at)
    select id, organization_id, $3, $4, $5, now() from branches where id = $1 and organization_id = $2
    on conflict (branch_id) do update set timezone = excluded.timezone,
      weekly_capacity_hours = excluded.weekly_capacity_hours, updated_by = excluded.updated_by, updated_at = now()
    returning branch_id as "branchId"`, [branchId, organizationId, input.timezone, input.weeklyCapacityHours, actorUserId]);
  return result.rows[0];
}
