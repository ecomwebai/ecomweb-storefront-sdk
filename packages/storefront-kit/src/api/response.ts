import { ApiResponse } from "../interfaces";

export class ApiClientError extends Error {
  statusCode: number;
  code?: string;
  /**
   * A business error's structured payload, for example the per-line items of
   * an INSUFFICIENT_INVENTORY rejection. Carried here as well as on the SDK's
   * own error class because this repo has two: checkout's order creation
   * throws the SDK's, while the payment helpers throw this one. Dropping the
   * payload on one of them would lose it silently on whichever path a caller
   * happens to be using.
   */
  details?: unknown;
  constructor(message: string, statusCode = 0, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

// Unwraps a successful response, throws if not successful
export function unwrap<T>(response: ApiResponse<T>): T {
  if (response.success && response.data !== undefined) {
    return response.data as T;
  }
  const message = response.error?.message || "Request failed";
  const status = response.error?.statusCode || 0;
  const code = response.error?.error;
  throw new ApiClientError(message, status, code, response.error?.details);
}

// Unwraps a response but returns null for specific status codes (default 404)
export function unwrapOrNull<T>(
  response: ApiResponse<T>,
  nullStatusCodes: number[] = [404]
): T | null {
  if (response.success && response.data !== undefined) {
    return response.data as T;
  }
  if (
    !response.success &&
    response.error &&
    nullStatusCodes.includes(response.error.statusCode)
  ) {
    return null;
  }
  const message = response.error?.message || "Request failed";
  const status = response.error?.statusCode || 0;
  const code = response.error?.error;
  throw new ApiClientError(message, status, code, response.error?.details);
}

// Ensures the response is successful (useful for void endpoints)
export function ensureSuccess(response: ApiResponse<any>): void {
  if (response.success) return;
  const message = response.error?.message || "Request failed";
  const status = response.error?.statusCode || 0;
  const code = response.error?.error;
  throw new ApiClientError(message, status, code, response.error?.details);
}
