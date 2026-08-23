-- Links a sales order back to the lead it was converted from, so Sales 360 can show a lead's
-- full journey (enquiry -> won -> delivered) instead of the two records being disconnected once
-- a lead is marked won. Nullable: sales orders created directly (not via lead conversion) or
-- seeded historically have no originating lead.
alter table sales_orders add column if not exists lead_id uuid references leads(id);
create index if not exists sales_orders_lead_idx on sales_orders (lead_id);
