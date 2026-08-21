create extension if not exists pgcrypto;

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  customer_type text not null check (customer_type in ('individual', 'company')),
  display_name text not null,
  mobile text,
  email text,
  created_at timestamptz not null default now()
);

create unique index if not exists customers_mobile_unique
  on customers (mobile)
  where mobile is not null;

create table if not exists vehicles (
  id uuid primary key default gen_random_uuid(),
  vin text not null unique,
  registration text,
  make text not null,
  model text not null,
  variant text,
  colour text,
  created_at timestamptz not null default now()
);

create table if not exists vehicle_ownerships (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  vehicle_id uuid not null references vehicles(id),
  started_on date not null,
  ended_on date,
  is_primary boolean not null default true
);

create table if not exists interactions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  vehicle_id uuid references vehicles(id),
  interaction_type text not null,
  occurred_at timestamptz not null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists interactions_customer_timeline
  on interactions (customer_id, occurred_at desc);
