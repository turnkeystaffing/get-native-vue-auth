import { AxiosError } from 'axios';
import { AxiosInstance } from 'axios';
import { Component } from 'vue';
import { ComponentOptionsMixin } from 'vue';
import { ComponentProvideOptions } from 'vue';
import { ComputedRef } from 'vue';
import { DefineComponent } from 'vue';
import { InjectionKey } from 'vue';
import { Logger } from '@turnkeystaffing/get-native-vue-logger';
import { NavigationGuard } from 'vue-router';
import { PiniaCustomStateProperties } from 'pinia';
import { Plugin as Plugin_2 } from 'vue';
import { PublicProps } from 'vue';
import { Router } from 'vue-router';
import { StoreDefinition } from 'pinia';

/**
 * Props passed to a consumer-provided replacement for the default
 * account-blocked view. Covers both `account_inactive` and
 * `insufficient_permissions`; the copy branches on `error.code`.
 */
export declare interface AccountBlockedViewProps {
    error: AuthError;
    onSignOut: () => void | Promise<void>;
    config: BffAuthConfig;
}

/**
 * Error thrown when auth configuration is missing or invalid.
 * This prevents redirect loops when BFF_BASE_URL is not configured.
 */
export declare class AuthConfigurationError extends Error {
    constructor(message: string);
}

/**
 * Auth error structure for frontend error handling.
 *
 * View behavior is driven entirely by `type` (recovery category) and `code`
 * (lowercased backend code, e.g., `insufficient_permissions`, `reauth_required`).
 * No auxiliary data is carried on the error; views render from code alone.
 *
 * @see PAT-004 Error type mapping
 */
export declare interface AuthError {
    type: AuthErrorType;
    message: string;
    /** Lowercased backend error code (e.g., `reauth_required`, `account_inactive`) */
    code?: string;
}

export declare const AuthErrorBoundary: DefineComponent<    {}, {}, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, {}, string, PublicProps, Readonly<{}> & Readonly<{}>, {}, {}, {}, {}, string, ComponentProvideOptions, true, {
overlayRoot: HTMLDivElement;
viewRef: unknown;
}, any>;

/**
 * Auth error types — five recovery categories.
 *
 * Each type corresponds to a distinct user-recovery UX:
 * - `session_expired`: re-authenticate (clears auth state)
 * - `service_unavailable`: wait and retry (countdown UI, does not clear auth)
 * - `dev_error`: OAuth client misconfiguration — terminal; "Contact developer" CTA (does not clear auth)
 * - `account_blocked`: account disabled or insufficient permissions — terminal; "Sign out" CTA (clears auth)
 * - `server_error`: unhandled server/infra failure — terminal; shows `request_id` for support (does not clear auth)
 *
 * Routing is driven by a lowercased error-code table (`ERROR_CODE_TO_TYPE`) with
 * HTTP-status fallbacks when the code is absent.
 *
 * @see PAT-004 Error type mapping
 */
export declare type AuthErrorType = 'session_expired' | 'service_unavailable' | 'dev_error' | 'account_blocked' | 'server_error';

/**
 * Escape-hatch: replace the default error views entirely.
 *
 * Props contract (stable public API from v2.0.0):
 * - `sessionExpired` receives {@link SessionExpiredViewProps}
 * - `serviceUnavailable` receives {@link ServiceUnavailableViewProps}
 * - `devError` receives {@link DevErrorViewProps}
 * - `accountBlocked` receives {@link AccountBlockedViewProps}
 * - `serverError` receives {@link ServerErrorViewProps}
 */
export declare interface AuthErrorViews {
    sessionExpired?: Component;
    serviceUnavailable?: Component;
    devError?: Component;
    accountBlocked?: Component;
    serverError?: Component;
}

/**
 * Auth guard dependencies for dependency injection
 */
export declare interface AuthGuardDependencies {
    getAuthStore: () => ReturnType<typeof useAuthStore>;
    getAuthService: () => typeof authService;
}

/**
 * Icon configuration for auth UI components.
 *
 * Values are Vue component refs (so bundled FluentUI icons can be swapped for
 * any consumer icon library) or `false` to disable the icon entirely.
 */
