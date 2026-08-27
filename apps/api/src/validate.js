import { HttpError } from "./errors.js";

export function requireString(value, field, { min = 1, max = 200 } = {}) {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length < min || text.length > max) {
    throw new HttpError(400, "INVALID_INPUT", `${field} must be between ${min} and ${max} characters.`, [{ field }]);
  }
  return text;
}

export function optionalString(value, max = 200) {
  if (value === undefined || value === null || value === "") return null;
  return String(value).trim().slice(0, max);
}

export function requireNumber(value, field, { min = -Infinity, max = Infinity } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new HttpError(400, "INVALID_INPUT", `${field} must be a valid number.`, [{ field }]);
  }
  return number;
}

export function optionalNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return number;
}

export function optionalIsoDateTime(value, field) {
  if (value === undefined || value === null || value === "") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, "INVALID_INPUT", `${field} must be a valid date.`, [{ field }]);
  }
  return date.toISOString();
}

export function requireEnum(value, field, allowed) {
  if (!allowed.includes(value)) {
    throw new HttpError(400, "INVALID_INPUT", `${field} must be one of: ${allowed.join(", ")}.`, [{ field }]);
  }
  return value;
}

export function requireUuid(value, field) {
  const text = typeof value === "string" ? value.trim() : "";
  const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!pattern.test(text)) {
    throw new HttpError(400, "INVALID_INPUT", `${field} must be a valid identifier.`, [{ field }]);
  }
  return text;
}

const DOCUMENT_FILE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_DOCUMENT_FILE_BYTES = 5 * 1024 * 1024;

// Documents travel as base64 inside the normal JSON body (see app.js's json size limit) rather
// than multipart/form-data, so one small file upload doesn't need its own parsing middleware.
// Returns null when no file was attached -- callers treat that as "metadata-only record", which
// stays a supported way to log a document (see database/013_customer_relationship_records.sql).
export function optionalFileUpload(body) {
  if (!body.fileData) return null;
  const fileName = requireString(body.fileName, "File name", { min: 1, max: 200 });
  const fileMimeType = requireEnum(body.fileMimeType, "File type", DOCUMENT_FILE_MIME_TYPES);
  let fileData;
  try {
    fileData = Buffer.from(String(body.fileData), "base64");
  } catch {
    throw new HttpError(400, "INVALID_INPUT", "File data must be valid base64.", [{ field: "fileData" }]);
  }
  if (!fileData.length || fileData.length > MAX_DOCUMENT_FILE_BYTES) {
    throw new HttpError(400, "INVALID_INPUT", `File must be between 1 byte and ${MAX_DOCUMENT_FILE_BYTES / (1024 * 1024)} MB.`, [{ field: "fileData" }]);
  }
  return { fileName, fileMimeType, fileSizeBytes: fileData.length, fileData };
}

export function paginationParams(query) {
  return {
    limit: Number(query.limit) > 0 ? Math.min(Math.floor(Number(query.limit)), 100) : 25,
    offset: Number(query.offset) > 0 ? Math.floor(Number(query.offset)) : 0,
  };
}
