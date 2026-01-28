/**
 * Plugin Configuration Types
 *
 * TypeScript interfaces for plugin configuration options.
 *
 * @see plugin.ts for Vue plugin implementation
 */

import type { Logger } from '@turnkeystaffing/get-native-vue-logger'

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
}
