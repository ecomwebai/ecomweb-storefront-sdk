import type { ApiResponse, IHttpClient, RequestOptions } from "../../core/types";
import type {
  AuthResult,
  ChangeEmailPayload,
  ChangeEmailResult,
  ChangePasswordPayload,
  ChangedResult,
  CurrentIdentity,
  GoogleAuthUrl,
  LoginPayload,
  PublicAuthConfig,
  RegisterPayload,
  RegisterResult,
  ResetPasswordPayload,
  ResetResult,
  SentResult,
  VerifiedResult,
  VerifyOtpPayload,
} from "./types";

/**
 * One store's auth surface.
 *
 * Every route lives under `/storefront/stores/<ref>/auth/`. Token routes
 * (`me`, `logout`, ...) require an access token and assert that the token's
 * store_id matches the route's store; the rest are unauthenticated and throttled.
 *
 * This class does not supply `x-storefront-api-key` — StorefrontApiKeyGuard
 * requires it on every route, and the injected IHttpClient owns that header.
 */
export class AuthApi {
  constructor(
    private http: IHttpClient,
    private storeRef: string,
  ) {}

  private publicPath(suffix: string): string {
    return `/storefront/stores/${encodeURIComponent(this.storeRef)}/auth/${suffix}`;
  }

  private tenantPath(suffix: string): string {
    return `/storefront/stores/${encodeURIComponent(this.storeRef)}/auth/${suffix}`;
  }

  private auth(access_token: string): RequestOptions {
    return { headers: { Authorization: `Bearer ${access_token}` } };
  }

  // ---- unauthenticated -------------------------------------------------

  /** Never returns tokens: a new email and an existing one respond identically. */
  async register(payload: RegisterPayload): Promise<ApiResponse<RegisterResult>> {
    return this.http.post<RegisterResult>(this.publicPath("register"), payload, undefined);
  }

  /**
   * Signs a customer in with email and password.
   *
   * @param payload - the login credentials
   * @returns The auth result with the token pair, as the raw {@link ApiResponse}; it does not throw, so check `success`
   */
  async login(payload: LoginPayload): Promise<ApiResponse<AuthResult>> {
    return this.http.post<AuthResult>(this.publicPath("login"), payload, undefined);
  }

  /**
   * Exchanges a refresh token for a new token pair. The old refresh token stops working.
   *
   * @param refresh_token - the customer's current refresh token
   * @returns The new token pair, as the raw {@link ApiResponse}; it does not throw, so check `success`
   */
  async refresh(refresh_token: string): Promise<ApiResponse<AuthResult>> {
    return this.http.post<AuthResult>(
      this.publicPath("refresh"),
      { refresh_token },
      undefined,
    );
  }

  /**
   * `binding` is the register response's `verification_binding`, when this
   * client still has it. Omitted, the address is verified but the password
   * set at registration is dropped.
   */
  async verifyEmail(
    token: string,
    binding?: string,
  ): Promise<ApiResponse<VerifiedResult>> {
    return this.http.post<VerifiedResult>(
      this.publicPath("verify-email"),
      binding ? { token, binding } : { token },
      undefined,
    );
  }

  /**
   * Sends the email-verification message again.
   *
   * @param email - the address to verify
   * @returns The send result, as the raw {@link ApiResponse}; it does not throw, so check `success`
   */
  async resendVerification(email: string): Promise<ApiResponse<SentResult>> {
    return this.http.post<SentResult>(
      this.publicPath("resend-verification"),
      { email },
      undefined,
    );
  }

  /**
   * Starts a password reset by emailing a reset link.
   *
   * @param email - the account's email address
   * @returns The send result, as the raw {@link ApiResponse}; it does not throw, so check `success`
   */
  async forgotPassword(email: string): Promise<ApiResponse<SentResult>> {
    return this.http.post<SentResult>(
      this.publicPath("forgot-password"),
      { email },
      undefined,
    );
  }

  /**
   * Sets a new password using the token from the reset email.
   *
   * @param payload - the reset token and the new password
   * @returns The reset result, as the raw {@link ApiResponse}; it does not throw, so check `success`
   */
  async resetPassword(
    payload: ResetPasswordPayload,
  ): Promise<ApiResponse<ResetResult>> {
    return this.http.post<ResetResult>(
      this.publicPath("reset-password"),
      payload,
      undefined,
    );
  }

  /** `binding` is the change-email response's `confirmation_binding`. */
  async confirmEmailChange(
    token: string,
    binding?: string,
  ): Promise<ApiResponse<ChangedResult>> {
    return this.http.post<ChangedResult>(
      this.publicPath("change-email/confirm"),
      binding ? { token, binding } : { token },
      undefined,
    );
  }

