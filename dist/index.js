import { createLogger as P } from "@turnkeystaffing/get-native-vue-logger";
import { inject as me, computed as s, defineComponent as U, ref as A, openBlock as u, createElementBlock as m, createElementVNode as c, createBlock as S, resolveDynamicComponent as L, createCommentVNode as C, toDisplayString as y, onBeforeUnmount as ce, normalizeStyle as ye, Fragment as te, createTextVNode as re, normalizeClass as ne, watch as oe, Teleport as be, mergeProps as we, nextTick as Ee } from "vue";
import x from "axios";
import { defineStore as Ae } from "pinia";
import { jwtDecode as le } from "jwt-decode";
const ue = /* @__PURE__ */ Symbol("bff-auth-config");
let de = null;
function ke(e) {
  de = e;
}
function T() {
  return de;
}
function fr() {
  const e = me(ue);
  if (!e)
    throw new Error(
      "BFF Auth config not found. Did you forget to install the plugin with app.use(bffAuthPlugin, options)?"
    );
  return e;
}
const fe = Object.freeze({
  // ── session_expired — re-login fixes it ────────────────────────────────
  invalid_grant: "session_expired",
  missing_token: "session_expired",
  invalid_token: "session_expired",
  invalid_user_id: "session_expired",
  user_not_found: "session_expired",
  missing_refresh_token: "session_expired",
  invalid_refresh_token: "session_expired",
  reauth_required: "session_expired",
  session_compromised: "session_expired",
  forbidden: "session_expired",
  invalid_session: "session_expired",
  authentication_error: "session_expired",
  // ── service_unavailable — wait and retry ───────────────────────────────
  temporarily_unavailable: "service_unavailable",
  service_unavailable: "service_unavailable",
  auth_service_unavailable: "service_unavailable",
  logout_failed: "service_unavailable",
  sessions_fetch_failed: "service_unavailable",
  revoke_failed: "service_unavailable",
  password_change_error: "service_unavailable",
  resend_email_failed: "service_unavailable",
  resend_email_error: "service_unavailable",
  "2fa_setup_error": "service_unavailable",
  "2fa_verify_error": "service_unavailable",
  rate_limit_exceeded: "service_unavailable",
  // ── dev_error — OAuth / client misconfiguration ────────────────────────
  invalid_client: "dev_error",
  unauthorized_client: "dev_error",
  unsupported_response_type: "dev_error",
  unsupported_grant_type: "dev_error",
  invalid_scope: "dev_error",
  invalid_redirect_uri: "dev_error",
  client_inactive: "dev_error",
  cors_error: "dev_error",
  // ── account_blocked — user terminal (contact admin / sign out) ────────
  account_inactive: "account_blocked",
  insufficient_permissions: "account_blocked",
  // ── server_error — infra/admin terminal (request_id) ──────────────────
  server_error: "server_error",
  internal_error: "server_error",
  not_implemented: "server_error",
  unknown_host: "server_error"
}), _e = /* @__PURE__ */ new Set([
  // Passwords
  "missing_current_password",
  "missing_new_password",
  "missing_password",
  "invalid_current_password",
  "weak_password",
  "invalid_password",
  // 2FA / TOTP
  "missing_totp_code",
  "invalid_totp_code",
  "missing_setup_token",
  "invalid_setup_token",
  "no_provisional_secret",
  "2fa_already_enabled",
  "invalid_totp",
  // Login-form
  "invalid_credentials",
  // Email management
  "email_not_found",
  "email_exists",
  "email_not_verified",
  "email_already_verified",
  "cannot_remove_primary",
  "cannot_remove_last",
  "cannot_set_primary_unverified",
  "invalid_email",
  "validation_failed",
  "max_emails_exceeded",
  // Security middleware
  "payload_too_large",
  // Session management UI
  "missing_session_id",
  "invalid_session_id",
  "session_not_found",
  // OAuth user-input / consent
  "invalid_request",
  "access_denied"
]);
function xe(e, r) {
  if (!e) return null;
  const t = e.toLowerCase();
  return r && Object.prototype.hasOwnProperty.call(r, t) ? r[t] ?? null : _e.has(t) ? null : fe[t] ?? null;
}
function Ce(e) {
  return e === 401 ? "session_expired" : e === 429 ? "service_unavailable" : null;
}
const w = P("AuthService");
class $ extends Error {
  constructor(r) {
    super(r), this.name = "AuthConfigurationError";
  }
}
function I() {
  return T()?.bffBaseUrl || "";
}
function ie() {
  return T()?.clientId || "";
}
function Z() {
  const e = T();
  return !!(e?.bffBaseUrl && e?.clientId);
}
function K(e, r) {
  const t = e.response;
  if (!t) return null;
  const n = t.data ?? {}, o = n.error, a = typeof o == "string" && o.length > 0 ? o.toLowerCase() : null;
  if (!a) return null;
  const l = xe(a, r);
  if (l === null) return null;
  const d = n.error_description || o || "";
  return { type: l, message: d, code: a };
}
class Te {
  /**
   * Submit login credentials to BFF for authentication
   * This POSTs to /api/v1/oauth/login and expects a 200 OK on success.
   * BFF will set the session cookie on successful authentication.
   *
   * @param email - User email address
   * @param password - User password
   * @param totpCode - Optional TOTP code for 2FA authentication
   * @returns Promise that resolves on success, rejects on error
   * @throws AxiosError with status 401 for invalid credentials
   * @throws AxiosError with status 401 with detail '2fa_setup_required' when 2FA setup is needed
   * @throws AxiosError with status 401 with detail '2fa_code_required' when TOTP code is needed
   * @throws AxiosError with status 503 for service unavailable
   */
  async submitCredentials(r, t, n) {
    try {
      const o = { email: r, password: t };
      n !== void 0 && (o.totp_code = n), await x.post(
        `${I()}/api/v1/oauth/login`,
        o,
        { withCredentials: !0 }
        // Include cookies for session handling
      ), w.info("Credentials submitted successfully");
    } catch (o) {
      throw w.error("Failed to submit credentials", o), o;
    }
  }
  /**
   * Check if user is authenticated by calling /bff/userinfo
   * This should be called on app load to determine auth state
   *
   * @returns CheckAuthResponse with user info if authenticated
   * @throws AuthConfigurationError if auth is not configured
   */
  async checkAuth() {
    if (!Z())
      throw new $(
        "Authentication service is not configured. Please contact your administrator."
      );
    try {
      return {
        isAuthenticated: !0,
        user: (await x.get(`${I()}/bff/userinfo`, {
          withCredentials: !0
          // Include bff_session cookie
        })).data
      };
    } catch (r) {
      if (x.isAxiosError(r) && r.response?.status === 401)
        return {
          isAuthenticated: !1,
          user: null
        };
      throw r;
    }
  }
  /**
   * Start login flow by redirecting to BFF login endpoint.
   * For use by Product SPAs to redirect users to Central Login.
   *
   * Security: Enforces same-origin redirects to prevent open redirect attacks.
   * For cross-origin redirects with a custom client ID, use {@link loginWithCustomClient}.
   *
   * @param options - Login options with optional returnUrl (defaults to current URL)
   */
  login(r) {
    const t = r || {};
    if (!Z())
      throw w.error("Cannot initiate login: Auth configuration is incomplete"), new $(
        "Authentication service is not configured. Please contact your administrator."
      );
    const n = t.returnUrl || window.location.href;
    let o;
    try {
      o = new URL(n, window.location.origin);
    } catch {
      w.warn("Malformed returnUrl, falling back to current page:", n), o = new URL(window.location.href);
    }
    o.origin !== window.location.origin && (w.warn("Blocked external redirect attempt:", n), o = new URL("/", window.location.origin));
    const a = o.href, l = `${I()}/bff/login`, d = new URLSearchParams({
      client_id: ie(),
      redirect_url: a
    });
    w.debug("Initiating login redirect", { returnUrl: a }), window.location.href = `${l}?${d.toString()}`;
  }
  /**
   * Start a cross-origin login redirect using a custom OAuth client ID.
   * For use when Central Login detects an existing BFF session and needs to
   * redirect the user back to the originating Product SPA without re-prompting
   * for credentials.
   *
   * Unlike {@link login}, this method skips same-origin validation — the BFF
   * validates the redirect_url against registered client URIs for the given
   * client_id. Only bffBaseUrl is required from config; config clientId is
   * not used.
   *
   * @param options - Required clientId and returnUrl from the originating SPA.
   *   `returnUrl` is passed verbatim to the BFF (including any hash fragment or query string) —
   *   the BFF is responsible for validating the full URL against registered client redirect URIs.
   * @throws {Error} if clientId is empty or whitespace
   * @throws {Error} if returnUrl is not a valid URL
   * @throws {Error} if returnUrl does not use http or https scheme
   * @throws {AuthConfigurationError} if bffBaseUrl is not configured
   * @see completeOAuthFlow for completing the OAuth flow after credential submission
   */
  loginWithCustomClient(r) {
    const { clientId: t, returnUrl: n } = r, o = t.trim();
    if (!o)
      throw new Error("clientId must not be empty");
    let a;
    try {
      a = new URL(n);
    } catch {
      throw new Error("returnUrl is not a valid URL");
    }
    if (a.protocol !== "http:" && a.protocol !== "https:")
      throw new Error("returnUrl must use http or https scheme");
    const l = I();
    if (!l)
      throw new $("BFF base URL is not configured.");
    const d = `${l}/bff/login`, h = new URLSearchParams({
      client_id: o,
      redirect_url: n
    });
    w.debug("Initiating custom client login redirect", { clientId: o, returnUrl: n }), window.location.href = `${d}?${h.toString()}`;
  }
  /**
   * Complete OAuth flow after successful credential submission.
   * For use by Central Login only, after submitCredentials() succeeds.
   *
   * This method allows cross-origin redirects since Central Login must
   * redirect users back to the originating Product SPA. The BFF validates
   * the redirect_url against registered OAuth client redirect URIs.
   *
   * @param options - Required clientId and returnUrl from the originating SPA
   */
  completeOAuthFlow(r) {
    const { clientId: t, returnUrl: n } = r;
    if (!t || !n)
      throw new Error("completeOAuthFlow requires both clientId and returnUrl");
    const o = `${I()}/bff/login`, a = new URLSearchParams({
      client_id: t,
      redirect_url: n
    });
    w.debug("Completing OAuth flow", { clientId: t, returnUrl: n }), window.location.href = `${o}?${a.toString()}`;
  }
  /**
   * Get fresh access token for API calls
   * Call this before making protected API requests
   *
   * Uses TOKEN_CLIENT_ID (rag-backend) so the token is issued for the backend
   * resource server, enabling successful token introspection by the backend.
   *
   * @returns TokenResponse with JWT access token, or null if session expired
   * @throws AuthConfigurationError if auth is not configured
   */
  async getAccessToken() {
    if (T()?.mode === "cookie")
      throw new $(
        "getAccessToken() is not available in cookie mode. Token management is handled by the BFF proxy via cookies."
      );
    if (!Z())
      throw new $(
        "Authentication service is not configured. Please contact your administrator."
      );
    try {
      const r = await x.post(
        `${I()}/bff/token`,
        { client_id: ie() },
        { withCredentials: !0 }
      );
      return {
        accessToken: r.data.access_token,
        tokenType: r.data.token_type,
        expiresIn: r.data.expires_in,
        scope: r.data.scope
      };
    } catch (r) {
      if (x.isAxiosError(r) && r.response?.status === 401)
        return null;
      throw r;
    }
  }
  /**
   * Logout - revokes session and clears cookies
   *
   * @returns Success indicator, or throws AuthError on failure
   */
  async logout() {
    try {
      return await x.post(
        `${I()}/bff/logout`,
        {},
        {
          withCredentials: !0
        }
      ), { success: !0 };
    } catch (r) {
      if (x.isAxiosError(r)) {
        const t = K(r);
        if (t)
          throw t;
      }
      throw r;
    }
  }
  /**
   * Initiate 2FA setup for a user
   * POSTs to /api/v1/auth/2fa/setup with a setup token.
   *
   * @param token - 2FA setup token from the backend
   * @returns TwoFactorSetupResponse with QR code and secret
   * @throws AxiosError with detail 'token_expired' if token has expired
   * @throws AxiosError with detail 'token_invalid' if token is invalid
   * @throws AxiosError with detail 'token_used' if token was already used
   * @security Response contains `secret` and `qr_code` — do not log, persist to storage, or send to error reporting
   */
  async setup2FA(r) {
    try {
      const t = await x.post(
        `${I()}/api/v1/auth/2fa/setup`,
        { token: r },
        { withCredentials: !0 }
      );
      return w.info("2FA setup initiated successfully"), t.data;
    } catch (t) {
      throw w.error("Failed to initiate 2FA setup", t), t;
    }
  }
  /**
   * Verify 2FA setup with a TOTP code
   * POSTs to /api/v1/auth/2fa/verify-setup with token and TOTP code.
   *
   * @param token - 2FA setup token
   * @param totpCode - TOTP code from authenticator app
   * @returns TwoFactorVerifyResponse with backup codes
   * @throws AxiosError with detail 'invalid totp code' if TOTP code is incorrect
   * @throws AxiosError with detail 'token_expired' if token has expired
   * @throws AxiosError with detail 'token_invalid' if token is invalid
   * @security Response contains `backup_codes` — do not log, persist to storage, or send to error reporting
   */
  async verify2FASetup(r, t) {
    try {
      const n = await x.post(
        `${I()}/api/v1/auth/2fa/verify-setup`,
        { token: r, totp_code: t },
        { withCredentials: !0 }
      );
      return w.info("2FA setup verified successfully"), n.data;
    } catch (n) {
      throw w.error("Failed to verify 2FA setup", n), n;
    }
  }
  /**
   * Resend 2FA setup email
   * POSTs to /api/v1/auth/2fa/resend-setup-email with user email and password.
   *
   * @param email - User email address
   * @param password - User password
   * @returns TwoFactorResendResponse with confirmation message
   * @throws AxiosError on failure (e.g., email not found, rate limited)
   */
  async resend2FASetupEmail(r, t) {
    try {
      const n = await x.post(
        `${I()}/api/v1/auth/2fa/resend-setup-email`,
        { email: r, password: t },
        { withCredentials: !0 }
      );
      return w.info("2FA setup email resent successfully"), n.data;
    } catch (n) {
      throw w.error("Failed to resend 2FA setup email", n), n;
    }
  }
}
const D = new Te();
function _r() {
  return D;
}
const G = P("JwtUtils");
function Se(e) {
  if (!e)
    return null;
  try {
    return le(e);
  } catch (r) {
    return G.warn("Failed to decode JWT token:", r), null;
  }
}
function hr(e) {
  const r = Se(e);
  return !r?.email || typeof r.email != "string" ? null : r.email;
}
function Ie(e) {
  if (!e)
    return null;
  try {
    const r = le(e);
    return !r.email || typeof r.email != "string" ? (G.warn("Decoded token missing required email field"), null) : !r.user_id || typeof r.user_id != "string" ? (G.warn("Decoded token missing required user_id field"), null) : Array.isArray(r.roles) ? r : (G.warn("Decoded token missing required roles field"), null);
  } catch (r) {
    return G.warn("Failed to decode access token:", r), null;
  }
}
const W = "gn-auth-login-circuit-breaker", he = 3, X = 120 * 1e3;
function Le() {
  try {
    const e = sessionStorage.getItem(W);
    if (!e) return null;
    const r = JSON.parse(e);
    return typeof r == "object" && r !== null && typeof r.count == "number" && Number.isFinite(r.count) && typeof r.firstAttemptAt == "number" && Number.isFinite(r.firstAttemptAt) ? r : null;
  } catch {
    return null;
  }
}
function Ue(e) {
  sessionStorage.setItem(W, JSON.stringify(e));
}
function ve(e = X) {
  const r = Le();
  return r ? Date.now() - r.firstAttemptAt > e ? (sessionStorage.removeItem(W), null) : r : null;
}
function pe(e = he, r = X) {
  try {
    const t = ve(r), n = Date.now(), o = t ? { count: t.count + 1, firstAttemptAt: t.firstAttemptAt } : { count: 1, firstAttemptAt: n };
    return Ue(o), o.count <= e;
  } catch {
    return !0;
  }
}
function ge() {
  try {
    sessionStorage.removeItem(W);
  } catch {
  }
}
function vr(e = he, r = X) {
  try {
    const t = ve(r);
    return t ? t.count >= e : !1;
  } catch {
    return !1;
  }
}
const se = 5, V = P("AuthStore");
let M = null;
const Q = Ae("auth", {
  state: () => ({
    isAuthenticated: !1,
    isLoading: !1,
    user: null,
    accessToken: null,
    tokenExpiresAt: null,
    error: null
  }),
  getters: {
    /**
     * Current authenticated user
     */
    currentUser: (e) => e.user,
    /**
     * Check if there's an active error
     */
    hasError: (e) => e.error !== null,
    /**
     * Decoded JWT access token with all claims.
     * Returns null if token is not available or invalid.
     */
    decodedToken: (e) => Ie(e.accessToken),
    /**
     * User email extracted from JWT access token.
     * Returns null if token is not available or email claim is missing.
     */
    userEmail() {
      return this.decodedToken?.email ?? this.user?.email ?? null;
    },
    /**
     * User roles from JWT access token.
     * Returns empty array if token is not available.
     */
    userRoles() {
      return this.decodedToken?.roles ?? [];
    },
    /**
     * User ID from JWT access token.
     * Returns null if token is not available.
     */
    userId() {
      return this.decodedToken?.user_id ?? null;
    },
    /**
     * User GUID from JWT access token.
     * Returns null if token is not available.
     */
    userGuid() {
      return this.decodedToken?.guid ?? null;
    },
    /**
     * Username from JWT access token.
     * Returns null if token is not available.
     */
    username() {
      return this.decodedToken?.username ?? null;
    },
    /**
     * Session ID from JWT access token.
     * Returns null if token is not available.
     */
    sessionId() {
      return this.decodedToken?.session_id ?? null;
    }
  },
  actions: {
    /**
     * Check if user has a specific role.
     *
     * @param role - The role to check for
     * @returns true if user has the specified role
     *
     * @example
     * ```typescript
     * if (authStore.hasRole('ROLE_AFFILIATE_ADMIN')) {
     *   // Show admin features
     * }
     * ```
     */
    hasRole(e) {
      return this.userRoles.includes(e);
    },
    /**
     * Check if token needs refresh (within 60s of expiry)
     * ADR-006: 60 second buffer before expiry
     *
     * NOTE: This is a method, NOT a getter, because Date.now() is not
     * a reactive dependency. Using a getter would cache stale results
     * and fail to detect token expiry after idle periods.
     */
    checkTokenNeedsRefresh() {
      if (!this.accessToken || !this.tokenExpiresAt)
        return !0;
      const e = 60 * 1e3;
      return Date.now() >= this.tokenExpiresAt - e;
    },
    /**
     * Initialize auth state on app startup
     * Call this in App.vue or main.ts
     */
    async initAuth() {
      this.isLoading = !0, this.error = null;
      try {
        const e = await D.checkAuth();
        this.isAuthenticated = e.isAuthenticated, this.user = e.user, e.isAuthenticated && ge(), e.isAuthenticated && T()?.mode !== "cookie" && await this.ensureValidToken();
      } catch (e) {
        if (V.error("Failed to initialize auth:", e), this.isAuthenticated = !1, this.user = null, e instanceof $)
          this.setError({
            type: "service_unavailable",
            message: e.message
          });
        else if (x.isAxiosError(e)) {
          const r = K(e, T()?.errorCodeOverrides);
          r && this.setError(r);
        }
      } finally {
        this.isLoading = !1;
      }
    },
    /**
     * Ensure we have a valid access token
     * ADR-006: Lazy refresh with 60s buffer, single concurrent refresh
     *
     * @returns Access token string or null if session expired
     */
    async ensureValidToken() {
      if (T()?.mode === "cookie")
        return null;
      if (this.accessToken && !this.checkTokenNeedsRefresh())
        return this.accessToken;
      if (M)
        return (await M)?.accessToken ?? null;
      M = this._refreshToken();
      try {
        return (await M)?.accessToken ?? null;
      } finally {
        M = null;
      }
    },
    /**
     * Internal: Refresh the access token
     * @private
     */
    async _refreshToken() {
      try {
        const e = await D.getAccessToken();
        return e ? !e.accessToken || e.accessToken.trim() === "" ? (V.error("Invalid token response: empty accessToken"), this.setError({
          type: "session_expired",
          message: "Invalid token received. Please sign in again."
        }), null) : ((typeof e.expiresIn != "number" || !Number.isFinite(e.expiresIn) || e.expiresIn < se) && (V.error(`Invalid expiresIn value: ${e.expiresIn}, using minimum`), e.expiresIn = se), this.accessToken = e.accessToken, this.tokenExpiresAt = Date.now() + e.expiresIn * 1e3, e) : (this.setError({
          type: "session_expired",
          message: "Your session has expired. Please sign in again."
        }), null);
      } catch (e) {
        return V.error("Token refresh failed:", e), e instanceof $ ? (this.setError({
          type: "service_unavailable",
          message: e.message
        }), null) : (this.setError({
          type: "session_expired",
          message: "Failed to refresh session. Please sign in again."
        }), null);
      }
    },
    /**
     * Initiate login flow - redirects to Central Login
     *
     * @param returnUrl - URL to return to after authentication
     */
    login(e) {
      this.isLoading = !0, this.error = null, D.login(e ? { returnUrl: e } : void 0);
    },
    /**
     * Logout - revoke session and reset state
     */
    async logout() {
      try {
        await D.logout();
      } catch (e) {
        V.error("Logout failed:", e);
      }
      this.$reset(), D.login();
    },
    /**
     * Set auth error state.
     *
     * Clears identity state (`isAuthenticated`, `user`, `accessToken`,
     * `tokenExpiresAt`) when the user's identity is no longer valid on this
     * session — currently `session_expired` and `account_blocked`.
     *
     * Operator-facing categories (`dev_error`, `server_error`) preserve auth
     * state so consumer telemetry keeps user context intact for bug reports.
     * `service_unavailable` is transient and never clears state.
     *
     * @param error - Auth error object
     *
     * @see PAT-004 Error type mapping
     */
    setError(e) {
      this.error = e, (e.type === "session_expired" || e.type === "account_blocked") && (this.isAuthenticated = !1, this.user = null, this.accessToken = null, this.tokenExpiresAt = null);
    },
    /**
     * Clear current error
     */
    clearError() {
      this.error = null;
    }
  }
});
function $e() {
  const e = Q(), r = s(() => e.isAuthenticated), t = s(() => e.isLoading), n = s(() => e.user), o = s(() => e.error), a = s(() => e.userEmail), l = s(() => e.decodedToken), d = s(() => e.userRoles), h = s(() => e.userId), _ = s(() => e.userGuid), g = s(() => e.username), v = s(() => e.sessionId);
  function p(F) {
    return e.hasRole(F);
  }
  function b(F) {
    e.login(F);
  }
  async function E() {
    await e.logout();
  }
  function k() {
    e.clearError();
  }
  return {
    // Reactive state
    isAuthenticated: r,
    isLoading: t,
    user: n,
    userEmail: a,
    error: o,
    // Decoded token getters
    decodedToken: l,
    userRoles: d,
    userId: h,
    userGuid: _,
    username: g,
    sessionId: v,
    // Actions
    login: b,
    logout: E,
    clearError: k,
    hasRole: p
  };
}
const Fe = {
  class: "bff-auth-overlay",
  role: "alertdialog",
  "aria-modal": "true",
  "aria-labelledby": "bff-auth-session-expired-title",
  "aria-describedby": "bff-auth-session-expired-message",
  "aria-live": "assertive",
  "data-testid": "session-expired-view"
}, Oe = { class: "bff-auth-overlay__content" }, Be = {
  key: 0,
  class: "bff-auth-overlay__icon",
  "aria-hidden": "true"
}, De = {
  id: "bff-auth-session-expired-title",
  class: "bff-auth-overlay__title"
}, Pe = {
  id: "bff-auth-session-expired-message",
  class: "bff-auth-overlay__message"
}, Re = { class: "bff-auth-overlay__actions" }, Ne = ["disabled", "aria-busy"], Ve = {
  key: 0,
  class: "bff-auth-overlay__button-icon",
  "aria-hidden": "true"
}, Me = "Session expired", Ge = "Your session has ended. Sign in again to continue.", je = "Sign in", qe = /* @__PURE__ */ U({
  name: "SessionExpiredView",
  __name: "SessionExpiredView",
  props: {
    error: {},
    onSignIn: { type: Function },
    config: {}
  },
  setup(e, { expose: r }) {
    const t = e, n = s(() => t.config.text.sessionExpired?.title ?? Me), o = s(
      () => t.config.text.sessionExpired?.message ?? t.error.message ?? Ge
    ), a = s(() => t.config.text.sessionExpired?.button ?? je), l = s(() => t.config.icons.sessionExpired), d = s(() => t.config.icons.login), h = A(!1), _ = A(null);
    r({ primaryAction: _ });
    async function g() {
      if (!h.value) {
        h.value = !0;
        try {
          await t.onSignIn();
        } finally {
          h.value = !1;
        }
      }
    }
    return (v, p) => (u(), m("div", Fe, [
      c("div", Oe, [
        l.value ? (u(), m("div", Be, [
          (u(), S(L(l.value)))
        ])) : C("", !0),
        c("h1", De, y(n.value), 1),
        c("p", Pe, y(o.value), 1),
        c("div", Re, [
          c("button", {
            ref_key: "signInButton",
            ref: _,
            type: "button",
            class: "bff-auth-overlay__button bff-auth-overlay__button--primary",
            disabled: h.value,
            "aria-busy": h.value,
            "data-testid": "session-expired-sign-in-button",
            onClick: g
          }, [
            d.value ? (u(), m("span", Ve, [
              (u(), S(L(d.value)))
            ])) : C("", !0),
            c("span", null, y(a.value), 1)
          ], 8, Ne)
        ])
      ])
    ]));
  }
}), He = {
  class: "bff-auth-overlay",
  role: "alertdialog",
  "aria-modal": "true",
  "aria-labelledby": "bff-auth-service-unavailable-title",
  "aria-describedby": "bff-auth-service-unavailable-message",
  "aria-live": "assertive",
  "data-testid": "service-unavailable-view"
}, Ye = { class: "bff-auth-overlay__content" }, ze = {
  key: 0,
  class: "bff-auth-overlay__icon bff-auth-overlay__icon--danger",
  "aria-hidden": "true"
}, Ze = {
  id: "bff-auth-service-unavailable-title",
  class: "bff-auth-overlay__title"
}, We = {
  id: "bff-auth-service-unavailable-message",
  class: "bff-auth-overlay__message"
}, Je = { class: "bff-auth-overlay__progress-wrapper" }, Ke = ["aria-valuenow"], Xe = {
  class: "bff-auth-overlay__countdown",
  "data-testid": "countdown-text"
}, Qe = { class: "bff-auth-overlay__actions" }, et = ["disabled", "aria-busy"], tt = "Service unavailable", rt = "We're having trouble connecting to authentication services.", nt = "Try now", ot = "Retrying...", H = 30, it = /* @__PURE__ */ U({
  name: "ServiceUnavailableView",
  __name: "ServiceUnavailableView",
  props: {
    error: {},
    onRetry: { type: Function },
    config: {}
  },
  setup(e, { expose: r }) {
    const t = e, n = (f) => `Retry in ${f}s`, o = s(() => t.config.text.serviceUnavailable?.title ?? tt), a = s(
      () => t.config.text.serviceUnavailable?.message ?? t.error.message ?? rt
    ), l = s(
      () => t.config.text.serviceUnavailable?.button ?? nt
    ), d = s(
      () => t.config.text.serviceUnavailable?.retryingLabel ?? ot
    ), h = s(
      () => t.config.text.serviceUnavailable?.countdownLabel ?? n
    ), _ = s(() => t.config.icons.serviceUnavailable), g = s(() => t.config.icons.retry), v = A(H), p = A(!1), b = A(null);
    let E = null, k = !1;
    r({ primaryAction: b });
    const F = s(
      () => Math.min(
        100,
        Math.max(0, Math.floor((H - v.value) / H * 100))
      )
    ), j = s(() => h.value(v.value));
    function O() {
      E && (clearInterval(E), E = null);
    }
    function q() {
      O(), v.value = H, E = setInterval(() => {
        v.value > 0 && (v.value--, v.value === 0 && (O(), N()));
      }, 1e3);
    }
    async function N() {
      if (!p.value) {
        p.value = !0, O();
        try {
          await t.onRetry();
        } finally {
          p.value = !1, k || q();
        }
      }
    }
    function i() {
      N();
    }
    return q(), ce(() => {
      k = !0, O();
    }), (f, J) => (u(), m("div", He, [
      c("div", Ye, [
        _.value ? (u(), m("div", ze, [
          (u(), S(L(_.value)))
        ])) : C("", !0),
        c("h1", Ze, y(o.value), 1),
        c("p", We, y(a.value), 1),
        c("div", Je, [
          c("div", {
            class: "bff-auth-overlay__progress",
            role: "progressbar",
            "aria-valuenow": F.value,
            "aria-valuemin": "0",
            "aria-valuemax": "100",
            "data-testid": "countdown-progress-bar"
          }, [
            c("div", {
              class: "bff-auth-overlay__progress-bar",
              style: ye({ width: F.value + "%" })
            }, null, 4)
          ], 8, Ke),
          c("p", Xe, [
            p.value ? (u(), m(te, { key: 0 }, [
              re(y(d.value), 1)
            ], 64)) : (u(), m(te, { key: 1 }, [
              re(y(j.value), 1)
            ], 64))
          ])
        ]),
        c("div", Qe, [
          c("button", {
            ref_key: "tryNowButton",
            ref: b,
            type: "button",
            class: ne(["bff-auth-overlay__button bff-auth-overlay__button--primary", { "bff-auth-overlay__button--loading": p.value }]),
            disabled: p.value,
            "aria-busy": p.value,
            "data-testid": "try-now-button",
            onClick: i
          }, [
            g.value ? (u(), m("span", {
              key: 0,
              class: ne(["bff-auth-overlay__button-icon", { "bff-auth-overlay__button-icon--spin": p.value }]),
              "aria-hidden": "true"
            }, [
              (u(), S(L(g.value)))
            ], 2)) : C("", !0),
            c("span", null, y(l.value), 1)
          ], 10, et)
        ])
      ])
    ]));
  }
}), st = {
  class: "bff-auth-overlay",
  role: "alertdialog",
  "aria-modal": "true",
  "aria-labelledby": "bff-auth-dev-error-title",
  "aria-describedby": "bff-auth-dev-error-message",
  "aria-live": "assertive",
  "data-testid": "dev-error-view"
}, at = { class: "bff-auth-overlay__content" }, ct = {
  key: 0,
  class: "bff-auth-overlay__icon bff-auth-overlay__icon--danger",
  "aria-hidden": "true"
}, lt = {
  id: "bff-auth-dev-error-title",
  class: "bff-auth-overlay__title"
}, ut = {
  id: "bff-auth-dev-error-message",
  class: "bff-auth-overlay__message"
}, dt = {
  class: "bff-auth-overlay__message",
  "data-testid": "dev-error-contact-line"
}, ft = {
  key: 1,
  class: "bff-auth-overlay__code",
  "data-testid": "dev-error-code"
}, _t = { class: "bff-auth-overlay__actions" }, ht = ["disabled", "aria-busy"], vt = {
  key: 0,
  class: "bff-auth-overlay__button-icon",
  "aria-hidden": "true"
}, pt = "Configuration error", gt = "The application is not correctly configured to connect to authentication services.", mt = "Contact the application developer.", yt = "Sign out", bt = /* @__PURE__ */ U({
  name: "DevErrorView",
  __name: "DevErrorView",
  props: {
    error: {},
    onSignOut: { type: Function },
    config: {}
  },
  setup(e, { expose: r }) {
    const t = e, n = s(() => t.config.text.devError?.title ?? pt), o = s(
      () => t.config.text.devError?.message ?? t.error.message ?? gt
    ), a = s(
      () => t.config.text.devError?.contactLine ?? mt
    ), l = s(
      () => t.config.text.devError?.signOut ?? yt
    ), d = s(() => t.config.icons.devError), h = s(() => t.config.icons.signOut), _ = s(() => t.error.code ?? null), g = A(!1), v = A(null);
    r({ primaryAction: v });
    async function p() {
      if (!g.value) {
        g.value = !0;
        try {
          await t.onSignOut();
        } finally {
          g.value = !1;
        }
      }
    }
    return (b, E) => (u(), m("div", st, [
      c("div", at, [
        d.value ? (u(), m("div", ct, [
          (u(), S(L(d.value)))
        ])) : C("", !0),
        c("h1", lt, y(n.value), 1),
        c("p", ut, y(o.value), 1),
        c("p", dt, y(a.value), 1),
        _.value ? (u(), m("p", ft, [
          E[0] || (E[0] = c("span", { class: "bff-auth-overlay__code-label" }, "Error code:", -1)),
          c("code", null, y(_.value), 1)
        ])) : C("", !0),
        c("div", _t, [
          c("button", {
            ref_key: "signOutButton",
            ref: v,
            type: "button",
            class: "bff-auth-overlay__button bff-auth-overlay__button--primary",
            disabled: g.value,
            "aria-busy": g.value,
            "data-testid": "dev-error-sign-out-button",
            onClick: p
          }, [
            h.value ? (u(), m("span", vt, [
              (u(), S(L(h.value)))
            ])) : C("", !0),
            c("span", null, y(l.value), 1)
          ], 8, ht)
        ])
      ])
    ]));
  }
}), wt = {
  class: "bff-auth-overlay",
  role: "alertdialog",
  "aria-modal": "true",
  "aria-labelledby": "bff-auth-account-blocked-title",
  "aria-describedby": "bff-auth-account-blocked-message",
  "aria-live": "assertive",
  "data-testid": "account-blocked-view"
}, Et = { class: "bff-auth-overlay__content" }, At = {
  key: 0,
  class: "bff-auth-overlay__icon bff-auth-overlay__icon--danger",
  "aria-hidden": "true"
}, kt = {
  id: "bff-auth-account-blocked-title",
  class: "bff-auth-overlay__title"
}, xt = {
  id: "bff-auth-account-blocked-message",
  class: "bff-auth-overlay__message"
}, Ct = { class: "bff-auth-overlay__actions" }, Tt = ["disabled", "aria-busy"], St = {
  key: 0,
  class: "bff-auth-overlay__button-icon",
  "aria-hidden": "true"
}, It = "Account unavailable", Lt = "Your account has been disabled. Please contact your administrator for assistance.", Ut = "Access required", $t = "You don't have access to this feature. Please request access from your administrator.", Ft = "Sign out", Ot = /* @__PURE__ */ U({
  name: "AccountBlockedView",
  __name: "AccountBlockedView",
  props: {
    error: {},
    onSignOut: { type: Function },
    config: {}
  },
  setup(e, { expose: r }) {
    const t = e, n = s(
      () => t.error.code === "insufficient_permissions"
    ), o = s(() => n.value ? t.config.text.accountBlocked?.insufficientPermissionsTitle ?? Ut : t.config.text.accountBlocked?.title ?? It), a = s(() => n.value ? t.config.text.accountBlocked?.insufficientPermissionsMessage ?? t.error.message ?? $t : t.config.text.accountBlocked?.message ?? t.error.message ?? Lt), l = s(
      () => t.config.text.accountBlocked?.signOut ?? Ft
    ), d = s(() => t.config.icons.accountBlocked), h = s(() => t.config.icons.signOut), _ = A(!1), g = A(null);
    r({ primaryAction: g });
    async function v() {
      if (!_.value) {
        _.value = !0;
        try {
          await t.onSignOut();
        } finally {
          _.value = !1;
        }
      }
    }
    return (p, b) => (u(), m("div", wt, [
      c("div", Et, [
        d.value ? (u(), m("div", At, [
          (u(), S(L(d.value)))
        ])) : C("", !0),
        c("h1", kt, y(o.value), 1),
        c("p", xt, y(a.value), 1),
        c("div", Ct, [
          c("button", {
            ref_key: "signOutButton",
            ref: g,
            type: "button",
            class: "bff-auth-overlay__button bff-auth-overlay__button--primary",
            disabled: _.value,
            "aria-busy": _.value,
            "data-testid": "account-blocked-sign-out-button",
            onClick: v
          }, [
            h.value ? (u(), m("span", St, [
              (u(), S(L(h.value)))
            ])) : C("", !0),
            c("span", null, y(l.value), 1)
          ], 8, Tt)
        ])
      ])
    ]));
  }
}), Bt = {
  class: "bff-auth-overlay",
  role: "alertdialog",
  "aria-modal": "true",
  "aria-labelledby": "bff-auth-server-error-title",
  "aria-describedby": "bff-auth-server-error-message",
  "aria-live": "assertive",
  "data-testid": "server-error-view"
}, Dt = { class: "bff-auth-overlay__content" }, Pt = {
  key: 0,
  class: "bff-auth-overlay__icon bff-auth-overlay__icon--danger",
  "aria-hidden": "true"
}, Rt = {
  id: "bff-auth-server-error-title",
  class: "bff-auth-overlay__title"
}, Nt = {
  id: "bff-auth-server-error-message",
  class: "bff-auth-overlay__message"
}, Vt = { class: "bff-auth-overlay__actions" }, Mt = "Something went wrong", Gt = "An unexpected error occurred. Please contact your administrator for assistance.", jt = "Dismiss", qt = /* @__PURE__ */ U({
  name: "ServerErrorView",
  __name: "ServerErrorView",
  props: {
    error: {},
    config: {}
  },
  emits: ["dismiss"],
  setup(e, { expose: r, emit: t }) {
    const n = e, o = t, a = s(() => n.config.text.serverError?.title ?? Mt), l = s(
      () => n.config.text.serverError?.message ?? n.error.message ?? Gt
    ), d = s(
      () => n.config.text.serverError?.dismissButton ?? jt
    ), h = s(() => n.config.icons.serverError), _ = A(null);
    r({ primaryAction: _ });
    function g() {
      o("dismiss");
    }
    return (v, p) => (u(), m("div", Bt, [
      c("div", Dt, [
        h.value ? (u(), m("div", Pt, [
          (u(), S(L(h.value)))
        ])) : C("", !0),
        c("h1", Rt, y(a.value), 1),
        c("p", Nt, y(l.value), 1),
        c("div", Vt, [
          c("button", {
            ref_key: "dismissButton",
            ref: _,
            type: "button",
            class: "bff-auth-overlay__button bff-auth-overlay__button--primary",
            "data-testid": "server-error-dismiss-button",
            onClick: g
          }, [
            c("span", null, y(d.value), 1)
          ], 512)
        ])
      ])
    ]));
  }
}), Ht = /* @__PURE__ */ U({
  name: "AuthErrorBoundary",
  __name: "AuthErrorBoundary",
  setup(e) {
    const r = P("AuthErrorBoundary"), { error: t } = $e(), n = Q(), o = A(null), a = A(null), l = s(() => {
      const i = t.value?.type, f = T();
      return f ? i === "session_expired" ? f.errorViews.sessionExpired ?? qe : i === "service_unavailable" ? f.errorViews.serviceUnavailable ?? it : i === "dev_error" ? f.errorViews.devError ?? bt : i === "account_blocked" ? f.errorViews.accountBlocked ?? Ot : i === "server_error" ? f.errorViews.serverError ?? qt : null : null;
    }), d = s(() => {
      const i = t.value, f = T();
      return !i || !f ? null : i.type === "session_expired" ? {
        error: i,
        onSignIn: h,
        config: f
      } : i.type === "service_unavailable" ? {
        error: i,
        onRetry: v,
        config: f
      } : i.type === "dev_error" ? {
        error: i,
        onSignOut: _,
        config: f
      } : i.type === "account_blocked" ? {
        error: i,
        onSignOut: _,
        config: f
      } : i.type === "server_error" ? {
        error: i,
        config: f
      } : null;
    });
    function h() {
      if (!pe()) {
        r.warn("Login redirect circuit breaker tripped from session expired view"), n.setError({
          type: "service_unavailable",
          message: "Too many login attempts. Authentication service may be unavailable."
        });
        return;
      }
      r.info("User initiated re-authentication from session expired view");
      try {
        const i = window.location.href;
        n.login(i);
      } catch (i) {
        r.error("Failed to initiate login redirect", i);
      }
    }
    async function _() {
      r.info("User initiated sign-out from terminal view");
      try {
        await n.logout();
      } catch (i) {
        r.error("Sign-out failed from terminal view", i);
      } finally {
        n.clearError();
      }
    }
    function g() {
      r.info("User dismissed server_error overlay"), n.clearError();
    }
    async function v() {
      r.info("Attempting auth service retry");
      try {
        await n.initAuth(), n.isAuthenticated ? (n.clearError(), r.info("Auth retry successful, user authenticated")) : n.hasError || (n.setError({
          type: "session_expired",
          message: "Your session has ended. Sign in again to continue."
        }), r.info("Auth service reachable but session invalid"));
      } catch (i) {
        r.warn("Auth service retry failed", i);
      }
    }
    let p = null, b = null;
    function E() {
      p === null && (p = document.body.style.overflow, document.body.style.overflow = "hidden");
    }
    function k() {
      p !== null && (document.body.style.overflow = p, p = null);
    }
    function F() {
      b = document.activeElement ?? null;
    }
    function j() {
      if (b && typeof b.focus == "function")
        try {
          b.focus();
        } catch {
        }
      b = null;
    }
    function O() {
      const i = a.value;
      return i ? Array.from(i.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')) : [];
    }
    function q(i) {
      if (i.key !== "Tab") return;
      const f = O();
      if (f.length === 0) {
        i.preventDefault();
        return;
      }
      const J = f[0], ee = f[f.length - 1], R = document.activeElement;
      i.shiftKey ? (R === J || R === null || !a.value?.contains(R)) && (i.preventDefault(), ee.focus()) : (R === ee || R === null || !a.value?.contains(R)) && (i.preventDefault(), J.focus());
    }
    async function N() {
      await Ee();
      const i = o.value?.primaryAction;
      if (i && typeof i.focus == "function") {
        i.focus();
        return;
      }
      const f = O()[0];
      f && f.focus();
    }
    return oe(
      () => l.value !== null,
      (i, f) => {
        i && !f ? (F(), E(), N()) : !i && f && (k(), j());
      },
      { immediate: !0 }
    ), oe(
      () => t.value?.type,
      () => {
        l.value && N();
      }
    ), ce(() => {
      k(), j();
    }), (i, f) => (u(), S(be, { to: "body" }, [
      l.value && d.value ? (u(), m("div", {
        key: 0,
        ref_key: "overlayRoot",
        ref: a,
        class: "bff-auth-overlay-root",
        onKeydown: q
      }, [
        (u(), S(L(l.value), we({
          ref_key: "viewRef",
          ref: o
        }, d.value, { onDismiss: g }), null, 16))
      ], 544)) : C("", !0)
    ]));
  }
}), Yt = (e, r) => {
  const t = e.__vccOpts || e;
  for (const [n, o] of r)
    t[n] = o;
  return t;
}, zt = /* @__PURE__ */ Yt(Ht, [["__scopeId", "data-v-e9144b06"]]), Zt = {
  width: "24",
  height: "24",
  viewBox: "0 0 24 24",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
  "aria-hidden": "true"
}, Wt = /* @__PURE__ */ U({
  name: "IconSessionExpired",
  __name: "IconSessionExpired",
  setup(e) {
    return (r, t) => (u(), m("svg", Zt, [...t[0] || (t[0] = [
      c("path", {
        d: "M3.5 12C3.5 7.30558 7.30558 3.5 12 3.5C16.6944 3.5 20.5 7.30558 20.5 12C20.5 16.6944 16.6944 20.5 12 20.5C7.30558 20.5 3.5 16.6944 3.5 12ZM12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2ZM11.9931 6.64827C11.9435 6.28233 11.6295 6 11.25 6C10.836 6 10.5 6.336 10.5 6.75V12.75L10.5069 12.8517C10.5565 13.2177 10.8705 13.5 11.25 13.5H15.25L15.3517 13.4931C15.7177 13.4435 16 13.1295 16 12.75C16 12.336 15.664 12 15.25 12H12V6.75L11.9931 6.64827Z",
        fill: "currentColor"
      }, null, -1)
    ])]));
  }
}), Jt = {
  width: "24",
  height: "24",
  viewBox: "0 0 24 24",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
  "aria-hidden": "true"
}, ae = /* @__PURE__ */ U({
  name: "IconLogin",
  __name: "IconLogin",
  setup(e) {
    return (r, t) => (u(), m("svg", Jt, [...t[0] || (t[0] = [
      c("path", {
        d: "M13.2673 4.20889C12.9674 3.9232 12.4926 3.93475 12.2069 4.23467C11.9212 4.5346 11.9328 5.00933 12.2327 5.29502L18.4841 11.2496H3.75C3.33579 11.2496 3 11.5854 3 11.9996C3 12.4138 3.33579 12.7496 3.75 12.7496H18.4842L12.2327 18.7043C11.9328 18.99 11.9212 19.4648 12.2069 19.7647C12.4926 20.0646 12.9674 20.0762 13.2673 19.7905L20.6862 12.7238C20.8551 12.5629 20.9551 12.3576 20.9861 12.1443C20.9952 12.0975 21 12.0491 21 11.9996C21 11.9501 20.9952 11.9016 20.986 11.8547C20.955 11.6415 20.855 11.4364 20.6862 11.2756L13.2673 4.20889Z",
        fill: "currentColor"
      }, null, -1)
    ])]));
  }
}), Kt = {
  width: "24",
  height: "24",
  viewBox: "0 0 24 24",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
  "aria-hidden": "true"
}, Y = /* @__PURE__ */ U({
  name: "IconServiceUnavailable",
  __name: "IconServiceUnavailable",
  setup(e) {
    return (r, t) => (u(), m("svg", Kt, [...t[0] || (t[0] = [
      c("path", {
        d: "M3.28034 2.21968C2.98745 1.92678 2.51257 1.92677 2.21968 2.21966C1.92678 2.51255 1.92677 2.98743 2.21966 3.28032L6.85339 7.91414C6.47198 8.54894 6.20466 9.26014 6.07981 10.0194C3.79155 10.2313 2 12.1564 2 14.5C2 16.9853 4.01472 19 6.5 19H17.5C17.6415 19 17.7815 18.9935 17.9197 18.9807L20.7194 21.7805C21.0123 22.0734 21.4872 22.0734 21.7801 21.7805C22.073 21.4876 22.073 21.0127 21.7801 20.7198L3.28034 2.21968ZM16.4391 17.5H6.5C4.84315 17.5 3.5 16.1569 3.5 14.5C3.5 12.8431 4.84315 11.5 6.5 11.5H6.75585C7.15641 11.5 7.48627 11.1852 7.50502 10.7851C7.53463 10.1537 7.69446 9.55623 7.95827 9.01904L16.4391 17.5ZM20.5 14.5C20.5 15.2822 20.2007 15.9944 19.7103 16.5285L20.7716 17.5898C21.5331 16.7838 22 15.6964 22 14.5C22 12.1564 20.2085 10.2313 17.9202 10.0194C17.4519 7.17189 14.9798 5 12 5C10.9031 5 9.875 5.29431 8.99031 5.80828L10.1011 6.91911C10.6781 6.65018 11.3215 6.5 12 6.5C14.4132 6.5 16.3832 8.39994 16.495 10.7851C16.5137 11.1852 16.8436 11.5 17.2442 11.5H17.5C19.1569 11.5 20.5 12.8431 20.5 14.5Z",
        fill: "currentColor"
      }, null, -1)
    ])]));
  }
}), Xt = {
  width: "24",
  height: "24",
  viewBox: "0 0 24 24",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
  "aria-hidden": "true"
}, Qt = /* @__PURE__ */ U({
  name: "IconRetry",
  __name: "IconRetry",
  setup(e) {
    return (r, t) => (u(), m("svg", Xt, [...t[0] || (t[0] = [
      c("path", {
        d: "M12 4.5C7.85786 4.5 4.5 7.85786 4.5 12C4.5 16.1421 7.85786 19.5 12 19.5C16.1421 19.5 19.5 16.1421 19.5 12C19.5 11.6236 19.4723 11.2538 19.4188 10.8923C19.3515 10.4382 19.6839 10 20.1429 10C20.5138 10 20.839 10.2562 20.8953 10.6228C20.9642 11.0718 21 11.5317 21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C14.3051 3 16.4077 3.86656 18 5.29168V4.25C18 3.83579 18.3358 3.5 18.75 3.5C19.1642 3.5 19.5 3.83579 19.5 4.25V7.25C19.5 7.66421 19.1642 8 18.75 8H15.75C15.3358 8 15 7.66421 15 7.25C15 6.83579 15.3358 6.5 15.75 6.5H17.0991C15.7609 5.25883 13.9691 4.5 12 4.5Z",
        fill: "currentColor"
      }, null, -1)
    ])]));
  }
}), er = {
  sessionExpired: Wt,
  login: ae,
  serviceUnavailable: Y,
  retry: Qt,
  devError: Y,
  accountBlocked: Y,
  serverError: Y,
  signOut: ae
};
function tr(e) {
  if (!e.bffBaseUrl)
    throw new Error("bffAuthPlugin: bffBaseUrl is required");
  if (!e.clientId)
    throw new Error("bffAuthPlugin: clientId is required");
  if (e.mode !== void 0 && e.mode !== "token" && e.mode !== "cookie")
    throw new Error("bffAuthPlugin: mode must be 'token' or 'cookie'");
}
function rr(e) {
  const r = e.logger ?? P("BffAuth");
  return {
    bffBaseUrl: e.bffBaseUrl,
    clientId: e.clientId,
    logger: r,
    icons: { ...er, ...e.icons },
    errorViews: e.errorViews ?? {},
    text: e.text ?? {},
    mode: e.mode ?? "token",
    onUnmappedError: e.onUnmappedError,
    errorCodeOverrides: e.errorCodeOverrides
  };
}
const pr = {
  install(e, r) {
    tr(r);
    const t = rr(r);
    e.provide(ue, t), ke(t), e.component("AuthErrorBoundary", zt), t.logger.debug("BFF Auth plugin installed", {
      bffBaseUrl: t.bffBaseUrl,
      clientId: t.clientId,
      mode: t.mode
    });
  }
}, z = P("AuthInterceptors");
function gr(e, r) {
  e.interceptors.request.use(
    async (t) => {
      if (T()?.mode === "cookie")
        return t;
      const n = r();
      if (!n.isAuthenticated)
        return t;
      try {
        const o = await n.ensureValidToken();
        o && (t.headers.Authorization = `Bearer ${o}`);
      } catch (o) {
        if (o instanceof $)
          return n.setError({
            type: "service_unavailable",
            message: o.message
          }), Promise.reject(o);
        z.error("Failed to get auth token:", o instanceof Error ? o.message : "Unknown error");
      }
      return t;
    },
    (t) => Promise.reject(t)
  ), e.interceptors.response.use(
    (t) => t,
    async (t) => {
      const n = r(), o = t.response, a = o?.status ?? 0, l = T(), d = l?.errorCodeOverrides, h = l?.onUnmappedError, _ = o?.data ?? {}, g = _.error, v = typeof g == "string" && g.length > 0 ? g.toLowerCase() : null;
      if (a === 401 && !Z())
        return z.warn("401 received but auth is not configured, ignoring"), Promise.reject(t);
      const p = K(t, d);
      if (p)
        return n.setError(p), Promise.reject(t);
      if (v) {
        if (_e.has(v) || d && Object.prototype.hasOwnProperty.call(d, v))
          return Promise.reject(t);
        if (!Object.prototype.hasOwnProperty.call(fe, v) && h)
          try {
            Promise.resolve(h(v, a, t)).catch((k) => {
              z.warn("onUnmappedError hook rejected", k);
            });
          } catch (k) {
            z.warn("onUnmappedError hook threw", k);
          }
      }
      if (a === 429 && !v)
        return n.setError({
          type: "service_unavailable",
          code: "rate_limit_exceeded",
          message: _.error_description || "Too many requests. Please try again shortly."
        }), Promise.reject(t);
      const b = Ce(a);
      return b === "session_expired" ? n.setError({
        type: "session_expired",
        message: "Your session has expired. Please sign in again."
      }) : b === "service_unavailable" && a === 429 && n.setError({
        type: "service_unavailable",
        code: "rate_limit_exceeded",
        message: _.error_description || "Too many requests. Please try again shortly."
      }), Promise.reject(t);
    }
  );
}
const B = P("AuthGuard");
function nr(e) {
  return e.meta.public === !0;
}
async function or(e) {
  if (!e.isLoading)
    return !0;
  let r = 0;
  const t = 200;
  for (; e.isLoading && r < t; )
    await new Promise((n) => setTimeout(n, 50)), r++;
  return e.isLoading ? (B.warn("Auth initialization timed out after 10 seconds"), !1) : !0;
}
const ir = {
  getAuthStore: () => Q(),
  getAuthService: () => D
};
function sr(e = ir) {
  let r = !1;
  function t(n, o, a) {
    return pe() ? (n.login({ returnUrl: a }), !1) : (B.error("Login redirect circuit breaker tripped"), o.setError({
      type: "service_unavailable",
      message: "Too many login attempts. Authentication service may be unavailable."
    }), !0);
  }
  return async (n) => {
    const o = e.getAuthStore(), a = e.getAuthService();
    try {
      if (nr(n))
        return !0;
      if (!r) {
        r = !0;
        try {
          await o.initAuth();
        } catch (d) {
          B.error("Failed to initialize auth:", d);
        }
      }
      return await or(o) ? o.isAuthenticated ? (ge(), !0) : o.error && o.error.type !== "session_expired" ? (B.info("Terminal auth error set, skipping login redirect", {
        type: o.error.type,
        code: o.error.code
      }), !0) : t(a, o, n.fullPath) : (B.warn("Auth not ready, redirecting to login"), t(a, o, n.fullPath));
    } catch (l) {
      return l instanceof $ ? (B.error("Auth configuration error:", l.message), o.setError({
        type: "service_unavailable",
        message: l.message
      }), !0) : (B.error("Unexpected error in auth guard:", l), t(a, o, n.fullPath));
    }
  };
}
function mr(e) {
  e.beforeEach(sr());
}
export {
  $ as AuthConfigurationError,
  zt as AuthErrorBoundary,
  Te as AuthService,
  ue as BFF_AUTH_CONFIG_KEY,
  er as DEFAULT_ICONS,
  fe as ERROR_CODE_TO_TYPE,
  _e as KNOWN_INLINE_CODES,
  D as authService,
  pr as bffAuthPlugin,
  sr as createAuthGuard,
  Ie as decodeAccessToken,
  Se as decodeJwt,
  hr as extractEmailFromJwt,
  T as getGlobalConfig,
  Z as isAuthConfigured,
  vr as isCircuitBroken,
  xe as mapErrorCodeToType,
  K as parseAuthError,
  pe as recordLoginAttempt,
  ge as resetLoginAttempts,
  ke as setGlobalConfig,
  mr as setupAuthGuard,
  gr as setupAuthInterceptors,
  Ce as statusFallbackType,
  $e as useAuth,
  fr as useAuthConfig,
  _r as useAuthService,
  Q as useAuthStore
};
