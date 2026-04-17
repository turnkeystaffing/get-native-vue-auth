# State Management

**Version:** 2.0.0
**Generated:** 2026-04-18

The library has **one Pinia store** (`auth`) defined in `src/stores/auth.ts`. It is the only mutable state and drives every overlay view. All other pieces (guard, interceptors, boundary, composable) are stateless wrappers around it.

---

## Store: `auth`

### State shape — `AuthState`

```typescript
{
  isAuthenticated: boolean          // true after a successful checkAuth() / login completion
  isLoading: boolean                // true while initAuth() is in flight
  user: UserInfo | null             // hydrated from /bff/userinfo response
  accessToken: string | null        // token mode only; never in cookie mode
  tokenExpiresAt: number | null     // Unix ms; Date.now() + expiresIn * 1000
  error: AuthError | null           // drives <AuthErrorBoundary> view selection
}
```

Initial state sets every field to `false`/`null`. Pinia's `$reset()` restores this shape on logout.

### Module-scoped `refreshPromise`

`let refreshPromise: Promise<TokenResponse | null> | null = null` lives **outside** the store state so:
- Pinia plugins that try to serialize state (devtools, persistence) don't see a live promise.
- Concurrent callers share the same in-flight refresh instead of each racing to `/bff/token`.

---

## Getters

All getters are pure; none have side effects. Five derive from the access token via `decodeAccessToken()`:

| Getter | Source | Returns |
|---|---|---|
| `currentUser` | `state.user` | `UserInfo \| null` |
| `hasError` | `state.error !== null` | `boolean` |
| `decodedToken` | `decodeAccessToken(state.accessToken)` | `DecodedAccessToken \| null` |
| `userEmail` | decoded `email` → falls back to `user.email` | `string \| null` |
| `userRoles` | decoded `roles` or `[]` | `string[]` |
| `userId` | decoded `user_id` | `string \| null` |
| `userGuid` | decoded `guid` | `string \| null` |
| `username` | decoded `username` | `string \| null` |
| `sessionId` | decoded `session_id` | `string \| null` |

`decodeAccessToken` enforces that `email`, `user_id`, and `roles` are present on the payload — missing fields log a warning and return `null`.

---

## Actions

### `initAuth()` — app-startup identity check
1. `isLoading = true`, clear error.
2. `authService.checkAuth()` → `{ isAuthenticated, user }`.
3. Writes `isAuthenticated`/`user`.
4. If authenticated, `resetLoginAttempts()` (clears login circuit breaker).
5. If authenticated AND not cookie mode, prefetch token via `ensureValidToken()`.
6. `AuthConfigurationError` → `setError({ type: 'service_unavailable', message })` — prevents login redirect loop when config is missing.
7. Always `isLoading = false` in `finally`.

### `ensureValidToken()` — lazy refresh with deduplication
```
if (mode === 'cookie') return null
if (accessToken && !checkTokenNeedsRefresh()) return accessToken     // cache hit
if (refreshPromise) return (await refreshPromise)?.accessToken       // in-flight share
refreshPromise = _refreshToken()
try   { return (await refreshPromise)?.accessToken }
finally { refreshPromise = null }
```

`checkTokenNeedsRefresh` is a **method** (not a getter) because `Date.now()` isn't reactive. Buffer: 60 seconds before `tokenExpiresAt`.

### `_refreshToken()` — private refresh
- Calls `authService.getAccessToken()`.
- Validates response:
  - Empty `accessToken` → `setError({ type: 'session_expired' })`, return `null`.
  - `expiresIn` not a finite number ≥ `MIN_EXPIRES_IN_SECONDS` (5) → clamps to 5 with an error log. This prevents negative/zero values from looping the refresh cycle.
