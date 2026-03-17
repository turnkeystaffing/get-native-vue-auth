---
title: 'BFF Cookie-Only Authentication Mode'
slug: 'bff-cookie-only-mode'
created: '2026-03-13'
status: 'completed'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['TypeScript 5.3.3', 'Vue 3.4.0', 'Pinia 3.0.4', 'Axios 1.6.0', 'Vitest 4.0.18']
files_to_modify: ['src/types/config.ts', 'src/plugin.ts', 'src/services/auth.ts', 'src/services/interceptors.ts', 'src/stores/auth.ts', 'src/index.ts', 'src/test-setup.ts']
code_patterns: ['Options-style Pinia stores', 'Guard-first error handling', 'Dual config access (inject + global)', 'Singleton service + class export', 'Module-level non-serializable state']
test_patterns: ['Co-located __tests__/ dirs', 'setActivePinia in beforeEach', 'vi.clearAllMocks/restoreAllMocks', 'Logger mock factory', 'importOriginal for error classes']
---

# Tech-Spec: BFF Cookie-Only Authentication Mode

**Created:** 2026-03-13

## Overview

### Problem Statement

The plugin currently requires explicit token management (`clientId`, token fetch/store/refresh, Bearer header injection), making it unusable in environments where a BFF proxy handles authentication via session cookies alone.

### Solution

Add a `mode: 'token' | 'cookie'` config option (defaulting to `'token'`). In `'cookie'` mode, skip all token operations — no fetch, no store, no refresh, no Bearer header — and rely solely on `withCredentials: true` cookies. Auth state is still determined via `/bff/userinfo`.

### Scope

**In Scope:**

- New `mode` config field (`'token' | 'cookie'`, default `'token'`)
- `clientId` remains required in both modes (needed for `/bff/login`)
- Request interceptor skips `ensureValidToken()` and Bearer injection in cookie mode
- Response interceptor (401/403/503) unchanged
- Login/logout endpoints unchanged
- `checkAuth()` via `/bff/userinfo` unchanged
- Store's `initAuth()` skips token pre-fetch in cookie mode
- Tests for the new mode
- Version bump to v1.6.0

**Out of Scope:**

- Changes to `submitCredentials()` or 2FA flows
- Changes to login/logout redirect flows
- SSR support
- New endpoints or API changes

## Context for Development

### Codebase Patterns

- **Options-style Pinia stores** via `defineStore('name', { state, getters, actions })`
- **Guard-first error handling** — `isAuthConfigured()` checks before HTTP calls
- **Dual config access** — `useAuthConfig()` (Vue inject) for composables/components, `getGlobalConfig()` (module-level) for services/interceptors
- **Singleton service + class export** — `export const authService = new AuthService()` + `export { AuthService }`
- **Module-level state** for non-serializable objects (e.g., `refreshPromise`)
- **Snake_case ↔ camelCase mapping** — explicit in service methods, never generic transformers
- **All BFF requests** include `withCredentials: true`

### Files to Reference

| File | Purpose | Changes Needed |
| ---- | ------- | -------------- |
| `src/types/config.ts` | Plugin options & resolved config types | Add `mode` field to both interfaces; define `AuthMode` type alias |
| `src/plugin.ts` | Vue plugin install, validation, config creation | Default `mode` to `'token'` in `createConfig()`, add `mode` to install debug log |
| `src/config.ts` | Config injection key & global holder | No changes — types flow through automatically |
| `src/services/auth.ts` | BFF HTTP client (`AuthService`) | `getAccessToken()` throws in cookie mode |
| `src/services/interceptors.ts` | Axios request/response interceptors | Request interceptor skips token logic in cookie mode |
| `src/types/index.ts` | Types barrel re-export | Add `AuthMode` to re-exports from `'./config'` |
| `src/stores/auth.ts` | Pinia auth store | `initAuth()` skips token prefetch; `ensureValidToken()` early-returns `null` in cookie mode |
| `src/composables/useAuth.ts` | Reactive composable facade | No code changes — token properties naturally return `null` |
| `src/router/guards.ts` | Navigation guards | No changes — uses `isAuthenticated` + `checkAuth()` which are mode-aware |
| `src/index.ts` | Public API barrel | Export new `AuthMode` type |
| `src/test-setup.ts` | Global test config | Add `mode: 'token'` to default `BffAuthConfig` |
| `package.json` | Package metadata | Version bump to 1.6.0 |
| `docs/architecture.md` | Architecture documentation | Add cookie mode flow description (optional, post-implementation) |

### Technical Decisions

