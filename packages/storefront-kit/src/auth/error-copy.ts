/**
 * Shopper-facing copy for backend errors.
 *
 * Project rule: backend exception messages are written in English and are
 * never shown to a shopper. The backend serialises every business error as
 * `{ code, message, details, timestamp }` (see `src/common/exceptions/` in the
 * api repo) and `code` is the stable identifier — this module is the single
 * place that turns one into Vietnamese.
 *
 * The fallback is always a generic Vietnamese sentence. Never fall back to the
 * backend's `message`.
 */

export const GENERIC_ERROR_COPY = "Đã xảy ra lỗi. Vui lòng thử lại.";

/**
 * Keyed by the backend's stable `code`. Sources, read directly rather than
 * guessed:
 *   - `AUTH_*` — `src/modules/customer-auth/domain/constants/auth.constants.ts`
 *     (`AUTH_ERROR`).
 *   - `ACCESS_DENIED` — `AuthorizationException.accessDenied()`, thrown by
 *     `customer-addresses.controller.ts` on an address the caller does not own.
 *   - `<RESOURCE>_NOT_FOUND` — `ResourceNotFoundException`, whose code is
 *     `${resource.toUpperCase()}_NOT_FOUND`. `Address` and `Order` are the two
 *     resources the storefront's authenticated routes can produce.
 *   - `VALIDATION_FAILED` — `ValidationException`.
 *   - `ORDER_NOT_CANCELLABLE` — `ORDER_ERROR.NOT_CANCELLABLE`
 *     (`src/modules/orders/domain/constants/order-error.constants.ts`),
 *     thrown by `OrderCancelCommandHandler` when a customer tries to cancel
 *     an order outside pending/confirmed/processing.
 *   - `INSUFFICIENT_INVENTORY`: `InsufficientInventoryException`
 *     (`src/modules/inventory/domain/exceptions/`), thrown when an order asks
 *     for more of a deny-policy variant than is available.
 *   - `ORDER_PROMOTION_NOT_APPLICABLE`: `ORDER_ERROR.PROMOTION_NOT_APPLICABLE`,
 *     thrown by `OrderComputationService.applyPromotionCode` when the applied
 *     code can no longer be redeemed at placement (expired, used up, the cart
 *     changed). `useCheckout` drops the code when it sees this.
 *   - `PROMOTION_USAGE_LIMIT_REACHED`: `promotion-usage.ts` in the API's
 *     promotions module, when placing the order would pass the code's total
 *     or per-customer usage limit. `useCheckout` drops the code too.
 *   - `PROMOTION_IDENTITY_REQUIRED`: `promotion-usage.ts` too (422, details
 *     `{ field: "customer_email" }`), when a code limited per customer is
 *     used on an order with neither a signed-in customer nor an email. The
 *     code is kept; the shopper adds an email and places again.
 *   - `SHIPPING_QUOTE_CHANGED` and `ORDER_SHIPPING_RATE_UNAVAILABLE`:
 *     `SHIPPING_ERROR_CODES` in `@ecomweb/sdk`, returned by order creation
 *     when the carrier's price moved since the quote (409, `details.options`
 *     holds the new ones; `useCheckout` handles it as `quote_changed`) or the
 *     chosen rate can no longer be quoted.
 *   - `ORDER_CANCEL_BLOCKED_BY_SHIPMENT`: `ORDER_SHIPMENT_ERROR_CODES` in
 *     `@ecomweb/sdk`, returned when a customer cancels an order whose carrier
 *     shipment is already in progress.
 *   - `STORE_COMING_SOON`: `src/modules/tenant/domain/services/store-access.ts`,
 *     the 403 for a store its merchant has not opened yet (details
 *     `{ name }`), applied by `StorefrontApiKeyGuard`. A preview token opens
 *     only GET and HEAD, so in a preview every write gets it: customer
 *     sign-in and sign-up, reviews, blog comments.
 *   - `BLOG_COMMENTS_DISABLED`: the 403 for a blog comment on a store whose
 *     blog settings have comments turned off (`allow_comments`). The
 *     storefront hides the form then, so this reaches a shopper only when the
 *     setting changed while the post was open.
 */
