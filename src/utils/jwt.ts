/**
 * JWT Utility Functions
 *
 * Provides safe JWT decoding for extracting claims from access tokens.
 * Note: This only decodes tokens - signature verification is done server-side.
 *
 * @see Story 2.6: User Menu & Logout UI
 */

import { jwtDecode } from 'jwt-decode'
import { createLogger } from '@get-native/get-native-vue-logger'

const logger = createLogger('JwtUtils')

/**
 * Standard JWT payload claims we expect from our auth provider.
 * Extend this interface if additional claims are needed.
 */
export interface JwtPayload {
  /** Subject (user identifier) */
  sub?: string
  /** User email address */
  email?: string
  /** Token expiration time (Unix timestamp) */
  exp?: number
  /** Token issued at time (Unix timestamp) */
  iat?: number
  /** Token issuer */
  iss?: string
  /** Token audience */
  aud?: string | string[]
  /** Additional claims can be accessed via index signature */
  [key: string]: unknown
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
export function decodeJwt(token: string | null | undefined): JwtPayload | null {
  if (!token) {
    return null
  }

  try {
    return jwtDecode<JwtPayload>(token)
  } catch (error) {
    logger.warn('Failed to decode JWT token:', error)
    return null
  }
}

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
export function extractEmailFromJwt(token: string | null | undefined): string | null {
  const payload = decodeJwt(token)

  if (!payload?.email || typeof payload.email !== 'string') {
    return null
  }

  return payload.email
}