export declare interface AuthIcons {
    /** Icon for session expired view title (false to disable) */
    sessionExpired: Component | false;
    /** Icon for login/sign-in button (false to disable) */
    login: Component | false;
    /** Icon for service unavailable view title (false to disable) */
    serviceUnavailable: Component | false;
    /** Icon for retry button (false to disable) */
    retry: Component | false;
    /** Icon for dev-error view title (false to disable) */
    devError: Component | false;
    /** Icon for account-blocked view title (false to disable) */
    accountBlocked: Component | false;
    /** Icon for server-error view title (false to disable) */
    serverError: Component | false;
    /** Icon for "Sign out" CTA on terminal views (false to disable) */
    signOut: Component | false;
}

/**
 * Authentication mode
 * - 'token': Explicit token management with Bearer header injection (default)
 * - 'cookie': BFF proxy handles auth via session cookies; no token operations
 */
export declare type AuthMode = 'token' | 'cookie';

/**
 * Auth Service Client for BFF endpoints
 */
export declare class AuthService {
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
    submitCredentials(email: string, password: string, totpCode?: string): Promise<void>;
    /**
     * Check if user is authenticated by calling /bff/userinfo
     * This should be called on app load to determine auth state
     *
     * @returns CheckAuthResponse with user info if authenticated
     * @throws AuthConfigurationError if auth is not configured
     */
    checkAuth(): Promise<CheckAuthResponse>;
    /**
     * Start login flow by redirecting to BFF login endpoint.
     * For use by Product SPAs to redirect users to Central Login.
     *
     * Security: Enforces same-origin redirects to prevent open redirect attacks.
     * For cross-origin redirects with a custom client ID, use {@link loginWithCustomClient}.
     *
     * @param options - Login options with optional returnUrl (defaults to current URL)
     */
    login(options?: LoginOptions): void;
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
    loginWithCustomClient(options: LoginWithCustomClientOptions): void;
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
    completeOAuthFlow(options: CompleteOAuthFlowOptions): void;
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
    getAccessToken(): Promise<TokenResponse | null>;
    /**
     * Logout - revokes session and clears cookies
     *
     * @returns Success indicator, or throws AuthError on failure
     */
    logout(): Promise<LogoutResponse>;
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
    setup2FA(token: string): Promise<TwoFactorSetupResponse>;
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
    verify2FASetup(token: string, totpCode: string): Promise<TwoFactorVerifyResponse>;
    /**
     * Resend 2FA setup email
     * POSTs to /api/v1/auth/2fa/resend-setup-email with user email and password.
     *
     * @param email - User email address
     * @param password - User password
     * @returns TwoFactorResendResponse with confirmation message
     * @throws AxiosError on failure (e.g., email not found, rate limited)
     */
    resend2FASetupEmail(email: string, password: string): Promise<TwoFactorResendResponse>;
}

export declare const authService: AuthService;

/**
 * Auth state interface matching ADR-005
 * @public Exported for type-checking in components
 */
export declare interface AuthState {
    isAuthenticated: boolean;
    isLoading: boolean;
    user: UserInfo | null;
    accessToken: string | null;
    tokenExpiresAt: number | null;
    error: AuthError | null;
}

export declare type AuthStore = ReturnType<typeof useAuthStore>;

/**
 * Auth store interface for dependency injection
 * Matches the subset of useAuthStore() needed by interceptors
 */
export declare interface AuthStoreInterface {
    isAuthenticated: boolean;
    ensureValidToken: () => Promise<string | null>;
    setError: (error: AuthError) => void;
}

/**
 * Per-state text overrides for default error views.
 *
 * Omitted fields fall back to the plugin's built-in English copy.
 */
export declare interface AuthText {
    sessionExpired?: {
        title?: string;
        message?: string;
        button?: string;
    };
    serviceUnavailable?: {
        title?: string;
        message?: string;
        button?: string;
        retryingLabel?: string;
        countdownLabel?: (seconds: number) => string;
    };
    devError?: {
        title?: string;
        message?: string;
        contactLine?: string;
        signOut?: string;
    };
    accountBlocked?: {
        title?: string;
        message?: string;
        insufficientPermissionsTitle?: string;
        insufficientPermissionsMessage?: string;
        signOut?: string;
    };
    serverError?: {
        title?: string;
        message?: string;
        dismissButton?: string;
    };
}

