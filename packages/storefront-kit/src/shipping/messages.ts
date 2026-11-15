/**
 * Checkout shipping strings, extracted from the components that used to
 * hardcode them inline. This is NOT an i18n layer -- the storefront has no
 * i18n infrastructure (no next-intl, no locale routing, no message
 * catalog), and bootstrapping one is out of scope for a shipping-vocabulary
 * change. This just gets every shipping string into one place so a real
 * i18n task can source from here later instead of hunting through JSX.
 *
 * `estimate` is a template: interpolate `{min}` and `{max}` yourself.
 */
export const SHIPPING_MESSAGES = Object.freeze({
  title: "Phương thức vận chuyển",
  prompt: "Vui lòng nhập địa chỉ giao hàng để xem phương thức vận chuyển",
  empty: "Không có phương thức vận chuyển phù hợp",
  emptyHint:
    "Vui lòng kiểm tra lại địa chỉ giao hàng hoặc liên hệ với cửa hàng.",
  failed: "Không thể tính phí vận chuyển",
  failedHint: "Kết nối có thể đang gián đoạn. Vui lòng thử lại.",
  retry: "Thử lại",
  free: "Miễn phí",
  quoteChanged: "Phí vận chuyển đã thay đổi",
  quoteChangedHint: "Vui lòng kiểm tra lại phí vận chuyển mới rồi đặt hàng.",
  estimate: "Dự kiến giao: {min} đến {max} ngày",
});

/** Fills in the `{min}`/`{max}` placeholders in `SHIPPING_MESSAGES.estimate`. */
export function formatShippingEstimate(min: number, max: number): string {
  return SHIPPING_MESSAGES.estimate
    .replace("{min}", String(min))
    .replace("{max}", String(max));
}
