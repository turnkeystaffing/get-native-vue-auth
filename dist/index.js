import { createLogger as _ } from "@turnkeystaffing/get-native-vue-logger";
import { inject as le, computed as l, defineComponent as N, ref as B, openBlock as U, createBlock as S, unref as o, withCtx as u, createVNode as p, createTextVNode as A, toDisplayString as E, createCommentVNode as G, createElementVNode as R, watch as ue, onUnmounted as ce } from "vue";
import { defineStore as de } from "pinia";
import y from "axios";
import { jwtDecode as ee } from "jwt-decode";
import { VDialog as fe, VCard as te, VCardTitle as re, VIcon as j, VCardText as ne, VCardActions as ie, VSpacer as he, VBtn as q, VSnackbar as ge, VOverlay as pe, VProgressLinear as me } from "vuetify/components";
const se = /* @__PURE__ */ Symbol("bff-auth-config");
let oe = null;
function ve(e) {
  oe = e;
}
function x() {
  return oe;
}
function z() {
  const e = le(se);
  if (!e)
    throw new Error(
      "BFF Auth config not found. Did you forget to install the plugin with app.use(bffAuthPlugin, options)?"
    );
  return e;
}
const ye = {
  sessionExpired: "mdi-clock-alert-outline",
  login: "mdi-login",
  permissionDenied: "mdi-shield-alert",
  serviceUnavailable: "mdi-cloud-off-outline",
  retry: "mdi-refresh"
};
function we(e) {
  if (!e.bffBaseUrl)
    throw new Error("bffAuthPlugin: bffBaseUrl is required");
  if (!e.clientId)
    throw new Error("bffAuthPlugin: clientId is required");
  if (e.mode !== void 0 && e.mode !== "token" && e.mode !== "cookie")
    throw new Error("bffAuthPlugin: mode must be 'token' or 'cookie'");
}
function be(e) {
  const t = e.logger ?? _("BffAuth");
  return {
    bffBaseUrl: e.bffBaseUrl,
    clientId: e.clientId,
    logger: t,
    icons: { ...ye, ...e.icons },
    mode: e.mode ?? "token"
  };
}
const Oe = {
  install(e, t) {
    we(t);
    const r = be(t);
    e.provide(se, r), ve(r), r.logger.debug("BFF Auth plugin installed", {
      bffBaseUrl: r.bffBaseUrl,
      clientId: r.clientId,
      mode: r.mode
    });
  }
}, f = _("AuthService");
class b extends Error {
  constructor(t) {
    super(t), this.name = "AuthConfigurationError";
  }
}
function w() {
  return x()?.bffBaseUrl || "";
}
function W() {
  return x()?.clientId || "";
}
function V() {
  const e = x();
  return !!(e?.bffBaseUrl && e?.clientId);
}
function Ae(e) {
  return {
    authentication_error: "session_expired",
    authorization_error: "permission_denied",
    auth_service_unavailable: "service_unavailable"
  }[e];
}
function ae(e) {
  if (!e.response?.data?.error_type)
    return null;
  const t = e.response.data, r = {
    type: Ae(t.error_type),
    message: t.detail
  };
  return t.retry_after !== void 0 && (r.retryAfter = t.retry_after), r;
}
class _e {
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
    if (!V())
      throw new b(
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
    if (!V())
      throw f.error("Cannot initiate login: Auth configuration is incomplete"), new b(
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
    const s = i.href, a = `${w()}/bff/login`, c = new URLSearchParams({
      client_id: W(),
      redirect_url: s
    });
    f.debug("Initiating login redirect", { returnUrl: s }), window.location.href = `${a}?${c.toString()}`;
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
      throw new b("BFF base URL is not configured.");
    const c = `${a}/bff/login`, h = new URLSearchParams({
      client_id: i,
      redirect_url: n
    });
    f.debug("Initiating custom client login redirect", { clientId: i, returnUrl: n }), window.location.href = `${c}?${h.toString()}`;
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
      throw new b(
        "getAccessToken() is not available in cookie mode. Token management is handled by the BFF proxy via cookies."
      );
    if (!V())
      throw new b(
        "Authentication service is not configured. Please contact your administrator."
      );
    try {
      const t = await y.post(
        `${w()}/bff/token`,
        { client_id: W() },
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
        const r = ae(t);
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
const k = new _e();
function Me() {
  return k;
}
const C = _("JwtUtils");
function ke(e) {
  if (!e)
    return null;
  try {
    return ee(e);
  } catch (t) {
    return C.warn("Failed to decode JWT token:", t), null;
  }
}
function Ne(e) {
  const t = ke(e);
  return !t?.email || typeof t.email != "string" ? null : t.email;
}
function Ee(e) {
  if (!e)
    return null;
  try {
    const t = ee(e);
    return !t.email || typeof t.email != "string" ? (C.warn("Decoded token missing required email field"), null) : !t.user_id || typeof t.user_id != "string" ? (C.warn("Decoded token missing required user_id field"), null) : Array.isArray(t.roles) ? t : (C.warn("Decoded token missing required roles field"), null);
  } catch (t) {
    return C.warn("Failed to decode access token:", t), null;
  }
}
const H = 5, I = _("AuthStore");
let F = null;
const Y = de("auth", {
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
        const e = await k.checkAuth();
        this.isAuthenticated = e.isAuthenticated, this.user = e.user, e.isAuthenticated && x()?.mode !== "cookie" && await this.ensureValidToken();
      } catch (e) {
        I.error("Failed to initialize auth:", e), this.isAuthenticated = !1, this.user = null, e instanceof b && this.setError({
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
      if (F)
        return (await F)?.accessToken ?? null;
      F = this._refreshToken();
      try {
        return (await F)?.accessToken ?? null;
      } finally {
        F = null;
      }
    },
    /**
     * Internal: Refresh the access token
     * @private
     */
    async _refreshToken() {
      try {
        const e = await k.getAccessToken();
        return e ? !e.accessToken || e.accessToken.trim() === "" ? (I.error("Invalid token response: empty accessToken"), this.setError({
          type: "session_expired",
          message: "Invalid token received. Please sign in again."
        }), null) : ((typeof e.expiresIn != "number" || !Number.isFinite(e.expiresIn) || e.expiresIn < H) && (I.error(`Invalid expiresIn value: ${e.expiresIn}, using minimum`), e.expiresIn = H), this.accessToken = e.accessToken, this.tokenExpiresAt = Date.now() + e.expiresIn * 1e3, e) : (this.setError({
          type: "session_expired",
          message: "Your session has expired. Please sign in again."
        }), null);
      } catch (e) {
        return I.error("Token refresh failed:", e), e instanceof b ? (this.setError({
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
        I.error("Logout failed:", e);
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
function J() {
  const e = Y(), t = l(() => e.isAuthenticated), r = l(() => e.isLoading), n = l(() => e.user), i = l(() => e.error), s = l(() => e.userEmail), a = l(() => e.decodedToken), c = l(() => e.userRoles), h = l(() => e.userId), g = l(() => e.userGuid), v = l(() => e.username), O = l(() => e.sessionId);
  function $(d) {
    return e.hasRole(d);
  }
  function T(d) {
    e.login(d);
  }
  async function L() {
    await e.logout();
  }
  function M() {
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
    userRoles: c,
    userId: h,
    userGuid: g,
    username: v,
    sessionId: O,
    // Actions
    login: T,
    logout: L,
    clearError: M,
    hasRole: $
  };
}
const K = _("AuthInterceptors");
function Ge(e, t) {
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
        if (i instanceof b)
          return n.setError({
            type: "service_unavailable",
            message: i.message
          }), Promise.reject(i);
        K.error("Failed to get auth token:", i instanceof Error ? i.message : "Unknown error");
      }
      return r;
    },
    (r) => Promise.reject(r)
  ), e.interceptors.response.use(
    (r) => r,
    async (r) => {
      const n = t(), i = r.response?.status, s = ae(r);
      if (i === 401 && !V())
        K.warn("401 received but auth is not configured, ignoring");
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
const P = _("AuthGuard");
function xe(e) {
  return e.meta.public === !0;
}
async function Te(e) {
  if (!e.isLoading)
    return !0;
  let t = 0;
  const r = 200;
  for (; e.isLoading && t < r; )
    await new Promise((n) => setTimeout(n, 50)), t++;
  return e.isLoading ? (P.warn("Auth initialization timed out after 10 seconds"), !1) : !0;
}
const Ue = {
  getAuthStore: () => Y(),
  getAuthService: () => k
};
function Se(e = Ue) {
  let t = !1;
  return async (r) => {
    const n = e.getAuthStore(), i = e.getAuthService();
    try {
      if (xe(r))
        return !0;
      if (!t) {
        t = !0;
        try {
          await n.initAuth();
        } catch (a) {
          P.error("Failed to initialize auth:", a);
        }
      }
      return await Te(n) ? n.isAuthenticated ? !0 : (i.login({ returnUrl: r.fullPath }), !1) : (P.warn("Auth not ready, redirecting to login"), i.login({ returnUrl: r.fullPath }), !1);
    } catch (s) {
      return s instanceof b ? (P.error("Auth configuration error:", s.message), n.setError({
        type: "service_unavailable",
        message: s.message
      }), !0) : (P.error("Unexpected error in auth guard:", s), i.login({ returnUrl: r.fullPath }), !1);
    }
  };
}
function je(e) {
  e.beforeEach(Se());
}
const X = "Your session has ended. Sign in again to continue.", qe = /* @__PURE__ */ N({
  name: "SessionExpiredModal",
  __name: "SessionExpiredModal",
  setup(e) {
    const t = _("SessionExpiredModal"), r = z(), { error: n, login: i } = J(), s = B(!1), a = l(() => n.value?.type === "session_expired"), c = l(
      () => n.value?.type === "session_expired" && n.value.message || X
    );
    function h() {
      if (!s.value) {
        s.value = !0, t.info("User initiated re-authentication from session expired modal");
        try {
          const g = window.location.href;
          i(g);
        } catch (g) {
          s.value = !1, t.error("Failed to initiate login redirect", g);
        }
      }
    }
    return (g, v) => (U(), S(o(fe), {
      "model-value": a.value,
      persistent: "",
      "max-width": "400",
      "data-testid": "session-expired-modal",
      "aria-labelledby": "session-expired-title",
      "aria-describedby": "session-expired-message"
    }, {
      default: u(() => [
        p(o(te), null, {
          default: u(() => [
            p(o(re), {
              id: "session-expired-title",
              class: "text-h5 d-flex align-center"
            }, {
              default: u(() => [
                o(r).icons.sessionExpired ? (U(), S(o(j), {
                  key: 0,
                  color: "warning",
                  class: "mr-2"
                }, {
                  default: u(() => [
                    A(E(o(r).icons.sessionExpired), 1)
                  ]),
                  _: 1
                })) : G("", !0),
                v[0] || (v[0] = A(" Session Expired ", -1))
              ]),
              _: 1
            }),
            p(o(ne), { id: "session-expired-message" }, {
              default: u(() => [
                A(E(c.value), 1)
              ]),
              _: 1
            }),
            p(o(ie), null, {
              default: u(() => [
                p(o(he)),
                p(o(q), {
                  color: "primary",
                  variant: "elevated",
                  "prepend-icon": o(r).icons.login || void 0,
                  loading: s.value,
                  disabled: s.value,
                  "data-testid": "session-expired-sign-in-button",
                  "aria-label": "Sign in to continue",
                  onClick: h
                }, {
                  default: u(() => [...v[1] || (v[1] = [
                    A(" Sign In ", -1)
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
}), Ie = { class: "d-flex align-center" }, Fe = 5e3, Q = "You do not have permission to perform this action.", ze = /* @__PURE__ */ N({
  name: "PermissionDeniedToast",
  __name: "PermissionDeniedToast",
  setup(e) {
    const t = _("PermissionDeniedToast"), r = z(), { error: n, clearError: i } = J(), s = l({
      get: () => n.value?.type === "permission_denied",
      set: (h) => {
        h || c();
      }
    }), a = l(
      () => n.value?.type === "permission_denied" && n.value.message || Q
    );
    function c() {
      t.info("Permission denied toast closed"), i();
    }
    return (h, g) => (U(), S(o(ge), {
      modelValue: s.value,
      "onUpdate:modelValue": g[0] || (g[0] = (v) => s.value = v),
      timeout: Fe,
      color: "warning",
      location: "top",
      "data-testid": "permission-denied-toast",
      role: "status",
      "aria-live": "polite"
    }, {
      actions: u(() => [
        p(o(q), {
          variant: "text",
          "data-testid": "permission-denied-close-button",
          "aria-label": "Dismiss notification",
          onClick: c
        }, {
          default: u(() => [...g[1] || (g[1] = [
            A(" Close ", -1)
          ])]),
          _: 1
        })
      ]),
      default: u(() => [
        R("div", Ie, [
          o(r).icons.permissionDenied ? (U(), S(o(j), {
            key: 0,
            class: "mr-2"
          }, {
            default: u(() => [
              A(E(o(r).icons.permissionDenied), 1)
            ]),
            _: 1
          })) : G("", !0),
          R("span", null, E(a.value), 1)
        ])
      ]),
      _: 1
    }, 8, ["modelValue"]));
  }
}), Ce = { class: "text-body-1 mb-4" }, Pe = ["aria-label"], D = 30, Z = "We're having trouble connecting to authentication services.", Ye = /* @__PURE__ */ N({
  name: "ServiceUnavailableOverlay",
  __name: "ServiceUnavailableOverlay",
  setup(e) {
    const t = _("ServiceUnavailableOverlay"), r = z(), { error: n } = J(), i = Y(), s = B(D), a = B(D), c = B(!1);
    let h = null;
    const g = l(() => n.value?.type === "service_unavailable"), v = l(
      () => n.value?.type === "service_unavailable" && n.value.message || Z
    ), O = l(() => a.value === 0 ? 0 : Math.floor((a.value - s.value) / a.value * 100));
    function $(d) {
      T(), a.value = d, s.value = d, h = setInterval(() => {
        s.value > 0 && (s.value--, s.value === 0 && L());
      }, 1e3);
    }
    function T() {
      h && (clearInterval(h), h = null);
    }
    async function L() {
      if (!c.value) {
        c.value = !0, T(), t.info("Attempting auth service retry");
        try {
          const d = await k.checkAuth();
          i.clearError(), t.info("Auth service retry successful", { isAuthenticated: d.isAuthenticated });
        } catch (d) {
          t.warn("Auth service retry failed, restarting countdown", d);
          const m = n.value?.retryAfter ?? D;
          $(m);
        } finally {
          c.value = !1;
        }
      }
    }
    function M() {
      t.info("User initiated manual retry from service unavailable overlay"), L();
    }
    return ue(
      () => n.value,
      (d) => {
        if (d?.type === "service_unavailable") {
          const m = d.retryAfter ?? D;
          t.info(`Auth service unavailable, starting countdown: ${m}s`), $(m);
        } else
          T();
      },
      { immediate: !0 }
    ), ce(() => {
      T();
    }), (d, m) => (U(), S(o(pe), {
      "model-value": g.value,
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
      default: u(() => [
        p(o(te), {
          "max-width": "450",
          class: "pa-4",
          elevation: "24"
        }, {
          default: u(() => [
            p(o(re), {
              id: "service-unavailable-title",
              class: "text-h5 d-flex align-center justify-center"
            }, {
              default: u(() => [
                o(r).icons.serviceUnavailable ? (U(), S(o(j), {
                  key: 0,
                  color: "error",
                  size: "32",
                  class: "mr-2"
                }, {
                  default: u(() => [
                    A(E(o(r).icons.serviceUnavailable), 1)
                  ]),
                  _: 1
                })) : G("", !0),
                m[0] || (m[0] = A(" Service Issue ", -1))
              ]),
              _: 1
            }),
            p(o(ne), {
              id: "service-unavailable-message",
              class: "text-center"
            }, {
              default: u(() => [
                R("p", Ce, E(v.value), 1),
                m[1] || (m[1] = R("p", { class: "text-body-2 text-medium-emphasis mb-4" }, " Retrying automatically... ", -1)),
                p(o(me), {
                  "model-value": O.value,
                  color: "primary",
                  height: "8",
                  rounded: "",
                  class: "mb-2",
                  "data-testid": "countdown-progress-bar"
                }, null, 8, ["model-value"]),
                R("p", {
                  class: "text-body-2 text-medium-emphasis",
                  "data-testid": "countdown-text",
                  "aria-label": `Retry in ${s.value} seconds`
                }, " Retry in " + E(s.value) + "s ", 9, Pe)
              ]),
              _: 1
            }),
            p(o(ie), { class: "justify-center" }, {
              default: u(() => [
                p(o(q), {
                  color: "primary",
                  variant: "elevated",
                  "prepend-icon": o(r).icons.retry || void 0,
                  loading: c.value,
                  disabled: c.value,
                  "data-testid": "try-now-button",
                  "aria-label": "Try connecting now",
                  onClick: M
                }, {
                  default: u(() => [...m[2] || (m[2] = [
                    A(" Try Now ", -1)
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
  b as AuthConfigurationError,
  _e as AuthService,
  se as BFF_AUTH_CONFIG_KEY,
  ye as DEFAULT_ICONS,
  ze as PermissionDeniedToast,
  Ye as ServiceUnavailableOverlay,
  qe as SessionExpiredModal,
  k as authService,
  Oe as bffAuthPlugin,
  Se as createAuthGuard,
  Ee as decodeAccessToken,
  ke as decodeJwt,
  Ne as extractEmailFromJwt,
  x as getGlobalConfig,
  V as isAuthConfigured,
  Ae as mapErrorType,
  ae as parseAuthError,
  ve as setGlobalConfig,
  je as setupAuthGuard,
  Ge as setupAuthInterceptors,
  J as useAuth,
  z as useAuthConfig,
  Me as useAuthService,
  Y as useAuthStore
};
