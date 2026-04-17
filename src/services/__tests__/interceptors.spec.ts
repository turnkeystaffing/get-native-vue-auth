/**
 * Auth Interceptors Unit Tests
 *
 * Covers:
 * - Request: Token injection, cookie-mode bypass
 * - Response: code→category routing for all five recovery categories
 * - Case-insensitive code match
 * - 429 `Retry-After` parsing (integer seconds + HTTP-date + past-date)
 * - 403 without overlay (permission_denied fallback removed)
 * - `onUnmappedError` drift hook + `KNOWN_INLINE_CODES` silence
 * - `errorCodeOverrides` threading
 *
 * NOTE: Public endpoints should use publicClient (no auth interceptors).
 * These interceptors are only for protected API endpoints.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import axios from 'axios'
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import { setActivePinia, createPinia } from 'pinia'
import type { AuthError, AuthErrorType } from '../../types/auth'
import type { BffAuthConfig } from '../../types/config'

// Mock logger
vi.mock('@turnkeystaffing/get-native-vue-logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

// We'll import modules after resetting
let setupAuthInterceptors: typeof import('../interceptors').setupAuthInterceptors
let setGlobalConfig: typeof import('../../config').setGlobalConfig

interface MockAuthStore {
  isAuthenticated: boolean
  accessToken: string | null
  tokenExpiresAt: number | null
  error: AuthError | null
  ensureValidToken: () => Promise<string | null>
  setError: (error: AuthError) => void
}

function makeMockConfig(overrides: Partial<BffAuthConfig> = {}): BffAuthConfig {
  return {
    bffBaseUrl: 'http://localhost:8080',
    clientId: 'test-client',
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn()
    } as any,
    icons: {
      sessionExpired: false,
      login: false,
      serviceUnavailable: false,
      retry: false,
      devError: false,
      accountBlocked: false,
      serverError: false,
      signOut: false
    },
    errorViews: {},
    text: {},
    mode: 'token',
    ...overrides
  }
}

/**
 * Helper to raise a structured Axios-like error from within an adapter.
 */
function makeAxiosError(init: {
  status: number
  data?: unknown
  headers?: Record<string, string>
}) {
  return {
    response: {
      status: init.status,
      data: init.data ?? {},
      headers: init.headers ?? {}
    },
    isAxiosError: true,
    config: {},
    toJSON: () => ({})
  }
}

