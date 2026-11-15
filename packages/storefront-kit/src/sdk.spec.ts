import { describe, expect, it, vi } from "vitest";

const { get } = vi.hoisted(() => ({
  get: vi.fn(async (..._args: unknown[]) => ({ success: true, data: null })),
}));
vi.mock("./api/client", () => {
  const client = { get, post: get, put: get, patch: get, delete: get };
  return { publicApiClient: client, createStoreApiClient: () => client };
});

import { createStoreSdk } from "./sdk";
import { KIT_CLIENT_TOKEN } from "./client-info";
import { SDK_CLIENT_TOKEN } from "@ecomweb/sdk";

describe("kit sdk", () => {
  it("sends X-Ecomweb-Client as `<kit token> <sdk token>`", async () => {
    await createStoreSdk("s").stores.getById("s");
    await createStoreSdk("s").addresses.list("s");
    expect(get).toHaveBeenCalledTimes(2);
    for (const call of get.mock.calls) {
      expect((call[1] as any).headers["X-Ecomweb-Client"]).toBe(
        `${KIT_CLIENT_TOKEN} ${SDK_CLIENT_TOKEN}`
      );
    }
    expect(KIT_CLIENT_TOKEN).not.toContain("/dev");
  });
});
