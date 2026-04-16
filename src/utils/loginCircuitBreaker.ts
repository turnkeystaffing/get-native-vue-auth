/**
 * Login Redirect Circuit Breaker
 *
 * Prevents infinite redirect loops when BFF login and userinfo endpoints
 * disagree about session validity. Tracks login redirect attempts in
 * sessionStorage and stops redirecting after a threshold within a time window,
 * allowing the service-unavailable view to display instead.
 *
 * The time window ensures stale state auto-resets — if the user returns
 * after the window expires, the counter starts fresh. Only rapid successive
 * redirects (the actual loop) trigger the breaker.
 *
 * sessionStorage is used because it survives page reloads (the redirect)
 * but clears on tab close, so users can always recover by opening a new tab.
 */

const STORAGE_KEY = 'gn-auth-login-circuit-breaker'
const DEFAULT_MAX_ATTEMPTS = 3
/** Time window in milliseconds — attempts older than this are discarded */
const DEFAULT_WINDOW_MS = 2 * 60 * 1000 // 2 minutes

interface CircuitBreakerState {
  count: number
  firstAttemptAt: number // Unix timestamp in ms
}

/**
 * Read the stored state, returning null if missing or unparseable.
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
      return parsed as CircuitBreakerState
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
 * Get the current state, auto-resetting if the time window has expired.
 */
function getActiveState(windowMs = DEFAULT_WINDOW_MS): CircuitBreakerState | null {
  const state = readState()
  if (!state) return null
  if (Date.now() - state.firstAttemptAt > windowMs) {
    // Window expired — stale state, discard
    sessionStorage.removeItem(STORAGE_KEY)
    return null
  }
  return state
}

/**
 * Record a login redirect attempt.
 * Returns true if the redirect should proceed, false if the circuit breaker has tripped.
 *
 * Attempts are tracked within a time window (default: 2 minutes). If the first
 * attempt was longer ago than the window, the counter resets automatically.
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
    const existing = getActiveState(windowMs)
    const now = Date.now()

    const state: CircuitBreakerState = existing
      ? { count: existing.count + 1, firstAttemptAt: existing.firstAttemptAt }
      : { count: 1, firstAttemptAt: now }

    writeState(state)
    return state.count <= maxAttempts
  } catch {
    // sessionStorage unavailable — fail open
    return true
  }
}

/**
 * Reset the login attempt counter.
 * Call on successful authentication.
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
    const state = getActiveState(windowMs)
    if (!state) return false
    return state.count >= maxAttempts
  } catch {
    // sessionStorage unavailable — fail open
    return false
  }
}
