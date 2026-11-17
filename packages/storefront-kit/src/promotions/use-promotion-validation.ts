import { createStoreSdk } from "../sdk";
import { useState, useCallback, useEffect, useRef } from "react";
import { useNotify } from "../notices";

interface CartItem {
  productId: number;
  variantId: number | null;
  quantity: number;
  price: number;
}

interface UsePromotionValidationProps {
  storeRef: string;
  items: CartItem[];
  subtotal: number;
  shippingFee: number;
}

/** The API answered: this code does not apply (unknown, expired, not eligible). */
class PromotionRejected extends Error {}

export function usePromotionValidation({
  storeRef,
  items,
  subtotal,
  shippingFee,
}: UsePromotionValidationProps) {
  const [promoCode, setPromoCode] = useState<string>("");
  const [appliedPromotion, setAppliedPromotion] = useState<any>(null);
  // Computed by the API against the shipping fee we sent; the same number the
  // server uses when the order is placed, so we never derive it ourselves.
  const [shippingDiscount, setShippingDiscount] = useState<number>(0);
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);
  const [promoError, setPromoError] = useState<string>("");
  const notify = useNotify();

  // Validate promotion code with specific code
  const validatePromoCodeWithCode = useCallback(
    async (code?: string) => {
      const codeToValidate = code || promoCode;

      if (!codeToValidate.trim()) {
        setPromoError("Vui lòng nhập mã khuyến mãi");
        return;
      }

      setIsValidatingPromo(true);
      setPromoError("");

      try {
        const result = await createStoreSdk(storeRef).promotions.validate(storeRef, {
          code: codeToValidate.trim(),
          items: items.map(item => ({
            product_id: item.productId,
            variant_id: item.variantId ?? undefined,
            quantity: item.quantity,
            price: item.price,
          })),
          subtotal: subtotal,
          shipping_fee: shippingFee,
        });

        if (!result.success) {
          throw new PromotionRejected(
            result.message || "Mã khuyến mãi không hợp lệ"
          );
        }

        // Add code to promotion object for tracking
        const promotionWithCode = {
          ...result.promotion,
          code: codeToValidate.trim(),
        };
        setAppliedPromotion(promotionWithCode);
        setShippingDiscount(result.shipping_discount ?? 0);
        notify({
          kind: "success",
          code: "promotion.applied",
          title: "Áp dụng mã khuyến mãi thành công",
          description: `${result.promotion?.name || ""} đã được áp dụng`,
        });
      } catch (error) {
        // A rejected code is an ordinary answer, shown to the shopper; only
        // unexpected failures (network, server) are worth logging.
        if (!(error instanceof PromotionRejected)) {
          // eslint-disable-next-line no-console
          console.error("Failed to validate promotion code:", error);
        }
        setPromoError(
          error instanceof Error ? error.message : "Mã khuyến mãi không hợp lệ"
        );
        setAppliedPromotion(null);
        setShippingDiscount(0);
      } finally {
        setIsValidatingPromo(false);
      }
    },
    [storeRef, items, subtotal, shippingFee, promoCode, notify]
  );

  // The server computes the shipping discount against the shipping fee we sent
  // it, so the number goes stale the moment the fee changes (new address, new
  // method). Re-ask rather than recomputing locally — a local recomputation is
  // exactly the duplicated money logic this hook exists to avoid.
  const revalidateRef = useRef(validatePromoCodeWithCode);
  revalidateRef.current = validatePromoCodeWithCode;

  useEffect(() => {
    const code = appliedPromotion?.code;
    if (!code) return;
    void revalidateRef.current(code);
    // Intentionally keyed on the fee alone: including the callback would
    // re-run this on every render, and including appliedPromotion would loop
    // on the state this very effect writes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shippingFee]);

  // Validate promotion code
  const validatePromoCode = useCallback(async () => {
    await validatePromoCodeWithCode();
  }, [validatePromoCodeWithCode]);

  // Remove applied promotion
  const removePromoCode = useCallback(() => {
    setPromoCode("");
    setAppliedPromotion(null);
    setShippingDiscount(0);
    setPromoError("");
  }, []);

  // Apply promotion from suggestion
  const applyPromotionFromSuggestion = useCallback(
    async (code: string) => {
      setPromoCode(code);
      // Use the code directly instead of relying on state
      await validatePromoCodeWithCode(code);
    },
    [validatePromoCodeWithCode]
  );

  return {
    promoCode,
    appliedPromotion,
    shippingDiscount,
    isValidatingPromo,
    promoError,
    setPromoCode,
    validatePromoCode,
    removePromoCode,
    applyPromotionFromSuggestion,
  };
}
