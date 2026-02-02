/**
 * Auth Pinia Store
 *
 * Manages authentication state with reactive updates.
 * Implements ADR-005 (state structure) and ADR-006 (lazy token refresh).
 *
 * @see ADR-005 Auth state structure
 * @see ADR-006 Token refresh strategy (60s buffer)
 */

import { defineStore } from 'pinia'
import { authService, AuthConfigurationError } from '../services/auth'
import { createLogger } from '@turnkeystaffing/get-native-vue-logger'
import { decodeAccessToken } from '../utils/jwt'
import type { UserInfo, TokenResponse, AuthError, DecodedAccessToken } from '../types/auth'

/** Minimum valid token expiry time in seconds (5 seconds) */
const MIN_EXPIRES_IN_SECONDS = 5

/**
 * Logger for auth store operations
 */
const logger = createLogger('AuthStore')

/**
 * Module-level refresh promise for concurrent refresh prevention.
 * Kept outside state to avoid serialization issues with Pinia plugins.
 */
let refreshPromise: Promise<TokenResponse | null> | null = null

/**
 * Auth state interface matching ADR-005
 * @public Exported for type-checking in components
 */
export interface AuthState {
  // Auth status
  isAuthenticated: boolean
  isLoading: boolean

  // User data
  user: UserInfo | null

  // Token management (ADR-006)
  accessToken: string | null
  tokenExpiresAt: number | null // Unix timestamp in milliseconds

