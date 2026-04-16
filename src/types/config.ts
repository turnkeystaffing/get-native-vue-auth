/**
 * Plugin Configuration Types
 *
 * TypeScript interfaces for plugin configuration options.
 *
 * @see plugin.ts for Vue plugin implementation
 */

import type { Component } from 'vue'
import type { Logger } from '@turnkeystaffing/get-native-vue-logger'
import type { AuthError } from './auth'

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
 * service-unavailable view. Stable public API from v2.0.0.
 */
export interface ServiceUnavailableViewProps {
  error: AuthError
  onRetry: () => void | Promise<void>
  config: BffAuthConfig
  retryAfter: number
}

/**
 * Escape-hatch: replace the default error views entirely.
 *
 * Props contract (stable public API from v2.0.0):
 * - `sessionExpired` receives {@link SessionExpiredViewProps}
 * - `serviceUnavailable` receives {@link ServiceUnavailableViewProps}
 */
export interface AuthErrorViews {
  sessionExpired?: Component
  serviceUnavailable?: Component
}

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
}
