export class HttpError extends Error {
  constructor(status, code, message, details = undefined, options = undefined) {
    super(message, options);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.expose = true;
  }
}

export function asyncRoute(handler) {
  return function routeHandler(request, response, next) {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

export function errorEnvelope(error, requestId) {
  const expected = error?.expose === true;
  return {
    error: {
      code: expected ? error.code : "INTERNAL_ERROR",
      message: expected ? error.message : "The request could not be completed.",
      requestId,
      ...(expected && error.details?.length ? { details: error.details } : {}),
    },
  };
}
