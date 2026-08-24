-- Administration workspace records. The deliberately high sequence leaves room for the portal
-- branches being developed in parallel; migrations are still applied in filename order.

create table if not exists member_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  branch_id uuid references branches(id),
  email text not null,
  display_name text not null,
  role text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by uuid not null references users(id),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists member_invitations_pending_email_idx
  on member_invitations (organization_id, lower(email)) where status = 'pending';
create index if not exists member_invitations_org_created_idx
  on member_invitations (organization_id, created_at desc);

create table if not exists member_branch_access (
  organization_id uuid not null references organizations(id),
  user_id uuid not null references users(id) on delete cascade,
  branch_id uuid not null references branches(id) on delete cascade,
  granted_by uuid references users(id),
  granted_at timestamptz not null default now(),
  primary key (user_id, branch_id)
);
create index if not exists member_branch_access_org_user_idx
  on member_branch_access (organization_id, user_id);

create table if not exists work_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  branch_id uuid not null references branches(id),
  user_id uuid not null references users(id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'confirmed', 'leave', 'cancelled')),
  note text,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists work_schedules_org_start_idx
  on work_schedules (organization_id, starts_at);

create table if not exists workload_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  branch_id uuid references branches(id),
  user_id uuid not null references users(id),
  title text not null,
  status text not null default 'queued' check (status in ('queued', 'in_progress', 'blocked', 'completed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  due_at timestamptz,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists workload_assignments_org_user_status_idx
  on workload_assignments (organization_id, user_id, status);

create table if not exists organization_admin_settings (
  organization_id uuid primary key references organizations(id),
  locale text not null default 'en-AU',
  currency text not null default 'AUD',
  week_starts_on smallint not null default 1 check (week_starts_on between 0 and 6),
  updated_by uuid references users(id),
  updated_at timestamptz not null default now()
);

create table if not exists branch_admin_settings (
  branch_id uuid primary key references branches(id) on delete cascade,
  organization_id uuid not null references organizations(id),
  timezone text,
  weekly_capacity_hours numeric(8,2) not null default 0 check (weekly_capacity_hours >= 0),
  updated_by uuid references users(id),
  updated_at timestamptz not null default now()
);