**ADR-1: Config Shape — Simple Optional Field**
- Add `mode?: 'token' | 'cookie'` to existing `BffAuthPluginOptions` (default `'token'`)
- `clientId` stays **required** in both modes — still needed for `/bff/login` redirect
- `isAuthConfigured()` unchanged — checks `bffBaseUrl && clientId`, both always present
- `validateOptions()` adds runtime check: reject invalid `mode` values (not `'token'` or `'cookie'`) for JS consumers
- Rationale: `clientId` is used by login flow in both modes; only token fetch/inject is mode-dependent

**ADR-2: Branch at Three Gates (Interceptor + `initAuth()` + `ensureValidToken()`)**
- No parallel code paths or new files
- **Gate 1:** Request interceptor reads `getGlobalConfig().mode`, early-returns before `ensureValidToken()` + Bearer injection in cookie mode
- **Gate 2:** Store `initAuth()` skips `ensureValidToken()` call when `mode === 'cookie'` — requires new `import { getGlobalConfig } from '../config'` in store
- **Gate 3:** `ensureValidToken()` early-returns `null` when `mode === 'cookie'` — catches direct consumer calls via `useAuthStore().ensureValidToken()` that bypass Gates 1-2. Without this, the call chain `ensureValidToken()` → `_refreshToken()` → `getAccessToken()` would throw `AuthConfigurationError`, setting a confusing `service_unavailable` error on the store.
- No signature changes to any functions
- **Key insight:** `isAuthenticated` is a plain state boolean set from `checkAuth()` response, NOT from token presence. Works identically in both modes — no change needed on this field.
- Rationale: Three gates cover all call paths. Store gains one config import — acceptable trade-off.

## Implementation Plan

### Tasks

- [x] Task 1: Define `AuthMode` type, add `mode` to config interfaces, export from public API
  - Files: `src/types/config.ts`, `src/types/index.ts`, `src/index.ts`
  - Action: In `src/types/config.ts`, add `export type AuthMode = 'token' | 'cookie'`. Add `mode?: AuthMode` to `BffAuthPluginOptions`. Add `mode: AuthMode` (required, resolved) to `BffAuthConfig`. In `src/types/index.ts`, add `AuthMode` to the re-export from `'./config'`. In `src/index.ts`, add `AuthMode` to the type exports from `'./types'`.
  - Notes: `AuthMode` must be added to the types barrel (`src/types/index.ts`) — `src/index.ts` imports from `'./types'`, not directly from `'./types/config'`.

- [x] Task 2: Resolve `mode` default in plugin install + runtime validation
  - File: `src/plugin.ts`
  - Action: In `createConfig()`, set `mode: options.mode ?? 'token'`. In install debug log, add `mode: config.mode` to the log payload. In `validateOptions()`, add: `if (options.mode && options.mode !== 'token' && options.mode !== 'cookie') { throw new Error("bffAuthPlugin: mode must be 'token' or 'cookie'") }`.
  - Notes: Runtime validation catches invalid `mode` values from JS consumers or `as any` casts. `clientId` validation unchanged.

- [x] Task 3: Skip token logic in request interceptor for cookie mode
  - File: `src/services/interceptors.ts`
  - Action: At the top of the request interceptor callback (line 74, before `const authStore = getAuthStore()`), add: `if (getGlobalConfig()?.mode === 'cookie') { return config }`. Add import: `import { getGlobalConfig } from '../config'`.
  - Notes: Early-return skips both `ensureValidToken()` and Bearer header injection. Response interceptor untouched.

- [x] Task 4: Skip token prefetch in `initAuth()` + guard `ensureValidToken()` for cookie mode
  - File: `src/stores/auth.ts`
  - Action: Add `import { getGlobalConfig } from '../config'`. (1) In `initAuth()`, wrap the `await this.ensureValidToken()` call with `if (getGlobalConfig()?.mode !== 'cookie') { ... }`. (2) At the top of `ensureValidToken()`, add: `if (getGlobalConfig()?.mode === 'cookie') { return null }`.
  - Notes: Gate in `initAuth()` is the primary defense. Guard in `ensureValidToken()` catches direct consumer calls via `useAuthStore().ensureValidToken()` that bypass the interceptor and `initAuth()` gates. Without this third gate, the call chain would reach `getAccessToken()` which throws, causing a confusing `service_unavailable` error on the store.

- [x] Task 5: Guard `getAccessToken()` in cookie mode
  - File: `src/services/auth.ts`
  - Action: At the top of `getAccessToken()` (before the existing `isAuthConfigured()` guard), add: `if (getGlobalConfig()?.mode === 'cookie') { throw new AuthConfigurationError('getAccessToken() is not available in cookie mode. Token management is handled by the BFF proxy via cookies.') }`. Note: `getGlobalConfig` is already imported in this file.
  - Notes: Safety net — gates (Tasks 3-4) are the primary defense; this catches direct misuse.

