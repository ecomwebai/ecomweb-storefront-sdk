import { NextResponse, type NextRequest } from "next/server";
import { createAuthApi } from "./sdk";
import { clientIpFrom } from "./client-ip";
import { storePreviewTokenFor } from "../api/proxy";
import { safeRedirectPath } from "./safe-redirect";
import { publicNextUrl } from "../request/public-url";
import {
  authCookiePath,
  clearAuthCookies,
  clearEmailBindingCookie,
  clearOAuthNonceCookie,
  emailBindingCookieName,
  isHostMappedRequest,
  oauthNonceCookieName,
  readAuthCookies,
  writeAuthCookies,
  storeBasePathFor,
  writeEmailBindingCookie,
  writeOAuthNonceCookie,
} from "./cookies";
import type {
  AuthResult,
  ChangeEmailPayload,
  ChangePasswordPayload,
  LoginPayload,
  RegisterPayload,
  ResetPasswordPayload,
  VerifyOtpPayload,
} from "@ecomweb/sdk";

/** Translates the SDK's ApiResponse into a JSON response, preserving the code. */
function fail(status: number, message: string, code?: string) {
  return NextResponse.json(
    { error: { message, code } },
    { status: status || 500 }
  );
}

/**
 * The HTTP method each action answers on — one entry per action, no defaults.
 *
 * Every one of these used to answer GET as well as POST, and the session
 * cookies are `sameSite: "lax"`, which the browser DOES send on a cross-site
 * top-level navigation. A link on any page therefore reached `logout-all`, or
 * `google/complete` with a code of the attacker's choosing. The split is
 * enumerated rather than inferred so that adding an action forces a decision
 * here; an action missing from this map is a 404, not a silent GET.
 *
 * GET is limited to the two reads the client polls (`config`, `session`) and
 * the two halves of the OAuth hand-off: `google/url` is a read, and
 * `google/complete` is the browser's landing spot in a redirect chain, so it
 * cannot be anything else. It carries its own browser binding instead — see
 * the nonce cookie below.
 */
const AUTH_ACTION_METHOD = {
  config: "GET",
  session: "GET",
  "google/url": "GET",
  "google/complete": "GET",

  register: "POST",
  login: "POST",
  "otp/request": "POST",
  "otp/verify": "POST",
  anonymous: "POST",
  logout: "POST",
  "logout-all": "POST",
  "verify-email": "POST",
  "resend-verification": "POST",
  "forgot-password": "POST",
  "reset-password": "POST",
  "change-password": "POST",
  "change-email": "POST",
  "change-email/confirm": "POST",
} as const satisfies Record<string, "GET" | "POST">;

type AuthAction = keyof typeof AUTH_ACTION_METHOD;

/**
 * The query parameter carrying the OAuth nonce home.
 *
 * `redirect_to` is the only field that survives the round trip through the
 * signed `state` and back out as `next=`, and the backend requires it to be a
 * relative path, so the nonce travels inside it as a query parameter of a
 * path-only URL. The storefront is both the producer and the only consumer of
 * this shape.
 */
const OAUTH_NONCE_PARAM = "sf_oauth";
const OAUTH_NEXT_PARAM = "next";

/** Tokens go into cookies and never into the response body. */
function withSession(
  storeRef: string,
  cookiePath: string,
  result: AuthResult,
  body: Record<string, unknown> = {}
) {
  const response = NextResponse.json({ identity: result.identity, ...body });

  if (result.access_token && result.refresh_token) {
    writeAuthCookies(
      response,
      storeRef,
      {
        access_token: result.access_token,
        refresh_token: result.refresh_token,
      },
      cookiePath
    );
  }

  return response;
}

function methodNotAllowed(allowed: "GET" | "POST") {
  return NextResponse.json(
    {
      error: {
        message: `This action requires ${allowed}`,
        code: "METHOD_NOT_ALLOWED",
      },
    },
    { status: 405, headers: { allow: allowed } }
  );
}

