// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, renderHook, waitFor } from "@testing-library/react";
import { useEffect, type ReactNode } from "react";
import { StorefrontKitProvider } from "./provider";
import { useNotify } from "./notices";
import { useStoreData } from "./store/store-context";
import { useCart } from "./cart/server-context";
import {
  currentStorePreviewToken,
  requestStorePreviewRenewal,
  setBrowserStorePreviewToken,
} from "./api/store-preview-header";

const getCart = vi.hoisted(() => vi.fn());
vi.mock("./cart/api", () => ({ cartApiService: { getCart } }));
vi.mock("./auth/context", () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => ({ user: { id: "c1" } }),
}));

describe("StorefrontKitProvider", () => {
  it("provides the store, notices and the signed-in shopper's cart", async () => {
    getCart.mockResolvedValue(null);
    const onNotice = vi.fn();
    const store = { ref: "s1", name: "Demo" } as never;
    const wrapper = ({ children }: { children: ReactNode }) => (
      <StorefrontKitProvider store={store} onNotice={onNotice}>
        {children}
      </StorefrontKitProvider>
    );

    const { result } = renderHook(
      () => ({ store: useStoreData(), notify: useNotify(), cart: useCart() }),
      { wrapper }
    );

    expect(result.current.store.ref).toBe("s1");
    result.current.notify({ kind: "info", title: "hi" });
    expect(onNotice).toHaveBeenCalledWith({ kind: "info", title: "hi" });
    await waitFor(() => expect(getCart).toHaveBeenCalledWith("s1", true));
  });

  it("uses an explicit storeRef for the cart when given", async () => {
    getCart.mockResolvedValue(null);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <StorefrontKitProvider store={{ ref: "s1" } as never} storeRef="custom">
        {children}
      </StorefrontKitProvider>
    );
    renderHook(() => useCart(), { wrapper });
    await waitFor(() => expect(getCart).toHaveBeenCalledWith("custom", true));
  });

  describe("storePreviewToken", () => {
    afterEach(() => setBrowserStorePreviewToken(null));

    const renderWith = (storePreviewToken?: string | null) => {
      getCart.mockResolvedValue(null);
      const seen: Array<Promise<string | null>> = [];
      // A child's effect: the first client fetch runs from one of these.
      const useFetchOnMount = () =>
        useEffect(() => {
          seen.push(currentStorePreviewToken());
        }, []);
      const wrapper = ({ children }: { children: ReactNode }) => (
        <StorefrontKitProvider
          store={{ ref: "s1" } as never}
          storePreviewToken={storePreviewToken}
        >
          {children}
        </StorefrontKitProvider>
      );
      renderHook(useFetchOnMount, { wrapper });
      return seen;
    };

    it("hands the token to the browser client before any child effect runs", async () => {
      const seen = renderWith("tok");
      expect(seen).toHaveLength(1);
      await expect(seen[0]).resolves.toBe("tok");
    });

    it("clears a token an earlier render set when the layout passes none", async () => {
      setBrowserStorePreviewToken("old");
      const seen = renderWith(undefined);
      await expect(seen[0]).resolves.toBeNull();
    });
  });

  describe("onStorePreviewRenew", () => {
    const HALF_HOUR = 30 * 60 * 1000;

    beforeEach(() => {
      vi.useFakeTimers();
      getCart.mockResolvedValue(null);
    });

    afterEach(() => {
      // Unmounts what a test left mounted, so its renewer goes with it.
      cleanup();
      vi.useRealTimers();
      setBrowserStorePreviewToken(null);
    });

    const mount = (storePreviewToken: string | null, renew: () => void) =>
      render(
        <StorefrontKitProvider
          store={{ ref: "s1" } as never}
          storePreviewToken={storePreviewToken}
          onStorePreviewRenew={renew}
        >
          {null}
        </StorefrontKitProvider>
      );

    it("renews a preview-host preview every 30 minutes", () => {
      const renew = vi.fn();
      const view = mount("t", renew);

      vi.advanceTimersByTime(HALF_HOUR - 1);
      expect(renew).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(renew).toHaveBeenCalledOnce();

      view.unmount();
      vi.advanceTimersByTime(HALF_HOUR);
      expect(renew).toHaveBeenCalledOnce();
    });

    it("hands the renewer to the API client while mounted, and takes it back", () => {
      const renew = vi.fn();
      const view = mount("t", renew);

      expect(requestStorePreviewRenewal()).toBe(true);
      expect(renew).toHaveBeenCalledOnce();

      view.unmount();
      expect(requestStorePreviewRenewal()).toBe(false);
    });

    it("keeps its timer when the app passes a new callback, and calls the latest", () => {
      const first = vi.fn();
      const second = vi.fn();
      const view = mount("t", first);

      vi.advanceTimersByTime(HALF_HOUR / 2);
      view.rerender(
        <StorefrontKitProvider
          store={{ ref: "s1" } as never}
          storePreviewToken="t2"
          onStorePreviewRenew={second}
        >
          {null}
        </StorefrontKitProvider>
      );
      vi.advanceTimersByTime(HALF_HOUR / 2);

      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledOnce();
    });

    it("never renews without a token", () => {
      const renew = vi.fn();
      mount(null, renew);

      vi.advanceTimersByTime(2 * HALF_HOUR);
      expect(renew).not.toHaveBeenCalled();
      expect(requestStorePreviewRenewal()).toBe(false);
    });
  });
});
