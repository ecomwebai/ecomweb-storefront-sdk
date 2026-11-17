import type { IHttpClient } from "./core/types";
import { withClientHeader } from "./core/client-info";
import { withStorefrontKey } from "./core/storefront-key";
import { ProductsApi } from "./modules/products/api";
import { CollectionsApi } from "./modules/collections/api";
import { CategoriesApi } from "./modules/categories/api";
import { CartApi } from "./modules/cart/api";
import { OrdersApi } from "./modules/orders/api";
import { BlogApi, BlogServerApi } from "./modules/blog/api";
import { StoresApi } from "./modules/stores/api";
import { ThemesApi } from "./modules/themes/api";
import { MetaobjectsApi } from "./modules/metaobjects/api";
import { SearchApi } from "./modules/search/api";
import { ShippingApi, ShippingServerApi } from "./modules/shipping/api";
import { PromotionsApi, PromotionsServerApi } from "./modules/promotions/api";
import { PaymentMethodsApi } from "./modules/payment-methods/api";
import { PaymentsApi } from "./modules/payments/api";
import { ReviewsApi, ReviewsServerApi } from "./modules/reviews/api";
import { CustomersApi } from "./modules/customers/api";
import { AddressesApi } from "./modules/addresses/api";
import { ContentPagesApi } from "./modules/content-pages/api";
import { MenusApi } from "./modules/menus/api";
import { RedirectsApi } from "./modules/redirects/api";

/** What {@link createEcomwebSdk} needs: the two HTTP clients, and optional client info. */
export interface EcomwebSdkOptions {
  /**
   * Client for the public API routes and the calls that need no shopper
   * session. {@link createEcomwebSdk} sends it as is (with a publishable key);
   * {@link createEcomwebServerSdk} adds the secret key to it.
   */
  publicHttp: IHttpClient;
  /** Client for the routes that need the signed-in customer's credentials. */
  authHttp: IHttpClient;
  /**
   * Tokens put before this SDK's own in the `X-Ecomweb-Client` header
   * (space-separated `name/version`, e.g. `@ecomweb/storefront-kit/0.14.0`).
   */
  clientInfo?: string;
}

/** What {@link createEcomwebServerSdk} needs: the public options plus the storefront secret key. */
export type EcomwebServerSdkOptions = EcomwebSdkOptions & {
  /** The store's storefront secret key (`sk_storefront_...`). Server only; never ship it to a browser. */
  secretKey: string;
};

/** What {@link createEcomwebProxiedSdk} needs: a direct client for public routes and one that reaches a same-origin proxy. */
export interface EcomwebProxiedSdkOptions {
  /** Client for the public API routes, called directly with the publishable key. */
  publicHttp: IHttpClient;
  /** Client that sends private calls to a same-origin proxy, which holds the secret key. */
  proxyHttp: IHttpClient;
  /**
   * Tokens put before this SDK's own in the `X-Ecomweb-Client` header
   * (space-separated `name/version`).
   */
  clientInfo?: string;
}

/** The public SDK: catalog and content reads, safe with a publishable key. */
export interface EcomwebSdk {
  /** Products. */
  products: ProductsApi;
  /** Collections. */
  collections: CollectionsApi;
  /** Categories. */
  categories: CategoriesApi;
  /** Published blog posts, categories, tags and comments. */
  blog: BlogApi;
  /** Stores. */
  stores: StoresApi;
  /** Themes. */
  themes: ThemesApi;
  /** Metaobject entries. */
  metaobjects: MetaobjectsApi;
  /** Search. */
  search: SearchApi;
  /** Shipping locations. */
  shipping: ShippingApi;
  /** Promotion suggestions. */
  promotions: PromotionsApi;
  /** Payment methods a store accepts. */
  paymentMethods: PaymentMethodsApi;
  /** Product reviews (reads). */
  reviews: ReviewsApi;
  /** Content pages. */
  contentPages: ContentPagesApi;
  /** Menus. */
  menus: MenusApi;
  /** URL redirects. */
  redirects: RedirectsApi;
}

/** The server SDK: everything on {@link EcomwebSdk} plus the private modules. */
export interface EcomwebServerSdk
  extends Omit<EcomwebSdk, "blog" | "reviews" | "shipping" | "promotions"> {
  /** Blog, with comment submission. */
  blog: BlogServerApi;
  /** Reviews, with submission and invitations. */
  reviews: ReviewsServerApi;
  /** Shipping, with rate calculation. */
  shipping: ShippingServerApi;
  /** Promotions, with code validation. */
  promotions: PromotionsServerApi;
  /** Carts. */
  cart: CartApi;
  /** Orders. */
  orders: OrdersApi;
  /** Payments. */
  payments: PaymentsApi;
  /** Customers. */
  customers: CustomersApi;
  /** Customer addresses. */
  addresses: AddressesApi;
}

interface Clients {
  publicHttp: IHttpClient;
  privateHttp: IHttpClient;
  shopperHttp: IHttpClient;
}

