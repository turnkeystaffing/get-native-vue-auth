/**
 * @turnkeystaffing/get-native-vue-auth
 *
 * Vue plugin for BFF (Backend-for-Frontend) authentication.
 * Provides a complete authentication solution including:
 * - Pinia store for auth state management
 * - Vue composable for component integration
 * - Axios interceptors for automatic token injection
 * - Vue Router guards for route protection
 * - Zero-framework `AuthErrorBoundary` for session-expired and service-unavailable UX
 *
 * @see README.md for usage instructions
 */

// Plugin
export { bffAuthPlugin, DEFAULT_ICONS } from './plugin'

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
export type { LoginCredentials, LoginOptions, LoginWithCustomClientOptions, CompleteOAuthFlowOptions } from './services/auth'

// Interceptors
export { setupAuthInterceptors } from './services/interceptors'
export type { AuthStoreInterface } from './services/interceptors'

// Router guards
export { setupAuthGuard, createAuthGuard } from './router/guards'
export type { AuthGuardDependencies } from './router/guards'

// JWT utilities
export { decodeJwt, extractEmailFromJwt, decodeAccessToken } from './utils/jwt'
export type { JwtPayload } from './utils/jwt'

// Login circuit breaker
export { recordLoginAttempt, resetLoginAttempts, isCircuitBroken } from './utils/loginCircuitBreaker'

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
  DecodedAccessToken,
  TwoFactorErrorCode,
  TwoFactorSetupResponse,
  TwoFactorVerifyResponse,
  TwoFactorResendResponse,
  TwoFactorErrorResponse,
  BffAuthPluginOptions,
  BffAuthConfig,
  AuthIcons,
  AuthText,
  AuthErrorViews,
  SessionExpiredViewProps,
  ServiceUnavailableViewProps,
  AuthMode
} from './types'

// Components
export { default as AuthErrorBoundary } from './components/AuthErrorBoundary.vue'
