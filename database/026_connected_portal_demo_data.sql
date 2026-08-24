insert into vehicle_ownerships (id, customer_id, vehicle_id, started_on, is_primary) values
  ('94000000-0000-4000-8000-000000000001', '30000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', current_date - 180, true)
on conflict (id) do nothing;

insert into sales_orders (id, organization_id, branch_id, customer_id, vehicle_id, lead_id, status, total_amount, ordered_at) values
  ('94000000-0000-4000-8000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000003', '91000000-0000-0000-0000-000000000002', 'confirmed', 69400, now() - interval '5 days')
on conflict (id) do nothing;

insert into service_jobs (id, organization_id, branch_id, customer_id, vehicle_id, repair_order_number, status, advisor, technician, complaint, labour_total, parts_total, opened_at, promised_at) values
  ('94000000-0000-4000-8000-000000000003', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 'BLR-RO-1001', 'in-progress', 'Kavya Menon', 'Arjun Singh', 'Scheduled service and brake vibration inspection', 18500, 9200, now() - interval '1 day', now() + interval '1 day')
on conflict (id) do nothing;

insert into parts (id, organization_id, sku, name, quantity_on_hand, reorder_point, unit_cost, retail_price, description, supplier_name, bin_location) values
  ('94000000-0000-4000-8000-000000000004', '10000000-0000-0000-0000-000000000001', 'MHD-BRK-700-F', 'XUV700 front brake pad kit', 8, 4, 6900, 9200, 'Genuine demonstration service part', 'Mahindra Parts Network', 'BLR-B-14'),
  ('94000000-0000-4000-8000-000000000005', '10000000-0000-0000-0000-000000000001', 'TYT-HLX-OIL-01', 'Hilux service filter kit', 3, 5, 88, 135, 'Synthetic Australia service kit', 'Southern Parts Supply', 'SYD-C-08')
on conflict (id) do nothing;

insert into part_branch_stock (organization_id, branch_id, part_id, quantity_on_hand) values
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '94000000-0000-4000-8000-000000000004', 8),
  ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '94000000-0000-4000-8000-000000000005', 3)
on conflict (organization_id, branch_id, part_id) do update set quantity_on_hand = excluded.quantity_on_hand;

insert into finance_applications (id, organization_id, branch_id, sales_order_id, applicant_name, lender, requested_amount, status, assigned_to, submitted_at) values
  ('94000000-0000-4000-8000-000000000006', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '94000000-0000-4000-8000-000000000002', 'Oliver Bennett', 'Demo Mobility Finance', 52000, 'submitted', 'Mia Collins', now() - interval '3 days')
on conflict (id) do nothing;

insert into finance_contracts (id, sales_order_id, provider, product_type, amount_financed, status, commission) values
  ('94000000-0000-4000-8000-000000000007', '94000000-0000-4000-8000-000000000002', 'Demo Mobility Finance', 'Chattel mortgage', 52000, 'pending', 780)
on conflict (id) do nothing;

insert into insurance_policies (id, customer_id, vehicle_id, provider, policy_number, status, starts_on, expires_on, premium) values
  ('94000000-0000-4000-8000-000000000008', '30000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000003', 'Demo Southern Insurance', 'ILLUSTRATIVE-AU-1002', 'quoted', current_date + 3, current_date + 368, 1640)
on conflict (id) do nothing;

insert into communications (id, customer_id, channel, direction, subject, summary, occurred_at) values
  ('94000000-0000-4000-8000-000000000009', '30000000-0000-0000-0000-000000000002', 'WhatsApp', 'outbound', 'Workshop confirmation', 'Synthetic confirmation for the XUV700 service booking.', now() - interval '2 days'),
  ('94000000-0000-4000-8000-000000000010', '30000000-0000-0000-0000-000000000003', 'Email', 'outbound', 'Hilux proposal', 'Synthetic proposal and finance options sent for review.', now() - interval '4 days')
on conflict (id) do nothing;
