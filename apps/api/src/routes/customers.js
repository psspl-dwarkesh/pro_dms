import { Router } from "express";
import {
  createCustomer, createCustomerDocument, createCustomerNote, createCustomerTask, deleteCustomer,
  deleteCustomerNote, findPotentialDuplicateCustomers, getCustomer360, getCustomerConsent,
  getCustomerDocumentFile, listCustomerConsentHistory, listCustomerDocuments, listCustomerNotes,
  listCustomers, listCustomerTasks, recordCustomerConsent, updateCustomer, updateCustomerDocumentStatus,
  updateCustomerTaskStatus,
} from "../persistence.js";
import { asyncRoute, HttpError } from "../errors.js";
import { authorizePermission, CAPABILITIES } from "../permissions.js";
import {
  optionalFileUpload, optionalIsoDateTime, optionalNumber, optionalString, requireEnum, requireString,
  requireUuid, paginationParams,
} from "../validate.js";

export const customersRouter = Router();

const CONSENT_CHANNELS = ["call", "whatsapp", "email", "sms"];
const CONSENT_STATUSES = ["opted_in", "opted_out"];
const TASK_STATUSES = ["open", "done", "cancelled"];
const DOCUMENT_STATUSES = ["requested", "received", "verified", "rejected"];

customersRouter.get("/", authorizePermission(CAPABILITIES.CUSTOMERS_READ), asyncRoute(async (request, response) => {
  const search = optionalString(request.query.q, 120);
  const { limit, offset } = paginationParams(request.query);
  const customers = await listCustomers(request.auth.organizationId, { search, limit, offset });
  response.json({ customers });
}));

// Surfaces likely-duplicate customers so the create/edit form can warn before it commits, per
// docs/AutoAxis_Full_Product_Remediation_and_Development_Specification.docx section 7.4. A read,
// not a mutation - anyone who can see customers can check for duplicates.
customersRouter.get("/duplicates", authorizePermission(CAPABILITIES.CUSTOMERS_READ), asyncRoute(async (request, response) => {
  const mobile = optionalString(request.query.mobile, 32);
  const email = optionalString(request.query.email, 160);
  const displayName = optionalString(request.query.displayName, 160);
  const excludeId = request.query.excludeId ? requireUuid(request.query.excludeId, "Customer id") : null;
  const customers = await findPotentialDuplicateCustomers(request.auth.organizationId, { mobile, email, displayName, excludeId });
  response.json({ customers });
}));

customersRouter.post("/", authorizePermission(CAPABILITIES.CUSTOMERS_MANAGE), asyncRoute(async (request, response) => {
  const customerType = requireEnum(request.body.customerType, "Customer type", ["individual", "company"]);
  const displayName = requireString(request.body.displayName, "Name", { min: 2, max: 160 });
  const mobile = optionalString(request.body.mobile, 32);
  const email = optionalString(request.body.email, 160);
  const preferredChannel = optionalString(request.body.preferredChannel, 40);
  const address = optionalString(request.body.address, 240);
  const customer = await createCustomer(request.auth.organizationId, { customerType, displayName, mobile, email, preferredChannel, address });
  response.status(201).json({ customer });
}));

customersRouter.get("/:id/360", authorizePermission(CAPABILITIES.CUSTOMERS_READ), asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Customer id");
  const customer = await getCustomer360(request.auth.organizationId, id);
  if (!customer) throw new HttpError(404, "CUSTOMER_NOT_FOUND", "Customer not found.");
  response.json({ customer });
}));

customersRouter.patch("/:id", authorizePermission(CAPABILITIES.CUSTOMERS_MANAGE), asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Customer id");
  const displayName = optionalString(request.body.displayName, 160);
  const mobile = optionalString(request.body.mobile, 32);
  const email = optionalString(request.body.email, 160);
  const preferredChannel = optionalString(request.body.preferredChannel, 40);
  const address = optionalString(request.body.address, 240);
  const lifetimeValue = optionalNumber(request.body.lifetimeValue);
  const customer = await updateCustomer(request.auth.organizationId, id, { displayName, mobile, email, preferredChannel, address, lifetimeValue });
  if (!customer) throw new HttpError(404, "CUSTOMER_NOT_FOUND", "Customer not found.");
  response.json({ customer });
}));

customersRouter.delete("/:id", authorizePermission(CAPABILITIES.CUSTOMERS_MANAGE), asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Customer id");
  const deleted = await deleteCustomer(request.auth.organizationId, id);
  if (!deleted) throw new HttpError(404, "CUSTOMER_NOT_FOUND", "Customer not found.");
  response.status(204).end();
}));

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

customersRouter.get("/:id/notes", authorizePermission(CAPABILITIES.CUSTOMERS_READ), asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Customer id");
  const { limit, offset } = paginationParams(request.query);
  const notes = await listCustomerNotes(request.auth.organizationId, id, { limit, offset });
  response.json({ notes });
}));

customersRouter.post("/:id/notes", authorizePermission(CAPABILITIES.CUSTOMERS_MANAGE), asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Customer id");
  const body = requireString(request.body.body, "Note", { min: 1, max: 2000 });
  const note = await createCustomerNote(request.auth.organizationId, id, { body, authorUserId: request.auth.userId });
  response.status(201).json({ note });
}));

