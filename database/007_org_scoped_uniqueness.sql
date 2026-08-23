-- Scope customer-mobile and service-job repair-order-number uniqueness to each organization
-- instead of enforcing it globally across every tenant on the instance. Today two different
-- dealership companies sharing this database cannot have a customer with the same mobile number,
-- and every company is forced onto one shared repair-order-number sequence instead of each
-- running its own (e.g. two dealerships both wanting to start at "RO-0001").

-- Customers: replace the global unique(mobile) with unique(organization_id, mobile).
-- customers_org_mobile (added in 002_dms_domains.sql) was a plain lookup index over the same
-- columns; the new unique index covers that lookup too, so the old one is dropped instead of
-- kept as a redundant duplicate.
drop index if exists customers_mobile_unique;
drop index if exists customers_org_mobile;
create unique index if not exists customers_org_mobile_unique
  on customers (organization_id, mobile)
  where mobile is not null;

-- Service jobs: replace the global unique(repair_order_number) with
-- unique(organization_id, repair_order_number). The constraint name Postgres assigned to the
-- inline "unique" column declaration is looked up rather than assumed, since it depends on how
-- the column was originally declared.
do $$
declare
  legacy_constraint text;
begin
  select conname into legacy_constraint
  from pg_constraint
  where conrelid = 'service_jobs'::regclass
    and contype = 'u'
    and conkey = (
      select array_agg(attnum order by attnum)
      from pg_attribute
      where attrelid = 'service_jobs'::regclass
        and attname = 'repair_order_number'
    );

  if legacy_constraint is not null then
    execute format('alter table service_jobs drop constraint %I', legacy_constraint);
  end if;
end $$;

create unique index if not exists service_jobs_org_repair_order_number_unique
  on service_jobs (organization_id, repair_order_number);
