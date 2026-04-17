/**
 * Plugin Configuration Types
 *
 * TypeScript interfaces for plugin configuration options.
 *
 * @see plugin.ts for Vue plugin implementation
 */

import type { Component } from 'vue'
import type { Logger } from '@turnkeystaffing/get-native-vue-logger'
import type { AuthError, AuthErrorType } from './auth'

/**
 * Authentication mode
 * - 'token': Explicit token management with Bearer header injection (default)
 * - 'cookie': BFF proxy handles auth via session cookies; no token operations
 */
export type AuthMode = 'token' | 'cookie'

/**
 * Icon configuration for auth UI components.
 *
 * Values are Vue component refs (so bundled FluentUI icons can be swapped for
 * any consumer icon library) or `false` to disable the icon entirely.
 */
export interface AuthIcons {
  /** Icon for session expired view title (false to disable) */
  sessionExpired: Component | false
  /** Icon for login/sign-in button (false to disable) */
  login: Component | false
  /** Icon for service unavailable view title (false to disable) */
  serviceUnavailable: Component | false
  /** Icon for retry button (false to disable) */
  retry: Component | false
  /** Icon for dev-error view title (false to disable) */
  devError: Component | false
  /** Icon for account-blocked view title (false to disable) */
  accountBlocked: Component | false
  /** Icon for server-error view title (false to disable) */
  serverError: Component | false
  /** Icon for "Sign out" CTA on terminal views (false to disable) */
  signOut: Component | false
}

/**
 * Per-state text overrides for default error views.
 *
 * Omitted fields fall back to the plugin's built-in English copy.
 */
export interface AuthText {
  sessionExpired?: {
    title?: string
    message?: string
    button?: string
  }
  serviceUnavailable?: {
    title?: string
    message?: string
    button?: string
    retryingLabel?: string
    countdownLabel?: (seconds: number) => string
  }
  devError?: {
    title?: string
    message?: string
    contactLine?: string
    signOut?: string
  }
  accountBlocked?: {
    title?: string
    message?: string
    insufficientPermissionsTitle?: string
    insufficientPermissionsMessage?: string
    signOut?: string
  }
  serverError?: {
    title?: string
    message?: string
    dismissButton?: string
  }
}

/**
 * Props passed to a consumer-provided replacement for the default
 * session-expired view. Stable public API from v2.0.0.
 */
export interface SessionExpiredViewProps {
  error: AuthError
  onSignIn: () => void | Promise<void>
  config: BffAuthConfig
}

/**
 * Props passed to a consumer-provided replacement for the default
 * service-unavailable view.
 */
export interface ServiceUnavailableViewProps {
  error: AuthError
  onRetry: () => void | Promise<void>
  config: BffAuthConfig
}

/**
 * Props passed to a consumer-provided replacement for the default
 * dev-error view. Terminal view — no retry / no re-login path.
 *
 * `onSignOut` calls `authStore.logout()` so the user has a non-destructive
 * escape hatch to switch accounts.
 */
export interface DevErrorViewProps {
  error: AuthError
  onSignOut: () => void | Promise<void>
  config: BffAuthConfig
}

/**
 * Props passed to a consumer-provided replacement for the default
 * account-blocked view. Covers both `account_inactive` and
 * `insufficient_permissions`; the copy branches on `error.code`.
 */
export interface AccountBlockedViewProps {
  error: AuthError
  onSignOut: () => void | Promise<void>
  config: BffAuthConfig
}

/**
 * Props passed to a consumer-provided replacement for the default
 * server-error view. Renders a Dismiss action that calls
 * `authStore.clearError()` via the `dismiss` event.
 *
 * Events:
 * - `dismiss` — consumer requests overlay close; `AuthErrorBoundary`
 *   listens and calls `authStore.clearError()`.
 */
export interface ServerErrorViewProps {
  error: AuthError
  config: BffAuthConfig
}

/**
 * Escape-hatch: replace the default error views entirely.
 *
 * Props contract (stable public API from v2.0.0):
 * - `sessionExpired` receives {@link SessionExpiredViewProps}
 * - `serviceUnavailable` receives {@link ServiceUnavailableViewProps}
 * - `devError` receives {@link DevErrorViewProps}
 * - `accountBlocked` receives {@link AccountBlockedViewProps}
 * - `serverError` receives {@link ServerErrorViewProps}
 */
export interface AuthErrorViews {
  sessionExpired?: Component
  serviceUnavailable?: Component
  devError?: Component
  accountBlocked?: Component
  serverError?: Component
}

/**
 * Callback fired when the interceptor receives a non-empty error code that is
 * neither in `ERROR_CODE_TO_TYPE` / `errorCodeOverrides` nor in
 * `KNOWN_INLINE_CODES`.
 *
 * Consumers can wire this to a telemetry sink to surface backend/frontend map
 * drift. Naked-status errors (no `error_type` on the body) do NOT fire this.
 *
 * @param code - The lowercased unmapped error code (always a non-empty string at call site)
 * @param status - HTTP status code
 * @param error - The original Axios error (unknown; caller may narrow)
 */
export type UnmappedErrorHook = (code: string, status: number, error: unknown) => void

/**
 * Plugin options provided during app.use()
 */
export interface BffAuthPluginOptions {
  /** BFF base URL - required */
  bffBaseUrl: string

  /** OAuth client ID for login flow - required */
  clientId: string

  /** Custom logger instance - optional, uses default logger if not provided */
  logger?: Logger

  /** Icon overrides merged with bundled FluentUI defaults */
  icons?: Partial<AuthIcons>

  /** Full view replacements — takes precedence over icons/text when provided */
  errorViews?: AuthErrorViews

  /** Per-state text overrides for default views */
  text?: AuthText

  /** Authentication mode - 'token' (default) or 'cookie' for BFF cookie-only auth */
  mode?: AuthMode

  /**
   * Callback fired when the interceptor encounters an unmapped error code.
   *
   * Use this to surface backend/frontend map drift in production telemetry.
   * @see UnmappedErrorHook
   */
  onUnmappedError?: UnmappedErrorHook

  /**
   * Per-consumer overrides for the code→category map.
   *
   * Keys must be lowercase; values may be any `AuthErrorType` or `null`
   * (marks the code as inline/silent — treated like `KNOWN_INLINE_CODES`).
   *
   * Overrides shallow-merge *over* the canonical `ERROR_CODE_TO_TYPE` map.
   */
  errorCodeOverrides?: Record<string, AuthErrorType | null>
}

/**
 * Resolved config after plugin initialization
 * All optional fields have default values
 */
export interface BffAuthConfig {
  /** BFF base URL */
  bffBaseUrl: string

  /** OAuth client ID for login flow */
  clientId: string

  /** Logger instance */
  logger: Logger

  /** Resolved icon configuration */
  icons: AuthIcons

  /** Resolved view overrides (empty object if consumer provided none) */
  errorViews: AuthErrorViews

  /** Resolved text overrides (empty object if consumer provided none) */
  text: AuthText

  /** Resolved authentication mode */
  mode: AuthMode

  /** Resolved drift callback (undefined if consumer provided none) */
  onUnmappedError?: UnmappedErrorHook

  /** Resolved code→category overrides (undefined if consumer provided none) */
  errorCodeOverrides?: Record<string, AuthErrorType | null>
}
