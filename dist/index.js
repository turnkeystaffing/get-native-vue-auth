import { createLogger as U } from "@turnkeystaffing/get-native-vue-logger";
import { inject as he, computed as s, defineComponent as F, ref as S, openBlock as d, createElementBlock as m, createElementVNode as c, createBlock as P, resolveDynamicComponent as O, createCommentVNode as G, toDisplayString as I, watch as J, onBeforeUnmount as ie, normalizeStyle as pe, Fragment as Q, createTextVNode as ee, Teleport as ge, mergeProps as ve, nextTick as me } from "vue";
import { defineStore as ye } from "pinia";
import A from "axios";
import { jwtDecode as oe } from "jwt-decode";
const se = /* @__PURE__ */ Symbol("bff-auth-config");
let ae = null;
function _e(e) {
  ae = e;
}
function x() {
  return ae;
}
function kt() {
  const e = he(se);
  if (!e)
    throw new Error(
      "BFF Auth config not found. Did you forget to install the plugin with app.use(bffAuthPlugin, options)?"
    );
  return e;
}
const g = U("AuthService");
class k extends Error {
  constructor(r) {
    super(r), this.name = "AuthConfigurationError";
  }
}
function E() {
  return x()?.bffBaseUrl || "";
}
function te() {
  return x()?.clientId || "";
}
function Y() {
  const e = x();
  return !!(e?.bffBaseUrl && e?.clientId);
}
function we(e) {
  return {
    authentication_error: "session_expired",
    authorization_error: "permission_denied",
    auth_service_unavailable: "service_unavailable"
  }[e];
}
function ue(e) {
  if (!e.response?.data?.error_type)
    return null;
  const r = e.response.data, t = {
    type: we(r.error_type),
    message: r.detail
  };
  return r.retry_after !== void 0 && (t.retryAfter = r.retry_after), t;
}
class be {
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
  async submitCredentials(r, t, i) {
    try {
      const n = { email: r, password: t };
      i !== void 0 && (n.totp_code = i), await A.post(
        `${E()}/api/v1/oauth/login`,
        n,
        { withCredentials: !0 }
        // Include cookies for session handling
      ), g.info("Credentials submitted successfully");
    } catch (n) {
      throw g.error("Failed to submit credentials", n), n;
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
    if (!Y())
      throw new k(
        "Authentication service is not configured. Please contact your administrator."
      );
    try {
      return {
        isAuthenticated: !0,
        user: (await A.get(`${E()}/bff/userinfo`, {
          withCredentials: !0
          // Include bff_session cookie
        })).data
      };
    } catch (r) {
      if (A.isAxiosError(r) && r.response?.status === 401)
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
    if (!Y())
      throw g.error("Cannot initiate login: Auth configuration is incomplete"), new k(
        "Authentication service is not configured. Please contact your administrator."
      );
    const i = t.returnUrl || window.location.href;
    let n;
    try {
      n = new URL(i, window.location.origin);
    } catch {
      g.warn("Malformed returnUrl, falling back to current page:", i), n = new URL(window.location.href);
    }
    n.origin !== window.location.origin && (g.warn("Blocked external redirect attempt:", i), n = new URL("/", window.location.origin));
    const a = n.href, u = `${E()}/bff/login`, f = new URLSearchParams({
      client_id: te(),
      redirect_url: a
    });
    g.debug("Initiating login redirect", { returnUrl: a }), window.location.href = `${u}?${f.toString()}`;
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
    const { clientId: t, returnUrl: i } = r, n = t.trim();
    if (!n)
      throw new Error("clientId must not be empty");
    let a;
    try {
      a = new URL(i);
    } catch {
      throw new Error("returnUrl is not a valid URL");
    }
    if (a.protocol !== "http:" && a.protocol !== "https:")
      throw new Error("returnUrl must use http or https scheme");
    const u = E();
    if (!u)
      throw new k("BFF base URL is not configured.");
    const f = `${u}/bff/login`, p = new URLSearchParams({
      client_id: n,
      redirect_url: i
    });
    g.debug("Initiating custom client login redirect", { clientId: n, returnUrl: i }), window.location.href = `${f}?${p.toString()}`;
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
    const { clientId: t, returnUrl: i } = r;
    if (!t || !i)
      throw new Error("completeOAuthFlow requires both clientId and returnUrl");
    const n = `${E()}/bff/login`, a = new URLSearchParams({
      client_id: t,
      redirect_url: i
    });
    g.debug("Completing OAuth flow", { clientId: t, returnUrl: i }), window.location.href = `${n}?${a.toString()}`;
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
    if (x()?.mode === "cookie")
      throw new k(
        "getAccessToken() is not available in cookie mode. Token management is handled by the BFF proxy via cookies."
      );
    if (!Y())
      throw new k(
        "Authentication service is not configured. Please contact your administrator."
      );
    try {
      const r = await A.post(
        `${E()}/bff/token`,
        { client_id: te() },
        { withCredentials: !0 }
      );
      return {
        accessToken: r.data.access_token,
        tokenType: r.data.token_type,
        expiresIn: r.data.expires_in,
        scope: r.data.scope
      };
    } catch (r) {
      if (A.isAxiosError(r) && r.response?.status === 401)
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
      return await A.post(
        `${E()}/bff/logout`,
        {},
        {
          withCredentials: !0
        }
      ), { success: !0 };
    } catch (r) {
      if (A.isAxiosError(r)) {
        const t = ue(r);
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
      const t = await A.post(
        `${E()}/api/v1/auth/2fa/setup`,
        { token: r },
        { withCredentials: !0 }
      );
      return g.info("2FA setup initiated successfully"), t.data;
    } catch (t) {
      throw g.error("Failed to initiate 2FA setup", t), t;
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
      const i = await A.post(
        `${E()}/api/v1/auth/2fa/verify-setup`,
        { token: r, totp_code: t },
        { withCredentials: !0 }
      );
      return g.info("2FA setup verified successfully"), i.data;
    } catch (i) {
      throw g.error("Failed to verify 2FA setup", i), i;
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
      const i = await A.post(
        `${E()}/api/v1/auth/2fa/resend-setup-email`,
        { email: r, password: t },
        { withCredentials: !0 }
      );
      return g.info("2FA setup email resent successfully"), i.data;
    } catch (i) {
      throw g.error("Failed to resend 2FA setup email", i), i;
    }
  }
}
const L = new be();
function xt() {
  return L;
}
const V = U("JwtUtils");
function Ae(e) {
  if (!e)
    return null;
  try {
    return oe(e);
  } catch (r) {
    return V.warn("Failed to decode JWT token:", r), null;
  }
}
function Tt(e) {
  const r = Ae(e);
  return !r?.email || typeof r.email != "string" ? null : r.email;
}
function Ee(e) {
  if (!e)
    return null;
  try {
    const r = oe(e);
    return !r.email || typeof r.email != "string" ? (V.warn("Decoded token missing required email field"), null) : !r.user_id || typeof r.user_id != "string" ? (V.warn("Decoded token missing required user_id field"), null) : Array.isArray(r.roles) ? r : (V.warn("Decoded token missing required roles field"), null);
  } catch (r) {
    return V.warn("Failed to decode access token:", r), null;
  }
}
const Z = "gn-auth-login-circuit-breaker", le = 3, K = 120 * 1e3;
function Ce() {
  try {
    const e = sessionStorage.getItem(Z);
    if (!e) return null;
    const r = JSON.parse(e);
    return typeof r == "object" && r !== null && typeof r.count == "number" && Number.isFinite(r.count) && typeof r.firstAttemptAt == "number" && Number.isFinite(r.firstAttemptAt) ? r : null;
  } catch {
    return null;
  }
}
function ke(e) {
  sessionStorage.setItem(Z, JSON.stringify(e));
}
function ce(e = K) {
  const r = Ce();
  return r ? Date.now() - r.firstAttemptAt > e ? (sessionStorage.removeItem(Z), null) : r : null;
}
function de(e = le, r = K) {
  try {
    const t = ce(r), i = Date.now(), n = t ? { count: t.count + 1, firstAttemptAt: t.firstAttemptAt } : { count: 1, firstAttemptAt: i };
    return ke(n), n.count <= e;
  } catch {
    return !0;
  }
}
function fe() {
  try {
    sessionStorage.removeItem(Z);
  } catch {
  }
}
function It(e = le, r = K) {
  try {
    const t = ce(r);
    return t ? t.count >= e : !1;
  } catch {
    return !1;
  }
}
const re = 5, N = U("AuthStore");
let M = null;
const W = ye("auth", {
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
    decodedToken: (e) => Ee(e.accessToken),
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
        const e = await L.checkAuth();
        this.isAuthenticated = e.isAuthenticated, this.user = e.user, e.isAuthenticated && fe(), e.isAuthenticated && x()?.mode !== "cookie" && await this.ensureValidToken();
      } catch (e) {
        N.error("Failed to initialize auth:", e), this.isAuthenticated = !1, this.user = null, e instanceof k && this.setError({
          type: "service_unavailable",
          message: e.message
        });
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
      if (x()?.mode === "cookie")
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
        const e = await L.getAccessToken();
        return e ? !e.accessToken || e.accessToken.trim() === "" ? (N.error("Invalid token response: empty accessToken"), this.setError({
          type: "session_expired",
          message: "Invalid token received. Please sign in again."
        }), null) : ((typeof e.expiresIn != "number" || !Number.isFinite(e.expiresIn) || e.expiresIn < re) && (N.error(`Invalid expiresIn value: ${e.expiresIn}, using minimum`), e.expiresIn = re), this.accessToken = e.accessToken, this.tokenExpiresAt = Date.now() + e.expiresIn * 1e3, e) : (this.setError({
          type: "session_expired",
          message: "Your session has expired. Please sign in again."
        }), null);
      } catch (e) {
        return N.error("Token refresh failed:", e), e instanceof k ? (this.setError({
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
      this.isLoading = !0, this.error = null, L.login(e ? { returnUrl: e } : void 0);
    },
    /**
     * Logout - revoke session and reset state
     */
    async logout() {
      try {
        await L.logout();
      } catch (e) {
        N.error("Logout failed:", e);
      }
      this.$reset(), L.login();
    },
    /**
     * Set auth error state
     * Also sets isAuthenticated to false for session_expired
     *
     * @param error - Auth error object
     */
    setError(e) {
      this.error = e, e.type === "session_expired" && (this.isAuthenticated = !1, this.user = null, this.accessToken = null, this.tokenExpiresAt = null);
    },
    /**
     * Clear current error
     */
    clearError() {
      this.error = null;
    }
  }
});
function xe() {
  const e = W(), r = s(() => e.isAuthenticated), t = s(() => e.isLoading), i = s(() => e.user), n = s(() => e.error), a = s(() => e.userEmail), u = s(() => e.decodedToken), f = s(() => e.userRoles), p = s(() => e.userId), C = s(() => e.userGuid), T = s(() => e.username), y = s(() => e.sessionId);
  function v(w) {
    return e.hasRole(w);
  }
  function b(w) {
    e.login(w);
  }
  async function _() {
    await e.logout();
  }
  function R() {
    e.clearError();
  }
  return {
    // Reactive state
    isAuthenticated: r,
    isLoading: t,
    user: i,
    userEmail: a,
    error: n,
    // Decoded token getters
    decodedToken: u,
    userRoles: f,
    userId: p,
    userGuid: C,
    username: T,
    sessionId: y,
    // Actions
    login: b,
    logout: _,
    clearError: R,
    hasRole: v
  };
}
const Te = {
  class: "bff-auth-overlay",
  role: "alertdialog",
  "aria-modal": "true",
  "aria-labelledby": "bff-auth-session-expired-title",
  "aria-describedby": "bff-auth-session-expired-message",
  "aria-live": "assertive",
  "data-testid": "session-expired-view"
}, Ie = { class: "bff-auth-overlay__content" }, Se = {
  key: 0,
  class: "bff-auth-overlay__icon",
  "aria-hidden": "true"
}, Le = {
  id: "bff-auth-session-expired-title",
  class: "bff-auth-overlay__title"
}, Ue = {
  id: "bff-auth-session-expired-message",
  class: "bff-auth-overlay__message"
}, Fe = { class: "bff-auth-overlay__actions" }, Re = ["disabled", "aria-busy"], $e = {
  key: 0,
  class: "bff-auth-overlay__button-icon",
  "aria-hidden": "true"
}, Be = "Session expired", Pe = "Your session has ended. Sign in again to continue.", De = "Sign in", Ne = /* @__PURE__ */ F({
  name: "SessionExpiredView",
  __name: "SessionExpiredView",
  props: {
    error: {},
    onSignIn: { type: Function },
    config: {}
  },
  setup(e, { expose: r }) {
    const t = e, i = s(() => t.config.text.sessionExpired?.title ?? Be), n = s(
      () => t.config.text.sessionExpired?.message ?? t.error.message ?? Pe
    ), a = s(() => t.config.text.sessionExpired?.button ?? De), u = s(() => t.config.icons.sessionExpired), f = s(() => t.config.icons.login), p = S(!1), C = S(null);
    r({ primaryAction: C });
    async function T() {
      if (!p.value) {
        p.value = !0;
        try {
          await t.onSignIn();
        } finally {
          p.value = !1;
        }
      }
    }
    return (y, v) => (d(), m("div", Te, [
      c("div", Ie, [
        u.value ? (d(), m("div", Se, [
          (d(), P(O(u.value)))
        ])) : G("", !0),
        c("h1", Le, I(i.value), 1),
        c("p", Ue, I(n.value), 1),
        c("div", Fe, [
          c("button", {
            ref_key: "signInButton",
            ref: C,
            type: "button",
            class: "bff-auth-overlay__button bff-auth-overlay__button--primary",
            disabled: p.value,
            "aria-busy": p.value,
            "data-testid": "session-expired-sign-in-button",
            onClick: T
          }, [
            f.value ? (d(), m("span", $e, [
              (d(), P(O(f.value)))
            ])) : G("", !0),
            c("span", null, I(a.value), 1)
          ], 8, Re)
        ])
      ])
    ]));
  }
}), X = (e, r) => {
  const t = e.__vccOpts || e;
  for (const [i, n] of r)
    t[i] = n;
  return t;
}, Me = /* @__PURE__ */ X(Ne, [["__scopeId", "data-v-ee55e1a2"]]), Ve = {
  class: "bff-auth-overlay",
  role: "alertdialog",
  "aria-modal": "true",
  "aria-labelledby": "bff-auth-service-unavailable-title",
  "aria-describedby": "bff-auth-service-unavailable-message",
  "aria-live": "assertive",
  "data-testid": "service-unavailable-view"
}, Oe = { class: "bff-auth-overlay__content" }, Ge = {
  key: 0,
  class: "bff-auth-overlay__icon bff-auth-overlay__icon--danger",
  "aria-hidden": "true"
}, He = {
  id: "bff-auth-service-unavailable-title",
  class: "bff-auth-overlay__title"
}, ze = {
  id: "bff-auth-service-unavailable-message",
  class: "bff-auth-overlay__message"
}, je = ["aria-valuenow"], qe = {
  class: "bff-auth-overlay__countdown",
  "data-testid": "countdown-text"
}, Ye = { class: "bff-auth-overlay__actions" }, Ze = ["disabled", "aria-busy"], Je = {
  key: 0,
  class: "bff-auth-overlay__button-icon",
  "aria-hidden": "true"
}, Ke = "Service unavailable", We = "We're having trouble connecting to authentication services.", Xe = "Try now", Qe = "Retrying...", et = /* @__PURE__ */ F({
  name: "ServiceUnavailableView",
  __name: "ServiceUnavailableView",
  props: {
    error: {},
    onRetry: { type: Function },
    config: {},
    retryAfter: {}
  },
  setup(e, { expose: r }) {
    const t = e, i = (h) => `Retry in ${h}s`, n = s(() => t.config.text.serviceUnavailable?.title ?? Ke), a = s(
      () => t.config.text.serviceUnavailable?.message ?? t.error.message ?? We
    ), u = s(
      () => t.config.text.serviceUnavailable?.button ?? Xe
    ), f = s(
      () => t.config.text.serviceUnavailable?.retryingLabel ?? Qe
    ), p = s(
      () => t.config.text.serviceUnavailable?.countdownLabel ?? i
    ), C = s(() => t.config.icons.serviceUnavailable), T = s(() => t.config.icons.retry);
    function y(h) {
      return !Number.isFinite(h) || h < 0 ? 30 : Math.floor(h);
    }
    const v = S(y(t.retryAfter)), b = S(y(t.retryAfter)), _ = S(!1), R = S(null);
    let w = null, D = !1;
    r({ primaryAction: R });
    const H = s(() => v.value <= 0 ? 0 : Math.min(
      100,
      Math.max(0, Math.floor((v.value - b.value) / v.value * 100))
    )), z = s(() => p.value(b.value));
    function o() {
      w && (clearInterval(w), w = null);
    }
    function l(h) {
      o();
      const q = y(h);
      if (v.value = q, b.value = q, q <= 0) {
        $();
        return;
      }
      w = setInterval(() => {
        b.value > 0 && (b.value--, b.value === 0 && (o(), $()));
      }, 1e3);
    }
    async function $() {
      if (!_.value) {
        _.value = !0, o();
        try {
          await t.onRetry();
        } finally {
          _.value = !1, D || l(t.retryAfter);
        }
      }
    }
    function j() {
      $();
    }
    return J(
      () => t.retryAfter,
      (h) => {
        l(h);
      },
      { immediate: !0 }
    ), ie(() => {
      D = !0, o();
    }), (h, q) => (d(), m("div", Ve, [
      c("div", Oe, [
        C.value ? (d(), m("div", Ge, [
          (d(), P(O(C.value)))
        ])) : G("", !0),
        c("h1", He, I(n.value), 1),
        c("p", ze, I(a.value), 1),
        c("div", {
          class: "bff-auth-overlay__progress",
          role: "progressbar",
          "aria-valuenow": H.value,
          "aria-valuemin": "0",
          "aria-valuemax": "100",
          "data-testid": "countdown-progress-bar"
        }, [
          c("div", {
            class: "bff-auth-overlay__progress-bar",
            style: pe({ width: H.value + "%" })
          }, null, 4)
        ], 8, je),
        c("p", qe, [
          _.value ? (d(), m(Q, { key: 0 }, [
            ee(I(f.value), 1)
          ], 64)) : (d(), m(Q, { key: 1 }, [
            ee(I(z.value), 1)
          ], 64))
        ]),
        c("div", Ye, [
          c("button", {
            ref_key: "tryNowButton",
            ref: R,
            type: "button",
            class: "bff-auth-overlay__button bff-auth-overlay__button--primary",
            disabled: _.value,
            "aria-busy": _.value,
            "data-testid": "try-now-button",
            onClick: j
          }, [
            T.value ? (d(), m("span", Je, [
              (d(), P(O(T.value)))
            ])) : G("", !0),
            c("span", null, I(u.value), 1)
          ], 8, Ze)
        ])
      ])
    ]));
  }
}), tt = /* @__PURE__ */ X(et, [["__scopeId", "data-v-1ee962d8"]]), rt = 30, nt = /* @__PURE__ */ F({
  name: "AuthErrorBoundary",
  __name: "AuthErrorBoundary",
  setup(e) {
    function r(o) {
      return typeof o != "number" || !Number.isFinite(o) || o < 0 ? rt : Math.floor(o);
    }
    const t = U("AuthErrorBoundary"), { error: i } = xe(), n = W(), a = S(null), u = S(null), f = s(() => {
      const o = i.value?.type, l = x();
      return l ? o === "session_expired" ? l.errorViews.sessionExpired ?? Me : o === "service_unavailable" ? l.errorViews.serviceUnavailable ?? tt : null : null;
    }), p = s(() => {
      const o = i.value, l = x();
      return !o || !l ? null : o.type === "session_expired" ? {
        error: o,
        onSignIn: C,
        config: l
      } : o.type === "service_unavailable" ? {
        error: o,
        onRetry: T,
        config: l,
        retryAfter: r(o.retryAfter)
      } : null;
    });
    function C() {
      if (!de()) {
        t.warn("Login redirect circuit breaker tripped from session expired view"), n.setError({
          type: "service_unavailable",
          message: "Too many login attempts. Authentication service may be unavailable."
        });
        return;
      }
      t.info("User initiated re-authentication from session expired view");
      try {
        const o = window.location.href;
        n.login(o);
      } catch (o) {
        t.error("Failed to initiate login redirect", o);
      }
    }
    async function T() {
      t.info("Attempting auth service retry");
      try {
        await n.initAuth(), n.isAuthenticated ? (n.clearError(), t.info("Auth retry successful, user authenticated")) : n.hasError || (n.setError({
          type: "session_expired",
          message: "Your session has ended. Sign in again to continue."
        }), t.info("Auth service reachable but session invalid"));
      } catch (o) {
        t.warn("Auth service retry failed", o);
      }
    }
    let y = null, v = null;
    function b() {
      y === null && (y = document.body.style.overflow, document.body.style.overflow = "hidden");
    }
    function _() {
      y !== null && (document.body.style.overflow = y, y = null);
    }
    function R() {
      v = document.activeElement ?? null;
    }
    function w() {
      if (v && typeof v.focus == "function")
        try {
          v.focus();
        } catch {
        }
      v = null;
    }
    function D() {
      const o = u.value;
      return o ? Array.from(o.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')) : [];
    }
    function H(o) {
      if (o.key !== "Tab") return;
      const l = D();
      if (l.length === 0) {
        o.preventDefault();
        return;
      }
      const $ = l[0], j = l[l.length - 1], h = document.activeElement;
      o.shiftKey ? (h === $ || h === null || !u.value?.contains(h)) && (o.preventDefault(), j.focus()) : (h === j || h === null || !u.value?.contains(h)) && (o.preventDefault(), $.focus());
    }
    async function z() {
      await me();
      const o = a.value?.primaryAction;
      if (o && typeof o.focus == "function") {
        o.focus();
        return;
      }
      const l = D()[0];
      l && l.focus();
    }
    return J(
      () => f.value !== null,
      (o, l) => {
        o && !l ? (R(), b(), z()) : !o && l && (_(), w());
      },
      { immediate: !0 }
    ), J(
      () => i.value?.type,
      () => {
        f.value && z();
      }
    ), ie(() => {
      _(), w();
    }), (o, l) => (d(), P(ge, { to: "body" }, [
      f.value && p.value ? (d(), m("div", {
        key: 0,
        ref_key: "overlayRoot",
        ref: u,
        class: "bff-auth-overlay-root",
        onKeydown: H
      }, [
        (d(), P(O(f.value), ve({
          ref_key: "viewRef",
          ref: a
        }, p.value), null, 16))
      ], 544)) : G("", !0)
    ]));
  }
}), it = /* @__PURE__ */ X(nt, [["__scopeId", "data-v-7748e4b4"]]), ot = {
  width: "24",
  height: "24",
  viewBox: "0 0 24 24",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
  "aria-hidden": "true"
}, st = /* @__PURE__ */ F({
  name: "IconSessionExpired",
  __name: "IconSessionExpired",
  setup(e) {
    return (r, t) => (d(), m("svg", ot, [...t[0] || (t[0] = [
      c("path", {
        d: "M3.5 12C3.5 7.30558 7.30558 3.5 12 3.5C16.6944 3.5 20.5 7.30558 20.5 12C20.5 16.6944 16.6944 20.5 12 20.5C7.30558 20.5 3.5 16.6944 3.5 12ZM12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2ZM11.9931 6.64827C11.9435 6.28233 11.6295 6 11.25 6C10.836 6 10.5 6.336 10.5 6.75V12.75L10.5069 12.8517C10.5565 13.2177 10.8705 13.5 11.25 13.5H15.25L15.3517 13.4931C15.7177 13.4435 16 13.1295 16 12.75C16 12.336 15.664 12 15.25 12H12V6.75L11.9931 6.64827Z",
        fill: "currentColor"
      }, null, -1)
    ])]));
  }
}), at = {
  width: "24",
  height: "24",
  viewBox: "0 0 24 24",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
  "aria-hidden": "true"
}, ut = /* @__PURE__ */ F({
  name: "IconLogin",
  __name: "IconLogin",
  setup(e) {
    return (r, t) => (d(), m("svg", at, [...t[0] || (t[0] = [
      c("path", {
        d: "M13.2673 4.20889C12.9674 3.9232 12.4926 3.93475 12.2069 4.23467C11.9212 4.5346 11.9328 5.00933 12.2327 5.29502L18.4841 11.2496H3.75C3.33579 11.2496 3 11.5854 3 11.9996C3 12.4138 3.33579 12.7496 3.75 12.7496H18.4842L12.2327 18.7043C11.9328 18.99 11.9212 19.4648 12.2069 19.7647C12.4926 20.0646 12.9674 20.0762 13.2673 19.7905L20.6862 12.7238C20.8551 12.5629 20.9551 12.3576 20.9861 12.1443C20.9952 12.0975 21 12.0491 21 11.9996C21 11.9501 20.9952 11.9016 20.986 11.8547C20.955 11.6415 20.855 11.4364 20.6862 11.2756L13.2673 4.20889Z",
        fill: "currentColor"
      }, null, -1)
    ])]));
  }
}), lt = {
  width: "24",
  height: "24",
  viewBox: "0 0 24 24",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
  "aria-hidden": "true"
}, ct = /* @__PURE__ */ F({
  name: "IconServiceUnavailable",
  __name: "IconServiceUnavailable",
  setup(e) {
    return (r, t) => (d(), m("svg", lt, [...t[0] || (t[0] = [
      c("path", {
        d: "M3.28034 2.21968C2.98745 1.92678 2.51257 1.92677 2.21968 2.21966C1.92678 2.51255 1.92677 2.98743 2.21966 3.28032L6.85339 7.91414C6.47198 8.54894 6.20466 9.26014 6.07981 10.0194C3.79155 10.2313 2 12.1564 2 14.5C2 16.9853 4.01472 19 6.5 19H17.5C17.6415 19 17.7815 18.9935 17.9197 18.9807L20.7194 21.7805C21.0123 22.0734 21.4872 22.0734 21.7801 21.7805C22.073 21.4876 22.073 21.0127 21.7801 20.7198L3.28034 2.21968ZM16.4391 17.5H6.5C4.84315 17.5 3.5 16.1569 3.5 14.5C3.5 12.8431 4.84315 11.5 6.5 11.5H6.75585C7.15641 11.5 7.48627 11.1852 7.50502 10.7851C7.53463 10.1537 7.69446 9.55623 7.95827 9.01904L16.4391 17.5ZM20.5 14.5C20.5 15.2822 20.2007 15.9944 19.7103 16.5285L20.7716 17.5898C21.5331 16.7838 22 15.6964 22 14.5C22 12.1564 20.2085 10.2313 17.9202 10.0194C17.4519 7.17189 14.9798 5 12 5C10.9031 5 9.875 5.29431 8.99031 5.80828L10.1011 6.91911C10.6781 6.65018 11.3215 6.5 12 6.5C14.4132 6.5 16.3832 8.39994 16.495 10.7851C16.5137 11.1852 16.8436 11.5 17.2442 11.5H17.5C19.1569 11.5 20.5 12.8431 20.5 14.5Z",
        fill: "currentColor"
      }, null, -1)
    ])]));
  }
}), dt = {
  width: "24",
  height: "24",
  viewBox: "0 0 24 24",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
  "aria-hidden": "true"
}, ft = /* @__PURE__ */ F({
  name: "IconRetry",
  __name: "IconRetry",
  setup(e) {
    return (r, t) => (d(), m("svg", dt, [...t[0] || (t[0] = [
      c("path", {
        d: "M12 4.5C7.85786 4.5 4.5 7.85786 4.5 12C4.5 16.1421 7.85786 19.5 12 19.5C16.1421 19.5 19.5 16.1421 19.5 12C19.5 11.6236 19.4723 11.2538 19.4188 10.8923C19.3515 10.4382 19.6839 10 20.1429 10C20.5138 10 20.839 10.2562 20.8953 10.6228C20.9642 11.0718 21 11.5317 21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C14.3051 3 16.4077 3.86656 18 5.29168V4.25C18 3.83579 18.3358 3.5 18.75 3.5C19.1642 3.5 19.5 3.83579 19.5 4.25V7.25C19.5 7.66421 19.1642 8 18.75 8H15.75C15.3358 8 15 7.66421 15 7.25C15 6.83579 15.3358 6.5 15.75 6.5H17.0991C15.7609 5.25883 13.9691 4.5 12 4.5Z",
        fill: "currentColor"
      }, null, -1)
    ])]));
  }
}), ht = {
  sessionExpired: st,
  login: ut,
  serviceUnavailable: ct,
  retry: ft
};
function pt(e) {
  if (!e.bffBaseUrl)
    throw new Error("bffAuthPlugin: bffBaseUrl is required");
  if (!e.clientId)
    throw new Error("bffAuthPlugin: clientId is required");
  if (e.mode !== void 0 && e.mode !== "token" && e.mode !== "cookie")
    throw new Error("bffAuthPlugin: mode must be 'token' or 'cookie'");
}
function gt(e) {
  const r = e.logger ?? U("BffAuth");
  return {
    bffBaseUrl: e.bffBaseUrl,
    clientId: e.clientId,
    logger: r,
    icons: { ...ht, ...e.icons },
    errorViews: e.errorViews ?? {},
    text: e.text ?? {},
    mode: e.mode ?? "token"
  };
}
const St = {
  install(e, r) {
    pt(r);
    const t = gt(r);
    e.provide(se, t), _e(t), e.component("AuthErrorBoundary", it), t.logger.debug("BFF Auth plugin installed", {
      bffBaseUrl: t.bffBaseUrl,
      clientId: t.clientId,
      mode: t.mode
    });
  }
}, ne = U("AuthInterceptors");
function Lt(e, r) {
  e.interceptors.request.use(
    async (t) => {
      if (x()?.mode === "cookie")
        return t;
      const i = r();
      if (!i.isAuthenticated)
        return t;
      try {
        const n = await i.ensureValidToken();
        n && (t.headers.Authorization = `Bearer ${n}`);
      } catch (n) {
        if (n instanceof k)
          return i.setError({
            type: "service_unavailable",
            message: n.message
          }), Promise.reject(n);
        ne.error("Failed to get auth token:", n instanceof Error ? n.message : "Unknown error");
      }
      return t;
    },
    (t) => Promise.reject(t)
  ), e.interceptors.response.use(
    (t) => t,
    async (t) => {
      const i = r(), n = t.response?.status, a = ue(t);
      if (n === 401 && !Y())
        ne.warn("401 received but auth is not configured, ignoring");
      else if (a)
        i.setError(a);
      else if (n === 401)
        i.setError({
          type: "session_expired",
          message: "Your session has expired. Please sign in again."
        });
      else if (n === 403) {
        const u = t.response?.data?.detail;
        i.setError({
          type: "permission_denied",
          message: typeof u == "string" ? u : "Permission denied"
        });
      }
      return Promise.reject(t);
    }
  );
}
const B = U("AuthGuard");
function vt(e) {
  return e.meta.public === !0;
}
async function mt(e) {
  if (!e.isLoading)
    return !0;
  let r = 0;
  const t = 200;
  for (; e.isLoading && r < t; )
    await new Promise((i) => setTimeout(i, 50)), r++;
  return e.isLoading ? (B.warn("Auth initialization timed out after 10 seconds"), !1) : !0;
}
const yt = {
  getAuthStore: () => W(),
  getAuthService: () => L
};
function _t(e = yt) {
  let r = !1;
  function t(i, n, a) {
    return de() ? (i.login({ returnUrl: a }), !1) : (B.error("Login redirect circuit breaker tripped"), n.setError({
      type: "service_unavailable",
      message: "Too many login attempts. Authentication service may be unavailable."
    }), !0);
  }
  return async (i) => {
    const n = e.getAuthStore(), a = e.getAuthService();
    try {
      if (vt(i))
        return !0;
      if (!r) {
        r = !0;
        try {
          await n.initAuth();
        } catch (f) {
          B.error("Failed to initialize auth:", f);
        }
      }
      return await mt(n) ? n.isAuthenticated ? (fe(), !0) : t(a, n, i.fullPath) : (B.warn("Auth not ready, redirecting to login"), t(a, n, i.fullPath));
    } catch (u) {
      return u instanceof k ? (B.error("Auth configuration error:", u.message), n.setError({
        type: "service_unavailable",
        message: u.message
      }), !0) : (B.error("Unexpected error in auth guard:", u), t(a, n, i.fullPath));
    }
  };
}
function Ut(e) {
  e.beforeEach(_t());
}
export {
  k as AuthConfigurationError,
  it as AuthErrorBoundary,
  be as AuthService,
  se as BFF_AUTH_CONFIG_KEY,
  ht as DEFAULT_ICONS,
  L as authService,
  St as bffAuthPlugin,
  _t as createAuthGuard,
  Ee as decodeAccessToken,
  Ae as decodeJwt,
  Tt as extractEmailFromJwt,
  x as getGlobalConfig,
  Y as isAuthConfigured,
  It as isCircuitBroken,
  we as mapErrorType,
  ue as parseAuthError,
  de as recordLoginAttempt,
  fe as resetLoginAttempts,
  _e as setGlobalConfig,
  Ut as setupAuthGuard,
  Lt as setupAuthInterceptors,
  xe as useAuth,
  kt as useAuthConfig,
  xt as useAuthService,
  W as useAuthStore
};
