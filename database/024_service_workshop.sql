begin;

alter table service_jobs
  add column if not exists invoice_status text not null default 'not-ready',
  add column if not exists invoice_number text,
  add column if not exists invoice_total numeric(14,2),
  add column if not exists invoiced_at timestamptz;

create table if not exists service_inspections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  branch_id uuid references branches(id),
  service_job_id uuid not null references service_jobs(id) on delete cascade,
  area text not null,
  result text not null check (result in ('pass', 'attention', 'urgent')),
  notes text,
  inspected_by text not null,
  inspected_at timestamptz not null default now()
);

create table if not exists service_estimates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  branch_id uuid references branches(id),
  service_job_id uuid not null references service_jobs(id) on delete cascade,
  description text not null,
  amount numeric(14,2) not null check (amount >= 0),
  status text not null default 'draft' check (status in ('draft', 'sent', 'approved', 'declined')),
  approval_token uuid not null default gen_random_uuid(),
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists service_job_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  branch_id uuid references branches(id),
  service_job_id uuid not null references service_jobs(id) on delete cascade,
  event_type text not null,
  summary text not null,
  actor_name text,
  occurred_at timestamptz not null default now()
);

create index if not exists service_inspections_job_idx on service_inspections (organization_id, service_job_id, inspected_at desc);
create index if not exists service_estimates_job_idx on service_estimates (organization_id, service_job_id, created_at desc);
create index if not exists service_events_job_idx on service_job_events (organization_id, service_job_id, occurred_at desc);

commit;

