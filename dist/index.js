import { createLogger as y } from "@turnkeystaffing/get-native-vue-logger";
import { inject as le, computed as a, defineComponent as M, ref as L, openBlock as T, createBlock as S, unref as o, withCtx as l, createVNode as h, createTextVNode as v, toDisplayString as _, createCommentVNode as N, createElementVNode as R, watch as ue, onUnmounted as ce } from "vue";
import { defineStore as de } from "pinia";
import b from "axios";
import { jwtDecode as ee } from "jwt-decode";
import { VDialog as fe, VCard as te, VCardTitle as re, VIcon as G, VCardText as ne, VCardActions as ie, VSpacer as he, VBtn as j, VSnackbar as ge, VOverlay as pe, VProgressLinear as me } from "vuetify/components";
const se = /* @__PURE__ */ Symbol("bff-auth-config");
let oe = null;
function ve(e) {
  oe = e;
}
function q() {
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
}
function be(e) {
  const t = e.logger ?? y("BffAuth");
  return {
    bffBaseUrl: e.bffBaseUrl,
    clientId: e.clientId,
    logger: t,
    icons: { ...ye, ...e.icons }
  };
}
const Oe = {
  install(e, t) {
    we(t);
    const r = be(t);
    e.provide(se, r), ve(r), r.logger.debug("BFF Auth plugin installed", {
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
  return q()?.bffBaseUrl || "";
}
function W() {
  return q()?.clientId || "";
}
function V() {
  const e = q();
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
    } catch (t) {
      if (b.isAxiosError(t) && t.response?.status === 401)
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
    const s = i.href, u = `${E()}/bff/login`, c = new URLSearchParams({
      client_id: W(),
      redirect_url: s
    });
    A.debug("Initiating login redirect", { returnUrl: s }), window.location.href = `${u}?${c.toString()}`;
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
    if (!V())
      throw new k(
        "Authentication service is not configured. Please contact your administrator."
      );
    try {
      const t = await b.post(
        `${E()}/bff/token`,
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
      if (b.isAxiosError(t) && t.response?.status === 401)
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
const w = new _e();
function Me() {
  return w;
}
const C = y("JwtUtils");
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
function xe(e) {
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
    decodedToken: (e) => xe(e.accessToken),
    /**
     * User email extracted from JWT access token.
     * Returns null if token is not available or email claim is missing.
     */
    userEmail() {
      return this.decodedToken?.email ?? null;
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
      if (I)
        return (await I)?.accessToken ?? null;
      I = this._refreshToken();
      try {
        return (await I)?.accessToken ?? null;
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
  const e = Y(), t = a(() => e.isAuthenticated), r = a(() => e.isLoading), n = a(() => e.user), i = a(() => e.error), s = a(() => e.userEmail), u = a(() => e.decodedToken), c = a(() => e.userRoles), g = a(() => e.userId), f = a(() => e.userGuid), m = a(() => e.username), B = a(() => e.sessionId);
  function D(d) {
    return e.hasRole(d);
  }
  function x(d) {
    e.login(d);
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
    decodedToken: u,
    userRoles: c,
    userId: g,
    userGuid: f,
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
function Ge(e, t) {
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
        const u = r.response?.data?.detail;
        n.setError({
          type: "permission_denied",
          message: typeof u == "string" ? u : "Permission denied"
        });
      }
      return Promise.reject(r);
    }
  );
}
const P = y("AuthGuard");
function Ee(e) {
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
const Se = {
  getAuthStore: () => Y(),
  getAuthService: () => w
};
function Ue(e = Se) {
  let t = !1;
  return async (r) => {
    const n = e.getAuthStore(), i = e.getAuthService();
    try {
      if (Ee(r))
        return !0;
      if (!t) {
        t = !0;
        try {
          await n.initAuth();
        } catch (u) {
          P.error("Failed to initialize auth:", u);
        }
      }
      return await Te(n) ? n.isAuthenticated ? !0 : (i.login({ returnUrl: r.fullPath }), !1) : (P.warn("Auth not ready, redirecting to login"), i.login({ returnUrl: r.fullPath }), !1);
    } catch (s) {
      return s instanceof k ? (P.error("Auth configuration error:", s.message), n.setError({
        type: "service_unavailable",
        message: s.message
      }), !0) : (P.error("Unexpected error in auth guard:", s), i.login({ returnUrl: r.fullPath }), !1);
    }
  };
}
function je(e) {
  e.beforeEach(Ue());
}
const X = "Your session has ended. Sign in again to continue.", qe = /* @__PURE__ */ M({
  name: "SessionExpiredModal",
  __name: "SessionExpiredModal",
  setup(e) {
    const t = y("SessionExpiredModal"), r = z(), { error: n, login: i } = J(), s = L(!1), u = a(() => n.value?.type === "session_expired"), c = a(
      () => n.value?.type === "session_expired" && n.value.message || X
    );
    function g() {
      if (!s.value) {
        s.value = !0, t.info("User initiated re-authentication from session expired modal");
        try {
          const f = window.location.href;
          i(f);
        } catch (f) {
          s.value = !1, t.error("Failed to initiate login redirect", f);
        }
      }
    }
    return (f, m) => (T(), S(o(fe), {
      "model-value": u.value,
      persistent: "",
      "max-width": "400",
      "data-testid": "session-expired-modal",
      "aria-labelledby": "session-expired-title",
      "aria-describedby": "session-expired-message"
    }, {
      default: l(() => [
        h(o(te), null, {
          default: l(() => [
            h(o(re), {
              id: "session-expired-title",
              class: "text-h5 d-flex align-center"
            }, {
              default: l(() => [
                o(r).icons.sessionExpired ? (T(), S(o(G), {
                  key: 0,
                  color: "warning",
                  class: "mr-2"
                }, {
                  default: l(() => [
                    v(_(o(r).icons.sessionExpired), 1)
                  ]),
                  _: 1
                })) : N("", !0),
                m[0] || (m[0] = v(" Session Expired ", -1))
              ]),
              _: 1
            }),
            h(o(ne), { id: "session-expired-message" }, {
              default: l(() => [
                v(_(c.value), 1)
              ]),
              _: 1
            }),
            h(o(ie), null, {
              default: l(() => [
                h(o(he)),
                h(o(j), {
                  color: "primary",
                  variant: "elevated",
                  "prepend-icon": o(r).icons.login || void 0,
                  loading: s.value,
                  disabled: s.value,
                  "data-testid": "session-expired-sign-in-button",
                  "aria-label": "Sign in to continue",
                  onClick: g
                }, {
                  default: l(() => [...m[1] || (m[1] = [
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
}), Ie = { class: "d-flex align-center" }, Ce = 5e3, Q = "You do not have permission to perform this action.", ze = /* @__PURE__ */ M({
  name: "PermissionDeniedToast",
  __name: "PermissionDeniedToast",
  setup(e) {
    const t = y("PermissionDeniedToast"), r = z(), { error: n, clearError: i } = J(), s = a({
      get: () => n.value?.type === "permission_denied",
      set: (g) => {
        g || c();
      }
    }), u = a(
      () => n.value?.type === "permission_denied" && n.value.message || Q
    );
    function c() {
      t.info("Permission denied toast closed"), i();
    }
    return (g, f) => (T(), S(o(ge), {
      modelValue: s.value,
      "onUpdate:modelValue": f[0] || (f[0] = (m) => s.value = m),
      timeout: Ce,
      color: "warning",
      location: "top",
      "data-testid": "permission-denied-toast",
      role: "status",
      "aria-live": "polite"
    }, {
      actions: l(() => [
        h(o(j), {
          variant: "text",
          "data-testid": "permission-denied-close-button",
          "aria-label": "Dismiss notification",
          onClick: c
        }, {
          default: l(() => [...f[1] || (f[1] = [
            v(" Close ", -1)
          ])]),
          _: 1
        })
      ]),
      default: l(() => [
        R("div", Ie, [
          o(r).icons.permissionDenied ? (T(), S(o(G), {
            key: 0,
            class: "mr-2"
          }, {
            default: l(() => [
              v(_(o(r).icons.permissionDenied), 1)
            ]),
            _: 1
          })) : N("", !0),
          R("span", null, _(u.value), 1)
        ])
      ]),
      _: 1
    }, 8, ["modelValue"]));
  }
}), Pe = { class: "text-body-1 mb-4" }, Re = ["aria-label"], $ = 30, Z = "We're having trouble connecting to authentication services.", Ye = /* @__PURE__ */ M({
  name: "ServiceUnavailableOverlay",
  __name: "ServiceUnavailableOverlay",
  setup(e) {
    const t = y("ServiceUnavailableOverlay"), r = z(), { error: n } = J(), i = Y(), s = L($), u = L($), c = L(!1);
    let g = null;
    const f = a(() => n.value?.type === "service_unavailable"), m = a(
      () => n.value?.type === "service_unavailable" && n.value.message || Z
    ), B = a(() => u.value === 0 ? 0 : Math.floor((u.value - s.value) / u.value * 100));
    function D(d) {
      x(), u.value = d, s.value = d, g = setInterval(() => {
        s.value > 0 && (s.value--, s.value === 0 && F());
      }, 1e3);
    }
    function x() {
      g && (clearInterval(g), g = null);
    }
    async function F() {
      if (!c.value) {
        c.value = !0, x(), t.info("Attempting auth service retry");
        try {
          const d = await w.checkAuth();
          i.clearError(), t.info("Auth service retry successful", { isAuthenticated: d.isAuthenticated });
        } catch (d) {
          t.warn("Auth service retry failed, restarting countdown", d);
          const p = n.value?.retryAfter ?? $;
          D(p);
        } finally {
          c.value = !1;
        }
      }
    }
    function O() {
      t.info("User initiated manual retry from service unavailable overlay"), F();
    }
    return ue(
      () => n.value,
      (d) => {
        if (d?.type === "service_unavailable") {
          const p = d.retryAfter ?? $;
          t.info(`Auth service unavailable, starting countdown: ${p}s`), D(p);
        } else
          x();
      },
      { immediate: !0 }
    ), ce(() => {
      x();
    }), (d, p) => (T(), S(o(pe), {
      "model-value": f.value,
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
      default: l(() => [
        h(o(te), {
          "max-width": "450",
          class: "pa-4",
          elevation: "24"
        }, {
          default: l(() => [
            h(o(re), {
              id: "service-unavailable-title",
              class: "text-h5 d-flex align-center justify-center"
            }, {
              default: l(() => [
                o(r).icons.serviceUnavailable ? (T(), S(o(G), {
                  key: 0,
                  color: "error",
                  size: "32",
                  class: "mr-2"
                }, {
                  default: l(() => [
                    v(_(o(r).icons.serviceUnavailable), 1)
                  ]),
                  _: 1
                })) : N("", !0),
                p[0] || (p[0] = v(" Service Issue ", -1))
              ]),
              _: 1
            }),
            h(o(ne), {
              id: "service-unavailable-message",
              class: "text-center"
            }, {
              default: l(() => [
                R("p", Pe, _(m.value), 1),
                p[1] || (p[1] = R("p", { class: "text-body-2 text-medium-emphasis mb-4" }, "Retrying automatically...", -1)),
                h(o(me), {
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
                }, " Retry in " + _(s.value) + "s ", 9, Re)
              ]),
              _: 1
            }),
            h(o(ie), { class: "justify-center" }, {
              default: l(() => [
                h(o(j), {
                  color: "primary",
                  variant: "elevated",
                  "prepend-icon": o(r).icons.retry || void 0,
                  loading: c.value,
                  disabled: c.value,
                  "data-testid": "try-now-button",
                  "aria-label": "Try connecting now",
                  onClick: O
                }, {
                  default: l(() => [...p[2] || (p[2] = [
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
  _e as AuthService,
  se as BFF_AUTH_CONFIG_KEY,
  ye as DEFAULT_ICONS,
  ze as PermissionDeniedToast,
  Ye as ServiceUnavailableOverlay,
  qe as SessionExpiredModal,
  w as authService,
  Oe as bffAuthPlugin,
  Ue as createAuthGuard,
  xe as decodeAccessToken,
  ke as decodeJwt,
  Ne as extractEmailFromJwt,
  q as getGlobalConfig,
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