- Stores `accessToken` and computes `tokenExpiresAt = Date.now() + expiresIn * 1000`.
- `null` response (401 from BFF) → `setError({ type: 'session_expired' })`, return `null`.
- `AuthConfigurationError` → `setError({ type: 'service_unavailable' })` (distinct from session_expired so UX doesn't mask config errors as "please re-login").
- Other errors → `setError({ type: 'session_expired' })`.

### `login(returnUrl?)`
Sets `isLoading = true`, clears error, calls `authService.login({ returnUrl })` which does a full page redirect. `isLoading` intentionally isn't cleared — the page is leaving.

### `logout()`
Best-effort `authService.logout()` (errors swallowed, logged). Then `this.$reset()` followed by `authService.login()` to return to Central Login.

### `setError(error)` — **identity-clearing semantics**
The linchpin of the recovery model. See `src/stores/auth.ts:345`.

```typescript
setError(error: AuthError) {
  this.error = error
  if (error.type === 'session_expired' || error.type === 'account_blocked') {
    this.isAuthenticated = false
    this.user = null
    this.accessToken = null
    this.tokenExpiresAt = null
  }
}
```

| `error.type` | Clears identity? | Why |
|---|---|---|
| `session_expired` | ✅ | User's session is dead. Any subsequent protected request must re-auth. |
| `account_blocked` | ✅ | Identity is invalid at the backend — user_id tokens wouldn't work anyway. |
| `service_unavailable` | ❌ | Transient — identity is still valid; retry should pick up where it left off. |
| `dev_error` | ❌ | App is broken, but the user IS who they say they are. Telemetry should keep user context. |
| `server_error` | ❌ | Same rationale as `dev_error` — preserve context for bug reports. |

### `clearError()`
`this.error = null` — no identity side effects. Called by `ServerErrorView`'s dismiss flow and by `AuthErrorBoundary`'s successful retry path.

### `hasRole(role: string)`
`this.userRoles.includes(role)` — thin pass-through useful for template predicates.

### `checkTokenNeedsRefresh()`
Returns `true` if `accessToken`/`tokenExpiresAt` is null, OR `Date.now() >= tokenExpiresAt - 60_000`. Method, not getter — Date is not reactive.

---

## State Transitions

```
                               ┌─────────────────────────────────┐
                               │          initial state          │
                               │  !isAuthenticated  error=null   │
                               └────────────┬────────────────────┘
                                            │ initAuth()
                                            ▼
                          checkAuth() ─────┴───── 401 or network issue
                           200 OK                   │
                            │                       │
                            ▼                       ▼
               isAuthenticated=true           isAuthenticated=false
               user set                       user=null
               ensureValidToken()             (may setError service_unavailable
                    │                          if AuthConfigurationError)
                    ▼
               accessToken stored
               tokenExpiresAt set
                    │
         ┌──────────┴───────────┐
         │                      │
     user navigation        protected API call
         │                      │  interceptor routes backend code
         │                      ▼
         │           setError({ type: session_expired })
         │           ───────────────────────────────────────
         │           isAuthenticated=false; user=null;
         │           accessToken=null; expiresAt=null
         │
         ▼
     SessionExpiredView ── onSignIn ──► authStore.login() ──► /bff/login (full page redirect)

     logout() ──► $reset() ──► authService.login() ──► /bff/login
```

Every transition flows through actions — no component mutates state directly.

---

## Who reads vs. writes

| Consumer | Reads | Writes |
|---|---|---|
| `useAuth()` composable | all reactive state + getters | calls actions — `login`, `logout`, `clearError` |
| `createAuthGuard()` | `isAuthenticated`, `isLoading` | `initAuth()`, `setError` (on `AuthConfigurationError` + circuit-breaker trip) |
| `setupAuthInterceptors()` | `isAuthenticated`, `ensureValidToken` | `setError` on any mapped error |
| `AuthErrorBoundary` | `error` | `setError` (service_unavailable on breaker trip, session_expired on retry-with-no-identity), `login`, `logout`, `clearError` |
| Views | none — read via props | none — dispatch via passed-in callbacks |

The `AuthStoreInterface` (exported from `interceptors.ts`) names the exact subset the interceptor needs: `isAuthenticated`, `ensureValidToken`, `setError`. Consumers with custom stores could implement this instead of using Pinia directly — the interceptor does DI via `getAuthStore`.

---

## Why module-scoped, not state-scoped

`refreshPromise` lives outside `state()` intentionally:
- Pinia serializes state for devtools / persistence plugins; a live Promise is not serializable.
- Module scope gives a true cross-instance singleton per ES module graph — exactly the semantics needed for single-flight refresh.
- Tests reset it by importing the module and setting to `null` (Vitest isolates module graphs per test file by default).

The closure-scoped `initialized` flag in `createAuthGuard` follows the same reasoning but for per-guard scope — one flag per guard instance, not shared across app/router reinitializations.