  /**
   * Emails a one-time sign-in code.
   *
   * @param email - the account's email address
   * @returns The send result, as the raw {@link ApiResponse}; it does not throw, so check `success`
   */
  async requestOtp(email: string): Promise<ApiResponse<SentResult>> {
    return this.http.post<SentResult>(
      this.publicPath("otp/request"),
      { email },
      undefined,
    );
  }

  /**
   * Signs a customer in with the one-time code from the email.
   *
   * @param payload - the email and the code
   * @returns The auth result with the token pair, as the raw {@link ApiResponse}; it does not throw, so check `success`
   */
  async verifyOtp(payload: VerifyOtpPayload): Promise<ApiResponse<AuthResult>> {
    return this.http.post<AuthResult>(
      this.publicPath("otp/verify"),
      payload,
      undefined,
    );
  }

  /**
   * Starts an anonymous (guest) session.
   *
   * @returns The auth result with the token pair, as the raw {@link ApiResponse}; it does not throw, so check `success`
   */
  async anonymous(): Promise<ApiResponse<AuthResult>> {
    return this.http.post<AuthResult>(this.publicPath("anonymous"), undefined, undefined);
  }

  /**
   * Gets the URL that starts Google sign-in.
   *
   * @param redirect_to - where to send the customer after sign-in, `/` by default
   * @returns The Google sign-in URL, as the raw {@link ApiResponse}; it does not throw, so check `success`
   */
  async getGoogleUrl(redirect_to = "/"): Promise<ApiResponse<GoogleAuthUrl>> {
    const query = `?redirect_to=${encodeURIComponent(redirect_to)}`;
    return this.http.get<GoogleAuthUrl>(
      `${this.publicPath("google/url")}${query}`,
      undefined,
    );
  }

  /**
   * Completes Google sign-in by exchanging the authorization code.
   *
   * @param code - the authorization code Google returned
   * @returns The auth result with the token pair, as the raw {@link ApiResponse}; it does not throw, so check `success`
   */
  async exchangeGoogleCode(code: string): Promise<ApiResponse<AuthResult>> {
    return this.http.post<AuthResult>(
      this.publicPath("google/exchange"),
      { code },
      undefined,
    );
  }

  /**
   * Reads which sign-in methods this store has turned on.
   *
   * @returns The public auth configuration, as the raw {@link ApiResponse}; it does not throw, so check `success`
   */
  async getAuthConfig(): Promise<ApiResponse<PublicAuthConfig>> {
    return this.http.get<PublicAuthConfig>(this.publicPath("config"), undefined);
  }

  // ---- access token required -------------------------------------------

  /**
   * Reads the signed-in customer's identity.
   *
   * @param access_token - the signed-in customer's access token
   * @returns The current identity, as the raw {@link ApiResponse}; it does not throw, so check `success`
   */
  async me(access_token: string): Promise<ApiResponse<CurrentIdentity | null>> {
    return this.http.get<CurrentIdentity | null>(
      this.tenantPath("me"),
      this.auth(access_token),
    );
  }

  /** Revokes one session. The refresh token identifies which. */
  async logout(
    access_token: string,
    refresh_token: string,
  ): Promise<ApiResponse<unknown>> {
    return this.http.post<unknown>(
      this.tenantPath("logout"),
      { refresh_token },
      this.auth(access_token),
    );
  }

  /**
   * Signs the customer out of every session.
   *
   * @param access_token - the signed-in customer's access token
   * @returns The API's answer, as the raw {@link ApiResponse}; it does not throw, so check `success`
   */
  async logoutAll(access_token: string): Promise<ApiResponse<unknown>> {
    return this.http.post<unknown>(
      this.tenantPath("logout-all"),
      undefined,
      this.auth(access_token),
    );
  }

  /**
   * Changes the signed-in customer's password.
   *
   * @param access_token - the signed-in customer's access token
   * @param payload - the current and the new password
   * @returns The API's answer, as the raw {@link ApiResponse}; it does not throw, so check `success`
   */
  async changePassword(
    access_token: string,
    payload: ChangePasswordPayload,
  ): Promise<ApiResponse<unknown>> {
    return this.http.post<unknown>(
      this.tenantPath("change-password"),
      payload,
      this.auth(access_token),
    );
  }

  /**
   * Starts an email change; the new address must be confirmed from the message sent to it.
   *
   * @param access_token - the signed-in customer's access token
   * @param payload - the new email address and the current password
   * @returns The change-email result, as the raw {@link ApiResponse}; it does not throw, so check `success`
   */
  async changeEmail(
    access_token: string,
    payload: ChangeEmailPayload,
  ): Promise<ApiResponse<ChangeEmailResult>> {
    return this.http.post<ChangeEmailResult>(
      this.tenantPath("change-email"),
      payload,
      this.auth(access_token),
    );
  }
}
