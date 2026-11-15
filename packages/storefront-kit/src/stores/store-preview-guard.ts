import type { Notice } from "../notices";

/**
 * What the shopper sees when a store preview refuses a write. A preview is
 * read-only: the API opens GET and HEAD for a preview token and answers
 * every write on a coming soon store with `STORE_COMING_SOON`. So the cart
 * and checkout refuse in the browser first, without sending the request
 * (`isBrowserStorePreview()` in `api/store-preview-header.ts`).
 *
 * `placeOrder` returns the message; the cart writes notify the notice.
 */
export const STORE_PREVIEW_READ_ONLY_MESSAGE =
  "Đang xem trước: chưa thể đặt hàng khi cửa hàng chưa mở cửa.";

export const STORE_PREVIEW_READ_ONLY_NOTICE: Notice = {
  kind: "info",
  code: "store_preview.read_only",
  title: "Đang xem trước",
  description: "Chưa thể đặt hàng khi cửa hàng chưa mở cửa.",
};
