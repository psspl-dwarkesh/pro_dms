-- Used vehicle operations extend the shared Vehicle 360 VIN record. There is one current
-- operations row per vehicle and an auditable set of recon tasks; acquisition and auction data
-- remain owned by the Vehicle 360 core tables introduced in 021.
create table if not exists used_vehicle_operations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  vehicle_id uuid not null references vehicles(id),
  inspection_status text not null default 'not-started' check (inspection_status in ('not-started','in-progress','passed','failed')),
  inspection_grade text check (inspection_grade in ('excellent','good','fair','poor')),
  inspection_notes text,
  inspected_at timestamptz,
  recon_status text not null default 'not-started' check (recon_status in ('not-started','in-progress','ready','blocked')),
  asking_price numeric(14,2),
  price_updated_at timestamptz,
  disposal_channel text check (disposal_channel in ('retail','auction','wholesale')),
  wholesale_buyer text,
  wholesale_price numeric(14,2),
  disposed_at timestamptz,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, vehicle_id)
);

create table if not exists vehicle_recon_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  vehicle_id uuid not null references vehicles(id),
  category text not null check (category in ('mechanical','body','interior','tyres','detail','other')),
  description text not null,
  supplier text,
  estimated_cost numeric(14,2) not null default 0,
  actual_cost numeric(14,2),
  status text not null default 'planned' check (status in ('planned','approved','in-progress','completed','cancelled')),
  due_at timestamptz,
  completed_at timestamptz,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists used_vehicle_operations_org_status on used_vehicle_operations (organization_id, recon_status, updated_at desc);
create index if not exists vehicle_recon_tasks_org_vehicle on vehicle_recon_tasks (organization_id, vehicle_id, created_at desc);
