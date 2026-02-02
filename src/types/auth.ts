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
