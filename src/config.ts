/**
 * Config Injection and Access
 *
 * Provides Vue injection key for reactive contexts and
 * global config holder for services that can't use inject().
 *
 * @see plugin.ts for Vue plugin implementation
 */

import type { InjectionKey } from 'vue'
import { inject } from 'vue'
import type { BffAuthConfig } from './types/config'

/**
 * Vue injection key for BFF auth config
 * Used by composables and components to access config reactively
 */
export const BFF_AUTH_CONFIG_KEY: InjectionKey<BffAuthConfig> = Symbol('bff-auth-config')

/**
 * Global config holder for services that can't use Vue's inject()
 * Set during plugin installation, accessed by services
 */
let globalConfig: BffAuthConfig | null = null

/**
 * Set the global config
 * Called during plugin installation
 *
 * @internal
 */
export function setGlobalConfig(config: BffAuthConfig): void {
  globalConfig = config
}

/**
 * Get the global config
 * Used by services that can't access Vue's injection system
 *
 * @returns The config or null if not initialized
 */
export function getGlobalConfig(): BffAuthConfig | null {
  return globalConfig
}

/**
 * Get config in reactive Vue context
 * Use this in composables and components
 *
 * @throws Error if config is not provided (plugin not installed)
 */
export function useAuthConfig(): BffAuthConfig {
  const config = inject(BFF_AUTH_CONFIG_KEY)
  if (!config) {
    throw new Error(
      'BFF Auth config not found. Did you forget to install the plugin with app.use(bffAuthPlugin, options)?'
    )
  }
  return config
}