/**
 * Backend error response body.
 *
 * Canonical shape (RFC 6749 style):
 *
 *     { "error": "ERROR_CODE", "error_description": "Human-readable description" }
 *
 * `error` is widened to `string` because backend emits both RFC 6749 lowercase
 * codes (`invalid_grant`) and `UPPER_CASE` Auth API codes (`MISSING_TOKEN`). The
 * interceptor normalizes via `mapErrorCodeToType` (lowercases).
 *
 * @see PAT-004 Error type mapping
 */
export declare interface BackendAuthError {
    /** Error code (any casing) — lowercased before routing through the code→category map */
    error?: string;
    /** Human-readable description; used as `AuthError.message` */
    error_description?: string;
}

/**
 * Backend token response structure (snake_case from BFF)
 * Maps to frontend TokenResponse (camelCase)
 */
export declare interface BackendTokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
}

/**
 * Vue injection key for BFF auth config
 * Used by composables and components to access config reactively
 */
export declare const BFF_AUTH_CONFIG_KEY: InjectionKey<BffAuthConfig>;

/**
 * Resolved config after plugin initialization
 * All optional fields have default values
 */
export declare interface BffAuthConfig {
    /** BFF base URL */
    bffBaseUrl: string;
    /** OAuth client ID for login flow */
    clientId: string;
    /** Logger instance */
    logger: Logger;
    /** Resolved icon configuration */
    icons: AuthIcons;
    /** Resolved view overrides (empty object if consumer provided none) */
    errorViews: AuthErrorViews;
    /** Resolved text overrides (empty object if consumer provided none) */
    text: AuthText;
    /** Resolved authentication mode */
    mode: AuthMode;
    /** Resolved drift callback (undefined if consumer provided none) */
    onUnmappedError?: UnmappedErrorHook;
    /** Resolved code→category overrides (undefined if consumer provided none) */
    errorCodeOverrides?: Record<string, AuthErrorType | null>;
}

/**
 * BFF Auth Vue Plugin
 *
 * Installs authentication functionality into a Vue application and registers
 * `AuthErrorBoundary` globally so consumers can place `<AuthErrorBoundary />`
 * anywhere in their template.
 *
 * Requires `createPinia()` to have been installed on the app first.
 */
export declare const bffAuthPlugin: Plugin_2<[BffAuthPluginOptions]>;

/**
 * Plugin options provided during app.use()
 */
export declare interface BffAuthPluginOptions {
    /** BFF base URL - required */
    bffBaseUrl: string;
    /** OAuth client ID for login flow - required */
    clientId: string;
    /** Custom logger instance - optional, uses default logger if not provided */
    logger?: Logger;
    /** Icon overrides merged with bundled FluentUI defaults */
    icons?: Partial<AuthIcons>;
    /** Full view replacements — takes precedence over icons/text when provided */
    errorViews?: AuthErrorViews;
    /** Per-state text overrides for default views */
    text?: AuthText;
    /** Authentication mode - 'token' (default) or 'cookie' for BFF cookie-only auth */
    mode?: AuthMode;
    /**
     * Callback fired when the interceptor encounters an unmapped error code.
     *
     * Use this to surface backend/frontend map drift in production telemetry.
     * @see UnmappedErrorHook
     */
    onUnmappedError?: UnmappedErrorHook;
    /**
     * Per-consumer overrides for the code→category map.
     *
     * Keys must be lowercase; values may be any `AuthErrorType` or `null`
     * (marks the code as inline/silent — treated like `KNOWN_INLINE_CODES`).
     *
     * Overrides shallow-merge *over* the canonical `ERROR_CODE_TO_TYPE` map.
     */
    errorCodeOverrides?: Record<string, AuthErrorType | null>;
}

/**
 * Response from checkAuth() method
 */
export declare interface CheckAuthResponse {
    isAuthenticated: boolean;
    user: UserInfo | null;
}

/**
 * Options for completing the OAuth flow (Central Login only)
 * Both parameters are required since Central Login must pass through
 * the client_id and redirect_url from the originating SPA.
 */
export declare interface CompleteOAuthFlowOptions {
    /** OAuth client ID from the originating SPA (required) */
    clientId: string;
    /** URL to return to after authentication - the originating SPA's URL (required) */
    returnUrl: string;
}

