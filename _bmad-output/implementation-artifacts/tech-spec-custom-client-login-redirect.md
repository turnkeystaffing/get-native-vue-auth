---
title: 'Custom Client Login Redirect'
slug: 'custom-client-login-redirect'
created: '2026-03-02'
status: 'completed'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['TypeScript ^5.3.3', 'Vue 3 ^3.4.0', 'Axios ^1.6.0', 'Vitest ^4.0.18']
files_to_modify: ['src/services/auth.ts', 'src/services/__tests__/auth.spec.ts', '_bmad-output/project-context.md']
code_patterns: ['AuthService singleton with class + instance export', 'LoginOptions interface (public API via index.ts)', 'isAuthConfigured() guard-first pattern', 'same-origin URL validation via URL constructor + origin check', 'completeOAuthFlow() cross-origin reference pattern']
test_patterns: ['vitest with vi.mock/vi.mocked', 'window.location mock via Object.defineProperty', 'setGlobalConfig() for per-test config', 'co-located __tests__/ directory']
---

# Tech-Spec: Custom Client Login Redirect

**Created:** 2026-03-02

## Overview

### Problem Statement

Central Login needs to redirect users to BFF login with a custom `clientId` and `returnUrl` from the originating Product SPA. When a user already has an active BFF session, this enables them to skip the login form entirely. Currently, `AuthService.login()` always uses the plugin-configured `clientId` and enforces same-origin on `returnUrl`, making this flow impossible.

### Solution

Extend `AuthService.login()` to accept an optional `clientId` in `LoginOptions`. When both custom `clientId` and `returnUrl` are provided, skip same-origin redirect validation and the `isAuthConfigured()` client ID guard — only require `bffBaseUrl` from config. BFF is trusted to validate the redirect URL against registered client URIs.

### Scope

**In Scope:**
- Extend `LoginOptions` interface with optional `clientId` property
- Modify `AuthService.login()` to use custom `clientId` when provided
- Skip same-origin validation when custom `clientId` + `returnUrl` are provided
- Skip full `isAuthConfigured()` check when custom `clientId` is provided (only require `bffBaseUrl`)
- Validate `returnUrl` scheme (http/https only) and `clientId` non-empty on bypass path
- Warn when only one of `clientId`/`returnUrl` is provided without the other
- Update `login()` JSDoc to reflect conditional same-origin behavior
- Update project-context.md rule about same-origin enforcement
- Update unit tests
- Rebuild dist

**Out of Scope:**
- Store / composable changes (service-level only, called directly on Central Login)
- Changes to `completeOAuthFlow()`
- Changes to `getAccessToken()`, `checkAuth()`, or any other AuthService methods

## Context for Development

### Codebase Patterns

- `AuthService` is a singleton class exported as `authService` + `AuthService` (for testing) from `src/services/auth.ts`
- `LoginOptions` interface defines the options shape for `login()` — part of public API via `src/index.ts`
- `login()` uses three key mechanisms:
  1. `isAuthConfigured()` guard — checks both `bffBaseUrl` and `clientId` from config
  2. Same-origin validation — `URL` constructor + `urlObj.origin !== window.location.origin` check
  3. `getClientId()` — reads `clientId` from global config for query params
- `completeOAuthFlow()` — reference pattern for cross-origin + custom clientId; skips same-origin, trusts BFF. Note: `completeOAuthFlow()` serves a different purpose (post-credential OAuth completion). `login()` with custom clientId is for session-reuse redirects before credentials are submitted. They hit the same BFF endpoint but from different stages of the auth flow.
- Guard-first error handling pattern — `isAuthConfigured()` before any redirect to prevent loops
- All BFF requests use `withCredentials: true` for cookie-based sessions
- JSDoc required on all exported functions/interfaces with `@see` references

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `src/services/auth.ts` | AuthService — `LoginOptions` interface and `login()` method to modify |
| `src/services/__tests__/auth.spec.ts` | Auth service tests — login describe block to extend |
| `src/config.ts` | `getBffBaseUrl()`, `getGlobalConfig()` |
| `src/index.ts` | Public API barrel — `LoginOptions` already exported as type |
| `_bmad-output/project-context.md` | Project rules — same-origin enforcement rule to update |

### Technical Decisions

