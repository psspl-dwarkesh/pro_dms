export type ApiErrorBody = {
  error?: {
    code?: string;
    message?: string;
    requestId?: string;
    details?: unknown[];
  } | string;
};

export class ApiError extends Error {
  status: number;
  code: string;
  requestId?: string;

  constructor(message: string, options: { status: number; code?: string; requestId?: string }) {
    super(message);
    this.name = "ApiError";
    this.status = options.status;
    this.code = options.code ?? "REQUEST_FAILED";
    this.requestId = options.requestId;
  }
}

const TOKEN_STORAGE_KEY = "autoaxis.session.token";

let onUnauthorized: (() => void) | null = null;

export function registerUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

export function getStoredToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null) {
  try {
    if (token) window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Storage may be unavailable (private browsing); the session simply will not persist across reloads.
  }
}

type RequestOptions = { signal?: AbortSignal; timeoutMs?: number };

async function apiRequest<T>(method: string, path: string, body: unknown, options: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs ?? 8000);
  const onAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onAbort, { once: true });

  const token = getStoredToken();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const response = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    if (response.status === 204) return undefined as T;
    const responseBody = (await response.json().catch(() => ({}))) as ApiErrorBody & T;

    if (!response.ok) {
      const structured = typeof responseBody.error === "object" ? responseBody.error : undefined;
      const apiError = new ApiError(
        structured?.message ?? (typeof responseBody.error === "string" ? responseBody.error : "The request could not be completed."),
        { status: response.status, code: structured?.code, requestId: structured?.requestId },
      );
      if (response.status === 401) onUnauthorized?.();
      throw apiError;
    }

    return responseBody;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted) throw new ApiError("The request timed out. Try again.", { status: 408, code: "REQUEST_TIMEOUT" });
    throw new ApiError("The service is not reachable. Check the connection and try again.", { status: 503, code: "SERVICE_UNAVAILABLE" });
  } finally {
    window.clearTimeout(timeout);
    options.signal?.removeEventListener("abort", onAbort);
  }
}

export function apiGet<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return apiRequest<T>("GET", path, undefined, options);
}

export function apiPost<T>(path: string, body: unknown, options: RequestOptions = {}): Promise<T> {
  return apiRequest<T>("POST", path, body, options);
}

export function apiPatch<T>(path: string, body: unknown, options: RequestOptions = {}): Promise<T> {
  return apiRequest<T>("PATCH", path, body, options);
}

export function apiPut<T>(path: string, body: unknown, options: RequestOptions = {}): Promise<T> {
  return apiRequest<T>("PUT", path, body, options);
}

export function apiDelete<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return apiRequest<T>("DELETE", path, undefined, options);
}

// File downloads (e.g. a document's stored bytes) aren't JSON, so they bypass apiRequest's
// json-parsing response handling; the auth header still needs to be attached by hand.
export async function apiDownload(path: string): Promise<Blob> {
  const token = getStoredToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(path, { headers });
  if (!response.ok) {
    if (response.status === 401) onUnauthorized?.();
    throw new ApiError("Could not download the file.", { status: response.status });
  }
  return response.blob();
}
