# Architecture: @turnkeystaffing/get-native-vue-auth

**Version:** 2.0.0
**Generated:** 2026-04-18 (full rescan, deep)

## Executive Summary

`@turnkeystaffing/get-native-vue-auth` is a single-entry Vue 3 plugin library that encapsulates everything a Turnkey product SPA needs to integrate with the BFF (Backend-for-Frontend) authentication service:

1. **Auth state management** — a Pinia store with lazy token refresh and concurrent-refresh deduplication.
2. **HTTP integration** — Axios interceptors that inject `Authorization: Bearer` tokens and route backend error codes into five recovery categories.
3. **Routing** — Vue Router navigation guard that redirects unauthenticated users to Central Login, with a circuit breaker to short-circuit redirect loops.
4. **Presentation layer** — a zero-framework `AuthErrorBoundary` component with five default views (`session_expired`, `service_unavailable`, `dev_error`, `account_blocked`, `server_error`), each consumer-replaceable, theme-able via CSS custom properties, and bundled with FluentUI SVG icons.

The v2.0.0 release replaced the v1.x Vuetify-dependent UI (`SessionExpiredModal`, `PermissionDeniedToast`, `ServiceUnavailableOverlay`) with a single overlay component that has **no UI-framework peer dependency**.

---

## Technology Stack

| Category | Technology | Version | Notes |
|---|---|---|---|
| Language | TypeScript | ^5.3.3 | Strict mode, ES2020 target, `moduleResolution: bundler` |
| Framework | Vue | ^3.4.0 (peer) | Composition API; plugin registers `AuthErrorBoundary` globally |
| State | Pinia | ^3.0.4 (peer) | Options-style `defineStore` |
| HTTP | Axios | ^1.6.0 (peer) | Interceptors attached by consumer via `setupAuthInterceptors` |
| Router | Vue Router | ^4.0.0 (peer) | Navigation guard factory (`createAuthGuard`) |
| JWT | jwt-decode | ^4.0.0 (peer) | Decode-only — signature verification is server-side |
| Logger | `@turnkeystaffing/get-native-vue-logger` | ^1.0.0 (peer) | Injected via plugin options or factory |
| Build | Vite | ^7.0.0 | Library mode, ESM-only output |
| DTS bundling | `vite-plugin-dts` | ^4.5.4 | `rollupTypes: true` → single `dist/index.d.ts` |
| Tests | Vitest + @vue/test-utils + jsdom | ^4.0.18 / ^2.4.6 / ^26.1.0 | Globals via `src/test-setup.ts`; `vitest.config.ts` extends `vite.config.ts` |
| Lint | ESLint 9 (flat) + typescript-eslint + eslint-plugin-vue | ^9.39.2 | Enforces unused-vars `argsIgnorePattern: ^_` |
| Package manager | Yarn Berry | 4.12.0 | `nodeLinker: node-modules`; `@turnkeystaffing` scope → GitHub Packages |
| CI/CD | *(none in-repo)* | — | No `.github/workflows/`; publishing assumed to be out-of-repo |

**Shipped artifacts** (`dist/`): `index.js` (ESM), `index.d.ts` (rolled-up types), `get-native-vue-auth.css`. Peer deps are externalized in the Rollup output — the bundle never ships Vue, Pinia, Axios, Vue Router, jwt-decode, or the logger.

---

## Architecture Pattern

**Plugin library** with a **layered, side-effect-mediated architecture**:

| Layer | Responsibility | Key files |
|---|---|---|
| **Config** | Typed plugin options; Vue `inject()` + module-scoped global for non-component consumers | `plugin.ts`, `config.ts`, `types/config.ts` |
| **Service** | Thin HTTP client for BFF; error-code→category routing | `services/auth.ts`, `services/errorCodeMap.ts` |
| **State** | Auth state machine with lazy token refresh & setError semantics | `stores/auth.ts` |
| **Interceptors** | Axios request/response middleware; drift hook | `services/interceptors.ts` |
| **Router integration** | Nav-guard factory + login-redirect circuit breaker | `router/guards.ts`, `utils/loginCircuitBreaker.ts` |
| **Composition** | Component-friendly reactive wrapper | `composables/useAuth.ts` |
| **Presentation** | Teleported overlay with five views, bundled icons, CSS vars | `components/AuthErrorBoundary.vue`, `components/views/*` |

