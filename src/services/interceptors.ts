/**
 * Auth Interceptors for Axios
 *
 * Provides automatic token injection on requests and auth error handling on responses.
 * Uses the factory pattern with dependency injection for clean testing.
 *
 * IMPORTANT: This interceptor should ONLY be attached to clients that make
 * authenticated requests. For public endpoints, use publicClient instead.
 *
 * Request interceptor: Injects Bearer token for authenticated users (AC1)
 * Response interceptor: Routes error codes into the five recovery categories
 * (`session_expired`, `service_unavailable`, `dev_error`, `account_blocked`,
 * `server_error`) via the canonical code→category map. Views render from
 * `AuthError.code` alone — no auxiliary data (scopes, request_id, retry_after)
 * is carried.
 *
 * @see ADR-005 Auth state structure
 * @see ADR-006 Token refresh strategy
 * @see PAT-004 Error type mapping
 * @see publicClient for unauthenticated requests
 */

import type { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios'
import type { AuthError, BackendAuthError } from '../types/auth'
import { parseAuthError, AuthConfigurationError, isAuthConfigured } from './auth'
import { ERROR_CODE_TO_TYPE, KNOWN_INLINE_CODES, statusFallbackType } from './errorCodeMap'
import { getGlobalConfig } from '../config'
import { createLogger } from '@turnkeystaffing/get-native-vue-logger'

/**
 * Logger for auth interceptor operations
 */
const logger = createLogger('AuthInterceptors')

/**
 * Auth store interface for dependency injection
 * Matches the subset of useAuthStore() needed by interceptors
 */
export interface AuthStoreInterface {
  isAuthenticated: boolean
  ensureValidToken: () => Promise<string | null>
  setError: (error: AuthError) => void
}

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
 * - Routes `error` (lowercased) through the canonical code→category map
 *   (merged with consumer `errorCodeOverrides` from plugin config).
 * - Synthesizes `{ type: 'service_unavailable', code: 'rate_limit_exceeded' }`
 *   for 429 responses without a code.
 * - Emits `onUnmappedError(code, status, error)` + `console.warn` (dev only)
 *   when the code is non-empty, not in the merged map, and not inline.
 * - Preserves the 401-without-code fallback (`session_expired`) and the
 *   `isAuthConfigured()` guard that suppresses errors when no config is set.
 * - Always propagates the rejection to the caller.
 *
 * @param axiosInstance - Axios instance to configure (should be for protected endpoints only)
 * @param getAuthStore - Function to get auth store (avoids circular deps)
 *
 * @see PAT-004 Error type mapping
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
export function setupAuthInterceptors(
  axiosInstance: AxiosInstance,
  getAuthStore: () => AuthStoreInterface
): void {
  // Request interceptor - add auth header
  axiosInstance.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      // In cookie mode, skip all token logic — auth is handled by session cookies
      if (getGlobalConfig()?.mode === 'cookie') {
        return config
      }

      const authStore = getAuthStore()

      // Only inject token if user is authenticated
      if (!authStore.isAuthenticated) {
        return config
      }

      try {
        const token = await authStore.ensureValidToken()

        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
      } catch (error) {
        // Handle configuration errors - set proper error state and reject request
        if (error instanceof AuthConfigurationError) {
          authStore.setError({
            type: 'service_unavailable',
            message: error.message
          })
          // Don't continue - reject the request to prevent 401 fallback
          return Promise.reject(error)
        }

        // Sanitize error to avoid leaking sensitive details in logs
        logger.error('Failed to get auth token:', error instanceof Error ? error.message : 'Unknown error')
        // Continue without token for other errors - let server return 401
      }

      return config
    },
    (error) => Promise.reject(error)
  )

  // Response interceptor - route auth errors into recovery categories
  axiosInstance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError<BackendAuthError>) => {
      const authStore = getAuthStore()
      const response = error.response
      const status = response?.status ?? 0

      // Read consumer-provided overrides + drift hook from plugin config
      // (matches the pattern used for `mode: 'cookie'` above).
      const config = getGlobalConfig()
      const overrides = config?.errorCodeOverrides
      const onUnmappedError = config?.onUnmappedError

      const body = response?.data ?? ({} as BackendAuthError)
      const rawCode = body.error
      const code =
        typeof rawCode === 'string' && rawCode.length > 0 ? rawCode.toLowerCase() : null

      // GUARD: Don't set auth errors for 401 if auth isn't configured.
      // Prevents overwriting service_unavailable set by an earlier guard.
      if (status === 401 && !isAuthConfigured()) {
        logger.warn('401 received but auth is not configured, ignoring')
        return Promise.reject(error)
      }

      // Attempt structured routing via the code→category map (with overrides).
      const authError = parseAuthError(error, overrides)
      if (authError) {
        authStore.setError(authError)
        return Promise.reject(error)
      }

      // parseAuthError returned null. Disambiguate:
      //   (a) code was present but unknown / inline / override-null
      //   (b) no code at all — apply status fallback
      if (code) {
        // Known inline — propagate silently (no drift warning).
        if (KNOWN_INLINE_CODES.has(code)) {
          return Promise.reject(error)
        }

        // Override explicitly mapped to null — treat as inline/silent.
        if (overrides && Object.prototype.hasOwnProperty.call(overrides, code)) {
          return Promise.reject(error)
        }

        // Check merged membership — if the code isn't in either the canonical
        // map or overrides, it's drift. Fire the hook + dev warn.
        const inCanonical = Object.prototype.hasOwnProperty.call(ERROR_CODE_TO_TYPE, code)
        if (!inCanonical) {
          if (onUnmappedError) {
            try {
              // Support sync + async hooks without leaking unhandled rejections.
              Promise.resolve(onUnmappedError(code, status, error)).catch((hookErr) => {
                logger.warn('onUnmappedError hook rejected', hookErr)
              })
            } catch (hookErr) {
              logger.warn('onUnmappedError hook threw', hookErr)
            }
          }
          // Dev-only console drift warning. Vite statically replaces
          // `import.meta.env.DEV` at build time; bare access (no optional chain)
          // is required for the replacement to fire and strip the branch in
          // production bundles.
          if (import.meta.env.DEV) {
            console.warn('[auth] unmapped error code', { code, status })
          }
        }

        // Fall through to status fallback for a generic overlay if any.
      }

      // Special-case 429: if we got here without a code, synthesize
      // rate_limit_exceeded so the overlay renders.
      if (status === 429 && !code) {
        authStore.setError({
          type: 'service_unavailable',
          code: 'rate_limit_exceeded',
          message: body.error_description || 'Too many requests. Please try again shortly.'
        })
        return Promise.reject(error)
      }

      // Naked status fallback (no structured error).
      const fallbackType = statusFallbackType(status)
      if (fallbackType === 'session_expired') {
        authStore.setError({
          type: 'session_expired',
          message: 'Your session has expired. Please sign in again.'
        })
      } else if (fallbackType === 'service_unavailable' && status === 429) {
        // Covered by the 429 branch above — kept for completeness.
        authStore.setError({
          type: 'service_unavailable',
          code: 'rate_limit_exceeded',
          message: body.error_description || 'Too many requests. Please try again shortly.'
        })
      }
      // 503 without an auth error code is NOT treated as an auth error.
      // 403 without a recognized code is intentionally NOT overlaid — map drift
      // is reported via onUnmappedError / console.warn above.

      return Promise.reject(error)
    }
  )
}
