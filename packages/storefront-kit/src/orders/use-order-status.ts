"use client";

import { useCallback, useEffect, useState } from "react";
import type { OrderWithItems } from "@ecomweb/sdk";
import { getPaymentState } from "../checkout/get-payment-state";
import { readOrderHandoff, type OrderHandoff } from "../checkout/order-handoff";
import { pollPaymentState } from "../checkout/payment-state-poll";
import {
  resolveInitialState,
  shouldPollForConfirmation,
  type PaymentConfirmationState,
} from "../checkout/success-state";
import { createStoreSdk } from "../sdk";
import { useStoreId } from "../store/store-context";
import { useBankTransferDetails } from "./bank-transfer";

export type { BankAccountView } from "./bank-transfer";

const CANCELLED = new Error("order status: unmounted");

const timeoutWait = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * What the shopper should be told about a just-placed order (the
 * order-success page, which is also the payment gateway's return URL).
 *
 * Arriving back from a gateway proves nothing about the payment: the
 * provider's server-to-server callback usually lands later, so a gateway
 * order polls the API until it is paid or failed. Offline orders read the
 * checkout's handoff and never poll. See checkout/success-state.ts.
 */
export function useOrderStatus({
  orderCode,
  wait = timeoutWait,
}: {
  orderCode: string | null;
  /** Delay between polls; injectable for tests. */
  wait?: (ms: number) => Promise<void>;
}) {
  const storeRef = useStoreId();
  // Read in an effect, not a useState initialiser: storage does not exist
  // during the server render, and seeding state from it would make the first
  // client render disagree with the server's.
  const [handoff, setHandoff] = useState<OrderHandoff | null>(null);
  const [handoffLoaded, setHandoffLoaded] = useState(false);
  const [state, setState] = useState<PaymentConfirmationState>(() =>
    resolveInitialState(orderCode, null)
  );
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    const stored = readOrderHandoff(orderCode);
    setHandoff(stored);
    setState(resolveInitialState(orderCode, stored));
    setHandoffLoaded(true);
  }, [orderCode]);

  // A bank transfer order needs the merchant's accounts and transfer
  // instruction, which travel on the public payment-methods endpoint.
  const bankTransfer = useBankTransferDetails(state === "awaiting-transfer");

  useEffect(() => {
    if (!orderCode) return; // no gateway return in play, nothing to poll
    // Until the handoff is read every order looks like "confirming"; an
    // offline one would start a poll with no callback coming.
    if (!handoffLoaded) return;
    if (!shouldPollForConfirmation(state)) return;

    let cancelled = false;
    setIsPolling(true);
    pollPaymentState({
      poll: () => getPaymentState(storeRef, orderCode),
      // Rejecting once unmounted ends the poll loop, not just its result.
      wait: async ms => {
        if (cancelled) throw CANCELLED;
        await wait(ms);
        if (cancelled) throw CANCELLED;
      },
    }).then(
      outcome => {
        if (cancelled) return;
        // "pending" (attempts exhausted, or every attempt errored) is
        // "still-confirming", never "failed": only the API says failed.
        setState(
          outcome.status === "paid"
            ? "paid"
            : outcome.status === "failed"
              ? "failed"
              : "still-confirming"
        );
        setIsPolling(false);
      },
      () => {}
    );

    return () => {
      cancelled = true;
    };
    // state is read once to decide whether to start; re-running on every
    // transition would restart the poll it just resolved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderCode, storeRef, handoffLoaded]);

  return {
    handoff,
    payment: { state, isPolling },
    bankTransfer: { accounts: bankTransfer.accounts, note: bankTransfer.note },
  };
}

/**
 * A guest's order, looked up by its code plus the email or phone it was
 * placed with (the view-order page).
 */
export function useOrderLookup({
  orderCode,
  email,
  phone,
}: {
  orderCode: string | null;
  email?: string | null;
  phone?: string | null;
}) {
  const storeRef = useStoreId();
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = useCallback(async () => {
    if (!orderCode || (!email && !phone)) {
      setError("Thiếu thông tin cần thiết để tra cứu đơn hàng");
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      const found = await createStoreSdk(storeRef).orders.lookupGuest(storeRef, {
        order_code: orderCode,
        customer_email: email || undefined,
        customer_phone: phone || undefined,
      });
      if (!found) {
        setError("Không tìm thấy đơn hàng với thông tin đã cung cấp");
        return;
      }
      setOrder(found);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Error fetching order:", err);
      setError("Có lỗi xảy ra khi tra cứu đơn hàng");
    } finally {
      setIsLoading(false);
    }
  }, [storeRef, orderCode, email, phone]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  return { order, isLoading, error, retry: fetchOrder };
}