Consumers opt into each layer independently — they can adopt just the store + interceptors without mounting `AuthErrorBoundary`, or vice versa.

---

## Module Responsibilities

### `plugin.ts` — `bffAuthPlugin`
- Validates `bffBaseUrl`, `clientId`, `mode` (if provided).
- Constructs resolved `BffAuthConfig`: merges icon defaults (`DEFAULT_ICONS`), takes `errorViews`, `text`, `mode` ('token' | 'cookie'), `onUnmappedError`, `errorCodeOverrides`.
- `app.provide(BFF_AUTH_CONFIG_KEY, config)` AND `setGlobalConfig(config)` — both are needed because services/interceptors/store live outside Vue's component tree.
- `app.component('AuthErrorBoundary', AuthErrorBoundary)` — global registration so consumers can drop `<AuthErrorBoundary/>` anywhere.

### `config.ts`
- `BFF_AUTH_CONFIG_KEY` — Vue `InjectionKey<BffAuthConfig>`.
- Module-scoped `globalConfig` — set once by `setGlobalConfig`, read by services via `getGlobalConfig()`.
- `useAuthConfig()` — reactive `inject()` for components; throws if plugin wasn't installed.

### `services/auth.ts` — `AuthService` (singleton)
HTTP operations against the BFF. Every request uses `withCredentials: true` (session cookie).
- `submitCredentials(email, password, totp?)` — POST `/api/v1/oauth/login` (Central Login only).
- `checkAuth()` — GET `/bff/userinfo`; 401 resolves to `{ isAuthenticated: false }`.
- `login({ returnUrl })` — full-page redirect to `/bff/login`; enforces **same-origin** return URLs (falls back to `/`).
- `loginWithCustomClient({ clientId, returnUrl })` — skips same-origin check; used when Central Login forwards back to a Product SPA. BFF validates `redirect_url` against registered client URIs.
- `completeOAuthFlow({ clientId, returnUrl })` — post-credential counterpart to the above.
- `getAccessToken()` — POST `/bff/token` with `client_id` body; returns camelCase `TokenResponse` or `null` on 401. Throws `AuthConfigurationError` in cookie mode.
- `logout()` — POST `/bff/logout`; parses errors through `parseAuthError`.
- `setup2FA`, `verify2FASetup`, `resend2FASetupEmail` — 2FA endpoints; responses contain sensitive material (`secret`, `qr_code`, `backup_codes`) that must not be logged.
- `AuthConfigurationError` — sentinel thrown when `bffBaseUrl`/`clientId` are missing. Interceptor & guard treat it as `service_unavailable` and **suppress** login redirects to avoid infinite loops.
- `parseAuthError(err, overrides?)` — reads `{ error, error_description }` from body, lowercases the code, consults the map; returns `null` for codeless responses (interceptor handles status fallback).

### `services/errorCodeMap.ts`
- **`ERROR_CODE_TO_TYPE`** — frozen, lowercase-keyed map of backend error codes to one of the five `AuthErrorType` categories. Single source of truth.
- **`KNOWN_INLINE_CODES`** — codes that the consumer renders inline (login form, 2FA, password, email mgmt, consent); interceptor stays silent for these.
- **`mapErrorCodeToType(code, overrides?)`** — consults overrides first, then `KNOWN_INLINE_CODES`, then the canonical map. Overrides may map codes to `null` (treat as inline).
- **`statusFallbackType(status)`** — bare-status fallback: `401→session_expired`, `429→service_unavailable`, else `null`. Bare 503 is **not** treated as an auth error.

### `services/interceptors.ts` — `setupAuthInterceptors(axiosInstance, getAuthStore)`
Factory-style DI (no circular imports with the store).

**Request interceptor:**
- Early-exit in cookie mode (no token logic at all).
- Skip if `!store.isAuthenticated`.
- `ensureValidToken()` → `Authorization: Bearer <token>`.
- `AuthConfigurationError` → `store.setError({ type: 'service_unavailable' })` and **reject** the request (prevents the 401-fallback path from overwriting).
- Other errors: log sanitized message, continue without token.

