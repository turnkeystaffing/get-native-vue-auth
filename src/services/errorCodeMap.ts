/**
 * Error code → AuthErrorType map.
 *
 * Canonical routing table for lowercased backend error codes.
 *
 * - `ERROR_CODE_TO_TYPE`: single source of truth for backend code → recovery category.
 * - `KNOWN_INLINE_CODES`: codes that callers render inline (form-level); the
 *   interceptor stays quiet (no `setError`, no `onUnmappedError`).
 * - `mapErrorCodeToType(code, overrides?)`: lowercases input and returns the
 *   matching `AuthErrorType`, or `null` if the code is inline, unknown, or
 *   explicitly marked `null` via `overrides`.
 * - `statusFallbackType(status)`: bare HTTP-status fallback used when no
 *   `error_type` / `error` is present on the response body.
 *
 * Keys in the table are all lowercase. Callers MUST lowercase inputs before
 * consulting the table (handled by `mapErrorCodeToType`).
 *
 * @see PAT-004 Error type mapping
 * @see docs/auth-error-codes.md
 * @see docs/error-handling-analysis.md
 */

import type { AuthErrorType } from '../types/auth'

/**
 * Canonical lowercase backend-code → recovery-category table.
 *
 * Freezing ensures consumers cannot mutate the table in place; use
 * `mapErrorCodeToType(code, overrides)` to extend per-call.
 */
export const ERROR_CODE_TO_TYPE: Readonly<Record<string, AuthErrorType>> = Object.freeze({
  // ── session_expired — re-login fixes it ────────────────────────────────
  invalid_grant: 'session_expired',
  missing_token: 'session_expired',
  invalid_token: 'session_expired',
  invalid_user_id: 'session_expired',
  user_not_found: 'session_expired',
  missing_refresh_token: 'session_expired',
  invalid_refresh_token: 'session_expired',
  reauth_required: 'session_expired',
  session_compromised: 'session_expired',
  forbidden: 'session_expired',
  invalid_session: 'session_expired',
  authentication_error: 'session_expired',

  // ── service_unavailable — wait and retry ───────────────────────────────
  temporarily_unavailable: 'service_unavailable',
  service_unavailable: 'service_unavailable',
  auth_service_unavailable: 'service_unavailable',
  logout_failed: 'service_unavailable',
  sessions_fetch_failed: 'service_unavailable',
  revoke_failed: 'service_unavailable',
  password_change_error: 'service_unavailable',
  resend_email_failed: 'service_unavailable',
  resend_email_error: 'service_unavailable',
  '2fa_setup_error': 'service_unavailable',
  '2fa_verify_error': 'service_unavailable',
  rate_limit_exceeded: 'service_unavailable',

  // ── dev_error — OAuth / client misconfiguration ────────────────────────
  invalid_client: 'dev_error',
  unauthorized_client: 'dev_error',
  unsupported_response_type: 'dev_error',
  unsupported_grant_type: 'dev_error',
  invalid_scope: 'dev_error',
  invalid_redirect_uri: 'dev_error',
  client_inactive: 'dev_error',
  cors_error: 'dev_error',

  // ── account_blocked — user terminal (contact admin / sign out) ────────
  account_inactive: 'account_blocked',
  insufficient_permissions: 'account_blocked',

  // ── server_error — infra/admin terminal (request_id) ──────────────────
  server_error: 'server_error',
  internal_error: 'server_error',
  not_implemented: 'server_error',
  unknown_host: 'server_error'
})

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
export const KNOWN_INLINE_CODES: ReadonlySet<string> = new Set<string>([
  // Passwords
  'missing_current_password',
  'missing_new_password',
  'missing_password',
  'invalid_current_password',
  'weak_password',
  'invalid_password',

  // 2FA / TOTP
  'missing_totp_code',
  'invalid_totp_code',
  'missing_setup_token',
  'invalid_setup_token',
  'no_provisional_secret',
  '2fa_already_enabled',
  'invalid_totp',

  // Login-form
  'invalid_credentials',

  // Email management
  'email_not_found',
  'email_exists',
  'email_not_verified',
  'email_already_verified',
  'cannot_remove_primary',
  'cannot_remove_last',
  'cannot_set_primary_unverified',
  'invalid_email',
  'validation_failed',
  'max_emails_exceeded',

  // Security middleware
  'payload_too_large',

  // Session management UI
  'missing_session_id',
  'invalid_session_id',
  'session_not_found',

  // OAuth user-input / consent
  'invalid_request',
  'access_denied'
])

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
export function mapErrorCodeToType(
  code: string | null | undefined,
  overrides?: Record<string, AuthErrorType | null>
): AuthErrorType | null {
  if (!code) return null
  const lower = code.toLowerCase()

  if (overrides && Object.prototype.hasOwnProperty.call(overrides, lower)) {
    // Explicit override — honor even when value is null (marks as inline/silent)
    return overrides[lower] ?? null
  }

  if (KNOWN_INLINE_CODES.has(lower)) {
    return null
  }

  return ERROR_CODE_TO_TYPE[lower] ?? null
}

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
export function statusFallbackType(status: number | undefined): AuthErrorType | null {
  if (status === 401) return 'session_expired'
  if (status === 429) return 'service_unavailable'
  return null
}
