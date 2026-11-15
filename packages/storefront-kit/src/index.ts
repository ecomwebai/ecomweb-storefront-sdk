// @ecomweb/storefront-kit: client-safe hooks, providers and helpers.
export { StorefrontKitProvider } from "./provider";
export type { StorefrontKitProviderProps } from "./provider";
export { useNotify } from "./notices";
export { useCheckout } from "./checkout/use-checkout";
export { useOrderLookup, useOrderStatus } from "./orders/use-order-status";
export {
  pickBankTransfer,
  shouldShowBankTransferDetails,
  useBankTransferDetails,
} from "./orders/bank-transfer";
export type {
  BankAccountView,
  BankTransferDetails,
} from "./orders/bank-transfer";
export type {
  PlacedOrder,
  PlaceOrderInput,
  PlaceOrderResult,
  UseCheckoutOptions,
} from "./checkout/use-checkout";
export type { Notice, NoticeHandler, NoticeKind } from "./notices";
export {
  useOptionalStoreId,
  useStore,
  useStoreCurrency,
  useStoreData,
  useStoreId,
  useStoreLocale,
} from "./store/store-context";
export { usePublicAuthConfig } from "./auth/use-public-auth-config";
export { publicApiClient } from "./api/client";
export { unwrap, unwrapOrNull } from "./api/response";
export { useAuth } from "./auth/context";
export { errorCopy, errorCopyFor } from "./auth/error-copy";
export {
  getPasswordPolicyHints,
  validatePasswordAgainstPolicy,
} from "./auth/password-policy";
export { DEFAULT_REDIRECT, safeRedirectPath } from "./auth/safe-redirect";
export { useCart } from "./cart/server-context";
export { getPaymentState } from "./checkout/get-payment-state";
export { readOrderHandoff } from "./checkout/order-handoff";
export type {
  OrderHandoff,
  OrderHandoffSummary,
} from "./checkout/order-handoff";
export { pollPaymentState } from "./checkout/payment-state-poll";
export { quoteChangedOptionsFrom } from "./checkout/quote-changed";
export { optionIdOf } from "./shipping/option-id";
export { STOCK_ISSUE_TOAST_DESCRIPTION } from "./checkout/stock-issues";
export {
  resolveInitialState,
  shouldPollForConfirmation,
} from "./checkout/success-state";
export type { PaymentConfirmationState } from "./checkout/success-state";
export type { OrderSuccessInfo } from "./checkout/types";
export {
  formatNumber,
  formatPrice,
  formatPriceRange,
  formatPriceWithoutSymbol,
  getDefaultLocale,
  money,
} from "./currency";
export type { SupportedCurrency } from "./currency";
export {
  ORDER_PROGRESS_STEPS,
  deriveOrderProgress,
} from "./orders/derive-progress";
export { STATUS_OPTIONS } from "./orders/types";
export {
  SHIPMENT_STATUS_LABELS,
  TRACKING_MESSAGES,
  canCustomerCancel,
  deriveShipmentTracking,
  isCarrierShipment,
  isHandedToCarrier,
  shipmentEventLabel,
} from "./orders/shipment-tracking";
export type { ShipmentTrackingView } from "./orders/shipment-tracking";
export { getPromotionDescription } from "./promotions/utils";
export { createStoreSdk, sdk } from "./sdk";
export {
  formatShippingAmount,
  describeShippingOption,
  type ShippingOptionDisplay,
} from "./shipping/format-shipping-option";
export {
  loadWards,
  searchTextFor,
  useProvinces,
  useWards,
} from "./shipping/location-areas";
export { SHIPPING_MESSAGES, formatShippingEstimate } from "./shipping/messages";
export {
  findProvinceByCodeOrName,
  findWardByCodeOrName,
} from "./shipping/utils";
export {
  resolveAssetSrc,
  resolveTransformedImageUrl,
  resolveTransformedProductImageUrl,
  resolveTransformedStoreLogoUrl,
} from "./storage";
export { resolveStoreRef, storeApiPath, storePath } from "./store-scope";
export { buildStoreUrl } from "./store-scope/store-url";
export { readBasicSettings, resolveLegalHref } from "./stores/basic-settings";
export { defineSchema, defineTheme } from "./theme/define";
export type {
  AnyThemeDefinition,
  BlogIndexSlotProps,
  BlogPostSlotProps,
  CollectionPageSlotProps,
  CollectionSearchParams,
  ContentPageSlotProps,
  NotFoundProps,
  ProductCardProps,
  ProductPageSlotProps,
  ThemeClientComponents,
  HomePageSlotProps,
  LayoutSlotProps,
  ThemeComponents,
  ThemeDefinition,
  ThemeInfo,
  ThemeSlot,
  ThemeSlotName,
  ThemeSlotProps,
} from "./theme/define";
export {
  ThemeSettingsProvider,
  useOptionalThemeId,
  useOptionalThemeKey,
  useThemeId,
  useThemeSettings,
} from "./theme/settings-context";
export { metafield, metaobjectField } from "./metafields/readers";
export { getMetaobject, getMetaobjects } from "./metafields/metaobjects";
export { RichText } from "./metafields/rich-text";
export type { RichTextProps } from "./metafields/rich-text";
export { ThemeStyle, themeStyleCss } from "./theme/style";
export {
  THEME_PREVIEW_FRAME_ATTR,
  THEME_PREVIEW_MESSAGE,
  ThemePreviewBridge,
} from "./theme/preview-bridge";
export { getCachedStore } from "./stores/cached";
export {
  COMING_SOON_STORE_DESCRIPTION,
  comingSoonStoreMetadata,
  SUSPENDED_STORE_METADATA,
  withSuspendedStoreMetadataFallback,
} from "./stores/metadata";
export { refFromPathname } from "./stores/store-path";
export { STORE_PREVIEW_READ_ONLY_MESSAGE } from "./stores/store-preview-guard";
export { isStoreSuspendedError } from "./stores/store-suspension";
export {
  comingSoonStoreNameOf,
  isStoreComingSoonError,
  STORE_COMING_SOON_REDIRECT_PATH,
} from "./stores/store-coming-soon";
export { applyConsoleFilter, getLogLevel, shouldLog } from "./logging";
