alter table organizations add column if not exists slug text;

create unique index if not exists organizations_slug_unique
  on organizations (slug)
  where slug is not null;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  branch_id uuid references branches(id),
  name text not null,
  email text not null,
  password_hash text not null,
  role text not null check (role in ('admin', 'branch_manager', 'sales', 'service', 'staff')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists users_email_unique
  on users (lower(email));

create index if not exists users_org_idx on users (organization_id);
create index if not exists users_org_branch_idx on users (organization_id, branch_id);

update organizations set slug = 'prakash-motors-demo' where id = '10000000-0000-0000-0000-000000000001' and slug is null;

insert into users (id, organization_id, branch_id, name, email, password_hash, role) values
  ('80000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Demo Admin', 'admin@prakashinfotech.com', '$2a$10$f4I9yUjhBX3a27pr3mQFA.PtrP1GExdlHxCOstgwMNAdHeVOMtNyS', 'admin')
on conflict (id) do nothing;
