import { AxiosError } from 'axios';
import { AxiosInstance } from 'axios';
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
 * Error thrown when auth configuration is missing or invalid.
 * This prevents redirect loops when BFF_BASE_URL is not configured.
 */
export declare class AuthConfigurationError extends Error {
    constructor(message: string);
}

/**
 * Auth error structure for frontend error handling
 */
export declare interface AuthError {
    type: AuthErrorType;
    message: string;
    retryAfter?: number;
}

/**
 * Auth error types mapped from backend error_type
 * PAT-004: Error type mapping
 *
 * - session_expired: 401 - authentication_error
 * - permission_denied: 403 - authorization_error
 * - service_unavailable: 503 - auth_service_unavailable
 */
export declare type AuthErrorType = 'session_expired' | 'permission_denied' | 'service_unavailable';

/**
 * Auth guard dependencies for dependency injection
 */
export declare interface AuthGuardDependencies {
    getAuthStore: () => ReturnType<typeof useAuthStore>;
    getAuthService: () => typeof authService;
}

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
     * @returns Promise that resolves on success, rejects on error
     * @throws AxiosError with status 401 for invalid credentials
     * @throws AxiosError with status 503 for service unavailable
     */
    submitCredentials(email: string, password: string): Promise<void>;
    /**
     * Check if user is authenticated by calling /bff/userinfo
     * This should be called on app load to determine auth state
     *
     * @returns CheckAuthResponse with user info if authenticated
     * @throws AuthConfigurationError if auth is not configured
     */
    checkAuth(): Promise<CheckAuthResponse>;
    /**
     * Initiate login flow by redirecting to BFF login endpoint
     * This performs a full page redirect to Central Login
     *
     * @param returnUrl - URL or path to return to after authentication (defaults to current URL)
     *                    Can be a full URL (http://...) or a relative path (/dashboard)
     *                    External URLs are blocked for security (Open Redirect prevention)
     */
    initiateLogin(returnUrl?: string): void;
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
 * Backend error response structure (ADR-003)
 */
export declare interface BackendAuthError {
    detail: string;
    error_type: 'authentication_error' | 'authorization_error' | 'auth_service_unavailable';
    required_scope?: string;
    retry_after?: number;
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
    /** OAuth client ID for token endpoint */
    tokenClientId: string;
    /** Logger instance */
    logger: Logger;
}

/**
 * BFF Auth Vue Plugin
 *
 * Installs authentication functionality into a Vue application.
 * Provides configuration via Vue's dependency injection system.
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
    /** OAuth client ID for token endpoint - optional, defaults to clientId */
    tokenClientId?: string;
    /** Custom logger instance - optional, uses default logger if not provided */
    logger?: Logger;
}

/**
 * Response from checkAuth() method
 */
export declare interface CheckAuthResponse {
    isAuthenticated: boolean;
    user: UserInfo | null;
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
 * JWT Utility Functions
 *
 * Provides safe JWT decoding for extracting claims from access tokens.
 * Note: This only decodes tokens - signature verification is done server-side.
 *
 * @see Story 2.6: User Menu & Logout UI
 */
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
 * Login credentials for BFF authentication
 */
export declare interface LoginCredentials {
    email: string;
    password: string;
}

/**
 * Logout response
 */
export declare interface LogoutResponse {
    success: boolean;
}

/**
 * Map backend error_type to frontend AuthErrorType
 * PAT-004: Error type mapping
 */
export declare function mapErrorType(backendType: BackendAuthError['error_type']): AuthErrorType;

/**
 * Parse auth error from Axios error response
 */
export declare function parseAuthError(error: AxiosError<BackendAuthError>): AuthError | null;

export declare const PermissionDeniedToast: DefineComponent<    {}, {}, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, {}, string, PublicProps, Readonly<{}> & Readonly<{}>, {}, {}, {}, {}, string, ComponentProvideOptions, true, {}, any>;

export declare const ServiceUnavailableOverlay: DefineComponent<    {}, {}, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, {}, string, PublicProps, Readonly<{}> & Readonly<{}>, {}, {}, {}, {}, string, ComponentProvideOptions, true, {}, any>;

export declare const SessionExpiredModal: DefineComponent<    {}, {}, {}, {}, {}, ComponentOptionsMixin, ComponentOptionsMixin, {}, string, PublicProps, Readonly<{}> & Readonly<{}>, {}, {}, {}, {}, string, ComponentProvideOptions, true, {}, any>;

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
 * - Parses structured auth errors using parseAuthError()
 * - Sets auth store error state for 401 (session_expired)
 * - Sets auth store error state for 403 (permission_denied)
 * - Sets auth store error state for 503 with auth_service_unavailable
 * - Always propagates error to caller
 *
 * @param axiosInstance - Axios instance to configure (should be for protected endpoints only)
 * @param getAuthStore - Function to get auth store (avoids circular deps)
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
 * Token response from BFF /bff/token endpoint
 */
export declare interface TokenResponse {
    accessToken: string;
    tokenType: string;
    expiresIn: number;
    scope: string;
}

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
    login: (returnUrl?: string) => void;
    logout: () => Promise<void>;
    clearError: () => void;
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
retryAfter?: number | undefined;
} | null;
} & PiniaCustomStateProperties<AuthState>) => {
user_id: string;
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
retryAfter?: number | undefined;
} | null;
} & PiniaCustomStateProperties<AuthState>) => boolean;
/**
* User email extracted from JWT access token.
* Returns null if token is not available or email claim is missing.
*/
userEmail: (state: {
isAuthenticated: boolean;
isLoading: boolean;
user: {
user_id: string;
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
retryAfter?: number | undefined;
} | null;
} & PiniaCustomStateProperties<AuthState>) => string | null;
}, {
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
* Set auth error state
* Also sets isAuthenticated to false for session_expired
*
* @param error - Auth error object
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