/**
 * Create auth navigation guard with encapsulated state
 *
 * Uses factory pattern to encapsulate initialization state in closure,
 * enabling clean testing without module-level state pollution.
 *
 * @param deps - Dependencies (for testing injection)
 * @returns Navigation guard function
 */
export declare function createAuthGuard(deps?: AuthGuardDependencies): NavigationGuard;

/**
 * Decode a JWT access token and return typed claims.
 * Validates that required fields (email, user_id, roles) are present.
 *
 * @param token - The JWT token string to decode
 * @returns The decoded token with typed claims, or null if decoding fails or required fields are missing
 *
 * @example
 * ```typescript
 * const decoded = decodeAccessToken(accessToken)
 * if (decoded) {
 *   console.log('User roles:', decoded.roles)
 *   console.log('User ID:', decoded.user_id)
 * }
 * ```
 */
export declare function decodeAccessToken(token: string | null | undefined): DecodedAccessToken | null;

/**
 * Decoded JWT access token claims from our auth provider.
 * Contains user identity, roles, and standard JWT claims.
 */
export declare interface DecodedAccessToken {
    username: string;
    email: string;
    roles: string[];
    guid: string;
    user_id: string;
    session_id: string;
    client_id: string;
    iss: string;
    sub: string;
    aud: string[];
    exp: number;
    nbf: number;
    iat: number;
    jti: string;
}

/**
 * Safely decode a JWT token and extract its payload.
 *
 * @param token - The JWT token string to decode
 * @returns The decoded payload or null if decoding fails
 *
 * @example
 * ```typescript
 * const payload = decodeJwt(accessToken)
 * if (payload?.email) {
 *   console.log('User email:', payload.email)
 * }
 * ```
 */
export declare function decodeJwt(token: string | null | undefined): JwtPayload | null;

/**
 * Default icons (bundled FluentUI SVG components).
 *
 * Consumers can override any/all via the `icons` plugin option, or set to
 * `false` to disable a specific icon.
 *
 * The three new categories (`devError`, `accountBlocked`, `serverError`) reuse
 * `IconServiceUnavailable` by default since these are "something's not right"
 * states; consumers that want category-specific artwork should override.
 * `signOut` reuses `IconLogin` — it's a directional-door icon that reads
 * symmetrically for sign-in and sign-out.
 */
export declare const DEFAULT_ICONS: AuthIcons;

/**
 * Props passed to a consumer-provided replacement for the default
 * dev-error view. Terminal view — no retry / no re-login path.
 *
 * `onSignOut` calls `authStore.logout()` so the user has a non-destructive
 * escape hatch to switch accounts.
 */
export declare interface DevErrorViewProps {
    error: AuthError;
    onSignOut: () => void | Promise<void>;
    config: BffAuthConfig;
}

/**
 * Canonical lowercase backend-code → recovery-category table.
 *
 * Freezing ensures consumers cannot mutate the table in place; use
 * `mapErrorCodeToType(code, overrides)` to extend per-call.
 */
export declare const ERROR_CODE_TO_TYPE: Readonly<Record<string, AuthErrorType>>;

/**
 * Extract the email claim from a JWT token.
 *
 * @param token - The JWT token string
 * @returns The email address or null if not present/decodable
 *
 * @example
 * ```typescript
 * const email = extractEmailFromJwt(accessToken)
 * // email is 'user@example.com' or null
 * ```
 */
export declare function extractEmailFromJwt(token: string | null | undefined): string | null;

/**
 * Get the global config
 * Used by services that can't access Vue's injection system
 *
 * @returns The config or null if not initialized
 */
export declare function getGlobalConfig(): BffAuthConfig | null;

/**
 * Flag indicating if auth is properly configured.
 * When false, auth operations will fail gracefully rather than redirect.
 */
export declare function isAuthConfigured(): boolean;

/**
 * Check if the circuit breaker has tripped without incrementing.
 * Returns false if the time window has expired (stale state is ignored).
 *
 * @param maxAttempts - Maximum allowed attempts (default: 3)
 * @param windowMs - Time window in ms (default: 120000)
 */
export declare function isCircuitBroken(maxAttempts?: number, windowMs?: number): boolean;

/**
 * Standard JWT payload claims we expect from our auth provider.
 * Extend this interface if additional claims are needed.
 */
