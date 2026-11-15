import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { handleAuthRoute } from "./route-handlers";

const m = vi.hoisted(() => ({
  register: vi.fn(),
  verifyEmail: vi.fn(),
  changeEmail: vi.fn(),
  confirmEmailChange: vi.fn(),
  me: vi.fn(),
}));
vi.mock("./sdk", () => ({ createAuthApi: () => m }));

// Path-scoped (shared host) cookies keep the bare name, so the names below
// do not depend on NODE_ENV.
const STORE = "s1";
const PATH = `/store/${STORE}`;
const VB = `ecomweb_sf_${STORE}_vb`;
const CB = `ecomweb_sf_${STORE}_cb`;

function post(action: string, body: unknown, cookie?: string) {
  return new NextRequest(`https://shop.example.com${PATH}/api/auth/${action}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-ecomweb-host-mapped": "0",
      ...(cookie && { cookie }),
    },
  });
}

const ok = <T>(data: T) => ({ success: true, data });

describe("email-proof bindings", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps the register binding in an httpOnly cookie, never in the body", async () => {
    m.register.mockResolvedValue(
      ok({ identity: null, verification_binding: "bind-v" })
    );
    const res = await handleAuthRoute(
      post("register", { email: "a@b.c", password: "pw" }),
      STORE,
      ["register"]
    );

    expect(await res.json()).toEqual({ registered: true });
    const cookie = res.cookies.get(VB);
    expect(cookie?.value).toBe("bind-v");
    expect(cookie).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: PATH,
      maxAge: 86400,
    });
  });

  it("sets no cookie when an older API returns no binding", async () => {
    m.register.mockResolvedValue(ok({ identity: null }));
    const res = await handleAuthRoute(
      post("register", { email: "a@b.c", password: "pw" }),
      STORE,
      ["register"]
    );
    expect(res.cookies.get(VB)).toBeUndefined();
  });

  it("sends the cookie's binding on verify-email, then clears it", async () => {
    m.verifyEmail.mockResolvedValue(ok({ verified: true }));
    const res = await handleAuthRoute(
      post("verify-email", { token: "tok" }, `${VB}=bind-v`),
      STORE,
      ["verify-email"]
    );

    expect(m.verifyEmail).toHaveBeenCalledWith("tok", "bind-v");
    expect(res.cookies.get(VB)).toMatchObject({ value: "", maxAge: 0 });
  });

  it("verifies without a binding when the cookie is gone", async () => {
    m.verifyEmail.mockResolvedValue(ok({ verified: true }));
    await handleAuthRoute(post("verify-email", { token: "tok" }), STORE, [
      "verify-email",
    ]);
    expect(m.verifyEmail).toHaveBeenCalledWith("tok", undefined);
  });

  it("keeps the change-email binding in its own cookie", async () => {
    m.changeEmail.mockResolvedValue(
      ok({ sent: true, confirmation_binding: "bind-c" })
    );
    const res = await handleAuthRoute(
      post(
        "change-email",
        { current_password: "pw", new_email: "n@b.c" },
        `ecomweb_sf_${STORE}_at=a; ecomweb_sf_${STORE}_rt=r`
      ),
      STORE,
      ["change-email"]
    );

    expect(await res.json()).toEqual({ sent: true });
    expect(res.cookies.get(CB)).toMatchObject({
      value: "bind-c",
      httpOnly: true,
      maxAge: 3600,
    });
    expect(res.cookies.get(VB)).toBeUndefined();
  });

  it("sends the change-email binding on confirm, then clears it", async () => {
    m.confirmEmailChange.mockResolvedValue(ok({ changed: true }));
    const res = await handleAuthRoute(
      post("change-email/confirm", { token: "tok" }, `${CB}=bind-c; ${VB}=x`),
      STORE,
      ["change-email", "confirm"]
    );

    expect(m.confirmEmailChange).toHaveBeenCalledWith("tok", "bind-c");
    expect(res.cookies.get(CB)).toMatchObject({ value: "", maxAge: 0 });
  });
});
