/**
 * JWT Utility Unit Tests
 *
 * Tests for JWT decoding and email extraction functions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { decodeJwt, extractEmailFromJwt, decodeAccessToken } from '../jwt'

// Mock the logger
vi.mock('@turnkeystaffing/get-native-vue-logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

/**
 * Helper to create a valid JWT token with given payload.
 * Note: This creates a token for testing decode only - signature is not verified.
 */
function createTestToken(payload: Record<string, unknown>): string {
  const header = { alg: 'HS256', typ: 'JWT' }
  const headerBase64 = btoa(JSON.stringify(header))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  const payloadBase64 = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `${headerBase64}.${payloadBase64}.fake-signature`
}

describe('JWT Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('decodeJwt', () => {
    it('returns null for null input', () => {
      expect(decodeJwt(null)).toBeNull()
    })

    it('returns null for undefined input', () => {
      expect(decodeJwt(undefined)).toBeNull()
    })

    it('returns null for empty string', () => {
      expect(decodeJwt('')).toBeNull()
    })

    it('returns null for invalid JWT format', () => {
      expect(decodeJwt('not-a-jwt')).toBeNull()
    })

    it('returns null for malformed base64', () => {
      expect(decodeJwt('xxx.yyy.zzz')).toBeNull()
    })

    it('decodes valid JWT with email claim', () => {
      const token = createTestToken({
        sub: 'user123',
        email: 'test@example.com',
        exp: 9999999999
      })

      const payload = decodeJwt(token)

      expect(payload).not.toBeNull()
      expect(payload?.sub).toBe('user123')
      expect(payload?.email).toBe('test@example.com')
      expect(payload?.exp).toBe(9999999999)
    })

    it('decodes valid JWT without email claim', () => {
      const token = createTestToken({
        sub: 'user456',
        exp: 9999999999
      })

      const payload = decodeJwt(token)

      expect(payload).not.toBeNull()
      expect(payload?.sub).toBe('user456')
      expect(payload?.email).toBeUndefined()
    })

    it('decodes JWT with additional claims', () => {
      const token = createTestToken({
        sub: 'user789',
        email: 'user@company.com',
        iss: 'https://auth.example.com',
        aud: 'my-client-id',
        custom_claim: 'custom_value'
      })

      const payload = decodeJwt(token)

      expect(payload).not.toBeNull()
      expect(payload?.iss).toBe('https://auth.example.com')
      expect(payload?.aud).toBe('my-client-id')
      expect(payload?.custom_claim).toBe('custom_value')
    })
  })

  describe('extractEmailFromJwt', () => {
    it('returns null for null token', () => {
      expect(extractEmailFromJwt(null)).toBeNull()
    })

    it('returns null for undefined token', () => {
      expect(extractEmailFromJwt(undefined)).toBeNull()
    })

    it('returns null for empty string', () => {
      expect(extractEmailFromJwt('')).toBeNull()
    })

    it('returns null for invalid token', () => {
      expect(extractEmailFromJwt('invalid-token')).toBeNull()
    })

    it('returns email from valid token', () => {
      const token = createTestToken({
        sub: 'user123',
        email: 'test@example.com'
      })

      expect(extractEmailFromJwt(token)).toBe('test@example.com')
    })

    it('returns null when email claim is missing', () => {
      const token = createTestToken({
        sub: 'user456'
      })

      expect(extractEmailFromJwt(token)).toBeNull()
    })

    it('returns null when email claim is not a string', () => {
      const token = createTestToken({
        sub: 'user789',
        email: 12345 // Not a string
      })

      expect(extractEmailFromJwt(token)).toBeNull()
    })

    it('returns null when email claim is empty string', () => {
      const token = createTestToken({
        sub: 'user000',
        email: ''
      })

      // Empty string is falsy, so it returns null
      expect(extractEmailFromJwt(token)).toBeNull()
    })

    it('handles various email formats', () => {
      const emails = [
        'simple@example.com',
        'user.name@domain.org',
        'user+tag@company.co.uk',
        'admin@localhost'
      ]

      for (const email of emails) {
        const token = createTestToken({ email })
        expect(extractEmailFromJwt(token)).toBe(email)
      }
    })
  })

  describe('decodeAccessToken', () => {
    it('returns null for null input', () => {
      expect(decodeAccessToken(null)).toBeNull()
    })

    it('returns null for undefined input', () => {
      expect(decodeAccessToken(undefined)).toBeNull()
    })

    it('returns null for empty string', () => {
      expect(decodeAccessToken('')).toBeNull()
    })

    it('returns null for invalid JWT format', () => {
      expect(decodeAccessToken('not-a-jwt')).toBeNull()
    })

    it('returns null when email field is missing', () => {
      const token = createTestToken({
        user_id: 'user123',
        roles: ['ROLE_USER']
      })
      expect(decodeAccessToken(token)).toBeNull()
    })

    it('returns null when user_id field is missing', () => {
      const token = createTestToken({
        email: 'test@example.com',
        roles: ['ROLE_USER']
      })
      expect(decodeAccessToken(token)).toBeNull()
    })

    it('returns null when roles field is missing', () => {
      const token = createTestToken({
        email: 'test@example.com',
        user_id: 'user123'
      })
      expect(decodeAccessToken(token)).toBeNull()
    })

    it('returns null when email is not a string', () => {
      const token = createTestToken({
        email: 12345,
        user_id: 'user123',
        roles: ['ROLE_USER']
      })
      expect(decodeAccessToken(token)).toBeNull()
    })

    it('returns null when roles is not an array', () => {
      const token = createTestToken({
        email: 'test@example.com',
        user_id: 'user123',
        roles: 'ROLE_USER'
      })
      expect(decodeAccessToken(token)).toBeNull()
    })

    it('returns DecodedAccessToken when all required claims are present', () => {
      const token = createTestToken({
        email: 'test@example.com',
        user_id: 'user123',
        roles: ['ROLE_USER', 'ROLE_ADMIN'],
        username: 'testuser',
        guid: 'guid-123',
        session_id: 'session-456',
        client_id: 'client-789',
        iss: 'https://auth.example.com',
        sub: 'sub-123',
        aud: ['api'],
        exp: 9999999999,
        nbf: 1000000000,
        iat: 1000000000,
        jti: 'jti-123'
      })

      const decoded = decodeAccessToken(token)

      expect(decoded).not.toBeNull()
      expect(decoded?.email).toBe('test@example.com')
      expect(decoded?.user_id).toBe('user123')
      expect(decoded?.roles).toEqual(['ROLE_USER', 'ROLE_ADMIN'])
      expect(decoded?.username).toBe('testuser')
      expect(decoded?.guid).toBe('guid-123')
      expect(decoded?.session_id).toBe('session-456')
    })
  })
})
