/**
 * Auth Interceptors Unit Tests
 *
 * Tests for Axios interceptors that handle:
 * - Request: Token injection for authenticated users (AC1)
 * - Response: Auth error handling (AC2, AC3, AC4)
 *
 * NOTE: Public endpoints should use publicClient (no auth interceptors).
 * These interceptors are only for protected API endpoints.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import axios from 'axios'
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import { setActivePinia, createPinia } from 'pinia'
import type { AuthError } from '../../types/auth'
import type { BffAuthConfig } from '../../types/config'

// Mock logger
vi.mock('@get-native/get-native-vue-logger', () => ({
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

// Mock auth store type
interface MockAuthStore {
  isAuthenticated: boolean
  accessToken: string | null
  tokenExpiresAt: number | null
  error: AuthError | null
  ensureValidToken: () => Promise<string | null>
  setError: (error: AuthError) => void
}

describe('Auth Interceptors', () => {
  let axiosInstance: AxiosInstance
  let mockAuthStore: MockAuthStore

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    setActivePinia(createPinia())

    // Import config module fresh (after resetModules)
    const configModule = await import('../../config')
    setGlobalConfig = configModule.setGlobalConfig

    // Set global config so isAuthConfigured is true
    const mockConfig: BffAuthConfig = {
      bffBaseUrl: 'http://localhost:8080',
      clientId: 'test-client',
      tokenClientId: 'test-token-client',
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      } as any
    }
    setGlobalConfig(mockConfig)

    // Create fresh axios instance for each test
    axiosInstance = axios.create({
      baseURL: 'http://localhost:8000'
    })

    // Create mock auth store
    mockAuthStore = {
      isAuthenticated: false,
      accessToken: null,
      tokenExpiresAt: null,
      error: null,
      ensureValidToken: vi.fn().mockResolvedValue(null),
      setError: vi.fn()
    }

    // Import module fresh
    const module = await import('../interceptors')
    setupAuthInterceptors = module.setupAuthInterceptors
  })

  afterEach(() => {
    vi.restoreAllMocks()
    setGlobalConfig(null as any)
  })

  describe('Request Interceptor', () => {
    describe('Token Injection (AC1)', () => {
      it('adds Authorization header when authenticated with valid token', async () => {
        // Setup authenticated state
        mockAuthStore.isAuthenticated = true
        mockAuthStore.accessToken = 'test-jwt-token'
        mockAuthStore.tokenExpiresAt = Date.now() + 60000 // Valid for 60s
        vi.mocked(mockAuthStore.ensureValidToken).mockResolvedValue('test-jwt-token')

        // Setup interceptors
        setupAuthInterceptors(axiosInstance, () => mockAuthStore)

        // Use adapter to capture the final config (after all interceptors run)
        let capturedConfig: InternalAxiosRequestConfig | undefined
        axiosInstance.defaults.adapter = async (config) => {
          capturedConfig = config as InternalAxiosRequestConfig
          return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
        }

        await axiosInstance.get('/api/v1/query')

        expect(mockAuthStore.ensureValidToken).toHaveBeenCalled()
        expect(capturedConfig?.headers?.Authorization).toBe('Bearer test-jwt-token')
      })

      it('calls ensureValidToken() before adding header (AC1)', async () => {
        mockAuthStore.isAuthenticated = true
        mockAuthStore.accessToken = 'old-token'
        // Return refreshed token
        vi.mocked(mockAuthStore.ensureValidToken).mockResolvedValue('refreshed-token')

        setupAuthInterceptors(axiosInstance, () => mockAuthStore)

        let capturedConfig: InternalAxiosRequestConfig | undefined
        axiosInstance.defaults.adapter = async (config) => {
          capturedConfig = config as InternalAxiosRequestConfig
          return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
        }

        await axiosInstance.get('/api/v1/query')

        expect(mockAuthStore.ensureValidToken).toHaveBeenCalledTimes(1)
        expect(capturedConfig?.headers?.Authorization).toBe('Bearer refreshed-token')
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

      it('continues without token when ensureValidToken returns null', async () => {
        mockAuthStore.isAuthenticated = true
        vi.mocked(mockAuthStore.ensureValidToken).mockResolvedValue(null)

        setupAuthInterceptors(axiosInstance, () => mockAuthStore)

        let capturedConfig: InternalAxiosRequestConfig | undefined
        axiosInstance.defaults.adapter = async (config) => {
          capturedConfig = config as InternalAxiosRequestConfig
          return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
        }

        await axiosInstance.get('/api/v1/query')

        expect(capturedConfig?.headers?.Authorization).toBeUndefined()
      })

      it('continues without token when ensureValidToken throws', async () => {
        mockAuthStore.isAuthenticated = true
        vi.mocked(mockAuthStore.ensureValidToken).mockRejectedValue(new Error('Token refresh failed'))

        setupAuthInterceptors(axiosInstance, () => mockAuthStore)

        let capturedConfig: InternalAxiosRequestConfig | undefined
        axiosInstance.defaults.adapter = async (config) => {
          capturedConfig = config as InternalAxiosRequestConfig
          return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
        }

        await axiosInstance.get('/api/v1/query')

        // Should continue without token - let server return 401
        expect(capturedConfig?.headers?.Authorization).toBeUndefined()
      })
    })

  })

  describe('Response Interceptor', () => {
    describe('401 Handling (AC2)', () => {
      it('sets session_expired error on 401 with structured error', async () => {
        setupAuthInterceptors(axiosInstance, () => mockAuthStore)

        // Mock adapter to return 401
        axiosInstance.defaults.adapter = async () => {
          const error = {
            response: {
              status: 401,
              data: {
                detail: 'Token has expired',
                error_type: 'authentication_error'
              },
              headers: {}
            },
            isAxiosError: true,
            config: {},
            toJSON: () => ({})
          }
          throw error
        }

        await expect(axiosInstance.get('/api/v1/query')).rejects.toMatchObject({
          response: { status: 401 }
        })

        expect(mockAuthStore.setError).toHaveBeenCalledWith({
          type: 'session_expired',
          message: 'Token has expired'
        })
      })

      it('sets session_expired error on 401 without structured error (fallback)', async () => {
        setupAuthInterceptors(axiosInstance, () => mockAuthStore)

        axiosInstance.defaults.adapter = async () => {
          const error = {
            response: {
              status: 401,
              data: { message: 'Unauthorized' }, // No error_type
              headers: {}
            },
            isAxiosError: true,
            config: {},
            toJSON: () => ({})
          }
          throw error
        }

        await expect(axiosInstance.get('/api/v1/query')).rejects.toMatchObject({
          response: { status: 401 }
        })

        expect(mockAuthStore.setError).toHaveBeenCalledWith({
          type: 'session_expired',
          message: 'Your session has expired. Please sign in again.'
        })
      })

      it('propagates error to caller after setting store state', async () => {
        setupAuthInterceptors(axiosInstance, () => mockAuthStore)

        axiosInstance.defaults.adapter = async () => {
          throw {
            response: { status: 401, data: {}, headers: {} },
            isAxiosError: true,
            config: {},
            toJSON: () => ({})
          }
        }

        // Error should be propagated
        await expect(axiosInstance.get('/api/v1/query')).rejects.toBeDefined()

        // And store should be updated
        expect(mockAuthStore.setError).toHaveBeenCalled()
      })

      it('does NOT set session_expired on 401 when auth is not configured (no structured error)', async () => {
        // Reset config to simulate unconfigured auth
        setGlobalConfig(null as any)
        vi.resetModules()

        // Re-import with no config
        const module = await import('../interceptors')
        const setupInterceptors = module.setupAuthInterceptors

        // Create fresh axios instance
        const unconfiguredAxios = axios.create({ baseURL: 'http://localhost:8000' })
        setupInterceptors(unconfiguredAxios, () => mockAuthStore)

        unconfiguredAxios.defaults.adapter = async () => {
          throw {
            response: {
              status: 401,
              data: { message: 'Unauthorized' }, // No error_type
              headers: {}
            },
            isAxiosError: true,
            config: {},
            toJSON: () => ({})
          }
        }

        await expect(unconfiguredAxios.get('/api/v1/query')).rejects.toMatchObject({
          response: { status: 401 }
        })

        // Should NOT set session_expired when auth isn't configured
        // This prevents overwriting service_unavailable from earlier guards
        expect(mockAuthStore.setError).not.toHaveBeenCalled()
      })
    })

    describe('403 Handling (AC3)', () => {
      it('sets permission_denied error on 403 with structured error', async () => {
        setupAuthInterceptors(axiosInstance, () => mockAuthStore)

        axiosInstance.defaults.adapter = async () => {
          throw {
            response: {
              status: 403,
              data: {
                detail: 'Insufficient permissions for admin resource',
                error_type: 'authorization_error'
              },
              headers: {}
            },
            isAxiosError: true,
            config: {},
            toJSON: () => ({})
          }
        }

        await expect(axiosInstance.get('/api/v1/admin')).rejects.toMatchObject({
          response: { status: 403 }
        })

        expect(mockAuthStore.setError).toHaveBeenCalledWith({
          type: 'permission_denied',
          message: 'Insufficient permissions for admin resource'
        })
      })

      it('sets permission_denied error on 403 without structured error (fallback)', async () => {
        setupAuthInterceptors(axiosInstance, () => mockAuthStore)

        axiosInstance.defaults.adapter = async () => {
          throw {
            response: {
              status: 403,
              data: { detail: 'Access forbidden' }, // Has detail but no error_type
              headers: {}
            },
            isAxiosError: true,
            config: {},
            toJSON: () => ({})
          }
        }

        await expect(axiosInstance.get('/api/v1/admin')).rejects.toBeDefined()

        expect(mockAuthStore.setError).toHaveBeenCalledWith({
          type: 'permission_denied',
          message: 'Access forbidden'
        })
      })

      it('uses generic message when 403 has no detail', async () => {
        setupAuthInterceptors(axiosInstance, () => mockAuthStore)

        axiosInstance.defaults.adapter = async () => {
          throw {
            response: {
              status: 403,
              data: {}, // No detail
              headers: {}
            },
            isAxiosError: true,
            config: {},
            toJSON: () => ({})
          }
        }

        await expect(axiosInstance.get('/api/v1/admin')).rejects.toBeDefined()

        expect(mockAuthStore.setError).toHaveBeenCalledWith({
          type: 'permission_denied',
          message: 'Permission denied'
        })
      })

      it('propagates error to caller after setting store state', async () => {
        setupAuthInterceptors(axiosInstance, () => mockAuthStore)

        axiosInstance.defaults.adapter = async () => {
          throw {
            response: { status: 403, data: {}, headers: {} },
            isAxiosError: true,
            config: {},
            toJSON: () => ({})
          }
        }

        await expect(axiosInstance.get('/api/v1/admin')).rejects.toBeDefined()
        expect(mockAuthStore.setError).toHaveBeenCalled()
      })
    })

    describe('503 Auth Service Unavailable (AC4)', () => {
      it('sets service_unavailable error with retryAfter on 503 auth error', async () => {
        setupAuthInterceptors(axiosInstance, () => mockAuthStore)

        axiosInstance.defaults.adapter = async () => {
          throw {
            response: {
              status: 503,
              data: {
                detail: 'Auth service temporarily unavailable',
                error_type: 'auth_service_unavailable',
                retry_after: 30
              },
              headers: {
                'retry-after': '30'
              }
            },
            isAxiosError: true,
            config: {},
            toJSON: () => ({})
          }
        }

        await expect(axiosInstance.get('/api/v1/query')).rejects.toMatchObject({
          response: { status: 503 }
        })

        expect(mockAuthStore.setError).toHaveBeenCalledWith({
          type: 'service_unavailable',
          message: 'Auth service temporarily unavailable',
          retryAfter: 30
        })
      })

      it('does NOT set auth error for generic 503 (non-auth)', async () => {
        setupAuthInterceptors(axiosInstance, () => mockAuthStore)

        axiosInstance.defaults.adapter = async () => {
          throw {
            response: {
              status: 503,
              data: {
                detail: 'Service temporarily unavailable'
                // No error_type - this is NOT an auth error
              },
              headers: {}
            },
            isAxiosError: true,
            config: {},
            toJSON: () => ({})
          }
        }

        await expect(axiosInstance.get('/api/v1/query')).rejects.toBeDefined()

        // Auth error should NOT be set for generic 503
        expect(mockAuthStore.setError).not.toHaveBeenCalled()
      })

      it('propagates error to caller after setting store state', async () => {
        setupAuthInterceptors(axiosInstance, () => mockAuthStore)

        axiosInstance.defaults.adapter = async () => {
          throw {
            response: {
              status: 503,
              data: {
                detail: 'Auth service down',
                error_type: 'auth_service_unavailable'
              },
              headers: {}
            },
            isAxiosError: true,
            config: {},
            toJSON: () => ({})
          }
        }

        await expect(axiosInstance.get('/api/v1/query')).rejects.toBeDefined()
        expect(mockAuthStore.setError).toHaveBeenCalled()
      })
    })

    describe('Non-auth errors', () => {
      it('does not set auth error for 500 errors', async () => {
        setupAuthInterceptors(axiosInstance, () => mockAuthStore)

        axiosInstance.defaults.adapter = async () => {
          throw {
            response: {
              status: 500,
              data: { detail: 'Internal server error' },
              headers: {}
            },
            isAxiosError: true,
            config: {},
            toJSON: () => ({})
          }
        }

        await expect(axiosInstance.get('/api/v1/query')).rejects.toBeDefined()
        expect(mockAuthStore.setError).not.toHaveBeenCalled()
      })

      it('does not set auth error for 404 errors', async () => {
        setupAuthInterceptors(axiosInstance, () => mockAuthStore)

        axiosInstance.defaults.adapter = async () => {
          throw {
            response: {
              status: 404,
              data: { detail: 'Not found' },
              headers: {}
            },
            isAxiosError: true,
            config: {},
            toJSON: () => ({})
          }
        }

        await expect(axiosInstance.get('/api/v1/missing')).rejects.toBeDefined()
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
            // No response - network error
          }
        }

        await expect(axiosInstance.get('/api/v1/query')).rejects.toBeDefined()
        expect(mockAuthStore.setError).not.toHaveBeenCalled()
      })
    })
  })

  describe('Concurrent Request Handling', () => {
    it('multiple concurrent requests each call ensureValidToken (deduplication in store)', async () => {
      mockAuthStore.isAuthenticated = true

      // ensureValidToken should be called for each request
      // The deduplication happens in the auth store, not interceptor
      let callCount = 0
      vi.mocked(mockAuthStore.ensureValidToken).mockImplementation(async () => {
        callCount++
        return 'shared-token'
      })

      setupAuthInterceptors(axiosInstance, () => mockAuthStore)

      const capturedConfigs: InternalAxiosRequestConfig[] = []
      axiosInstance.defaults.adapter = async (config) => {
        capturedConfigs.push(config as InternalAxiosRequestConfig)
        return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
      }

      // Make 3 concurrent requests
      const requests = [
        axiosInstance.get('/api/v1/query1'),
        axiosInstance.get('/api/v1/query2'),
        axiosInstance.get('/api/v1/query3')
      ]

      await Promise.all(requests)

      // Each request calls ensureValidToken (deduplication is in store)
      expect(callCount).toBe(3)

      // All requests should have the same token
      expect(capturedConfigs).toHaveLength(3)
      capturedConfigs.forEach((config) => {
        expect(config.headers?.Authorization).toBe('Bearer shared-token')
      })
    })
  })
})
