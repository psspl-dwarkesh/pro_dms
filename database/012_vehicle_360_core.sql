-- Vehicle 360 core: intake, ownership, documents, lifecycle, appraisal, valuation, stock and
-- location, plus the auction and rental/demo disposition workflows. See
-- docs/six-portal-workspace-plan.md (Vehicle 360) for the owning portal and
-- docs/AutoAxis_Full_Product_Remediation_and_Development_Specification.docx section 15
-- (vehicle relationship tables) and showcase-depth.md's integration priority #3 (valuation,
-- listings, appraisal, wholesale/auction) for the target model this narrows to what ships now.
-- Additive only -- the existing vehicles/vehicle_ownerships/interactions tables keep their rows.

-- Intake and stock/location. Nullable: existing vehicles simply show "not recorded" until edited.
alter table vehicles add column if not exists branch_id uuid references branches(id);
alter table vehicles add column if not exists lot_location text;
alter table vehicles add column if not exists acquisition_channel text
  check (acquisition_channel in ('trade-in', 'auction-purchase', 'direct-purchase', 'consignment'));
alter table vehicles add column if not exists acquisition_cost numeric(14,2);
alter table vehicles add column if not exists intake_at timestamptz;

create index if not exists vehicles_org_branch on vehicles (organization_id, branch_id);

-- The shared vehicle timeline (interactions) required a customer on every row, which blocked
-- logging vehicle-only lifecycle events -- a fresh intake, a valuation update, an auction listing,
-- a rental/demo checkout -- before any owner exists. Relaxing this is backwards compatible: every
-- existing row already has a customer_id.
alter table interactions alter column customer_id drop not null;

-- Ownership history gains a direct organization_id (matching the customer_notes/customer_documents
-- precedent of carrying tenancy directly rather than only through a join) plus the fields the
-- transfer workflow needs to explain why an ownership record ended.
alter table vehicle_ownerships add column if not exists organization_id uuid references organizations(id);
update vehicle_ownerships vo set organization_id = v.organization_id
  from vehicles v where v.id = vo.vehicle_id and vo.organization_id is null;
alter table vehicle_ownerships add column if not exists transfer_reason text;
alter table vehicle_ownerships add column if not exists recorded_by uuid references users(id);

create index if not exists vehicle_ownerships_org_vehicle on vehicle_ownerships (organization_id, vehicle_id, started_on desc);

-- Document metadata only. storage_reference names or links to where the actual file lives; no
-- file bytes are ever stored in this table -- same pattern as customer_documents and
-- finance_application_documents.
create table if not exists vehicle_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  vehicle_id uuid not null references vehicles(id),
  document_type text not null,
  label text not null,
  status text not null default 'received' check (status in ('requested', 'received', 'verified', 'rejected')),
  storage_reference text,
  uploaded_by uuid references users(id),
  created_at timestamptz not null default now()
);

-- Trade-in / acquisition appraisal. One vehicle may be appraised more than once over its life
-- (a repeat trade-in enquiry), so this is a history, not a single row on the vehicle.
create table if not exists vehicle_appraisals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  vehicle_id uuid not null references vehicles(id),
  customer_id uuid references customers(id),
  appraiser_id uuid references users(id),
  condition_grade text not null check (condition_grade in ('excellent', 'good', 'fair', 'poor')),
  odometer_km integer,
  exterior_notes text,
  mechanical_notes text,
  offered_value numeric(14,2),
  status text not null default 'draft' check (status in ('draft', 'offered', 'accepted', 'declined', 'expired')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

-- Valuation history. vehicles.market_value stays the cached "current" figure (unchanged
-- contract for existing readers); each new 'market' valuation refreshes it, while every source
-- (market/trade/wholesale/manual) is kept here so the Valuation tab can show a real history
-- instead of one overwritten number.
create table if not exists vehicle_valuations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  vehicle_id uuid not null references vehicles(id),
  source text not null check (source in ('market', 'trade', 'wholesale', 'manual')),
  value numeric(14,2) not null,
  notes text,
  valued_at timestamptz not null default now(),
  created_by uuid references users(id)
);

-- Auction disposition. One listing row per auction attempt; a vehicle can be re-listed after an
-- unsold or cancelled attempt, so this is a history rather than a single status flag.
create table if not exists vehicle_auction_listings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  vehicle_id uuid not null references vehicles(id),
  status text not null default 'draft' check (status in ('draft', 'listed', 'bidding', 'sold', 'unsold', 'cancelled')),
  auction_house text,
  reserve_price numeric(14,2),
  listed_at timestamptz,
  closes_at timestamptz,
  sold_price numeric(14,2),
  buyer_note text,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists vehicle_auction_bids (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references vehicle_auction_listings(id),
  bidder_name text not null,
  amount numeric(14,2) not null,
  placed_at timestamptz not null default now()
);

-- Rental/demo disposition and availability. A vehicle is "checked out" (active) and later
-- "checked in" (completed) or cancelled; the API blocks a second active disposition or an active
-- auction listing on the same vehicle at once, so this doubles as the vehicle's availability lock.
create table if not exists vehicle_dispositions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  vehicle_id uuid not null references vehicles(id),
  disposition_type text not null check (disposition_type in ('rental', 'demo')),
  customer_id uuid references customers(id),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  odometer_out integer,
  odometer_in integer,
  notes text,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);

create index if not exists vehicle_documents_org_vehicle_time on vehicle_documents (organization_id, vehicle_id, created_at desc);
create index if not exists vehicle_appraisals_org_vehicle_time on vehicle_appraisals (organization_id, vehicle_id, created_at desc);
create index if not exists vehicle_valuations_org_vehicle_time on vehicle_valuations (organization_id, vehicle_id, valued_at desc);
create index if not exists vehicle_auction_listings_org_vehicle_time on vehicle_auction_listings (organization_id, vehicle_id, created_at desc);
create index if not exists vehicle_auction_bids_listing_time on vehicle_auction_bids (listing_id, placed_at desc);
create index if not exists vehicle_dispositions_org_vehicle_time on vehicle_dispositions (organization_id, vehicle_id, starts_at desc);
-- One active disposition per vehicle at a time -- the same lock the API's own guard enforces,
-- kept as a real constraint so it holds even under concurrent requests.
create unique index if not exists vehicle_dispositions_one_active
  on vehicle_dispositions (vehicle_id) where status = 'active';

-- Demonstration data touch-up: give the one seeded demo vehicle a visible intake and stock
-- location instead of leaving every new column blank. Idempotent (only fills previously-null
-- columns) and keeps the same fixed demo id from 003_seed_demo.sql.
update vehicles
   set branch_id = '20000000-0000-0000-0000-000000000001',
       lot_location = 'Showroom floor, bay 3',
       acquisition_channel = 'direct-purchase',
       acquisition_cost = 96000,
       intake_at = '2024-12-10T00:00:00Z'
 where id = '40000000-0000-0000-0000-000000000001'
   and branch_id is null;
