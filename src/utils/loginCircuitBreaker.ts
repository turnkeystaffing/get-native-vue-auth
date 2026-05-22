/**
 * Login Redirect Circuit Breaker
 *
 * Prevents infinite redirect loops when BFF login and userinfo endpoints
 * disagree about session validity. Tracks login redirect attempts in
 * sessionStorage and stops redirecting after a threshold within a time window,
 * allowing a recoverable overlay to display instead.
 *
 * The time window ensures stale state auto-resets — if the user returns
 * after the window expires, the attempt counter starts fresh. Only rapid
 * successive redirects (the actual loop) trip the breaker.
 *
 * Two counters are tracked:
 * - `count`: attempts within the current time window. Resets when the window
 *   lapses, so a tripped breaker self-clears once the cooldown elapses.
 * - `trips`: distinct trip *episodes*. Survives window resets so a persistent
 *   loop can be escalated to a forced clean logout (see {@link hasExceededTripCeiling}).
 *   Only {@link resetLoginAttempts} clears it.
 *
 * sessionStorage is used because it survives page reloads (the redirect)
 * but clears on tab close, so users can always recover by opening a new tab.
 */

const STORAGE_KEY = 'gn-auth-login-circuit-breaker'
const DEFAULT_MAX_ATTEMPTS = 3
/** Time window in milliseconds — attempts older than this are discarded */
const DEFAULT_WINDOW_MS = 2 * 60 * 1000 // 2 minutes
/**
 * Distinct trip episodes tolerated before the breaker recommends a forced
 * clean logout to clear a stale BFF session driving the loop.
 */
const DEFAULT_MAX_TRIPS = 2

/**
 * Error code identifying the breaker-tripped state.
 *
 * Set as `AuthError.code` (with `type: 'service_unavailable'`) so error views
 * can branch to the cooldown/recovery UI and consumers can detect the loop via
 * the store (`authStore.error?.code === LOGIN_LOOP_DETECTED`). This is a
 * client-synthesized code — it never originates from the backend — so it is
 * intentionally absent from `ERROR_CODE_TO_TYPE`.
 */
export const LOGIN_LOOP_DETECTED = 'login_loop_detected'

interface CircuitBreakerState {
  /** Attempts within the current time window. */
  count: number
  /** Unix timestamp in ms when the current window started. */
  firstAttemptAt: number
  /** Distinct trip episodes; survives window resets, cleared only on reset. */
  trips: number
}

/**
 * Read the stored state, returning null if missing or unparseable.
 *
 * `trips` defaults to 0 when absent so entries written by older plugin
 * versions remain forward-compatible.
 */
function readState(): CircuitBreakerState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof parsed.count === 'number' &&
      Number.isFinite(parsed.count) &&
      typeof parsed.firstAttemptAt === 'number' &&
      Number.isFinite(parsed.firstAttemptAt)
    ) {
      const trips =
        typeof parsed.trips === 'number' && Number.isFinite(parsed.trips) ? parsed.trips : 0
      return { count: parsed.count, firstAttemptAt: parsed.firstAttemptAt, trips }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Write state to sessionStorage.
 */
function writeState(state: CircuitBreakerState): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

/**
 * Whether the attempt window is still active (not yet lapsed).
 *
 * This is a pure check with no side effects — unlike a lazy delete, leaving the
 * stale entry in place preserves the `trips` episode counter across window
 * resets. Readers always gate on the window, so a stale entry is benign.
 */
function isWindowActive(state: CircuitBreakerState, windowMs: number, now = Date.now()): boolean {
  return now - state.firstAttemptAt <= windowMs
}

/**
 * Record a login redirect attempt.
 * Returns true if the redirect should proceed, false if the circuit breaker has tripped.
 *
 * Attempts are tracked within a time window (default: 2 minutes). If the first
 * attempt was longer ago than the window, the attempt counter resets
 * automatically (the `trips` episode counter is preserved).
 *
 * Fails open (returns true) if sessionStorage is unavailable (SSR, private browsing quota).
 *
 * @param maxAttempts - Maximum allowed attempts before tripping (default: 3)
 * @param windowMs - Time window in ms for counting attempts (default: 120000)
 */
export function recordLoginAttempt(
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  windowMs = DEFAULT_WINDOW_MS
): boolean {
  try {
    const now = Date.now()
    const existing = readState()
    const windowActive = existing !== null && isWindowActive(existing, windowMs, now)
    const trips = existing?.trips ?? 0

    const state: CircuitBreakerState = windowActive
      ? { count: existing!.count + 1, firstAttemptAt: existing!.firstAttemptAt, trips }
      : { count: 1, firstAttemptAt: now, trips }

    // Count a distinct trip episode exactly once — on the call that first
    // crosses the threshold within this window.
    if (state.count === maxAttempts + 1) {
      state.trips = trips + 1
    }

    writeState(state)
    return state.count <= maxAttempts
  } catch {
    // sessionStorage unavailable — fail open
    return true
  }
}

/**
 * Reset all circuit breaker state, including the trip-episode counter.
 *
 * Call on successful authentication, or as part of an explicit escape
 * (sign out / return to login) so a forced logout doesn't immediately
 * re-trip the breaker.
 */
export function resetLoginAttempts(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore — best-effort cleanup
  }
}

/**
 * Check if the circuit breaker has tripped without incrementing.
 * Returns false if the time window has expired (stale state is ignored).
 *
 * @param maxAttempts - Maximum allowed attempts (default: 3)
 * @param windowMs - Time window in ms (default: 120000)
 */
export function isCircuitBroken(
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  windowMs = DEFAULT_WINDOW_MS
): boolean {
  try {
    const state = readState()
    if (!state || !isWindowActive(state, windowMs)) return false
    return state.count >= maxAttempts
  } catch {
    // sessionStorage unavailable — fail open
    return false
  }
}

/**
 * Timestamp (Unix ms) at which the active window lapses and the breaker
 * auto-resets, or `null` when the breaker is not currently tripped.
 *
 * Drives the cooldown countdown in the login-loop recovery view: while this is
 * in the future the redirect action stays disabled; once it passes the action
 * re-enables (the breaker self-clears on the next attempt).
 *
 * @param maxAttempts - Maximum allowed attempts (default: 3)
 * @param windowMs - Time window in ms (default: 120000)
 */
export function getCircuitBreakerResetAt(
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  windowMs = DEFAULT_WINDOW_MS
): number | null {
  try {
    const state = readState()
    if (!state || !isWindowActive(state, windowMs)) return null
    if (state.count < maxAttempts) return null
    return state.firstAttemptAt + windowMs
  } catch {
    return null
  }
}

/**
 * Number of distinct trip episodes recorded this session.
 *
 * Survives window auto-resets; cleared only by {@link resetLoginAttempts}
 * (successful auth or the explicit sign-out escape).
 */
export function getCircuitBreakerTripCount(): number {
  try {
    return readState()?.trips ?? 0
  } catch {
    return 0
  }
}

/**
 * Whether the breaker has tripped enough distinct episodes to warrant a forced
 * clean logout (clearing a stale BFF session that keeps re-driving the loop).
 *
 * @param maxTrips - Trip episodes tolerated before escalation (default: 2)
 */
export function hasExceededTripCeiling(maxTrips = DEFAULT_MAX_TRIPS): boolean {
  return getCircuitBreakerTripCount() >= maxTrips
}
