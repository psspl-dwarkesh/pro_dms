begin;

alter table parts add column if not exists description text;
alter table parts add column if not exists supplier_name text;
alter table parts add column if not exists bin_location text;
alter table parts add column if not exists received_at timestamptz not null default now();
alter table parts add column if not exists updated_at timestamptz not null default now();

create table if not exists part_branch_stock (
  organization_id uuid not null references organizations(id),
  branch_id uuid not null references branches(id),
  part_id uuid not null references parts(id),
  quantity_on_hand integer not null default 0 check (quantity_on_hand >= 0),
  updated_at timestamptz not null default now(),
  primary key (organization_id, branch_id, part_id)
);

insert into part_branch_stock (organization_id, branch_id, part_id, quantity_on_hand)
select p.organization_id, b.id, p.id, p.quantity_on_hand
  from parts p
  join lateral (select id from branches where organization_id=p.organization_id order by id limit 1) b on true
on conflict (organization_id, branch_id, part_id) do nothing;

create table if not exists part_reservations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  branch_id uuid references branches(id),
  part_id uuid not null references parts(id),
  vehicle_id uuid references vehicles(id),
  service_job_id uuid references service_jobs(id),
  quantity integer not null check (quantity > 0),
  status text not null default 'reserved' check (status in ('reserved', 'allocated', 'released', 'cancelled')),
  notes text,
  reserved_by uuid references users(id),
  reserved_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists part_purchase_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  branch_id uuid references branches(id),
  order_number text not null,
  supplier_name text not null,
  status text not null default 'draft' check (status in ('draft', 'ordered', 'part-received', 'received', 'cancelled')),
  expected_at timestamptz,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, order_number)
);

create table if not exists part_purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references part_purchase_orders(id) on delete cascade,
  part_id uuid not null references parts(id),
  quantity_ordered integer not null check (quantity_ordered > 0),
  quantity_received integer not null default 0 check (quantity_received >= 0 and quantity_received <= quantity_ordered),
  unit_cost numeric(12,2) not null check (unit_cost >= 0),
  unique (purchase_order_id, part_id)
);

create table if not exists part_transfers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  part_id uuid not null references parts(id),
  from_branch_id uuid not null references branches(id),
  to_branch_id uuid not null references branches(id),
  quantity integer not null check (quantity > 0),
  status text not null default 'requested' check (status in ('requested', 'in-transit', 'received', 'cancelled')),
  requested_by uuid references users(id),
  requested_at timestamptz not null default now(),
  received_at timestamptz,
  check (from_branch_id <> to_branch_id)
);

create table if not exists part_stock_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  branch_id uuid references branches(id),
  part_id uuid not null references parts(id),
  quantity_delta integer not null check (quantity_delta <> 0),
  movement_type text not null check (movement_type in ('opening', 'adjustment', 'reservation-allocation', 'purchase-receipt', 'transfer-out', 'transfer-in')),
  reference_type text,
  reference_id uuid,
  notes text,
  actor_user_id uuid references users(id),
  occurred_at timestamptz not null default now()
);

create index if not exists part_reservations_org_part_status_idx on part_reservations (organization_id, part_id, status);
create index if not exists part_reservations_vehicle_idx on part_reservations (organization_id, vehicle_id) where vehicle_id is not null;
create index if not exists part_purchase_orders_org_status_idx on part_purchase_orders (organization_id, status, created_at desc);
create index if not exists part_transfers_org_status_idx on part_transfers (organization_id, status, requested_at desc);
create index if not exists part_stock_movements_age_idx on part_stock_movements (organization_id, part_id, occurred_at desc);
create index if not exists part_branch_stock_lookup_idx on part_branch_stock (organization_id, branch_id, part_id);

commit;
