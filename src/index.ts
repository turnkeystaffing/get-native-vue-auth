/**
 * @turnkeystaffing/get-native-vue-auth
 *
 * Vue plugin for BFF (Backend-for-Frontend) authentication.
 * Provides a complete authentication solution including:
 * - Pinia store for auth state management
 * - Vue composable for component integration
 * - Axios interceptors for automatic token injection
 * - Vue Router guards for route protection
 * - Pre-built UI components for auth error handling
 *
 * @see README.md for usage instructions
 */

// Plugin
export { bffAuthPlugin } from './plugin'

// Config
export { useAuthConfig, BFF_AUTH_CONFIG_KEY, getGlobalConfig, setGlobalConfig } from './config'

// Store
export { useAuthStore } from './stores/auth'
export type { AuthState, AuthStore } from './stores/auth'

// Composable
export { useAuth } from './composables/useAuth'
export type { UseAuth } from './composables/useAuth'

// Services
export {
  authService,
  useAuthService,
  AuthService,
  AuthConfigurationError,
  parseAuthError,
  mapErrorType,
  isAuthConfigured
} from './services/auth'
export type { LoginCredentials } from './services/auth'

// Interceptors
export { setupAuthInterceptors } from './services/interceptors'
export type { AuthStoreInterface } from './services/interceptors'

// Router guards
export { setupAuthGuard, createAuthGuard } from './router/guards'
export type { AuthGuardDependencies } from './router/guards'

// JWT utilities
export { decodeJwt, extractEmailFromJwt } from './utils/jwt'
export type { JwtPayload } from './utils/jwt'

// Types
export type {
  UserInfo,
  CheckAuthResponse,
  TokenResponse,
  AuthError,
  AuthErrorType,
  BackendAuthError,
  BackendTokenResponse,
  LogoutResponse,
  BffAuthPluginOptions,
  BffAuthConfig
} from './types'

// Components
export { default as SessionExpiredModal } from './components/SessionExpiredModal.vue'
export { default as PermissionDeniedToast } from './components/PermissionDeniedToast.vue'
export { default as ServiceUnavailableOverlay } from './components/ServiceUnavailableOverlay.vue'