const ERROR_COPY: Record<string, string> = {
  AUTH_INVALID_CREDENTIALS: "Email hoặc mật khẩu không đúng.",
  AUTH_ACCOUNT_LOCKED: "Quá nhiều lần thử. Vui lòng thử lại sau 15 phút.",
  // The merchant marked this customer inactive. Sent only after the shopper
  // proved the password, code or Google account.
  AUTH_ACCOUNT_DISABLED:
    "Tài khoản này không thể đăng nhập. Vui lòng liên hệ cửa hàng.",
  AUTH_EMAIL_NOT_VERIFIED: "Vui lòng xác thực email của bạn trước.",
  AUTH_METHOD_DISABLED:
    "Phương thức đăng nhập này không khả dụng cho cửa hàng này.",
  AUTH_TOKEN_INVALID: "Mã xác thực không hợp lệ hoặc đã được sử dụng.",
  AUTH_TOKEN_EXPIRED: "Mã xác thực đã hết hạn. Vui lòng yêu cầu mã mới.",
  AUTH_SESSION_EXPIRED: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  AUTH_WEAK_PASSWORD: "Mật khẩu chưa đáp ứng yêu cầu của cửa hàng.",
  AUTH_RATE_LIMITED: "Quá nhiều yêu cầu. Vui lòng đợi một chút.",
  AUTH_STORE_MISMATCH:
    "Phiên đăng nhập không thuộc cửa hàng này. Vui lòng đăng nhập lại.",
  AUTH_EMAIL_TAKEN: "Email này đã được sử dụng.",

  ACCESS_DENIED: "Bạn không có quyền thực hiện thao tác này.",
  VALIDATION_FAILED: "Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.",
  ADDRESS_NOT_FOUND: "Không tìm thấy địa chỉ này.",
  ORDER_NOT_FOUND: "Không tìm thấy đơn hàng này.",
  ORDER_NOT_CANCELLABLE: "Đơn hàng này không thể huỷ được nữa.",
  INSUFFICIENT_INVENTORY: "Một số sản phẩm không đủ hàng.",
  ORDER_PROMOTION_NOT_APPLICABLE:
    "Mã giảm giá không còn dùng được cho đơn này nên đã được gỡ. Vui lòng kiểm tra lại tổng tiền rồi đặt hàng.",
  PROMOTION_USAGE_LIMIT_REACHED:
    "Mã giảm giá đã hết lượt sử dụng nên đã được gỡ. Vui lòng kiểm tra lại tổng tiền rồi đặt hàng.",
  PROMOTION_IDENTITY_REQUIRED:
    "Mã giảm giá này giới hạn lượt dùng cho mỗi khách hàng. Vui lòng nhập email để sử dụng mã.",
  SHIPPING_QUOTE_CHANGED:
    "Phí vận chuyển đã thay đổi. Vui lòng kiểm tra lại rồi đặt hàng.",
  ORDER_SHIPPING_RATE_UNAVAILABLE:
    "Phương thức vận chuyển đã chọn không còn khả dụng. Vui lòng chọn lại.",
  ORDER_CANCEL_BLOCKED_BY_SHIPMENT:
    "Đơn đã được giao cho hãng vận chuyển, không thể huỷ. Vui lòng liên hệ cửa hàng.",
  STORE_COMING_SOON:
    "Cửa hàng chưa mở cửa nên chưa thể thực hiện thao tác này.",
  BLOG_COMMENTS_DISABLED: "Cửa hàng đã tắt bình luận cho blog.",
};

/**
 * Nest's built-in `UnauthorizedException` / `ForbiddenException` (thrown by
 * `TenantUserAuthGuard`, `StorefrontApiKeyGuard` and the `@CurrentCustomer`
 * decorator) carry no `code` at all — only a status and English prose. Status
 * is the only stable signal there.
 */
const STATUS_COPY: Record<number, string> = {
  0: "Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối mạng.",
  401: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  403: "Bạn không có quyền thực hiện thao tác này.",
  404: "Không tìm thấy dữ liệu yêu cầu.",
  429: "Quá nhiều yêu cầu. Vui lòng đợi một chút.",
  500: "Máy chủ đang gặp sự cố. Vui lòng thử lại sau.",
  502: "Máy chủ đang gặp sự cố. Vui lòng thử lại sau.",
  503: "Máy chủ đang bận. Vui lòng thử lại sau.",
  504: "Máy chủ phản hồi quá lâu. Vui lòng thử lại.",
};

/** Maps a backend error code to Vietnamese copy. */
export function errorCopy(
  code: string | null | undefined,
  fallback: string = GENERIC_ERROR_COPY
): string {
  return (code && ERROR_COPY[code]) || fallback;
}

/**
 * The same mapping for a caught throwable. `ApiClientError` (thrown by the
 * SDK's `unwrap`) carries `code` and `statusCode`; `lib/auth/context.tsx`
 * surfaces `{ message, code }`. Anything else falls through to `fallback`.
 *
 * The caught value's own `message` is deliberately never used: it is either
 * the backend's English prose or an axios internal string.
 */
export function errorCopyFor(
  error: unknown,
  fallback: string = GENERIC_ERROR_COPY
): string {
  if (!error || typeof error !== "object") return fallback;

  const { code, statusCode } = error as {
    code?: unknown;
    statusCode?: unknown;
  };

  if (typeof code === "string" && ERROR_COPY[code]) return ERROR_COPY[code];
  if (typeof statusCode === "number" && STATUS_COPY[statusCode]) {
    return STATUS_COPY[statusCode];
  }

  return fallback;
}
