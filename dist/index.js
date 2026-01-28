import { createLogger as m } from "@turnkeystaffing/get-native-vue-logger";
import { inject as se, computed as p, defineComponent as D, ref as F, resolveComponent as u, openBlock as M, createBlock as N, withCtx as d, createVNode as g, createTextVNode as v, toDisplayString as B, createElementVNode as C, watch as oe, onUnmounted as ae } from "vue";
import { defineStore as le } from "pinia";
import b from "axios";
import { jwtDecode as ce } from "jwt-decode";
const H = Symbol("bff-auth-config");
let K = null;
function ue(e) {
  K = e;
}
function O() {
  return K;
}
function Pe() {
  const e = se(H);
  if (!e)
    throw new Error(
      "BFF Auth config not found. Did you forget to install the plugin with app.use(bffAuthPlugin, options)?"
    );
  return e;
}
function de(e) {
  if (!e.bffBaseUrl)
    throw new Error("bffAuthPlugin: bffBaseUrl is required");
  if (!e.clientId)
    throw new Error("bffAuthPlugin: clientId is required");
}
function fe(e) {
  const r = e.logger ?? m("BffAuth");
  return {
    bffBaseUrl: e.bffBaseUrl,
    clientId: e.clientId,
    logger: r
  };
}
const Le = {
  install(e, r) {
    de(r);
    const t = fe(r);
    e.provide(H, t), ue(t), t.logger.debug("BFF Auth plugin installed", {
      bffBaseUrl: t.bffBaseUrl,
      clientId: t.clientId
    });
  }
}, x = m("AuthService");
class w extends Error {
  constructor(r) {
    super(r), this.name = "AuthConfigurationError";
  }
}
function T() {
  var e;
  return ((e = O()) == null ? void 0 : e.bffBaseUrl) || "";
}
function V() {
  var e;
  return ((e = O()) == null ? void 0 : e.clientId) || "";
}
function $() {
  const e = O();
  return !!(e != null && e.bffBaseUrl && (e != null && e.clientId));
}
function ge(e) {
  return {
    authentication_error: "session_expired",
    authorization_error: "permission_denied",
    auth_service_unavailable: "service_unavailable"
  }[e];
}
function X(e) {
  var i, n;
  if (!((n = (i = e.response) == null ? void 0 : i.data) != null && n.error_type))
    return null;
  const r = e.response.data, t = {
    type: ge(r.error_type),
    message: r.detail
  };
  return r.retry_after !== void 0 && (t.retryAfter = r.retry_after), t;
}
class he {
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
      await b.post(
        `${T()}/api/v1/oauth/login`,
        { email: r, password: t },
        { withCredentials: !0 }
        // Include cookies for session handling
      ), x.info("Credentials submitted successfully");
    } catch (i) {
      throw x.error("Failed to submit credentials", i), i;
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
    if (!$())
      throw new w(
        "Authentication service is not configured. Please contact your administrator."
      );
    try {
      return {
        isAuthenticated: !0,
        user: (await b.get(`${T()}/bff/userinfo`, {
          withCredentials: !0
          // Include bff_session cookie
        })).data
      };
    } catch (t) {
      if (b.isAxiosError(t) && ((r = t.response) == null ? void 0 : r.status) === 401)
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
    if (!$())
      throw x.error("Cannot initiate login: Auth configuration is incomplete"), new w(
        "Authentication service is not configured. Please contact your administrator."
      );
    const t = r || window.location.href;
    let i;
    try {
      i = new URL(t, window.location.origin);
    } catch {
      x.warn("Malformed returnUrl, falling back to current page:", t), i = new URL(window.location.href);
    }
    i.origin !== window.location.origin && (x.warn("Blocked external redirect attempt:", t), i = new URL("/", window.location.origin));
    const n = i.href, o = `${T()}/bff/login`, l = new URLSearchParams({
      client_id: V(),
      redirect_url: n
    });
    x.debug("Initiating login redirect", { returnUrl: n }), window.location.href = `${o}?${l.toString()}`;
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
    if (!$())
      throw new w(
        "Authentication service is not configured. Please contact your administrator."
      );
    try {
      const t = await b.post(
        `${T()}/bff/token`,
        { client_id: V() },
        { withCredentials: !0 }
      );
      return {
        accessToken: t.data.access_token,
        tokenType: t.data.token_type,
        expiresIn: t.data.expires_in,
        scope: t.data.scope
      };
    } catch (t) {
      if (b.isAxiosError(t) && ((r = t.response) == null ? void 0 : r.status) === 401)
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
        `${T()}/bff/logout`,
        {},
        {
          withCredentials: !0
        }
      ), { success: !0 };
    } catch (r) {
      if (b.isAxiosError(r)) {
        const t = X(r);
        if (t)
          throw t;
      }
      throw r;
    }
  }
}
const y = new he();
function Fe() {
  return y;
}
const pe = m("JwtUtils");
function ve(e) {
  if (!e)
    return null;
  try {
    return ce(e);
  } catch (r) {
    return pe.warn("Failed to decode JWT token:", r), null;
  }
}
function me(e) {
  const r = ve(e);
  return !(r != null && r.email) || typeof r.email != "string" ? null : r.email;
}
const z = 5, S = m("AuthStore");
let U = null;
const j = le("auth", {
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
    userEmail: (e) => me(e.accessToken)
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
        S.error("Failed to initialize auth:", e), this.isAuthenticated = !1, this.user = null, e instanceof w && this.setError({
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
      if (U) {
        const e = await U;
        return (e == null ? void 0 : e.accessToken) ?? null;
      }
      U = this._refreshToken();
      try {
        const e = await U;
        return (e == null ? void 0 : e.accessToken) ?? null;
      } finally {
        U = null;
      }
    },
    /**
     * Internal: Refresh the access token
     * @private
     */
    async _refreshToken() {
      try {
        const e = await y.getAccessToken();
        return e ? !e.accessToken || e.accessToken.trim() === "" ? (S.error("Invalid token response: empty accessToken"), this.setError({
          type: "session_expired",
          message: "Invalid token received. Please sign in again."
        }), null) : ((typeof e.expiresIn != "number" || !Number.isFinite(e.expiresIn) || e.expiresIn < z) && (S.error(`Invalid expiresIn value: ${e.expiresIn}, using minimum`), e.expiresIn = z), this.accessToken = e.accessToken, this.tokenExpiresAt = Date.now() + e.expiresIn * 1e3, e) : (this.setError({
          type: "session_expired",
          message: "Your session has expired. Please sign in again."
        }), null);
      } catch (e) {
        return S.error("Token refresh failed:", e), e instanceof w ? (this.setError({
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
        S.error("Logout failed:", e);
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
function G() {
  const e = j(), r = p(() => e.isAuthenticated), t = p(() => e.isLoading), i = p(() => e.user), n = p(() => e.error), o = p(() => e.userEmail);
  function l(h) {
    e.login(h);
  }
  async function a() {
    await e.logout();
  }
  function s() {
    e.clearError();
  }
  return {
    // Reactive state
    isAuthenticated: r,
    isLoading: t,
    user: i,
    userEmail: o,
    error: n,
    // Actions
    login: l,
    logout: a,
    clearError: s
  };
}
const Y = m("AuthInterceptors");
function $e(e, r) {
  e.interceptors.request.use(
    async (t) => {
      const i = r();
      if (!i.isAuthenticated)
        return t;
      try {
        const n = await i.ensureValidToken();
        n && (t.headers.Authorization = `Bearer ${n}`);
      } catch (n) {
        if (n instanceof w)
          return i.setError({
            type: "service_unavailable",
            message: n.message
          }), Promise.reject(n);
        Y.error("Failed to get auth token:", n instanceof Error ? n.message : "Unknown error");
      }
      return t;
    },
    (t) => Promise.reject(t)
  ), e.interceptors.response.use(
    (t) => t,
    async (t) => {
      var l, a, s;
      const i = r(), n = (l = t.response) == null ? void 0 : l.status, o = X(t);
      if (n === 401 && !$())
        Y.warn("401 received but auth is not configured, ignoring");
      else if (o)
        i.setError(o);
      else if (n === 401)
        i.setError({
          type: "session_expired",
          message: "Your session has expired. Please sign in again."
        });
      else if (n === 403) {
        const h = (s = (a = t.response) == null ? void 0 : a.data) == null ? void 0 : s.detail;
        i.setError({
          type: "permission_denied",
          message: typeof h == "string" ? h : "Permission denied"
        });
      }
      return Promise.reject(t);
    }
  );
}
const I = m("AuthGuard");
function _e(e) {
  return e.meta.public === !0;
}
async function ye(e) {
  if (!e.isLoading)
    return !0;
  let r = 0;
  const t = 200;
  for (; e.isLoading && r < t; )
    await new Promise((i) => setTimeout(i, 50)), r++;
  return e.isLoading ? (I.warn("Auth initialization timed out after 10 seconds"), !1) : !0;
}
const be = {
  getAuthStore: () => j(),
  getAuthService: () => y
};
function we(e = be) {
  let r = !1;
  return async (t) => {
    const i = e.getAuthStore(), n = e.getAuthService();
    try {
      if (!r) {
        r = !0;
        try {
          await i.initAuth();
        } catch (l) {
          I.error("Failed to initialize auth:", l);
        }
      }
      return _e(t) ? !0 : await ye(i) ? i.isAuthenticated ? !0 : (n.initiateLogin(t.fullPath), !1) : (I.warn("Auth not ready, redirecting to login"), n.initiateLogin(t.fullPath), !1);
    } catch (o) {
      return o instanceof w ? (I.error("Auth configuration error:", o.message), i.setError({
        type: "service_unavailable",
        message: o.message
      }), !0) : (I.error("Unexpected error in auth guard:", o), n.initiateLogin(t.fullPath), !1);
    }
  };
}
function Be(e) {
  e.beforeEach(we());
}
const J = "Your session has ended. Sign in again to continue.", Re = /* @__PURE__ */ D({
  name: "SessionExpiredModal",
  __name: "SessionExpiredModal",
  setup(e) {
    const r = m("SessionExpiredModal"), { error: t, login: i } = G(), n = F(!1), o = p(() => {
      var s;
      return ((s = t.value) == null ? void 0 : s.type) === "session_expired";
    }), l = p(
      () => {
        var s;
        return ((s = t.value) == null ? void 0 : s.type) === "session_expired" && t.value.message || J;
      }
    );
    function a() {
      if (!n.value) {
        n.value = !0, r.info("User initiated re-authentication from session expired modal");
        try {
          const s = window.location.href;
          i(s);
        } catch (s) {
          n.value = !1, r.error("Failed to initiate login redirect", s);
        }
      }
    }
    return (s, h) => {
      const E = u("v-icon"), A = u("v-card-title"), _ = u("v-card-text"), P = u("v-spacer"), R = u("v-btn"), c = u("v-card-actions"), f = u("v-card"), k = u("v-dialog");
      return M(), N(k, {
        "model-value": o.value,
        persistent: "",
        "max-width": "400",
        "data-testid": "session-expired-modal",
        "aria-labelledby": "session-expired-title",
        "aria-describedby": "session-expired-message"
      }, {
        default: d(() => [
          g(f, null, {
            default: d(() => [
              g(A, {
                id: "session-expired-title",
                class: "text-h5 d-flex align-center"
              }, {
                default: d(() => [
                  g(E, {
                    color: "warning",
                    class: "mr-2"
                  }, {
                    default: d(() => [...h[0] || (h[0] = [
                      v("mdi-clock-alert-outline", -1)
                    ])]),
                    _: 1
                  }),
                  h[1] || (h[1] = v(" Session Expired ", -1))
                ]),
                _: 1
              }),
              g(_, { id: "session-expired-message" }, {
                default: d(() => [
                  v(B(l.value), 1)
                ]),
                _: 1
              }),
              g(c, null, {
                default: d(() => [
                  g(P),
                  g(R, {
                    color: "primary",
                    variant: "elevated",
                    "prepend-icon": "mdi-login",
                    loading: n.value,
                    disabled: n.value,
                    "data-testid": "session-expired-sign-in-button",
                    "aria-label": "Sign in to continue",
                    onClick: a
                  }, {
                    default: d(() => [...h[2] || (h[2] = [
                      v(" Sign In ", -1)
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
      }, 8, ["model-value"]);
    };
  }
}), Ae = { class: "d-flex align-center" }, xe = 5e3, q = "You do not have permission to perform this action.", De = /* @__PURE__ */ D({
  name: "PermissionDeniedToast",
  __name: "PermissionDeniedToast",
  setup(e) {
    const r = m("PermissionDeniedToast"), { error: t, clearError: i } = G(), n = p({
      get: () => {
        var a;
        return ((a = t.value) == null ? void 0 : a.type) === "permission_denied";
      },
      set: (a) => {
        a || l();
      }
    }), o = p(
      () => {
        var a;
        return ((a = t.value) == null ? void 0 : a.type) === "permission_denied" && t.value.message || q;
      }
    );
    function l() {
      r.info("Permission denied toast closed"), i();
    }
    return (a, s) => {
      const h = u("v-icon"), E = u("v-btn"), A = u("v-snackbar");
      return M(), N(A, {
        modelValue: n.value,
        "onUpdate:modelValue": s[0] || (s[0] = (_) => n.value = _),
        timeout: xe,
        color: "warning",
        location: "top",
        "data-testid": "permission-denied-toast",
        role: "status",
        "aria-live": "polite"
      }, {
        actions: d(() => [
          g(E, {
            variant: "text",
            "data-testid": "permission-denied-close-button",
            "aria-label": "Dismiss notification",
            onClick: l
          }, {
            default: d(() => [...s[2] || (s[2] = [
              v(" Close ", -1)
            ])]),
            _: 1
          })
        ]),
        default: d(() => [
          C("div", Ae, [
            g(h, { class: "mr-2" }, {
              default: d(() => [...s[1] || (s[1] = [
                v("mdi-shield-alert", -1)
              ])]),
              _: 1
            }),
            C("span", null, B(o.value), 1)
          ])
        ]),
        _: 1
      }, 8, ["modelValue"]);
    };
  }
}), Ee = { class: "text-body-1 mb-4" }, ke = ["aria-label"], L = 30, W = "We're having trouble connecting to authentication services.", Me = /* @__PURE__ */ D({
  name: "ServiceUnavailableOverlay",
  __name: "ServiceUnavailableOverlay",
  setup(e) {
    const r = m("ServiceUnavailableOverlay"), { error: t } = G(), i = j(), n = F(L), o = F(L), l = F(!1);
    let a = null;
    const s = p(() => {
      var c;
      return ((c = t.value) == null ? void 0 : c.type) === "service_unavailable";
    }), h = p(
      () => {
        var c;
        return ((c = t.value) == null ? void 0 : c.type) === "service_unavailable" && t.value.message || W;
      }
    ), E = p(() => o.value === 0 ? 0 : Math.floor((o.value - n.value) / o.value * 100));
    function A(c) {
      _(), o.value = c, n.value = c, a = setInterval(() => {
        n.value > 0 && (n.value--, n.value === 0 && P());
      }, 1e3);
    }
    function _() {
      a && (clearInterval(a), a = null);
    }
    async function P() {
      var c;
      if (!l.value) {
        l.value = !0, _(), r.info("Attempting auth service retry");
        try {
          const f = await y.checkAuth();
          i.clearError(), r.info("Auth service retry successful", { isAuthenticated: f.isAuthenticated });
        } catch (f) {
          r.warn("Auth service retry failed, restarting countdown", f);
          const k = ((c = t.value) == null ? void 0 : c.retryAfter) ?? L;
          A(k);
        } finally {
          l.value = !1;
        }
      }
    }
    function R() {
      r.info("User initiated manual retry from service unavailable overlay"), P();
    }
    return oe(
      () => t.value,
      (c) => {
        if ((c == null ? void 0 : c.type) === "service_unavailable") {
          const f = c.retryAfter ?? L;
          r.info(`Auth service unavailable, starting countdown: ${f}s`), A(f);
        } else
          _();
      },
      { immediate: !0 }
    ), ae(() => {
      _();
    }), (c, f) => {
      const k = u("v-icon"), Q = u("v-card-title"), Z = u("v-progress-linear"), ee = u("v-card-text"), te = u("v-btn"), re = u("v-card-actions"), ne = u("v-card"), ie = u("v-overlay");
      return M(), N(ie, {
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
        default: d(() => [
          g(ne, {
            "max-width": "450",
            class: "pa-4",
            elevation: "24"
          }, {
            default: d(() => [
              g(Q, {
                id: "service-unavailable-title",
                class: "text-h5 d-flex align-center justify-center"
              }, {
                default: d(() => [
                  g(k, {
                    color: "error",
                    size: "32",
                    class: "mr-2"
                  }, {
                    default: d(() => [...f[0] || (f[0] = [
                      v("mdi-cloud-off-outline", -1)
                    ])]),
                    _: 1
                  }),
                  f[1] || (f[1] = v(" Service Issue ", -1))
                ]),
                _: 1
              }),
              g(ee, {
                id: "service-unavailable-message",
                class: "text-center"
              }, {
                default: d(() => [
                  C("p", Ee, B(h.value), 1),
                  f[2] || (f[2] = C("p", { class: "text-body-2 text-medium-emphasis mb-4" }, "Retrying automatically...", -1)),
                  g(Z, {
                    "model-value": E.value,
                    color: "primary",
                    height: "8",
                    rounded: "",
                    class: "mb-2",
                    "data-testid": "countdown-progress-bar"
                  }, null, 8, ["model-value"]),
                  C("p", {
                    class: "text-body-2 text-medium-emphasis",
                    "data-testid": "countdown-text",
                    "aria-label": `Retry in ${n.value} seconds`
                  }, " Retry in " + B(n.value) + "s ", 9, ke)
                ]),
                _: 1
              }),
              g(re, { class: "justify-center" }, {
                default: d(() => [
                  g(te, {
                    color: "primary",
                    variant: "elevated",
                    "prepend-icon": "mdi-refresh",
                    loading: l.value,
                    disabled: l.value,
                    "data-testid": "try-now-button",
                    "aria-label": "Try connecting now",
                    onClick: R
                  }, {
                    default: d(() => [...f[3] || (f[3] = [
                      v(" Try Now ", -1)
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
      }, 8, ["model-value"]);
    };
  }
});
export {
  w as AuthConfigurationError,
  he as AuthService,
  H as BFF_AUTH_CONFIG_KEY,
  De as PermissionDeniedToast,
  Me as ServiceUnavailableOverlay,
  Re as SessionExpiredModal,
  y as authService,
  Le as bffAuthPlugin,
  we as createAuthGuard,
  ve as decodeJwt,
  me as extractEmailFromJwt,
  O as getGlobalConfig,
  $ as isAuthConfigured,
  ge as mapErrorType,
  X as parseAuthError,
  ue as setGlobalConfig,
  Be as setupAuthGuard,
  $e as setupAuthInterceptors,
  G as useAuth,
  Pe as useAuthConfig,
  Fe as useAuthService,
  j as useAuthStore
};
