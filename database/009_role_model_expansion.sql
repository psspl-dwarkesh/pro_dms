-- Expand the 5-role model to 7 roles that map to genuinely distinct access needs in a real
-- dealership org structure (General Manager, Sales Manager, BDC/Internet Sales, F&I Manager,
-- Service Advisor, Receptionist, Admin). Two roles are renamed for accuracy rather than replaced:
--   branch_manager -> general_manager (this role already receives org-wide navigation access via
--     ROLE_NAV; this migration also makes it genuinely org-wide for data scoping, matching the name)
--   sales          -> sales_manager   (no separate "sales rep" page exists yet, so this maps 1:1)
--   service        -> service_advisor (same access, clearer name)
--   staff          -> receptionist    (same access, clearer name)
-- bdc_rep and finance_manager are new roles with narrower access than sales_manager (see
-- ROLE_NAV in apps/web/src/app/data.ts and the authorize()/isOrgWideRole() checks in
-- apps/api/src/middleware.js).

-- Drop the old constraint before remapping rows - the old constraint would reject the new role
-- values, and the new constraint (added below) would reject the old ones.
alter table users drop constraint users_role_check;

update users set role = 'general_manager' where role = 'branch_manager';
update users set role = 'sales_manager' where role = 'sales';
update users set role = 'service_advisor' where role = 'service';
update users set role = 'receptionist' where role = 'staff';

alter table users add constraint users_role_check
  check (role in ('admin', 'general_manager', 'sales_manager', 'bdc_rep', 'finance_manager', 'service_advisor', 'receptionist'));

-- Seed one demo account for each of the two brand-new roles, following the same convention as
-- 008_additional_demo_users.sql (shared demo password: Demo@12345; case-study credentials only).
insert into users (id, organization_id, branch_id, name, email, password_hash, role) values
  ('80000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Demo BDC Rep', 'bdc@prakashinfotech.com', '$2a$10$ltylkGHYDJRoovPl08/TqOUP.6jV8ZGUika5OxE6uBQplvTVtZy8O', 'bdc_rep'),
  ('80000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Demo Finance Manager', 'finance@prakashinfotech.com', '$2a$10$ltylkGHYDJRoovPl08/TqOUP.6jV8ZGUika5OxE6uBQplvTVtZy8O', 'finance_manager')
on conflict (id) do nothing;