- [x] Task 6: Update all test mock configs for `mode` field type compliance
  - Files: `src/test-setup.ts`, `src/services/__tests__/auth.spec.ts`, `src/services/__tests__/interceptors.spec.ts`, `src/stores/__tests__/auth.spec.ts`, `src/components/__tests__/SessionExpiredModal.spec.ts`, `src/components/__tests__/PermissionDeniedToast.spec.ts`, `src/components/__tests__/ServiceUnavailableOverlay.spec.ts`
  - Action: Add `mode: 'token'` to every `BffAuthConfig` object literal in each file.
  - Notes: Type compliance only — no behavioral changes to existing tests. 7 files total.

- [x] Task 7: Add cookie mode tests for auth service
  - File: `src/services/__tests__/auth.spec.ts`
  - Action: Add test group `describe('cookie mode')` with test: `getAccessToken()` throws `AuthConfigurationError` when `getGlobalConfig()` returns config with `mode: 'cookie'`.
  - Notes: Mock `getGlobalConfig` to return cookie-mode config. Use `importOriginal` pattern to preserve `AuthConfigurationError` class.

- [x] Task 8: Add cookie mode tests for interceptors
  - File: `src/services/__tests__/interceptors.spec.ts`
  - Action: Add test group `describe('cookie mode')` with tests: (1) Request interceptor does NOT call `ensureValidToken()` when mode is `'cookie'`. (2) Request interceptor does NOT set Authorization header when mode is `'cookie'`. (3) Response interceptor still handles 401/403/503 in cookie mode (unchanged).
  - Notes: Mock `getGlobalConfig` to return cookie-mode config for these tests.

- [x] Task 9: Add cookie mode tests for auth store
  - File: `src/stores/__tests__/auth.spec.ts`
  - Action: Add test group `describe('cookie mode')` with tests: (1) `initAuth()` calls `checkAuth()` and sets `isAuthenticated = true` without calling `ensureValidToken()`. (2) `initAuth()` sets `user` from `checkAuth()` response. (3) `accessToken` remains `null` after `initAuth()` in cookie mode. (4) Token-derived getters (`decodedToken`, `userEmail`, `userRoles`) return `null`/`[]`. (5) `initAuth()` with `checkAuth()` returning 401 sets `isAuthenticated = false` and `user = null`. (6) `ensureValidToken()` returns `null` immediately in cookie mode without calling `_refreshToken()`.
  - Notes: Mock `getGlobalConfig` to return cookie-mode config. Use `setActivePinia(createPinia())` in `beforeEach`. Add precondition assertion in `beforeEach`: `expect(getGlobalConfig()?.mode).toBe('cookie')` — validates config propagation path (covers AC2). Test (5) covers AC7. Test (6) covers the third gate from ADR-2.

- [x] Task 10: Version bump
  - File: `package.json`
  - Action: Update `"version"` from current value to `"1.6.0"`.
  - Notes: Minor semver bump — additive, non-breaking change.

- [x] Task 11: Build verification
  - Action: Run `yarn build && yarn typecheck && yarn lint && yarn test` to verify all changes compile, pass type checks, lint, and tests.
  - Notes: Must pass before marking complete.

### Acceptance Criteria

**Config & Plugin:**

- [x] AC1: Given a consumer installs the plugin with `{ bffBaseUrl, clientId }` (no `mode`), when the plugin initializes, then `mode` defaults to `'token'` and all existing behavior is identical to pre-v1.6.0 (full backwards compatibility).
- [x] AC2: Given a consumer installs the plugin with `{ bffBaseUrl, clientId, mode: 'cookie' }`, when the plugin initializes, then `mode` is set to `'cookie'` in the resolved config accessible via `getGlobalConfig()`.

**Token Bypass in Cookie Mode:**

- [x] AC3: Given `mode: 'cookie'`, when the request interceptor processes an outgoing request for an authenticated user, then `ensureValidToken()` is NOT called and no `Authorization` header is added.
- [x] AC4: Given `mode: 'cookie'`, when `initAuth()` is called and `checkAuth()` returns `isAuthenticated: true`, then `ensureValidToken()` is NOT called and `isAuthenticated` is set to `true`.
- [x] AC5: Given `mode: 'cookie'`, when `authService.getAccessToken()` is called directly, then it throws `AuthConfigurationError` with a message indicating cookie mode does not support token operations.
- [x] AC5a: Given `mode: 'cookie'`, when `useAuthStore().ensureValidToken()` is called directly by a consumer, then it returns `null` immediately without calling `_refreshToken()` or `getAccessToken()`, and no error is set on the store.

**Auth State in Cookie Mode:**

- [x] AC6: Given `mode: 'cookie'`, when `checkAuth()` returns authenticated with user info, then `isAuthenticated` is `true`, `user` is populated, and token-derived properties (`accessToken`, `decodedToken`, `userEmail`, `userRoles`) return `null`/`[]`.
- [x] AC7: Given `mode: 'cookie'`, when `checkAuth()` returns unauthenticated (401), then `isAuthenticated` is `false` and `user` is `null`.

