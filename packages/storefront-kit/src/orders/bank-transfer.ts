"use client";

import { useEffect, useState } from "react";
import { publicApiClient } from "../api/client";
import { unwrap } from "../api/response";
import { useStoreId } from "../store/store-context";

/** The bank_transfer slice of the public payment-methods projection. */
export interface BankAccountView {
  id: number;
  bank_name: string;
  bank_code: string;
  account_number: string;
  account_holder: string;
}

interface PublicPaymentMethod {
  payment_method: string;
  transfer_instruction?: string | null;
  bank_accounts?: BankAccountView[];
}

/** What a shopper needs to pay a bank transfer order. */
export interface BankTransferDetails {
  accounts: BankAccountView[];
  /** The merchant's transfer instruction, if they wrote one. */
  note: string | null;
  isLoading: boolean;
}

/**
 * Whether an order page should tell the shopper how to pay by transfer: a
 * bank_transfer order the merchant has not marked paid yet, and that is
 * still live. Order pages read this from the order itself, so they work for
 * any order, long after the checkout handoff has expired.
 */
export function shouldShowBankTransferDetails(
  order:
    | {
        payment_method?: string | null;
        payment_status?: string | null;
        order_status?: string | null;
      }
    | null
    | undefined
): boolean {
  if (!order) return false;
  return (
    order.payment_method === "bank_transfer" &&
    order.payment_status === "pending" &&
    order.order_status !== "cancelled"
  );
}

/**
 * The bank_transfer method's accounts and instruction out of the public
 * payment-methods response. A store without the method, or a malformed
 * response, yields no accounts.
 */
export function pickBankTransfer(methods: unknown): {
  accounts: BankAccountView[];
  note: string | null;
} {
  const list = Array.isArray(methods) ? (methods as PublicPaymentMethod[]) : [];
  const transfer = list.find(m => m?.payment_method === "bank_transfer");
  return {
    accounts: Array.isArray(transfer?.bank_accounts)
      ? transfer.bank_accounts
      : [],
    // transfer_instruction, not description: description is the
    // choose-a-method text shown at checkout.
    note: transfer?.transfer_instruction || null,
  };
}

/**
 * The store's bank accounts and transfer instruction, fetched from the
 * public payment-methods endpoint while `enabled`. Used by the order-success
 * page and by the order lookup and account order pages.
 */
export function useBankTransferDetails(enabled: boolean): BankTransferDetails {
  const storeRef = useStoreId();
  const [accounts, setAccounts] = useState<BankAccountView[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !storeRef) return;
    let cancelled = false;
    setIsLoading(true);
    (async () => {
      try {
        const res = await publicApiClient.get<PublicPaymentMethod[]>(
          `/storefront/stores/${encodeURIComponent(storeRef)}/payment-methods`
        );
        const picked = pickBankTransfer(unwrap(res));
        if (cancelled) return;
        setAccounts(picked.accounts);
        setNote(picked.note);
      } catch {
        // The order exists either way; no accounts renders a "contact the
        // shop" fallback rather than an error.
        if (!cancelled) {
          setAccounts([]);
          setNote(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, storeRef]);

  return { accounts, note, isLoading };
}