function buildAllModules({
  publicHttp,
  privateHttp,
  shopperHttp,
}: Clients): EcomwebServerSdk {
  return {
    products: new ProductsApi(publicHttp),
    collections: new CollectionsApi(publicHttp),
    categories: new CategoriesApi(publicHttp),
    blog: new BlogServerApi(publicHttp, shopperHttp),
    stores: new StoresApi(publicHttp),
    themes: new ThemesApi(publicHttp),
    metaobjects: new MetaobjectsApi(publicHttp, shopperHttp),
    search: new SearchApi(publicHttp),
    shipping: new ShippingServerApi(publicHttp, privateHttp),
    promotions: new PromotionsServerApi(publicHttp, privateHttp),
    paymentMethods: new PaymentMethodsApi(publicHttp),
    reviews: new ReviewsServerApi(publicHttp, privateHttp),
    contentPages: new ContentPagesApi(publicHttp),
    menus: new MenusApi(publicHttp),
    redirects: new RedirectsApi(publicHttp),
    cart: new CartApi(privateHttp, shopperHttp),
    orders: new OrdersApi(privateHttp, shopperHttp),
    payments: new PaymentsApi(privateHttp),
    customers: new CustomersApi(shopperHttp),
    addresses: new AddressesApi(shopperHttp),
  };
}

/**
 * Creates the public SDK. It reads the catalog and content only (products,
 * collections, categories, blog, stores, themes, search and so on) and is safe
 * to use in a browser with a publishable key. For carts, orders, payments,
 * customers and the private methods of other modules, use
 * {@link createEcomwebServerSdk} on a server or {@link createEcomwebProxiedSdk}
 * in a browser.
 *
 * @example
 * ```ts
 * const sdk = createEcomwebSdk({ publicHttp, authHttp });
 * const product = await sdk.products.getBySlug("my-store", "blue-shirt");
 * ```
 *
 * @param options - the HTTP clients, and optional client info for the `X-Ecomweb-Client` header
 * @returns An object with one API class per public resource
 */
export function createEcomwebSdk(options: EcomwebSdkOptions): EcomwebSdk {
  const publicHttp = withClientHeader(options.publicHttp, options.clientInfo);
  const shopperHttp = withClientHeader(options.authHttp, options.clientInfo);
  const all = buildAllModules({ publicHttp, privateHttp: publicHttp, shopperHttp });
  return {
    products: all.products,
    collections: all.collections,
    categories: all.categories,
    blog: new BlogApi(publicHttp, shopperHttp),
    stores: all.stores,
    themes: all.themes,
    metaobjects: all.metaobjects,
    search: all.search,
    shipping: new ShippingApi(publicHttp),
    promotions: new PromotionsApi(publicHttp),
    paymentMethods: all.paymentMethods,
    reviews: new ReviewsApi(publicHttp),
    contentPages: all.contentPages,
    menus: all.menus,
    redirects: all.redirects,
  };
}

/**
 * Creates the server SDK: the public modules plus carts, orders, payments,
 * customers, addresses and the private methods of blog, reviews, shipping and
 * promotions. Every request carries the secret in `x-storefront-api-key`, and
 * a key header set by the caller is overridden. Run it on a server only.
 *
 * @example
 * ```ts
 * const sdk = createEcomwebServerSdk({
 *   publicHttp,
 *   authHttp,
 *   secretKey: process.env.ECOMWEB_SECRET_KEY!,
 * });
 * const cart = await sdk.cart.getCart("my-store", sessionId, false);
 * ```
 *
 * @param options - the HTTP clients, the storefront secret key, and optional client info
 * @returns The public modules and the private ones
 * @throws Error when `secretKey` is blank or is a publishable key (`pk_...`), or when called in a browser; the message never includes the key
 */
export function createEcomwebServerSdk(
  options: EcomwebServerSdkOptions
): EcomwebServerSdk {
  const secretKey = options.secretKey?.trim() ?? "";
  if (!secretKey) {
    throw new Error("createEcomwebServerSdk: secretKey is required");
  }
  if (secretKey.startsWith("pk_")) {
    throw new Error(
      "createEcomwebServerSdk: secretKey is a publishable key; pass the secret key (sk_...)"
    );
  }
  if (typeof window !== "undefined") {
    throw new Error(
      "createEcomwebServerSdk runs on a server only; in the browser use createEcomwebProxiedSdk"
    );
  }
  const publicHttp = withClientHeader(
    withStorefrontKey(options.publicHttp, secretKey),
    options.clientInfo
  );
  const shopperHttp = withClientHeader(
    withStorefrontKey(options.authHttp, secretKey),
    options.clientInfo
  );
  return buildAllModules({ publicHttp, privateHttp: publicHttp, shopperHttp });
}

/**
 * Creates the SDK for browser code that needs private modules. Public calls go
 * straight to the API with the publishable key; private ones (cart, orders,
 * payments, customers, addresses and the private methods of other modules) go
 * to `proxyHttp`, a same-origin proxy that holds the secret key. No secret
 * reaches the browser.
 *
 * @example
 * ```ts
 * const sdk = createEcomwebProxiedSdk({ publicHttp, proxyHttp });
 * const cart = await sdk.cart.getCart("my-store", sessionId, false);
 * ```
 *
 * @param options - the direct client, the proxy client, and optional client info
 * @returns The same shape as {@link createEcomwebServerSdk}
 */
export function createEcomwebProxiedSdk(
  options: EcomwebProxiedSdkOptions
): EcomwebServerSdk {
  const publicHttp = withClientHeader(options.publicHttp, options.clientInfo);
  const proxyHttp = withClientHeader(options.proxyHttp, options.clientInfo);
  return buildAllModules({
    publicHttp,
    privateHttp: proxyHttp,
    shopperHttp: proxyHttp,
  });
}
