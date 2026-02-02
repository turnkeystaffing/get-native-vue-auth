/**
 * Auth Service Client for BFF endpoints
 *
 * Provides methods for authentication operations:
 * - checkAuth: Verify if user has active session
 * - login: Redirect to Central Login (for Product SPAs)
 * - completeOAuthFlow: Complete OAuth flow after credential submission (for Central Login)
 * - getAccessToken: Get JWT for API calls
 * - logout: End session
 *
 * @see ADR-005 Auth state structure
 * @see PAT-004 Error type mapping
 */

import axios from 'axios'
import type { AxiosError } from 'axios'
import type {
  UserInfo,
  CheckAuthResponse,
  TokenResponse,
  AuthError,
  AuthErrorType,
  BackendAuthError,
  BackendTokenResponse,
  LogoutResponse
} from '../types/auth'
import { createLogger } from '@turnkeystaffing/get-native-vue-logger'
import { getGlobalConfig } from '../config'

/**
 * Logger for auth service operations
 */
const logger = createLogger('AuthService')

/**
 * Error thrown when auth configuration is missing or invalid.
 * This prevents redirect loops when BFF_BASE_URL is not configured.
 */
export class AuthConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthConfigurationError'
  }
}

/**
 * Get BFF base URL from config
 */
function getBffBaseUrl(): string {
  return getGlobalConfig()?.bffBaseUrl || ''
}

/**
 * Get OAuth client ID from config
 */
function getClientId(): string {
  return getGlobalConfig()?.clientId || ''
}

/**
 * Flag indicating if auth is properly configured.
 * When false, auth operations will fail gracefully rather than redirect.
 */
export function isAuthConfigured(): boolean {
  const config = getGlobalConfig()
  return Boolean(config?.bffBaseUrl && config?.clientId)
}

/**
 * Map backend error_type to frontend AuthErrorType
 * PAT-004: Error type mapping
 */
export function mapErrorType(backendType: BackendAuthError['error_type']): AuthErrorType {
  const mapping: Record<BackendAuthError['error_type'], AuthErrorType> = {
    authentication_error: 'session_expired',
    authorization_error: 'permission_denied',
    auth_service_unavailable: 'service_unavailable'
  }
  return mapping[backendType]
}

/**
 * Parse auth error from Axios error response
 */
export function parseAuthError(error: AxiosError<BackendAuthError>): AuthError | null {
  if (!error.response?.data?.error_type) {
    return null
  }

  const backendError = error.response.data
  const authError: AuthError = {
    type: mapErrorType(backendError.error_type),
    message: backendError.detail
  }

  // Only include retryAfter if it has a value
  if (backendError.retry_after !== undefined) {
    authError.retryAfter = backendError.retry_after
  }

  return authError
}

/**
 * Login credentials for BFF authentication
 */
export interface LoginCredentials {
  email: string
  password: string
}

/**
 * Options for initiating the login flow (Product SPAs)
 */
export interface LoginOptions {
  /** URL to return to after authentication (defaults to current URL) */
  returnUrl?: string
}

/**
 * Options for completing the OAuth flow (Central Login only)
 * Both parameters are required since Central Login must pass through
 * the client_id and redirect_url from the originating SPA.
 */
export interface CompleteOAuthFlowOptions {
  /** OAuth client ID from the originating SPA (required) */
  clientId: string
  /** URL to return to after authentication - the originating SPA's URL (required) */
  returnUrl: string
}

/**
 * Auth Service Client for BFF endpoints
 */
class AuthService {
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
  async submitCredentials(email: string, password: string): Promise<void> {
    try {
      await axios.post(
        `${getBffBaseUrl()}/api/v1/oauth/login`,
        { email, password },
        { withCredentials: true } // Include cookies for session handling
      )
      logger.info('Credentials submitted successfully')
    } catch (error) {
      logger.error('Failed to submit credentials', error)
      throw error
    }
  }

