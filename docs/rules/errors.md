# Error handling rules

## Public API envelope

Return errors in this stable shape:

```json
{
  "error": {
    "code": "CUSTOMER_NOT_FOUND",
    "message": "Customer not found.",
    "requestId": "request-correlation-id",
    "details": []
  }
}
```

- `code` is stable and machine-readable.
- `message` is safe for the user and contains no internal implementation detail.
- `requestId` links the response to server logs.
- `details` is optional and contains field-level validation information only.

## Status mapping

- `400`: malformed or invalid input.
- `401`: authentication is missing or invalid.
- `403`: the actor is known but not allowed.
- `404`: the scoped record or route does not exist.
- `409`: a state or uniqueness conflict.
- `422`: well-formed input that violates a domain rule.
- `429`: bounded rate limit response with retry guidance.
- `500`: unexpected internal failure.
- `503`: a required dependency is unavailable.

## Server behavior

- Create typed operational errors for expected conditions and map them once in central middleware.
- Log unexpected failures once with request ID, route, method, status, and a redacted cause.
- Do not log the same error at every layer. Do not return stack traces, SQL, connection details, or raw provider errors.
- Retry only when the operation is idempotent and the failure is known to be transient.

## UI behavior

- Preserve the user's input and context after a recoverable failure.
- Explain what happened and offer a meaningful next action: retry, edit, reconnect, or contact support with the request ID.
- Use inline validation for field errors, an in-context state for content failures, and a global notification only for cross-screen events.
- Never show an indefinite spinner. Requests must time out and transition to an actionable error state.
