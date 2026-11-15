"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { StoreConfigurationInfo } from "@ecomweb/sdk";
import { AuthProvider, useAuth } from "./auth/context";
import { CartProvider } from "./cart/server-context";
import { NoticeProvider, type NoticeHandler } from "./notices";
import { StoreProvider } from "./store/store-context";
import {
  setBrowserStorePreviewToken,
  setStorePreviewRenewer,
} from "./api/store-preview-header";

/**
 * How often a preview host's preview token is renewed: half of its 1 h, so
 * a long editor session never sends an expired one.
 */
const STORE_PREVIEW_RENEW_MS = 30 * 60 * 1000;

export interface StorefrontKitProviderProps {
  store: StoreConfigurationInfo;
  /** The ref the cart is scoped to; defaults to `store.ref`. */
  storeRef?: string;
  /** Receives the kit's notices (item added, request failed, …). */
  onNotice?: NoticeHandler;
  /**
   * The store preview token the browser's kit clients send as
   * `X-Store-Preview` (`readStorePreviewToken()` on the server). The layout
   * passes it only while the store is coming soon, else null.
   *
   * Why the browser gets it: the preview cookie stays httpOnly, but without
   * the token the client-side fetches on the home, collection and product
   * pages would get the API's 403 during a preview. It is one of three
   * tokens: the store preview cookie's (the dashboard's preview link), a
   * theme preview host's (`p-<slug>`, from the host lookup), or the theme
   * preview cookie's (`?preview_theme=` on the store's own host). Each is
   * read-only (the API opens GET and HEAD only) and bound to one store.
   * Merchant scripts are off during a store preview, so they never see it.
   */
  storePreviewToken?: string | null;
  /**
   * Fetches a fresh `storePreviewToken`, such as by re-rendering the layout.
   * The app passes it only on a theme preview host, whose token lasts 1 h:
   * the layout does not re-render on client navigation, so the first
   * render's token would run out in a long editor session. While both are
   * set, the kit calls it every 30 minutes, and when a read is refused with
   * `STORE_COMING_SOON` (at most once a minute). A link preview's 24 h
   * cookie is not renewed.
   */
  onStorePreviewRenew?: () => void;
  children: ReactNode;
}

function IdentityCart({
  storeRef,
  children,
}: {
  storeRef: string;
  children: ReactNode;
}) {
  const { user } = useAuth();
  return (
    <CartProvider storeRef={storeRef} userId={user?.id}>
      {children}
    </CartProvider>
  );
}

/**
 * The kit's providers in their required order: auth reads the store, and the
 * cart reads the signed-in identity from auth.
 */
export function StorefrontKitProvider({
  store,
  storeRef,
  onNotice,
  storePreviewToken,
  onStorePreviewRenew,
  children,
}: StorefrontKitProviderProps) {
  // In the render body, not an effect: React renders this before any child
  // effect runs, so the first client fetch already carries the token. A
  // render without one clears it; until then it stays set (store-preview-
  // header.ts). A no-op on the server.
  setBrowserStorePreviewToken(storePreviewToken ?? null);

  // The latest callback, so an app that passes a new function on every
  // render does not restart the 30 minute timer each time.
  const renewRef = useRef(onStorePreviewRenew);
  renewRef.current = onStorePreviewRenew;
  const renews = !!storePreviewToken && !!onStorePreviewRenew;
  useEffect(() => {
    if (!renews) return;
    const renew = () => renewRef.current?.();
    setStorePreviewRenewer(renew);
    const timer = setInterval(renew, STORE_PREVIEW_RENEW_MS);
    return () => {
      clearInterval(timer);
      setStorePreviewRenewer(null);
    };
  }, [renews]);

  return (
    <StoreProvider store={store}>
      <NoticeProvider onNotice={onNotice}>
        <AuthProvider>
          <IdentityCart storeRef={storeRef ?? store.ref}>
            {children}
          </IdentityCart>
        </AuthProvider>
      </NoticeProvider>
    </StoreProvider>
  );
}