  /**
   * Check if user is authenticated by calling /bff/userinfo
   * This should be called on app load to determine auth state
   *
   * @returns CheckAuthResponse with user info if authenticated
   * @throws AuthConfigurationError if auth is not configured
   */
  async checkAuth(): Promise<CheckAuthResponse> {
    // GUARD: Don't attempt HTTP request if auth is not configured
    if (!isAuthConfigured()) {
      throw new AuthConfigurationError(
        'Authentication service is not configured. Please contact your administrator.'
      )
    }

    try {
      const response = await axios.get<UserInfo>(`${getBffBaseUrl()}/bff/userinfo`, {
        withCredentials: true // Include bff_session cookie
      })

      return {
        isAuthenticated: true,
        user: response.data
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        // Not authenticated - expected case
        return {
          isAuthenticated: false,
          user: null
        }
      }
      // Unexpected error - rethrow
      throw error
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
  login(options?: LoginOptions): void {
    const opts = options || {}

    // GUARD: Prevent redirect loop when auth is not configured
    if (!isAuthConfigured()) {
      logger.error('Cannot initiate login: Auth configuration is incomplete')
      throw new AuthConfigurationError(
        'Authentication service is not configured. Please contact your administrator.'
      )
    }

    const target = opts.returnUrl || window.location.href
    let urlObj: URL

    try {
      // URL constructor handles both absolute and relative URLs:
      // - "/dashboard" -> "https://origin/dashboard"
      // - "https://example.com/page" -> "https://example.com/page" (base ignored)
      urlObj = new URL(target, window.location.origin)
    } catch {
      // Fallback if the input is malformed
      logger.warn('Malformed returnUrl, falling back to current page:', target)
      urlObj = new URL(window.location.href)
    }

    // SECURITY: Prevent Open Redirect attacks
    // Only allow redirects to the same origin
    if (urlObj.origin !== window.location.origin) {
      logger.warn('Blocked external redirect attempt:', target)
      urlObj = new URL('/', window.location.origin)
    }

    const absoluteRedirectUrl = urlObj.href

    // Build login URL with query parameters
    const loginPath = `${getBffBaseUrl()}/bff/login`
    const params = new URLSearchParams({
      client_id: getClientId(),
      redirect_url: absoluteRedirectUrl
    })

    logger.debug('Initiating login redirect', { returnUrl: absoluteRedirectUrl })

    // Full page redirect to BFF login
    window.location.href = `${loginPath}?${params.toString()}`
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
  completeOAuthFlow(options: CompleteOAuthFlowOptions): void {
    const { clientId, returnUrl } = options

    if (!clientId || !returnUrl) {
      throw new Error('completeOAuthFlow requires both clientId and returnUrl')
    }

    // Build login URL with query parameters
    // Note: We skip same-origin validation here because Central Login
    // must redirect to external origins (the Product SPAs).
    // The BFF validates redirect_url against registered client URIs.
    const loginPath = `${getBffBaseUrl()}/bff/login`
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_url: returnUrl
    })

    logger.debug('Completing OAuth flow', { clientId, returnUrl })

    // Full page redirect to BFF login (with oauth_session cookie set)
    window.location.href = `${loginPath}?${params.toString()}`
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
  async getAccessToken(): Promise<TokenResponse | null> {
    // GUARD: Don't attempt HTTP request if auth is not configured
    if (!isAuthConfigured()) {
      throw new AuthConfigurationError(
        'Authentication service is not configured. Please contact your administrator.'
      )
    }

    try {
      const response = await axios.post<BackendTokenResponse>(
        `${getBffBaseUrl()}/bff/token`,
        { client_id: getClientId() },
        { withCredentials: true }
      )

      // Map snake_case response to camelCase
      return {
        accessToken: response.data.access_token,
        tokenType: response.data.token_type,
        expiresIn: response.data.expires_in,
        scope: response.data.scope
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        // Session expired
        return null
      }
      throw error
    }
  }

  /**
   * Logout - revokes session and clears cookies
   *
   * @returns Success indicator, or throws AuthError on failure
   */
  async logout(): Promise<LogoutResponse> {
    try {
      await axios.post(
        `${getBffBaseUrl()}/bff/logout`,
        {},
        {
          withCredentials: true
        }
      )
      return { success: true }
    } catch (error) {
      // Parse structured auth error if available
      if (axios.isAxiosError(error)) {
        const authError = parseAuthError(error as AxiosError<BackendAuthError>)
        if (authError) {
          throw authError
        }
      }
      // Rethrow unknown errors
      throw error
    }
  }
}

// Export singleton instance
export const authService = new AuthService()

// Also export class for testing
export { AuthService }

/**
 * Hook to get auth service instance
 * Useful for dependency injection in tests
 */
export function useAuthService(): AuthService {
  return authService
}