export async function handleAuthRoute(
  request: NextRequest,
  storeRef: string,
  segments: string[]
): Promise<NextResponse> {
  const action = segments.join("/");
  const allowedMethod = AUTH_ACTION_METHOD[action as AuthAction];

  if (!allowedMethod) return fail(404, `Unknown auth action: ${action}`);
  if (request.method !== allowedMethod) return methodNotAllowed(allowedMethod);

  // The shopper's address, not this server's: the backend rate-limits per
  // `storeId:clientIp` and every one of these calls is made server-side.
  const auth = createAuthApi(
    storeRef,
    clientIpFrom(request.headers),
    storePreviewTokenFor(request, storeRef)
  );
  const hostMapped = isHostMappedRequest(request);
  const cookiePath = authCookiePath(storeRef, hostMapped);
  const tokens = readAuthCookies(request.cookies, storeRef, cookiePath);

  const body: Record<string, any> =
    request.method === "POST" ? await request.json().catch(() => ({})) : {};

  switch (action) {
    case "config": {
      const res = await auth.getAuthConfig();
      if (!res.success)
        return fail(
          res.error!.statusCode,
          res.error!.message,
          res.error!.error
        );
      return NextResponse.json(res.data);
    }

    case "register": {
      // Never trust a browser-supplied `anonymous_identity_id`: the backend
      // only checks store_id / is_anonymous / !deleted_at, not ownership, so
      // forwarding it would let anyone who learns an anonymous UUID register
      // against it and inherit its cart and orders. Whatever the browser sent
      // is dropped and the id is derived from the httpOnly session instead.
      const payload: Record<string, any> = { ...body };
      delete payload.anonymous_identity_id;

      let anonymousIdentityId: string | undefined;

      if (tokens) {
        const current = await auth.me(tokens.access_token);
        if (current.success && current.data?.is_anonymous) {
          anonymousIdentityId = current.data.id;
        }
      }

      const res = await auth.register({
        ...payload,
        anonymous_identity_id: anonymousIdentityId,
      } as RegisterPayload);
      if (!res.success)
        return fail(
          res.error!.statusCode,
          res.error!.message,
          res.error!.error
        );
      // Register never returns tokens, by design. The verification binding
      // stays in an httpOnly cookie so only this browser's click on the
      // mailed link keeps the password just set (absent on older APIs).
      const registered = NextResponse.json({ registered: true });
      const verificationBinding = res.data?.verification_binding;
      if (verificationBinding) {
        writeEmailBindingCookie(
          registered,
          "verify-email",
          storeRef,
          verificationBinding,
          cookiePath
        );
      }
      return registered;
    }

    case "login": {
      const res = await auth.login(body as LoginPayload);
      if (!res.success)
        return fail(
          res.error!.statusCode,
          res.error!.message,
          res.error!.error
        );
      return withSession(storeRef, cookiePath, res.data!);
    }

    case "otp/request": {
      const res = await auth.requestOtp(body.email);
      if (!res.success)
        return fail(
          res.error!.statusCode,
          res.error!.message,
          res.error!.error
        );
      return NextResponse.json({ sent: true });
    }

    case "otp/verify": {
      const res = await auth.verifyOtp(body as VerifyOtpPayload);
      if (!res.success)
        return fail(
          res.error!.statusCode,
          res.error!.message,
          res.error!.error
        );
      return withSession(storeRef, cookiePath, res.data!);
    }

    case "anonymous": {
      const res = await auth.anonymous();
      if (!res.success)
        return fail(
          res.error!.statusCode,
          res.error!.message,
          res.error!.error
        );
      return withSession(storeRef, cookiePath, res.data!);
    }

    case "session": {
      if (!tokens) return NextResponse.json({ identity: null });
      const res = await auth.me(tokens.access_token);
      if (!res.success) return NextResponse.json({ identity: null });
      return NextResponse.json({ identity: res.data });
    }

    case "logout": {
      // Best-effort revoke: a failed call must still clear the browser's
      // cookies, or the shopper is stuck logged in against a dead session.
      if (tokens) {
        await auth
          .logout(tokens.access_token, tokens.refresh_token)
          .catch(() => undefined);
      }
      const response = NextResponse.json({ ok: true });
      clearAuthCookies(response, storeRef, cookiePath);
      return response;
    }

    case "logout-all": {
      if (!tokens) return fail(401, "No session");
      const res = await auth.logoutAll(tokens.access_token);
      if (!res.success)
        return fail(
          res.error!.statusCode,
          res.error!.message,
          res.error!.error
        );
      const response = NextResponse.json({ ok: true });
      clearAuthCookies(response, storeRef, cookiePath);
      return response;
    }

    case "verify-email": {
      const binding = request.cookies.get(
        emailBindingCookieName("verify-email", storeRef, cookiePath)
      )?.value;
      const res = await auth.verifyEmail(body.token, binding || undefined);
      if (!res.success)
        return fail(
          res.error!.statusCode,
          res.error!.message,
          res.error!.error
        );
      const verified = NextResponse.json(res.data);
      clearEmailBindingCookie(verified, "verify-email", storeRef, cookiePath);
      return verified;
    }

    case "resend-verification": {
      const res = await auth.resendVerification(body.email);
      if (!res.success)
        return fail(
          res.error!.statusCode,
          res.error!.message,
          res.error!.error
        );
      return NextResponse.json({ sent: true });
    }

    case "forgot-password": {
      const res = await auth.forgotPassword(body.email);
      if (!res.success)
        return fail(
          res.error!.statusCode,
          res.error!.message,
          res.error!.error
        );
      return NextResponse.json({ sent: true });
    }

    case "reset-password": {
      const res = await auth.resetPassword(body as ResetPasswordPayload);
      if (!res.success)
        return fail(
          res.error!.statusCode,
          res.error!.message,
          res.error!.error
        );
      return NextResponse.json(res.data);
    }

    case "change-password": {
      if (!tokens) return fail(401, "No session");
      const res = await auth.changePassword(
        tokens.access_token,
        body as ChangePasswordPayload
      );
      if (!res.success)
        return fail(
          res.error!.statusCode,
          res.error!.message,
          res.error!.error
        );
      // Changing a password revokes sessions server-side; drop the cookies too.
      const response = NextResponse.json({ ok: true });
      clearAuthCookies(response, storeRef, cookiePath);
      return response;
    }

    case "change-email": {
      if (!tokens) return fail(401, "No session");
      const res = await auth.changeEmail(
        tokens.access_token,
        body as ChangeEmailPayload
      );
      if (!res.success)
        return fail(
          res.error!.statusCode,
          res.error!.message,
          res.error!.error
        );
      // Kept for the confirm click, like the verification binding above.
      const sent = NextResponse.json({ sent: true });
      const confirmationBinding = res.data?.confirmation_binding;
      if (confirmationBinding) {
        writeEmailBindingCookie(
          sent,
          "change-email",
          storeRef,
          confirmationBinding,
          cookiePath
        );
      }
      return sent;
    }

    case "change-email/confirm": {
      const binding = request.cookies.get(
        emailBindingCookieName("change-email", storeRef, cookiePath)
      )?.value;
      const res = await auth.confirmEmailChange(
        body.token,
        binding || undefined
      );
      if (!res.success)
        return fail(
          res.error!.statusCode,
          res.error!.message,
          res.error!.error
        );
      const confirmed = NextResponse.json(res.data);
      clearEmailBindingCookie(confirmed, "change-email", storeRef, cookiePath);
      return confirmed;
    }

    case "google/url": {
      // Proxied rather than called from the browser so the storefront API key
      // stays server-side.
      const base = storeBasePathFor(request, storeRef);
      const wanted = safeRedirectPath(
        request.nextUrl.searchParams.get("redirect_to"),
        publicNextUrl(request).toString()
      );

      // The nonce is minted here, remembered in an httpOnly cookie, and rides
      // out inside `redirect_to`. `google/complete` refuses to issue a session
      // unless the two match, which is what makes that GET unforgeable.
      // `globalThis.crypto` rather than a node:crypto import: this module is
      // bundled for whichever runtime the route runs in.
      const nonce = globalThis.crypto.randomUUID();
      const carrier = new URLSearchParams({
        [OAUTH_NONCE_PARAM]: nonce,
        [OAUTH_NEXT_PARAM]: wanted,
      });

      const res = await auth.getGoogleUrl(`${base}/?${carrier.toString()}`);
      if (!res.success)
        return fail(
          res.error!.statusCode,
          res.error!.message,
          res.error!.error
        );

      const response = NextResponse.json(res.data);
      writeOAuthNonceCookie(response, storeRef, nonce, cookiePath);
      return response;
    }

    case "google/complete": {
      // The backend redirects the BROWSER here with a one-time code. It is
      // redeemed server-side so no token ever reaches the URL bar, history,
      // or a Referer header.
      const base = storeBasePathFor(request, storeRef);
      const errorTarget = new URL(
        `${base}/auth/error?error=oauth_failed`,
        publicNextUrl(request).toString()
      );

      const code = request.nextUrl.searchParams.get("code");

      // Whatever came back in `next` is the carrier this route wrote in
      // `google/url`: a relative path plus the nonce. Both halves are
      // re-validated — the path against the origin, the nonce against the
      // cookie — before anything is issued.
      const carrier = safeRedirectPath(
        request.nextUrl.searchParams.get(OAUTH_NEXT_PARAM),
        publicNextUrl(request).toString()
      );
      const carrierParams = new URL(carrier, publicNextUrl(request).toString()).searchParams;
      const presentedNonce = carrierParams.get(OAUTH_NONCE_PARAM);
      const expectedNonce = request.cookies.get(
        oauthNonceCookieName(storeRef, cookiePath)
      )?.value;

      const nonceMatches =
        !!presentedNonce && !!expectedNonce && presentedNonce === expectedNonce;

      if (!code || !nonceMatches) {
        // A missing or mismatched nonce means this browser did not start the
        // flow: someone else's one-time code is being pushed into it. Refuse
        // before any token is exchanged, and burn the nonce either way.
        const response = NextResponse.redirect(errorTarget);
        clearOAuthNonceCookie(response, storeRef, cookiePath);
        return response;
      }

      const res = await auth.exchangeGoogleCode(code);

      if (!res.success || !res.data?.access_token || !res.data.refresh_token) {
        const response = NextResponse.redirect(errorTarget);
        clearOAuthNonceCookie(response, storeRef, cookiePath);
        return response;
      }

      const target = safeRedirectPath(
        carrierParams.get(OAUTH_NEXT_PARAM),
        publicNextUrl(request).toString()
      );
      const response = NextResponse.redirect(
        new URL(target === "/" ? `${base}/` : target, publicNextUrl(request).toString())
      );

      writeAuthCookies(
        response,
        storeRef,
        {
          access_token: res.data.access_token,
          refresh_token: res.data.refresh_token,
        },
        cookiePath
      );
      clearOAuthNonceCookie(response, storeRef, cookiePath);

      return response;
    }

    default:
      // Unreachable: AUTH_ACTION_METHOD is checked first, and every key it
      // holds has a case above. Kept so adding a key without a case is a
      // 404 rather than an undefined response.
      return fail(404, `Unknown auth action: ${action}`);
  }
}