customersRouter.delete("/:id/notes/:noteId", authorizePermission(CAPABILITIES.CUSTOMERS_MANAGE), asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Customer id");
  const noteId = requireUuid(request.params.noteId, "Note id");
  const deleted = await deleteCustomerNote(request.auth.organizationId, id, noteId);
  if (!deleted) throw new HttpError(404, "NOTE_NOT_FOUND", "Note not found.");
  response.status(204).end();
}));

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

customersRouter.get("/:id/tasks", authorizePermission(CAPABILITIES.CUSTOMERS_READ), asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Customer id");
  const { limit, offset } = paginationParams(request.query);
  const tasks = await listCustomerTasks(request.auth.organizationId, id, { limit, offset });
  response.json({ tasks });
}));

customersRouter.post("/:id/tasks", authorizePermission(CAPABILITIES.CUSTOMERS_MANAGE), asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Customer id");
  const title = requireString(request.body.title, "Task", { min: 2, max: 200 });
  const assignedTo = optionalString(request.body.assignedTo, 120);
  const dueAt = optionalIsoDateTime(request.body.dueAt, "Due date");
  const task = await createCustomerTask(request.auth.organizationId, id, { title, assignedTo, dueAt, createdBy: request.auth.userId });
  response.status(201).json({ task });
}));

customersRouter.patch("/:id/tasks/:taskId", authorizePermission(CAPABILITIES.CUSTOMERS_MANAGE), asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Customer id");
  const taskId = requireUuid(request.params.taskId, "Task id");
  const status = requireEnum(request.body.status, "Status", TASK_STATUSES);
  const task = await updateCustomerTaskStatus(request.auth.organizationId, id, taskId, status);
  if (!task) throw new HttpError(404, "TASK_NOT_FOUND", "Task not found.");
  response.json({ task });
}));

// ---------------------------------------------------------------------------
// Consent
// ---------------------------------------------------------------------------

customersRouter.get("/:id/consent", authorizePermission(CAPABILITIES.CUSTOMERS_READ), asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Customer id");
  const consent = await getCustomerConsent(request.auth.organizationId, id);
  response.json({ consent });
}));

customersRouter.get("/:id/consent/history", authorizePermission(CAPABILITIES.CUSTOMERS_READ), asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Customer id");
  const { limit, offset } = paginationParams(request.query);
  const events = await listCustomerConsentHistory(request.auth.organizationId, id, { limit, offset });
  response.json({ events });
}));

customersRouter.post("/:id/consent", authorizePermission(CAPABILITIES.CUSTOMERS_MANAGE), asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Customer id");
  const channel = requireEnum(request.body.channel, "Channel", CONSENT_CHANNELS);
  const status = requireEnum(request.body.status, "Status", CONSENT_STATUSES);
  const source = optionalString(request.body.source, 120);
  const event = await recordCustomerConsent(request.auth.organizationId, id, { channel, status, source, recordedBy: request.auth.userId });
  response.status(201).json({ event });
}));

// ---------------------------------------------------------------------------
// Documents (metadata and storage references only - see database/013_customer_relationship_records.sql)
// ---------------------------------------------------------------------------

customersRouter.get("/:id/documents", authorizePermission(CAPABILITIES.CUSTOMERS_READ), asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Customer id");
  const { limit, offset } = paginationParams(request.query);
  const documents = await listCustomerDocuments(request.auth.organizationId, id, { limit, offset });
  response.json({ documents });
}));

customersRouter.post("/:id/documents", authorizePermission(CAPABILITIES.CUSTOMERS_MANAGE), asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Customer id");
  const documentType = requireString(request.body.documentType, "Document type", { min: 2, max: 60 });
  const label = requireString(request.body.label, "Label", { min: 2, max: 160 });
  const status = request.body.status ? requireEnum(request.body.status, "Status", DOCUMENT_STATUSES) : "received";
  const storageReference = optionalString(request.body.storageReference, 300);
  const file = optionalFileUpload(request.body);
  const document = await createCustomerDocument(request.auth.organizationId, id, {
    documentType, label, status, storageReference, uploadedBy: request.auth.userId, file,
  });
  response.status(201).json({ document });
}));

customersRouter.patch("/:id/documents/:documentId", authorizePermission(CAPABILITIES.CUSTOMERS_MANAGE), asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Customer id");
  const documentId = requireUuid(request.params.documentId, "Document id");
  const status = requireEnum(request.body.status, "Status", DOCUMENT_STATUSES);
  const document = await updateCustomerDocumentStatus(request.auth.organizationId, id, documentId, status);
  if (!document) throw new HttpError(404, "DOCUMENT_NOT_FOUND", "Document not found.");
  response.json({ document });
}));

customersRouter.get("/:id/documents/:documentId/file", authorizePermission(CAPABILITIES.CUSTOMERS_READ), asyncRoute(async (request, response) => {
  const id = requireUuid(request.params.id, "Customer id");
  const documentId = requireUuid(request.params.documentId, "Document id");
  const file = await getCustomerDocumentFile(request.auth.organizationId, id, documentId);
  if (!file) throw new HttpError(404, "DOCUMENT_FILE_NOT_FOUND", "No file is attached to this document record.");
  response.setHeader("Content-Type", file.fileMimeType ?? "application/octet-stream");
  response.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(file.fileName ?? "document")}"`);
  response.send(file.fileData);
}));
