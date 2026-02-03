/**
 * Auth Navigation Guards
 *
 * Provides route protection and auth initialization for Vue Router.
 * Implements FR1 (Central Login redirect) and FR4 (authenticated access).
 * FR3 (return URL preservation) is handled by BFF via redirect_url parameter.
 *
 * @see ADR-005 Auth state structure
 * @see PAT-003 Frontend file organization
 */

import type { Router, RouteLocationNormalized, NavigationGuard } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { authService, AuthConfigurationError } from '../services/auth'
import { createLogger } from '@turnkeystaffing/get-native-vue-logger'

/**
 * Logger for auth guard operations
 */
const logger = createLogger('AuthGuard')

/**
 * Check if route is marked as public
 * Public routes bypass authentication check
 *
 * @param route - Route location to check
 * @returns True if route has meta.public = true
 */
function isPublicRoute(route: RouteLocationNormalized): boolean {
  return route.meta.public === true
}

/**
 * Wait for auth store to finish loading
 * Polls until isLoading becomes false (max 10 seconds)
 *
 * @param authStore - Pinia auth store instance
 * @returns true if auth completed, false if timed out
 */
async function waitForAuthInit(
  authStore: ReturnType<typeof useAuthStore>
): Promise<boolean> {
  // If already not loading, return immediately
  if (!authStore.isLoading) {
    return true
  }

  // Wait for loading to complete (poll every 50ms, max 10 seconds)
  let attempts = 0
  const maxAttempts = 200

  while (authStore.isLoading && attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, 50))
    attempts++
  }

  // Check if we timed out
  if (authStore.isLoading) {
    logger.warn('Auth initialization timed out after 10 seconds')
    return false
  }

  return true
}

/**
 * Auth guard dependencies for dependency injection
 */
export interface AuthGuardDependencies {
  getAuthStore: () => ReturnType<typeof useAuthStore>
  getAuthService: () => typeof authService
}

/**
 * Default dependencies using actual implementations
 */
const defaultDependencies: AuthGuardDependencies = {
  getAuthStore: () => useAuthStore(),
  getAuthService: () => authService
}

/**
 * Create auth navigation guard with encapsulated state
 *
 * Uses factory pattern to encapsulate initialization state in closure,
 * enabling clean testing without module-level state pollution.
 *
 * @param deps - Dependencies (for testing injection)
 * @returns Navigation guard function
 */
export function createAuthGuard(
  deps: AuthGuardDependencies = defaultDependencies
): NavigationGuard {
  // Initialization state is closure-scoped, not module-scoped
  let initialized = false

  return async (to) => {
    const authStore = deps.getAuthStore()
    const authSvc = deps.getAuthService()

    try {
      // Public routes bypass auth check entirely
      if (isPublicRoute(to)) {
        return true
      }

      // Initialize auth on first navigation (only once per guard instance)
      if (!initialized) {
        initialized = true
        try {
          await authStore.initAuth()
        } catch (error) {
          logger.error('Failed to initialize auth:', error)
          // Continue - user will be treated as unauthenticated
        }
      }

      // Wait for any pending auth operations to complete
      const authReady = await waitForAuthInit(authStore)

      // If auth timed out, treat as unauthenticated (fail closed for security)
      if (!authReady) {
        logger.warn('Auth not ready, redirecting to login')
        authSvc.login({ returnUrl: to.fullPath })
        return false
      }

      // Check authentication status
      if (authStore.isAuthenticated) {
        return true
      }

      // Not authenticated - redirect to Central Login (BFF handles return URL via redirect_url param)
      authSvc.login({ returnUrl: to.fullPath })

      // Return false to cancel navigation (page will redirect to Central Login)
      return false
    } catch (error) {
      // Handle configuration errors differently - don't redirect (would cause infinite loop)
      if (error instanceof AuthConfigurationError) {
        logger.error('Auth configuration error:', error.message)
        authStore.setError({
          type: 'service_unavailable',
          message: error.message
        })
        // Allow navigation but show error overlay instead of redirecting
        return true
      }

      // Unexpected error - fail closed (redirect to login for security)
      logger.error('Unexpected error in auth guard:', error)
      authSvc.login({ returnUrl: to.fullPath })
      return false
    }
  }
}

/**
 * Setup auth navigation guard on router
 *
 * This guard:
 * 1. Initializes auth on first navigation (once per app lifecycle)
 * 2. Allows public routes without auth check
 * 3. Waits for auth loading to complete
 * 4. Redirects unauthenticated users to Central Login (BFF handles return URL)
 *
 * @param router - Vue Router instance
 */
export function setupAuthGuard(router: Router): void {
  router.beforeEach(createAuthGuard())
}

/**
 * TypeScript augmentation for Vue Router RouteMeta
 * Adds the 'public' property for marking routes that don't require auth
 */
declare module 'vue-router' {
  interface RouteMeta {
    /** Mark route as public (no auth required) */
    public?: boolean
  }
}
