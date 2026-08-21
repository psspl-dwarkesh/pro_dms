insert into organizations (id, name) values
  ('10000000-0000-0000-0000-000000000001', 'Pacific Motor Group')
on conflict (id) do nothing;

insert into branches (id, organization_id, code, name, city) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'SYD', 'Sydney Central', 'Sydney')
on conflict (id) do nothing;

insert into customers (id, organization_id, customer_type, display_name, mobile, email, preferred_channel, address, lifetime_value, created_at) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'individual', 'James Hartley', '+61412345678', 'james.hartley@example.com', 'WhatsApp', '14 Bayside Ave, Sydney NSW', 127450, '2021-01-04')
on conflict (id) do nothing;

insert into vehicles (id, organization_id, vin, registration, make, model, variant, colour, model_year, odometer_km, market_value, status) values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'WBAKS4C50J0Z12345', 'DMS-360', 'BMW', 'X5', 'xDrive40i', 'Alpine White', 2024, 12450, 109500, 'customer-owned')
on conflict (id) do nothing;

insert into vehicle_ownerships (id, customer_id, vehicle_id, started_on, is_primary) values
  ('50000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '2024-12-15', true)
on conflict (id) do nothing;

insert into interactions (id, customer_id, vehicle_id, interaction_type, occurred_at, summary) values
  ('60000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'delivery', '2024-12-15', 'Vehicle delivered — BMW X5 xDrive40i'),
  ('60000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'test-drive', '2024-11-03', 'BMW X5 and Mercedes GLE comparison'),
  ('60000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'service', '2024-09-18', '60,000 km scheduled service completed')
on conflict (id) do nothing;

insert into communications (id, customer_id, channel, direction, subject, summary, occurred_at) values
  ('70000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'WhatsApp', 'outbound', 'Delivery follow-up', 'Customer confirmed a smooth handover experience.', '2024-12-18')
on conflict (id) do nothing;