export declare interface JwtPayload {
    /** Subject (user identifier) */
    sub?: string;
    /** User email address */
    email?: string;
    /** Token expiration time (Unix timestamp) */
    exp?: number;
    /** Token issued at time (Unix timestamp) */
    iat?: number;
    /** Token issuer */
    iss?: string;
    /** Token audience */
    aud?: string | string[];
    /** Additional claims can be accessed via index signature */
    [key: string]: unknown;
}

/**
 * Inline/form error codes (Category 5 in `docs/error-handling-analysis.md`).
 *
 * These are *recognized* as handled by caller code (inline form validation,
 * toast, session-management UI, etc.). The interceptor does NOT call `setError`
 * or `onUnmappedError` for these — they propagate as rejections and the caller
 * renders the UI.
 *
 * Note: `invalid_token` appears in both this category (email-verification link
 * expiry) AND the tokens-&-sessions category (JWT/session invalidation). The
 * interceptor treats it as `session_expired`; email flows can filter locally.
 */
export declare const KNOWN_INLINE_CODES: ReadonlySet<string>;

/**
 * Login credentials for BFF authentication
 */
export declare interface LoginCredentials {
    email: string;
    password: string;
    totp_code?: string;
}

/**
 * Options for initiating the login flow (Product SPAs)
 */
export declare interface LoginOptions {
    /** URL to return to after authentication (defaults to current URL) */
    returnUrl?: string;
}

/**
 * Options for initiating a cross-origin login redirect with a custom OAuth client.
 * For use when Central Login needs to redirect a user whose BFF session is already
 * active back to an originating Product SPA.
 *
 * Both parameters are required — BFF validates the redirect_url against registered
 * client URIs for the given client_id. Same-origin validation is intentionally
 * skipped; only bffBaseUrl is required from config.
 *
 * @see completeOAuthFlow for the post-credential counterpart
 */
export declare interface LoginWithCustomClientOptions {
    /** OAuth client ID from the originating Product SPA (required, must be non-empty) */
    clientId: string;
    /** URL to return to after authentication — may be cross-origin (required, must be http/https) */
    returnUrl: string;
}

/**
 * Logout response
 */
export declare interface LogoutResponse {
    success: boolean;
}

/**
 * Map a backend error code to its recovery category.
 *
 * Lowercases the input before lookup. Consults `overrides` first, then the
 * canonical `ERROR_CODE_TO_TYPE` map. Returns `null` for:
 * - known inline codes (caller handles inline)
 * - unknown codes (interceptor falls back to `statusFallbackType` and reports drift)
 * - codes explicitly mapped to `null` via `overrides` (treated as inline/silent)
 *
 * @param code - Backend error code (any casing); `null`/`undefined` returns `null`
 * @param overrides - Optional per-call shallow-merge overrides (keyed lowercase)
 * @returns The matched `AuthErrorType`, or `null` if inline/unknown/override-null
 *
 * @see PAT-004 Error type mapping
 */
export declare function mapErrorCodeToType(code: string | null | undefined, overrides?: Record<string, AuthErrorType | null>): AuthErrorType | null;

/**
 * Parse auth error from an Axios error response.
 *
 * Reads only `error` (code) and `error_description` (message) from the body.
 * Lowercases the code and routes through the canonical code→category table
 * with optional consumer overrides. Views render based on `AuthError.code` —
 * no auxiliary data is carried through.
 *
 * Returns `null` when:
 * - the response carries no code (caller applies HTTP-status fallback)
 * - the code is a `KNOWN_INLINE_CODES` member (caller handles inline)
 * - the code is unknown (caller reports drift)
 * - an `overrides` entry explicitly maps the code to `null`
 *
 * This function does NOT apply `statusFallbackType` — the interceptor owns
 * status-based fallbacks because only it has enough context
 * (`onUnmappedError`, etc.) to distinguish a naked-status error from drift.
 *
 * @param error - The Axios error
 * @param overrides - Optional per-call code→category overrides
 *
 * @see PAT-004 Error type mapping
 */
export declare function parseAuthError(error: AxiosError<BackendAuthError>, overrides?: Record<string, AuthErrorType | null>): AuthError | null;

