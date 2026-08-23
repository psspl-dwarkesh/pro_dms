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

export function paginationParams(query) {
  return {
    limit: Number(query.limit) > 0 ? Math.min(Math.floor(Number(query.limit)), 100) : 25,
    offset: Number(query.offset) > 0 ? Math.floor(Number(query.offset)) : 0,
  };
}
