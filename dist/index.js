import { createLogger as v } from "@turnkeystaffing/get-native-vue-logger";
import { inject as ne, computed as p, defineComponent as L, ref as I, openBlock as F, createBlock as $, unref as u, withCtx as c, createVNode as f, createTextVNode as m, toDisplayString as P, createElementVNode as T, watch as se, onUnmounted as ae } from "vue";
import { defineStore as oe } from "pinia";
import w from "axios";
import { jwtDecode as le } from "jwt-decode";
import { VDialog as ue, VCard as W, VCardTitle as H, VIcon as B, VCardText as K, VCardActions as X, VSpacer as ce, VBtn as V, VSnackbar as de, VOverlay as fe, VProgressLinear as he } from "vuetify/components";
const Q = Symbol("bff-auth-config");
let Z = null;
function ge(e) {
  Z = e;
}
function D() {
  return Z;
}
function Ve() {
  const e = ne(Q);
  if (!e)
    throw new Error(
      "BFF Auth config not found. Did you forget to install the plugin with app.use(bffAuthPlugin, options)?"
    );
  return e;
}
function pe(e) {
  if (!e.bffBaseUrl)
    throw new Error("bffAuthPlugin: bffBaseUrl is required");
  if (!e.clientId)
    throw new Error("bffAuthPlugin: clientId is required");
}
function me(e) {
  const r = e.logger ?? v("BffAuth");
  return {
    bffBaseUrl: e.bffBaseUrl,
    clientId: e.clientId,
    logger: r
  };
}
const De = {
  install(e, r) {
    pe(r);
    const t = me(r);
    e.provide(Q, t), ge(t), t.logger.debug("BFF Auth plugin installed", {
      bffBaseUrl: t.bffBaseUrl,
      clientId: t.clientId
    });
  }
}, A = v("AuthService");
class b extends Error {
  constructor(r) {
    super(r), this.name = "AuthConfigurationError";
  }
}
function _() {
  var e;
  return ((e = D()) == null ? void 0 : e.bffBaseUrl) || "";
}
function j() {
  var e;
  return ((e = D()) == null ? void 0 : e.clientId) || "";
}
function C() {
  const e = D();
  return !!(e != null && e.bffBaseUrl && (e != null && e.clientId));
}
function ve(e) {
  return {
    authentication_error: "session_expired",
    authorization_error: "permission_denied",
    auth_service_unavailable: "service_unavailable"
  }[e];
}
function ee(e) {
  var n, i;
  if (!((i = (n = e.response) == null ? void 0 : n.data) != null && i.error_type))
    return null;
  const r = e.response.data, t = {
    type: ve(r.error_type),
    message: r.detail
  };
  return r.retry_after !== void 0 && (t.retryAfter = r.retry_after), t;
}
class ye {
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
  async submitCredentials(r, t) {
    try {
      await w.post(
        `${_()}/api/v1/oauth/login`,
        { email: r, password: t },
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
    var r;
    if (!C())
      throw new b(
        "Authentication service is not configured. Please contact your administrator."
      );
    try {
      return {
        isAuthenticated: !0,
        user: (await w.get(`${_()}/bff/userinfo`, {
          withCredentials: !0
          // Include bff_session cookie
        })).data
      };
    } catch (t) {
      if (w.isAxiosError(t) && ((r = t.response) == null ? void 0 : r.status) === 401)
        return {
          isAuthenticated: !1,
          user: null
        };
      throw t;
    }
  }
  /**
   * Initiate login flow by redirecting to BFF login endpoint
   * This performs a full page redirect to Central Login
   *
   * @param returnUrl - URL or path to return to after authentication (defaults to current URL)
   *                    Can be a full URL (http://...) or a relative path (/dashboard)
   *                    External URLs are blocked for security (Open Redirect prevention)
   */
  initiateLogin(r) {
    if (!C())
      throw A.error("Cannot initiate login: Auth configuration is incomplete"), new b(
        "Authentication service is not configured. Please contact your administrator."
      );
    const t = r || window.location.href;
    let n;
    try {
      n = new URL(t, window.location.origin);
    } catch {
      A.warn("Malformed returnUrl, falling back to current page:", t), n = new URL(window.location.href);
    }
    n.origin !== window.location.origin && (A.warn("Blocked external redirect attempt:", t), n = new URL("/", window.location.origin));
    const i = n.href, a = `${_()}/bff/login`, l = new URLSearchParams({
      client_id: j(),
      redirect_url: i
    });
    A.debug("Initiating login redirect", { returnUrl: i }), window.location.href = `${a}?${l.toString()}`;
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
    var r;
    if (!C())
      throw new b(
        "Authentication service is not configured. Please contact your administrator."
      );
    try {
      const t = await w.post(
        `${_()}/bff/token`,
        { client_id: j() },
        { withCredentials: !0 }
      );
      return {
        accessToken: t.data.access_token,
        tokenType: t.data.token_type,
        expiresIn: t.data.expires_in,
        scope: t.data.scope
      };
    } catch (t) {
      if (w.isAxiosError(t) && ((r = t.response) == null ? void 0 : r.status) === 401)
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
      return await w.post(
        `${_()}/bff/logout`,
        {},
        {
          withCredentials: !0
        }
      ), { success: !0 };
    } catch (r) {
      if (w.isAxiosError(r)) {
        const t = ee(r);
        if (t)
          throw t;
      }
      throw r;
    }
  }
}
const y = new ye();
function Re() {
  return y;
}
const we = v("JwtUtils");
function be(e) {
  if (!e)
    return null;
  try {
    return le(e);
  } catch (r) {
    return we.warn("Failed to decode JWT token:", r), null;
  }
}
function Ae(e) {
  const r = be(e);
  return !(r != null && r.email) || typeof r.email != "string" ? null : r.email;
}
const G = 5, x = v("AuthStore");
let E = null;
const R = oe("auth", {
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
     * User email extracted from JWT access token.
     * Returns null if token is not available or email claim is missing.
     */
    userEmail: (e) => Ae(e.accessToken)
  },
  actions: {
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
        const e = await y.checkAuth();
        this.isAuthenticated = e.isAuthenticated, this.user = e.user, e.isAuthenticated && await this.ensureValidToken();
      } catch (e) {
        x.error("Failed to initialize auth:", e), this.isAuthenticated = !1, this.user = null, e instanceof b && this.setError({
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
      if (E) {
        const e = await E;
        return (e == null ? void 0 : e.accessToken) ?? null;
      }
      E = this._refreshToken();
      try {
        const e = await E;
        return (e == null ? void 0 : e.accessToken) ?? null;
      } finally {
        E = null;
      }
    },
    /**
     * Internal: Refresh the access token
     * @private
     */
    async _refreshToken() {
      try {
        const e = await y.getAccessToken();
        return e ? !e.accessToken || e.accessToken.trim() === "" ? (x.error("Invalid token response: empty accessToken"), this.setError({
          type: "session_expired",
          message: "Invalid token received. Please sign in again."
        }), null) : ((typeof e.expiresIn != "number" || !Number.isFinite(e.expiresIn) || e.expiresIn < G) && (x.error(`Invalid expiresIn value: ${e.expiresIn}, using minimum`), e.expiresIn = G), this.accessToken = e.accessToken, this.tokenExpiresAt = Date.now() + e.expiresIn * 1e3, e) : (this.setError({
          type: "session_expired",
          message: "Your session has expired. Please sign in again."
        }), null);
      } catch (e) {
        return x.error("Token refresh failed:", e), e instanceof b ? (this.setError({
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
      this.isLoading = !0, this.error = null, y.initiateLogin(e);
    },
    /**
     * Logout - revoke session and reset state
     */
    async logout() {
      try {
        await y.logout();
      } catch (e) {
        x.error("Logout failed:", e);
      }
      this.$reset(), y.initiateLogin();
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
function M() {
  const e = R(), r = p(() => e.isAuthenticated), t = p(() => e.isLoading), n = p(() => e.user), i = p(() => e.error), a = p(() => e.userEmail);
  function l(h) {
    e.login(h);
  }
  async function o() {
    await e.logout();
  }
  function s() {
    e.clearError();
  }
  return {
    // Reactive state
    isAuthenticated: r,
    isLoading: t,
    user: n,
    userEmail: a,
    error: i,
    // Actions
    login: l,
    logout: o,
    clearError: s
  };
}
const z = v("AuthInterceptors");
function Me(e, r) {
  e.interceptors.request.use(
    async (t) => {
      const n = r();
      if (!n.isAuthenticated)
        return t;
      try {
        const i = await n.ensureValidToken();
        i && (t.headers.Authorization = `Bearer ${i}`);
      } catch (i) {
        if (i instanceof b)
          return n.setError({
            type: "service_unavailable",
            message: i.message
          }), Promise.reject(i);
        z.error("Failed to get auth token:", i instanceof Error ? i.message : "Unknown error");
      }
      return t;
    },
    (t) => Promise.reject(t)
  ), e.interceptors.response.use(
    (t) => t,
    async (t) => {
      var l, o, s;
      const n = r(), i = (l = t.response) == null ? void 0 : l.status, a = ee(t);
      if (i === 401 && !C())
        z.warn("401 received but auth is not configured, ignoring");
      else if (a)
        n.setError(a);
      else if (i === 401)
        n.setError({
          type: "session_expired",
          message: "Your session has expired. Please sign in again."
        });
      else if (i === 403) {
        const h = (s = (o = t.response) == null ? void 0 : o.data) == null ? void 0 : s.detail;
        n.setError({
          type: "permission_denied",
          message: typeof h == "string" ? h : "Permission denied"
        });
      }
      return Promise.reject(t);
    }
  );
}
const k = v("AuthGuard");
function _e(e) {
  return e.meta.public === !0;
}
async function xe(e) {
  if (!e.isLoading)
    return !0;
  let r = 0;
  const t = 200;
  for (; e.isLoading && r < t; )
    await new Promise((n) => setTimeout(n, 50)), r++;
  return e.isLoading ? (k.warn("Auth initialization timed out after 10 seconds"), !1) : !0;
}
const Ee = {
  getAuthStore: () => R(),
  getAuthService: () => y
};
function ke(e = Ee) {
  let r = !1;
  return async (t) => {
    const n = e.getAuthStore(), i = e.getAuthService();
    try {
      if (!r) {
        r = !0;
        try {
          await n.initAuth();
        } catch (l) {
          k.error("Failed to initialize auth:", l);
        }
      }
      return _e(t) ? !0 : await xe(n) ? n.isAuthenticated ? !0 : (i.initiateLogin(t.fullPath), !1) : (k.warn("Auth not ready, redirecting to login"), i.initiateLogin(t.fullPath), !1);
    } catch (a) {
      return a instanceof b ? (k.error("Auth configuration error:", a.message), n.setError({
        type: "service_unavailable",
        message: a.message
      }), !0) : (k.error("Unexpected error in auth guard:", a), i.initiateLogin(t.fullPath), !1);
    }
  };
}
function Ne(e) {
  e.beforeEach(ke());
}
const Y = "Your session has ended. Sign in again to continue.", Oe = /* @__PURE__ */ L({
  name: "SessionExpiredModal",
  __name: "SessionExpiredModal",
  setup(e) {
    const r = v("SessionExpiredModal"), { error: t, login: n } = M(), i = I(!1), a = p(() => {
      var s;
      return ((s = t.value) == null ? void 0 : s.type) === "session_expired";
    }), l = p(
      () => {
        var s;
        return ((s = t.value) == null ? void 0 : s.type) === "session_expired" && t.value.message || Y;
      }
    );
    function o() {
      if (!i.value) {
        i.value = !0, r.info("User initiated re-authentication from session expired modal");
        try {
          const s = window.location.href;
          n(s);
        } catch (s) {
          i.value = !1, r.error("Failed to initiate login redirect", s);
        }
      }
    }
    return (s, h) => (F(), $(u(ue), {
      "model-value": a.value,
      persistent: "",
      "max-width": "400",
      "data-testid": "session-expired-modal",
      "aria-labelledby": "session-expired-title",
      "aria-describedby": "session-expired-message"
    }, {
      default: c(() => [
        f(u(W), null, {
          default: c(() => [
            f(u(H), {
              id: "session-expired-title",
              class: "text-h5 d-flex align-center"
            }, {
              default: c(() => [
                f(u(B), {
                  color: "warning",
                  class: "mr-2"
                }, {
                  default: c(() => [...h[0] || (h[0] = [
                    m("mdi-clock-alert-outline", -1)
                  ])]),
                  _: 1
                }),
                h[1] || (h[1] = m(" Session Expired ", -1))
              ]),
              _: 1
            }),
            f(u(K), { id: "session-expired-message" }, {
              default: c(() => [
                m(P(l.value), 1)
              ]),
              _: 1
            }),
            f(u(X), null, {
              default: c(() => [
                f(u(ce)),
                f(u(V), {
                  color: "primary",
                  variant: "elevated",
                  "prepend-icon": "mdi-login",
                  loading: i.value,
                  disabled: i.value,
                  "data-testid": "session-expired-sign-in-button",
                  "aria-label": "Sign in to continue",
                  onClick: o
                }, {
                  default: c(() => [...h[2] || (h[2] = [
                    m(" Sign In ", -1)
                  ])]),
                  _: 1
                }, 8, ["loading", "disabled"])
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
}), Te = { class: "d-flex align-center" }, Se = 5e3, J = "You do not have permission to perform this action.", je = /* @__PURE__ */ L({
  name: "PermissionDeniedToast",
  __name: "PermissionDeniedToast",
  setup(e) {
    const r = v("PermissionDeniedToast"), { error: t, clearError: n } = M(), i = p({
      get: () => {
        var o;
        return ((o = t.value) == null ? void 0 : o.type) === "permission_denied";
      },
      set: (o) => {
        o || l();
      }
    }), a = p(
      () => {
        var o;
        return ((o = t.value) == null ? void 0 : o.type) === "permission_denied" && t.value.message || J;
      }
    );
    function l() {
      r.info("Permission denied toast closed"), n();
    }
    return (o, s) => (F(), $(u(de), {
      modelValue: i.value,
      "onUpdate:modelValue": s[0] || (s[0] = (h) => i.value = h),
      timeout: Se,
      color: "warning",
      location: "top",
      "data-testid": "permission-denied-toast",
      role: "status",
      "aria-live": "polite"
    }, {
      actions: c(() => [
        f(u(V), {
          variant: "text",
          "data-testid": "permission-denied-close-button",
          "aria-label": "Dismiss notification",
          onClick: l
        }, {
          default: c(() => [...s[2] || (s[2] = [
            m(" Close ", -1)
          ])]),
          _: 1
        })
      ]),
      default: c(() => [
        T("div", Te, [
          f(u(B), { class: "mr-2" }, {
            default: c(() => [...s[1] || (s[1] = [
              m("mdi-shield-alert", -1)
            ])]),
            _: 1
          }),
          T("span", null, P(a.value), 1)
        ])
      ]),
      _: 1
    }, 8, ["modelValue"]));
  }
}), Ue = { class: "text-body-1 mb-4" }, Ie = ["aria-label"], U = 30, q = "We're having trouble connecting to authentication services.", Ge = /* @__PURE__ */ L({
  name: "ServiceUnavailableOverlay",
  __name: "ServiceUnavailableOverlay",
  setup(e) {
    const r = v("ServiceUnavailableOverlay"), { error: t } = M(), n = R(), i = I(U), a = I(U), l = I(!1);
    let o = null;
    const s = p(() => {
      var d;
      return ((d = t.value) == null ? void 0 : d.type) === "service_unavailable";
    }), h = p(
      () => {
        var d;
        return ((d = t.value) == null ? void 0 : d.type) === "service_unavailable" && t.value.message || q;
      }
    ), te = p(() => a.value === 0 ? 0 : Math.floor((a.value - i.value) / a.value * 100));
    function N(d) {
      S(), a.value = d, i.value = d, o = setInterval(() => {
        i.value > 0 && (i.value--, i.value === 0 && O());
      }, 1e3);
    }
    function S() {
      o && (clearInterval(o), o = null);
    }
    async function O() {
      var d;
      if (!l.value) {
        l.value = !0, S(), r.info("Attempting auth service retry");
        try {
          const g = await y.checkAuth();
          n.clearError(), r.info("Auth service retry successful", { isAuthenticated: g.isAuthenticated });
        } catch (g) {
          r.warn("Auth service retry failed, restarting countdown", g);
          const ie = ((d = t.value) == null ? void 0 : d.retryAfter) ?? U;
          N(ie);
        } finally {
          l.value = !1;
        }
      }
    }
    function re() {
      r.info("User initiated manual retry from service unavailable overlay"), O();
    }
    return se(
      () => t.value,
      (d) => {
        if ((d == null ? void 0 : d.type) === "service_unavailable") {
          const g = d.retryAfter ?? U;
          r.info(`Auth service unavailable, starting countdown: ${g}s`), N(g);
        } else
          S();
      },
      { immediate: !0 }
    ), ae(() => {
      S();
    }), (d, g) => (F(), $(u(fe), {
      "model-value": s.value,
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
        f(u(W), {
          "max-width": "450",
          class: "pa-4",
          elevation: "24"
        }, {
          default: c(() => [
            f(u(H), {
              id: "service-unavailable-title",
              class: "text-h5 d-flex align-center justify-center"
            }, {
              default: c(() => [
                f(u(B), {
                  color: "error",
                  size: "32",
                  class: "mr-2"
                }, {
                  default: c(() => [...g[0] || (g[0] = [
                    m("mdi-cloud-off-outline", -1)
                  ])]),
                  _: 1
                }),
                g[1] || (g[1] = m(" Service Issue ", -1))
              ]),
              _: 1
            }),
            f(u(K), {
              id: "service-unavailable-message",
              class: "text-center"
            }, {
              default: c(() => [
                T("p", Ue, P(h.value), 1),
                g[2] || (g[2] = T("p", { class: "text-body-2 text-medium-emphasis mb-4" }, "Retrying automatically...", -1)),
                f(u(he), {
                  "model-value": te.value,
                  color: "primary",
                  height: "8",
                  rounded: "",
                  class: "mb-2",
                  "data-testid": "countdown-progress-bar"
                }, null, 8, ["model-value"]),
                T("p", {
                  class: "text-body-2 text-medium-emphasis",
                  "data-testid": "countdown-text",
                  "aria-label": `Retry in ${i.value} seconds`
                }, " Retry in " + P(i.value) + "s ", 9, Ie)
              ]),
              _: 1
            }),
            f(u(X), { class: "justify-center" }, {
              default: c(() => [
                f(u(V), {
                  color: "primary",
                  variant: "elevated",
                  "prepend-icon": "mdi-refresh",
                  loading: l.value,
                  disabled: l.value,
                  "data-testid": "try-now-button",
                  "aria-label": "Try connecting now",
                  onClick: re
                }, {
                  default: c(() => [...g[3] || (g[3] = [
                    m(" Try Now ", -1)
                  ])]),
                  _: 1
                }, 8, ["loading", "disabled"])
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
  ye as AuthService,
  Q as BFF_AUTH_CONFIG_KEY,
  je as PermissionDeniedToast,
  Ge as ServiceUnavailableOverlay,
  Oe as SessionExpiredModal,
  y as authService,
  De as bffAuthPlugin,
  ke as createAuthGuard,
  be as decodeJwt,
  Ae as extractEmailFromJwt,
  D as getGlobalConfig,
  C as isAuthConfigured,
  ve as mapErrorType,
  ee as parseAuthError,
  ge as setGlobalConfig,
  Ne as setupAuthGuard,
  Me as setupAuthInterceptors,
  M as useAuth,
  Ve as useAuthConfig,
  Re as useAuthService,
  R as useAuthStore
};
