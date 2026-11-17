import { createStoreSdk } from "../sdk";

export interface InitiatePaymentResult {
  payment_id: number;
  redirect_url: string;
}

export async function initiateGatewayPayment(
  storeRef: string,
  input: { order_code: string; provider_code: string }
): Promise<InitiatePaymentResult> {
  return createStoreSdk(storeRef).payments.initiate(storeRef, {
    order_code: input.order_code,
    provider_code: input.provider_code,
  });
}
