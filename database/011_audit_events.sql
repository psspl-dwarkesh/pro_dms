-- Append-only security and business audit log. Every mutation across the API should eventually
-- write one row here (generic request-level logging is wired centrally in apps/api/src/audit.js;
-- individual routes may additionally log a richer action name/target). No update or delete path is
-- ever exposed to application code for this table -- treat rows as immutable once inserted.

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  branch_id uuid references branches(id),
  actor_user_id uuid references users(id),
  actor_role text,
  action text not null,
  method text not null,
  path text not null,
  status_code integer not null,
  target_type text,
  target_id text,
  request_id text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists audit_events_org_time_idx
  on audit_events (organization_id, occurred_at desc);

create index if not exists audit_events_org_actor_time_idx
  on audit_events (organization_id, actor_user_id, occurred_at desc);
