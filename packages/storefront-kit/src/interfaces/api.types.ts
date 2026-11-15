export interface ApiError {
  message: string;
  statusCode: number;
  error?: string;
  /** The business error's structured `details`, e.g. `{ items }` on INSUFFICIENT_INVENTORY. */
  details?: unknown;
}

export interface ApiResponse<T = any> {
  data?: T;
  error?: ApiError;
  success: boolean;
}

export interface RequestConfig {
  headers?: Record<string, string>;
  signal?: AbortSignal;
  [key: string]: any;
}

export interface AuthenticatedApiClient {
  get<T>(url: string, config?: RequestConfig): Promise<ApiResponse<T>>;
  post<T>(
    url: string,
    data?: any,
    config?: RequestConfig
  ): Promise<ApiResponse<T>>;
  put<T>(
    url: string,
    data?: any,
    config?: RequestConfig
  ): Promise<ApiResponse<T>>;
  patch<T>(
    url: string,
    data?: any,
    config?: RequestConfig
  ): Promise<ApiResponse<T>>;
  delete<T>(url: string, config?: RequestConfig): Promise<ApiResponse<T>>;
}