/**
 * Login Redirect Circuit Breaker
 *
 * Prevents infinite redirect loops when BFF login and userinfo endpoints
 * disagree about session validity. Tracks login redirect attempts in
 * sessionStorage and stops redirecting after a threshold within a time window,
 * allowing the service-unavailable view to display instead.
 *
 * The time window ensures stale state auto-resets — if the user returns
 * after the window expires, the counter starts fresh. Only rapid successive
 * redirects (the actual loop) trigger the breaker.
 *
 * sessionStorage is used because it survives page reloads (the redirect)
 * but clears on tab close, so users can always recover by opening a new tab.
 */
/**
 * Record a login redirect attempt.
 * Returns true if the redirect should proceed, false if the circuit breaker has tripped.
 *
 * Attempts are tracked within a time window (default: 2 minutes). If the first
 * attempt was longer ago than the window, the counter resets automatically.
 *
 * Fails open (returns true) if sessionStorage is unavailable (SSR, private browsing quota).
 *
 * @param maxAttempts - Maximum allowed attempts before tripping (default: 3)
 * @param windowMs - Time window in ms for counting attempts (default: 120000)
 */
export declare function recordLoginAttempt(maxAttempts?: number, windowMs?: number): boolean;

/**
 * Reset the login attempt counter.
 * Call on successful authentication.
 */
export declare function resetLoginAttempts(): void;

/**
 * Props passed to a consumer-provided replacement for the default
 * server-error view. Renders a Dismiss action that calls
 * `authStore.clearError()` via the `dismiss` event.
 *
 * Events:
 * - `dismiss` — consumer requests overlay close; `AuthErrorBoundary`
 *   listens and calls `authStore.clearError()`.
 */
export declare interface ServerErrorViewProps {
    error: AuthError;
    config: BffAuthConfig;
}

/**
 * Props passed to a consumer-provided replacement for the default
 * service-unavailable view.
 */
export declare interface ServiceUnavailableViewProps {
    error: AuthError;
    onRetry: () => void | Promise<void>;
    config: BffAuthConfig;
}

/**
 * Props passed to a consumer-provided replacement for the default
 * session-expired view. Stable public API from v2.0.0.
 */
export declare interface SessionExpiredViewProps {
    error: AuthError;
    onSignIn: () => void | Promise<void>;
    config: BffAuthConfig;
}

/* Excluded from this release type: setGlobalConfig */

/**
 * Setup auth navigation guard on router
 *
 * This guard:
 * 1. Initializes auth on first navigation (once per app lifecycle)
 * 2. Allows public routes without auth check
 * 3. Waits for auth loading to complete
 * 4. Redirects unauthenticated users to Central Login (BFF handles return URL)
 *
 * @param router - Vue Router instance
 */
export declare function setupAuthGuard(router: Router): void;

/**
 * Setup auth interceptors on an Axios instance
 *
 * IMPORTANT: Only attach to clients for protected endpoints.
 * For public endpoints, use publicClient (no auth interceptors).
 *
 * Request interceptor:
 * - Calls ensureValidToken() to get/refresh token
 * - Adds Authorization: Bearer {token} header for authenticated users
 *
 * Response interceptor:
 * - Routes `error` (lowercased) through the canonical code→category map
 *   (merged with consumer `errorCodeOverrides` from plugin config).
 * - Synthesizes `{ type: 'service_unavailable', code: 'rate_limit_exceeded' }`
 *   for 429 responses without a code.
 * - Emits `onUnmappedError(code, status, error)` + `console.warn` (dev only)
 *   when the code is non-empty, not in the merged map, and not inline.
 * - Preserves the 401-without-code fallback (`session_expired`) and the
 *   `isAuthConfigured()` guard that suppresses errors when no config is set.
 * - Always propagates the rejection to the caller.
 *
 * @param axiosInstance - Axios instance to configure (should be for protected endpoints only)
 * @param getAuthStore - Function to get auth store (avoids circular deps)
 *
 * @see PAT-004 Error type mapping
 *
 * @example
 * ```typescript
 * import { setupAuthInterceptors } from '@turnkeystaffing/get-native-vue-auth'
 * import { useAuthStore } from '@turnkeystaffing/get-native-vue-auth'
 *
 * // Only attach to protected API client
 * setupAuthInterceptors(apiClient, () => useAuthStore())
 * ```
 */
