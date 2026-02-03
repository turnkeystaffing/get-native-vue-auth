import { createLogger as y } from "@turnkeystaffing/get-native-vue-logger";
import { inject as ue, computed as c, defineComponent as M, ref as L, openBlock as T, createBlock as S, unref as o, withCtx as d, createVNode as p, createTextVNode as v, toDisplayString as _, createCommentVNode as N, createElementVNode as R, watch as ce, onUnmounted as de } from "vue";
import { defineStore as fe } from "pinia";
import b from "axios";
import { jwtDecode as ee } from "jwt-decode";
import { VDialog as he, VCard as te, VCardTitle as re, VIcon as G, VCardText as ne, VCardActions as ie, VSpacer as ge, VBtn as j, VSnackbar as pe, VOverlay as me, VProgressLinear as ve } from "vuetify/components";
const se = Symbol("bff-auth-config");
let oe = null;
function ye(e) {
  oe = e;
}
function q() {
  return oe;
}
function z() {
  const e = ue(se);
  if (!e)
    throw new Error(
      "BFF Auth config not found. Did you forget to install the plugin with app.use(bffAuthPlugin, options)?"
    );
  return e;
}
const we = {
  sessionExpired: "mdi-clock-alert-outline",
  login: "mdi-login",
  permissionDenied: "mdi-shield-alert",
  serviceUnavailable: "mdi-cloud-off-outline",
  retry: "mdi-refresh"
};
function be(e) {
  if (!e.bffBaseUrl)
    throw new Error("bffAuthPlugin: bffBaseUrl is required");
  if (!e.clientId)
    throw new Error("bffAuthPlugin: clientId is required");
}
function Ae(e) {
  const t = e.logger ?? y("BffAuth");
  return {
    bffBaseUrl: e.bffBaseUrl,
    clientId: e.clientId,
    logger: t,
    icons: { ...we, ...e.icons }
  };
}
const Me = {
  install(e, t) {
    be(t);
    const r = Ae(t);
    e.provide(se, r), ye(r), r.logger.debug("BFF Auth plugin installed", {
      bffBaseUrl: r.bffBaseUrl,
      clientId: r.clientId
    });
  }
}, A = y("AuthService");
class k extends Error {
  constructor(t) {
    super(t), this.name = "AuthConfigurationError";
  }
}
function E() {
  var e;
  return ((e = q()) == null ? void 0 : e.bffBaseUrl) || "";
}
function W() {
  var e;
  return ((e = q()) == null ? void 0 : e.clientId) || "";
}
function V() {
  const e = q();
  return !!(e != null && e.bffBaseUrl && (e != null && e.clientId));
}
function _e(e) {
  return {
    authentication_error: "session_expired",
    authorization_error: "permission_denied",
    auth_service_unavailable: "service_unavailable"
  }[e];
}
function ae(e) {
  var n, i;
  if (!((i = (n = e.response) == null ? void 0 : n.data) != null && i.error_type))
    return null;
  const t = e.response.data, r = {
    type: _e(t.error_type),
    message: t.detail
  };
  return t.retry_after !== void 0 && (r.retryAfter = t.retry_after), r;
}
class ke {
  /**
   * Submit login credentials to BFF for authentication
   * This POSTs to /api/v1/oauth/login and expects a 200 OK on success.
   * BFF will set the session cookie on successful authentication.
   *
   * @param email - User email address
   * @param password - User password
   * @returns Promise that resolves on success, rejects on error
   * @throws AxiosError with status 401 for invalid credentials
   * @throws AxiosError with status 503 for service unavailable
   */
  async submitCredentials(t, r) {
    try {
      await b.post(
        `${E()}/api/v1/oauth/login`,
        { email: t, password: r },
        { withCredentials: !0 }
        // Include cookies for session handling
      ), A.info("Credentials submitted successfully");
    } catch (n) {
      throw A.error("Failed to submit credentials", n), n;
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
    var t;
    if (!V())
      throw new k(
        "Authentication service is not configured. Please contact your administrator."
      );
    try {
      return {
        isAuthenticated: !0,
        user: (await b.get(`${E()}/bff/userinfo`, {
          withCredentials: !0
          // Include bff_session cookie
        })).data
      };
    } catch (r) {
      if (b.isAxiosError(r) && ((t = r.response) == null ? void 0 : t.status) === 401)
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
   *
   * @param options - Login options with optional returnUrl (defaults to current URL)
   */
  login(t) {
    const r = t || {};
    if (!V())
      throw A.error("Cannot initiate login: Auth configuration is incomplete"), new k(
        "Authentication service is not configured. Please contact your administrator."
      );
    const n = r.returnUrl || window.location.href;
    let i;
    try {
      i = new URL(n, window.location.origin);
    } catch {
      A.warn("Malformed returnUrl, falling back to current page:", n), i = new URL(window.location.href);
    }
    i.origin !== window.location.origin && (A.warn("Blocked external redirect attempt:", n), i = new URL("/", window.location.origin));
    const s = i.href, f = `${E()}/bff/login`, h = new URLSearchParams({
      client_id: W(),
      redirect_url: s
    });
    A.debug("Initiating login redirect", { returnUrl: s }), window.location.href = `${f}?${h.toString()}`;
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
    const i = `${E()}/bff/login`, s = new URLSearchParams({
      client_id: r,
      redirect_url: n
    });
    A.debug("Completing OAuth flow", { clientId: r, returnUrl: n }), window.location.href = `${i}?${s.toString()}`;
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
    var t;
    if (!V())
      throw new k(
        "Authentication service is not configured. Please contact your administrator."
      );
    try {
      const r = await b.post(
        `${E()}/bff/token`,
        { client_id: W() },
        { withCredentials: !0 }
      );
      return {
        accessToken: r.data.access_token,
        tokenType: r.data.token_type,
        expiresIn: r.data.expires_in,
        scope: r.data.scope
      };
    } catch (r) {
      if (b.isAxiosError(r) && ((t = r.response) == null ? void 0 : t.status) === 401)
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
      return await b.post(
        `${E()}/bff/logout`,
        {},
        {
          withCredentials: !0
        }
      ), { success: !0 };
    } catch (t) {
      if (b.isAxiosError(t)) {
        const r = ae(t);
        if (r)
          throw r;
      }
      throw t;
    }
  }
}
const w = new ke();
function Ne() {
  return w;
}
const C = y("JwtUtils");
function xe(e) {
  if (!e)
    return null;
  try {
    return ee(e);
  } catch (t) {
    return C.warn("Failed to decode JWT token:", t), null;
  }
}
function Ge(e) {
  const t = xe(e);
  return !(t != null && t.email) || typeof t.email != "string" ? null : t.email;
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
const H = 5, U = y("AuthStore");
let I = null;
const Y = fe("auth", {
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
      var e;
      return ((e = this.decodedToken) == null ? void 0 : e.email) ?? null;
    },
    /**
     * User roles from JWT access token.
     * Returns empty array if token is not available.
     */
    userRoles() {
      var e;
      return ((e = this.decodedToken) == null ? void 0 : e.roles) ?? [];
    },
    /**
     * User ID from JWT access token.
     * Returns null if token is not available.
     */
    userId() {
      var e;
      return ((e = this.decodedToken) == null ? void 0 : e.user_id) ?? null;
    },
    /**
     * User GUID from JWT access token.
     * Returns null if token is not available.
     */
    userGuid() {
      var e;
      return ((e = this.decodedToken) == null ? void 0 : e.guid) ?? null;
    },
    /**
     * Username from JWT access token.
     * Returns null if token is not available.
     */
    username() {
      var e;
      return ((e = this.decodedToken) == null ? void 0 : e.username) ?? null;
    },
    /**
     * Session ID from JWT access token.
     * Returns null if token is not available.
     */
    sessionId() {
      var e;
      return ((e = this.decodedToken) == null ? void 0 : e.session_id) ?? null;
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
        const e = await w.checkAuth();
        this.isAuthenticated = e.isAuthenticated, this.user = e.user, e.isAuthenticated && await this.ensureValidToken();
      } catch (e) {
        U.error("Failed to initialize auth:", e), this.isAuthenticated = !1, this.user = null, e instanceof k && this.setError({
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
      if (this.accessToken && !this.checkTokenNeedsRefresh())
        return this.accessToken;
      if (I) {
        const e = await I;
        return (e == null ? void 0 : e.accessToken) ?? null;
      }
      I = this._refreshToken();
      try {
        const e = await I;
        return (e == null ? void 0 : e.accessToken) ?? null;
      } finally {
        I = null;
      }
    },
    /**
     * Internal: Refresh the access token
     * @private
     */
    async _refreshToken() {
      try {
        const e = await w.getAccessToken();
        return e ? !e.accessToken || e.accessToken.trim() === "" ? (U.error("Invalid token response: empty accessToken"), this.setError({
          type: "session_expired",
          message: "Invalid token received. Please sign in again."
        }), null) : ((typeof e.expiresIn != "number" || !Number.isFinite(e.expiresIn) || e.expiresIn < H) && (U.error(`Invalid expiresIn value: ${e.expiresIn}, using minimum`), e.expiresIn = H), this.accessToken = e.accessToken, this.tokenExpiresAt = Date.now() + e.expiresIn * 1e3, e) : (this.setError({
          type: "session_expired",
          message: "Your session has expired. Please sign in again."
        }), null);
      } catch (e) {
        return U.error("Token refresh failed:", e), e instanceof k ? (this.setError({
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
      this.isLoading = !0, this.error = null, w.login(e ? { returnUrl: e } : void 0);
    },
    /**
     * Logout - revoke session and reset state
     */
    async logout() {
      try {
        await w.logout();
      } catch (e) {
        U.error("Logout failed:", e);
      }
      this.$reset(), w.login();
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
  const e = Y(), t = c(() => e.isAuthenticated), r = c(() => e.isLoading), n = c(() => e.user), i = c(() => e.error), s = c(() => e.userEmail), f = c(() => e.decodedToken), h = c(() => e.userRoles), u = c(() => e.userId), a = c(() => e.userGuid), m = c(() => e.username), B = c(() => e.sessionId);
  function D(l) {
    return e.hasRole(l);
  }
  function x(l) {
    e.login(l);
  }
  async function F() {
    await e.logout();
  }
  function O() {
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
    decodedToken: f,
    userRoles: h,
    userId: u,
    userGuid: a,
    username: m,
    sessionId: B,
    // Actions
    login: x,
    logout: F,
    clearError: O,
    hasRole: D
  };
}
const K = y("AuthInterceptors");
function je(e, t) {
  e.interceptors.request.use(
    async (r) => {
      const n = t();
      if (!n.isAuthenticated)
        return r;
      try {
        const i = await n.ensureValidToken();
        i && (r.headers.Authorization = `Bearer ${i}`);
      } catch (i) {
        if (i instanceof k)
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
      var f, h, u;
      const n = t(), i = (f = r.response) == null ? void 0 : f.status, s = ae(r);
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
        const a = (u = (h = r.response) == null ? void 0 : h.data) == null ? void 0 : u.detail;
        n.setError({
          type: "permission_denied",
          message: typeof a == "string" ? a : "Permission denied"
        });
      }
      return Promise.reject(r);
    }
  );
}
const P = y("AuthGuard");
function Te(e) {
  return e.meta.public === !0;
}
async function Se(e) {
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
  getAuthService: () => w
};
function Ie(e = Ue) {
  let t = !1;
  return async (r) => {
    const n = e.getAuthStore(), i = e.getAuthService();
    try {
      if (!t) {
        t = !0;
        try {
          await n.initAuth();
        } catch (f) {
          P.error("Failed to initialize auth:", f);
        }
      }
      return Te(r) ? !0 : await Se(n) ? n.isAuthenticated ? !0 : (i.login({ returnUrl: r.fullPath }), !1) : (P.warn("Auth not ready, redirecting to login"), i.login({ returnUrl: r.fullPath }), !1);
    } catch (s) {
      return s instanceof k ? (P.error("Auth configuration error:", s.message), n.setError({
        type: "service_unavailable",
        message: s.message
      }), !0) : (P.error("Unexpected error in auth guard:", s), i.login({ returnUrl: r.fullPath }), !1);
    }
  };
}
function qe(e) {
  e.beforeEach(Ie());
}
const X = "Your session has ended. Sign in again to continue.", ze = /* @__PURE__ */ M({
  name: "SessionExpiredModal",
  __name: "SessionExpiredModal",
  setup(e) {
    const t = y("SessionExpiredModal"), r = z(), { error: n, login: i } = J(), s = L(!1), f = c(() => {
      var a;
      return ((a = n.value) == null ? void 0 : a.type) === "session_expired";
    }), h = c(
      () => {
        var a;
        return ((a = n.value) == null ? void 0 : a.type) === "session_expired" && n.value.message || X;
      }
    );
    function u() {
      if (!s.value) {
        s.value = !0, t.info("User initiated re-authentication from session expired modal");
        try {
          const a = window.location.href;
          i(a);
        } catch (a) {
          s.value = !1, t.error("Failed to initiate login redirect", a);
        }
      }
    }
    return (a, m) => (T(), S(o(he), {
      "model-value": f.value,
      persistent: "",
      "max-width": "400",
      "data-testid": "session-expired-modal",
      "aria-labelledby": "session-expired-title",
      "aria-describedby": "session-expired-message"
    }, {
      default: d(() => [
        p(o(te), null, {
          default: d(() => [
            p(o(re), {
              id: "session-expired-title",
              class: "text-h5 d-flex align-center"
            }, {
              default: d(() => [
                o(r).icons.sessionExpired ? (T(), S(o(G), {
                  key: 0,
                  color: "warning",
                  class: "mr-2"
                }, {
                  default: d(() => [
                    v(_(o(r).icons.sessionExpired), 1)
                  ]),
                  _: 1
                })) : N("", !0),
                m[0] || (m[0] = v(" Session Expired ", -1))
              ]),
              _: 1
            }),
            p(o(ne), { id: "session-expired-message" }, {
              default: d(() => [
                v(_(h.value), 1)
              ]),
              _: 1
            }),
            p(o(ie), null, {
              default: d(() => [
                p(o(ge)),
                p(o(j), {
                  color: "primary",
                  variant: "elevated",
                  "prepend-icon": o(r).icons.login || void 0,
                  loading: s.value,
                  disabled: s.value,
                  "data-testid": "session-expired-sign-in-button",
                  "aria-label": "Sign in to continue",
                  onClick: u
                }, {
                  default: d(() => [...m[1] || (m[1] = [
                    v(" Sign In ", -1)
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
}), Ce = { class: "d-flex align-center" }, Pe = 5e3, Q = "You do not have permission to perform this action.", Ye = /* @__PURE__ */ M({
  name: "PermissionDeniedToast",
  __name: "PermissionDeniedToast",
  setup(e) {
    const t = y("PermissionDeniedToast"), r = z(), { error: n, clearError: i } = J(), s = c({
      get: () => {
        var u;
        return ((u = n.value) == null ? void 0 : u.type) === "permission_denied";
      },
      set: (u) => {
        u || h();
      }
    }), f = c(
      () => {
        var u;
        return ((u = n.value) == null ? void 0 : u.type) === "permission_denied" && n.value.message || Q;
      }
    );
    function h() {
      t.info("Permission denied toast closed"), i();
    }
    return (u, a) => (T(), S(o(pe), {
      modelValue: s.value,
      "onUpdate:modelValue": a[0] || (a[0] = (m) => s.value = m),
      timeout: Pe,
      color: "warning",
      location: "top",
      "data-testid": "permission-denied-toast",
      role: "status",
      "aria-live": "polite"
    }, {
      actions: d(() => [
        p(o(j), {
          variant: "text",
          "data-testid": "permission-denied-close-button",
          "aria-label": "Dismiss notification",
          onClick: h
        }, {
          default: d(() => [...a[1] || (a[1] = [
            v(" Close ", -1)
          ])]),
          _: 1
        })
      ]),
      default: d(() => [
        R("div", Ce, [
          o(r).icons.permissionDenied ? (T(), S(o(G), {
            key: 0,
            class: "mr-2"
          }, {
            default: d(() => [
              v(_(o(r).icons.permissionDenied), 1)
            ]),
            _: 1
          })) : N("", !0),
          R("span", null, _(f.value), 1)
        ])
      ]),
      _: 1
    }, 8, ["modelValue"]));
  }
}), Re = { class: "text-body-1 mb-4" }, De = ["aria-label"], $ = 30, Z = "We're having trouble connecting to authentication services.", Je = /* @__PURE__ */ M({
  name: "ServiceUnavailableOverlay",
  __name: "ServiceUnavailableOverlay",
  setup(e) {
    const t = y("ServiceUnavailableOverlay"), r = z(), { error: n } = J(), i = Y(), s = L($), f = L($), h = L(!1);
    let u = null;
    const a = c(() => {
      var l;
      return ((l = n.value) == null ? void 0 : l.type) === "service_unavailable";
    }), m = c(
      () => {
        var l;
        return ((l = n.value) == null ? void 0 : l.type) === "service_unavailable" && n.value.message || Z;
      }
    ), B = c(() => f.value === 0 ? 0 : Math.floor((f.value - s.value) / f.value * 100));
    function D(l) {
      x(), f.value = l, s.value = l, u = setInterval(() => {
        s.value > 0 && (s.value--, s.value === 0 && F());
      }, 1e3);
    }
    function x() {
      u && (clearInterval(u), u = null);
    }
    async function F() {
      var l;
      if (!h.value) {
        h.value = !0, x(), t.info("Attempting auth service retry");
        try {
          const g = await w.checkAuth();
          i.clearError(), t.info("Auth service retry successful", { isAuthenticated: g.isAuthenticated });
        } catch (g) {
          t.warn("Auth service retry failed, restarting countdown", g);
          const le = ((l = n.value) == null ? void 0 : l.retryAfter) ?? $;
          D(le);
        } finally {
          h.value = !1;
        }
      }
    }
    function O() {
      t.info("User initiated manual retry from service unavailable overlay"), F();
    }
    return ce(
      () => n.value,
      (l) => {
        if ((l == null ? void 0 : l.type) === "service_unavailable") {
          const g = l.retryAfter ?? $;
          t.info(`Auth service unavailable, starting countdown: ${g}s`), D(g);
        } else
          x();
      },
      { immediate: !0 }
    ), de(() => {
      x();
    }), (l, g) => (T(), S(o(me), {
      "model-value": a.value,
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
      default: d(() => [
        p(o(te), {
          "max-width": "450",
          class: "pa-4",
          elevation: "24"
        }, {
          default: d(() => [
            p(o(re), {
              id: "service-unavailable-title",
              class: "text-h5 d-flex align-center justify-center"
            }, {
              default: d(() => [
                o(r).icons.serviceUnavailable ? (T(), S(o(G), {
                  key: 0,
                  color: "error",
                  size: "32",
                  class: "mr-2"
                }, {
                  default: d(() => [
                    v(_(o(r).icons.serviceUnavailable), 1)
                  ]),
                  _: 1
                })) : N("", !0),
                g[0] || (g[0] = v(" Service Issue ", -1))
              ]),
              _: 1
            }),
            p(o(ne), {
              id: "service-unavailable-message",
              class: "text-center"
            }, {
              default: d(() => [
                R("p", Re, _(m.value), 1),
                g[1] || (g[1] = R("p", { class: "text-body-2 text-medium-emphasis mb-4" }, "Retrying automatically...", -1)),
                p(o(ve), {
                  "model-value": B.value,
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
                }, " Retry in " + _(s.value) + "s ", 9, De)
              ]),
              _: 1
            }),
            p(o(ie), { class: "justify-center" }, {
              default: d(() => [
                p(o(j), {
                  color: "primary",
                  variant: "elevated",
                  "prepend-icon": o(r).icons.retry || void 0,
                  loading: h.value,
                  disabled: h.value,
                  "data-testid": "try-now-button",
                  "aria-label": "Try connecting now",
                  onClick: O
                }, {
                  default: d(() => [...g[2] || (g[2] = [
                    v(" Try Now ", -1)
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
  k as AuthConfigurationError,
  ke as AuthService,
  se as BFF_AUTH_CONFIG_KEY,
  we as DEFAULT_ICONS,
  Ye as PermissionDeniedToast,
  Je as ServiceUnavailableOverlay,
  ze as SessionExpiredModal,
  w as authService,
  Me as bffAuthPlugin,
  Ie as createAuthGuard,
  Ee as decodeAccessToken,
  xe as decodeJwt,
  Ge as extractEmailFromJwt,
  q as getGlobalConfig,
  V as isAuthConfigured,
  _e as mapErrorType,
  ae as parseAuthError,
  ye as setGlobalConfig,
  qe as setupAuthGuard,
  je as setupAuthInterceptors,
  J as useAuth,
  z as useAuthConfig,
  Ne as useAuthService,
  Y as useAuthStore
};
