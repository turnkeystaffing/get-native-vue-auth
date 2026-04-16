import { createLogger as _ } from "@turnkeystaffing/get-native-vue-logger";
import { inject as me, computed as u, defineComponent as j, ref as B, openBlock as I, createBlock as U, unref as o, withCtx as c, createVNode as m, createTextVNode as b, toDisplayString as E, createCommentVNode as q, createElementVNode as L, watch as ge, onUnmounted as pe } from "vue";
import { defineStore as ve } from "pinia";
import y from "axios";
import { jwtDecode as re } from "jwt-decode";
import { VDialog as ye, VCard as ne, VCardTitle as ie, VIcon as z, VCardText as se, VCardActions as oe, VSpacer as we, VBtn as Y, VSnackbar as Ae, VOverlay as be, VProgressLinear as _e } from "vuetify/components";
const ae = /* @__PURE__ */ Symbol("bff-auth-config");
let le = null;
function ke(e) {
  le = e;
}
function x() {
  return le;
}
function J() {
  const e = me(ae);
  if (!e)
    throw new Error(
      "BFF Auth config not found. Did you forget to install the plugin with app.use(bffAuthPlugin, options)?"
    );
  return e;
}
const Ee = {
  sessionExpired: "mdi-clock-alert-outline",
  login: "mdi-login",
  permissionDenied: "mdi-shield-alert",
  serviceUnavailable: "mdi-cloud-off-outline",
  retry: "mdi-refresh"
};
function xe(e) {
  if (!e.bffBaseUrl)
    throw new Error("bffAuthPlugin: bffBaseUrl is required");
  if (!e.clientId)
    throw new Error("bffAuthPlugin: clientId is required");
  if (e.mode !== void 0 && e.mode !== "token" && e.mode !== "cookie")
    throw new Error("bffAuthPlugin: mode must be 'token' or 'cookie'");
}
function Te(e) {
  const t = e.logger ?? _("BffAuth");
  return {
    bffBaseUrl: e.bffBaseUrl,
    clientId: e.clientId,
    logger: t,
    icons: { ...Ee, ...e.icons },
    mode: e.mode ?? "token"
  };
}
const Je = {
  install(e, t) {
    xe(t);
    const r = Te(t);
    e.provide(ae, r), ke(r), r.logger.debug("BFF Auth plugin installed", {
      bffBaseUrl: r.bffBaseUrl,
      clientId: r.clientId,
      mode: r.mode
    });
  }
}, f = _("AuthService");
class A extends Error {
  constructor(t) {
    super(t), this.name = "AuthConfigurationError";
  }
}
function w() {
  return x()?.bffBaseUrl || "";
}
function X() {
  return x()?.clientId || "";
}
function O() {
  const e = x();
  return !!(e?.bffBaseUrl && e?.clientId);
}
function Se(e) {
  return {
    authentication_error: "session_expired",
    authorization_error: "permission_denied",
    auth_service_unavailable: "service_unavailable"
  }[e];
}
function ue(e) {
  if (!e.response?.data?.error_type)
    return null;
  const t = e.response.data, r = {
    type: Se(t.error_type),
    message: t.detail
  };
  return t.retry_after !== void 0 && (r.retryAfter = t.retry_after), r;
}
class Ie {
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
  async submitCredentials(t, r, n) {
    try {
      const i = { email: t, password: r };
      n !== void 0 && (i.totp_code = n), await y.post(
        `${w()}/api/v1/oauth/login`,
        i,
        { withCredentials: !0 }
        // Include cookies for session handling
      ), f.info("Credentials submitted successfully");
    } catch (i) {
      throw f.error("Failed to submit credentials", i), i;
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
    if (!O())
      throw new A(
        "Authentication service is not configured. Please contact your administrator."
      );
    try {
      return {
        isAuthenticated: !0,
        user: (await y.get(`${w()}/bff/userinfo`, {
          withCredentials: !0
          // Include bff_session cookie
        })).data
      };
    } catch (t) {
      if (y.isAxiosError(t) && t.response?.status === 401)
        return {
          isAuthenticated: !1,
          user: null
        };
      throw t;
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
  login(t) {
    const r = t || {};
    if (!O())
      throw f.error("Cannot initiate login: Auth configuration is incomplete"), new A(
        "Authentication service is not configured. Please contact your administrator."
      );
    const n = r.returnUrl || window.location.href;
    let i;
    try {
      i = new URL(n, window.location.origin);
    } catch {
      f.warn("Malformed returnUrl, falling back to current page:", n), i = new URL(window.location.href);
    }
    i.origin !== window.location.origin && (f.warn("Blocked external redirect attempt:", n), i = new URL("/", window.location.origin));
    const s = i.href, a = `${w()}/bff/login`, l = new URLSearchParams({
      client_id: X(),
      redirect_url: s
    });
    f.debug("Initiating login redirect", { returnUrl: s }), window.location.href = `${a}?${l.toString()}`;
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
  loginWithCustomClient(t) {
    const { clientId: r, returnUrl: n } = t, i = r.trim();
    if (!i)
      throw new Error("clientId must not be empty");
    let s;
    try {
      s = new URL(n);
    } catch {
      throw new Error("returnUrl is not a valid URL");
    }
    if (s.protocol !== "http:" && s.protocol !== "https:")
      throw new Error("returnUrl must use http or https scheme");
    const a = w();
    if (!a)
      throw new A("BFF base URL is not configured.");
    const l = `${a}/bff/login`, h = new URLSearchParams({
      client_id: i,
      redirect_url: n
    });
    f.debug("Initiating custom client login redirect", { clientId: i, returnUrl: n }), window.location.href = `${l}?${h.toString()}`;
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
  completeOAuthFlow(t) {
    const { clientId: r, returnUrl: n } = t;
    if (!r || !n)
      throw new Error("completeOAuthFlow requires both clientId and returnUrl");
    const i = `${w()}/bff/login`, s = new URLSearchParams({
      client_id: r,
      redirect_url: n
    });
    f.debug("Completing OAuth flow", { clientId: r, returnUrl: n }), window.location.href = `${i}?${s.toString()}`;
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
      throw new A(
        "getAccessToken() is not available in cookie mode. Token management is handled by the BFF proxy via cookies."
      );
    if (!O())
      throw new A(
        "Authentication service is not configured. Please contact your administrator."
      );
    try {
      const t = await y.post(
        `${w()}/bff/token`,
        { client_id: X() },
        { withCredentials: !0 }
      );
      return {
        accessToken: t.data.access_token,
        tokenType: t.data.token_type,
        expiresIn: t.data.expires_in,
        scope: t.data.scope
      };
    } catch (t) {
      if (y.isAxiosError(t) && t.response?.status === 401)
        return null;
      throw t;
    }
  }
  /**
   * Logout - revokes session and clears cookies
   *
   * @returns Success indicator, or throws AuthError on failure
   */
  async logout() {
    try {
      return await y.post(
        `${w()}/bff/logout`,
        {},
        {
          withCredentials: !0
        }
      ), { success: !0 };
    } catch (t) {
      if (y.isAxiosError(t)) {
        const r = ue(t);
        if (r)
          throw r;
      }
      throw t;
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
  async setup2FA(t) {
    try {
      const r = await y.post(
        `${w()}/api/v1/auth/2fa/setup`,
        { token: t },
        { withCredentials: !0 }
      );
      return f.info("2FA setup initiated successfully"), r.data;
    } catch (r) {
      throw f.error("Failed to initiate 2FA setup", r), r;
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
  async verify2FASetup(t, r) {
    try {
      const n = await y.post(
        `${w()}/api/v1/auth/2fa/verify-setup`,
        { token: t, totp_code: r },
        { withCredentials: !0 }
      );
      return f.info("2FA setup verified successfully"), n.data;
    } catch (n) {
      throw f.error("Failed to verify 2FA setup", n), n;
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
  async resend2FASetupEmail(t, r) {
    try {
      const n = await y.post(
        `${w()}/api/v1/auth/2fa/resend-setup-email`,
        { email: t, password: r },
        { withCredentials: !0 }
      );
      return f.info("2FA setup email resent successfully"), n.data;
    } catch (n) {
      throw f.error("Failed to resend 2FA setup email", n), n;
    }
  }
}
const k = new Ie();
function We() {
  return k;
}
const P = _("JwtUtils");
function Ue(e) {
  if (!e)
    return null;
  try {
    return re(e);
  } catch (t) {
    return P.warn("Failed to decode JWT token:", t), null;
  }
}
function Ke(e) {
  const t = Ue(e);
  return !t?.email || typeof t.email != "string" ? null : t.email;
}
function Fe(e) {
  if (!e)
    return null;
  try {
    const t = re(e);
    return !t.email || typeof t.email != "string" ? (P.warn("Decoded token missing required email field"), null) : !t.user_id || typeof t.user_id != "string" ? (P.warn("Decoded token missing required user_id field"), null) : Array.isArray(t.roles) ? t : (P.warn("Decoded token missing required roles field"), null);
  } catch (t) {
    return P.warn("Failed to decode access token:", t), null;
  }
}
const N = "gn-auth-login-circuit-breaker", ce = 3, W = 120 * 1e3;
function Ce() {
  try {
    const e = sessionStorage.getItem(N);
    if (!e) return null;
    const t = JSON.parse(e);
    return typeof t == "object" && t !== null && typeof t.count == "number" && Number.isFinite(t.count) && typeof t.firstAttemptAt == "number" && Number.isFinite(t.firstAttemptAt) ? t : null;
  } catch {
    return null;
  }
}
function Pe(e) {
  sessionStorage.setItem(N, JSON.stringify(e));
}
function de(e = W) {
  const t = Ce();
  return t ? Date.now() - t.firstAttemptAt > e ? (sessionStorage.removeItem(N), null) : t : null;
}
function fe(e = ce, t = W) {
  try {
    const r = de(t), n = Date.now(), i = r ? { count: r.count + 1, firstAttemptAt: r.firstAttemptAt } : { count: 1, firstAttemptAt: n };
    return Pe(i), i.count <= e;
  } catch {
    return !0;
  }
}
function he() {
  try {
    sessionStorage.removeItem(N);
  } catch {
  }
}
function Xe(e = ce, t = W) {
  try {
    const r = de(t);
    return r ? r.count >= e : !1;
  } catch {
    return !1;
  }
}
const H = 5, F = _("AuthStore");
let C = null;
const V = ve("auth", {
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
    decodedToken: (e) => Fe(e.accessToken),
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
        const e = await k.checkAuth();
        this.isAuthenticated = e.isAuthenticated, this.user = e.user, e.isAuthenticated && he(), e.isAuthenticated && x()?.mode !== "cookie" && await this.ensureValidToken();
      } catch (e) {
        F.error("Failed to initialize auth:", e), this.isAuthenticated = !1, this.user = null, e instanceof A && this.setError({
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
      if (C)
        return (await C)?.accessToken ?? null;
      C = this._refreshToken();
      try {
        return (await C)?.accessToken ?? null;
      } finally {
        C = null;
      }
    },
    /**
     * Internal: Refresh the access token
     * @private
     */
    async _refreshToken() {
      try {
        const e = await k.getAccessToken();
        return e ? !e.accessToken || e.accessToken.trim() === "" ? (F.error("Invalid token response: empty accessToken"), this.setError({
          type: "session_expired",
          message: "Invalid token received. Please sign in again."
        }), null) : ((typeof e.expiresIn != "number" || !Number.isFinite(e.expiresIn) || e.expiresIn < H) && (F.error(`Invalid expiresIn value: ${e.expiresIn}, using minimum`), e.expiresIn = H), this.accessToken = e.accessToken, this.tokenExpiresAt = Date.now() + e.expiresIn * 1e3, e) : (this.setError({
          type: "session_expired",
          message: "Your session has expired. Please sign in again."
        }), null);
      } catch (e) {
        return F.error("Token refresh failed:", e), e instanceof A ? (this.setError({
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
      this.isLoading = !0, this.error = null, k.login(e ? { returnUrl: e } : void 0);
    },
    /**
     * Logout - revoke session and reset state
     */
    async logout() {
      try {
        await k.logout();
      } catch (e) {
        F.error("Logout failed:", e);
      }
      this.$reset(), k.login();
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
function K() {
  const e = V(), t = u(() => e.isAuthenticated), r = u(() => e.isLoading), n = u(() => e.user), i = u(() => e.error), s = u(() => e.userEmail), a = u(() => e.decodedToken), l = u(() => e.userRoles), h = u(() => e.userId), d = u(() => e.userGuid), v = u(() => e.username), M = u(() => e.sessionId);
  function R(g) {
    return e.hasRole(g);
  }
  function T(g) {
    e.login(g);
  }
  async function D() {
    await e.logout();
  }
  function G() {
    e.clearError();
  }
  return {
    // Reactive state
    isAuthenticated: t,
    isLoading: r,
    user: n,
    userEmail: s,
    error: i,
    // Decoded token getters
    decodedToken: a,
    userRoles: l,
    userId: h,
    userGuid: d,
    username: v,
    sessionId: M,
    // Actions
    login: T,
    logout: D,
    clearError: G,
    hasRole: R
  };
}
const Q = _("AuthInterceptors");
function He(e, t) {
  e.interceptors.request.use(
    async (r) => {
      if (x()?.mode === "cookie")
        return r;
      const n = t();
      if (!n.isAuthenticated)
        return r;
      try {
        const i = await n.ensureValidToken();
        i && (r.headers.Authorization = `Bearer ${i}`);
      } catch (i) {
        if (i instanceof A)
          return n.setError({
            type: "service_unavailable",
            message: i.message
          }), Promise.reject(i);
        Q.error("Failed to get auth token:", i instanceof Error ? i.message : "Unknown error");
      }
      return r;
    },
    (r) => Promise.reject(r)
  ), e.interceptors.response.use(
    (r) => r,
    async (r) => {
      const n = t(), i = r.response?.status, s = ue(r);
      if (i === 401 && !O())
        Q.warn("401 received but auth is not configured, ignoring");
      else if (s)
        n.setError(s);
      else if (i === 401)
        n.setError({
          type: "session_expired",
          message: "Your session has expired. Please sign in again."
        });
      else if (i === 403) {
        const a = r.response?.data?.detail;
        n.setError({
          type: "permission_denied",
          message: typeof a == "string" ? a : "Permission denied"
        });
      }
      return Promise.reject(r);
    }
  );
}
const S = _("AuthGuard");
function Le(e) {
  return e.meta.public === !0;
}
async function Re(e) {
  if (!e.isLoading)
    return !0;
  let t = 0;
  const r = 200;
  for (; e.isLoading && t < r; )
    await new Promise((n) => setTimeout(n, 50)), t++;
  return e.isLoading ? (S.warn("Auth initialization timed out after 10 seconds"), !1) : !0;
}
const De = {
  getAuthStore: () => V(),
  getAuthService: () => k
};
function $e(e = De) {
  let t = !1;
  function r(n, i, s) {
    return fe() ? (n.login({ returnUrl: s }), !1) : (S.error("Login redirect circuit breaker tripped"), i.setError({
      type: "service_unavailable",
      message: "Too many login attempts. Authentication service may be unavailable."
    }), !0);
  }
  return async (n) => {
    const i = e.getAuthStore(), s = e.getAuthService();
    try {
      if (Le(n))
        return !0;
      if (!t) {
        t = !0;
        try {
          await i.initAuth();
        } catch (l) {
          S.error("Failed to initialize auth:", l);
        }
      }
      return await Re(i) ? i.isAuthenticated ? (he(), !0) : r(s, i, n.fullPath) : (S.warn("Auth not ready, redirecting to login"), r(s, i, n.fullPath));
    } catch (a) {
      return a instanceof A ? (S.error("Auth configuration error:", a.message), i.setError({
        type: "service_unavailable",
        message: a.message
      }), !0) : (S.error("Unexpected error in auth guard:", a), r(s, i, n.fullPath));
    }
  };
}
function Qe(e) {
  e.beforeEach($e());
}
const Z = "Your session has ended. Sign in again to continue.", Ze = /* @__PURE__ */ j({
  name: "SessionExpiredModal",
  __name: "SessionExpiredModal",
  setup(e) {
    const t = _("SessionExpiredModal"), r = J(), { error: n, login: i } = K(), s = B(!1), a = u(() => n.value?.type === "session_expired"), l = u(
      () => n.value?.type === "session_expired" && n.value.message || Z
    );
    function h() {
      if (!s.value) {
        if (!fe()) {
          t.warn("Login redirect circuit breaker tripped from session expired modal"), V().setError({
            type: "service_unavailable",
            message: "Too many login attempts. Authentication service may be unavailable."
          });
          return;
        }
        s.value = !0, t.info("User initiated re-authentication from session expired modal");
        try {
          const d = window.location.href;
          i(d);
        } catch (d) {
          s.value = !1, t.error("Failed to initiate login redirect", d);
        }
      }
    }
    return (d, v) => (I(), U(o(ye), {
      "model-value": a.value,
      persistent: "",
      "max-width": "400",
      "data-testid": "session-expired-modal",
      "aria-labelledby": "session-expired-title",
      "aria-describedby": "session-expired-message"
    }, {
      default: c(() => [
        m(o(ne), null, {
          default: c(() => [
            m(o(ie), {
              id: "session-expired-title",
              class: "text-h5 d-flex align-center"
            }, {
              default: c(() => [
                o(r).icons.sessionExpired ? (I(), U(o(z), {
                  key: 0,
                  color: "warning",
                  class: "mr-2"
                }, {
                  default: c(() => [
                    b(E(o(r).icons.sessionExpired), 1)
                  ]),
                  _: 1
                })) : q("", !0),
                v[0] || (v[0] = b(" Session Expired ", -1))
              ]),
              _: 1
            }),
            m(o(se), { id: "session-expired-message" }, {
              default: c(() => [
                b(E(l.value), 1)
              ]),
              _: 1
            }),
            m(o(oe), null, {
              default: c(() => [
                m(o(we)),
                m(o(Y), {
                  color: "primary",
                  variant: "elevated",
                  "prepend-icon": o(r).icons.login || void 0,
                  loading: s.value,
                  disabled: s.value,
                  "data-testid": "session-expired-sign-in-button",
                  "aria-label": "Sign in to continue",
                  onClick: h
                }, {
                  default: c(() => [...v[1] || (v[1] = [
                    b(" Sign In ", -1)
                  ])]),
                  _: 1
                }, 8, ["prepend-icon", "loading", "disabled"])
              ]),
              _: 1
            })
          ]),
          _: 1
        })
      ]),
      _: 1
    }, 8, ["model-value"]));
  }
}), Be = { class: "d-flex align-center" }, Oe = 5e3, ee = "You do not have permission to perform this action.", et = /* @__PURE__ */ j({
  name: "PermissionDeniedToast",
  __name: "PermissionDeniedToast",
  setup(e) {
    const t = _("PermissionDeniedToast"), r = J(), { error: n, clearError: i } = K(), s = u({
      get: () => n.value?.type === "permission_denied",
      set: (h) => {
        h || l();
      }
    }), a = u(
      () => n.value?.type === "permission_denied" && n.value.message || ee
    );
    function l() {
      t.info("Permission denied toast closed"), i();
    }
    return (h, d) => (I(), U(o(Ae), {
      modelValue: s.value,
      "onUpdate:modelValue": d[0] || (d[0] = (v) => s.value = v),
      timeout: Oe,
      color: "warning",
      location: "top",
      "data-testid": "permission-denied-toast",
      role: "status",
      "aria-live": "polite"
    }, {
      actions: c(() => [
        m(o(Y), {
          variant: "text",
          "data-testid": "permission-denied-close-button",
          "aria-label": "Dismiss notification",
          onClick: l
        }, {
          default: c(() => [...d[1] || (d[1] = [
            b(" Close ", -1)
          ])]),
          _: 1
        })
      ]),
      default: c(() => [
        L("div", Be, [
          o(r).icons.permissionDenied ? (I(), U(o(z), {
            key: 0,
            class: "mr-2"
          }, {
            default: c(() => [
              b(E(o(r).icons.permissionDenied), 1)
            ]),
            _: 1
          })) : q("", !0),
          L("span", null, E(a.value), 1)
        ])
      ]),
      _: 1
    }, 8, ["modelValue"]));
  }
}), Ne = { class: "text-body-1 mb-4" }, Ve = ["aria-label"], $ = 30, te = "We're having trouble connecting to authentication services.", tt = /* @__PURE__ */ j({
  name: "ServiceUnavailableOverlay",
  __name: "ServiceUnavailableOverlay",
  setup(e) {
    const t = _("ServiceUnavailableOverlay"), r = J(), { error: n } = K(), i = V(), s = B($), a = B($), l = B(!1);
    let h = null;
    const d = u(() => n.value?.type === "service_unavailable"), v = u(
      () => n.value?.type === "service_unavailable" && n.value.message || te
    ), M = u(() => a.value === 0 ? 0 : Math.floor((a.value - s.value) / a.value * 100));
    function R(g) {
      T(), a.value = g, s.value = g, h = setInterval(() => {
        s.value > 0 && (s.value--, s.value === 0 && D());
      }, 1e3);
    }
    function T() {
      h && (clearInterval(h), h = null);
    }
    async function D() {
      if (!l.value) {
        l.value = !0, T(), t.info("Attempting auth service retry");
        try {
          await i.initAuth(), i.isAuthenticated ? (i.clearError(), t.info("Auth retry successful, user authenticated")) : i.hasError || (i.setError({
            type: "session_expired",
            message: "Your session has ended. Sign in again to continue."
          }), t.info("Auth service reachable but session invalid"));
        } catch (g) {
          t.warn("Auth service retry failed, restarting countdown", g);
          const p = n.value?.retryAfter ?? $;
          R(p);
        } finally {
          l.value = !1;
        }
      }
    }
    function G() {
      t.info("User initiated manual retry from service unavailable overlay"), D();
    }
    return ge(
      () => n.value,
      (g) => {
        if (g?.type === "service_unavailable") {
          const p = g.retryAfter ?? $;
          t.info(`Auth service unavailable, starting countdown: ${p}s`), R(p);
        } else
          T();
      },
      { immediate: !0 }
    ), pe(() => {
      T();
    }), (g, p) => (I(), U(o(be), {
      "model-value": d.value,
      persistent: "",
      class: "align-center justify-center",
      scrim: "rgba(0, 0, 0, 0.8)",
      "data-testid": "service-unavailable-overlay",
      role: "alertdialog",
      "aria-modal": "true",
      "aria-labelledby": "service-unavailable-title",
      "aria-describedby": "service-unavailable-message",
      "aria-live": "assertive"
    }, {
      default: c(() => [
        m(o(ne), {
          "max-width": "450",
          class: "pa-4",
          elevation: "24"
        }, {
          default: c(() => [
            m(o(ie), {
              id: "service-unavailable-title",
              class: "text-h5 d-flex align-center justify-center"
            }, {
              default: c(() => [
                o(r).icons.serviceUnavailable ? (I(), U(o(z), {
                  key: 0,
                  color: "error",
                  size: "32",
                  class: "mr-2"
                }, {
                  default: c(() => [
                    b(E(o(r).icons.serviceUnavailable), 1)
                  ]),
                  _: 1
                })) : q("", !0),
                p[0] || (p[0] = b(" Service Issue ", -1))
              ]),
              _: 1
            }),
            m(o(se), {
              id: "service-unavailable-message",
              class: "text-center"
            }, {
              default: c(() => [
                L("p", Ne, E(v.value), 1),
                p[1] || (p[1] = L("p", { class: "text-body-2 text-medium-emphasis mb-4" }, " Retrying automatically... ", -1)),
                m(o(_e), {
                  "model-value": M.value,
                  color: "primary",
                  height: "8",
                  rounded: "",
                  class: "mb-2",
                  "data-testid": "countdown-progress-bar"
                }, null, 8, ["model-value"]),
                L("p", {
                  class: "text-body-2 text-medium-emphasis",
                  "data-testid": "countdown-text",
                  "aria-label": `Retry in ${s.value} seconds`
                }, " Retry in " + E(s.value) + "s ", 9, Ve)
              ]),
              _: 1
            }),
            m(o(oe), { class: "justify-center" }, {
              default: c(() => [
                m(o(Y), {
                  color: "primary",
                  variant: "elevated",
                  "prepend-icon": o(r).icons.retry || void 0,
                  loading: l.value,
                  disabled: l.value,
                  "data-testid": "try-now-button",
                  "aria-label": "Try connecting now",
                  onClick: G
                }, {
                  default: c(() => [...p[2] || (p[2] = [
                    b(" Try Now ", -1)
                  ])]),
                  _: 1
                }, 8, ["prepend-icon", "loading", "disabled"])
              ]),
              _: 1
            })
          ]),
          _: 1
        })
      ]),
      _: 1
    }, 8, ["model-value"]));
  }
});
export {
  A as AuthConfigurationError,
  Ie as AuthService,
  ae as BFF_AUTH_CONFIG_KEY,
  Ee as DEFAULT_ICONS,
  et as PermissionDeniedToast,
  tt as ServiceUnavailableOverlay,
  Ze as SessionExpiredModal,
  k as authService,
  Je as bffAuthPlugin,
  $e as createAuthGuard,
  Fe as decodeAccessToken,
  Ue as decodeJwt,
  Ke as extractEmailFromJwt,
  x as getGlobalConfig,
  O as isAuthConfigured,
  Xe as isCircuitBroken,
  Se as mapErrorType,
  ue as parseAuthError,
  fe as recordLoginAttempt,
  he as resetLoginAttempts,
  ke as setGlobalConfig,
  Qe as setupAuthGuard,
  He as setupAuthInterceptors,
  K as useAuth,
  J as useAuthConfig,
  We as useAuthService,
  V as useAuthStore
};
