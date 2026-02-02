/**
 * Auth Service Unit Tests
 *
 * Tests for the BFF auth service client.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import axios from 'axios'
import type { AxiosError } from 'axios'
import type { UserInfo, TokenResponse, BackendAuthError } from '@/types/auth'
import {
  authService,
  mapErrorType,
  parseAuthError,
  AuthConfigurationError
} from '@/services/auth'
import { setGlobalConfig } from '@/config'
import type { BffAuthConfig } from '@/types/config'

// Mock axios
vi.mock('axios')
const mockedAxios = vi.mocked(axios, true)

// Mock logger
vi.mock('@turnkeystaffing/get-native-vue-logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Ensure config is set for each test
    const mockConfig: BffAuthConfig = {
      bffBaseUrl: 'http://localhost:8080',
      clientId: 'test-client',
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      } as any
    }
    setGlobalConfig(mockConfig)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('checkAuth', () => {
    it('returns authenticated user when session is valid (AC1)', async () => {
      const mockUser: UserInfo = {
        user_id: 'user123',
        session_id: 'session456',
        created_at: '2025-12-05T00:00:00Z',
        last_activity: '2025-12-05T01:00:00Z',
        expires_at: '2025-12-06T00:00:00Z'
      }

      mockedAxios.get.mockResolvedValueOnce({ data: mockUser })

      const result = await authService.checkAuth()

      expect(result.isAuthenticated).toBe(true)
      expect(result.user).toEqual(mockUser)
      expect(mockedAxios.get).toHaveBeenCalledWith(expect.stringContaining('/bff/userinfo'), {
        withCredentials: true
      })
    })

    it('returns not authenticated when 401 response (AC1)', async () => {
      const axiosError = new Error('Unauthorized') as AxiosError
      Object.assign(axiosError, {
        isAxiosError: true,
        response: { status: 401 }
      })
      mockedAxios.get.mockRejectedValueOnce(axiosError)
      mockedAxios.isAxiosError.mockReturnValue(true)

      const result = await authService.checkAuth()

      expect(result.isAuthenticated).toBe(false)
      expect(result.user).toBeNull()
    })

    it('throws error for unexpected errors', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'))
      mockedAxios.isAxiosError.mockReturnValue(false)

      await expect(authService.checkAuth()).rejects.toThrow('Network error')
    })
  })

  describe('login', () => {
    const originalLocation = window.location

    beforeEach(() => {
      // Mock window.location with origin support
      Object.defineProperty(window, 'location', {
        value: {
          href: 'http://localhost:3000/dashboard',
          origin: 'http://localhost:3000'
        },
        writable: true,
        configurable: true
      })
    })

    afterEach(() => {
      Object.defineProperty(window, 'location', {
        value: originalLocation,
        writable: true,
        configurable: true
      })
    })

    it('redirects to BFF login with client_id and redirect_url (AC2)', () => {
      authService.login()

      expect(window.location.href).toContain('/bff/login')
      expect(window.location.href).toContain('client_id=')
      expect(window.location.href).toContain('redirect_url=')
    })

    it('uses provided full URL when specified (AC2)', () => {
      authService.login({ returnUrl: 'http://localhost:3000/custom-return' })

      expect(window.location.href).toContain(
        'redirect_url=' + encodeURIComponent('http://localhost:3000/custom-return')
      )
    })

    it('converts relative path to absolute URL', () => {
      authService.login({ returnUrl: '/dashboard' })

      expect(window.location.href).toContain(
        'redirect_url=' + encodeURIComponent('http://localhost:3000/dashboard')
      )
    })

    it('converts relative path with query params to absolute URL', () => {
      authService.login({ returnUrl: '/protected?query=1&filter=active' })

      expect(window.location.href).toContain(
        'redirect_url=' + encodeURIComponent('http://localhost:3000/protected?query=1&filter=active')
      )
    })

    it('uses current URL as default redirect when no returnUrl provided (AC2)', () => {
      window.location.href = 'http://localhost:3000/current-page'
      authService.login()

      expect(window.location.href).toContain('/bff/login')
    })

    it('always uses config clientId', () => {
      authService.login({ returnUrl: '/page' })

      // Should use 'test-client' from mock config (line 41)
      expect(window.location.href).toContain('client_id=test-client')
    })

    describe('Configuration Error Handling', () => {
      it('throws AuthConfigurationError when BFF_BASE_URL is not configured', () => {
        // Clear config to simulate missing config
        setGlobalConfig(null as any)

        expect(() => authService.login()).toThrow(AuthConfigurationError)
        expect(() => authService.login()).toThrow(
          'Authentication service is not configured'
        )
      })
    })

    describe('Open Redirect Prevention (Security)', () => {
      it('blocks external URLs and redirects to home', () => {
        authService.login({ returnUrl: 'https://malicious-site.com/steal-data' })

        // Should redirect to home page, not the malicious site
        expect(window.location.href).toContain(
          'redirect_url=' + encodeURIComponent('http://localhost:3000/')
        )
      })

      it('blocks external URLs with different port', () => {
        authService.login({ returnUrl: 'http://localhost:9999/different-port' })

        // Different port = different origin, should be blocked
        expect(window.location.href).toContain(
          'redirect_url=' + encodeURIComponent('http://localhost:3000/')
        )
      })

      it('allows same-origin URLs', () => {
        authService.login({ returnUrl: 'http://localhost:3000/safe-page' })

        expect(window.location.href).toContain(
          'redirect_url=' + encodeURIComponent('http://localhost:3000/safe-page')
        )
      })
    })
  })

  describe('completeOAuthFlow', () => {
    const originalLocation = window.location

    beforeEach(() => {
      // Mock window.location with origin support
      Object.defineProperty(window, 'location', {
        value: {
          href: 'http://login.example.com/login',
          origin: 'http://login.example.com'
        },
        writable: true,
        configurable: true
      })
    })

    afterEach(() => {
      Object.defineProperty(window, 'location', {
        value: originalLocation,
        writable: true,
        configurable: true
      })
    })

    it('redirects to BFF login with provided clientId and returnUrl', () => {
      authService.completeOAuthFlow({
        clientId: 'product-spa',
        returnUrl: 'http://app.example.com/dashboard'
      })

      expect(window.location.href).toContain('/bff/login')
      expect(window.location.href).toContain('client_id=product-spa')
      expect(window.location.href).toContain(
        'redirect_url=' + encodeURIComponent('http://app.example.com/dashboard')
      )
    })

    it('allows cross-origin redirects (required for Central Login)', () => {
      // Central Login at login.example.com must redirect to app.example.com
      authService.completeOAuthFlow({
        clientId: 'my-app',
        returnUrl: 'http://app.example.com/callback'
      })

      // Should NOT block the cross-origin redirect
      expect(window.location.href).toContain(
        'redirect_url=' + encodeURIComponent('http://app.example.com/callback')
      )
    })

    it('throws error when clientId is missing', () => {
      expect(() =>
        authService.completeOAuthFlow({
          clientId: '',
          returnUrl: 'http://app.example.com/dashboard'
        })
      ).toThrow('completeOAuthFlow requires both clientId and returnUrl')
    })

    it('throws error when returnUrl is missing', () => {
      expect(() =>
        authService.completeOAuthFlow({
          clientId: 'product-spa',
          returnUrl: ''
        })
      ).toThrow('completeOAuthFlow requires both clientId and returnUrl')
    })
  })

  describe('getAccessToken', () => {
    it('returns token response on success (AC3)', async () => {
      const mockResponse = {
        access_token: 'jwt-token-here',
        token_type: 'Bearer',
        expires_in: 600,
        scope: 'openid profile email'
      }

      mockedAxios.post.mockResolvedValueOnce({ data: mockResponse })

      const result = await authService.getAccessToken()

      expect(result).toEqual({
        accessToken: 'jwt-token-here',
        tokenType: 'Bearer',
        expiresIn: 600,
        scope: 'openid profile email'
      } as TokenResponse)

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/bff/token'),
        expect.objectContaining({ client_id: expect.any(String) }),
        { withCredentials: true }
      )
    })

    it('returns null when session expired (401) (AC3)', async () => {
      const axiosError = new Error('Unauthorized') as AxiosError
      Object.assign(axiosError, {
        isAxiosError: true,
        response: { status: 401 }
      })
      mockedAxios.post.mockRejectedValueOnce(axiosError)
      mockedAxios.isAxiosError.mockReturnValue(true)

      const result = await authService.getAccessToken()

      expect(result).toBeNull()
    })

    it('throws error for unexpected errors', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Network error'))
      mockedAxios.isAxiosError.mockReturnValue(false)

      await expect(authService.getAccessToken()).rejects.toThrow('Network error')
    })
  })

  describe('logout', () => {
    it('calls logout endpoint and returns success (AC4)', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: {} })

      const result = await authService.logout()

      expect(result).toEqual({ success: true })
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/bff/logout'),
        {},
        { withCredentials: true }
      )
    })

    it('throws AuthError when backend returns structured error', async () => {
      const backendError: BackendAuthError = {
        detail: 'Session already expired',
        error_type: 'authentication_error'
      }
      const axiosError = {
        isAxiosError: true,
        response: {
          status: 401,
          data: backendError
        }
      } as AxiosError<BackendAuthError>

      mockedAxios.post.mockRejectedValueOnce(axiosError)
      mockedAxios.isAxiosError.mockReturnValue(true)

      await expect(authService.logout()).rejects.toEqual({
        type: 'session_expired',
        message: 'Session already expired'
      })
    })

    it('throws original error when no structured error available', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Network error'))
      mockedAxios.isAxiosError.mockReturnValue(false)

      await expect(authService.logout()).rejects.toThrow('Network error')
    })
  })

  describe('submitCredentials', () => {
    it('posts credentials to BFF login endpoint', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: {} })

      await authService.submitCredentials('test@example.com', 'password123')

      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/oauth/login'),
        { email: 'test@example.com', password: 'password123' },
        { withCredentials: true }
      )
    })

    it('resolves on 200 OK response', async () => {
      mockedAxios.post.mockResolvedValueOnce({ data: {} })

      await expect(
        authService.submitCredentials('test@example.com', 'password123')
      ).resolves.toBeUndefined()
    })

    it('throws error on 401 response (invalid credentials)', async () => {
      const axiosError = new Error('Unauthorized') as AxiosError
      Object.assign(axiosError, {
        isAxiosError: true,
        response: { status: 401 }
      })
      mockedAxios.post.mockRejectedValueOnce(axiosError)

      await expect(
        authService.submitCredentials('test@example.com', 'wrongpassword')
      ).rejects.toThrow()
    })

    it('throws error on 503 response (service unavailable)', async () => {
      const axiosError = new Error('Service Unavailable') as AxiosError
      Object.assign(axiosError, {
        isAxiosError: true,
        response: { status: 503 }
      })
      mockedAxios.post.mockRejectedValueOnce(axiosError)

      await expect(
        authService.submitCredentials('test@example.com', 'password123')
      ).rejects.toThrow()
    })

    it('throws error on network failure', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('Network error'))

      await expect(
        authService.submitCredentials('test@example.com', 'password123')
      ).rejects.toThrow('Network error')
    })
  })

  describe('mapErrorType', () => {
    it('maps authentication_error to session_expired', () => {
      expect(mapErrorType('authentication_error')).toBe('session_expired')
    })

    it('maps authorization_error to permission_denied', () => {
      expect(mapErrorType('authorization_error')).toBe('permission_denied')
    })

    it('maps auth_service_unavailable to service_unavailable', () => {
      expect(mapErrorType('auth_service_unavailable')).toBe('service_unavailable')
    })
  })

  describe('parseAuthError', () => {
    it('returns null when error has no response data', () => {
      const error = { response: undefined } as AxiosError<BackendAuthError>
      expect(parseAuthError(error)).toBeNull()
    })

    it('returns null when response has no error_type', () => {
      const error = {
        response: { data: { detail: 'Some error' } }
      } as AxiosError<BackendAuthError>
      expect(parseAuthError(error)).toBeNull()
    })

    it('parses authentication_error correctly', () => {
      const error = {
        response: {
          data: {
            detail: 'Session has expired',
            error_type: 'authentication_error'
          }
        }
      } as AxiosError<BackendAuthError>

      const result = parseAuthError(error)

      expect(result).toEqual({
        type: 'session_expired',
        message: 'Session has expired'
      })
    })

    it('includes retryAfter for service_unavailable errors', () => {
      const error = {
        response: {
          data: {
            detail: 'Auth service is down',
            error_type: 'auth_service_unavailable',
            retry_after: 30
          }
        }
      } as AxiosError<BackendAuthError>

      const result = parseAuthError(error)

      expect(result).toEqual({
        type: 'service_unavailable',
        message: 'Auth service is down',
        retryAfter: 30
      })
    })

    it('omits retryAfter when not present', () => {
      const error = {
        response: {
          data: {
            detail: 'Permission denied',
            error_type: 'authorization_error'
          }
        }
      } as AxiosError<BackendAuthError>

      const result = parseAuthError(error)

      expect(result).not.toHaveProperty('retryAfter')
      expect(result).toEqual({
        type: 'permission_denied',
        message: 'Permission denied'
      })
    })
  })
})
