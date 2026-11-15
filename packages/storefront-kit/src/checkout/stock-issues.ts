import {
  INVENTORY_ERROR_CODES,
  type InsufficientInventoryItem,
} from "@ecomweb/sdk";

/**
 * Turns the API's 409 INSUFFICIENT_INVENTORY into per-line shopper copy.
 *
 * The error's `details.items` names variants, not cart lines, and only
 * variants whose stock is short; lines are matched by `variantId`. Duck-typed
 * rather than `instanceof ApiClientError`: the storefront and the SDK each
 * define an ApiClientError class.
 */
export const STOCK_ISSUE_TOAST_DESCRIPTION =
  "Vui lòng điều chỉnh các sản phẩm được đánh dấu trong đơn hàng rồi đặt lại.";

export function insufficientItemsFrom(
  error: unknown
): InsufficientInventoryItem[] | null {
  if (!error || typeof error !== "object") return null;
  const { code, details } = error as { code?: unknown; details?: unknown };
  if (code !== INVENTORY_ERROR_CODES.INSUFFICIENT_INVENTORY) return null;

  const rawItems = (details as { items?: unknown } | null | undefined)?.items;
  if (!Array.isArray(rawItems)) return null;

  const valid = rawItems.filter(
    (item): item is InsufficientInventoryItem =>
      !!item &&
      typeof item === "object" &&
      typeof (item as InsufficientInventoryItem).variant_id === "number" &&
      typeof (item as InsufficientInventoryItem).requested === "number" &&
      typeof (item as InsufficientInventoryItem).available === "number"
  );
  return valid.length > 0 ? valid : null;
}

export function stockIssueCopy(item: InsufficientInventoryItem): string {
  return item.available <= 0
    ? "Sản phẩm này đã hết hàng."
    : `Chỉ còn ${item.available} sản phẩm, vui lòng giảm số lượng.`;
}

export function stockIssuesByLine(
  lines: ReadonlyArray<{ id: string; variantId?: number }>,
  items: InsufficientInventoryItem[]
): Record<string, string> {
  const byVariant = new Map(items.map(item => [item.variant_id, item]));
  const issues: Record<string, string> = {};
  for (const line of lines) {
    if (line.variantId === undefined) continue;
    const item = byVariant.get(line.variantId);
    if (item) issues[line.id] = stockIssueCopy(item);
  }
  return issues;
}
