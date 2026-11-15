import type { ProductVariant } from "@ecomweb/sdk";

import { CartItem } from "./types";

/**
 * Generate a unique cart item ID for a product variant
 */
export function generateCartItemId(
  productId: number,
  variantId?: number
): string {
  if (variantId) {
    return `${productId}-${variantId}`;
  }
  return `${productId}`;
}

/**
 * Create a cart item from a product variant
 */
export function createCartItemFromVariant(
  productId: number,
  productName: string,
  productImage: string | undefined,
  variant: ProductVariant,
  variantName?: string,
  variantOptions?: Array<{ optionName: string; optionValue: string }>
): CartItem {
  return {
    id: generateCartItemId(productId, variant.id),
    productId,
    variantId: variant.id,
    name: productName,
    price: variant.price,
    originalPrice: variant.price, // You might want to add original_price to variants
    image: productImage,
    quantity: 1,
    variantName,
    variantOptions,
  };
}

/**
 * Create a cart item from a simple product (no variants)
 */
export function createCartItemFromProduct(
  productId: number,
  productName: string,
  productImage: string | undefined,
  price: number,
  originalPrice?: number
): CartItem {
  return {
    id: generateCartItemId(productId),
    productId,
    name: productName,
    price,
    originalPrice,
    image: productImage,
    quantity: 1,
  };
}

/**
 * Check if a cart item is a variant
 */
export function isVariantItem(item: CartItem): boolean {
  return item.variantId !== undefined;
}

/**
 * Get display name for variant options
 */
export function getVariantDisplayName(
  variantOptions?: Array<{ optionName: string; optionValue: string }>
): string {
  if (!variantOptions || variantOptions.length === 0) {
    return "";
  }

  return variantOptions
    .map(option => `${option.optionName}: ${option.optionValue}`)
    .join(", ");
}
