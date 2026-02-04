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
export interface UserInfo {
  user_id: string
  session_id: string
  created_at: string
  last_activity: string
  expires_at: string
}

/**
 * Response from checkAuth() method
 */
export interface CheckAuthResponse {
  isAuthenticated: boolean
  user: UserInfo | null
}

/**
 * Token response from BFF /bff/token endpoint
 */
export interface TokenResponse {
  accessToken: string
  tokenType: string
  expiresIn: number
  scope: string
}

/**
 * Auth error types mapped from backend error_type
 * PAT-004: Error type mapping
 *
 * - session_expired: 401 - authentication_error
 * - permission_denied: 403 - authorization_error
 * - service_unavailable: 503 - auth_service_unavailable
 */
export type AuthErrorType = 'session_expired' | 'permission_denied' | 'service_unavailable'

/**
 * Auth error structure for frontend error handling
 */
export interface AuthError {
  type: AuthErrorType
  message: string
  retryAfter?: number // For service_unavailable errors
}

/**
 * Backend error response structure (ADR-003)
 */
export interface BackendAuthError {
  detail: string
  error_type: 'authentication_error' | 'authorization_error' | 'auth_service_unavailable'
  required_scope?: string // For authorization_error
  retry_after?: number // For auth_service_unavailable
}

/**
 * Backend token response structure (snake_case from BFF)
 * Maps to frontend TokenResponse (camelCase)
 */
export interface BackendTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  scope: string
}

/**
 * Logout response
 */
export interface LogoutResponse {
  success: boolean
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
export type TwoFactorErrorCode =
  | '2fa_setup_required'
  | '2fa_code_required'
  | 'token_expired'
  | 'token_invalid'
  | 'token_used'

/**
 * Response from 2FA setup endpoint
 */
export interface TwoFactorSetupResponse {
  user_id: string
  /** Base64 data URI (e.g., `data:image/png;base64,...`) */
  qr_code: string
  secret: string
  issuer: string
  account_name: string
}

/**
 * Response from 2FA verify-setup endpoint
 */
export interface TwoFactorVerifyResponse {
  message: string
  backup_codes: string[]
  user_id: string
}

/**
 * Response from 2FA resend-setup-email endpoint
 */
export interface TwoFactorResendResponse {
  message: string
}

/**
 * 2FA error response structure
 */
export interface TwoFactorErrorResponse {
  detail: string
}

/**
 * Decoded JWT access token claims from our auth provider.
 * Contains user identity, roles, and standard JWT claims.
 */
export interface DecodedAccessToken {
  username: string
  email: string
  roles: string[]
  guid: string
  user_id: string
  session_id: string
  client_id: string
  iss: string
  sub: string
  aud: string[]
  exp: number
  nbf: number
  iat: number
  jti: string
}
