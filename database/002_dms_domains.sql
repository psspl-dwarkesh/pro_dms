create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'Australia/Sydney',
  created_at timestamptz not null default now()
);

create table if not exists branches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  code text not null,
  name text not null,
  city text,
  unique (organization_id, code)
);

alter table customers add column if not exists organization_id uuid references organizations(id);
alter table customers add column if not exists preferred_channel text;
alter table customers add column if not exists address text;
alter table customers add column if not exists lifetime_value numeric(14,2) not null default 0;
alter table vehicles add column if not exists organization_id uuid references organizations(id);
alter table vehicles add column if not exists model_year integer;
alter table vehicles add column if not exists odometer_km integer;
alter table vehicles add column if not exists market_value numeric(14,2);
alter table vehicles add column if not exists status text not null default 'active';

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  branch_id uuid references branches(id),
  customer_id uuid references customers(id),
  source text not null,
  stage text not null,
  interested_vehicle text,
  assigned_to text,
  expected_value numeric(14,2),
  created_at timestamptz not null default now()
);

create table if not exists test_drives (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id),
  customer_id uuid not null references customers(id),
  vehicle_id uuid references vehicles(id),
  scheduled_at timestamptz not null,
  status text not null,
  feedback text
);

create table if not exists sales_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  branch_id uuid references branches(id),
  customer_id uuid not null references customers(id),
  vehicle_id uuid not null references vehicles(id),
  status text not null,
  total_amount numeric(14,2) not null,
  ordered_at timestamptz not null,
  delivered_at timestamptz
);

create table if not exists service_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  branch_id uuid references branches(id),
  customer_id uuid not null references customers(id),
  vehicle_id uuid not null references vehicles(id),
  repair_order_number text not null unique,
  status text not null,
  advisor text,
  technician text,
  complaint text,
  labour_total numeric(14,2) not null default 0,
  parts_total numeric(14,2) not null default 0,
  opened_at timestamptz not null,
  promised_at timestamptz,
  closed_at timestamptz
);

create table if not exists parts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  sku text not null,
  name text not null,
  quantity_on_hand integer not null default 0,
  reorder_point integer not null default 0,
  unit_cost numeric(12,2) not null default 0,
  retail_price numeric(12,2) not null default 0,
  unique (organization_id, sku)
);

create table if not exists finance_contracts (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid not null references sales_orders(id),
  provider text not null,
  product_type text not null,
  amount_financed numeric(14,2) not null,
  status text not null,
  commission numeric(12,2) not null default 0
);

create table if not exists insurance_policies (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  vehicle_id uuid not null references vehicles(id),
  provider text not null,
  policy_number text not null,
  status text not null,
  starts_on date not null,
  expires_on date not null,
  premium numeric(12,2)
);

create table if not exists communications (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  channel text not null,
  direction text not null,
  subject text,
  summary text not null,
  occurred_at timestamptz not null default now()
);

create index if not exists customers_org_mobile on customers (organization_id, mobile);
create index if not exists vehicles_org_vin on vehicles (organization_id, vin);
create index if not exists leads_org_stage on leads (organization_id, stage);
create index if not exists service_jobs_vehicle on service_jobs (vehicle_id, opened_at desc);
create index if not exists communications_customer on communications (customer_id, occurred_at desc);
