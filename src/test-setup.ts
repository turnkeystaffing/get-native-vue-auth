/**
 * Vitest Test Setup
 *
 * Global setup for component tests including Vuetify polyfills
 * and auth plugin configuration.
 */

import { vi } from 'vitest'
import { setGlobalConfig } from './config'
import type { BffAuthConfig } from './types/config'

// Mock ResizeObserver for Vuetify components
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}))

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}))

// Mock matchMedia for responsive tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
})

// Set default global config for tests
const testConfig: BffAuthConfig = {
  bffBaseUrl: 'http://localhost:8080',
  clientId: 'test-client',
  tokenClientId: 'test-token-client',
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  } as any
}
setGlobalConfig(testConfig)
