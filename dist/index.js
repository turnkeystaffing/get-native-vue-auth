import { createLogger as v } from "@turnkeystaffing/get-native-vue-logger";
import { inject as oe, computed as f, defineComponent as B, ref as R, openBlock as V, createBlock as O, unref as d, withCtx as h, createVNode as g, createTextVNode as p, toDisplayString as $, createElementVNode as I, watch as ae, onUnmounted as le } from "vue";
import { defineStore as ue } from "pinia";
import w from "axios";
import { jwtDecode as X } from "jwt-decode";
import { VDialog as ce, VCard as Q, VCardTitle as Z, VIcon as M, VCardText as ee, VCardActions as te, VSpacer as de, VBtn as N, VSnackbar as fe, VOverlay as he, VProgressLinear as ge } from "vuetify/components";
const re = Symbol("bff-auth-config");
let ne = null;
function me(e) {
  ne = e;
}
function G() {
  return ne;
}
function De() {
  const e = oe(re);
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
function ve(e) {
  const r = e.logger ?? v("BffAuth");
  return {
    bffBaseUrl: e.bffBaseUrl,
    clientId: e.clientId,
    logger: r
  };
}
const Be = {
  install(e, r) {
    pe(r);
    const t = ve(r);
    e.provide(re, t), me(t), t.logger.debug("BFF Auth plugin installed", {
      bffBaseUrl: t.bffBaseUrl,
      clientId: t.clientId
    });
  }
}, b = v("AuthService");
class A extends Error {
  constructor(r) {
    super(r), this.name = "AuthConfigurationError";
  }
}
function k() {
  var e;
  return ((e = G()) == null ? void 0 : e.bffBaseUrl) || "";
}
function z() {
  var e;
  return ((e = G()) == null ? void 0 : e.clientId) || "";
}
function F() {
  const e = G();
  return !!(e != null && e.bffBaseUrl && (e != null && e.clientId));
}
function ye(e) {
  return {
    authentication_error: "session_expired",
    authorization_error: "permission_denied",
    auth_service_unavailable: "service_unavailable"
  }[e];
}
function ie(e) {
  var i, n;
  if (!((n = (i = e.response) == null ? void 0 : i.data) != null && n.error_type))
    return null;
  const r = e.response.data, t = {
    type: ye(r.error_type),
    message: r.detail
  };
  return r.retry_after !== void 0 && (t.retryAfter = r.retry_after), t;
}
class we {
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
        `${k()}/api/v1/oauth/login`,
        { email: r, password: t },
        { withCredentials: !0 }
        // Include cookies for session handling
      ), b.info("Credentials submitted successfully");
    } catch (i) {
      throw b.error("Failed to submit credentials", i), i;
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
    if (!F())
      throw new A(
        "Authentication service is not configured. Please contact your administrator."
      );
    try {
      return {
        isAuthenticated: !0,
        user: (await w.get(`${k()}/bff/userinfo`, {
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
   * Start login flow by redirecting to BFF login endpoint.
   * For use by Product SPAs to redirect users to Central Login.
   *
   * Security: Enforces same-origin redirects to prevent open redirect attacks.
   *
   * @param options - Login options with optional returnUrl (defaults to current URL)
   */
  login(r) {
    const t = r || {};
    if (!F())
      throw b.error("Cannot initiate login: Auth configuration is incomplete"), new A(
        "Authentication service is not configured. Please contact your administrator."
      );
    const i = t.returnUrl || window.location.href;
    let n;
    try {
      n = new URL(i, window.location.origin);
    } catch {
      b.warn("Malformed returnUrl, falling back to current page:", i), n = new URL(window.location.href);
    }
    n.origin !== window.location.origin && (b.warn("Blocked external redirect attempt:", i), n = new URL("/", window.location.origin));
    const s = n.href, l = `${k()}/bff/login`, a = new URLSearchParams({
      client_id: z(),
      redirect_url: s
    });
    b.debug("Initiating login redirect", { returnUrl: s }), window.location.href = `${l}?${a.toString()}`;
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
    const n = `${k()}/bff/login`, s = new URLSearchParams({
      client_id: t,
      redirect_url: i
    });
    b.debug("Completing OAuth flow", { clientId: t, returnUrl: i }), window.location.href = `${n}?${s.toString()}`;
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
    if (!F())
      throw new A(
        "Authentication service is not configured. Please contact your administrator."
      );
    try {
      const t = await w.post(
        `${k()}/bff/token`,
        { client_id: z() },
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
        `${k()}/bff/logout`,
        {},
        {
          withCredentials: !0
        }
      ), { success: !0 };
    } catch (r) {
      if (w.isAxiosError(r)) {
        const t = ie(r);
        if (t)
          throw t;
      }
      throw r;
    }
  }
}
const y = new we();
function Ve() {
  return y;
}
const T = v("JwtUtils");
function be(e) {
  if (!e)
    return null;
  try {
    return X(e);
  } catch (r) {
    return T.warn("Failed to decode JWT token:", r), null;
  }
}
function Oe(e) {
  const r = be(e);
  return !(r != null && r.email) || typeof r.email != "string" ? null : r.email;
}
function Ae(e) {
  if (!e)
    return null;
  try {
    const r = X(e);
    return !r.email || typeof r.email != "string" ? (T.warn("Decoded token missing required email field"), null) : !r.user_id || typeof r.user_id != "string" ? (T.warn("Decoded token missing required user_id field"), null) : Array.isArray(r.roles) ? r : (T.warn("Decoded token missing required roles field"), null);
  } catch (r) {
    return T.warn("Failed to decode access token:", r), null;
  }
}
const Y = 5, x = v("AuthStore");
let E = null;
const j = ue("auth", {
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
    decodedToken: (e) => Ae(e.accessToken),
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
        const e = await y.checkAuth();
        this.isAuthenticated = e.isAuthenticated, this.user = e.user, e.isAuthenticated && await this.ensureValidToken();
      } catch (e) {
        x.error("Failed to initialize auth:", e), this.isAuthenticated = !1, this.user = null, e instanceof A && this.setError({
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
        }), null) : ((typeof e.expiresIn != "number" || !Number.isFinite(e.expiresIn) || e.expiresIn < Y) && (x.error(`Invalid expiresIn value: ${e.expiresIn}, using minimum`), e.expiresIn = Y), this.accessToken = e.accessToken, this.tokenExpiresAt = Date.now() + e.expiresIn * 1e3, e) : (this.setError({
          type: "session_expired",
          message: "Your session has expired. Please sign in again."
        }), null);
      } catch (e) {
        return x.error("Token refresh failed:", e), e instanceof A ? (this.setError({
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
      this.isLoading = !0, this.error = null, y.login(e ? { returnUrl: e } : void 0);
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
      this.$reset(), y.login();
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
function q() {
  const e = j(), r = f(() => e.isAuthenticated), t = f(() => e.isLoading), i = f(() => e.user), n = f(() => e.error), s = f(() => e.userEmail), l = f(() => e.decodedToken), a = f(() => e.userRoles), o = f(() => e.userId), m = f(() => e.userGuid), L = f(() => e.username), U = f(() => e.sessionId);
  function _(c) {
    return e.hasRole(c);
  }
  function C(c) {
    e.login(c);
  }
  async function D() {
    await e.logout();
  }
  function u() {
    e.clearError();
  }
  return {
    // Reactive state
    isAuthenticated: r,
    isLoading: t,
    user: i,
    userEmail: s,
    error: n,
    // Decoded token getters
    decodedToken: l,
    userRoles: a,
    userId: o,
    userGuid: m,
    username: L,
    sessionId: U,
    // Actions
    login: C,
    logout: D,
    clearError: u,
    hasRole: _
  };
}
const J = v("AuthInterceptors");
function Me(e, r) {
  e.interceptors.request.use(
    async (t) => {
      const i = r();
      if (!i.isAuthenticated)
        return t;
      try {
        const n = await i.ensureValidToken();
        n && (t.headers.Authorization = `Bearer ${n}`);
      } catch (n) {
        if (n instanceof A)
          return i.setError({
            type: "service_unavailable",
            message: n.message
          }), Promise.reject(n);
        J.error("Failed to get auth token:", n instanceof Error ? n.message : "Unknown error");
      }
      return t;
    },
    (t) => Promise.reject(t)
  ), e.interceptors.response.use(
    (t) => t,
    async (t) => {
      var l, a, o;
      const i = r(), n = (l = t.response) == null ? void 0 : l.status, s = ie(t);
      if (n === 401 && !F())
        J.warn("401 received but auth is not configured, ignoring");
      else if (s)
        i.setError(s);
      else if (n === 401)
        i.setError({
          type: "session_expired",
          message: "Your session has expired. Please sign in again."
        });
      else if (n === 403) {
        const m = (o = (a = t.response) == null ? void 0 : a.data) == null ? void 0 : o.detail;
        i.setError({
          type: "permission_denied",
          message: typeof m == "string" ? m : "Permission denied"
        });
      }
      return Promise.reject(t);
    }
  );
}
const S = v("AuthGuard");
function _e(e) {
  return e.meta.public === !0;
}
async function ke(e) {
  if (!e.isLoading)
    return !0;
  let r = 0;
  const t = 200;
  for (; e.isLoading && r < t; )
    await new Promise((i) => setTimeout(i, 50)), r++;
  return e.isLoading ? (S.warn("Auth initialization timed out after 10 seconds"), !1) : !0;
}
const xe = {
  getAuthStore: () => j(),
  getAuthService: () => y
};
function Ee(e = xe) {
  let r = !1;
  return async (t) => {
    const i = e.getAuthStore(), n = e.getAuthService();
    try {
      if (!r) {
        r = !0;
        try {
          await i.initAuth();
        } catch (l) {
          S.error("Failed to initialize auth:", l);
        }
      }
      return _e(t) ? !0 : await ke(i) ? i.isAuthenticated ? !0 : (n.login({ returnUrl: t.fullPath }), !1) : (S.warn("Auth not ready, redirecting to login"), n.login({ returnUrl: t.fullPath }), !1);
    } catch (s) {
      return s instanceof A ? (S.error("Auth configuration error:", s.message), i.setError({
        type: "service_unavailable",
        message: s.message
      }), !0) : (S.error("Unexpected error in auth guard:", s), n.login({ returnUrl: t.fullPath }), !1);
    }
  };
}
function Ne(e) {
  e.beforeEach(Ee());
}
const W = "Your session has ended. Sign in again to continue.", Ge = /* @__PURE__ */ B({
  name: "SessionExpiredModal",
  __name: "SessionExpiredModal",
  setup(e) {
    const r = v("SessionExpiredModal"), { error: t, login: i } = q(), n = R(!1), s = f(() => {
      var o;
      return ((o = t.value) == null ? void 0 : o.type) === "session_expired";
    }), l = f(
      () => {
        var o;
        return ((o = t.value) == null ? void 0 : o.type) === "session_expired" && t.value.message || W;
      }
    );
    function a() {
      if (!n.value) {
        n.value = !0, r.info("User initiated re-authentication from session expired modal");
        try {
          const o = window.location.href;
          i(o);
        } catch (o) {
          n.value = !1, r.error("Failed to initiate login redirect", o);
        }
      }
    }
    return (o, m) => (V(), O(d(ce), {
      "model-value": s.value,
      persistent: "",
      "max-width": "400",
      "data-testid": "session-expired-modal",
      "aria-labelledby": "session-expired-title",
      "aria-describedby": "session-expired-message"
    }, {
      default: h(() => [
        g(d(Q), null, {
          default: h(() => [
            g(d(Z), {
              id: "session-expired-title",
              class: "text-h5 d-flex align-center"
            }, {
              default: h(() => [
                g(d(M), {
                  color: "warning",
                  class: "mr-2"
                }, {
                  default: h(() => [...m[0] || (m[0] = [
                    p("mdi-clock-alert-outline", -1)
                  ])]),
                  _: 1
                }),
                m[1] || (m[1] = p(" Session Expired ", -1))
              ]),
              _: 1
            }),
            g(d(ee), { id: "session-expired-message" }, {
              default: h(() => [
                p($(l.value), 1)
              ]),
              _: 1
            }),
            g(d(te), null, {
              default: h(() => [
                g(d(de)),
                g(d(N), {
                  color: "primary",
                  variant: "elevated",
                  "prepend-icon": "mdi-login",
                  loading: n.value,
                  disabled: n.value,
                  "data-testid": "session-expired-sign-in-button",
                  "aria-label": "Sign in to continue",
                  onClick: a
                }, {
                  default: h(() => [...m[2] || (m[2] = [
                    p(" Sign In ", -1)
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
}), Te = { class: "d-flex align-center" }, Se = 5e3, H = "You do not have permission to perform this action.", je = /* @__PURE__ */ B({
  name: "PermissionDeniedToast",
  __name: "PermissionDeniedToast",
  setup(e) {
    const r = v("PermissionDeniedToast"), { error: t, clearError: i } = q(), n = f({
      get: () => {
        var a;
        return ((a = t.value) == null ? void 0 : a.type) === "permission_denied";
      },
      set: (a) => {
        a || l();
      }
    }), s = f(
      () => {
        var a;
        return ((a = t.value) == null ? void 0 : a.type) === "permission_denied" && t.value.message || H;
      }
    );
    function l() {
      r.info("Permission denied toast closed"), i();
    }
    return (a, o) => (V(), O(d(fe), {
      modelValue: n.value,
      "onUpdate:modelValue": o[0] || (o[0] = (m) => n.value = m),
      timeout: Se,
      color: "warning",
      location: "top",
      "data-testid": "permission-denied-toast",
      role: "status",
      "aria-live": "polite"
    }, {
      actions: h(() => [
        g(d(N), {
          variant: "text",
          "data-testid": "permission-denied-close-button",
          "aria-label": "Dismiss notification",
          onClick: l
        }, {
          default: h(() => [...o[2] || (o[2] = [
            p(" Close ", -1)
          ])]),
          _: 1
        })
      ]),
      default: h(() => [
        I("div", Te, [
          g(d(M), { class: "mr-2" }, {
            default: h(() => [...o[1] || (o[1] = [
              p("mdi-shield-alert", -1)
            ])]),
            _: 1
          }),
          I("span", null, $(s.value), 1)
        ])
      ]),
      _: 1
    }, 8, ["modelValue"]));
  }
}), Ie = { class: "text-body-1 mb-4" }, Ue = ["aria-label"], P = 30, K = "We're having trouble connecting to authentication services.", qe = /* @__PURE__ */ B({
  name: "ServiceUnavailableOverlay",
  __name: "ServiceUnavailableOverlay",
  setup(e) {
    const r = v("ServiceUnavailableOverlay"), { error: t } = q(), i = j(), n = R(P), s = R(P), l = R(!1);
    let a = null;
    const o = f(() => {
      var u;
      return ((u = t.value) == null ? void 0 : u.type) === "service_unavailable";
    }), m = f(
      () => {
        var u;
        return ((u = t.value) == null ? void 0 : u.type) === "service_unavailable" && t.value.message || K;
      }
    ), L = f(() => s.value === 0 ? 0 : Math.floor((s.value - n.value) / s.value * 100));
    function U(u) {
      _(), s.value = u, n.value = u, a = setInterval(() => {
        n.value > 0 && (n.value--, n.value === 0 && C());
      }, 1e3);
    }
    function _() {
      a && (clearInterval(a), a = null);
    }
    async function C() {
      var u;
      if (!l.value) {
        l.value = !0, _(), r.info("Attempting auth service retry");
        try {
          const c = await y.checkAuth();
          i.clearError(), r.info("Auth service retry successful", { isAuthenticated: c.isAuthenticated });
        } catch (c) {
          r.warn("Auth service retry failed, restarting countdown", c);
          const se = ((u = t.value) == null ? void 0 : u.retryAfter) ?? P;
          U(se);
        } finally {
          l.value = !1;
        }
      }
    }
    function D() {
      r.info("User initiated manual retry from service unavailable overlay"), C();
    }
    return ae(
      () => t.value,
      (u) => {
        if ((u == null ? void 0 : u.type) === "service_unavailable") {
          const c = u.retryAfter ?? P;
          r.info(`Auth service unavailable, starting countdown: ${c}s`), U(c);
        } else
          _();
      },
      { immediate: !0 }
    ), le(() => {
      _();
    }), (u, c) => (V(), O(d(he), {
      "model-value": o.value,
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
      default: h(() => [
        g(d(Q), {
          "max-width": "450",
          class: "pa-4",
          elevation: "24"
        }, {
          default: h(() => [
            g(d(Z), {
              id: "service-unavailable-title",
              class: "text-h5 d-flex align-center justify-center"
            }, {
              default: h(() => [
                g(d(M), {
                  color: "error",
                  size: "32",
                  class: "mr-2"
                }, {
                  default: h(() => [...c[0] || (c[0] = [
                    p("mdi-cloud-off-outline", -1)
                  ])]),
                  _: 1
                }),
                c[1] || (c[1] = p(" Service Issue ", -1))
              ]),
              _: 1
            }),
            g(d(ee), {
              id: "service-unavailable-message",
              class: "text-center"
            }, {
              default: h(() => [
                I("p", Ie, $(m.value), 1),
                c[2] || (c[2] = I("p", { class: "text-body-2 text-medium-emphasis mb-4" }, "Retrying automatically...", -1)),
                g(d(ge), {
                  "model-value": L.value,
                  color: "primary",
                  height: "8",
                  rounded: "",
                  class: "mb-2",
                  "data-testid": "countdown-progress-bar"
                }, null, 8, ["model-value"]),
                I("p", {
                  class: "text-body-2 text-medium-emphasis",
                  "data-testid": "countdown-text",
                  "aria-label": `Retry in ${n.value} seconds`
                }, " Retry in " + $(n.value) + "s ", 9, Ue)
              ]),
              _: 1
            }),
            g(d(te), { class: "justify-center" }, {
              default: h(() => [
                g(d(N), {
                  color: "primary",
                  variant: "elevated",
                  "prepend-icon": "mdi-refresh",
                  loading: l.value,
                  disabled: l.value,
                  "data-testid": "try-now-button",
                  "aria-label": "Try connecting now",
                  onClick: D
                }, {
                  default: h(() => [...c[3] || (c[3] = [
                    p(" Try Now ", -1)
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
  A as AuthConfigurationError,
  we as AuthService,
  re as BFF_AUTH_CONFIG_KEY,
  je as PermissionDeniedToast,
  qe as ServiceUnavailableOverlay,
  Ge as SessionExpiredModal,
  y as authService,
  Be as bffAuthPlugin,
  Ee as createAuthGuard,
  Ae as decodeAccessToken,
  be as decodeJwt,
  Oe as extractEmailFromJwt,
  G as getGlobalConfig,
  F as isAuthConfigured,
  ye as mapErrorType,
  ie as parseAuthError,
  me as setGlobalConfig,
  Ne as setupAuthGuard,
  Me as setupAuthInterceptors,
  q as useAuth,
  De as useAuthConfig,
  Ve as useAuthService,
  j as useAuthStore
};
