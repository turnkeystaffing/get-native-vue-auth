/**
 * Auth Composable Unit Tests
 *
 * Tests for the useAuth composable that wraps the Pinia auth store.
 * Verifies reactive state exposure and action wrapper functionality.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuth } from '../useAuth'
import { useAuthStore } from '../../stores/auth'

// Mock logger
vi.mock('@turnkeystaffing/get-native-vue-logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

// Mock auth service
vi.mock('../../services/auth', () => ({
  authService: {
    checkAuth: vi.fn(),
    getAccessToken: vi.fn(),
    login: vi.fn(),
    logout: vi.fn()
  },
  AuthConfigurationError: class AuthConfigurationError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'AuthConfigurationError'
    }
  }
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

describe('useAuth', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('reactive state', () => {
    it('exposes isAuthenticated from store', () => {
      const authStore = useAuthStore()
      authStore.$patch({ isAuthenticated: true })

      const { isAuthenticated } = useAuth()

      expect(isAuthenticated.value).toBe(true)
    })

    it('exposes isLoading from store', () => {
      const authStore = useAuthStore()
      authStore.$patch({ isLoading: true })

      const { isLoading } = useAuth()

      expect(isLoading.value).toBe(true)
    })

    it('exposes user from store', () => {
      const mockUser = {
        user_id: 'test-user',
        session_id: 'test-session',
        created_at: '2025-12-05T00:00:00Z',
        last_activity: '2025-12-05T01:00:00Z',
        expires_at: '2025-12-06T00:00:00Z'
      }
      const authStore = useAuthStore()
      authStore.$patch({ user: mockUser })

      const { user } = useAuth()

      expect(user.value).toEqual(mockUser)
    })

    it('exposes null user when not authenticated', () => {
      const { user } = useAuth()

      expect(user.value).toBeNull()
    })

    it('exposes error from store', () => {
      const mockError = { type: 'session_expired' as const, message: 'Session expired' }
      const authStore = useAuthStore()
      authStore.$patch({ error: mockError })

      const { error } = useAuth()

      expect(error.value).toEqual(mockError)
    })

    it('exposes null error when no error', () => {
      const { error } = useAuth()

      expect(error.value).toBeNull()
    })

    it('reflects state changes reactively', () => {
      const authStore = useAuthStore()
      const { isAuthenticated } = useAuth()

      expect(isAuthenticated.value).toBe(false)

      authStore.$patch({ isAuthenticated: true })

      expect(isAuthenticated.value).toBe(true)
    })

    it('exposes decodedToken from store', () => {
      const authStore = useAuthStore()
      const token = createTestToken({
        email: 'test@example.com',
        user_id: 'user123',
        roles: ['ROLE_USER']
      })
      authStore.$patch({ accessToken: token })

      const { decodedToken } = useAuth()

      expect(decodedToken.value).not.toBeNull()
      expect(decodedToken.value?.email).toBe('test@example.com')
    })

    it('exposes userRoles from store', () => {
      const authStore = useAuthStore()
      const token = createTestToken({
        email: 'test@example.com',
        user_id: 'user123',
        roles: ['ROLE_USER', 'ROLE_ADMIN']
      })
      authStore.$patch({ accessToken: token })

      const { userRoles } = useAuth()

      expect(userRoles.value).toEqual(['ROLE_USER', 'ROLE_ADMIN'])
    })

    it('exposes userId from store', () => {
      const authStore = useAuthStore()
      const token = createTestToken({
        email: 'test@example.com',
        user_id: 'user123',
        roles: ['ROLE_USER']
      })
      authStore.$patch({ accessToken: token })

      const { userId } = useAuth()

      expect(userId.value).toBe('user123')
    })

    it('exposes userGuid from store', () => {
      const authStore = useAuthStore()
      const token = createTestToken({
        email: 'test@example.com',
        user_id: 'user123',
        roles: ['ROLE_USER'],
        guid: 'guid-abc'
      })
      authStore.$patch({ accessToken: token })

      const { userGuid } = useAuth()

      expect(userGuid.value).toBe('guid-abc')
    })

    it('exposes username from store', () => {
      const authStore = useAuthStore()
      const token = createTestToken({
        email: 'test@example.com',
        user_id: 'user123',
        roles: ['ROLE_USER'],
        username: 'johndoe'
      })
      authStore.$patch({ accessToken: token })

      const { username } = useAuth()

      expect(username.value).toBe('johndoe')
    })

    it('exposes sessionId from store', () => {
      const authStore = useAuthStore()
      const token = createTestToken({
        email: 'test@example.com',
        user_id: 'user123',
        roles: ['ROLE_USER'],
        session_id: 'session-xyz'
      })
      authStore.$patch({ accessToken: token })

      const { sessionId } = useAuth()

      expect(sessionId.value).toBe('session-xyz')
    })
  })

  describe('actions', () => {
    it('login calls store login with returnUrl', () => {
      const authStore = useAuthStore()
      // Mock implementation to prevent actual login call (requires BFF_BASE_URL)
      const loginSpy = vi.spyOn(authStore, 'login').mockImplementation(() => {})

      const { login } = useAuth()
      login('/dashboard')

      expect(loginSpy).toHaveBeenCalledWith('/dashboard')
    })

    it('login calls store login without returnUrl', () => {
      const authStore = useAuthStore()
      // Mock implementation to prevent actual login call (requires BFF_BASE_URL)
      const loginSpy = vi.spyOn(authStore, 'login').mockImplementation(() => {})

      const { login } = useAuth()
      login()

      expect(loginSpy).toHaveBeenCalledWith(undefined)
    })

    it('logout calls store logout', async () => {
      const authStore = useAuthStore()
      const logoutSpy = vi.spyOn(authStore, 'logout').mockResolvedValue()

      const { logout } = useAuth()
      await logout()

      expect(logoutSpy).toHaveBeenCalled()
    })

    it('logout returns a promise', () => {
      const authStore = useAuthStore()
      vi.spyOn(authStore, 'logout').mockResolvedValue()

      const { logout } = useAuth()
      const result = logout()

      expect(result).toBeInstanceOf(Promise)
    })

    it('clearError calls store clearError', () => {
      const authStore = useAuthStore()
      authStore.$patch({ error: { type: 'session_expired', message: 'Test' } })
      const clearErrorSpy = vi.spyOn(authStore, 'clearError')

      const { clearError } = useAuth()
      clearError()

      expect(clearErrorSpy).toHaveBeenCalled()
    })

    it('hasRole calls store hasRole', () => {
      const authStore = useAuthStore()
      const hasRoleSpy = vi.spyOn(authStore, 'hasRole')

      const { hasRole } = useAuth()
      hasRole('ROLE_ADMIN')

      expect(hasRoleSpy).toHaveBeenCalledWith('ROLE_ADMIN')
    })
  })

  describe('return type', () => {
    it('returns all expected properties', () => {
      const auth = useAuth()

      expect(auth).toHaveProperty('isAuthenticated')
      expect(auth).toHaveProperty('isLoading')
      expect(auth).toHaveProperty('user')
      expect(auth).toHaveProperty('error')
      expect(auth).toHaveProperty('login')
      expect(auth).toHaveProperty('logout')
      expect(auth).toHaveProperty('clearError')
      expect(auth).toHaveProperty('decodedToken')
      expect(auth).toHaveProperty('userRoles')
      expect(auth).toHaveProperty('userId')
      expect(auth).toHaveProperty('userGuid')
      expect(auth).toHaveProperty('username')
      expect(auth).toHaveProperty('sessionId')
      expect(auth).toHaveProperty('hasRole')
    })

    it('returns computed refs for state properties', () => {
      const {
        isAuthenticated,
        isLoading,
        user,
        error,
        decodedToken,
        userRoles,
        userId,
        userGuid,
        username,
        sessionId
      } = useAuth()

      // Verify they are computed refs (have .value property)
      expect(isAuthenticated).toHaveProperty('value')
      expect(isLoading).toHaveProperty('value')
      expect(user).toHaveProperty('value')
      expect(error).toHaveProperty('value')
      expect(decodedToken).toHaveProperty('value')
      expect(userRoles).toHaveProperty('value')
      expect(userId).toHaveProperty('value')
      expect(userGuid).toHaveProperty('value')
      expect(username).toHaveProperty('value')
      expect(sessionId).toHaveProperty('value')
    })

    it('returns functions for action properties', () => {
      const { login, logout, clearError, hasRole } = useAuth()

      expect(typeof login).toBe('function')
      expect(typeof logout).toBe('function')
      expect(typeof clearError).toBe('function')
      expect(typeof hasRole).toBe('function')
    })
  })
})