export declare function setupAuthInterceptors(axiosInstance: AxiosInstance, getAuthStore: () => AuthStoreInterface): void;

/**
 * HTTP-status fallback used when the response body carries no `error_type` /
 * `error` field at all.
 *
 * - `401` → `session_expired` (generic re-login prompt)
 * - `429` → `service_unavailable`
 * - anything else → `null` (no overlay)
 *
 * Note: bare `503` is NOT mapped here — the prior behavior only overlaid 503
 * when `error_type === 'auth_service_unavailable'`. A bare 503 without an auth
 * code is not necessarily an auth error and must not trigger the overlay.
 *
 * @param status - HTTP status code
 * @returns The fallback `AuthErrorType`, or `null` for no overlay
 *
 * @see PAT-004 Error type mapping
 */
export declare function statusFallbackType(status: number | undefined): AuthErrorType | null;

/**
 * Token response from BFF /bff/token endpoint
 */
export declare interface TokenResponse {
    accessToken: string;
    tokenType: string;
    expiresIn: number;
    scope: string;
}

/**
 * 2FA error codes returned by the backend
 *
 * Login-phase (from /api/v1/oauth/login):
 * - `2fa_setup_required` — user needs to complete 2FA setup
 * - `2fa_code_required` — user must provide a TOTP code
 *
 * Setup-phase (from /api/v1/auth/2fa/setup):
 * - `token_expired` — setup token has expired
 * - `token_invalid` — setup token is invalid
 * - `token_used` — setup token was already used
 */
export declare type TwoFactorErrorCode = '2fa_setup_required' | '2fa_code_required' | 'token_expired' | 'token_invalid' | 'token_used';

/**
 * 2FA error response structure
 */
export declare interface TwoFactorErrorResponse {
    detail: string;
}

/**
 * Response from 2FA resend-setup-email endpoint
 */
export declare interface TwoFactorResendResponse {
    message: string;
}

/**
 * Response from 2FA setup endpoint
 */
export declare interface TwoFactorSetupResponse {
    user_id: string;
    /** Base64 data URI (e.g., `data:image/png;base64,...`) */
    qr_code: string;
    secret: string;
    issuer: string;
    account_name: string;
}

/**
 * Response from 2FA verify-setup endpoint
 */
export declare interface TwoFactorVerifyResponse {
    message: string;
    backup_codes: string[];
    user_id: string;
}

/**
 * Callback fired when the interceptor receives a non-empty error code that is
 * neither in `ERROR_CODE_TO_TYPE` / `errorCodeOverrides` nor in
 * `KNOWN_INLINE_CODES`.
 *
 * Consumers can wire this to a telemetry sink to surface backend/frontend map
 * drift. Naked-status errors (no `error_type` on the body) do NOT fire this.
 *
 * @param code - The lowercased unmapped error code (always a non-empty string at call site)
 * @param status - HTTP status code
 * @param error - The original Axios error (unknown; caller may narrow)
 */
export declare type UnmappedErrorHook = (code: string, status: number, error: unknown) => void;

/**
 * Type export for consuming components
 */
export declare type UseAuth = ReturnType<typeof useAuth>;

/**
 * Auth composable for reactive auth state and actions
 *
 * @returns Object with reactive auth state and action methods
 */
export declare function useAuth(): {
    isAuthenticated: ComputedRef<boolean>;
    isLoading: ComputedRef<boolean>;
    user: ComputedRef<UserInfo | null>;
    userEmail: ComputedRef<string | null>;
    error: ComputedRef<AuthError | null>;
    decodedToken: ComputedRef<DecodedAccessToken | null>;
    userRoles: ComputedRef<string[]>;
    userId: ComputedRef<string | null>;
    userGuid: ComputedRef<string | null>;
    username: ComputedRef<string | null>;
    sessionId: ComputedRef<string | null>;
    login: (returnUrl?: string) => void;
    logout: () => Promise<void>;
    clearError: () => void;
    hasRole: (role: string) => boolean;
};

/**
 * Get config in reactive Vue context
 * Use this in composables and components
 *
 * @throws Error if config is not provided (plugin not installed)
 */
export declare function useAuthConfig(): BffAuthConfig;

/**
 * Hook to get auth service instance
 * Useful for dependency injection in tests
 */