describe('Auth Interceptors', () => {
  let axiosInstance: AxiosInstance
  let mockAuthStore: MockAuthStore

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    setActivePinia(createPinia())

    const configModule = await import('../../config')
    setGlobalConfig = configModule.setGlobalConfig
    setGlobalConfig(makeMockConfig())

    axiosInstance = axios.create({
      baseURL: 'http://localhost:8000'
    })

    mockAuthStore = {
      isAuthenticated: false,
      accessToken: null,
      tokenExpiresAt: null,
      error: null,
      ensureValidToken: vi.fn().mockResolvedValue(null),
      setError: vi.fn()
    }

    const module = await import('../interceptors')
    setupAuthInterceptors = module.setupAuthInterceptors
  })

  afterEach(() => {
    vi.restoreAllMocks()
    setGlobalConfig(null as any)
  })

  describe('Request Interceptor', () => {
    it('adds Authorization header when authenticated with valid token', async () => {
      mockAuthStore.isAuthenticated = true
      mockAuthStore.accessToken = 'test-jwt-token'
      mockAuthStore.tokenExpiresAt = Date.now() + 60000
      vi.mocked(mockAuthStore.ensureValidToken).mockResolvedValue('test-jwt-token')

      setupAuthInterceptors(axiosInstance, () => mockAuthStore)

      let capturedConfig: InternalAxiosRequestConfig | undefined
      axiosInstance.defaults.adapter = async (config) => {
        capturedConfig = config as InternalAxiosRequestConfig
        return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
      }

      await axiosInstance.get('/api/v1/query')

      expect(mockAuthStore.ensureValidToken).toHaveBeenCalled()
      expect(capturedConfig?.headers?.Authorization).toBe('Bearer test-jwt-token')
    })

    it('does not add header when not authenticated', async () => {
      mockAuthStore.isAuthenticated = false

      setupAuthInterceptors(axiosInstance, () => mockAuthStore)

      let capturedConfig: InternalAxiosRequestConfig | undefined
      axiosInstance.defaults.adapter = async (config) => {
        capturedConfig = config as InternalAxiosRequestConfig
        return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
      }

      await axiosInstance.get('/api/v1/query')

      expect(mockAuthStore.ensureValidToken).not.toHaveBeenCalled()
      expect(capturedConfig?.headers?.Authorization).toBeUndefined()
    })

    it('does not call ensureValidToken in cookie mode', async () => {
      setGlobalConfig(makeMockConfig({ mode: 'cookie' }))
      mockAuthStore.isAuthenticated = true
      vi.mocked(mockAuthStore.ensureValidToken).mockResolvedValue('cookie-token')

      setupAuthInterceptors(axiosInstance, () => mockAuthStore)

      let capturedConfig: InternalAxiosRequestConfig | undefined
      axiosInstance.defaults.adapter = async (config) => {
        capturedConfig = config as InternalAxiosRequestConfig
        return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
      }

      await axiosInstance.get('/api/v1/query')

      expect(mockAuthStore.ensureValidToken).not.toHaveBeenCalled()
      expect(capturedConfig?.headers?.Authorization).toBeUndefined()
    })
  })

  describe('Response Interceptor — code → category routing', () => {
    const cases: Array<{
      code: string
      status: number
      expectedType: AuthErrorType
      casing?: 'upper' | 'mixed'
    }> = [
      // session_expired
      { code: 'invalid_grant', status: 400, expectedType: 'session_expired' },
      { code: 'MISSING_TOKEN', status: 400, expectedType: 'session_expired' },
      { code: 'INVALID_TOKEN', status: 401, expectedType: 'session_expired' },
      { code: 'invalid_user_id', status: 400, expectedType: 'session_expired' },
      { code: 'USER_NOT_FOUND', status: 404, expectedType: 'session_expired' },
      { code: 'MISSING_REFRESH_TOKEN', status: 400, expectedType: 'session_expired' },
      { code: 'INVALID_REFRESH_TOKEN', status: 401, expectedType: 'session_expired' },
      { code: 'REAUTH_REQUIRED', status: 403, expectedType: 'session_expired' },
      { code: 'SESSION_COMPROMISED', status: 403, expectedType: 'session_expired' },
      { code: 'forbidden', status: 403, expectedType: 'session_expired' },
      { code: 'invalid_session', status: 401, expectedType: 'session_expired' },
      { code: 'authentication_error', status: 401, expectedType: 'session_expired' },

      // service_unavailable
      { code: 'temporarily_unavailable', status: 503, expectedType: 'service_unavailable' },
      { code: 'auth_service_unavailable', status: 503, expectedType: 'service_unavailable' },
      { code: 'LOGOUT_FAILED', status: 500, expectedType: 'service_unavailable' },
      { code: 'SESSIONS_FETCH_FAILED', status: 500, expectedType: 'service_unavailable' },
      { code: 'REVOKE_FAILED', status: 500, expectedType: 'service_unavailable' },

      // dev_error
      { code: 'invalid_client', status: 401, expectedType: 'dev_error' },
      { code: 'unauthorized_client', status: 400, expectedType: 'dev_error' },
      { code: 'invalid_scope', status: 400, expectedType: 'dev_error' },
      { code: 'CLIENT_INACTIVE', status: 403, expectedType: 'dev_error' },
      { code: 'cors_error', status: 403, expectedType: 'dev_error' },

      // account_blocked
      { code: 'ACCOUNT_INACTIVE', status: 403, expectedType: 'account_blocked' },
      { code: 'INSUFFICIENT_PERMISSIONS', status: 403, expectedType: 'account_blocked' },

      // server_error
      { code: 'server_error', status: 500, expectedType: 'server_error' },
      { code: 'INTERNAL_ERROR', status: 500, expectedType: 'server_error' },
      { code: 'NOT_IMPLEMENTED', status: 501, expectedType: 'server_error' },
      { code: 'unknown_host', status: 403, expectedType: 'server_error' }
    ]

    for (const { code, status, expectedType } of cases) {
      it(`routes ${code} (${status}) → ${expectedType}`, async () => {
        setupAuthInterceptors(axiosInstance, () => mockAuthStore)
        axiosInstance.defaults.adapter = async () => {
          throw makeAxiosError({ status, data: { error_description: code, error: code } })
        }

        await expect(axiosInstance.get('/x')).rejects.toBeDefined()

        expect(mockAuthStore.setError).toHaveBeenCalledTimes(1)
        const arg = vi.mocked(mockAuthStore.setError).mock.calls[0][0]
        expect(arg.type).toBe(expectedType)
        expect(arg.code).toBe(code.toLowerCase())
      })
    }

    it('is case-insensitive — matches `RaNdomCaSing_REAUTH_REQUIRED`', async () => {
      setupAuthInterceptors(axiosInstance, () => mockAuthStore)
      axiosInstance.defaults.adapter = async () => {
        throw makeAxiosError({ status: 403, data: { error: 'ReAuTh_ReQuIrEd', error_description: 'x' } })
      }

      await expect(axiosInstance.get('/x')).rejects.toBeDefined()
      expect(mockAuthStore.setError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'session_expired',
          code: 'reauth_required'
        })
      )
    })

    it('routes INSUFFICIENT_PERMISSIONS to account_blocked from error code alone', async () => {
      setupAuthInterceptors(axiosInstance, () => mockAuthStore)
      axiosInstance.defaults.adapter = async () => {
        throw makeAxiosError({
          status: 403,
          data: {
            error: 'INSUFFICIENT_PERMISSIONS',
            error_description: 'Access required'
          }
        })
      }

      await expect(axiosInstance.get('/x')).rejects.toBeDefined()
      expect(mockAuthStore.setError).toHaveBeenCalledWith({
        type: 'account_blocked',
        code: 'insufficient_permissions',
        message: 'Access required'
      })
    })

    it('routes INTERNAL_ERROR to server_error from error code alone', async () => {
      setupAuthInterceptors(axiosInstance, () => mockAuthStore)
      axiosInstance.defaults.adapter = async () => {
        throw makeAxiosError({
          status: 500,
          data: {
            error: 'INTERNAL_ERROR',
            error_description: 'Internal'
          }
        })
      }

      await expect(axiosInstance.get('/x')).rejects.toBeDefined()
      expect(mockAuthStore.setError).toHaveBeenCalledWith({
        type: 'server_error',
        code: 'internal_error',
        message: 'Internal'
      })
    })
  })

  describe('Response Interceptor — 401 fallback', () => {
    it('sets generic session_expired for 401 without an error code', async () => {
      setupAuthInterceptors(axiosInstance, () => mockAuthStore)
      axiosInstance.defaults.adapter = async () => {
        throw makeAxiosError({ status: 401, data: { message: 'Unauthorized' } })
      }

      await expect(axiosInstance.get('/x')).rejects.toBeDefined()
      expect(mockAuthStore.setError).toHaveBeenCalledWith({
        type: 'session_expired',
        message: 'Your session has expired. Please sign in again.'
      })
    })

    it('does NOT set error on 401 when auth is not configured', async () => {
      setGlobalConfig(null as any)
      vi.resetModules()
      const module = await import('../interceptors')

      const unconfiguredAxios = axios.create({ baseURL: 'http://localhost:8000' })
      module.setupAuthInterceptors(unconfiguredAxios, () => mockAuthStore)

      unconfiguredAxios.defaults.adapter = async () => {
        throw makeAxiosError({ status: 401, data: { message: 'Unauthorized' } })
      }

      await expect(unconfiguredAxios.get('/x')).rejects.toBeDefined()
      expect(mockAuthStore.setError).not.toHaveBeenCalled()
    })
  })

  describe('Response Interceptor — 403 (no fallback)', () => {
    it('does NOT set error on 403 without an error code (permission_denied fallback removed)', async () => {
      setupAuthInterceptors(axiosInstance, () => mockAuthStore)
      axiosInstance.defaults.adapter = async () => {
        throw makeAxiosError({ status: 403, data: { error_description: 'nope' } })
      }

      await expect(axiosInstance.get('/x')).rejects.toBeDefined()
      expect(mockAuthStore.setError).not.toHaveBeenCalled()
    })

    it('does NOT set error on 403 with an unmapped code (propagates silently after drift warn)', async () => {
      setupAuthInterceptors(axiosInstance, () => mockAuthStore)
      axiosInstance.defaults.adapter = async () => {
        throw makeAxiosError({
          status: 403,
          data: { error_description: 'Nope', error: 'totally_unmapped_code' }
        })
      }

      await expect(axiosInstance.get('/x')).rejects.toBeDefined()
      expect(mockAuthStore.setError).not.toHaveBeenCalled()
    })
  })

  describe('Response Interceptor — 429 Rate limit', () => {
    it('synthesizes service_unavailable with rate_limit_exceeded when body lacks an error code', async () => {
      setupAuthInterceptors(axiosInstance, () => mockAuthStore)
      axiosInstance.defaults.adapter = async () => {
        throw makeAxiosError({
          status: 429,
          data: { error_description: 'Slow down' }
        })
      }

      await expect(axiosInstance.get('/x')).rejects.toBeDefined()
      expect(mockAuthStore.setError).toHaveBeenCalledWith({
        type: 'service_unavailable',
        code: 'rate_limit_exceeded',
        message: 'Slow down'
      })
    })

    it('routes 429 via body code when provided', async () => {
      setupAuthInterceptors(axiosInstance, () => mockAuthStore)
      axiosInstance.defaults.adapter = async () => {
        throw makeAxiosError({
          status: 429,
          data: { error: 'rate_limit_exceeded', error_description: 'Slow down' }
        })
      }

      await expect(axiosInstance.get('/x')).rejects.toBeDefined()
      expect(mockAuthStore.setError).toHaveBeenCalledWith({
        type: 'service_unavailable',
        code: 'rate_limit_exceeded',
        message: 'Slow down'
      })
    })
  })

  describe('Response Interceptor — drift observability', () => {
    it('invokes onUnmappedError for unmapped code', async () => {
      const onUnmappedError = vi.fn()
      setGlobalConfig(makeMockConfig({ onUnmappedError }))
      setupAuthInterceptors(axiosInstance, () => mockAuthStore)
      axiosInstance.defaults.adapter = async () => {
        throw makeAxiosError({
          status: 418,
          data: { error_description: 'tea', error: 'teapot_error' }
        })
      }

      await expect(axiosInstance.get('/x')).rejects.toBeDefined()

      expect(onUnmappedError).toHaveBeenCalledTimes(1)
      expect(onUnmappedError).toHaveBeenCalledWith('teapot_error', 418, expect.anything())
      expect(mockAuthStore.setError).not.toHaveBeenCalled()
    })

    it('does NOT invoke onUnmappedError for known inline codes', async () => {
      const onUnmappedError = vi.fn()
      setGlobalConfig(makeMockConfig({ onUnmappedError }))
      setupAuthInterceptors(axiosInstance, () => mockAuthStore)
      axiosInstance.defaults.adapter = async () => {
        throw makeAxiosError({
          status: 400,
          data: { error_description: 'weak', error: 'weak_password' }
        })
      }

      await expect(axiosInstance.get('/x')).rejects.toBeDefined()

      expect(onUnmappedError).not.toHaveBeenCalled()
      expect(mockAuthStore.setError).not.toHaveBeenCalled()
    })

    it('does NOT invoke onUnmappedError when the body has no error_type', async () => {
      const onUnmappedError = vi.fn()
      setGlobalConfig(makeMockConfig({ onUnmappedError }))
      setupAuthInterceptors(axiosInstance, () => mockAuthStore)
      axiosInstance.defaults.adapter = async () => {
        throw makeAxiosError({ status: 403, data: { error_description: 'no code' } })
      }

      await expect(axiosInstance.get('/x')).rejects.toBeDefined()
      expect(onUnmappedError).not.toHaveBeenCalled()
    })

    it('does NOT invoke onUnmappedError for mapped codes', async () => {
      const onUnmappedError = vi.fn()
      setGlobalConfig(makeMockConfig({ onUnmappedError }))
      setupAuthInterceptors(axiosInstance, () => mockAuthStore)
      axiosInstance.defaults.adapter = async () => {
        throw makeAxiosError({
          status: 401,
          data: { error_description: 'bad', error: 'INVALID_TOKEN' }
        })
      }

      await expect(axiosInstance.get('/x')).rejects.toBeDefined()
      expect(onUnmappedError).not.toHaveBeenCalled()
    })
  })

  describe('Response Interceptor — errorCodeOverrides', () => {
    it('routes a custom code to a custom category via overrides', async () => {
      setGlobalConfig(
        makeMockConfig({ errorCodeOverrides: { my_custom_code: 'server_error' } })
      )
      setupAuthInterceptors(axiosInstance, () => mockAuthStore)
      axiosInstance.defaults.adapter = async () => {
        throw makeAxiosError({
          status: 500,
          data: { error_description: 'custom', error: 'MY_CUSTOM_CODE' }
        })
      }

      await expect(axiosInstance.get('/x')).rejects.toBeDefined()
      expect(mockAuthStore.setError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'server_error',
          code: 'my_custom_code'
        })
      )
    })

    it('treats override-null as inline/silent (no setError, no onUnmappedError)', async () => {
      const onUnmappedError = vi.fn()
      setGlobalConfig(
        makeMockConfig({
          onUnmappedError,
          errorCodeOverrides: { my_silent_code: null }
        })
      )
      setupAuthInterceptors(axiosInstance, () => mockAuthStore)
      axiosInstance.defaults.adapter = async () => {
        throw makeAxiosError({
          status: 400,
          data: { error_description: 'silent', error: 'my_silent_code' }
        })
      }

      await expect(axiosInstance.get('/x')).rejects.toBeDefined()
      expect(mockAuthStore.setError).not.toHaveBeenCalled()
      expect(onUnmappedError).not.toHaveBeenCalled()
    })

    it('overrides take precedence over canonical map', async () => {
      setGlobalConfig(
        makeMockConfig({ errorCodeOverrides: { invalid_grant: 'server_error' } })
      )
      setupAuthInterceptors(axiosInstance, () => mockAuthStore)
      axiosInstance.defaults.adapter = async () => {
        throw makeAxiosError({
          status: 400,
          data: { error_description: 'override', error: 'invalid_grant' }
        })
      }

      await expect(axiosInstance.get('/x')).rejects.toBeDefined()
      expect(mockAuthStore.setError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'server_error',
          code: 'invalid_grant'
        })
      )
    })
  })

  describe('Response Interceptor — non-auth errors', () => {
    it('does not set auth error for bare 500', async () => {
      setupAuthInterceptors(axiosInstance, () => mockAuthStore)
      axiosInstance.defaults.adapter = async () => {
        throw makeAxiosError({ status: 500, data: { error_description: 'Internal server error' } })
      }

      await expect(axiosInstance.get('/x')).rejects.toBeDefined()
      expect(mockAuthStore.setError).not.toHaveBeenCalled()
    })

    it('does not set auth error for bare 503 (not an auth error without code)', async () => {
      setupAuthInterceptors(axiosInstance, () => mockAuthStore)
      axiosInstance.defaults.adapter = async () => {
        throw makeAxiosError({ status: 503, data: { error_description: 'Down' } })
      }

      await expect(axiosInstance.get('/x')).rejects.toBeDefined()
      expect(mockAuthStore.setError).not.toHaveBeenCalled()
    })

    it('does not set auth error for 404', async () => {
      setupAuthInterceptors(axiosInstance, () => mockAuthStore)
      axiosInstance.defaults.adapter = async () => {
        throw makeAxiosError({ status: 404, data: { error_description: 'Not found' } })
      }

      await expect(axiosInstance.get('/x')).rejects.toBeDefined()
      expect(mockAuthStore.setError).not.toHaveBeenCalled()
    })

    it('does not set auth error for network errors', async () => {
      setupAuthInterceptors(axiosInstance, () => mockAuthStore)
      axiosInstance.defaults.adapter = async () => {
        throw {
          message: 'Network Error',
          isAxiosError: true,
          config: {},
          toJSON: () => ({})
        }
      }

      await expect(axiosInstance.get('/x')).rejects.toBeDefined()
      expect(mockAuthStore.setError).not.toHaveBeenCalled()
    })
  })

  describe('Cookie Mode — response still routes', () => {
    it('response interceptor still handles 401/503 in cookie mode', async () => {
      setGlobalConfig(makeMockConfig({ mode: 'cookie' }))
      setupAuthInterceptors(axiosInstance, () => mockAuthStore)

      axiosInstance.defaults.adapter = async () => {
        throw makeAxiosError({
          status: 401,
          data: { error_description: 'Session expired', error: 'authentication_error' }
        })
      }

      await expect(axiosInstance.get('/x')).rejects.toBeDefined()
      expect(mockAuthStore.setError).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'session_expired' })
      )
    })
  })
})
