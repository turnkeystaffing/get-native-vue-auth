/**
 * Console-based stub for @turnkeystaffing/get-native-vue-logger.
 * Used by the demo app so the private peer dep isn't required.
 */

export interface Logger {
  debug: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
}

export function createLogger(name: string): Logger {
  return {
    debug: (...args: unknown[]) => console.debug(`[${name}]`, ...args),
    info: (...args: unknown[]) => console.info(`[${name}]`, ...args),
    warn: (...args: unknown[]) => console.warn(`[${name}]`, ...args),
    error: (...args: unknown[]) => console.error(`[${name}]`, ...args),
  }
}
