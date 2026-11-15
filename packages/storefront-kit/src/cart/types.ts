export interface CartItem {
  id: string;
  productId: number;
  variantId?: number; // New: support for product variants
  name: string;
  price: number;
  originalPrice?: number;
  image?: string;
  quantity: number;
  // Variant-specific information
  variantName?: string; // e.g., "Size: L, Color: Red"
  variantOptions?: Array<{
    optionName: string;
    optionValue: string;
  }>;
  // Promotion information
  promotions?: Array<{
    id: number;
    name: string;
    description?: string;
    mode: string;
    code?: string;
    type: string;
    condition_type: string;
    discount_method?: string;
    discount_value?: number;
    fixed_price?: number;
    min_amount?: number;
    min_quantity?: number;
    start_at: string;
    end_at?: string;
  }>;
  bestPromotion?: any;
}

export interface StoredOrderInfo {
  orders: OrderInfo[];
  timestamp: number;
}

export interface OrderInfo {
  order_number: string;
  /**
   * Optional, unlike everywhere else. This shape is read back out of
   * localStorage under "recent-order", and nothing in the current codebase
   * writes it — a payload found there was written by an older build that
   * predates order codes, so it may genuinely lack one.
   */
  order_code?: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  total: number;
  items: Array<{
    name: string;
    price: number;
    quantity: number;
    image?: string;
  }>;
  shipping_address: string;
  payment_method: string;
  created_at: string;
}
