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

export async function apiGet<T>(path: string, options: { signal?: AbortSignal; timeoutMs?: number } = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs ?? 8000);
  const onAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onAbort, { once: true });

  try {
    const response = await fetch(path, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody & T;

    if (!response.ok) {
      const structured = typeof body.error === "object" ? body.error : undefined;
      throw new ApiError(structured?.message ?? (typeof body.error === "string" ? body.error : "The request could not be completed."), {
        status: response.status,
        code: structured?.code,
        requestId: structured?.requestId,
      });
    }

    return body;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted) throw new ApiError("The request timed out. Try again.", { status: 408, code: "REQUEST_TIMEOUT" });
    throw new ApiError("The service is not reachable. Check the connection and try again.", { status: 503, code: "SERVICE_UNAVAILABLE" });
  } finally {
    window.clearTimeout(timeout);
    options.signal?.removeEventListener("abort", onAbort);
  }
}
