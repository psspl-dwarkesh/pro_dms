-- Additional seeded demo accounts, one per remaining role, so the quick sign-in panel on the
-- login page has a one-click account for every role (admin was already seeded in
-- 005_auth_and_tenancy.sql). All share the same demo password as the existing admin account:
-- Demo@12345. Case-study credentials only, same convention as the existing seeded admin.

insert into users (id, organization_id, branch_id, name, email, password_hash, role) values
  ('80000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Demo Branch Manager', 'manager@prakashinfotech.com', '$2a$10$ltylkGHYDJRoovPl08/TqOUP.6jV8ZGUika5OxE6uBQplvTVtZy8O', 'branch_manager'),
  ('80000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Demo Sales Rep', 'sales@prakashinfotech.com', '$2a$10$ltylkGHYDJRoovPl08/TqOUP.6jV8ZGUika5OxE6uBQplvTVtZy8O', 'sales'),
  ('80000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Demo Service Advisor', 'service@prakashinfotech.com', '$2a$10$ltylkGHYDJRoovPl08/TqOUP.6jV8ZGUika5OxE6uBQplvTVtZy8O', 'service'),
  ('80000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Demo Staff Member', 'staff@prakashinfotech.com', '$2a$10$ltylkGHYDJRoovPl08/TqOUP.6jV8ZGUika5OxE6uBQplvTVtZy8O', 'staff')
on conflict (id) do nothing;
