/**
 * Vue Plugin for BFF Auth
 *
 * Provides authentication functionality via the BFF (Backend-for-Frontend) pattern.
 * Install with app.use() to configure and enable auth features.
 *
 * @example
 * ```typescript
 * import { createApp } from 'vue'
 * import { createPinia } from 'pinia'
 * import { bffAuthPlugin } from '@turnkeystaffing/get-native-vue-auth'
 *
 * const app = createApp(App)
 * app.use(createPinia())
 * app.use(bffAuthPlugin, {
 *   bffBaseUrl: 'https://bff.example.com',
 *   clientId: 'my-app'
 * })
 * // Consumers then add <AuthErrorBoundary /> in App.vue.
 * ```
 */

import type { App, Plugin } from 'vue'
import { createLogger, type Logger } from '@turnkeystaffing/get-native-vue-logger'
import type { BffAuthPluginOptions, BffAuthConfig, AuthIcons } from './types/config'
import { BFF_AUTH_CONFIG_KEY, setGlobalConfig } from './config'
import AuthErrorBoundary from './components/AuthErrorBoundary.vue'
import IconSessionExpired from './components/icons/IconSessionExpired.vue'
import IconLogin from './components/icons/IconLogin.vue'
import IconServiceUnavailable from './components/icons/IconServiceUnavailable.vue'
import IconRetry from './components/icons/IconRetry.vue'

/**
 * Default icons (bundled FluentUI SVG components).
 *
 * Consumers can override any/all via the `icons` plugin option, or set to
 * `false` to disable a specific icon.
 */
export const DEFAULT_ICONS: AuthIcons = {
  sessionExpired: IconSessionExpired,
  login: IconLogin,
  serviceUnavailable: IconServiceUnavailable,
  retry: IconRetry
}

function validateOptions(options: BffAuthPluginOptions): void {
  if (!options.bffBaseUrl) {
    throw new Error('bffAuthPlugin: bffBaseUrl is required')
  }
  if (!options.clientId) {
    throw new Error('bffAuthPlugin: clientId is required')
  }
  if (options.mode !== undefined && options.mode !== 'token' && options.mode !== 'cookie') {
    throw new Error("bffAuthPlugin: mode must be 'token' or 'cookie'")
  }
}

function createConfig(options: BffAuthPluginOptions): BffAuthConfig {
  const logger: Logger = options.logger ?? createLogger('BffAuth')

  return {
    bffBaseUrl: options.bffBaseUrl,
    clientId: options.clientId,
    logger,
    icons: { ...DEFAULT_ICONS, ...options.icons },
    errorViews: options.errorViews ?? {},
    text: options.text ?? {},
    mode: options.mode ?? 'token'
  }
}

/**
 * BFF Auth Vue Plugin
 *
 * Installs authentication functionality into a Vue application and registers
 * `AuthErrorBoundary` globally so consumers can place `<AuthErrorBoundary />`
 * anywhere in their template.
 *
 * Requires `createPinia()` to have been installed on the app first.
 */
export const bffAuthPlugin: Plugin<[BffAuthPluginOptions]> = {
  install(app: App, options: BffAuthPluginOptions): void {
    validateOptions(options)

    const config = createConfig(options)

    app.provide(BFF_AUTH_CONFIG_KEY, config)
    setGlobalConfig(config)

    app.component('AuthErrorBoundary', AuthErrorBoundary)

    config.logger.debug('BFF Auth plugin installed', {
      bffBaseUrl: config.bffBaseUrl,
      clientId: config.clientId,
      mode: config.mode
    })
  }
}
