/**
 * Vue Plugin for BFF Auth
 *
 * Provides authentication functionality via the BFF (Backend-for-Frontend) pattern.
 * Install with app.use() to configure and enable auth features.
 *
 * @example
 * ```typescript
 * import { createApp } from 'vue'
 * import { bffAuthPlugin } from '@get-native/get-native-vue-auth'
 *
 * const app = createApp(App)
 * app.use(bffAuthPlugin, {
 *   bffBaseUrl: 'https://bff.example.com',
 *   clientId: 'my-app'
 * })
 * ```
 */

import type { App, Plugin } from 'vue'
import { createLogger, type Logger } from '@get-native/get-native-vue-logger'
import type { BffAuthPluginOptions, BffAuthConfig } from './types/config'
import { BFF_AUTH_CONFIG_KEY, setGlobalConfig } from './config'

/**
 * Validate plugin options
 *
 * @throws Error if required options are missing
 */
function validateOptions(options: BffAuthPluginOptions): void {
  if (!options.bffBaseUrl) {
    throw new Error('bffAuthPlugin: bffBaseUrl is required')
  }
  if (!options.clientId) {
    throw new Error('bffAuthPlugin: clientId is required')
  }
}

/**
 * Create resolved config from options
 */
function createConfig(options: BffAuthPluginOptions): BffAuthConfig {
  const logger: Logger = options.logger ?? createLogger('BffAuth')

  return {
    bffBaseUrl: options.bffBaseUrl,
    clientId: options.clientId,
    tokenClientId: options.tokenClientId ?? options.clientId,
    logger
  }
}

/**
 * BFF Auth Vue Plugin
 *
 * Installs authentication functionality into a Vue application.
 * Provides configuration via Vue's dependency injection system.
 */
export const bffAuthPlugin: Plugin<[BffAuthPluginOptions]> = {
  install(app: App, options: BffAuthPluginOptions): void {
    // Validate required options
    validateOptions(options)

    // Create resolved config
    const config = createConfig(options)

    // Provide config via Vue's injection system
    app.provide(BFF_AUTH_CONFIG_KEY, config)

    // Set global config for services
    setGlobalConfig(config)

    config.logger.debug('BFF Auth plugin installed', {
      bffBaseUrl: config.bffBaseUrl,
      clientId: config.clientId,
      tokenClientId: config.tokenClientId
    })
  }
}
