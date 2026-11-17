import { stringify } from "../../core/stringify";
import type { IHttpClient } from "../../core/types";
import { unwrap } from "../../core/response";
import type {
  PaginatedReviewsResponse,
  ProductReviewFilters,
  ReviewInvitationPublicData,
  SubmitReviewInvitationPayload,
  OrderReviewInvitationSummary,
  BatchOrderReviewInvitationsResult,
} from "./types";

/**
 * Product reviews and the invitations that ask customers to write them, reached through `sdk.reviews`.
 */
export class ReviewsApi {
  constructor(private http: IHttpClient) {}

  /**
   * Lists the published reviews of a product.
   *
   * @param storeRef - the store's ref or handle
   * @param productId - the product id
   * @param query - filters and paging
   * @returns A page of reviews; throws {@link ApiClientError} when the API answers with an error
   */
  async getProductReviews(
    storeRef: string,
    productId: string | number,
    query?: Omit<ProductReviewFilters, "product_id">
  ): Promise<PaginatedReviewsResponse> {
    const queryString = stringify(query ?? {});
    const res = await this.http.get<PaginatedReviewsResponse>(
      `public/stores/${storeRef}/products/${productId}/reviews${queryString ? `?${queryString}` : ""}`
    );
    return unwrap(res);
  }

  /**
   * Gets the public details behind a review invitation link.
   *
   * @param storeRef - the store's ref or handle
   * @param token - the token from the invitation link
   * @returns The invitation details; throws {@link ApiClientError} when the API answers with an error
   */
  async getReviewInvitation(
    storeRef: string,
    token: string
  ): Promise<ReviewInvitationPublicData> {
    const res = await this.http.get<ReviewInvitationPublicData>(
      `public/stores/${storeRef}/review-invitations/${token}`
    );
    return unwrap(res);
  }

  /**
   * Lists the review invitations for one order.
   *
   * @param storeRef - the store's ref or handle
   * @param orderNumber - the order number
   * @param email - the email address on the order
   * @returns The invitation summaries; throws {@link ApiClientError} when the API answers with an error
   */
  async getOrderReviewInvitations(
    storeRef: string,
    orderNumber: number | string,
    email: string
  ): Promise<OrderReviewInvitationSummary[]> {
    const queryString = stringify({ order_number: orderNumber, email });
    const res = await this.http.get<OrderReviewInvitationSummary[]>(
      `public/stores/${storeRef}/review-invitations/by-order?${queryString}`
    );
    return unwrap(res);
  }

  /**
   * Lists the review invitations for several orders at once.
   *
   * @param storeRef - the store's ref or handle
   * @param orderNumbers - the order numbers
   * @param email - the email address on the orders
   * @returns The invitations grouped by order; throws {@link ApiClientError} when the API answers with an error
   */
  async getBatchOrderReviewInvitations(
    storeRef: string,
    orderNumbers: (number | string)[],
    email: string
  ): Promise<BatchOrderReviewInvitationsResult> {
    const queryString = stringify({ order_numbers: orderNumbers.join(","), email });
    const res = await this.http.get<BatchOrderReviewInvitationsResult>(
      `public/stores/${storeRef}/review-invitations/by-orders?${queryString}`
    );
    return unwrap(res);
  }

  /**
   * Submits a review through an invitation link.
   *
   * @param storeRef - the store's ref or handle
   * @param token - the token from the invitation link
   * @param payload - the rating and review text
   * @returns The API's answer; throws {@link ApiClientError} when the API answers with an error
   */
  async submitReviewInvitation(
    storeRef: string,
    token: string,
    payload: SubmitReviewInvitationPayload
  ): Promise<any> {
    const res = await this.http.post(
      `public/stores/${storeRef}/review-invitations/${token}/submit`,
      payload
    );
    return unwrap(res);
  }
}
