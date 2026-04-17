/**
 * errorCodeMap unit tests
 *
 * Verifies:
 * - Every code in `ERROR_CODE_TO_TYPE` maps to the expected category
 * - Every code in `KNOWN_INLINE_CODES` resolves to `null` via `mapErrorCodeToType`
 * - `mapErrorCodeToType` lowercases input, honors overrides, returns `null` for unknown
 * - `statusFallbackType` returns expected fallbacks
 */

import { describe, it, expect } from 'vitest'
import {
  ERROR_CODE_TO_TYPE,
  KNOWN_INLINE_CODES,
  mapErrorCodeToType,
  statusFallbackType
} from '../errorCodeMap'
import type { AuthErrorType } from '../../types/auth'

describe('ERROR_CODE_TO_TYPE', () => {
  const tableTests: Array<[string, AuthErrorType]> = [
    ['invalid_grant', 'session_expired'],
    ['missing_token', 'session_expired'],
    ['invalid_token', 'session_expired'],
    ['invalid_user_id', 'session_expired'],
    ['user_not_found', 'session_expired'],
    ['missing_refresh_token', 'session_expired'],
    ['invalid_refresh_token', 'session_expired'],
    ['reauth_required', 'session_expired'],
    ['session_compromised', 'session_expired'],
    ['forbidden', 'session_expired'],
    ['invalid_session', 'session_expired'],
    ['authentication_error', 'session_expired'],

    ['temporarily_unavailable', 'service_unavailable'],
    ['service_unavailable', 'service_unavailable'],
    ['auth_service_unavailable', 'service_unavailable'],
    ['logout_failed', 'service_unavailable'],
    ['sessions_fetch_failed', 'service_unavailable'],
    ['revoke_failed', 'service_unavailable'],
    ['password_change_error', 'service_unavailable'],
    ['resend_email_failed', 'service_unavailable'],
    ['resend_email_error', 'service_unavailable'],
    ['2fa_setup_error', 'service_unavailable'],
    ['2fa_verify_error', 'service_unavailable'],
    ['rate_limit_exceeded', 'service_unavailable'],

    ['invalid_client', 'dev_error'],
    ['unauthorized_client', 'dev_error'],
    ['unsupported_response_type', 'dev_error'],
    ['unsupported_grant_type', 'dev_error'],
    ['invalid_scope', 'dev_error'],
    ['invalid_redirect_uri', 'dev_error'],
    ['client_inactive', 'dev_error'],
    ['cors_error', 'dev_error'],

    ['account_inactive', 'account_blocked'],
    ['insufficient_permissions', 'account_blocked'],

    ['server_error', 'server_error'],
    ['internal_error', 'server_error'],
    ['not_implemented', 'server_error'],
    ['unknown_host', 'server_error']
  ]

  for (const [code, expected] of tableTests) {
    it(`${code} → ${expected}`, () => {
      expect(ERROR_CODE_TO_TYPE[code]).toBe(expected)
      expect(mapErrorCodeToType(code)).toBe(expected)
    })
  }

  it('is frozen / read-only', () => {
    expect(Object.isFrozen(ERROR_CODE_TO_TYPE)).toBe(true)
  })
})

describe('KNOWN_INLINE_CODES', () => {
  const expected = [
    'missing_current_password',
    'missing_new_password',
    'missing_password',
    'invalid_current_password',
    'weak_password',
    'missing_totp_code',
    'invalid_totp_code',
    'missing_setup_token',
    'invalid_setup_token',
    'no_provisional_secret',
    '2fa_already_enabled',
    'invalid_totp',
    'invalid_credentials',
    'email_not_found',
    'email_exists',
    'email_not_verified',
    'email_already_verified',
    'cannot_remove_primary',
    'cannot_remove_last',
    'cannot_set_primary_unverified',
    'invalid_password',
    'invalid_email',
    'validation_failed',
    'max_emails_exceeded',
    'payload_too_large',
    'missing_session_id',
    'invalid_session_id',
    'session_not_found',
    'invalid_request',
    'access_denied'
  ]

  for (const code of expected) {
    it(`contains ${code}`, () => {
      expect(KNOWN_INLINE_CODES.has(code)).toBe(true)
    })
    it(`${code} resolves to null via mapErrorCodeToType`, () => {
      expect(mapErrorCodeToType(code)).toBeNull()
    })
  }
})

describe('mapErrorCodeToType', () => {
  it('lowercases input', () => {
    expect(mapErrorCodeToType('REAUTH_REQUIRED')).toBe('session_expired')
    expect(mapErrorCodeToType('Account_Inactive')).toBe('account_blocked')
  })

  it('returns null for null / undefined / empty', () => {
    expect(mapErrorCodeToType(null)).toBeNull()
    expect(mapErrorCodeToType(undefined)).toBeNull()
    expect(mapErrorCodeToType('')).toBeNull()
  })

  it('returns null for completely unknown codes', () => {
    expect(mapErrorCodeToType('never_heard_of_this')).toBeNull()
  })

  it('applies overrides over the canonical map', () => {
    expect(
      mapErrorCodeToType('invalid_grant', { invalid_grant: 'server_error' })
    ).toBe('server_error')
  })

  it('treats override-null as inline (returns null)', () => {
    expect(
      mapErrorCodeToType('my_custom_code', { my_custom_code: null })
    ).toBeNull()
  })

  it('override takes precedence over KNOWN_INLINE_CODES', () => {
    // Forcing a known-inline code to a category via overrides should work.
    expect(
      mapErrorCodeToType('weak_password', { weak_password: 'dev_error' })
    ).toBe('dev_error')
  })

  it('overrides keyed on lowercase; input can be any casing', () => {
    expect(
      mapErrorCodeToType('MY_CUSTOM_CODE', { my_custom_code: 'account_blocked' })
    ).toBe('account_blocked')
  })
})

describe('statusFallbackType', () => {
  it('401 → session_expired', () => {
    expect(statusFallbackType(401)).toBe('session_expired')
  })

  it('429 → service_unavailable', () => {
    expect(statusFallbackType(429)).toBe('service_unavailable')
  })

  it('bare 503 → null (do not overlay bare 503)', () => {
    expect(statusFallbackType(503)).toBeNull()
  })

  it('403 → null (no permission_denied fallback)', () => {
    expect(statusFallbackType(403)).toBeNull()
  })

  it('500 → null', () => {
    expect(statusFallbackType(500)).toBeNull()
  })

  it('undefined status → null', () => {
    expect(statusFallbackType(undefined)).toBeNull()
  })
})