- **Dual-param trigger**: Custom `clientId` + `returnUrl` must BOTH be provided to trigger the bypass path. Providing only one falls back to standard behavior with config clientId + same-origin enforcement, with a `logger.warn()` to surface the likely developer mistake.
- **Minimal config guard**: When custom `clientId` is provided with `returnUrl`, only `bffBaseUrl` is required from config — skip `isAuthConfigured()` entirely, inline a `bffBaseUrl`-only check.
- **Cross-origin trust**: Same-origin validation is skipped for custom client redirects — consistent with `completeOAuthFlow()` pattern where BFF validates redirect URIs server-side.
- **Scheme validation**: Even on the bypass path, `returnUrl` must use `http:` or `https:` scheme. This prevents `javascript:`, `data:`, or other dangerous schemes, and naturally rejects relative paths (which don't make sense in this cross-origin flow).
- **Input validation**: Custom `clientId` must be non-empty after trimming (matching `completeOAuthFlow()`'s `!clientId` guard pattern). Empty/whitespace-only `clientId` falls through to standard flow.
- **URL construction**: Use `URLSearchParams` for building query params on the custom path (same as standard path) — ensures proper encoding.
- **No store/composable changes**: This is service-level only, consumed directly via `authService.login()` on Central Login.
- **Public API note**: Adding optional `clientId` to `LoginOptions` is a non-breaking public API change (widens the type). Consider a minor version bump when publishing.

## Implementation Plan

### Tasks

- [x] Task 1: Extend `LoginOptions` interface with optional `clientId`
  - File: `src/services/auth.ts`
  - Action: Add `clientId?: string` to the `LoginOptions` interface. Add JSDoc comment: "OAuth client ID from the originating SPA. When provided with `returnUrl`, overrides the configured client ID and skips same-origin validation for cross-origin login redirects."

- [x] Task 2: Add custom client redirect path to `login()` method
  - File: `src/services/auth.ts`
  - Action: Modify `login()` to handle the custom client path. Insert logic after `const opts = options || {}` and before the existing `isAuthConfigured()` guard:
    1. **Half-specified warning**: If only one of `opts.clientId` or `opts.returnUrl` is provided (but not both), `logger.warn()` with a message like `'login() called with clientId but no returnUrl (or vice versa) — falling back to standard flow'`. Then fall through to standard flow.
    2. **Custom path** (both `opts.clientId` and `opts.returnUrl` provided):
       a. Validate `clientId` is non-empty after `.trim()` — if empty, `logger.warn()` and fall through to standard flow.
       b. Validate `bffBaseUrl` exists — if `getBffBaseUrl()` is empty, throw `AuthConfigurationError('BFF base URL is not configured.')`.
       c. Validate `returnUrl` scheme — parse with `new URL(opts.returnUrl)`, check `url.protocol` is `'http:'` or `'https:'`. If not, throw `Error('returnUrl must use http or https scheme')`.
       d. Build login URL using `URLSearchParams({ client_id: opts.clientId, redirect_url: opts.returnUrl })`.
       e. `logger.debug('Initiating custom client login redirect', { clientId: opts.clientId, returnUrl: opts.returnUrl })`.
       f. Set `window.location.href` and return (early exit).
  - Also: Update `login()` method JSDoc. Change "Security: Enforces same-origin redirects to prevent open redirect attacks." to: "Security: Enforces same-origin redirects by default. When both `clientId` and `returnUrl` are provided, same-origin enforcement is skipped — BFF validates redirect URLs against registered client URIs."
  - Notes: Early return after the custom path keeps the existing standard flow completely untouched.

- [x] Task 3: Add unit tests for custom client login redirect
  - File: `src/services/__tests__/auth.spec.ts`
  - Action: Add a new `describe('login with custom clientId')` block inside the existing `describe('login')` block, after the "Open Redirect Prevention" describe block. Tests:
    1. Redirects with custom `clientId` and `returnUrl` — verify `window.location.href` contains correct `client_id` and encoded `redirect_url` params
    2. Allows cross-origin `returnUrl` — verify cross-origin URL is NOT blocked
    3. Works with only `bffBaseUrl` in config (no config `clientId`) — verify redirect succeeds
    4. Throws `AuthConfigurationError` when `bffBaseUrl` is missing
    5. Falls back to standard flow when only `clientId` provided (no `returnUrl`) — verify uses config `clientId`
    6. Falls back to standard flow when only `returnUrl` provided (no `clientId`) — verify same-origin enforcement applies
    7. Rejects `javascript:` scheme in `returnUrl` — verify error thrown
    8. Rejects `returnUrl` with non-http/https scheme (e.g., `data:`) — verify error thrown

- [x] Task 4: Update project-context.md same-origin rule
  - File: `_bmad-output/project-context.md`
  - Action: Update the rule at the "Same-origin redirect enforcement" bullet in the "Critical Don't-Miss Rules" section. Change from: `Same-origin redirect enforcement — login() blocks cross-origin redirects; completeOAuthFlow() intentionally allows them (BFF validates server-side)` to: `Same-origin redirect enforcement — login() blocks cross-origin redirects by default; when called with custom clientId + returnUrl, same-origin is skipped (BFF validates server-side). completeOAuthFlow() also allows cross-origin (BFF validates server-side).`

- [x] Task 5: Rebuild dist
  - Action: Run `yarn build` to rebuild `dist/index.js` and `dist/index.d.ts` with the updated `LoginOptions` type and `login()` method.

### Acceptance Criteria

- [x] AC 1: Given `login({ clientId: 'spa-client', returnUrl: 'https://app.example.com/dashboard' })`, when both params are provided, then `window.location.href` is set to `{bffBaseUrl}/bff/login?client_id=spa-client&redirect_url=https%3A%2F%2Fapp.example.com%2Fdashboard` (URLSearchParams encoding)
- [x] AC 2: Given custom `clientId` + cross-origin `returnUrl`, when `login()` is called, then the cross-origin URL is NOT blocked
- [x] AC 3: Given config has `bffBaseUrl` but no `clientId`, when called with custom `clientId` + `returnUrl`, then redirect succeeds without `AuthConfigurationError`
- [x] AC 4: Given config has no `bffBaseUrl`, when called with custom `clientId` + `returnUrl`, then `AuthConfigurationError` is thrown
- [x] AC 5: Given only `clientId` (no `returnUrl`), then standard flow executes with config `clientId` and same-origin enforcement
- [x] AC 6: Given only `returnUrl` (no `clientId`), then standard flow executes with config `clientId` and same-origin enforcement
- [x] AC 7: Given no options, then existing behavior unchanged
- [x] AC 8: Given `returnUrl` with `javascript:` scheme, when called with custom `clientId`, then error is thrown
- [x] AC 9: Given `returnUrl` with `data:` scheme, when called with custom `clientId`, then error is thrown
- [x] AC 10: Given empty/whitespace `clientId` with `returnUrl`, then falls back to standard flow with warning

## Review Notes

- Adversarial review completed
- Findings: 10 total, 10 fixed, 0 skipped
- Resolution approach: walk-through (all findings addressed)
- Post-review refactor: Extracted `loginWithCustomClient()` as a dedicated public method (SRP), replaced the conditional branching in `login()`. `LoginWithCustomClientOptions` added to public API with required params.

---

## Additional Context

### Dependencies

None — no new packages or external dependencies required.

### Testing Strategy

**Unit Tests** (in `src/services/__tests__/auth.spec.ts`):
- Add `describe('login with custom clientId')` block with 8 test cases covering ACs 1-6, 8-9
- Reuse existing window.location mock pattern from the login describe block
- Use `setGlobalConfig()` to control config state per test
- AC 7 is covered by existing tests — no modification needed
- AC 10 (empty clientId fallback) can be verified via existing standard-flow tests or an additional assertion

**Manual Testing**:
- On Central Login, call `authService.login({ clientId: '<product-spa-client-id>', returnUrl: 'https://<product-spa-url>/callback' })` and verify redirect to BFF with correct query params

### Notes

- This is consumed directly via `authService.login()` on Central Login, not through the composable/store layer.
- `completeOAuthFlow()` serves a different semantic purpose (post-credential OAuth completion) and remains unchanged. `login()` with custom clientId is for session-reuse redirects before any credentials are submitted. Both hit the same BFF endpoint but from different stages of the auth flow.
- Adding `clientId` to `LoginOptions` is a non-breaking public API change (adds optional property). Consider minor version bump when publishing.