**Response interceptor:**
- Special-case: 401 while `!isAuthConfigured()` → reject silently (don't overwrite earlier service_unavailable).
- `parseAuthError(err, config.errorCodeOverrides)`. If returned: `setError(authError)`, reject.
- If null but code present: known-inline or override-null → reject silently; else drift → `onUnmappedError(code, status, error)` (dev-only `console.warn`).
- Bare 429 without code → synthesize `{ type: 'service_unavailable', code: 'rate_limit_exceeded' }`.
- Bare status fallback via `statusFallbackType(status)`.
- Always propagates the rejection.

### `stores/auth.ts` — Pinia `auth` store
State shape (`AuthState`): `isAuthenticated`, `isLoading`, `user`, `accessToken`, `tokenExpiresAt`, `error`.

**Key behaviors:**
- **Lazy refresh** (ADR-006): `ensureValidToken()` returns cached token if >60s from expiry; otherwise kicks off a refresh. A **module-scoped `refreshPromise`** deduplicates concurrent callers (kept out of state to avoid Pinia plugin serialization issues).
- **`checkTokenNeedsRefresh`** is a method, not a getter — `Date.now()` is not reactive, so a getter would cache a stale "no refresh needed" result after idle periods.
- **Token response validation**: empty `accessToken` → `session_expired` + null return; `expiresIn` that is not a finite number ≥ `MIN_EXPIRES_IN_SECONDS` (5) is clamped to the minimum to prevent immediate refresh loops.
- **Identity-clearing `setError`**: only `session_expired` and `account_blocked` clear `isAuthenticated/user/accessToken/tokenExpiresAt`. `dev_error` and `server_error` preserve identity (consumer telemetry may want user context for bug reports). `service_unavailable` is transient and never clears identity.
- **Decoded token getters**: `decodedToken`, `userEmail`, `userRoles`, `userId`, `userGuid`, `username`, `sessionId` — all derived from the access token via `decodeAccessToken()` with runtime validation of required claims (`email`, `user_id`, `roles`).
- **`initAuth()`** is idempotent from the guard's perspective — called once per guard instance.
- **`logout()`** — best-effort BFF call, then `$reset()`, then `authService.login()` to redirect.

### `router/guards.ts`
Factory `createAuthGuard(deps?)` returns a `NavigationGuard`. **Closure-scoped `initialized`** flag ensures `initAuth()` runs exactly once per guard instance — not per-navigation, not module-scoped.

- `meta.public === true` bypasses the guard entirely.
- First navigation: `initAuth()` inside a try/catch (unauthenticated on failure).
- `waitForAuthInit` — polls `isLoading` every 50ms up to 10s, **fails closed** on timeout (redirects to login).
- If still unauthenticated, `redirectOrTrip()`:
  - `recordLoginAttempt()` → proceeds with `authSvc.login({ returnUrl: to.fullPath })` or **trips** the circuit breaker (3 attempts within 2 minutes), setting `service_unavailable` and allowing navigation so the overlay renders instead of looping.
- `AuthConfigurationError` → `service_unavailable` + allow navigation. Other errors fail closed.
- Augments `RouteMeta` with `public?: boolean`.

### `utils/loginCircuitBreaker.ts`
`sessionStorage`-backed counter keyed at `gn-auth-login-circuit-breaker`.
- `{ count, firstAttemptAt }`.
- Window defaults: `maxAttempts = 3`, `windowMs = 120_000`.
- Stale state (older than the window) is discarded on read.
- `recordLoginAttempt()` is **fail-open** — if `sessionStorage` throws (SSR, private-mode quota), returns `true`.
- `resetLoginAttempts()` called on successful `initAuth()` result and on `isAuthenticated` in the guard.

### `utils/jwt.ts`
- `decodeJwt` / `extractEmailFromJwt` — loose decode with no claim validation.
- `decodeAccessToken` — typed decode that validates `email`, `user_id`, `roles` shape before returning; logs warnings for missing claims.

### `composables/useAuth.ts`
Reactive-wrapping composable: `computed()` accessors for state (`isAuthenticated`, `user`, `userEmail`, `userRoles`, `decodedToken`, …) plus thin method pass-throughs (`login`, `logout`, `clearError`, `hasRole`). Used in components to avoid importing Pinia directly.

### `components/AuthErrorBoundary.vue`
- Watches `error.value?.type` and maps to one of five views; consumer `errorViews.<type>` overrides take precedence over bundled views.
- Pass-through props are **per-view type-safe** (distinct `SessionExpiredViewProps`, `ServiceUnavailableViewProps`, etc.). Every view receives `{ error, config }`; interactive views also receive `onSignIn` / `onRetry` / `onSignOut`; `ServerErrorView` emits `dismiss` (bound to `authStore.clearError`).
- **Accessibility**: Teleports to `<body>`; captures previously-focused element; locks body scroll; traps Tab/Shift+Tab within overlay; focuses `primaryAction` exposed by each view on mount AND on error-type change; restores focus on close. Uses `role="alertdialog"` + `aria-modal="true"` + `aria-live="assertive"` at each view root.
- **Sign-in** handler applies the login circuit breaker itself (in addition to the guard) so the session-expired view can't infinite-loop the redirect.
- **Service-unavailable retry** calls `authStore.initAuth()`, clears error on success, and escalates to `session_expired` if the backend responds OK but identity is still missing.

### `components/views/*` — five recovery views
Each view:
- Declares props typed against the corresponding `*ViewProps` from `types/config.ts`.
- Pulls title / message / button labels from `config.text.<type>?.*` with bundled English defaults.
- Exposes `primaryAction` via `defineExpose` so the boundary can focus it.
- Shares `overlay.css` — CSS custom properties (`--bff-auth-*`) provide the full theming surface documented in README.

Distinctive behaviors:
- **`ServiceUnavailableView`** — 30-second countdown with progress bar (`role="progressbar"` + `aria-valuenow`); auto-retry on countdown tick-to-zero; countdown restarts if retry resolves while view still mounted (prevents stuck `"Retry in 0s"`); `prefers-color-scheme: dark` media query for contrast; customizable `countdownLabel(seconds)` function.
- **`DevErrorView`** — renders `error.code` in a monospace pill; static "contact developer" line; CTA is **Sign out** (non-destructive escape hatch for switching accounts since the app is broken).
- **`AccountBlockedView`** — branches copy on `error.code === 'insufficient_permissions'` vs default `account_inactive` path.
- **`ServerErrorView`** — emits `dismiss` which the boundary binds to `authStore.clearError()` (it's the only view that can be dismissed without navigation).

---

## Data Flow & Recovery Categories

Five recovery categories end-to-end:

| Category | Triggers (codes / fallback) | View | CTA → Side effect | Clears identity? |
|---|---|---|---|---|
| `session_expired` | `invalid_grant`, `missing_token`, `invalid_token`, `invalid_user_id`, `user_not_found`, `missing_refresh_token`, `invalid_refresh_token`, `reauth_required`, `session_compromised`, `forbidden`, `invalid_session`, `authentication_error` + bare **401** fallback + empty/invalid token response | `SessionExpiredView` | Sign in → `authStore.login()` (full-page redirect, circuit-breaker guarded) | ✅ |
| `service_unavailable` | `temporarily_unavailable`, `service_unavailable`, `auth_service_unavailable`, `logout_failed`, `sessions_fetch_failed`, `revoke_failed`, `password_change_error`, `resend_email_{failed,error}`, `2fa_{setup,verify}_error`, `rate_limit_exceeded` + bare **429** fallback + `AuthConfigurationError` | `ServiceUnavailableView` | 30s auto-retry or Try Now → `authStore.initAuth()` | ❌ |
| `dev_error` | `invalid_client`, `unauthorized_client`, `unsupported_response_type`, `unsupported_grant_type`, `invalid_scope`, `invalid_redirect_uri`, `client_inactive`, `cors_error` | `DevErrorView` | Sign out → `authStore.logout()` | ❌ |
| `account_blocked` | `account_inactive`, `insufficient_permissions` | `AccountBlockedView` (branched copy) | Sign out → `authStore.logout()` | ✅ |
| `server_error` | `server_error`, `internal_error`, `not_implemented`, `unknown_host` | `ServerErrorView` | Dismiss → `authStore.clearError()` | ❌ |

**Inline / silent codes** (`KNOWN_INLINE_CODES`) — the interceptor does NOT call `setError` for these; they propagate as rejections for the caller to render inline: password fields, 2FA/TOTP fields, login form, email management, session management UI, consent (`invalid_request`, `access_denied`), payload size.

**Unmapped codes** — any code not in the canonical map, not in `KNOWN_INLINE_CODES`, and not overridden to `null` fires `onUnmappedError(code, status, error)` (promise-safe; both sync and async hooks supported) and logs `console.warn` in dev. This is the drift-detection surface.

**Status fallbacks** only activate when the response body has no `error` field: `401 → session_expired`, `429 → service_unavailable`, else nothing.

### Happy-path sequence (token mode)

```
App.vue mount → AuthErrorBoundary in template (no error yet; view nothing)
Router.push('/dashboard')
  └── beforeEach guard (first nav)
        ├── initialized? no → initAuth()
        │      ├── checkAuth() → 200 OK, user hydrated, isAuthenticated=true
        │      └── ensureValidToken() → getAccessToken() → accessToken stored
        └── isAuthenticated ✓ → resetLoginAttempts() → allow navigation
/dashboard mounts
  └── apiClient.get('/api/v1/data')
        ├── request interceptor → Authorization: Bearer <token>
        └── 200 OK
```

### Unhappy path — drift code on a protected call

```
apiClient.get('/api/v1/endpoint')
  └── 403  { error: 'new_unknown_code', error_description: '...' }
        ├── response interceptor
        │     ├── parseAuthError → null (unknown code)
        │     ├── code present, not inline, not in overrides, not in canonical
        │     ├── config.onUnmappedError('new_unknown_code', 403, err) ← telemetry
        │     └── DEV: console.warn('[auth] unmapped error code', { code, status })
        │     └── statusFallbackType(403) = null → no overlay
        └── rejection propagates to caller (403 handled locally if caller cares)
```

---

## Authentication Modes

| Mode | Token operations | Interceptor | `getAccessToken()` |
|---|---|---|---|
| `token` (default) | Bearer injection on every protected request; lazy refresh | Full request + response interceptors | Returns camelCase `TokenResponse` |
| `cookie` | None — BFF proxy handles session entirely via cookies | Request interceptor early-exits; response interceptor unchanged | **Throws** `AuthConfigurationError` |

`cookie` mode is intended for the Central Login SPA itself and any product that routes all API calls through a cookie-authenticated BFF proxy. In cookie mode, `authStore.ensureValidToken()` returns `null` immediately and the refresh path is never entered; all authorization hangs off `withCredentials: true` + BFF session cookies.

---

## Security Notes

| Concern | Control |
|---|---|
| Open-redirect | `authService.login()` forces same-origin; non-same-origin return URLs fall back to `/`. Malformed URLs fall back to the current page. |
| Cross-origin login | `loginWithCustomClient` / `completeOAuthFlow` explicitly skip same-origin enforcement; rely on BFF's registered-client validation. Scheme is restricted to http/https. |
| Infinite redirect loops | Circuit breaker (3 attempts / 2 minutes via sessionStorage) in both the guard and the `SessionExpiredView` sign-in handler. Fail-open on storage errors. |
| Log hygiene | 2FA setup responses (`secret`, `qr_code`, `backup_codes`) are documented as non-loggable in service JSDoc. Request interceptor logs `error.message` only, not full error object. |
| Token handling | Tokens never leave Pinia state; not persisted to storage; single-flight refresh via module-scoped promise. |
| Config safety | `AuthConfigurationError` short-circuits login redirects and interceptor error-writes to prevent cascading state corruption when `bffBaseUrl`/`clientId` are unset. |
| Map drift | `onUnmappedError` hook lets consumers ship new backend codes to telemetry before adding them to the canonical map. |
| `import.meta.env.DEV` | Dev-only console warnings use **bare** property access (no optional chaining) so Vite can statically replace and tree-shake in production. |

---

## Testing Strategy

- **Framework:** Vitest 4 + @vue/test-utils 2.4 + jsdom.
- **Config:** `vitest.config.ts` merges `vite.config.ts` and sets `environment: 'jsdom'`, `setupFiles: ['./src/test-setup.ts']`, `css: true`.
- **Coverage surface:** store, services (auth, interceptors, errorCodeMap), overlay boundary, every recovery view.
- **DI pattern:** factories accept dependencies (`createAuthGuard(deps)`, `setupAuthInterceptors(instance, getStore)`) to avoid mock-heavy tests and module-level state pollution.
- `src/test-setup.ts` bootstraps a Pinia instance globally so each `useAuthStore()` call in tests has an active store.

---

## Build & Packaging

- **Vite library mode** — `src/index.ts` → `dist/index.js` (ESM, format `es`), global name `GetNativeVueAuth`.
- **Externals:** `vue`, `pinia`, `axios`, `vue-router`, `jwt-decode`, `@turnkeystaffing/get-native-vue-logger`.
- **`vite-plugin-dts`** with `rollupTypes: true` collapses the type graph into a single `dist/index.d.ts` so consumers don't see internal types in IDE completions.
- **CSS shipped separately** (`dist/get-native-vue-auth.css`) — consumers must import it once (see README quickstart).
- **Publishing:** scope `@turnkeystaffing` → GitHub Packages (`publishConfig.registry = https://npm.pkg.github.com`). Registry auth configured per consumer in `~/.yarnrc.yml`.
- **`files: ['dist']`** — only `dist/` ships to the registry.
- **No in-repo CI** (`.github/workflows/` absent); publishing / release automation lives elsewhere.

---

## Stable Public API Surface (v2.0.0)

Every symbol below is re-exported from `src/index.ts`. Anything not listed here is internal and may change without notice.

| Export | Kind |
|---|---|
| `bffAuthPlugin`, `DEFAULT_ICONS` | Plugin |
| `useAuthConfig`, `BFF_AUTH_CONFIG_KEY`, `getGlobalConfig`, `setGlobalConfig` | Config |
| `useAuthStore`, types `AuthState`, `AuthStore` | Store |
| `useAuth`, type `UseAuth` | Composable |
| `authService`, `useAuthService`, class `AuthService`, `AuthConfigurationError`, `parseAuthError`, `isAuthConfigured`, types `LoginCredentials`, `LoginOptions`, `LoginWithCustomClientOptions`, `CompleteOAuthFlowOptions` | Auth service |
| `ERROR_CODE_TO_TYPE`, `KNOWN_INLINE_CODES`, `mapErrorCodeToType`, `statusFallbackType` | Error-code map |
| `setupAuthInterceptors`, type `AuthStoreInterface` | Interceptors |
| `setupAuthGuard`, `createAuthGuard`, type `AuthGuardDependencies` | Router |
| `decodeJwt`, `extractEmailFromJwt`, `decodeAccessToken`, type `JwtPayload` | JWT utilities |
| `recordLoginAttempt`, `resetLoginAttempts`, `isCircuitBroken` | Circuit breaker |
| All types from `src/types/` (see barrel) | Types |
| `AuthErrorBoundary` | Component (default export from `.vue`) |

---

## References

- [Project Overview](./project-overview.md) — scope, audience, public API summary
- [Source Tree Analysis](./source-tree-analysis.md) — annotated tree + module relationships
- [Component Inventory](./component-inventory.md) — overlay + view catalog
- [State Management](./state-management.md) — Pinia store shape & transitions
- [API Contracts](./api-contracts.md) — BFF endpoints called by `AuthService`
- [Development Guide](./development-guide.md) — scripts, test workflow, demo app
- [Auth Error Codes](./auth-error-codes.md) — backend-side catalog
- [Error Handling Analysis](./error-handling-analysis.md) — SPA recovery category reasoning
- [`README.md`](../README.md) — consumer-facing quickstart, theming, migration from 1.x
