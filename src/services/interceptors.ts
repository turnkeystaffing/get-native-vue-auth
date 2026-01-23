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
 * Response interceptor: Handles auth errors - 401, 403, 503 (AC2, AC3, AC4)
 *
 * @see ADR-005 Auth state structure
 * @see ADR-006 Token refresh strategy
 * @see PAT-004 Error type mapping
 * @see publicClient for unauthenticated requests
 */

import type { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios'
import type { AuthError, BackendAuthError } from '../types/auth'
import { parseAuthError, AuthConfigurationError, isAuthConfigured } from './auth'
import { createLogger } from '@get-native/get-native-vue-logger'

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
 * - Parses structured auth errors using parseAuthError()
 * - Sets auth store error state for 401 (session_expired)
 * - Sets auth store error state for 403 (permission_denied)
 * - Sets auth store error state for 503 with auth_service_unavailable
 * - Always propagates error to caller
 *
 * @param axiosInstance - Axios instance to configure (should be for protected endpoints only)
 * @param getAuthStore - Function to get auth store (avoids circular deps)
 *
 * @example
 * ```typescript
 * import { setupAuthInterceptors } from '@get-native/get-native-vue-auth'
 * import { useAuthStore } from '@get-native/get-native-vue-auth'
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

  // Response interceptor - handle auth errors
  axiosInstance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError<BackendAuthError>) => {
      const authStore = getAuthStore()
      const status = error.response?.status

      // Parse structured auth error from response
      const authError = parseAuthError(error)

      // GUARD: Don't set auth errors for 401 if auth isn't configured
      // This prevents overwriting service_unavailable with session_expired
      if (status === 401 && !isAuthConfigured()) {
        logger.warn('401 received but auth is not configured, ignoring')
        // Don't set error - let service_unavailable remain from earlier guard
      } else if (authError) {
        // Structured auth error found - use it
        authStore.setError(authError)
      } else if (status === 401) {
        // Fallback for 401 without structured error
        authStore.setError({
          type: 'session_expired',
          message: 'Your session has expired. Please sign in again.'
        })
      } else if (status === 403) {
        // Fallback for 403 without structured error
        const detail = error.response?.data?.detail
        authStore.setError({
          type: 'permission_denied',
          message: typeof detail === 'string' ? detail : 'Permission denied'
        })
      }
      // Note: 503 without auth error_type is NOT an auth error (e.g., server down)
      // We only set auth error for 503 if parseAuthError detected auth_service_unavailable

      // Always propagate error to caller
      return Promise.reject(error)
    }
  )
}
