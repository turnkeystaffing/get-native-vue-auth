/**
 * Plugin Configuration Types
 *
 * TypeScript interfaces for plugin configuration options.
 *
 * @see plugin.ts for Vue plugin implementation
 */

import type { Logger } from '@turnkeystaffing/get-native-vue-logger'

/**
 * Icon configuration for auth UI components
 *
 * Override any or all icons to use a different icon library (e.g. Font Awesome).
 * Defaults to MDI (Material Design Icons) strings.
 */
export interface AuthIcons {
  /** Icon for session expired title (default: 'mdi-clock-alert-outline', false to disable) */
  sessionExpired: string | false
  /** Icon for login/sign-in button (default: 'mdi-login', false to disable) */
  login: string | false
  /** Icon for permission denied toast (default: 'mdi-shield-alert', false to disable) */
  permissionDenied: string | false
  /** Icon for service unavailable title (default: 'mdi-cloud-off-outline', false to disable) */
  serviceUnavailable: string | false
  /** Icon for retry button (default: 'mdi-refresh', false to disable) */
  retry: string | false
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

  /** Custom icons - optional, partial overrides merged with MDI defaults */
  icons?: Partial<AuthIcons>
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
}
