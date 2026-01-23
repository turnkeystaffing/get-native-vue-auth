/**
 * Auth Route Guards Unit Tests
 *
 * Tests for the auth navigation guard implementation.
 * Uses factory pattern with dependency injection for clean testing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import { createAuthGuard, setupAuthGuard, type AuthGuardDependencies } from '../guards'
import { useAuthStore } from '../../stores/auth'

// Mock logger
vi.mock('@get-native/get-native-vue-logger', () => ({
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
    initiateLogin: vi.fn(),
    logout: vi.fn()
  },
  AuthConfigurationError: class AuthConfigurationError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'AuthConfigurationError'
    }
  }
}))

describe('Auth Guards', () => {
  let router: Router

  function createTestRouter() {
    return createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'home', component: { template: '<div>Home</div>' } },
        {
          path: '/public',
          name: 'public',
          component: { template: '<div>Public</div>' },
          meta: { public: true }
        },
        {
          path: '/protected',
          name: 'protected',
          component: { template: '<div>Protected</div>' }
        },
        {
          path: '/dashboard',
          name: 'dashboard',
          component: { template: '<div>Dashboard</div>' }
        }
      ]
    })
  }

  /**
   * Mock store interface for testing
   */
  interface MockStore {
    isAuthenticated: boolean
    isLoading: boolean
    initAuth: ReturnType<typeof vi.fn>
    $patch: ReturnType<typeof vi.fn>
  }

  /**
   * Mock service interface for testing
   */
  interface MockService {
    initiateLogin: ReturnType<typeof vi.fn>
  }

  /**
   * Create mock dependencies for testing
   */
  function createMockDeps(overrides: {
    isAuthenticated?: boolean
    isLoading?: boolean
    initAuth?: () => Promise<void>
  } = {}): { deps: AuthGuardDependencies; mocks: { store: MockStore; service: MockService } } {
    const store: MockStore = {
      isAuthenticated: overrides.isAuthenticated ?? false,
      isLoading: overrides.isLoading ?? false,
      initAuth: overrides.initAuth
        ? vi.fn(overrides.initAuth)
        : vi.fn().mockResolvedValue(undefined),
      $patch: vi.fn((patch: { isAuthenticated?: boolean; isLoading?: boolean }) => {
        if (patch.isAuthenticated !== undefined) store.isAuthenticated = patch.isAuthenticated
        if (patch.isLoading !== undefined) store.isLoading = patch.isLoading
      })
    }

    const service: MockService = {
      initiateLogin: vi.fn()
    }

    return {
      deps: {
        getAuthStore: () => store as unknown as ReturnType<typeof useAuthStore>,
        getAuthService: () => service as unknown as typeof import('../../services/auth').authService
      },
      mocks: { store, service }
    }
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    router = createTestRouter()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('authenticated user', () => {
    it('allows navigation to protected routes', async () => {
      const { deps, mocks } = createMockDeps({ isAuthenticated: true })
      router.beforeEach(createAuthGuard(deps))

      await router.push('/protected')

      expect(router.currentRoute.value.path).toBe('/protected')
      expect(mocks.service.initiateLogin).not.toHaveBeenCalled()
    })

    it('allows navigation to home route', async () => {
      const { deps, mocks } = createMockDeps({ isAuthenticated: true })
      router.beforeEach(createAuthGuard(deps))

      await router.push('/')

      expect(router.currentRoute.value.path).toBe('/')
      expect(mocks.service.initiateLogin).not.toHaveBeenCalled()
    })

    it('allows navigation to public routes', async () => {
      const { deps, mocks } = createMockDeps({ isAuthenticated: true })
      router.beforeEach(createAuthGuard(deps))

      await router.push('/public')

      expect(router.currentRoute.value.path).toBe('/public')
      expect(mocks.service.initiateLogin).not.toHaveBeenCalled()
    })
  })

  describe('unauthenticated user', () => {
    it('redirects to login for protected routes', async () => {
      const { deps, mocks } = createMockDeps({ isAuthenticated: false })
      router.beforeEach(createAuthGuard(deps))

      await router.push('/protected')

      expect(mocks.service.initiateLogin).toHaveBeenCalledWith('/protected')
    })

    it('redirects to login for home route (protected by default)', async () => {
      const { deps, mocks } = createMockDeps({ isAuthenticated: false })
      router.beforeEach(createAuthGuard(deps))

      await router.push('/')

      expect(mocks.service.initiateLogin).toHaveBeenCalledWith('/')
    })

    it('passes return URL with query parameters to initiateLogin', async () => {
      const { deps, mocks } = createMockDeps({ isAuthenticated: false })
      router.beforeEach(createAuthGuard(deps))

      await router.push('/protected?query=1&filter=active')

      expect(mocks.service.initiateLogin).toHaveBeenCalledWith('/protected?query=1&filter=active')
    })

    it('passes return URL with hash to initiateLogin', async () => {
      const { deps, mocks } = createMockDeps({ isAuthenticated: false })
      router.beforeEach(createAuthGuard(deps))

      await router.push('/dashboard#section')

      expect(mocks.service.initiateLogin).toHaveBeenCalledWith('/dashboard#section')
    })
  })

  describe('public routes', () => {
    it('allows navigation without auth check for unauthenticated users', async () => {
      const { deps, mocks } = createMockDeps({ isAuthenticated: false })
      router.beforeEach(createAuthGuard(deps))

      await router.push('/public')

      expect(router.currentRoute.value.path).toBe('/public')
      expect(mocks.service.initiateLogin).not.toHaveBeenCalled()
    })

    it('allows navigation for authenticated users', async () => {
      const { deps } = createMockDeps({ isAuthenticated: true })
      router.beforeEach(createAuthGuard(deps))

      await router.push('/public')

      expect(router.currentRoute.value.path).toBe('/public')
    })
  })

  describe('auth initialization', () => {
    it('calls initAuth on first navigation', async () => {
      const { deps, mocks } = createMockDeps({ isAuthenticated: true })
      router.beforeEach(createAuthGuard(deps))

      await router.push('/protected')

      expect(mocks.store.initAuth).toHaveBeenCalledTimes(1)
    })

    it('does not call initAuth on subsequent navigations', async () => {
      const { deps, mocks } = createMockDeps({ isAuthenticated: true })
      router.beforeEach(createAuthGuard(deps))

      await router.push('/protected')
      await router.push('/dashboard')

      expect(mocks.store.initAuth).toHaveBeenCalledTimes(1)
    })

    it('each guard instance has independent initialization state', async () => {
      // First guard instance
      const { deps: deps1, mocks: mocks1 } = createMockDeps({ isAuthenticated: true })
      const router1 = createTestRouter()
      router1.beforeEach(createAuthGuard(deps1))
      await router1.push('/protected')

      // Second guard instance (fresh state)
      const { deps: deps2, mocks: mocks2 } = createMockDeps({ isAuthenticated: true })
      const router2 = createTestRouter()
      router2.beforeEach(createAuthGuard(deps2))
      await router2.push('/protected')

      // Both should have called initAuth independently
      expect(mocks1.store.initAuth).toHaveBeenCalledTimes(1)
      expect(mocks2.store.initAuth).toHaveBeenCalledTimes(1)
    })
  })

  describe('loading state handling', () => {
    it('waits for auth loading to complete before checking', async () => {
      let loadingComplete = false
      const { deps, mocks } = createMockDeps({
        isLoading: true,
        isAuthenticated: false,
        initAuth: async () => {
          await new Promise((resolve) => setTimeout(resolve, 50))
          mocks.store.isLoading = false
          mocks.store.isAuthenticated = true
          loadingComplete = true
        }
      })

      router.beforeEach(createAuthGuard(deps))
      await router.push('/protected')

      expect(loadingComplete).toBe(true)
    })
  })

  describe('error handling', () => {
    it('redirects to login when initAuth throws an error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { deps, mocks } = createMockDeps({
        isAuthenticated: false,
        initAuth: vi.fn().mockRejectedValue(new Error('Network error'))
      })

      router.beforeEach(createAuthGuard(deps))
      await router.push('/protected')

      expect(mocks.service.initiateLogin).toHaveBeenCalledWith('/protected')
      consoleSpy.mockRestore()
    })

    it('allows public routes even when initAuth throws', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { deps, mocks } = createMockDeps({
        isAuthenticated: false,
        initAuth: vi.fn().mockRejectedValue(new Error('Network error'))
      })

      router.beforeEach(createAuthGuard(deps))
      await router.push('/public')

      expect(router.currentRoute.value.path).toBe('/public')
      expect(mocks.service.initiateLogin).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('redirects to login when auth times out (stuck loading)', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const { deps, mocks } = createMockDeps({
        isLoading: true, // Will stay true (stuck)
        isAuthenticated: false,
        initAuth: vi.fn().mockResolvedValue(undefined) // Doesn't change isLoading
      })

      vi.useFakeTimers()

      router.beforeEach(createAuthGuard(deps))
      const pushPromise = router.push('/protected')

      // Fast-forward past the 10 second timeout
      await vi.advanceTimersByTimeAsync(10100)
      await pushPromise

      expect(mocks.service.initiateLogin).toHaveBeenCalledWith('/protected')

      vi.useRealTimers()
      consoleSpy.mockRestore()
    })
  })

  describe('setupAuthGuard integration', () => {
    it('works with real Pinia store', async () => {
      const authStore = useAuthStore()
      vi.spyOn(authStore, 'initAuth').mockImplementation(async () => {
        authStore.$patch({ isAuthenticated: true, isLoading: false })
      })

      setupAuthGuard(router)
      await router.push('/protected')

      expect(router.currentRoute.value.path).toBe('/protected')
    })
  })
})
