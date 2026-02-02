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
    })

    it('returns computed refs for state properties', () => {
      const { isAuthenticated, isLoading, user, error } = useAuth()

      // Verify they are computed refs (have .value property)
      expect(isAuthenticated).toHaveProperty('value')
      expect(isLoading).toHaveProperty('value')
      expect(user).toHaveProperty('value')
      expect(error).toHaveProperty('value')
    })

    it('returns functions for action properties', () => {
      const { login, logout, clearError } = useAuth()

      expect(typeof login).toBe('function')
      expect(typeof logout).toBe('function')
      expect(typeof clearError).toBe('function')
    })
  })
})
