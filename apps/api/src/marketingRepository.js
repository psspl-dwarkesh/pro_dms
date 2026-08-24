import { DatabaseUnavailableError, pool } from "./persistence.js";

function requirePool() {
  if (!pool) throw new DatabaseUnavailableError();
  return pool;
}

export async function getMarketingWorkspace(organizationId, branchId) {
  const result = await requirePool().query(
    `select c.id, c.name, c.channel, c.status, c.objective, c.budget::float,
            c.starts_at, c.ends_at, c.sent_count, c.response_count,
            a.id audience_id, a.name audience_name, a.member_count, b.name branch_name
       from marketing_campaigns c
       left join marketing_audiences a on a.id = c.audience_id and a.organization_id = c.organization_id
       left join branches b on b.id = c.branch_id and b.organization_id = c.organization_id
      where c.organization_id = $1 and ($2::uuid is null or c.branch_id = $2)
      order by c.updated_at desc limit 100`,
    [organizationId, branchId],
  );
  const audiences = await requirePool().query(
    `select id, name, description, channel, member_count, consent_required, created_at
       from marketing_audiences where organization_id = $1 order by created_at desc limit 100`,
    [organizationId],
  );
  return { campaigns: result.rows, audiences: audiences.rows };
}

export async function createMarketingCampaign(organizationId, branchId, input) {
  const result = await requirePool().query(
    `insert into marketing_campaigns
       (organization_id, branch_id, audience_id, name, channel, objective, budget, starts_at, ends_at, status)
     select $1, $2, a.id, $4, $5, $6, $7, $8, $9, $10
       from marketing_audiences a where a.id = $3 and a.organization_id = $1
     returning id, name, channel, status, objective, budget::float, starts_at, ends_at, sent_count, response_count`,
    [organizationId, branchId, input.audienceId, input.name, input.channel, input.objective, input.budget, input.startsAt, input.endsAt, input.status],
  );
  return result.rows[0] ?? null;
}

export async function updateMarketingCampaignStatus(organizationId, branchId, id, status) {
  const result = await requirePool().query(
    `update marketing_campaigns set status = $4, updated_at = now()
      where organization_id = $1 and ($2::uuid is null or branch_id = $2) and id = $3
      returning id, name, channel, status, objective, budget::float, starts_at, ends_at, sent_count, response_count`,
    [organizationId, branchId, id, status],
  );
  return result.rows[0] ?? null;
}
