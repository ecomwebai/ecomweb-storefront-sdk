/**
 * The EcomWeb storefront SDK: a typed client for a store's public API.
 *
 * Three factories build it. {@link createEcomwebSdk} reads the catalog and
 * content with a publishable key, for example
 * `sdk.products.getBySlug(storeRef, slug)`. {@link createEcomwebServerSdk}
 * adds carts, orders, payments and customers using a storefront secret key, on
 * a server. {@link createEcomwebProxiedSdk} gives browser code the same shape
 * by sending private calls to a same-origin proxy. The package
 * also exports the schema and DTO types the API uses, the image URL helpers,
 * and {@link ApiClientError}, which the client methods throw when the API
 * answers with an error.
 *
 * @packageDocumentation
 */

// Core
export type {
  IHttpClient,
  ApiResponse,
  ApiError,
  RequestOptions,
} from "./core/types";
export {
  CLIENT_HEADER,
  SDK_CLIENT_TOKEN,
  SDK_VERSION,
  clientHeaderValue,
  withClientHeader,
} from "./core/client-info";
export {
  ApiClientError,
  unwrap,
  unwrapOrNull,
  ensureSuccess,
} from "./core/response";

// Schema and contract types
export * from "./types";

// Storage — URL helpers only. Objects are uploaded through the API's asset
// endpoints; there is no storage client here and no Supabase dependency.
export {
  assetBaseUrl,
  buildTransformQuery,
  parseStorageUrl,
  resolveAssetUrl,
  toObjectUrl,
  toRenderUrl,
  fromObjectPublicUrlToRender,
  rewriteSupabaseUrl,
  transformationsEnabled,
  OBJECT_PREFIX,
  RENDER_PREFIX,
  DEFAULT_BUCKET,
} from "./modules/storage/image-transform";
export type {
  ImageTransformOptions,
  ResizeMode,
  ImageFormat,
} from "./modules/storage/types";

// Modules — API classes
export { ProductsApi } from "./modules/products/api";
export { CollectionsApi } from "./modules/collections/api";
export { CategoriesApi } from "./modules/categories/api";
export { CartApi } from "./modules/cart/api";
export { OrdersApi } from "./modules/orders/api";
export { BlogApi, BlogServerApi } from "./modules/blog/api";
export { StoresApi } from "./modules/stores/api";
export { ThemesApi } from "./modules/themes/api";
export { MetaobjectsApi } from "./modules/metaobjects/api";
export { SearchApi } from "./modules/search/api";
export { ShippingApi, ShippingServerApi } from "./modules/shipping/api";
export { PromotionsApi, PromotionsServerApi } from "./modules/promotions/api";
export { PaymentMethodsApi } from "./modules/payment-methods/api";
export { PaymentsApi } from "./modules/payments/api";
export { ReviewsApi, ReviewsServerApi } from "./modules/reviews/api";
export { CustomersApi } from "./modules/customers/api";
export { AddressesApi } from "./modules/addresses/api";
export { ContentPagesApi } from "./modules/content-pages/api";
export { MenusApi } from "./modules/menus/api";
export { RedirectsApi } from "./modules/redirects/api";
export { AuthApi } from "./modules/auth/api";
export { MemoryTokenStorage } from "./modules/auth/token-storage";
export { createAuthAwareHttpClient } from "./modules/auth/refresh-client";

// Modules — Types
export type {
  ProductDetail,
  ProductQueryParams,
  ProductService,
  PromotionData,
  WithSeoMetadata,
  SeoMetadata,
  Product,
  ProductWithVariants,
  ProductVariant,
  VariantOption,
  VariantOptionValue,
  ProductImage,
  ProductVideo,
} from "./modules/products/types";

export type {
  Collection,
  CollectionQueryParams,
  CollectionSearchCriteria,
} from "./modules/collections/types";

// Smart collection rule vocabulary — the shared field/operator contract.
export type {
  RuleField,
  RuleOperator,
  RuleValueKind,
  RuleOperatorSpec,
  RuleFieldSpec,
  CollectionRule,
  CollectionRuleSet,
  CollectionRuleSetCriteria,
} from "./modules/collections/rule-set";
export {
  COLLECTION_RULE_MATRIX,
  RULE_FIELDS,
  MAX_RULES_PER_SET,
  MAX_RULE_VALUE_ENTRIES,
  isRuleField,
  operatorsForField,
  valueKindFor,
  allowedValuesFor,
} from "./modules/collections/rule-set";

