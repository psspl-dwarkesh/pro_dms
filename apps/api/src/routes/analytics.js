import { Router } from "express";
import { recordAuditEvent } from "../audit.js";
import { DatabaseUnavailableError, pool } from "../persistence.js";
import { asyncRoute, HttpError } from "../errors.js";
import { branchScope } from "../middleware.js";
import { authorizePermission, CAPABILITIES } from "../permissions.js";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_RANGE_DAYS = 366;

function validDate(value) {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

export function parseAnalyticsQuery(query, auth, now = new Date()) {
  const defaultTo = now.toISOString().slice(0, 10);
  const defaultFromDate = new Date(`${defaultTo}T00:00:00.000Z`);
  defaultFromDate.setUTCDate(defaultFromDate.getUTCDate() - 29);
  const from = String(query.from ?? defaultFromDate.toISOString().slice(0, 10));
  const to = String(query.to ?? defaultTo);
  if (!validDate(from) || !validDate(to)) {
    throw new HttpError(400, "INVALID_ANALYTICS_DATE", "Use valid dates in YYYY-MM-DD format.");
  }
  const fromDate = new Date(`${from}T00:00:00.000Z`);
  const toDate = new Date(`${to}T00:00:00.000Z`);
  const days = Math.floor((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1;
  if (days < 1 || days > MAX_RANGE_DAYS) {
    throw new HttpError(400, "INVALID_ANALYTICS_RANGE", `Choose a date range between 1 and ${MAX_RANGE_DAYS} days.`);
  }

  const requestedBranchId = query.branchId ? String(query.branchId) : null;
  if (requestedBranchId && !UUID.test(requestedBranchId)) {
    throw new HttpError(400, "INVALID_BRANCH_FILTER", "Choose a valid branch.");
  }
  const restrictedBranchId = branchScope(auth);
  if (restrictedBranchId && requestedBranchId && requestedBranchId !== restrictedBranchId) {
    throw new HttpError(403, "BRANCH_SCOPE_DENIED", "You cannot view analytics for that branch.");
  }
  return { from, to, branchId: restrictedBranchId ?? requestedBranchId };
}

async function loadAnalytics(organizationId, filters) {
  if (!pool) throw new DatabaseUnavailableError();
  try {
    const result = await pool.query(
      `with parameters as (
         select $1::uuid organization_id, $2::uuid branch_id, $3::date from_date, $4::date to_date
       ), scoped_sales as (
         select so.* from sales_orders so, parameters p
          where so.organization_id = p.organization_id
            and (p.branch_id is null or so.branch_id = p.branch_id)
            and so.ordered_at >= p.from_date and so.ordered_at < p.to_date + interval '1 day'
       ), scoped_service as (
         select sj.* from service_jobs sj, parameters p
          where sj.organization_id = p.organization_id
            and (p.branch_id is null or sj.branch_id = p.branch_id)
            and sj.opened_at >= p.from_date and sj.opened_at < p.to_date + interval '1 day'
       ), scoped_leads as (
         select l.* from leads l, parameters p
          where l.organization_id = p.organization_id
            and (p.branch_id is null or l.branch_id = p.branch_id)
            and l.created_at < p.to_date + interval '1 day'
       ), scoped_finance as (
         select fc.* from finance_contracts fc join scoped_sales so on so.id = fc.sales_order_id
       ), branch_rollup as (
         select b.id, b.name,
                coalesce((select count(*) from scoped_sales so where so.branch_id = b.id), 0)::int units,
                coalesce((select sum(so.total_amount) from scoped_sales so where so.branch_id = b.id), 0)::float sales_revenue,
                coalesce((select sum(sj.labour_total + sj.parts_total) from scoped_service sj where sj.branch_id = b.id), 0)::float service_revenue,
                coalesce((select count(*) from scoped_leads l where l.branch_id = b.id and l.stage not in ('won', 'lost')), 0)::int open_leads
           from branches b
          where b.organization_id = $1 and ($2::uuid is null or b.id = $2)
       ), trend as (
         select date_trunc('week', event_at)::date period,
                sum(sales)::float sales_revenue, sum(service)::float service_revenue
           from (
             select ordered_at event_at, total_amount sales, 0::numeric service from scoped_sales
             union all
             select opened_at, 0::numeric, labour_total + parts_total from scoped_service
           ) events
          group by 1 order by 1
       ), workforce as (
         select person, role, count(*)::int jobs,
                count(*) filter (where status = 'closed')::int completed_jobs,
                coalesce(sum(labour_total + parts_total), 0)::float tracked_revenue
           from (
             select nullif(trim(advisor), '') person, 'Advisor' role, status, labour_total, parts_total from scoped_service
             union all
             select nullif(trim(technician), ''), 'Technician', status, labour_total, parts_total from scoped_service
           ) people
          where person is not null group by person, role order by tracked_revenue desc, person limit 25
       ), exceptions as (
         select id, 'service' kind, 'Promise risk' title,
                repair_order_number || ' is past its promised time' detail,
                'service' destination, promised_at occurred_at
           from service_jobs sj, parameters p
          where sj.organization_id = p.organization_id and (p.branch_id is null or sj.branch_id = p.branch_id)
            and sj.status <> 'closed' and sj.promised_at < now()
         union all
         select id, 'sales', 'Stale lead', coalesce(interested_vehicle, 'Lead') || ' has had no stage resolution',
                'sales', created_at
           from scoped_leads where stage not in ('won', 'lost') and created_at < now() - interval '7 days'
         union all
         select id, 'parts', 'Reorder required', name || ' (' || sku || ') is at or below reorder point',
                'parts', now()
           from parts pt, parameters p
          where pt.organization_id = p.organization_id and p.branch_id is null
            and pt.quantity_on_hand <= pt.reorder_point
       )
       select
         (select name from branches where organization_id = $1 and id = $2) selected_branch_name,
         (select count(*)::int from scoped_sales) units_sold,
         (select coalesce(sum(total_amount), 0)::float from scoped_sales) sales_revenue,
         (select count(*)::int from scoped_leads where stage not in ('won', 'lost')) open_leads,
         (select count(*)::int from scoped_service) service_jobs,
         (select coalesce(sum(labour_total + parts_total), 0)::float from scoped_service) service_revenue,
         (select coalesce(sum(commission), 0)::float from scoped_finance) finance_commission,
         coalesce((select json_agg(branch_rollup order by name) from branch_rollup), '[]') branches,
         coalesce((select json_agg(trend order by period) from trend), '[]') trend,
         coalesce((select json_agg(workforce) from workforce), '[]') workforce,
         coalesce((select json_agg(e order by e.occurred_at asc) from (select * from exceptions limit 25) e), '[]') exceptions`,
      [organizationId, filters.branchId, filters.from, filters.to],
    );
    return result.rows[0];
  } catch (cause) {
    if (cause instanceof DatabaseUnavailableError) throw cause;
    throw new DatabaseUnavailableError({ cause });
  }
}

export const analyticsRouter = Router();

analyticsRouter.get("/", authorizePermission(CAPABILITIES.ANALYTICS_READ), asyncRoute(async (request, response) => {
  const filters = parseAnalyticsQuery(request.query, request.auth);
  const row = await loadAnalytics(request.auth.organizationId, filters);
  if (filters.branchId && !row.selected_branch_name) {
    throw new HttpError(404, "ANALYTICS_SCOPE_NOT_FOUND", "The requested analytics scope was not found.");
  }
  const lastRefresh = new Date().toISOString();
  const scope = filters.branchId ? row.selected_branch_name : "All authorized branches";
  const trackedContribution = row.sales_revenue + row.service_revenue + row.finance_commission;
  await recordAuditEvent({
    organizationId: request.auth.organizationId,
    branchId: filters.branchId,
    actorUserId: request.auth.userId,
    actorRole: request.auth.role,
    action: "analytics.read",
    method: request.method,
    path: request.path,
    statusCode: 200,
    targetType: "analytics_scope",
    targetId: filters.branchId,
    requestId: request.requestId,
    metadata: { from: filters.from, to: filters.to },
  });
  response.setHeader("Cache-Control", "private, no-store").json({
    data: {
      filters,
      metadata: {
        title: "Illustrative analysis",
        disclosure: "Metrics use connected operational records but remain illustrative analysis, not audited financial statements.",
        currency: "AUD",
        scope,
        lastRefresh,
      },
      metrics: [
        { id: "salesRevenue", label: "Sales revenue", value: row.sales_revenue, format: "currency", definition: "Sum of sales-order total amounts ordered in the selected period.", dateRange: filters, scope, lastRefresh, illustrative: true },
        { id: "unitsSold", label: "Units sold", value: row.units_sold, format: "number", definition: "Count of sales orders placed in the selected period.", dateRange: filters, scope, lastRefresh, illustrative: true },
        { id: "serviceRevenue", label: "Service revenue", value: row.service_revenue, format: "currency", definition: "Labour plus parts totals on repair orders opened in the selected period.", dateRange: filters, scope, lastRefresh, illustrative: true },
        { id: "trackedContribution", label: "Tracked contribution proxy", value: trackedContribution, format: "currency", definition: "Sales-order revenue plus service revenue and finance commission. Excludes vehicle cost, payroll, overhead, tax, and untracked adjustments; it is not accounting profit.", dateRange: filters, scope, lastRefresh, illustrative: true },
      ],
      departments: [
        { name: "Sales", activity: row.units_sold, activityLabel: "orders", value: row.sales_revenue },
        { name: "Service", activity: row.service_jobs, activityLabel: "repair orders", value: row.service_revenue },
        { name: "Finance", activity: row.units_sold, activityLabel: "eligible sales orders", value: row.finance_commission },
      ],
      branches: row.branches,
      trend: row.trend,
      workforce: row.workforce,
      exceptions: row.exceptions,
    },
    meta: { requestId: request.requestId, dataSource: "connected", nextCursor: null },
  });
}));