**Unchanged Behavior:**

- [x] AC8: Given `mode: 'cookie'`, when the response interceptor receives a 401/403/503, then it sets the appropriate auth error in the store (same as token mode).
- [x] AC9: Given `mode: 'cookie'`, when `login()` is called, then it redirects to `/bff/login` with `client_id` parameter (same as token mode).

**Regression:**

- [x] AC10: Given all existing tests run against default config (no `mode` specified), then 100% of pre-existing tests pass without modification (beyond adding `mode: 'token'` to mock configs).

## Additional Context

### Dependencies

- No new runtime dependencies
- No new peer dependencies
- Existing test infrastructure (Vitest, Pinia test utils) sufficient

### Testing Strategy

**Unit Tests (new):**
- `src/services/__tests__/auth.spec.ts` — cookie mode: `getAccessToken()` throws `AuthConfigurationError`
- `src/services/__tests__/interceptors.spec.ts` — cookie mode: interceptor skips `ensureValidToken()` and Bearer header
- `src/stores/__tests__/auth.spec.ts` — cookie mode: `initAuth()` skips token prefetch, sets auth state from `checkAuth()`, `ensureValidToken()` returns null, 401 unauth case

**Unit Tests (updated for type compliance):**
- 5 existing spec files + `test-setup.ts` — add `mode: 'token'` to mock `BffAuthConfig` objects

**Regression Tests:**
- All existing tests must pass unchanged (token mode is default)
- Run full suite: `yarn test`

**Build Verification:**
- `yarn build` — library output compiles
- `yarn typecheck` — strict TypeScript passes
- `yarn lint` — ESLint passes

**Manual Smoke Test:**
- Install plugin with `mode: 'cookie'` in a test app
- Verify: login redirect works, `checkAuth()` returns user info, no token fetch occurs, 401 errors surface correctly

### Security Considerations

**Cookie Mode Security Notes:**
- Cookie mode delegates CSRF protection to the BFF server. Ensure session cookies use `SameSite=Strict` or `SameSite=Lax` and/or server-side CSRF tokens.
- Cookie mode with `HttpOnly` + `Secure` cookies eliminates client-side token exfiltration risk (improvement over token mode).
- Ensure BFF session cookies are scoped to the correct `Domain` and `Path` to prevent cross-app session leakage.
- These are BFF server configuration requirements, not plugin code changes.
- **Consumer Axios instances:** In cookie mode, the request interceptor early-returns without modifying the request config. Consumers using `setupAuthInterceptors` on their own Axios instances for protected API calls MUST configure `withCredentials: true` as a default on their Axios instance (e.g., `axios.create({ withCredentials: true })`). The interceptor never set `withCredentials` in token mode either — it relied on Bearer headers — but in cookie mode, cookies are the only auth mechanism, making this configuration essential.

### Notes

- `isAuthenticated` state is already driven by `checkAuth()` response, not by token presence. This means the store's auth state logic works for cookie mode without changing the `isAuthenticated` setter — only the token prefetch needs to be skipped.
- The `isAuthConfigured()` guard function checks `bffBaseUrl && clientId` — both are still required in cookie mode, so no changes needed there.
- `login()` sends `client_id` to `/bff/login` — this remains necessary in cookie mode since the BFF proxy still needs to know the OAuth client.
- Response interceptor (401/403/503 handling) is mode-agnostic — errors surface the same way regardless of token vs cookie auth.
- **Test maintenance:** Adding `mode` as required to `BffAuthConfig` means 7 files that manually construct configs need `mode: 'token'` added: `src/test-setup.ts`, `src/services/__tests__/auth.spec.ts`, `src/services/__tests__/interceptors.spec.ts`, `src/stores/__tests__/auth.spec.ts`, `src/components/__tests__/SessionExpiredModal.spec.ts`, `src/components/__tests__/PermissionDeniedToast.spec.ts`, `src/components/__tests__/ServiceUnavailableOverlay.spec.ts`. This is type compliance only — no new test logic needed in these files.
- **Minor type-level breaking change:** Adding `mode: AuthMode` as required to `BffAuthConfig` means external consumers who manually construct `BffAuthConfig` objects (e.g., in tests or custom wiring) will get a TypeScript compilation error. This is a narrow impact — most consumers only pass `BffAuthPluginOptions` to `app.use()` where `mode` is optional. Noted as a known trade-off; making `mode` optional on `BffAuthConfig` would weaken internal type safety.

## Review Notes
- Adversarial review completed
- Findings: 13 total, 4 fixed, 9 skipped
- Resolution approach: walk-through
- Fixed: F1 (plugin validation tests), F2 (empty string mode validation), F7 (shared test config), F8 (router guard cookie mode tests)