export type { Category, CategoryQueryParams } from "./modules/categories/types";

export type {
  CartApiItem,
  CartApiResponse,
  AddToCartRequest,
  UpdateCartItemRequest,
} from "./modules/cart/types";

export type {
  Order,
  OrderItem,
  OrderWithItems,
  CreateOrderRequest,
  CreateOrderItemRequest,
  CustomerOrderFilter,
  GuestOrderLookupParams,
  PaymentMethod as OrderPaymentMethod,
} from "./modules/orders/types";

export type {
  BlogPost,
  BlogCategory,
  BlogTag,
  BlogPostStatus,
  BlogSettings,
  BlogPostQueryParams,
  BlogCategoryQueryParams,
  BlogTagQueryParams,
} from "./modules/blog/types";

export type {
  Store,
  StoreConfig,
  StoreSettings,
  StoreConfigurationInfo,
  StoreByDomainInfo,
  PublishedStoreTheme,
  StoreStatus,
} from "./modules/stores/types";

export type {
  ProductSearchParams,
  AutocompleteParams,
  SearchProduct,
  SearchCategory,
  ProductSearchResponse,
  CategorySearchResponse,
  BlogSearchParams,
  BlogSearchResponse,
} from "./modules/search/types";

export type {
  LocationArea,
  LocationAreaQuery,
  LocationAreasResponse,
  ShippingCalculationRequest,
  ShippingDeliveryType,
  ShippingRateType,
  ShippingConditionType,
  ShippingZone,
  ShippingRate,
  ShippingOption,
  ShippingQuoteChangedDetails,
} from "./modules/shipping/types";
export {
  SHIPPING_DELIVERY_TYPES,
  SHIPPING_RATE_TYPES,
  SHIPPING_CONDITION_TYPES,
  SHIPPING_ERROR_CODES,
  LEVEL_PROVINCE,
  LEVEL_WARD,
} from "./modules/shipping/types";

export type {
  ValidatePromotionCodeRequest,
  ValidatePromotionCodeResponse,
  PromotionSuggestion,
  PromotionSuggestionsResponse,
} from "./modules/promotions/types";

export type {
  PaymentMethod as StorePaymentMethod,
  BankAccount,
} from "./modules/payment-methods/types";

export type {
  InitiatePaymentResult,
  PaymentStateResult,
  PaymentCredentialStatus,
} from "./modules/payments/types";

export type {
  ProductReview,
  ProductReviewWithReplies,
  ProductReviewFilters,
  PaginatedReviewsResponse,
  ReviewInvitationPublicData,
  SubmitReviewInvitationPayload,
  OrderReviewInvitationSummary,
  BatchOrderReviewInvitationsResult,
} from "./modules/reviews/types";

export type {
  Customer,
  UpsertCustomerForAuthPayload,
} from "./modules/customers/types";

export type {
  Address,
  CreateAddressDto,
  UpdateAddressDto,
} from "./modules/addresses/types";

export type { ContentPage } from "./modules/content-pages/types";

export type { StoreMenu, StoreMenuItem } from "./modules/menus/types";

export type {
  MetaobjectListParams,
  MetaobjectListResult,
} from "./modules/metaobjects/types";

export type { UrlRedirect } from "./modules/redirects/types";

export type {
  AuthResult,
  AuthIdentity,
  AuthTokens,
  CurrentIdentity,
  PasswordPolicy,
  PublicAuthConfig,
  GoogleAuthUrl,
  RegisterPayload,
  RegisterResult,
  LoginPayload,
  ChangePasswordPayload,
  ChangeEmailPayload,
  ChangeEmailResult,
  ResetPasswordPayload,
  VerifyOtpPayload,
  SentResult,
  VerifiedResult,
  ResetResult,
  ChangedResult,
  AuthErrorCode,
} from "./modules/auth/types";
export type { TokenStorage } from "./modules/auth/token-storage";

// SDK factories
export { createEcomwebSdk, createEcomwebServerSdk, createEcomwebProxiedSdk } from "./factory";
export type {
  EcomwebSdkOptions,
  EcomwebServerSdkOptions,
  EcomwebProxiedSdkOptions,
  EcomwebSdk,
  EcomwebServerSdk,
} from "./factory";
