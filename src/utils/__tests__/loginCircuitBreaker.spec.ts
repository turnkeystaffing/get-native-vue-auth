/**
 * Login Circuit Breaker Unit Tests
 *
 * Tests for the sessionStorage-based circuit breaker that prevents
 * infinite login redirect loops.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { recordLoginAttempt, resetLoginAttempts, isCircuitBroken } from '../loginCircuitBreaker'

const STORAGE_KEY = 'gn-auth-login-circuit-breaker'

describe('loginCircuitBreaker', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('recordLoginAttempt', () => {
    it('returns true for attempts within the default threshold', () => {
      expect(recordLoginAttempt()).toBe(true)  // 1st
      expect(recordLoginAttempt()).toBe(true)  // 2nd
      expect(recordLoginAttempt()).toBe(true)  // 3rd
    })

    it('returns false when attempts exceed the default threshold', () => {
      recordLoginAttempt() // 1
      recordLoginAttempt() // 2
      recordLoginAttempt() // 3
      expect(recordLoginAttempt()).toBe(false) // 4th — tripped
    })

    it('stores state as JSON with count and timestamp', () => {
      vi.setSystemTime(new Date('2026-04-16T12:00:00Z'))
      recordLoginAttempt()
      const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY)!)
      expect(stored.count).toBe(1)
      expect(stored.firstAttemptAt).toBe(new Date('2026-04-16T12:00:00Z').getTime())
    })

    it('preserves firstAttemptAt across increments', () => {
      vi.setSystemTime(new Date('2026-04-16T12:00:00Z'))
      recordLoginAttempt()
      vi.setSystemTime(new Date('2026-04-16T12:00:05Z'))
      recordLoginAttempt()
      const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY)!)
      expect(stored.count).toBe(2)
      expect(stored.firstAttemptAt).toBe(new Date('2026-04-16T12:00:00Z').getTime())
    })

    it('respects custom maxAttempts', () => {
      expect(recordLoginAttempt(1)).toBe(true)  // 1st
      expect(recordLoginAttempt(1)).toBe(false) // 2nd — tripped
    })

    it('fails open when sessionStorage throws', () => {
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError')
      })
      expect(recordLoginAttempt()).toBe(true)
      getItemSpy.mockRestore()
    })

    it('handles corrupt JSON in sessionStorage gracefully', () => {
      sessionStorage.setItem(STORAGE_KEY, 'garbage')
      expect(recordLoginAttempt()).toBe(true)
      const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY)!)
      expect(stored.count).toBe(1)
    })
  })

  describe('time window', () => {
    it('auto-resets counter when time window expires', () => {
      vi.setSystemTime(new Date('2026-04-16T12:00:00Z'))
      recordLoginAttempt() // 1
      recordLoginAttempt() // 2
      recordLoginAttempt() // 3
      expect(isCircuitBroken()).toBe(true)

      // Advance past the 2-minute window
      vi.setSystemTime(new Date('2026-04-16T12:02:01Z'))

      // Should auto-reset — first attempt in new window
      expect(isCircuitBroken()).toBe(false)
      expect(recordLoginAttempt()).toBe(true) // count = 1 in new window
    })

    it('does not reset within the time window', () => {
      vi.setSystemTime(new Date('2026-04-16T12:00:00Z'))
      recordLoginAttempt() // 1
      recordLoginAttempt() // 2
      recordLoginAttempt() // 3

      // Still within the 2-minute window
      vi.setSystemTime(new Date('2026-04-16T12:01:30Z'))
      expect(isCircuitBroken()).toBe(true)
      expect(recordLoginAttempt()).toBe(false) // still tripped
    })

    it('respects custom window duration', () => {
      vi.setSystemTime(new Date('2026-04-16T12:00:00Z'))
      recordLoginAttempt(3, 10_000) // 10s window
      recordLoginAttempt(3, 10_000)
      recordLoginAttempt(3, 10_000)
      expect(isCircuitBroken(3, 10_000)).toBe(true)

      // Advance 11 seconds — past the custom window
      vi.setSystemTime(new Date('2026-04-16T12:00:11Z'))
      expect(isCircuitBroken(3, 10_000)).toBe(false)
      expect(recordLoginAttempt(3, 10_000)).toBe(true)
    })

    it('starts a fresh window after auto-reset', () => {
      vi.setSystemTime(new Date('2026-04-16T12:00:00Z'))
      recordLoginAttempt()
      recordLoginAttempt()
      recordLoginAttempt()

      // Expire the window
      vi.setSystemTime(new Date('2026-04-16T12:03:00Z'))

      // New attempt starts a fresh window
      recordLoginAttempt()
      const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY)!)
      expect(stored.count).toBe(1)
      expect(stored.firstAttemptAt).toBe(new Date('2026-04-16T12:03:00Z').getTime())
    })
  })

  describe('resetLoginAttempts', () => {
    it('removes the state from sessionStorage', () => {
      recordLoginAttempt()
      recordLoginAttempt()
      expect(sessionStorage.getItem(STORAGE_KEY)).not.toBeNull()

      resetLoginAttempts()
      expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull()
    })

    it('does not throw when sessionStorage is unavailable', () => {
      const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('SecurityError')
      })
      expect(() => resetLoginAttempts()).not.toThrow()
      removeItemSpy.mockRestore()
    })
  })

  describe('isCircuitBroken', () => {
    it('returns false when no attempts have been made', () => {
      expect(isCircuitBroken()).toBe(false)
    })

    it('returns false when attempts are below threshold', () => {
      recordLoginAttempt()
      recordLoginAttempt()
      expect(isCircuitBroken()).toBe(false)
    })

    it('returns true when attempts reach the threshold', () => {
      recordLoginAttempt()
      recordLoginAttempt()
      recordLoginAttempt()
      expect(isCircuitBroken()).toBe(true)
    })

    it('does not increment the counter', () => {
      recordLoginAttempt()
      isCircuitBroken()
      isCircuitBroken()
      const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY)!)
      expect(stored.count).toBe(1)
    })

    it('respects custom maxAttempts', () => {
      recordLoginAttempt(5)
      expect(isCircuitBroken(1)).toBe(true)
      expect(isCircuitBroken(5)).toBe(false)
    })

    it('fails open when sessionStorage throws', () => {
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError')
      })
      expect(isCircuitBroken()).toBe(false)
      getItemSpy.mockRestore()
    })
  })

  describe('full cycle', () => {
    it('trips after threshold, resets, then allows attempts again', () => {
      recordLoginAttempt()
      recordLoginAttempt()
      recordLoginAttempt()
      expect(recordLoginAttempt()).toBe(false)
      expect(isCircuitBroken()).toBe(true)

      // Manual reset
      resetLoginAttempts()
      expect(isCircuitBroken()).toBe(false)
      expect(recordLoginAttempt()).toBe(true)
    })

    it('trips, auto-resets after window, then allows attempts again', () => {
      vi.setSystemTime(new Date('2026-04-16T12:00:00Z'))
      recordLoginAttempt()
      recordLoginAttempt()
      recordLoginAttempt()
      expect(recordLoginAttempt()).toBe(false)
      expect(isCircuitBroken()).toBe(true)

      // Wait for window to expire (no manual reset)
      vi.setSystemTime(new Date('2026-04-16T12:02:01Z'))
      expect(isCircuitBroken()).toBe(false)
      expect(recordLoginAttempt()).toBe(true)
      expect(recordLoginAttempt()).toBe(true)
      expect(recordLoginAttempt()).toBe(true)
      expect(recordLoginAttempt()).toBe(false) // tripped again in new window
    })
  })
})
