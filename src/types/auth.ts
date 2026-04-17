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
  email: string
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
export type AuthErrorType =
  | 'session_expired'
  | 'service_unavailable'
  | 'dev_error'
  | 'account_blocked'
  | 'server_error'

/**
 * Auth error structure for frontend error handling.
 *
 * View behavior is driven entirely by `type` (recovery category) and `code`
 * (lowercased backend code, e.g., `insufficient_permissions`, `reauth_required`).
 * No auxiliary data is carried on the error; views render from code alone.
 *
 * @see PAT-004 Error type mapping
 */
export interface AuthError {
  type: AuthErrorType
  message: string
  /** Lowercased backend error code (e.g., `reauth_required`, `account_inactive`) */
  code?: string
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
export interface BackendAuthError {
  /** Error code (any casing) — lowercased before routing through the code→category map */
  error?: string
  /** Human-readable description; used as `AuthError.message` */
  error_description?: string
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