export declare function useAuthService(): AuthService;

export declare const useAuthStore: StoreDefinition<"auth", AuthState, {
/**
* Current authenticated user
*/
currentUser: (state: {
isAuthenticated: boolean;
isLoading: boolean;
user: {
user_id: string;
email: string;
session_id: string;
created_at: string;
last_activity: string;
expires_at: string;
} | null;
accessToken: string | null;
tokenExpiresAt: number | null;
error: {
type: AuthErrorType;
message: string;
code?: string | undefined;
} | null;
} & PiniaCustomStateProperties<AuthState>) => {
user_id: string;
email: string;
session_id: string;
created_at: string;
last_activity: string;
expires_at: string;
} | null;
/**
* Check if there's an active error
*/
hasError: (state: {
isAuthenticated: boolean;
isLoading: boolean;
user: {
user_id: string;
email: string;
session_id: string;
created_at: string;
last_activity: string;
expires_at: string;
} | null;
accessToken: string | null;
tokenExpiresAt: number | null;
error: {
type: AuthErrorType;
message: string;
code?: string | undefined;
} | null;
} & PiniaCustomStateProperties<AuthState>) => boolean;
/**
* Decoded JWT access token with all claims.
* Returns null if token is not available or invalid.
*/
decodedToken: (state: {
isAuthenticated: boolean;
isLoading: boolean;
user: {
user_id: string;
email: string;
session_id: string;
created_at: string;
last_activity: string;
expires_at: string;
} | null;
accessToken: string | null;
tokenExpiresAt: number | null;
error: {
type: AuthErrorType;
message: string;
code?: string | undefined;
} | null;
} & PiniaCustomStateProperties<AuthState>) => DecodedAccessToken | null;
/**
* User email extracted from JWT access token.
* Returns null if token is not available or email claim is missing.
*/
userEmail(): string | null;
/**
* User roles from JWT access token.
* Returns empty array if token is not available.
*/
userRoles(): string[];
/**
* User ID from JWT access token.
* Returns null if token is not available.
*/
userId(): string | null;
/**
* User GUID from JWT access token.
* Returns null if token is not available.
*/
userGuid(): string | null;
/**
* Username from JWT access token.
* Returns null if token is not available.
*/
username(): string | null;
/**
* Session ID from JWT access token.
* Returns null if token is not available.
*/
sessionId(): string | null;
}, {
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
hasRole(role: string): boolean;
/**
* Check if token needs refresh (within 60s of expiry)
* ADR-006: 60 second buffer before expiry
*
* NOTE: This is a method, NOT a getter, because Date.now() is not
* a reactive dependency. Using a getter would cache stale results
* and fail to detect token expiry after idle periods.
*/
checkTokenNeedsRefresh(): boolean;
/**
* Initialize auth state on app startup
* Call this in App.vue or main.ts
*/
initAuth(): Promise<void>;
/**
* Ensure we have a valid access token
* ADR-006: Lazy refresh with 60s buffer, single concurrent refresh
*
* @returns Access token string or null if session expired
*/
ensureValidToken(): Promise<string | null>;
/**
* Internal: Refresh the access token
* @private
*/
_refreshToken(): Promise<TokenResponse | null>;
/**
* Initiate login flow - redirects to Central Login
*
* @param returnUrl - URL to return to after authentication
*/
login(returnUrl?: string): void;
/**
* Logout - revoke session and reset state
*/
logout(): Promise<void>;
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
setError(error: AuthError): void;
/**
* Clear current error
*/
clearError(): void;
}>;

/**
 * Auth Type Definitions
 *
 * TypeScript interfaces for authentication operations.
 * These types are used by the auth service client for BFF communication.
 *
 * @see ADR-005 Auth state structure
 * @see PAT-004 Error type mapping
 */
/**
 * User information from BFF /bff/userinfo endpoint
 */
export declare interface UserInfo {
    user_id: string;
    email: string;
    session_id: string;
    created_at: string;
    last_activity: string;
    expires_at: string;
}

export { }


/**
 * TypeScript augmentation for Vue Router RouteMeta
 * Adds the 'public' property for marking routes that don't require auth
 */
declare module 'vue-router' {
    interface RouteMeta {
        /** Mark route as public (no auth required) */
        public?: boolean;
    }
}
