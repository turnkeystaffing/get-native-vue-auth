/**
 * Auth Composable
 *
 * Provides reactive auth state and actions for Vue components.
 * Wraps the Pinia auth store for convenient component access.
 *
 * @see ADR-005 Auth state structure
 * @see ADR-006 Token refresh strategy
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { useAuth } from '@turnkeystaffing/get-native-vue-auth'
 *
 * const { isAuthenticated, user, login, logout } = useAuth()
 *
 * function handleLogout() {
 *   logout()
 * }
 * </script>
 * ```
 */

import { computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import type { UserInfo, AuthError, DecodedAccessToken } from '../types/auth'

/**
 * Auth composable for reactive auth state and actions
 *
 * @returns Object with reactive auth state and action methods
 */
export function useAuth() {
  const authStore = useAuthStore()

  /**
   * Whether user is currently authenticated
   */
  const isAuthenticated = computed(() => authStore.isAuthenticated)

  /**
   * Whether auth state is being loaded/checked
   */
  const isLoading = computed(() => authStore.isLoading)

  /**
   * Current authenticated user info, null if not authenticated
   */
  const user = computed<UserInfo | null>(() => authStore.user)

  /**
   * Current auth error, null if no error
   */
  const error = computed<AuthError | null>(() => authStore.error)

  /**
   * User email extracted from JWT token.
   * Useful for displaying user identity in the UI.
   * Falls back to null if email is not available in token.
   */
  const userEmail = computed<string | null>(() => authStore.userEmail)

  /**
   * Decoded JWT access token with all claims.
   * Returns null if token is not available or invalid.
   */
  const decodedToken = computed<DecodedAccessToken | null>(() => authStore.decodedToken)

  /**
   * User roles from JWT access token.
   * Returns empty array if token is not available.
   */
  const userRoles = computed<string[]>(() => authStore.userRoles)

  /**
   * User ID from JWT access token.
   * Returns null if token is not available.
   */
  const userId = computed<string | null>(() => authStore.userId)

  /**
   * User GUID from JWT access token.
   * Returns null if token is not available.
   */
  const userGuid = computed<string | null>(() => authStore.userGuid)

  /**
   * Username from JWT access token.
   * Returns null if token is not available.
   */
  const username = computed<string | null>(() => authStore.username)

  /**
   * Session ID from JWT access token.
   * Returns null if token is not available.
   */
  const sessionId = computed<string | null>(() => authStore.sessionId)

  /**
   * Check if user has a specific role.
   *
   * @param role - The role to check for
   * @returns true if user has the specified role
   */
  function hasRole(role: string): boolean {
    return authStore.hasRole(role)
  }

  /**
   * Initiate login flow - redirects to Central Login
   *
   * @param returnUrl - URL to return to after authentication
   */
  function login(returnUrl?: string): void {
    authStore.login(returnUrl)
  }

  /**
   * Logout - revoke session and redirect to login
   */
  async function logout(): Promise<void> {
    await authStore.logout()
  }

  /**
   * Clear current auth error
   */
  function clearError(): void {
    authStore.clearError()
  }

  return {
    // Reactive state
    isAuthenticated,
    isLoading,
    user,
    userEmail,
    error,

    // Decoded token getters
    decodedToken,
    userRoles,
    userId,
    userGuid,
    username,
    sessionId,

    // Actions
    login,
    logout,
    clearError,
    hasRole
  }
}

/**
 * Type export for consuming components
 */
export type UseAuth = ReturnType<typeof useAuth>
