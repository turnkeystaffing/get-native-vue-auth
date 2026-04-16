/**
 * Vitest Test Setup
 *
 * Global setup for component tests and auth plugin configuration.
 */

import { vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { setGlobalConfig } from './config'
import type { BffAuthConfig } from './types/config'

/**
 * Stub icon component used in tests where icon rendering is not under test.
 * Keeps the config shape (Component | false) satisfied without pulling in
 * the bundled FluentUI SFCs.
 */
const IconStub = defineComponent({
  name: 'IconStub',
  render: () => h('span', { 'data-testid': 'icon-stub' })
})

/**
 * Default mock config for tests.
 * Exported so test files can import instead of duplicating.
 */
export const testConfig: BffAuthConfig = {
  bffBaseUrl: 'http://localhost:8080',
  clientId: 'test-client',
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  } as any,
  icons: {
    sessionExpired: IconStub,
    login: IconStub,
    serviceUnavailable: IconStub,
    retry: IconStub
  },
  errorViews: {},
  text: {},
  mode: 'token'
}
setGlobalConfig(testConfig)
