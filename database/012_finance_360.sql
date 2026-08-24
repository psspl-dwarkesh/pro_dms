create table if not exists finance_applications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  branch_id uuid references branches(id),
  sales_order_id uuid references sales_orders(id),
  applicant_name text not null,
  lender text not null,
  requested_amount numeric(14,2) not null check (requested_amount >= 0),
  status text not null default 'draft' check (status in ('draft','documents_pending','submitted','approved','declined','contracted','paid_out')),
  assigned_to text,
  decision_note text,
  payout_reference text,
  submitted_at timestamptz,
  decided_at timestamptz,
  paid_out_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists finance_application_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  application_id uuid not null references finance_applications(id),
  document_type text not null,
  status text not null default 'requested' check (status in ('requested','received','verified','rejected')),
  storage_reference text,
  created_at timestamptz not null default now()
);

create unique index if not exists finance_applications_org_id on finance_applications (organization_id, id);
create unique index if not exists finance_application_documents_org_id on finance_application_documents (organization_id, id);
create unique index if not exists sales_orders_org_id on sales_orders (organization_id, id);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'finance_applications_org_sales_order_fk') then
    alter table finance_applications add constraint finance_applications_org_sales_order_fk
      foreign key (organization_id, sales_order_id) references sales_orders (organization_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'finance_documents_org_application_fk') then
    alter table finance_application_documents add constraint finance_documents_org_application_fk
      foreign key (organization_id, application_id) references finance_applications (organization_id, id);
  end if;
end $$;

create table if not exists finance_payables (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  branch_id uuid references branches(id),
  supplier_name text not null,
  invoice_number text not null,
  description text,
  amount numeric(14,2) not null check (amount >= 0),
  currency char(3) not null default 'AUD',
  due_on date not null,
  status text not null default 'received' check (status in ('received','pending_approval','approved','scheduled','paid','disputed','void')),
  assigned_to text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, supplier_name, invoice_number)
);

create index if not exists finance_applications_org_status on finance_applications (organization_id, status, updated_at desc);
create index if not exists finance_application_documents_org_application on finance_application_documents (organization_id, application_id, created_at desc);
create index if not exists finance_payables_org_due on finance_payables (organization_id, status, due_on);
create index if not exists insurance_policies_renewal_queue on insurance_policies (expires_on, status);
