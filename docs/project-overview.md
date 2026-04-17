# Project Overview: @turnkeystaffing/get-native-vue-auth

**Version:** 2.0.0
**Generated:** 2026-04-18 (full rescan)

## Purpose

Vue 3 plugin library providing a turnkey BFF-authentication integration for Turnkey product SPAs: Pinia store, Axios interceptors, Vue Router guard, login-redirect circuit breaker, JWT utilities, and a zero-dependency overlay component with five error-recovery views. Plug it into `app.use(bffAuthPlugin, { bffBaseUrl, clientId })`, attach `setupAuthInterceptors` to your Axios client, call `setupAuthGuard(router)`, and drop `<AuthErrorBoundary/>` into your root layout.

## Quick Reference

| | |
|---|---|
| **Package** | `@turnkeystaffing/get-native-vue-auth` |
| **Registry** | GitHub Packages (`@turnkeystaffing` scope → `https://npm.pkg.github.com`) |
| **Primary language** | TypeScript (strict, ES2020, `moduleResolution: bundler`) |
| **Framework** | Vue 3 + Pinia 3 + Axios + Vue Router 4 + jwt-decode (all peer dependencies) |
| **Build** | Vite 7 library mode, ESM-only output, `vite-plugin-dts` rollup-bundled types |
| **Tests** | Vitest 4 + @vue/test-utils 2.4 + jsdom 26 |
| **Package manager** | Yarn Berry 4.12.0 |
| **Repository type** | Monolith, single deliverable |
| **Architecture** | Layered Vue plugin — config → service → state → interceptors → router → composition → presentation |
| **Entry point** | `src/index.ts` |

## Repository Structure

Single Vue 3 library deliverable. `demo/` is a dev-only Vue app used via `yarn demo` for visual component testing (logger stubbed). `dist/` contains built artifacts (`index.js` ESM + `index.d.ts` + CSS). Only `dist/` is published (`"files": ["dist"]`).

No in-repo CI (`.github/workflows/` absent) — release automation lives outside this repository.

## Public API at a Glance

- **Plugin:** `bffAuthPlugin`, `DEFAULT_ICONS`
- **Config:** `useAuthConfig`, `BFF_AUTH_CONFIG_KEY`, `getGlobalConfig`, `setGlobalConfig`
- **State:** `useAuthStore`, types `AuthState` & `AuthStore`
- **Composition:** `useAuth`, type `UseAuth`
- **Auth service:** `authService`, `useAuthService`, class `AuthService`, `AuthConfigurationError`, `parseAuthError`, `isAuthConfigured`
- **Error-code map:** `ERROR_CODE_TO_TYPE`, `KNOWN_INLINE_CODES`, `mapErrorCodeToType`, `statusFallbackType`
- **Interceptors:** `setupAuthInterceptors`, type `AuthStoreInterface`
- **Router:** `setupAuthGuard`, `createAuthGuard`, type `AuthGuardDependencies`
- **JWT utilities:** `decodeJwt`, `extractEmailFromJwt`, `decodeAccessToken`, type `JwtPayload`
- **Circuit breaker:** `recordLoginAttempt`, `resetLoginAttempts`, `isCircuitBroken`
- **Component:** `AuthErrorBoundary` (default export from the `.vue` module)
- **Types:** every type under `src/types/*` — see `src/index.ts` barrel for the authoritative list.

## Recovery Categories

`AuthErrorType` has five values, each mapped to a dedicated bundled view:

| Category | When it triggers | User action | Identity cleared |
|---|---|---|---|
| `session_expired` | Session/token invalid, or bare 401 | Sign in (full-page redirect) | ✅ |
| `service_unavailable` | Backend overloaded, bare 429, rate-limited, `AuthConfigurationError` | Wait — 30s auto-retry | ❌ |
| `dev_error` | OAuth client misconfigured | Sign out (app is broken) | ❌ |
| `account_blocked` | Account disabled or insufficient permissions | Sign out | ✅ |
| `server_error` | Unhandled server/infra failure | Dismiss overlay | ❌ |

Backend codes are routed through `ERROR_CODE_TO_TYPE`; consumers can extend via `errorCodeOverrides` and instrument drift via `onUnmappedError`. See [error-handling-analysis.md](./error-handling-analysis.md) and [auth-error-codes.md](./auth-error-codes.md) for the full table.

## Related Documentation

- [Architecture](./architecture.md) — layers, module responsibilities, data flow, security notes
- [Source Tree Analysis](./source-tree-analysis.md) — annotated tree + entry points
- [Component Inventory](./component-inventory.md) — overlay + views + icons
- [State Management](./state-management.md) — Pinia store shape & transitions
- [API Contracts](./api-contracts.md) — BFF endpoints called by `AuthService`
- [Development Guide](./development-guide.md) — scripts, demo app, test workflow
- [README.md](../README.md) — consumer quickstart, theming, migration from 1.x
