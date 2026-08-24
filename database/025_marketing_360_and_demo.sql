create table if not exists marketing_audiences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  name text not null,
  description text,
  channel text not null check (channel in ('email','sms','whatsapp','mixed')),
  member_count integer not null default 0 check (member_count >= 0),
  consent_required boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  branch_id uuid references branches(id),
  audience_id uuid references marketing_audiences(id),
  name text not null,
  channel text not null check (channel in ('email','sms','whatsapp','mixed')),
  status text not null default 'draft' check (status in ('draft','scheduled','active','paused','completed','cancelled')),
  objective text not null,
  budget numeric(14,2) not null default 0 check (budget >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  sent_count integer not null default 0 check (sent_count >= 0),
  response_count integer not null default 0 check (response_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create index if not exists marketing_campaigns_org_status on marketing_campaigns (organization_id, status, updated_at desc);
create index if not exists marketing_campaigns_org_branch on marketing_campaigns (organization_id, branch_id, updated_at desc);
create index if not exists marketing_audiences_org_created on marketing_audiences (organization_id, created_at desc);

update organizations
   set name = 'Indo-Pacific Motors', slug = 'indo-pacific-motors'
 where id = '10000000-0000-0000-0000-000000000001';

insert into branches (id, organization_id, code, name, city) values
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'BLR', 'Bengaluru Central', 'Bengaluru')
on conflict (id) do nothing;

insert into customers (id, organization_id, customer_type, display_name, mobile, email, preferred_channel, address, lifetime_value, created_at) values
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'individual', 'Ananya Rao', '+919810000101', 'ananya.rao@example.com', 'WhatsApp', 'Indiranagar, Bengaluru', 4850000, now() - interval '420 days'),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'individual', 'Oliver Bennett', '+61410000102', 'oliver.bennett@example.com', 'Email', 'Parramatta, Sydney NSW', 92400, now() - interval '310 days')
on conflict (id) do nothing;

insert into vehicles (id, organization_id, vin, registration, make, model, variant, colour, model_year, odometer_km, market_value, status, branch_id, lot_location, acquisition_channel, acquisition_cost, intake_at) values
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'MA1NE2ZK9R6000101', 'KA01IP3601', 'Mahindra', 'XUV700', 'AX7 Luxury', 'Midnight Black', 2025, 8700, 2890000, 'customer-owned', '20000000-0000-0000-0000-000000000002', 'Delivered', 'trade-in', 2600000, now() - interval '180 days'),
  ('40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'MR0KA3CD600001102', 'NSW-IPM-02', 'Toyota', 'Hilux', 'Rogue', 'Glacier White', 2024, 22150, 69400, 'in-stock', '20000000-0000-0000-0000-000000000001', 'Sydney A-12', 'direct-purchase', 62100, now() - interval '45 days')
on conflict (id) do nothing;

insert into leads (id, organization_id, branch_id, customer_id, source, stage, interested_vehicle, assigned_to, expected_value, specific_vehicle_id, preferred_contact, consent_basis, priority, next_action, next_action_due_at) values
  ('91000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 'Website', 'qualified', 'Mahindra XUV700', 'Priya Sharma', 2890000, '40000000-0000-0000-0000-000000000002', 'whatsapp', 'explicit', 'high', 'Confirm exchange appraisal', now() + interval '1 day'),
  ('91000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 'Campaign', 'proposal', 'Toyota Hilux Rogue', 'Ethan Walker', 69400, '40000000-0000-0000-0000-000000000003', 'email', 'explicit', 'normal', 'Review finance options', now() + interval '2 days')
on conflict (id) do nothing;

insert into marketing_audiences (id, organization_id, name, description, channel, member_count, consent_required) values
  ('92000000-0000-4000-8000-000000000001', '10000000-0000-0000-0000-000000000001', 'India SUV upgrade', 'Synthetic customers with recorded consent and an SUV ownership signal.', 'whatsapp', 184, true),
  ('92000000-0000-4000-8000-000000000002', '10000000-0000-0000-0000-000000000001', 'Australia utility buyers', 'Synthetic customers interested in utility and lifestyle vehicles.', 'email', 126, true)
on conflict (id) do nothing;

insert into marketing_campaigns (id, organization_id, branch_id, audience_id, name, channel, status, objective, budget, starts_at, ends_at, sent_count, response_count) values
  ('93000000-0000-4000-8000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '92000000-0000-4000-8000-000000000001', 'XUV700 service and upgrade', 'whatsapp', 'active', 'Generate consented upgrade appointments', 175000, now() - interval '7 days', now() + interval '14 days', 142, 19),
  ('93000000-0000-4000-8000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '92000000-0000-4000-8000-000000000002', 'Hilux weekend drive', 'email', 'scheduled', 'Book qualified test drives', 4800, now() + interval '3 days', now() + interval '17 days', 0, 0)
on conflict (id) do nothing;
