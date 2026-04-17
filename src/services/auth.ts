/**
 * Auth Service Client for BFF endpoints
 *
 * Provides methods for authentication operations:
 * - checkAuth: Verify if user has active session
 * - login: Redirect to Central Login (for Product SPAs)
 * - loginWithCustomClient: Cross-origin redirect with custom OAuth client (for Central Login session-reuse)
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
  LogoutResponse,
  TwoFactorSetupResponse,
  TwoFactorVerifyResponse,
  TwoFactorResendResponse
} from '../types/auth'
import { createLogger } from '@turnkeystaffing/get-native-vue-logger'
import { getGlobalConfig } from '../config'
import { mapErrorCodeToType } from './errorCodeMap'

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
export function parseAuthError(
  error: AxiosError<BackendAuthError>,
  overrides?: Record<string, AuthErrorType | null>
): AuthError | null {
  const response = error.response
  if (!response) return null

  const body = response.data ?? ({} as BackendAuthError)
  const rawCode = body.error
  const code = typeof rawCode === 'string' && rawCode.length > 0 ? rawCode.toLowerCase() : null

  // Only resolve when a code is present. Status-level fallbacks are the
  // interceptor's responsibility.
  if (!code) return null

  const type: AuthErrorType | null = mapErrorCodeToType(code, overrides)
  if (type === null) return null

  const message = body.error_description || rawCode || ''

  return { type, message, code }
}

/**
 * Login credentials for BFF authentication
 */
export interface LoginCredentials {
  email: string
  password: string
  totp_code?: string
}

/**
 * Options for initiating the login flow (Product SPAs)
 */
export interface LoginOptions {
  /** URL to return to after authentication (defaults to current URL) */
  returnUrl?: string
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
export interface LoginWithCustomClientOptions {
  /** OAuth client ID from the originating Product SPA (required, must be non-empty) */
  clientId: string
  /** URL to return to after authentication — may be cross-origin (required, must be http/https) */
  returnUrl: string
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
   * @param totpCode - Optional TOTP code for 2FA authentication
   * @returns Promise that resolves on success, rejects on error
   * @throws AxiosError with status 401 for invalid credentials
   * @throws AxiosError with status 401 with detail '2fa_setup_required' when 2FA setup is needed
   * @throws AxiosError with status 401 with detail '2fa_code_required' when TOTP code is needed
   * @throws AxiosError with status 503 for service unavailable
   */
  async submitCredentials(email: string, password: string, totpCode?: string): Promise<void> {
    try {
      const payload: Record<string, string> = { email, password }
      if (totpCode !== undefined) {
        payload.totp_code = totpCode
      }
      await axios.post(
        `${getBffBaseUrl()}/api/v1/oauth/login`,
        payload,
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
   * For cross-origin redirects with a custom client ID, use {@link loginWithCustomClient}.
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
  loginWithCustomClient(options: LoginWithCustomClientOptions): void {
    const { clientId, returnUrl } = options

    const trimmedClientId = clientId.trim()
    if (!trimmedClientId) {
      throw new Error('clientId must not be empty')
    }

    let returnUrlObj: URL
    try {
      returnUrlObj = new URL(returnUrl)
    } catch {
      throw new Error('returnUrl is not a valid URL')
    }

    if (returnUrlObj.protocol !== 'http:' && returnUrlObj.protocol !== 'https:') {
      throw new Error('returnUrl must use http or https scheme')
    }

    const bffBaseUrl = getBffBaseUrl()
    if (!bffBaseUrl) {
      throw new AuthConfigurationError('BFF base URL is not configured.')
    }

    const loginPath = `${bffBaseUrl}/bff/login`
    const params = new URLSearchParams({
      client_id: trimmedClientId,
      redirect_url: returnUrl
    })

    logger.debug('Initiating custom client login redirect', { clientId: trimmedClientId, returnUrl })

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
    // GUARD: Token operations are not available in cookie mode
    if (getGlobalConfig()?.mode === 'cookie') {
      throw new AuthConfigurationError(
        'getAccessToken() is not available in cookie mode. Token management is handled by the BFF proxy via cookies.'
      )
    }

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
  async setup2FA(token: string): Promise<TwoFactorSetupResponse> {
    try {
      const response = await axios.post<TwoFactorSetupResponse>(
        `${getBffBaseUrl()}/api/v1/auth/2fa/setup`,
        { token },
        { withCredentials: true }
      )
      logger.info('2FA setup initiated successfully')
      return response.data
    } catch (error) {
      logger.error('Failed to initiate 2FA setup', error)
      throw error
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
  async verify2FASetup(token: string, totpCode: string): Promise<TwoFactorVerifyResponse> {
    try {
      const response = await axios.post<TwoFactorVerifyResponse>(
        `${getBffBaseUrl()}/api/v1/auth/2fa/verify-setup`,
        { token, totp_code: totpCode },
        { withCredentials: true }
      )
      logger.info('2FA setup verified successfully')
      return response.data
    } catch (error) {
      logger.error('Failed to verify 2FA setup', error)
      throw error
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
  async resend2FASetupEmail(email: string, password: string): Promise<TwoFactorResendResponse> {
    try {
      const response = await axios.post<TwoFactorResendResponse>(
        `${getBffBaseUrl()}/api/v1/auth/2fa/resend-setup-email`,
        { email, password },
        { withCredentials: true }
      )
      logger.info('2FA setup email resent successfully')
      return response.data
    } catch (error) {
      logger.error('Failed to resend 2FA setup email', error)
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
