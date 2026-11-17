import type { ApiResponse } from "./types";

/**
 * The error thrown when the API answers with an error. Carries the HTTP status and the API's error code.
 */
export class ApiClientError extends Error {
  /**
   * The HTTP status code, or `0` when there was no response.
   */
  statusCode: number;
  /**
   * The API's machine-readable error code, when it sent one.
   */
  code?: string;
  /** The business error's structured `details`, when the backend sent any. */
  details?: unknown;
  constructor(message: string, statusCode = 0, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

function toClientError(response: ApiResponse<unknown>): ApiClientError {
  return new ApiClientError(
    response.error?.message || "Request failed",
    response.error?.statusCode || 0,
    response.error?.error,
    response.error?.details,
  );
}

/**
 * Returns the data of a successful response and throws on an error response.
 *
 * @param response - the response to read
 * @returns The response data; throws {@link ApiClientError} when the API answers with an error
 */
export function unwrap<T>(response: ApiResponse<T>): T {
  if (response.success && response.data !== undefined) {
    return response.data as T;
  }
  throw toClientError(response);
}

/**
 * Like {@link unwrap}, but resolves `null` for the statuses that mean "not found".
 *
 * @param response - the response to read
 * @param nullStatusCodes - the statuses that resolve `null`, `[404]` by default
 * @returns The response data, or `null` when the status is in `nullStatusCodes`; throws {@link ApiClientError} on any other API error
 */
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
  throw toClientError(response);
}

/**
 * Throws on an error response and returns nothing on success. Use it when you do not need the data.
 *
 * @param response - the response to check
 */
export function ensureSuccess(response: ApiResponse<any>): void {
  if (response.success) return;
  throw toClientError(response);
}
