import { stringify } from "../../core/stringify";
import type { IHttpClient } from "../../core/types";
import { unwrap, unwrapOrNull } from "../../core/response";
import type { PaginatedResponse } from "../../types";
import type {
  BlogPost,
  BlogCategory,
  BlogTag,
  BlogPostQueryParams,
  BlogCategoryQueryParams,
  BlogTagQueryParams,
} from "./types";

/**
 * Published blog posts, categories, tags and comments of a store, reached through `sdk.blog`.
 */
export class BlogApi {
  /** Client for the public routes, sent with the publishable key. */
  protected publicHttp: IHttpClient;
  /** Client for the calls that read the shopper's session (comments), sent with the shopper's bearer. */
  protected authHttp: IHttpClient;

  constructor(publicHttp: IHttpClient, authHttp: IHttpClient) {
    this.publicHttp = publicHttp;
    this.authHttp = authHttp;
  }

  /**
   * Lists published blog posts.
   *
   * @param storeRef - the store's ref or handle
   * @param query - filters, sorting and paging
   * @returns A page of posts; throws {@link ApiClientError} when the API answers with an error
   */
  async getPosts(
    storeRef: string,
    query: Partial<BlogPostQueryParams> = {}
  ): Promise<PaginatedResponse<BlogPost>> {
    const qsStr = stringify(query);
    const res = await this.publicHttp.get<PaginatedResponse<BlogPost>>(
      `/storefront/stores/${storeRef}/blog/posts${qsStr ? "?" + qsStr : ""}`
    );
    return unwrap(res);
  }

  /**
   * Gets one published blog post by its slug.
   *
   * @param storeRef - the store's ref or handle
   * @param slug - the post slug
   * @param options - `incrementView` counts a view; `include_seo_metadata` and `include_products` add those fields
   * @returns The post, or `null` when it is not found; throws {@link ApiClientError} on any other API error
   */
  async getPostBySlug(
    storeRef: string,
    slug: string,
    options: {
      incrementView?: boolean;
      include_seo_metadata?: boolean;
      include_products?: boolean;
    } = {}
  ): Promise<BlogPost | null> {
    const query = stringify({
      increment_view: options.incrementView,
      include_seo_metadata: options.include_seo_metadata,
      include_products: options.include_products,
    });
    const res = await this.publicHttp.get<BlogPost>(
      `/storefront/stores/${storeRef}/blog/posts/slug/${encodeURIComponent(slug)}${query ? `?${query}` : ""}`
    );
    return unwrapOrNull(res);
  }

  /**
   * Lists blog categories.
   *
   * @param storeRef - the store's ref or handle
   * @param query - filters and paging
   * @returns A page of categories; throws {@link ApiClientError} when the API answers with an error
   */
  async getCategories(
    storeRef: string,
    query: BlogCategoryQueryParams = {}
  ): Promise<PaginatedResponse<BlogCategory>> {
    const qsStr = stringify(query);
    const res = await this.publicHttp.get<PaginatedResponse<BlogCategory>>(
      `/storefront/stores/${storeRef}/blog/categories${qsStr ? "?" + qsStr : ""}`
    );
    return unwrap(res);
  }

  /**
   * Lists blog tags.
   *
   * @param storeRef - the store's ref or handle
   * @param query - filters and paging
   * @returns A page of tags; throws {@link ApiClientError} when the API answers with an error
   */
  async getTags(
    storeRef: string,
    query: BlogTagQueryParams = {}
  ): Promise<PaginatedResponse<BlogTag>> {
    const qsStr = stringify(query);
    const res = await this.publicHttp.get<PaginatedResponse<BlogTag>>(
      `/storefront/stores/${storeRef}/blog/tags${qsStr ? "?" + qsStr : ""}`
    );
    return unwrap(res);
  }

  /**
   * Lists the approved comments of a post, as an anonymous visitor.
   *
   * @param storeRef - the store's ref or handle
   * @param postId - the post id
   * @returns The comments; throws {@link ApiClientError} when the API answers with an error
   */
  async getPostComments(storeRef: string, postId: number): Promise<any[]> {
    const res = await this.publicHttp.get<any[]>(
      `/storefront/stores/${storeRef}/blog/posts/${postId}/comments`
    );
    return unwrap(res);
  }

  /**
   * Lists the approved comments of a post, sending the signed-in customer's credentials.
   *
   * @param storeRef - the store's ref or handle
   * @param postId - the post id
   * @returns The comments; throws {@link ApiClientError} when the API answers with an error
   */
  async getPostCommentsAuth(storeRef: string, postId: number): Promise<any[]> {
    const res = await this.authHttp.get<any[]>(
      `/storefront/stores/${storeRef}/blog/posts/${postId}/comments`
    );
    return unwrap(res);
  }
}

/**
 * Blog comment submission, reached through `sdk.blog` on the server and proxied SDKs.
 *
 * Needs a storefront secret key: available on `createEcomwebServerSdk` and `createEcomwebProxiedSdk`, never on `createEcomwebSdk`.
 */
export class BlogServerApi extends BlogApi {

  /**
   * Submits a comment on a post, as the signed-in customer. It may wait for moderation.
   *
   * @param storeRef - the store's ref or handle
   * @param postId - the post id
   * @param data - the author name, the text, and optionally a website and the parent comment id
   * @returns The created comment; throws {@link ApiClientError} when the API answers with an error
   */
  async submitComment(
    storeRef: string,
    postId: number,
    data: {
      author_name: string;
      content: string;
      author_website?: string;
      parent_comment_id?: number;
    }
  ): Promise<any> {
    const res = await this.authHttp.post<any>(
      `/storefront/stores/${storeRef}/blog/posts/${postId}/comments`,
      data
    );
    return unwrap(res);
  }
}