  // Error state
  error: AuthError | null
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    isAuthenticated: false,
    isLoading: false,
    user: null,
    accessToken: null,
    tokenExpiresAt: null,
    error: null
  }),

  getters: {
    /**
     * Current authenticated user
     */
    currentUser: (state) => state.user,

    /**
     * Check if there's an active error
     */
    hasError: (state) => state.error !== null,

    /**
     * Decoded JWT access token with all claims.
     * Returns null if token is not available or invalid.
     */
    decodedToken: (state): DecodedAccessToken | null => {
      return decodeAccessToken(state.accessToken)
    },

    /**
     * User email extracted from JWT access token.
     * Returns null if token is not available or email claim is missing.
     */
    userEmail(): string | null {
      return this.decodedToken?.email ?? null
    },

    /**
     * User roles from JWT access token.
     * Returns empty array if token is not available.
     */
    userRoles(): string[] {
      return this.decodedToken?.roles ?? []
    },

    /**
     * User ID from JWT access token.
     * Returns null if token is not available.
     */
    userId(): string | null {
      return this.decodedToken?.user_id ?? null
    },

    /**
     * User GUID from JWT access token.
     * Returns null if token is not available.
     */
    userGuid(): string | null {
      return this.decodedToken?.guid ?? null
    },

    /**
     * Username from JWT access token.
     * Returns null if token is not available.
     */
    username(): string | null {
      return this.decodedToken?.username ?? null
    },

    /**
     * Session ID from JWT access token.
     * Returns null if token is not available.
     */
    sessionId(): string | null {
      return this.decodedToken?.session_id ?? null
    }
  },

  actions: {
    /**
     * Check if user has a specific role.
     *
     * @param role - The role to check for
     * @returns true if user has the specified role
     *
     * @example
     * ```typescript
     * if (authStore.hasRole('ROLE_AFFILIATE_ADMIN')) {
     *   // Show admin features
     * }
     * ```
     */
    hasRole(role: string): boolean {
      return this.userRoles.includes(role)
    },

    /**
     * Check if token needs refresh (within 60s of expiry)
     * ADR-006: 60 second buffer before expiry
     *
     * NOTE: This is a method, NOT a getter, because Date.now() is not
     * a reactive dependency. Using a getter would cache stale results
     * and fail to detect token expiry after idle periods.
     */
    checkTokenNeedsRefresh(): boolean {
      if (!this.accessToken || !this.tokenExpiresAt) {
        return true
      }
      const bufferMs = 60 * 1000 // 60 seconds
      return Date.now() >= this.tokenExpiresAt - bufferMs
    },

    /**
     * Initialize auth state on app startup
     * Call this in App.vue or main.ts
     */
    async initAuth() {
      this.isLoading = true
      this.error = null

      try {
        const result = await authService.checkAuth()

        this.isAuthenticated = result.isAuthenticated
        this.user = result.user

        // If authenticated, prefetch token
        if (result.isAuthenticated) {
          await this.ensureValidToken()
        }
      } catch (error) {
        logger.error('Failed to initialize auth:', error)
        this.isAuthenticated = false
        this.user = null

        // Handle configuration errors - set appropriate error state
        if (error instanceof AuthConfigurationError) {
          this.setError({
            type: 'service_unavailable',
            message: error.message
          })
        }
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Ensure we have a valid access token
     * ADR-006: Lazy refresh with 60s buffer, single concurrent refresh
     *
     * @returns Access token string or null if session expired
     */
    async ensureValidToken(): Promise<string | null> {
      // Return cached token if still valid (not within 60s buffer)
      if (this.accessToken && !this.checkTokenNeedsRefresh()) {
        return this.accessToken
      }

      // If refresh already in progress, wait for it
      if (refreshPromise) {
        const result = await refreshPromise
        return result?.accessToken ?? null
      }

      // Start new refresh
      refreshPromise = this._refreshToken()

      try {
        const result = await refreshPromise
        return result?.accessToken ?? null
      } finally {
        refreshPromise = null
      }
    },

    /**
     * Internal: Refresh the access token
     * @private
     */
    async _refreshToken(): Promise<TokenResponse | null> {
      try {
        const tokenResponse = await authService.getAccessToken()

        if (tokenResponse) {
          // Validate token response
          if (!tokenResponse.accessToken || tokenResponse.accessToken.trim() === '') {
            logger.error('Invalid token response: empty accessToken')
            this.setError({
              type: 'session_expired',
              message: 'Invalid token received. Please sign in again.'
            })
            return null
          }

          // Validate expiresIn is a positive number above minimum threshold
          if (
            typeof tokenResponse.expiresIn !== 'number' ||
            !Number.isFinite(tokenResponse.expiresIn) ||
            tokenResponse.expiresIn < MIN_EXPIRES_IN_SECONDS
          ) {
            logger.error(`Invalid expiresIn value: ${tokenResponse.expiresIn}, using minimum`)
            // Use minimum expiry to prevent immediate refresh loops
            tokenResponse.expiresIn = MIN_EXPIRES_IN_SECONDS
          }

          this.accessToken = tokenResponse.accessToken
          // Calculate expiry timestamp from expiresIn (seconds from now)
          this.tokenExpiresAt = Date.now() + tokenResponse.expiresIn * 1000
          return tokenResponse
        } else {
          // Session expired
          this.setError({
            type: 'session_expired',
            message: 'Your session has expired. Please sign in again.'
          })
          return null
        }
      } catch (error) {
        logger.error('Token refresh failed:', error)

        // Handle configuration errors differently - don't mask as session_expired
        if (error instanceof AuthConfigurationError) {
          this.setError({
            type: 'service_unavailable',
            message: error.message
          })
          return null
        }

        this.setError({
          type: 'session_expired',
          message: 'Failed to refresh session. Please sign in again.'
        })
        return null
      }
    },

    /**
     * Initiate login flow - redirects to Central Login
     *
     * @param returnUrl - URL to return to after authentication
     */
    login(returnUrl?: string) {
      this.isLoading = true
      this.error = null // Clear any existing error before redirect
      authService.login(returnUrl ? { returnUrl } : undefined)
      // Note: Page will redirect, isLoading won't reset
    },

    /**
     * Logout - revoke session and reset state
     */
    async logout() {
      try {
        await authService.logout()
      } catch (error) {
        logger.error('Logout failed:', error)
        // Continue with state reset even if API call fails
      }

      // Reset all state
      this.$reset()

      // Redirect to login (Central Login)
      authService.login()
    },

    /**
     * Set auth error state
     * Also sets isAuthenticated to false for session_expired
     *
     * @param error - Auth error object
     */
    setError(error: AuthError) {
      this.error = error

      // Session expired means user is no longer authenticated
      if (error.type === 'session_expired') {
        this.isAuthenticated = false
        this.user = null
        this.accessToken = null
        this.tokenExpiresAt = null
      }
    },

    /**
     * Clear current error
     */
    clearError() {
      this.error = null
    }
  }
})

// Export type for use in components
export type AuthStore = ReturnType<typeof useAuthStore>
