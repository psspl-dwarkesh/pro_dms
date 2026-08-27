-- Adds real file storage to the customer and vehicle document registers. 013 and 021 shipped
-- these tables as metadata-only ("no file bytes are ever stored in this table") because there was
-- no object-storage integration at the time. There still isn't one, so this uses the database
-- itself (Postgres bytea) rather than adding a new infra dependency -- fine at DMS document
-- volumes (ID scans, licences, contracts), and it keeps file access behind the same
-- organization/customer/vehicle scoping the rest of these tables already enforce.
--
-- storage_reference is untouched and still valid for records that just point at a physical file
-- (e.g. "filed at reception") rather than uploading one.

alter table customer_documents
  add column if not exists file_name text,
  add column if not exists file_mime_type text,
  add column if not exists file_size_bytes integer,
  add column if not exists file_data bytea;

alter table vehicle_documents
  add column if not exists file_name text,
  add column if not exists file_mime_type text,
  add column if not exists file_size_bytes integer,
  add column if not exists file_data bytea;
