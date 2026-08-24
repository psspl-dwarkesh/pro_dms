import { pool } from "./persistence.js";
import { HttpError } from "./errors.js";

function database() {
  if (!pool) throw new HttpError(503, "DATABASE_UNAVAILABLE", "The database is unavailable. Try again later.");
  return pool;
}

export async function financeWorkspace(organizationId, branchId, limit) {
  const db = database();
  const branch = branchId ? "and branch_id = $2" : "";
  const values = branchId ? [organizationId, branchId, limit] : [organizationId, limit];
  const limitIndex = branchId ? 3 : 2;
  const [applications, documents, contracts, policies, payables] = await Promise.all([
    db.query(`select id, sales_order_id as "salesOrderId", applicant_name as "applicantName", lender,
      requested_amount::float as "requestedAmount", status, assigned_to as "assignedTo", decision_note as "decisionNote",
      payout_reference as "payoutReference", submitted_at as "submittedAt", decided_at as "decidedAt", paid_out_at as "paidOutAt",
      created_at as "createdAt", updated_at as "updatedAt",
      (select count(*)::int from finance_application_documents d where d.application_id = finance_applications.id) as "documentCount",
      (select count(*)::int from finance_application_documents d where d.application_id = finance_applications.id and d.status in ('received','verified')) as "receivedDocumentCount"
      from finance_applications where organization_id = $1 ${branch} order by updated_at desc limit $${limitIndex}`, values),
    db.query(`select d.id, d.application_id as "applicationId", d.document_type as "documentType", d.status, d.created_at as "createdAt"
      from finance_application_documents d join finance_applications a on a.id = d.application_id and a.organization_id = d.organization_id
      where d.organization_id = $1 ${branchId ? "and a.branch_id = $2" : ""} order by d.created_at desc limit $${limitIndex}`, values),
    db.query(`select fc.id, fc.sales_order_id as "salesOrderId", fc.provider, fc.product_type as "productType",
      fc.amount_financed::float as "amountFinanced", fc.status, fc.commission::float, c.display_name as "customerName",
      v.make, v.model, v.registration
      from finance_contracts fc join sales_orders so on so.id = fc.sales_order_id
      join customers c on c.id = so.customer_id join vehicles v on v.id = so.vehicle_id
      where so.organization_id = $1 ${branchId ? "and so.branch_id = $2" : ""} order by so.ordered_at desc limit $${limitIndex}`, values),
    db.query(`select ip.id, ip.customer_id as "customerId", ip.vehicle_id as "vehicleId", ip.provider,
      ip.policy_number as "policyNumber", ip.status, ip.starts_on as "startsOn", ip.expires_on as "expiresOn", ip.premium::float,
      c.display_name as "customerName", v.make, v.model, v.registration
      from insurance_policies ip join customers c on c.id = ip.customer_id join vehicles v on v.id = ip.vehicle_id
      where c.organization_id = $1 order by ip.expires_on asc limit $2`, [organizationId, limit]),
    db.query(`select id, supplier_name as "supplierName", invoice_number as "invoiceNumber", description,
      amount::float, currency, due_on as "dueOn", status, assigned_to as "assignedTo", paid_at as "paidAt", created_at as "createdAt"
      from finance_payables where organization_id = $1 ${branch} order by due_on asc limit $${limitIndex}`, values),
  ]);
  const documentsByApplication = new Map();
  for (const document of documents.rows) {
    const items = documentsByApplication.get(document.applicationId) ?? [];
    items.push(document);
    documentsByApplication.set(document.applicationId, items);
  }
  return {
    applications: applications.rows.map((application) => ({ ...application, documents: documentsByApplication.get(application.id) ?? [] })),
    contracts: contracts.rows,
    policies: policies.rows,
    payables: payables.rows,
  };
}

