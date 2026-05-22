import { createLogger as G } from "@turnkeystaffing/get-native-vue-logger";
import { inject as Ce, computed as i, defineComponent as k, ref as w, openBlock as c, createElementBlock as _, createElementVNode as s, createBlock as C, resolveDynamicComponent as L, createCommentVNode as A, toDisplayString as m, onBeforeUnmount as te, normalizeStyle as ge, Fragment as ce, createTextVNode as ue, normalizeClass as de, watch as fe, Teleport as Te, mergeProps as Le, nextTick as Se } from "vue";
import U from "axios";
import { defineStore as Ie } from "pinia";
import { jwtDecode as me } from "jwt-decode";
const ye = /* @__PURE__ */ Symbol("bff-auth-config");
let be = null;
function $e(t) {
  be = t;
}
function F() {
  return be;
}
function on() {
  const t = Ce(ye);
  if (!t)
    throw new Error(
      "BFF Auth config not found. Did you forget to install the plugin with app.use(bffAuthPlugin, options)?"
    );
  return t;
}
const we = Object.freeze({
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
  unknown_host: "server_error",
  // ── permission_denied — per-request authz denial (cross-user / missing role)
  forbidden: "permission_denied"
}), Ee = /* @__PURE__ */ new Set([
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
function Ue(t, r) {
  if (!t) return null;
  const e = t.toLowerCase();
  return r && Object.prototype.hasOwnProperty.call(r, e) ? r[e] ?? null : Ee.has(e) ? null : we[e] ?? null;
}
function Fe(t) {
  return t === 401 ? "session_expired" : t === 429 ? "service_unavailable" : null;
}
const T = G("AuthService");
class O extends Error {
  constructor(r) {
    super(r), this.name = "AuthConfigurationError";
  }
}
function D() {
  return F()?.bffBaseUrl || "";
}
function _e() {
  return F()?.clientId || "";
}
function K() {
  const t = F();
  return !!(t?.bffBaseUrl && t?.clientId);
}
function re(t, r) {
  const e = t.response;
  if (!e) return null;
  const n = e.data ?? {}, o = n.error, l = typeof o == "string" && o.length > 0 ? o.toLowerCase() : null;
  if (!l) return null;
  const u = Ue(l, r);
  if (u === null) return null;
  const d = n.error_description || o || "";
  return { type: u, message: d, code: l };
}
class De {
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
  async submitCredentials(r, e, n) {
    try {
      const o = { email: r, password: e };
      n !== void 0 && (o.totp_code = n), await U.post(
        `${D()}/api/v1/oauth/login`,
        o,
        { withCredentials: !0 }
        // Include cookies for session handling
      ), T.info("Credentials submitted successfully");
    } catch (o) {
      throw T.error("Failed to submit credentials", o), o;
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
    if (!K())
      throw new O(
        "Authentication service is not configured. Please contact your administrator."
      );
    try {
      return {
        isAuthenticated: !0,
        user: (await U.get(`${D()}/bff/userinfo`, {
          withCredentials: !0
          // Include bff_session cookie
        })).data
      };
    } catch (r) {
      if (U.isAxiosError(r) && r.response?.status === 401)
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
    const e = r || {};
    if (!K())
      throw T.error("Cannot initiate login: Auth configuration is incomplete"), new O(
        "Authentication service is not configured. Please contact your administrator."
      );
    const n = e.returnUrl || window.location.href;
    let o;
    try {
      o = new URL(n, window.location.origin);
    } catch {
      T.warn("Malformed returnUrl, falling back to current page:", n), o = new URL(window.location.href);
    }
    o.origin !== window.location.origin && (T.warn("Blocked external redirect attempt:", n), o = new URL("/", window.location.origin));
    const l = o.href, u = `${D()}/bff/login`, d = new URLSearchParams({
      client_id: _e(),
      redirect_url: l
    });
    T.debug("Initiating login redirect", { returnUrl: l }), window.location.href = `${u}?${d.toString()}`;
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
    const { clientId: e, returnUrl: n } = r, o = e.trim();
    if (!o)
      throw new Error("clientId must not be empty");
    let l;
    try {
      l = new URL(n);
    } catch {
      throw new Error("returnUrl is not a valid URL");
    }
    if (l.protocol !== "http:" && l.protocol !== "https:")
      throw new Error("returnUrl must use http or https scheme");
    const u = D();
    if (!u)
      throw new O("BFF base URL is not configured.");
    const d = `${u}/bff/login`, h = new URLSearchParams({
      client_id: o,
      redirect_url: n
    });
    T.debug("Initiating custom client login redirect", { clientId: o, returnUrl: n }), window.location.href = `${d}?${h.toString()}`;
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
    const { clientId: e, returnUrl: n } = r;
    if (!e || !n)
      throw new Error("completeOAuthFlow requires both clientId and returnUrl");
    const o = `${D()}/bff/login`, l = new URLSearchParams({
      client_id: e,
      redirect_url: n
    });
    T.debug("Completing OAuth flow", { clientId: e, returnUrl: n }), window.location.href = `${o}?${l.toString()}`;
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
    if (F()?.mode === "cookie")
      throw new O(
        "getAccessToken() is not available in cookie mode. Token management is handled by the BFF proxy via cookies."
      );
    if (!K())
      throw new O(
        "Authentication service is not configured. Please contact your administrator."
      );
    try {
      const r = await U.post(
        `${D()}/bff/token`,
        { client_id: _e() },
        { withCredentials: !0 }
      );
      return {
        accessToken: r.data.access_token,
        tokenType: r.data.token_type,
        expiresIn: r.data.expires_in,
        scope: r.data.scope
      };
    } catch (r) {
      if (U.isAxiosError(r) && r.response?.status === 401)
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
      return await U.post(
        `${D()}/bff/logout`,
        {},
        {
          withCredentials: !0
        }
      ), { success: !0 };
    } catch (r) {
      if (U.isAxiosError(r)) {
        const e = re(r);
        if (e)
          throw e;
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
      const e = await U.post(
        `${D()}/api/v1/auth/2fa/setup`,
        { token: r },
        { withCredentials: !0 }
      );
      return T.info("2FA setup initiated successfully"), e.data;
    } catch (e) {
      throw T.error("Failed to initiate 2FA setup", e), e;
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
  async verify2FASetup(r, e) {
    try {
      const n = await U.post(
        `${D()}/api/v1/auth/2fa/verify-setup`,
        { token: r, totp_code: e },
        { withCredentials: !0 }
      );
      return T.info("2FA setup verified successfully"), n.data;
    } catch (n) {
      throw T.error("Failed to verify 2FA setup", n), n;
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
  async resend2FASetupEmail(r, e) {
    try {
      const n = await U.post(
        `${D()}/api/v1/auth/2fa/resend-setup-email`,
        { email: r, password: e },
        { withCredentials: !0 }
      );
      return T.info("2FA setup email resent successfully"), n.data;
    } catch (n) {
      throw T.error("Failed to resend 2FA setup email", n), n;
    }
  }
}
const N = new De();
function sn() {
  return N;
}
const W = G("JwtUtils");
function Oe(t) {
  if (!t)
    return null;
  try {
    return me(t);
  } catch (r) {
    return W.warn("Failed to decode JWT token:", r), null;
  }
}
function an(t) {
  const r = Oe(t);
  return !r?.email || typeof r.email != "string" ? null : r.email;
}
function Be(t) {
  if (!t)
    return null;
  try {
    const r = me(t);
    return !r.email || typeof r.email != "string" ? (W.warn("Decoded token missing required email field"), null) : !r.user_id || typeof r.user_id != "string" ? (W.warn("Decoded token missing required user_id field"), null) : Array.isArray(r.roles) ? r : (W.warn("Decoded token missing required roles field"), null);
  } catch (r) {
    return W.warn("Failed to decode access token:", r), null;
  }
}
const ne = "gn-auth-login-circuit-breaker", oe = 3, ie = 120 * 1e3, Pe = 2, ee = "login_loop_detected";
function Q() {
  try {
    const t = sessionStorage.getItem(ne);
    if (!t) return null;
    const r = JSON.parse(t);
    if (typeof r == "object" && r !== null && typeof r.count == "number" && Number.isFinite(r.count) && typeof r.firstAttemptAt == "number" && Number.isFinite(r.firstAttemptAt)) {
      const e = typeof r.trips == "number" && Number.isFinite(r.trips) ? r.trips : 0;
      return { count: r.count, firstAttemptAt: r.firstAttemptAt, trips: e };
    }
    return null;
  } catch {
    return null;
  }
}
function Me(t) {
  sessionStorage.setItem(ne, JSON.stringify(t));
}
function se(t, r, e = Date.now()) {
  return e - t.firstAttemptAt <= r;
}
function Ae(t = oe, r = ie) {
  try {
    const e = Date.now(), n = Q(), o = n !== null && se(n, r, e), l = n?.trips ?? 0, u = o ? { count: n.count + 1, firstAttemptAt: n.firstAttemptAt, trips: l } : { count: 1, firstAttemptAt: e, trips: l };
    return u.count === t + 1 && (u.trips = l + 1), Me(u), u.count <= t;
  } catch {
    return !0;
  }
}
function X() {
  try {
    sessionStorage.removeItem(ne);
  } catch {
  }
}
function ln(t = oe, r = ie) {
  try {
    const e = Q();
    return !e || !se(e, r) ? !1 : e.count >= t;
  } catch {
    return !1;
  }
}
function Re(t = oe, r = ie) {
  try {
    const e = Q();
    return !e || !se(e, r) || e.count < t ? null : e.firstAttemptAt + r;
  } catch {
    return null;
  }
}
function Ve() {
  try {
    return Q()?.trips ?? 0;
  } catch {
    return 0;
  }
}
function ke(t = Pe) {
  return Ve() >= t;
}
const ve = 5, H = G("AuthStore");
let q = null;
const ae = Ie("auth", {
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
    currentUser: (t) => t.user,
    /**
     * Check if there's an active error
     */
    hasError: (t) => t.error !== null,
    /**
     * Decoded JWT access token with all claims.
     * Returns null if token is not available or invalid.
     */
    decodedToken: (t) => Be(t.accessToken),
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
    hasRole(t) {
      return this.userRoles.includes(t);
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
      const t = 60 * 1e3;
      return Date.now() >= this.tokenExpiresAt - t;
    },
    /**
     * Initialize auth state on app startup
     * Call this in App.vue or main.ts
     */
    async initAuth() {
      this.isLoading = !0, this.error = null;
      try {
        const t = await N.checkAuth();
        this.isAuthenticated = t.isAuthenticated, this.user = t.user, t.isAuthenticated && X(), t.isAuthenticated && F()?.mode !== "cookie" && await this.ensureValidToken();
      } catch (t) {
        if (H.error("Failed to initialize auth:", t), this.isAuthenticated = !1, this.user = null, t instanceof O)
          this.setError({
            type: "service_unavailable",
            message: t.message
          });
        else if (U.isAxiosError(t)) {
          const r = re(t, F()?.errorCodeOverrides);
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
      if (F()?.mode === "cookie")
        return null;
      if (this.accessToken && !this.checkTokenNeedsRefresh())
        return this.accessToken;
      if (q)
        return (await q)?.accessToken ?? null;
      q = this._refreshToken();
      try {
        return (await q)?.accessToken ?? null;
      } finally {
        q = null;
      }
    },
    /**
     * Internal: Refresh the access token
     * @private
     */
    async _refreshToken() {
      try {
        const t = await N.getAccessToken();
        return t ? !t.accessToken || t.accessToken.trim() === "" ? (H.error("Invalid token response: empty accessToken"), this.setError({
          type: "session_expired",
          message: "Invalid token received. Please sign in again."
        }), null) : ((typeof t.expiresIn != "number" || !Number.isFinite(t.expiresIn) || t.expiresIn < ve) && (H.error(`Invalid expiresIn value: ${t.expiresIn}, using minimum`), t.expiresIn = ve), this.accessToken = t.accessToken, this.tokenExpiresAt = Date.now() + t.expiresIn * 1e3, t) : (this.setError({
          type: "session_expired",
          message: "Your session has expired. Please sign in again."
        }), null);
      } catch (t) {
        return H.error("Token refresh failed:", t), t instanceof O ? (this.setError({
          type: "service_unavailable",
          message: t.message
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
    login(t) {
      this.isLoading = !0, this.error = null, N.login(t ? { returnUrl: t } : void 0);
    },
    /**
     * Logout - revoke session and reset state
     */
    async logout() {
      try {
        await N.logout();
      } catch (t) {
        H.error("Logout failed:", t);
      }
      this.$reset(), N.login();
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
    setError(t) {
      this.error = t, (t.type === "session_expired" || t.type === "account_blocked") && (this.isAuthenticated = !1, this.user = null, this.accessToken = null, this.tokenExpiresAt = null);
    },
    /**
     * Clear current error
     */
    clearError() {
      this.error = null;
    }
  }
});
function Ne() {
  const t = ae(), r = i(() => t.isAuthenticated), e = i(() => t.isLoading), n = i(() => t.user), o = i(() => t.error), l = i(() => t.userEmail), u = i(() => t.decodedToken), d = i(() => t.userRoles), h = i(() => t.userId), v = i(() => t.userGuid), p = i(() => t.username), g = i(() => t.sessionId);
  function y(S) {
    return t.hasRole(S);
  }
  function x(S) {
    t.login(S);
  }
  async function b() {
    await t.logout();
  }
  function E() {
    t.clearError();
  }
  return {
    // Reactive state
    isAuthenticated: r,
    isLoading: e,
    user: n,
    userEmail: l,
    error: o,
    // Decoded token getters
    decodedToken: u,
    userRoles: d,
    userId: h,
    userGuid: v,
    username: p,
    sessionId: g,
    // Actions
    login: x,
    logout: b,
    clearError: E,
    hasRole: y
  };
}
const Ge = {
  class: "bff-auth-overlay",
  role: "alertdialog",
  "aria-modal": "true",
  "aria-labelledby": "bff-auth-session-expired-title",
  "aria-describedby": "bff-auth-session-expired-message",
  "aria-live": "assertive",
  "data-testid": "session-expired-view"
}, Ze = { class: "bff-auth-overlay__content" }, je = {
  key: 0,
  class: "bff-auth-overlay__icon",
  "aria-hidden": "true"
}, He = {
  id: "bff-auth-session-expired-title",
  class: "bff-auth-overlay__title"
}, qe = {
  id: "bff-auth-session-expired-message",
  class: "bff-auth-overlay__message"
}, We = { class: "bff-auth-overlay__actions" }, Ye = ["disabled", "aria-busy"], ze = {
  key: 0,
  class: "bff-auth-overlay__button-icon",
  "aria-hidden": "true"
}, Je = "Session expired", Ke = "Your session has ended. Sign in again to continue.", Xe = "Sign in", Qe = /* @__PURE__ */ k({
  name: "SessionExpiredView",
  __name: "SessionExpiredView",
  props: {
    error: {},
    onSignIn: { type: Function },
    config: {}
  },
  setup(t, { expose: r }) {
    const e = t, n = i(() => e.config.text.sessionExpired?.title ?? Je), o = i(
      () => e.config.text.sessionExpired?.message ?? e.error.message ?? Ke
    ), l = i(() => e.config.text.sessionExpired?.button ?? Xe), u = i(() => e.config.icons.sessionExpired), d = i(() => e.config.icons.login), h = w(!1), v = w(null);
    r({ primaryAction: v });
    async function p() {
      if (!h.value) {
        h.value = !0;
        try {
          await e.onSignIn();
        } finally {
          h.value = !1;
        }
      }
    }
    return (g, y) => (c(), _("div", Ge, [
      s("div", Ze, [
        u.value ? (c(), _("div", je, [
          (c(), C(L(u.value)))
        ])) : A("", !0),
        s("h1", He, m(n.value), 1),
        s("p", qe, m(o.value), 1),
        s("div", We, [
          s("button", {
            ref_key: "signInButton",
            ref: v,
            type: "button",
            class: "bff-auth-overlay__button bff-auth-overlay__button--primary",
            disabled: h.value,
            "aria-busy": h.value,
            "data-testid": "session-expired-sign-in-button",
            onClick: p
          }, [
            d.value ? (c(), _("span", ze, [
              (c(), C(L(d.value)))
            ])) : A("", !0),
            s("span", null, m(l.value), 1)
          ], 8, Ye)
        ])
      ])
    ]));
  }
}), et = {
  class: "bff-auth-overlay",
  role: "alertdialog",
  "aria-modal": "true",
  "aria-labelledby": "bff-auth-service-unavailable-title",
  "aria-describedby": "bff-auth-service-unavailable-message",
  "aria-live": "assertive",
  "data-testid": "service-unavailable-view"
}, tt = { class: "bff-auth-overlay__content" }, rt = {
  key: 0,
  class: "bff-auth-overlay__icon bff-auth-overlay__icon--danger",
  "aria-hidden": "true"
}, nt = {
  id: "bff-auth-service-unavailable-title",
  class: "bff-auth-overlay__title"
}, ot = {
  id: "bff-auth-service-unavailable-message",
  class: "bff-auth-overlay__message"
}, it = { class: "bff-auth-overlay__progress-wrapper" }, st = ["aria-valuenow"], at = {
  class: "bff-auth-overlay__countdown",
  "data-testid": "countdown-text"
}, lt = { class: "bff-auth-overlay__actions" }, ct = ["disabled", "aria-busy"], ut = "Service unavailable", dt = "We're having trouble connecting to authentication services.", ft = "Try now", _t = "Retrying...", z = 30, vt = /* @__PURE__ */ k({
  name: "ServiceUnavailableView",
  __name: "ServiceUnavailableView",
  props: {
    error: {},
    onRetry: { type: Function },
    config: {}
  },
  setup(t, { expose: r }) {
    const e = t, n = (P) => `Retry in ${P}s`, o = i(() => e.config.text.serviceUnavailable?.title ?? ut), l = i(
      () => e.config.text.serviceUnavailable?.message ?? e.error.message ?? dt
    ), u = i(
      () => e.config.text.serviceUnavailable?.button ?? ft
    ), d = i(
      () => e.config.text.serviceUnavailable?.retryingLabel ?? _t
    ), h = i(
      () => e.config.text.serviceUnavailable?.countdownLabel ?? n
    ), v = i(() => e.config.icons.serviceUnavailable), p = i(() => e.config.icons.retry), g = w(z), y = w(!1), x = w(null);
    let b = null, E = !1;
    r({ primaryAction: x });
    const S = i(
      () => Math.min(
        100,
        Math.max(0, Math.floor((z - g.value) / z * 100))
      )
    ), V = i(() => h.value(g.value));
    function B() {
      b && (clearInterval(b), b = null);
    }
    function $() {
      B(), g.value = z, b = setInterval(() => {
        g.value > 0 && (g.value--, g.value === 0 && (B(), I()));
      }, 1e3);
    }
    async function I() {
      if (!y.value) {
        y.value = !0, B();
        try {
          await e.onRetry();
        } finally {
          y.value = !1, E || $();
        }
      }
    }
    function Z() {
      I();
    }
    return $(), te(() => {
      E = !0, B();
    }), (P, a) => (c(), _("div", et, [
      s("div", tt, [
        v.value ? (c(), _("div", rt, [
          (c(), C(L(v.value)))
        ])) : A("", !0),
        s("h1", nt, m(o.value), 1),
        s("p", ot, m(l.value), 1),
        s("div", it, [
          s("div", {
            class: "bff-auth-overlay__progress",
            role: "progressbar",
            "aria-valuenow": S.value,
            "aria-valuemin": "0",
            "aria-valuemax": "100",
            "data-testid": "countdown-progress-bar"
          }, [
            s("div", {
              class: "bff-auth-overlay__progress-bar",
              style: ge({ width: S.value + "%" })
            }, null, 4)
          ], 8, st),
          s("p", at, [
            y.value ? (c(), _(ce, { key: 0 }, [
              ue(m(d.value), 1)
            ], 64)) : (c(), _(ce, { key: 1 }, [
              ue(m(V.value), 1)
            ], 64))
          ])
        ]),
        s("div", lt, [
          s("button", {
            ref_key: "tryNowButton",
            ref: x,
            type: "button",
            class: de(["bff-auth-overlay__button bff-auth-overlay__button--primary", { "bff-auth-overlay__button--loading": y.value }]),
            disabled: y.value,
            "aria-busy": y.value,
            "data-testid": "try-now-button",
            onClick: Z
          }, [
            p.value ? (c(), _("span", {
              key: 0,
              class: de(["bff-auth-overlay__button-icon", { "bff-auth-overlay__button-icon--spin": y.value }]),
              "aria-hidden": "true"
            }, [
              (c(), C(L(p.value)))
            ], 2)) : A("", !0),
            s("span", null, m(u.value), 1)
          ], 10, ct)
        ])
      ])
    ]));
  }
}), ht = {
  class: "bff-auth-overlay",
  role: "alertdialog",
  "aria-modal": "true",
  "aria-labelledby": "bff-auth-login-loop-title",
  "aria-describedby": "bff-auth-login-loop-message",
  "aria-live": "assertive",
  "data-testid": "login-loop-view"
}, pt = { class: "bff-auth-overlay__content" }, gt = {
  key: 0,
  class: "bff-auth-overlay__icon bff-auth-overlay__icon--danger",
  "aria-hidden": "true"
}, mt = {
  id: "bff-auth-login-loop-title",
  class: "bff-auth-overlay__title"
}, yt = {
  id: "bff-auth-login-loop-message",
  class: "bff-auth-overlay__message"
}, bt = {
  key: 1,
  class: "bff-auth-overlay__progress-wrapper"
}, wt = ["aria-valuenow"], Et = {
  class: "bff-auth-overlay__countdown",
  "data-testid": "login-loop-countdown-text"
}, At = { class: "bff-auth-overlay__actions" }, kt = ["disabled", "aria-busy"], xt = {
  key: 0,
  class: "bff-auth-overlay__button-icon",
  "aria-hidden": "true"
}, Ct = ["disabled", "aria-busy"], Tt = {
  key: 0,
  class: "bff-auth-overlay__button-icon",
  "aria-hidden": "true"
}, Lt = "Trouble signing in", St = "We couldn't complete sign-in after several attempts. Wait a moment and try again, or sign out to start fresh.", It = "Sign in", $t = "Sign out", Ut = /* @__PURE__ */ k({
  name: "LoginLoopView",
  __name: "LoginLoopView",
  props: {
    error: {},
    onSignIn: { type: Function },
    onSignOut: { type: Function },
    cooldownEndsAt: {},
    config: {}
  },
  setup(t, { expose: r }) {
    const e = t, n = (le) => `Try again in ${le}s`, o = i(() => e.config.text.loginLoop?.title ?? Lt), l = i(
      () => e.config.text.loginLoop?.message ?? e.error.message ?? St
    ), u = i(() => e.config.text.loginLoop?.signIn ?? It), d = i(() => e.config.text.loginLoop?.signOut ?? $t), h = i(
      () => e.config.text.loginLoop?.cooldownLabel ?? n
    ), v = i(() => e.config.icons.loginLoop), p = i(() => e.config.icons.login), g = i(() => e.config.icons.signOut), y = w(Date.now()), x = e.cooldownEndsAt !== null ? Math.max(0, e.cooldownEndsAt - y.value) : 0, b = i(
      () => e.cooldownEndsAt !== null ? Math.max(0, e.cooldownEndsAt - y.value) : 0
    ), E = i(() => Math.ceil(b.value / 1e3)), S = i(() => e.cooldownEndsAt === null || b.value <= 0), V = i(() => x <= 0 ? 100 : Math.min(
      100,
      Math.max(0, Math.floor((x - b.value) / x * 100))
    )), B = i(() => h.value(E.value)), $ = w(!1), I = w(!1), Z = w(null), P = w(null), a = i(
      () => S.value ? Z.value : P.value
    );
    r({ primaryAction: a });
    let f = null;
    function j() {
      f && (clearInterval(f), f = null);
    }
    function Y() {
      e.cooldownEndsAt === null || b.value <= 0 || (f = setInterval(() => {
        y.value = Date.now(), b.value <= 0 && j();
      }, 1e3));
    }
    async function M() {
      if (!(!S.value || $.value || I.value)) {
        $.value = !0;
        try {
          await e.onSignIn();
        } finally {
          $.value = !1;
        }
      }
    }
    async function xe() {
      if (!I.value) {
        I.value = !0;
        try {
          await e.onSignOut();
        } finally {
          I.value = !1;
        }
      }
    }
    return Y(), te(() => {
      j();
    }), (le, Xr) => (c(), _("div", ht, [
      s("div", pt, [
        v.value ? (c(), _("div", gt, [
          (c(), C(L(v.value)))
        ])) : A("", !0),
        s("h1", mt, m(o.value), 1),
        s("p", yt, m(l.value), 1),
        S.value ? A("", !0) : (c(), _("div", bt, [
          s("div", {
            class: "bff-auth-overlay__progress",
            role: "progressbar",
            "aria-valuenow": V.value,
            "aria-valuemin": "0",
            "aria-valuemax": "100",
            "data-testid": "login-loop-progress-bar"
          }, [
            s("div", {
              class: "bff-auth-overlay__progress-bar",
              style: ge({ width: V.value + "%" })
            }, null, 4)
          ], 8, wt),
          s("p", Et, m(B.value), 1)
        ])),
        s("div", At, [
          s("button", {
            ref_key: "signInButton",
            ref: Z,
            type: "button",
            class: "bff-auth-overlay__button bff-auth-overlay__button--primary",
            disabled: !S.value || $.value || I.value,
            "aria-busy": $.value,
            "data-testid": "login-loop-sign-in-button",
            onClick: M
          }, [
            p.value ? (c(), _("span", xt, [
              (c(), C(L(p.value)))
            ])) : A("", !0),
            s("span", null, m(u.value), 1)
          ], 8, kt),
          s("button", {
            ref_key: "signOutButton",
            ref: P,
            type: "button",
            class: "bff-auth-overlay__button bff-auth-overlay__button--secondary",
            disabled: I.value,
            "aria-busy": I.value,
            "data-testid": "login-loop-sign-out-button",
            onClick: xe
          }, [
            g.value ? (c(), _("span", Tt, [
              (c(), C(L(g.value)))
            ])) : A("", !0),
            s("span", null, m(d.value), 1)
          ], 8, Ct)
        ])
      ])
    ]));
  }
}), Ft = {
  class: "bff-auth-overlay",
  role: "alertdialog",
  "aria-modal": "true",
  "aria-labelledby": "bff-auth-dev-error-title",
  "aria-describedby": "bff-auth-dev-error-message",
  "aria-live": "assertive",
  "data-testid": "dev-error-view"
}, Dt = { class: "bff-auth-overlay__content" }, Ot = {
  key: 0,
  class: "bff-auth-overlay__icon bff-auth-overlay__icon--danger",
  "aria-hidden": "true"
}, Bt = {
  id: "bff-auth-dev-error-title",
  class: "bff-auth-overlay__title"
}, Pt = {
  id: "bff-auth-dev-error-message",
  class: "bff-auth-overlay__message"
}, Mt = {
  class: "bff-auth-overlay__message",
  "data-testid": "dev-error-contact-line"
}, Rt = {
  key: 1,
  class: "bff-auth-overlay__code",
  "data-testid": "dev-error-code"
}, Vt = { class: "bff-auth-overlay__actions" }, Nt = ["disabled", "aria-busy"], Gt = {
  key: 0,
  class: "bff-auth-overlay__button-icon",
  "aria-hidden": "true"
}, Zt = "Configuration error", jt = "The application is not correctly configured to connect to authentication services.", Ht = "Contact the application developer.", qt = "Sign out", Wt = /* @__PURE__ */ k({
  name: "DevErrorView",
  __name: "DevErrorView",
  props: {
    error: {},
    onSignOut: { type: Function },
    config: {}
  },
  setup(t, { expose: r }) {
    const e = t, n = i(() => e.config.text.devError?.title ?? Zt), o = i(
      () => e.config.text.devError?.message ?? e.error.message ?? jt
    ), l = i(
      () => e.config.text.devError?.contactLine ?? Ht
    ), u = i(
      () => e.config.text.devError?.signOut ?? qt
    ), d = i(() => e.config.icons.devError), h = i(() => e.config.icons.signOut), v = i(() => e.error.code ?? null), p = w(!1), g = w(null);
    r({ primaryAction: g });
    async function y() {
      if (!p.value) {
        p.value = !0;
        try {
          await e.onSignOut();
        } finally {
          p.value = !1;
        }
      }
    }
    return (x, b) => (c(), _("div", Ft, [
      s("div", Dt, [
        d.value ? (c(), _("div", Ot, [
          (c(), C(L(d.value)))
        ])) : A("", !0),
        s("h1", Bt, m(n.value), 1),
        s("p", Pt, m(o.value), 1),
        s("p", Mt, m(l.value), 1),
        v.value ? (c(), _("p", Rt, [
          b[0] || (b[0] = s("span", { class: "bff-auth-overlay__code-label" }, "Error code:", -1)),
          s("code", null, m(v.value), 1)
        ])) : A("", !0),
        s("div", Vt, [
          s("button", {
            ref_key: "signOutButton",
            ref: g,
            type: "button",
            class: "bff-auth-overlay__button bff-auth-overlay__button--primary",
            disabled: p.value,
            "aria-busy": p.value,
            "data-testid": "dev-error-sign-out-button",
            onClick: y
          }, [
            h.value ? (c(), _("span", Gt, [
              (c(), C(L(h.value)))
            ])) : A("", !0),
            s("span", null, m(u.value), 1)
          ], 8, Nt)
        ])
      ])
    ]));
  }
}), Yt = {
  class: "bff-auth-overlay",
  role: "alertdialog",
  "aria-modal": "true",
  "aria-labelledby": "bff-auth-account-blocked-title",
  "aria-describedby": "bff-auth-account-blocked-message",
  "aria-live": "assertive",
  "data-testid": "account-blocked-view"
}, zt = { class: "bff-auth-overlay__content" }, Jt = {
  key: 0,
  class: "bff-auth-overlay__icon bff-auth-overlay__icon--danger",
  "aria-hidden": "true"
}, Kt = {
  id: "bff-auth-account-blocked-title",
  class: "bff-auth-overlay__title"
}, Xt = {
  id: "bff-auth-account-blocked-message",
  class: "bff-auth-overlay__message"
}, Qt = { class: "bff-auth-overlay__actions" }, er = ["disabled", "aria-busy"], tr = {
  key: 0,
  class: "bff-auth-overlay__button-icon",
  "aria-hidden": "true"
}, rr = "Account unavailable", nr = "Your account has been disabled. Please contact your administrator for assistance.", or = "Access required", ir = "You don't have access to this feature. Please request access from your administrator.", sr = "Sign out", ar = /* @__PURE__ */ k({
  name: "AccountBlockedView",
  __name: "AccountBlockedView",
  props: {
    error: {},
    onSignOut: { type: Function },
    config: {}
  },
  setup(t, { expose: r }) {
    const e = t, n = i(
      () => e.error.code === "insufficient_permissions"
    ), o = i(() => n.value ? e.config.text.accountBlocked?.insufficientPermissionsTitle ?? or : e.config.text.accountBlocked?.title ?? rr), l = i(() => n.value ? e.config.text.accountBlocked?.insufficientPermissionsMessage ?? e.error.message ?? ir : e.config.text.accountBlocked?.message ?? e.error.message ?? nr), u = i(
      () => e.config.text.accountBlocked?.signOut ?? sr
    ), d = i(() => e.config.icons.accountBlocked), h = i(() => e.config.icons.signOut), v = w(!1), p = w(null);
    r({ primaryAction: p });
    async function g() {
      if (!v.value) {
        v.value = !0;
        try {
          await e.onSignOut();
        } finally {
          v.value = !1;
        }
      }
    }
    return (y, x) => (c(), _("div", Yt, [
      s("div", zt, [
        d.value ? (c(), _("div", Jt, [
          (c(), C(L(d.value)))
        ])) : A("", !0),
        s("h1", Kt, m(o.value), 1),
        s("p", Xt, m(l.value), 1),
        s("div", Qt, [
          s("button", {
            ref_key: "signOutButton",
            ref: p,
            type: "button",
            class: "bff-auth-overlay__button bff-auth-overlay__button--primary",
            disabled: v.value,
            "aria-busy": v.value,
            "data-testid": "account-blocked-sign-out-button",
            onClick: g
          }, [
            h.value ? (c(), _("span", tr, [
              (c(), C(L(h.value)))
            ])) : A("", !0),
            s("span", null, m(u.value), 1)
          ], 8, er)
        ])
      ])
    ]));
  }
}), lr = {
  class: "bff-auth-overlay",
  role: "alertdialog",
  "aria-modal": "true",
  "aria-labelledby": "bff-auth-server-error-title",
  "aria-describedby": "bff-auth-server-error-message",
  "aria-live": "assertive",
  "data-testid": "server-error-view"
}, cr = { class: "bff-auth-overlay__content" }, ur = {
  key: 0,
  class: "bff-auth-overlay__icon bff-auth-overlay__icon--danger",
  "aria-hidden": "true"
}, dr = {
  id: "bff-auth-server-error-title",
  class: "bff-auth-overlay__title"
}, fr = {
  id: "bff-auth-server-error-message",
  class: "bff-auth-overlay__message"
}, _r = { class: "bff-auth-overlay__actions" }, vr = "Something went wrong", hr = "An unexpected error occurred. Please contact your administrator for assistance.", pr = "Dismiss", gr = /* @__PURE__ */ k({
  name: "ServerErrorView",
  __name: "ServerErrorView",
  props: {
    error: {},
    config: {}
  },
  emits: ["dismiss"],
  setup(t, { expose: r, emit: e }) {
    const n = t, o = e, l = i(() => n.config.text.serverError?.title ?? vr), u = i(
      () => n.config.text.serverError?.message ?? n.error.message ?? hr
    ), d = i(
      () => n.config.text.serverError?.dismissButton ?? pr
    ), h = i(() => n.config.icons.serverError), v = w(null);
    r({ primaryAction: v });
    function p() {
      o("dismiss");
    }
    return (g, y) => (c(), _("div", lr, [
      s("div", cr, [
        h.value ? (c(), _("div", ur, [
          (c(), C(L(h.value)))
        ])) : A("", !0),
        s("h1", dr, m(l.value), 1),
        s("p", fr, m(u.value), 1),
        s("div", _r, [
          s("button", {
            ref_key: "dismissButton",
            ref: v,
            type: "button",
            class: "bff-auth-overlay__button bff-auth-overlay__button--primary",
            "data-testid": "server-error-dismiss-button",
            onClick: p
          }, [
            s("span", null, m(d.value), 1)
          ], 512)
        ])
      ])
    ]));
  }
}), mr = {
  class: "bff-auth-overlay",
  role: "alertdialog",
  "aria-modal": "true",
  "aria-labelledby": "bff-auth-permission-denied-title",
  "aria-describedby": "bff-auth-permission-denied-message",
  "aria-live": "assertive",
  "data-testid": "permission-denied-view"
}, yr = { class: "bff-auth-overlay__content" }, br = {
  key: 0,
  class: "bff-auth-overlay__icon bff-auth-overlay__icon--danger",
  "aria-hidden": "true"
}, wr = {
  id: "bff-auth-permission-denied-title",
  class: "bff-auth-overlay__title"
}, Er = {
  id: "bff-auth-permission-denied-message",
  class: "bff-auth-overlay__message"
}, Ar = { class: "bff-auth-overlay__actions" }, kr = "Permission denied", xr = "You don't have permission to perform this action.", Cr = "Dismiss", Tr = /* @__PURE__ */ k({
  name: "PermissionDeniedView",
  __name: "PermissionDeniedView",
  props: {
    error: {},
    config: {}
  },
  emits: ["dismiss"],
  setup(t, { expose: r, emit: e }) {
    const n = t, o = e, l = i(() => n.config.text.permissionDenied?.title ?? kr), u = i(
      () => n.config.text.permissionDenied?.message ?? n.error.message ?? xr
    ), d = i(
      () => n.config.text.permissionDenied?.dismissButton ?? Cr
    ), h = i(() => n.config.icons.permissionDenied), v = w(null);
    r({ primaryAction: v });
    function p() {
      o("dismiss");
    }
    return (g, y) => (c(), _("div", mr, [
      s("div", yr, [
        h.value ? (c(), _("div", br, [
          (c(), C(L(h.value)))
        ])) : A("", !0),
        s("h1", wr, m(l.value), 1),
        s("p", Er, m(u.value), 1),
        s("div", Ar, [
          s("button", {
            ref_key: "dismissButton",
            ref: v,
            type: "button",
            class: "bff-auth-overlay__button bff-auth-overlay__button--primary",
            "data-testid": "permission-denied-dismiss-button",
            onClick: p
          }, [
            s("span", null, m(d.value), 1)
          ], 512)
        ])
      ])
    ]));
  }
}), Lr = /* @__PURE__ */ k({
  name: "AuthErrorBoundary",
  __name: "AuthErrorBoundary",
  setup(t) {
    const r = G("AuthErrorBoundary"), { error: e } = Ne(), n = ae(), o = w(null), l = w(null), u = i(
      () => e.value?.type === "service_unavailable" && e.value?.code === ee
    ), d = i(() => {
      const a = e.value?.type, f = F();
      return f ? a === "session_expired" ? f.errorViews.sessionExpired ?? Qe : a === "service_unavailable" ? u.value ? f.errorViews.loginLoop ?? Ut : f.errorViews.serviceUnavailable ?? vt : a === "dev_error" ? f.errorViews.devError ?? Wt : a === "account_blocked" ? f.errorViews.accountBlocked ?? ar : a === "server_error" ? f.errorViews.serverError ?? gr : a === "permission_denied" ? f.errorViews.permissionDenied ?? Tr : null : null;
    }), h = i(() => {
      const a = e.value, f = F();
      return !a || !f ? null : a.type === "session_expired" ? {
        error: a,
        onSignIn: v,
        config: f
      } : a.type === "service_unavailable" ? u.value ? {
        error: a,
        onSignIn: v,
        onSignOut: p,
        cooldownEndsAt: Re(),
        config: f
      } : {
        error: a,
        onRetry: x,
        config: f
      } : a.type === "dev_error" ? {
        error: a,
        onSignOut: g,
        config: f
      } : a.type === "account_blocked" ? {
        error: a,
        onSignOut: g,
        config: f
      } : a.type === "server_error" ? {
        error: a,
        config: f
      } : a.type === "permission_denied" ? {
        error: a,
        config: f
      } : null;
    });
    async function v() {
      if (!Ae()) {
        if (ke()) {
          r.error("Login loop trip ceiling exceeded; forcing clean logout"), await p();
          return;
        }
        r.warn("Login redirect circuit breaker tripped; showing cooldown"), n.setError({
          type: "service_unavailable",
          code: ee,
          message: "Too many sign-in attempts. Wait a moment, then try again or sign out."
        });
        return;
      }
      r.info("User initiated re-authentication");
      try {
        const a = window.location.href;
        n.login(a);
      } catch (a) {
        r.error("Failed to initiate login redirect", a);
      }
    }
    async function p() {
      r.info("User initiated sign-out from login-loop view"), X();
      try {
        await n.logout();
      } catch (a) {
        r.error("Sign-out failed from login-loop view", a);
      } finally {
        n.clearError();
      }
    }
    async function g() {
      r.info("User initiated sign-out from terminal view");
      try {
        await n.logout();
      } catch (a) {
        r.error("Sign-out failed from terminal view", a);
      } finally {
        n.clearError();
      }
    }
    function y() {
      r.info("User dismissed error overlay", { type: e.value?.type }), n.clearError();
    }
    async function x() {
      r.info("Attempting auth service retry");
      try {
        await n.initAuth(), n.isAuthenticated ? (n.clearError(), r.info("Auth retry successful, user authenticated")) : n.hasError || (n.setError({
          type: "session_expired",
          message: "Your session has ended. Sign in again to continue."
        }), r.info("Auth service reachable but session invalid"));
      } catch (a) {
        r.warn("Auth service retry failed", a);
      }
    }
    let b = null, E = null;
    function S() {
      b === null && (b = document.body.style.overflow, document.body.style.overflow = "hidden");
    }
    function V() {
      b !== null && (document.body.style.overflow = b, b = null);
    }
    function B() {
      E = document.activeElement ?? null;
    }
    function $() {
      if (E && typeof E.focus == "function")
        try {
          E.focus();
        } catch {
        }
      E = null;
    }
    function I() {
      const a = l.value;
      return a ? Array.from(a.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')) : [];
    }
    function Z(a) {
      if (a.key !== "Tab") return;
      const f = I();
      if (f.length === 0) {
        a.preventDefault();
        return;
      }
      const j = f[0], Y = f[f.length - 1], M = document.activeElement;
      a.shiftKey ? (M === j || M === null || !l.value?.contains(M)) && (a.preventDefault(), Y.focus()) : (M === Y || M === null || !l.value?.contains(M)) && (a.preventDefault(), j.focus());
    }
    async function P() {
      await Se();
      const a = o.value?.primaryAction;
      if (a && typeof a.focus == "function") {
        a.focus();
        return;
      }
      const f = I()[0];
      f && f.focus();
    }
    return fe(
      () => d.value !== null,
      (a, f) => {
        a && !f ? (B(), S(), P()) : !a && f && (V(), $());
      },
      { immediate: !0 }
    ), fe(
      () => e.value?.type,
      () => {
        d.value && P();
      }
    ), te(() => {
      V(), $();
    }), (a, f) => (c(), C(Te, { to: "body" }, [
      d.value && h.value ? (c(), _("div", {
        key: 0,
        ref_key: "overlayRoot",
        ref: l,
        class: "bff-auth-overlay-root",
        onKeydown: Z
      }, [
        (c(), C(L(d.value), Le({
          ref_key: "viewRef",
          ref: o
        }, h.value, { onDismiss: y }), null, 16))
      ], 544)) : A("", !0)
    ]));
  }
}), Sr = (t, r) => {
  const e = t.__vccOpts || t;
  for (const [n, o] of r)
    e[n] = o;
  return e;
}, Ir = /* @__PURE__ */ Sr(Lr, [["__scopeId", "data-v-57b28879"]]), $r = {
  width: "24",
  height: "24",
  viewBox: "0 0 24 24",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
  "aria-hidden": "true"
}, Ur = /* @__PURE__ */ k({
  name: "IconSessionExpired",
  __name: "IconSessionExpired",
  setup(t) {
    return (r, e) => (c(), _("svg", $r, [...e[0] || (e[0] = [
      s("path", {
        d: "M3.5 12C3.5 7.30558 7.30558 3.5 12 3.5C16.6944 3.5 20.5 7.30558 20.5 12C20.5 16.6944 16.6944 20.5 12 20.5C7.30558 20.5 3.5 16.6944 3.5 12ZM12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2ZM11.9931 6.64827C11.9435 6.28233 11.6295 6 11.25 6C10.836 6 10.5 6.336 10.5 6.75V12.75L10.5069 12.8517C10.5565 13.2177 10.8705 13.5 11.25 13.5H15.25L15.3517 13.4931C15.7177 13.4435 16 13.1295 16 12.75C16 12.336 15.664 12 15.25 12H12V6.75L11.9931 6.64827Z",
        fill: "currentColor"
      }, null, -1)
    ])]));
  }
}), Fr = {
  width: "24",
  height: "24",
  viewBox: "0 0 24 24",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
  "aria-hidden": "true"
}, he = /* @__PURE__ */ k({
  name: "IconLogin",
  __name: "IconLogin",
  setup(t) {
    return (r, e) => (c(), _("svg", Fr, [...e[0] || (e[0] = [
      s("path", {
        d: "M13.2673 4.20889C12.9674 3.9232 12.4926 3.93475 12.2069 4.23467C11.9212 4.5346 11.9328 5.00933 12.2327 5.29502L18.4841 11.2496H3.75C3.33579 11.2496 3 11.5854 3 11.9996C3 12.4138 3.33579 12.7496 3.75 12.7496H18.4842L12.2327 18.7043C11.9328 18.99 11.9212 19.4648 12.2069 19.7647C12.4926 20.0646 12.9674 20.0762 13.2673 19.7905L20.6862 12.7238C20.8551 12.5629 20.9551 12.3576 20.9861 12.1443C20.9952 12.0975 21 12.0491 21 11.9996C21 11.9501 20.9952 11.9016 20.986 11.8547C20.955 11.6415 20.855 11.4364 20.6862 11.2756L13.2673 4.20889Z",
        fill: "currentColor"
      }, null, -1)
    ])]));
  }
}), Dr = {
  width: "24",
  height: "24",
  viewBox: "0 0 24 24",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
  "aria-hidden": "true"
}, pe = /* @__PURE__ */ k({
  name: "IconServiceUnavailable",
  __name: "IconServiceUnavailable",
  setup(t) {
    return (r, e) => (c(), _("svg", Dr, [...e[0] || (e[0] = [
      s("path", {
        d: "M3.28034 2.21968C2.98745 1.92678 2.51257 1.92677 2.21968 2.21966C1.92678 2.51255 1.92677 2.98743 2.21966 3.28032L6.85339 7.91414C6.47198 8.54894 6.20466 9.26014 6.07981 10.0194C3.79155 10.2313 2 12.1564 2 14.5C2 16.9853 4.01472 19 6.5 19H17.5C17.6415 19 17.7815 18.9935 17.9197 18.9807L20.7194 21.7805C21.0123 22.0734 21.4872 22.0734 21.7801 21.7805C22.073 21.4876 22.073 21.0127 21.7801 20.7198L3.28034 2.21968ZM16.4391 17.5H6.5C4.84315 17.5 3.5 16.1569 3.5 14.5C3.5 12.8431 4.84315 11.5 6.5 11.5H6.75585C7.15641 11.5 7.48627 11.1852 7.50502 10.7851C7.53463 10.1537 7.69446 9.55623 7.95827 9.01904L16.4391 17.5ZM20.5 14.5C20.5 15.2822 20.2007 15.9944 19.7103 16.5285L20.7716 17.5898C21.5331 16.7838 22 15.6964 22 14.5C22 12.1564 20.2085 10.2313 17.9202 10.0194C17.4519 7.17189 14.9798 5 12 5C10.9031 5 9.875 5.29431 8.99031 5.80828L10.1011 6.91911C10.6781 6.65018 11.3215 6.5 12 6.5C14.4132 6.5 16.3832 8.39994 16.495 10.7851C16.5137 11.1852 16.8436 11.5 17.2442 11.5H17.5C19.1569 11.5 20.5 12.8431 20.5 14.5Z",
        fill: "currentColor"
      }, null, -1)
    ])]));
  }
}), Or = {
  width: "24",
  height: "24",
  viewBox: "0 0 24 24",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
  "aria-hidden": "true"
}, Br = /* @__PURE__ */ k({
  name: "IconRetry",
  __name: "IconRetry",
  setup(t) {
    return (r, e) => (c(), _("svg", Or, [...e[0] || (e[0] = [
      s("path", {
        d: "M12 4.5C7.85786 4.5 4.5 7.85786 4.5 12C4.5 16.1421 7.85786 19.5 12 19.5C16.1421 19.5 19.5 16.1421 19.5 12C19.5 11.6236 19.4723 11.2538 19.4188 10.8923C19.3515 10.4382 19.6839 10 20.1429 10C20.5138 10 20.839 10.2562 20.8953 10.6228C20.9642 11.0718 21 11.5317 21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C14.3051 3 16.4077 3.86656 18 5.29168V4.25C18 3.83579 18.3358 3.5 18.75 3.5C19.1642 3.5 19.5 3.83579 19.5 4.25V7.25C19.5 7.66421 19.1642 8 18.75 8H15.75C15.3358 8 15 7.66421 15 7.25C15 6.83579 15.3358 6.5 15.75 6.5H17.0991C15.7609 5.25883 13.9691 4.5 12 4.5Z",
        fill: "currentColor"
      }, null, -1)
    ])]));
  }
}), Pr = {
  width: "24",
  height: "24",
  viewBox: "0 0 24 24",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
  "aria-hidden": "true"
}, Mr = /* @__PURE__ */ k({
  name: "IconPermissionDenied",
  __name: "IconPermissionDenied",
  setup(t) {
    return (r, e) => (c(), _("svg", Pr, [...e[0] || (e[0] = [
      s("path", {
        "fill-rule": "evenodd",
        "clip-rule": "evenodd",
        fill: "currentColor",
        d: "M12 1.5C9.04 1.5 6.5 4.04 6.5 7V10H6C4.62 10 3.5 11.12 3.5 12.5V20C3.5 21.38 4.62 22.5 6 22.5H18C19.38 22.5 20.5 21.38 20.5 20V12.5C20.5 11.12 19.38 10 18 10H17.5V7C17.5 4.04 14.96 1.5 12 1.5ZM8 10V7C8 4.79 9.79 3 12 3C14.21 3 16 4.79 16 7V10H8ZM5 12.5C5 11.95 5.45 11.5 6 11.5H18C18.55 11.5 19 11.95 19 12.5V20C19 20.55 18.55 21 18 21H6C5.45 21 5 20.55 5 20V12.5ZM12 13.5C11.17 13.5 10.5 14.17 10.5 15C10.5 15.56 10.81 16.04 11.25 16.3V17.5C11.25 17.91 11.59 18.25 12 18.25C12.41 18.25 12.75 17.91 12.75 17.5V16.3C13.19 16.04 13.5 15.56 13.5 15C13.5 14.17 12.83 13.5 12 13.5Z"
      }, null, -1)
    ])]));
  }
}), Rr = {
  width: "24",
  height: "24",
  viewBox: "0 0 24 24",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
  "aria-hidden": "true"
}, Vr = /* @__PURE__ */ k({
  name: "IconDevError",
  __name: "IconDevError",
  setup(t) {
    return (r, e) => (c(), _("svg", Rr, [...e[0] || (e[0] = [
      s("path", {
        d: "M12.012 2.25c.734.008 1.465.093 2.182.253a.75.75 0 0 1 .582.649l.17 1.527a1.384 1.384 0 0 0 1.927 1.116l1.401-.615a.75.75 0 0 1 .85.174 9.792 9.792 0 0 1 2.204 3.792.75.75 0 0 1-.271.825l-1.242.916a1.381 1.381 0 0 0 0 2.226l1.243.915a.75.75 0 0 1 .272.826 9.797 9.797 0 0 1-2.204 3.792.75.75 0 0 1-.848.175l-1.407-.617a1.38 1.38 0 0 0-1.926 1.114l-.169 1.526a.75.75 0 0 1-.572.647 9.518 9.518 0 0 1-4.406 0 .75.75 0 0 1-.572-.647l-.168-1.524a1.382 1.382 0 0 0-1.926-1.11l-1.406.616a.75.75 0 0 1-.849-.175 9.798 9.798 0 0 1-2.204-3.796.75.75 0 0 1 .272-.826l1.243-.916a1.38 1.38 0 0 0 0-2.226l-1.243-.914a.75.75 0 0 1-.271-.826 9.793 9.793 0 0 1 2.204-3.792.75.75 0 0 1 .85-.174l1.4.615a1.387 1.387 0 0 0 1.93-1.118l.17-1.526a.75.75 0 0 1 .583-.65c.717-.159 1.45-.243 2.201-.252ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
        fill: "currentColor"
      }, null, -1)
    ])]));
  }
}), Nr = {
  width: "24",
  height: "24",
  viewBox: "0 0 24 24",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
  "aria-hidden": "true"
}, Gr = /* @__PURE__ */ k({
  name: "IconAccountBlocked",
  __name: "IconAccountBlocked",
  setup(t) {
    return (r, e) => (c(), _("svg", Nr, [...e[0] || (e[0] = [
      s("path", {
        d: "M17.5 12a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11Zm-5.477 1.999a6.47 6.47 0 0 0-1.023 3.5c0 1.645.61 3.146 1.616 4.29-.801.142-1.674.212-2.616.212-2.89 0-5.128-.657-6.691-2a3.75 3.75 0 0 1-1.305-2.844v-.907A2.25 2.25 0 0 1 4.254 14l7.769-.001Zm8.786 1.253-5.557 5.557a4 4 0 0 0 5.557-5.557ZM17.5 13.5a4 4 0 0 0-3.31 6.247l5.558-5.556A3.982 3.982 0 0 0 17.5 13.5ZM10 2.004a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z",
        fill: "currentColor"
      }, null, -1)
    ])]));
  }
}), Zr = {
  width: "24",
  height: "24",
  viewBox: "0 0 24 24",
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
  "aria-hidden": "true"
}, jr = /* @__PURE__ */ k({
  name: "IconServerError",
  __name: "IconServerError",
  setup(t) {
    return (r, e) => (c(), _("svg", Zr, [...e[0] || (e[0] = [
      s("path", {
        d: "M12 2c5.523 0 10 4.478 10 10s-4.477 10-10 10S2 17.522 2 12 6.477 2 12 2Zm.002 13.004a.999.999 0 1 0 0 1.997.999.999 0 0 0 0-1.997ZM12 7a1 1 0 0 0-.993.884L11 8l.002 5.001.007.117a1 1 0 0 0 1.986 0l.007-.117L13 8l-.007-.117A1 1 0 0 0 12 7Z",
        fill: "currentColor"
      }, null, -1)
    ])]));
  }
}), Hr = {
  sessionExpired: Ur,
  login: he,
  serviceUnavailable: pe,
  loginLoop: pe,
  retry: Br,
  devError: Vr,
  accountBlocked: Gr,
  serverError: jr,
  permissionDenied: Mr,
  signOut: he
};
function qr(t) {
  if (!t.bffBaseUrl)
    throw new Error("bffAuthPlugin: bffBaseUrl is required");
  if (!t.clientId)
    throw new Error("bffAuthPlugin: clientId is required");
  if (t.mode !== void 0 && t.mode !== "token" && t.mode !== "cookie")
    throw new Error("bffAuthPlugin: mode must be 'token' or 'cookie'");
}
function Wr(t) {
  const r = t.logger ?? G("BffAuth");
  return {
    bffBaseUrl: t.bffBaseUrl,
    clientId: t.clientId,
    logger: r,
    icons: { ...Hr, ...t.icons },
    errorViews: t.errorViews ?? {},
    text: t.text ?? {},
    mode: t.mode ?? "token",
    onUnmappedError: t.onUnmappedError,
    errorCodeOverrides: t.errorCodeOverrides
  };
}
const cn = {
  install(t, r) {
    qr(r);
    const e = Wr(r);
    t.provide(ye, e), $e(e), t.component("AuthErrorBoundary", Ir), e.logger.debug("BFF Auth plugin installed", {
      bffBaseUrl: e.bffBaseUrl,
      clientId: e.clientId,
      mode: e.mode
    });
  }
}, J = G("AuthInterceptors");
function un(t, r) {
  t.interceptors.request.use(
    async (e) => {
      if (F()?.mode === "cookie")
        return e;
      const n = r();
      if (!n.isAuthenticated)
        return e;
      try {
        const o = await n.ensureValidToken();
        o && (e.headers.Authorization = `Bearer ${o}`);
      } catch (o) {
        if (o instanceof O)
          return n.setError({
            type: "service_unavailable",
            message: o.message
          }), Promise.reject(o);
        J.error("Failed to get auth token:", o instanceof Error ? o.message : "Unknown error");
      }
      return e;
    },
    (e) => Promise.reject(e)
  ), t.interceptors.response.use(
    (e) => e,
    async (e) => {
      const n = r(), o = e.response, l = o?.status ?? 0, u = F(), d = u?.errorCodeOverrides, h = u?.onUnmappedError, v = o?.data ?? {}, p = v.error, g = typeof p == "string" && p.length > 0 ? p.toLowerCase() : null;
      if (l === 401 && !K())
        return J.warn("401 received but auth is not configured, ignoring"), Promise.reject(e);
      const y = re(e, d);
      if (y)
        return n.setError(y), Promise.reject(e);
      if (g) {
        if (Ee.has(g) || d && Object.prototype.hasOwnProperty.call(d, g))
          return Promise.reject(e);
        if (!Object.prototype.hasOwnProperty.call(we, g) && h)
          try {
            Promise.resolve(h(g, l, e)).catch((E) => {
              J.warn("onUnmappedError hook rejected", E);
            });
          } catch (E) {
            J.warn("onUnmappedError hook threw", E);
          }
      }
      if (l === 429 && !g)
        return n.setError({
          type: "service_unavailable",
          code: "rate_limit_exceeded",
          message: v.error_description || "Too many requests. Please try again shortly."
        }), Promise.reject(e);
      const x = Fe(l);
      return x === "session_expired" ? n.setError({
        type: "session_expired",
        message: "Your session has expired. Please sign in again."
      }) : x === "service_unavailable" && l === 429 && n.setError({
        type: "service_unavailable",
        code: "rate_limit_exceeded",
        message: v.error_description || "Too many requests. Please try again shortly."
      }), Promise.reject(e);
    }
  );
}
const R = G("AuthGuard");
function Yr(t) {
  return t.meta.public === !0;
}
async function zr(t) {
  if (!t.isLoading)
    return !0;
  let r = 0;
  const e = 200;
  for (; t.isLoading && r < e; )
    await new Promise((n) => setTimeout(n, 50)), r++;
  return t.isLoading ? (R.warn("Auth initialization timed out after 10 seconds"), !1) : !0;
}
const Jr = {
  getAuthStore: () => ae(),
  getAuthService: () => N
};
function Kr(t = Jr) {
  let r = !1;
  function e(n, o, l) {
    return Ae() ? (n.login({ returnUrl: l }), !1) : ke() ? (R.error("Login loop trip ceiling exceeded; forcing clean logout to clear stale session"), X(), o.logout(), !0) : (R.error("Login redirect circuit breaker tripped"), o.setError({
      type: "service_unavailable",
      code: ee,
      message: "Too many login attempts. Authentication service may be unavailable."
    }), !0);
  }
  return async (n) => {
    const o = t.getAuthStore(), l = t.getAuthService();
    try {
      if (Yr(n))
        return !0;
      if (!r) {
        r = !0;
        try {
          await o.initAuth();
        } catch (d) {
          R.error("Failed to initialize auth:", d);
        }
      }
      return await zr(o) ? o.isAuthenticated ? (X(), !0) : o.error && o.error.type !== "session_expired" ? (R.info("Terminal auth error set, skipping login redirect", {
        type: o.error.type,
        code: o.error.code
      }), !0) : e(l, o, n.fullPath) : (R.warn("Auth not ready, redirecting to login"), e(l, o, n.fullPath));
    } catch (u) {
      return u instanceof O ? (R.error("Auth configuration error:", u.message), o.setError({
        type: "service_unavailable",
        message: u.message
      }), !0) : (R.error("Unexpected error in auth guard:", u), e(l, o, n.fullPath));
    }
  };
}
function dn(t) {
  t.beforeEach(Kr());
}
export {
  O as AuthConfigurationError,
  Ir as AuthErrorBoundary,
  De as AuthService,
  ye as BFF_AUTH_CONFIG_KEY,
  Hr as DEFAULT_ICONS,
  we as ERROR_CODE_TO_TYPE,
  Ee as KNOWN_INLINE_CODES,
  ee as LOGIN_LOOP_DETECTED,
  N as authService,
  cn as bffAuthPlugin,
  Kr as createAuthGuard,
  Be as decodeAccessToken,
  Oe as decodeJwt,
  an as extractEmailFromJwt,
  Re as getCircuitBreakerResetAt,
  Ve as getCircuitBreakerTripCount,
  F as getGlobalConfig,
  ke as hasExceededTripCeiling,
  K as isAuthConfigured,
  ln as isCircuitBroken,
  Ue as mapErrorCodeToType,
  re as parseAuthError,
  Ae as recordLoginAttempt,
  X as resetLoginAttempts,
  $e as setGlobalConfig,
  dn as setupAuthGuard,
  un as setupAuthInterceptors,
  Fe as statusFallbackType,
  Ne as useAuth,
  on as useAuthConfig,
  sn as useAuthService,
  ae as useAuthStore
};
