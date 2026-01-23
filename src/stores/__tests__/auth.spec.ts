/**
 * Auth Store Unit Tests
 *
 * Tests for the Pinia auth store following ADR-005 and ADR-006.
 * Tests cover state management, token refresh, and error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '../auth'
import { authService } from '../../services/auth'
import type { CheckAuthResponse, TokenResponse } from '../../types/auth'

// Mock logger
vi.mock('@get-native/get-native-vue-logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

// Mock auth service - preserve AuthConfigurationError for instanceof checks
vi.mock('../../services/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/auth')>()
  return {
    ...actual,
    authService: {
      checkAuth: vi.fn(),
      getAccessToken: vi.fn(),
      initiateLogin: vi.fn(),
      logout: vi.fn()
    }
  }
})

describe('AuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initial state', () => {
    it('has correct initial state values', () => {
      const store = useAuthStore()

      expect(store.isAuthenticated).toBe(false)
      expect(store.isLoading).toBe(false)
      expect(store.user).toBeNull()
      expect(store.accessToken).toBeNull()
      expect(store.tokenExpiresAt).toBeNull()
      expect(store.error).toBeNull()
    })
  })

  describe('initAuth', () => {
    it('sets authenticated state when session is valid', async () => {
      const mockUser = {
        user_id: 'user123',
        session_id: 'session456',
        created_at: '2025-12-05T00:00:00Z',
        last_activity: '2025-12-05T01:00:00Z',
        expires_at: '2025-12-06T00:00:00Z'
      }
      const mockResponse: CheckAuthResponse = {
        isAuthenticated: true,
        user: mockUser
      }
      const mockToken: TokenResponse = {
        accessToken: 'test-token',
        tokenType: 'Bearer',
        expiresIn: 600,
        scope: 'openid'
      }

      vi.mocked(authService.checkAuth).mockResolvedValue(mockResponse)
      vi.mocked(authService.getAccessToken).mockResolvedValue(mockToken)

      const store = useAuthStore()
      await store.initAuth()

      expect(store.isAuthenticated).toBe(true)
      expect(store.user).toEqual(mockUser)
      expect(store.isLoading).toBe(false)
      expect(store.accessToken).toBe('test-token')
    })

    it('sets unauthenticated state when no session', async () => {
      const mockResponse: CheckAuthResponse = {
        isAuthenticated: false,
        user: null
      }

      vi.mocked(authService.checkAuth).mockResolvedValue(mockResponse)

      const store = useAuthStore()
      await store.initAuth()

      expect(store.isAuthenticated).toBe(false)
      expect(store.user).toBeNull()
      expect(store.isLoading).toBe(false)
      expect(authService.getAccessToken).not.toHaveBeenCalled()
    })

    it('handles errors gracefully', async () => {
      vi.mocked(authService.checkAuth).mockRejectedValue(new Error('Network error'))

      const store = useAuthStore()
      await store.initAuth()

      expect(store.isAuthenticated).toBe(false)
      expect(store.isLoading).toBe(false)
    })

    it('sets isLoading to true during check', async () => {
      let loadingDuringCheck = false
      vi.mocked(authService.checkAuth).mockImplementation(async () => {
        const store = useAuthStore()
        loadingDuringCheck = store.isLoading
        return { isAuthenticated: false, user: null }
      })

      const store = useAuthStore()
      await store.initAuth()

      expect(loadingDuringCheck).toBe(true)
      expect(store.isLoading).toBe(false)
    })
  })

  describe('ensureValidToken', () => {
    it('returns cached token when not expiring soon', async () => {
      const store = useAuthStore()
      store.$patch({
        accessToken: 'cached-token',
        tokenExpiresAt: Date.now() + 120000 // 2 minutes from now
      })

      const token = await store.ensureValidToken()

      expect(token).toBe('cached-token')
      expect(authService.getAccessToken).not.toHaveBeenCalled()
    })

    it('refreshes token when expiring within 60s', async () => {
      const mockToken: TokenResponse = {
        accessToken: 'new-token',
        tokenType: 'Bearer',
        expiresIn: 600,
        scope: 'openid'
      }
      vi.mocked(authService.getAccessToken).mockResolvedValue(mockToken)

      const store = useAuthStore()
      store.$patch({
        accessToken: 'old-token',
        tokenExpiresAt: Date.now() + 30000 // 30 seconds from now (within buffer)
      })

      const token = await store.ensureValidToken()

      expect(token).toBe('new-token')
      expect(authService.getAccessToken).toHaveBeenCalled()
    })

    it('refreshes token when no token exists', async () => {
      const mockToken: TokenResponse = {
        accessToken: 'fresh-token',
        tokenType: 'Bearer',
        expiresIn: 600,
        scope: 'openid'
      }
      vi.mocked(authService.getAccessToken).mockResolvedValue(mockToken)

      const store = useAuthStore()

      const token = await store.ensureValidToken()

      expect(token).toBe('fresh-token')
      expect(authService.getAccessToken).toHaveBeenCalled()
    })

    it('prevents concurrent refresh requests', async () => {
      const mockToken: TokenResponse = {
        accessToken: 'refreshed-token',
        tokenType: 'Bearer',
        expiresIn: 600,
        scope: 'openid'
      }
      vi.mocked(authService.getAccessToken).mockResolvedValue(mockToken)

      const store = useAuthStore()
      // No token - will need refresh

      // Call twice simultaneously
      const promise1 = store.ensureValidToken()
      const promise2 = store.ensureValidToken()

      await Promise.all([promise1, promise2])

      // Should only call getAccessToken once
      expect(authService.getAccessToken).toHaveBeenCalledTimes(1)
    })

    it('sets session_expired error when refresh returns null', async () => {
      vi.mocked(authService.getAccessToken).mockResolvedValue(null)

      const store = useAuthStore()

      await store.ensureValidToken()

      expect(store.error?.type).toBe('session_expired')
      expect(store.isAuthenticated).toBe(false)
    })

    it('sets session_expired error when refresh throws', async () => {
      vi.mocked(authService.getAccessToken).mockRejectedValue(new Error('Network error'))

      const store = useAuthStore()

      await store.ensureValidToken()

      expect(store.error?.type).toBe('session_expired')
      expect(store.isAuthenticated).toBe(false)
    })

    it('updates tokenExpiresAt correctly based on expiresIn', async () => {
      const mockToken: TokenResponse = {
        accessToken: 'test-token',
        tokenType: 'Bearer',
        expiresIn: 600, // 600 seconds = 10 minutes
        scope: 'openid'
      }
      vi.mocked(authService.getAccessToken).mockResolvedValue(mockToken)

      const beforeCall = Date.now()
      const store = useAuthStore()
      await store.ensureValidToken()
      const afterCall = Date.now()

      // tokenExpiresAt should be ~10 minutes from now
      const expectedMin = beforeCall + 600 * 1000
      const expectedMax = afterCall + 600 * 1000

      expect(store.tokenExpiresAt).toBeGreaterThanOrEqual(expectedMin)
      expect(store.tokenExpiresAt).toBeLessThanOrEqual(expectedMax)
    })

    it('handles expiresIn of 0 by using minimum threshold', async () => {
      const mockToken: TokenResponse = {
        accessToken: 'test-token',
        tokenType: 'Bearer',
        expiresIn: 0, // Invalid: 0 seconds
        scope: 'openid'
      }
      vi.mocked(authService.getAccessToken).mockResolvedValue(mockToken)

      const beforeCall = Date.now()
      const store = useAuthStore()
      await store.ensureValidToken()
      const afterCall = Date.now()

      // Should use minimum of 5 seconds
      const expectedMin = beforeCall + 5 * 1000
      const expectedMax = afterCall + 5 * 1000

      expect(store.tokenExpiresAt).toBeGreaterThanOrEqual(expectedMin)
      expect(store.tokenExpiresAt).toBeLessThanOrEqual(expectedMax)
      expect(store.accessToken).toBe('test-token')
    })

    it('handles negative expiresIn by using minimum threshold', async () => {
      const mockToken: TokenResponse = {
        accessToken: 'test-token',
        tokenType: 'Bearer',
        expiresIn: -100, // Invalid: negative
        scope: 'openid'
      }
      vi.mocked(authService.getAccessToken).mockResolvedValue(mockToken)

      const store = useAuthStore()
      await store.ensureValidToken()

      // Should use minimum of 5 seconds, not negative
      expect(store.tokenExpiresAt).toBeGreaterThan(Date.now())
      expect(store.accessToken).toBe('test-token')
    })

    it('sets error when accessToken is empty string', async () => {
      const mockToken: TokenResponse = {
        accessToken: '', // Invalid: empty
        tokenType: 'Bearer',
        expiresIn: 600,
        scope: 'openid'
      }
      vi.mocked(authService.getAccessToken).mockResolvedValue(mockToken)

      const store = useAuthStore()
      const result = await store.ensureValidToken()

      expect(result).toBeNull()
      expect(store.error?.type).toBe('session_expired')
      expect(store.accessToken).toBeNull() // Should NOT be set to empty string
    })

    it('sets error when accessToken is whitespace only', async () => {
      const mockToken: TokenResponse = {
        accessToken: '   ', // Invalid: whitespace only
        tokenType: 'Bearer',
        expiresIn: 600,
        scope: 'openid'
      }
      vi.mocked(authService.getAccessToken).mockResolvedValue(mockToken)

      const store = useAuthStore()
      const result = await store.ensureValidToken()

      expect(result).toBeNull()
      expect(store.error?.type).toBe('session_expired')
    })
  })

  describe('login', () => {
    it('sets isLoading and calls authService.initiateLogin', () => {
      const store = useAuthStore()

      store.login('/dashboard')

      expect(store.isLoading).toBe(true)
      expect(authService.initiateLogin).toHaveBeenCalledWith('/dashboard')
    })

    it('calls initiateLogin without returnUrl when not provided', () => {
      const store = useAuthStore()

      store.login()

      expect(authService.initiateLogin).toHaveBeenCalledWith(undefined)
    })

    it('clears existing error before redirect', () => {
      const store = useAuthStore()
      store.$patch({
        error: { type: 'session_expired', message: 'Session expired' }
      })

      store.login()

      expect(store.error).toBeNull()
      expect(store.isLoading).toBe(true)
    })
  })

  describe('logout', () => {
    it('calls auth service and resets state', async () => {
      vi.mocked(authService.logout).mockResolvedValue({ success: true })

      const store = useAuthStore()
      store.$patch({
        isAuthenticated: true,
        user: {
          user_id: 'test',
          session_id: 'session',
          created_at: '2025-12-05T00:00:00Z',
          last_activity: '2025-12-05T01:00:00Z',
          expires_at: '2025-12-06T00:00:00Z'
        },
        accessToken: 'token',
        tokenExpiresAt: Date.now()
      })

      await store.logout()

      expect(authService.logout).toHaveBeenCalled()
      expect(store.isAuthenticated).toBe(false)
      expect(store.user).toBeNull()
      expect(store.accessToken).toBeNull()
      expect(authService.initiateLogin).toHaveBeenCalled()
    })

    it('resets state even if logout API fails', async () => {
      vi.mocked(authService.logout).mockRejectedValue(new Error('Network error'))

      const store = useAuthStore()
      store.$patch({
        isAuthenticated: true,
        user: {
          user_id: 'test',
          session_id: 'session',
          created_at: '2025-12-05T00:00:00Z',
          last_activity: '2025-12-05T01:00:00Z',
          expires_at: '2025-12-06T00:00:00Z'
        }
      })

      await store.logout()

      expect(store.isAuthenticated).toBe(false)
      expect(store.user).toBeNull()
      expect(authService.initiateLogin).toHaveBeenCalled()
    })
  })

  describe('setError and clearError', () => {
    it('setError updates error state', () => {
      const store = useAuthStore()

      store.setError({
        type: 'permission_denied',
        message: 'Access denied'
      })

      expect(store.error?.type).toBe('permission_denied')
      expect(store.error?.message).toBe('Access denied')
      expect(store.hasError).toBe(true)
    })

    it('setError with session_expired clears auth state', () => {
      const store = useAuthStore()
      store.$patch({
        isAuthenticated: true,
        user: {
          user_id: 'test',
          session_id: 'session',
          created_at: '2025-12-05T00:00:00Z',
          last_activity: '2025-12-05T01:00:00Z',
          expires_at: '2025-12-06T00:00:00Z'
        },
        accessToken: 'token',
        tokenExpiresAt: Date.now() + 60000
      })

      store.setError({
        type: 'session_expired',
        message: 'Session expired'
      })

      expect(store.isAuthenticated).toBe(false)
      expect(store.user).toBeNull()
      expect(store.accessToken).toBeNull()
      expect(store.tokenExpiresAt).toBeNull()
    })

    it('setError with permission_denied does not clear auth state', () => {
      const store = useAuthStore()
      store.$patch({
        isAuthenticated: true,
        user: {
          user_id: 'test',
          session_id: 'session',
          created_at: '2025-12-05T00:00:00Z',
          last_activity: '2025-12-05T01:00:00Z',
          expires_at: '2025-12-06T00:00:00Z'
        },
        accessToken: 'token'
      })

      store.setError({
        type: 'permission_denied',
        message: 'No permission'
      })

      expect(store.isAuthenticated).toBe(true)
      expect(store.user).not.toBeNull()
      expect(store.accessToken).toBe('token')
    })

    it('clearError clears error state', () => {
      const store = useAuthStore()
      store.setError({
        type: 'permission_denied',
        message: 'Access denied'
      })

      store.clearError()

      expect(store.error).toBeNull()
      expect(store.hasError).toBe(false)
    })
  })

  describe('getters', () => {
    describe('currentUser', () => {
      it('returns user when set', () => {
        const store = useAuthStore()
        const mockUser = {
          user_id: 'user123',
          session_id: 'session456',
          created_at: '2025-12-05T00:00:00Z',
          last_activity: '2025-12-05T01:00:00Z',
          expires_at: '2025-12-06T00:00:00Z'
        }
        store.$patch({ user: mockUser })

        expect(store.currentUser).toEqual(mockUser)
      })

      it('returns null when no user', () => {
        const store = useAuthStore()

        expect(store.currentUser).toBeNull()
      })
    })

    describe('hasError', () => {
      it('returns false when no error', () => {
        const store = useAuthStore()

        expect(store.hasError).toBe(false)
      })

      it('returns true when error exists', () => {
        const store = useAuthStore()
        store.$patch({
          error: { type: 'session_expired', message: 'Expired' }
        })

        expect(store.hasError).toBe(true)
      })
    })

    describe('checkTokenNeedsRefresh', () => {
      it('returns true when no token', () => {
        const store = useAuthStore()

        expect(store.checkTokenNeedsRefresh()).toBe(true)
      })

      it('returns true when no tokenExpiresAt', () => {
        const store = useAuthStore()
        store.$patch({ accessToken: 'token' })

        expect(store.checkTokenNeedsRefresh()).toBe(true)
      })

      it('returns true when within 60s of expiry', () => {
        const store = useAuthStore()
        store.$patch({
          accessToken: 'token',
          tokenExpiresAt: Date.now() + 30000 // 30 seconds
        })

        expect(store.checkTokenNeedsRefresh()).toBe(true)
      })

      it('returns false when token valid beyond buffer', () => {
        const store = useAuthStore()
        store.$patch({
          accessToken: 'token',
          tokenExpiresAt: Date.now() + 120000 // 2 minutes
        })

        expect(store.checkTokenNeedsRefresh()).toBe(false)
      })

      it('returns true when exactly at 60s buffer boundary', () => {
        const store = useAuthStore()
        store.$patch({
          accessToken: 'token',
          tokenExpiresAt: Date.now() + 60000 // Exactly 60 seconds
        })

        expect(store.checkTokenNeedsRefresh()).toBe(true)
      })
    })
  })

  describe('$reset', () => {
    it('resets all state to initial values', () => {
      const store = useAuthStore()
      store.$patch({
        isAuthenticated: true,
        isLoading: true,
        user: {
          user_id: 'test',
          session_id: 'session',
          created_at: '2025-12-05T00:00:00Z',
          last_activity: '2025-12-05T01:00:00Z',
          expires_at: '2025-12-06T00:00:00Z'
        },
        accessToken: 'token',
        tokenExpiresAt: Date.now(),
        error: { type: 'session_expired', message: 'Expired' }
      })

      store.$reset()

      expect(store.isAuthenticated).toBe(false)
      expect(store.isLoading).toBe(false)
      expect(store.user).toBeNull()
      expect(store.accessToken).toBeNull()
      expect(store.tokenExpiresAt).toBeNull()
      expect(store.error).toBeNull()
    })
  })
})