export async function createApplication(auth, input) {
  const db = database();
  if (input.salesOrderId) {
    const owned = await db.query(`select id from sales_orders where id=$1 and organization_id=$2 and ($3::uuid is null or branch_id=$3)`,
      [input.salesOrderId, auth.organizationId, auth.role === "admin" || auth.role === "general_manager" ? null : auth.branchId]);
    if (!owned.rowCount) throw new HttpError(404, "SALES_ORDER_NOT_FOUND", "Sales order not found.");
  }
  const result = await db.query(`insert into finance_applications
    (organization_id, branch_id, sales_order_id, applicant_name, lender, requested_amount, status, assigned_to)
    values ($1,$2,$3,$4,$5,$6,'documents_pending',$7)
    returning id, applicant_name as "applicantName", lender, requested_amount::float as "requestedAmount", status, assigned_to as "assignedTo", created_at as "createdAt"`,
  [auth.organizationId, auth.branchId, input.salesOrderId, input.applicantName, input.lender, input.requestedAmount, input.assignedTo]);
  return result.rows[0];
}

export async function createApplicationDocument(auth, applicationId, documentType) {
  const result = await database().query(`insert into finance_application_documents (organization_id, application_id, document_type)
    select $2, a.id, $3 from finance_applications a
    where a.id=$1 and a.organization_id=$2 and ($4::uuid is null or a.branch_id=$4)
    returning id, application_id as "applicationId", document_type as "documentType", status, created_at as "createdAt"`,
  [applicationId, auth.organizationId, documentType, auth.role === "admin" || auth.role === "general_manager" ? null : auth.branchId]);
  return result.rows[0] ?? null;
}

export async function transitionApplicationDocument(auth, id, status) {
  const result = await database().query(`update finance_application_documents d set status=$3
    from finance_applications a where d.id=$1 and d.organization_id=$2 and a.id=d.application_id
      and a.organization_id=d.organization_id and ($4::uuid is null or a.branch_id=$4)
    returning d.id, d.application_id as "applicationId", d.document_type as "documentType", d.status`,
  [id, auth.organizationId, status, auth.role === "admin" || auth.role === "general_manager" ? null : auth.branchId]);
  return result.rows[0] ?? null;
}

export async function createPayable(auth, input) {
  const result = await database().query(`insert into finance_payables
    (organization_id, branch_id, supplier_name, invoice_number, description, amount, currency, due_on, status, assigned_to)
    values ($1,$2,$3,$4,$5,$6,$7,$8,'pending_approval',$9)
    returning id, supplier_name as "supplierName", invoice_number as "invoiceNumber", description, amount::float, currency, due_on as "dueOn", status, assigned_to as "assignedTo", created_at as "createdAt"`,
  [auth.organizationId, auth.branchId, input.supplierName, input.invoiceNumber, input.description, input.amount, input.currency, input.dueOn, input.assignedTo]);
  return result.rows[0];
}

export async function transitionApplication(auth, id, input) {
  const timestamps = input.status === "submitted" ? "submitted_at = now()," : input.status === "approved" || input.status === "declined" ? "decided_at = now()," : input.status === "paid_out" ? "paid_out_at = now()," : "";
  const result = await database().query(`update finance_applications set status=$3, decision_note=coalesce($4,decision_note), payout_reference=coalesce($5,payout_reference), ${timestamps} updated_at=now()
    where id=$1 and organization_id=$2 and ($6::uuid is null or branch_id=$6) returning id, status, decision_note as "decisionNote", payout_reference as "payoutReference", updated_at as "updatedAt"`,
  [id, auth.organizationId, input.status, input.decisionNote, input.payoutReference, auth.role === "admin" || auth.role === "general_manager" ? null : auth.branchId]);
  return result.rows[0] ?? null;
}

export async function transitionPayable(auth, id, status) {
  const result = await database().query(`update finance_payables set status=$3, paid_at=case when $3='paid' then now() else paid_at end, updated_at=now()
    where id=$1 and organization_id=$2 and ($4::uuid is null or branch_id=$4) returning id, status, paid_at as "paidAt"`,
  [id, auth.organizationId, status, auth.role === "admin" || auth.role === "general_manager" ? null : auth.branchId]);
  return result.rows[0] ?? null;
}
