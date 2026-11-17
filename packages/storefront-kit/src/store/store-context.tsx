"use client";

import type { StoreConfigurationInfo } from "@ecomweb/sdk";
import { createContext, useContext, ReactNode } from "react";

import {
  SupportedCurrency,
  getDefaultLocale,
  isSupportedCurrency,
} from "../currency";

interface StoreContextData {
  store: StoreConfigurationInfo;
}

interface StoreProviderProps {
  children: ReactNode;
  store: StoreConfigurationInfo;
}

const StoreContext = createContext<StoreContextData | undefined>(undefined);

export function StoreProvider({ children, store }: StoreProviderProps) {
  const value: StoreContextData = {
    store,
  };

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

/**
 * The store this page belongs to, as `{ store }`.
 *
 * Must run under {@link StorefrontKitProvider} (or the kit's store provider).
 *
 * @returns The store context.
 * @throws When used outside the provider.
 */
export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error("useStore must be used within a StoreProvider");
  }
  return context;
}

// Export specific hooks for convenience
/**
 * The store's configuration: ref, name, settings and config. Same as
 * `useStore().store`.
 *
 * Must run under {@link StorefrontKitProvider}.
 *
 * @returns The store configuration.
 * @throws When used outside the provider.
 */
export function useStoreData() {
  const { store } = useStore();
  return store;
}

/** The store ref, or null outside a StoreProvider (e.g. a store-level 404). */
export function useOptionalStoreId(): string | null {
  return useContext(StoreContext)?.store.ref ?? null;
}

/**
 * The store's ref.
 *
 * Must run under {@link StorefrontKitProvider}.
 *
 * @returns The store ref.
 * @throws When used outside the provider.
 */
export function useStoreId() {
  const { store } = useStore();
  return store.ref;
}

export function useStoreSettings() {
  const { store } = useStore();
  return store.settings;
}

export function useStoreConfig() {
  const { store } = useStore();
  return store.config;
}

export function useBlogSettings() {
  const { store } = useStore();

  // Blog settings live in store settings.
  return {
    blogEnabled: store.settings?.is_blog_enabled ?? false,
    blogTitle: store.settings?.blog_title ?? "Blog",
  };
}

/**
 * The store's currency code, `VND` when the store sets none or one the kit
 * does not support.
 *
 * Must run under {@link StorefrontKitProvider}.
 *
 * @returns The currency code.
 * @throws When used outside the provider.
 */
export function useStoreCurrency(): SupportedCurrency {
  const { store } = useStore();
  const currencyCode = store.settings?.currency_code;

  // Default to VND for anything we cannot price in.
  if (!currencyCode || !isSupportedCurrency(currencyCode)) {
    return "VND";
  }

  return currencyCode;
}

/**
 * The locale to format prices and numbers in for this store, from its
 * currency.
 *
 * Must run under {@link StorefrontKitProvider}.
 *
 * @returns A BCP 47 locale tag.
 * @throws When used outside the provider.
 */
export function useStoreLocale(): string {
  const currency = useStoreCurrency();
  return getDefaultLocale(currency);
}
