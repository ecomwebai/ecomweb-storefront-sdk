import { formatPrice } from "../currency";
import { PromotionType, DiscountMethod } from "@ecomweb/sdk";

export interface PromotionDescriptionData {
  type: string;
  discount_method?: string;
  discount_value?: number;
  description?: string;
}

/**
 * Generate promotion description based on promotion type and discount method
 * @param promotion - Promotion data containing type, discount_method, discount_value, description
 * @param locale - Locale for formatting (e.g., "vi-VN", "en-US")
 * @param currency - Currency code (e.g., "VND", "USD")
 * @returns Formatted promotion description string
 */
export function getPromotionDescription(
  promotion: PromotionDescriptionData,
  locale: string = "vi-VN",
  currency: string = "VND"
): string {
  if (promotion.type === PromotionType.FREE_SHIPPING) {
    if (
      promotion.discount_method === DiscountMethod.PERCENTAGE &&
      promotion.discount_value
    ) {
      return `Giảm phí vận chuyển ${promotion.discount_value}%`;
    }
    if (
      promotion.discount_method === DiscountMethod.FIXED_AMOUNT &&
      promotion.discount_value
    ) {
      return `Giảm phí vận chuyển ${formatPrice(promotion.discount_value, locale, currency)}`;
    }
    return "Miễn phí vận chuyển";
  }

  if (
    promotion.discount_method === DiscountMethod.PERCENTAGE &&
    promotion.discount_value
  ) {
    return `Giảm ${promotion.discount_value}%`;
  }

  if (
    promotion.discount_method === DiscountMethod.FIXED_AMOUNT &&
    promotion.discount_value
  ) {
    return `Giảm ${formatPrice(promotion.discount_value, locale, currency)}`;
  }

  if (promotion.type === PromotionType.CART_DISCOUNT) {
    if (
      promotion.discount_method === DiscountMethod.PERCENTAGE &&
      promotion.discount_value
    ) {
      return `Giảm ${promotion.discount_value}%`;
    }
    if (
      promotion.discount_method === DiscountMethod.FIXED_AMOUNT &&
      promotion.discount_value
    ) {
      return `Giảm ${formatPrice(promotion.discount_value, locale, currency)}`;
    }
  }

  if (promotion.type === PromotionType.PRODUCT_DISCOUNT) {
    if (
      promotion.discount_method === DiscountMethod.PERCENTAGE &&
      promotion.discount_value
    ) {
      return `Giảm ${promotion.discount_value}%`;
    }
    if (
      promotion.discount_method === DiscountMethod.FIXED_AMOUNT &&
      promotion.discount_value
    ) {
      return `Giảm ${formatPrice(promotion.discount_value, locale, currency)}`;
    }
  }

  return promotion.description || "Khuyến mãi đặc biệt";
}
