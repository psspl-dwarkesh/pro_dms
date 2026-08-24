-- Sales 360 extends the existing lead and sales-order spine with persisted workflow records.
alter table leads add column if not exists specific_vehicle_id uuid references vehicles(id);
alter table leads add column if not exists preferred_contact text;
alter table leads add column if not exists consent_basis text;
alter table leads add column if not exists priority text not null default 'normal';
alter table leads add column if not exists next_action text;
alter table leads add column if not exists next_action_due_at timestamptz;
alter table leads add column if not exists updated_at timestamptz not null default now();

alter table test_drives add column if not exists organization_id uuid references organizations(id);
alter table test_drives add column if not exists branch_id uuid references branches(id);
alter table test_drives add column if not exists created_at timestamptz not null default now();

create table if not exists sales_quotations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  branch_id uuid references branches(id),
  lead_id uuid not null references leads(id),
  vehicle_id uuid references vehicles(id),
  amount numeric(14,2) not null check (amount >= 0),
  status text not null check (status in ('draft', 'sent', 'accepted', 'declined', 'expired')),
  valid_until date,
  created_at timestamptz not null default now()
);

create table if not exists sales_follow_ups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  branch_id uuid references branches(id),
  lead_id uuid not null references leads(id),
  owner_user_id uuid references users(id),
  channel text not null check (channel in ('call', 'email', 'sms', 'whatsapp', 'in-person')),
  summary text not null,
  due_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists test_drives_org_lead_idx on test_drives (organization_id, lead_id, scheduled_at desc);
create index if not exists sales_quotations_org_lead_idx on sales_quotations (organization_id, lead_id, created_at desc);
create index if not exists sales_follow_ups_org_lead_idx on sales_follow_ups (organization_id, lead_id, due_at);
create index if not exists leads_org_due_idx on leads (organization_id, next_action_due_at) where stage not in ('won', 'lost');
