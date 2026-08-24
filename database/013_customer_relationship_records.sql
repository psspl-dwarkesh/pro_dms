-- Customer 360 relationship records: notes, tasks, consent history, and document metadata.
-- Additive only -- the existing customers/communications tables are unchanged. See
-- docs/six-portal-workspace-plan.md (Customer 360) for the owning portal and
-- docs/AutoAxis_Full_Product_Remediation_and_Development_Specification.docx section 15.3
-- ("customer relationship tables") for the target model this narrows to what ships now.

create table if not exists customer_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  customer_id uuid not null references customers(id),
  author_user_id uuid references users(id),
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists customer_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  customer_id uuid not null references customers(id),
  title text not null,
  assigned_to text,
  due_at timestamptz,
  status text not null default 'open' check (status in ('open', 'done', 'cancelled')),
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Append-only consent event log: each row is one recorded consent decision for one channel. The
-- current state for a channel is its most recent row (see getCustomerConsent in db.js). Keeping
-- full history rather than overwriting a single row is what makes consent changes auditable, per
-- the remediation spec's audit chapter (16.4 -- "consent changes" must be an audited event).
create table if not exists customer_consents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  customer_id uuid not null references customers(id),
  channel text not null check (channel in ('call', 'whatsapp', 'email', 'sms')),
  status text not null check (status in ('opted_in', 'opted_out')),
  source text,
  recorded_by uuid references users(id),
  recorded_at timestamptz not null default now()
);

-- Document metadata only. storage_reference names or links to where the actual file lives; no
-- file bytes are ever stored in this table, matching finance_application_documents' pattern
-- (database/012_finance_360.sql). There is no object-storage integration in this codebase yet, so
-- the API and UI treat this as a document register, not a file upload pipeline.
create table if not exists customer_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id),
  customer_id uuid not null references customers(id),
  document_type text not null,
  label text not null,
  status text not null default 'received' check (status in ('requested', 'received', 'verified', 'rejected')),
  storage_reference text,
  uploaded_by uuid references users(id),
  created_at timestamptz not null default now()
);

create index if not exists customer_notes_customer_time on customer_notes (organization_id, customer_id, created_at desc);
create index if not exists customer_tasks_customer_status on customer_tasks (organization_id, customer_id, status, due_at);
create index if not exists customer_consents_customer_channel_time on customer_consents (organization_id, customer_id, channel, recorded_at desc);
create index if not exists customer_documents_customer_time on customer_documents (organization_id, customer_id, created_at desc);
