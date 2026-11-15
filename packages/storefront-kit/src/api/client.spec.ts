import { inspect } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";
import { ApiClient } from "./client";
import {
  setBrowserStorePreviewToken,
  setStorePreviewRenewer,
} from "./store-preview-header";
import { SKIP_STORE_PREVIEW } from "../stores/store-preview-cookie";

// The server reads the request's token through `next/headers`.
const nextHeaders = vi.hoisted(() => ({
  cookies: vi.fn(),
  headers: vi.fn(),
}));
vi.mock("next/headers", () => nextHeaders);

const jar = (values: Record<string, string>) => ({
  get: (name: string) =>
    name in values ? { value: values[name]! } : undefined,
});

describe("ApiClient — X-Store-Preview", () => {
  let client: ApiClient;
  const sent: InternalAxiosRequestConfig[] = [];
  const previewHeader = () => sent[0]!.headers.get("x-store-preview");

  // Answers every request with `fail` when set, else a 200.
  let fail: ((config: InternalAxiosRequestConfig) => AxiosError) | null;

  beforeEach(() => {
    sent.length = 0;
    fail = null;
    nextHeaders.cookies
      .mockReset()
      .mockResolvedValue(jar({ ecw_store_preview: "srv" }));
    nextHeaders.headers.mockReset().mockResolvedValue(new Headers());
    client = new ApiClient("http://api.test");
    client.getAxiosInstance().defaults.adapter = async config => {
      sent.push(config);
      if (fail) throw fail(config);
      return { data: {}, status: 200, statusText: "OK", headers: {}, config };
    };
    // The response interceptor logs every failure.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("on the server", () => {
    it("sends the request's preview cookie as x-store-preview on the server", async () => {
      await client.get("/x");
      expect(previewHeader()).toBe("srv");
    });

    it("keeps an explicit x-store-preview", async () => {
      await client.get("/x", { headers: { "x-store-preview": "mine" } });
      expect(previewHeader()).toBe("mine");
    });

    it("sends nothing when next/headers throws", async () => {
      nextHeaders.cookies.mockRejectedValue(
        new Error("cookies() was called outside a request scope")
      );
      const result = await client.get("/x");
      expect(result.success).toBe(true);
      expect(previewHeader()).toBeUndefined();
    });

    it("sends a preview host's token in place of the cookie", async () => {
      nextHeaders.headers.mockResolvedValue(
        new Headers({ "x-ecomweb-store-preview-token": "sp.tok" })
      );
      await client.get("/x");
      expect(previewHeader()).toBe("sp.tok");
    });

    it("ignores a browser token set on the server", async () => {
      setBrowserStorePreviewToken("leak");
      nextHeaders.cookies.mockResolvedValue(jar({}));
      await client.get("/x");
      expect(previewHeader()).toBeUndefined();
    });

    it("sends nothing for a call that opts out (SKIP_STORE_PREVIEW)", async () => {
      await client.get("/x", SKIP_STORE_PREVIEW as AxiosRequestConfig);
      expect(previewHeader()).toBeUndefined();
    });
  });

  describe("in the browser", () => {
    beforeEach(() => {
      vi.stubGlobal("window", {
        location: { href: "http://shop.test/p", pathname: "/p" },
      });
    });

    afterEach(() => {
      // Reset while `window` is still there: on the server it is a no-op.
      setBrowserStorePreviewToken(null);
      setStorePreviewRenewer(null);
      vi.useRealTimers();
      vi.unstubAllGlobals();
    });

    const comingSoon403 = (config: InternalAxiosRequestConfig) =>
      new AxiosError("x", "ERR_BAD_REQUEST", config, null, {
        status: 403,
        data: { code: "STORE_COMING_SOON", details: { name: "A" } },
        statusText: "",
        headers: {},
        config,
      });

    it("sends the browser token", async () => {
      setBrowserStorePreviewToken("brw");
      await client.get("/x");
      expect(previewHeader()).toBe("brw");
    });

    it("never reads the request cookie there", async () => {
      await client.get("/x");
      expect(previewHeader()).toBeUndefined();
      expect(nextHeaders.cookies).not.toHaveBeenCalled();
    });

    it("redirects to /coming-soon on a STORE_COMING_SOON 403", async () => {
      fail = config =>
        new AxiosError("x", "ERR_BAD_REQUEST", config, null, {
          status: 403,
          data: { code: "STORE_COMING_SOON", details: { name: "A" } },
          statusText: "",
          headers: {},
          config,
        });

      const result = await client.get("/x");

      expect(result.success).toBe(false);
      expect(result.error?.error).toBe("STORE_COMING_SOON");
      expect(result.error?.details).toEqual({ name: "A" });
      expect(window.location.href).toBe("/coming-soon");
    });

    it("redirects a write to /coming-soon when not previewing", async () => {
      fail = comingSoon403;

      const result = await client.post("/x");

      expect(result.success).toBe(false);
      expect(result.error?.error).toBe("STORE_COMING_SOON");
      expect(window.location.href).toBe("/coming-soon");
    });

    it("treats HEAD in a preview as a read, not a refused write", async () => {
      setBrowserStorePreviewToken("brw");
      fail = comingSoon403;

      // ApiClient has no head(); the axios instance carries the interceptors.
      await expect(client.getAxiosInstance().head("/x")).rejects.toBeDefined();

      // A link preview has no renewer: like an expired GET, the preview ends.
      expect(window.location.href).toBe("/coming-soon");
    });

    it("renews on HEAD in a preview host's preview, like a GET", async () => {
      const renew = vi.fn();
      setBrowserStorePreviewToken("brw");
      setStorePreviewRenewer(renew);
      fail = comingSoon403;

      await expect(client.getAxiosInstance().head("/x")).rejects.toBeDefined();

      expect(renew).toHaveBeenCalledOnce();
      expect(window.location.href).toBe("http://shop.test/p");
    });

    it("never redirects a write in a preview", async () => {
      setBrowserStorePreviewToken("brw");
      fail = comingSoon403;

      const result = await client.post("/x");

      expect(result.success).toBe(false);
      expect(result.error?.error).toBe("STORE_COMING_SOON");
      expect(window.location.href).toBe("http://shop.test/p");
    });

    it("never redirects or renews on a write in a preview host's preview", async () => {
      const renew = vi.fn();
      setBrowserStorePreviewToken("brw");
      setStorePreviewRenewer(renew);
      fail = comingSoon403;

      await client.put("/x");
      await client.patch("/x");
      await client.delete("/x");

      expect(renew).not.toHaveBeenCalled();
      expect(window.location.href).toBe("http://shop.test/p");
    });

    it("redirects a GET when a link preview has expired", async () => {
      setBrowserStorePreviewToken("brw");
      fail = comingSoon403;

      const result = await client.get("/x");

      expect(result.error?.error).toBe("STORE_COMING_SOON");
      expect(window.location.href).toBe("/coming-soon");
    });

    it("renews instead of redirecting on a preview host", async () => {
      vi.useFakeTimers();
      const renew = vi.fn();
      setBrowserStorePreviewToken("brw");
      setStorePreviewRenewer(renew);
      fail = comingSoon403;

      await client.get("/x");
      await client.get("/y");

      expect(renew).toHaveBeenCalledOnce();
      expect(window.location.href).toBe("http://shop.test/p");

      vi.advanceTimersByTime(60_001);
      await client.get("/z");

      expect(renew).toHaveBeenCalledTimes(2);
      expect(window.location.href).toBe("http://shop.test/p");
    });

    it("does not redirect again from the coming soon page itself", async () => {
      window.location.href = "http://shop.test/coming-soon";
      window.location.pathname = "/coming-soon";
      fail = config =>
        new AxiosError("x", "ERR_BAD_REQUEST", config, null, {
          status: 403,
          data: { code: "STORE_COMING_SOON", details: { name: "A" } },
          statusText: "",
          headers: {},
          config,
        });

      const result = await client.get("/x");

      expect(result.error?.error).toBe("STORE_COMING_SOON");
      expect(window.location.href).toBe("http://shop.test/coming-soon");
    });

    it("never logs the preview token or the API key with a failure", async () => {
      setBrowserStorePreviewToken("brw.secret");
      fail = config =>
        new AxiosError("x", "ERR_BAD_REQUEST", config, null, {
          status: 403,
          data: { code: "STORE_COMING_SOON", details: { name: "A" } },
          statusText: "",
          headers: {},
          config,
        });

      await client.get("/x");

      // The request did carry both, so the log had them to leak.
      expect(previewHeader()).toBe("brw.secret");
      expect(sent[0]!.headers.get("x-storefront-api-key")).toBe("pk_test");
      const logged = vi.mocked(console.error).mock.calls;
      expect(logged).toHaveLength(1);
      const text = inspect(logged, { depth: 10 });
      expect(text).not.toContain("brw.secret");
      expect(text).not.toContain("pk_test");
      // Still enough to tell which call failed and how.
      expect(text).toContain("GET");
      expect(text).toContain("/x");
      expect(text).toContain("403");
      expect(text).toContain("STORE_COMING_SOON");
    });

    it("does not redirect on a STORE_UNAVAILABLE 404", async () => {
      fail = config =>
        new AxiosError("x", "ERR_BAD_REQUEST", config, null, {
          status: 404,
          data: { code: "STORE_UNAVAILABLE" },
          statusText: "",
          headers: {},
          config,
        });

      const result = await client.get("/x");

      expect(result.success).toBe(false);
      expect(result.error?.error).toBe("STORE_UNAVAILABLE");
      expect(window.location.href).toBe("http://shop.test/p");
    });
  });
});
