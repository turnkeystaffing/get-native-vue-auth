# Project Documentation Index

**`@turnkeystaffing/get-native-vue-auth`** — Vue 3 plugin library for BFF authentication.

**Generated:** 2026-04-18 (full rescan, deep)

---

## Project Overview

- **Type:** monolith, single deliverable (library)
- **Primary language:** TypeScript (strict, ES2020, `moduleResolution: bundler`)
- **Framework:** Vue 3 + Pinia 3 + Axios + Vue Router 4 + jwt-decode (all peer dependencies)
- **Architecture:** Layered Vue plugin — config → service → state → interceptors → router → composition → presentation
- **Version:** 2.0.0 (Vuetify removed; single `AuthErrorBoundary` replaces v1.x overlay trio)

## Quick Reference

- **Entry point:** `src/index.ts`
- **Plugin install:** `bffAuthPlugin` from `src/plugin.ts`
- **State store:** `useAuthStore` from `src/stores/auth.ts`
- **Overlay component:** `<AuthErrorBoundary/>` (registered globally by the plugin)
- **Error-code routing:** `src/services/errorCodeMap.ts` — `ERROR_CODE_TO_TYPE`, `mapErrorCodeToType`
- **Build:** Vite 7 library mode → `dist/index.js` (ESM), `dist/index.d.ts` (rolled up), `dist/get-native-vue-auth.css`
- **Tests:** Vitest 4 + @vue/test-utils + jsdom
- **Package manager:** Yarn Berry 4.12.0

## Generated Documentation

- [Project Overview](./project-overview.md) — purpose, public API summary, recovery categories
- [Architecture](./architecture.md) — layers, module responsibilities, data flow, auth modes, security notes, stable API surface
- [Source Tree Analysis](./source-tree-analysis.md) — annotated tree, entry points, module relationships
- [Component Inventory](./component-inventory.md) — `AuthErrorBoundary`, five recovery views, bundled icons, theming tokens
- [State Management](./state-management.md) — Pinia `auth` store — state, getters, actions, transitions, setError semantics
- [API Contracts](./api-contracts.md) — BFF endpoints, request/response schemas, error-code → category routing
- [Development Guide](./development-guide.md) — prerequisites, yarn scripts, demo app, testing, release workflow

## Hand-written References

- [Auth Error Codes](./auth-error-codes.md) — backend-side catalog of every OAuth / auth-API / BFF error code with recoverability classification
- [Error Handling Analysis](./error-handling-analysis.md) — SPA recovery category reasoning (the rationale behind the five `AuthErrorType` values)
- [README](../README.md) — consumer-facing quickstart, theming, migration from 1.x, full configuration reference

## Implementation Artifacts

Per-feature specs and planning docs produced via the BMAD workflow:

- `_bmad-output/planning-artifacts/` — tech specs, PRFAQs
- `_bmad-output/implementation-artifacts/` — per-story implementation specs and deferred-work log

Notable recent specs (not authoritative — treat as historical context):
- `spec-auth-error-recovery-categories.md`
- `spec-remove-vuetify-error-overlay.md`
- `spec-demo-playground.md`
- `tech-spec-2fa-support.md`
- `tech-spec-bff-cookie-only-mode.md`
- `tech-spec-custom-client-login-redirect.md`

## Getting Started

1. **Consuming the library** — see [README](../README.md) (Installation → Quick Start → Theming → Migration from 1.x).
2. **Modifying the library** — start at [Development Guide](./development-guide.md) then [Architecture](./architecture.md).
3. **Understanding error handling** — read [Error Handling Analysis](./error-handling-analysis.md) before [API Contracts](./api-contracts.md).

## Public API Surface

Every exported symbol in `src/index.ts`:

| Category | Exports |
|---|---|
| Plugin | `bffAuthPlugin`, `DEFAULT_ICONS` |
| Config | `useAuthConfig`, `BFF_AUTH_CONFIG_KEY`, `getGlobalConfig`, `setGlobalConfig` |
| Store | `useAuthStore`, types `AuthState`, `AuthStore` |
| Composable | `useAuth`, type `UseAuth` |
| Auth service | `authService`, `useAuthService`, class `AuthService`, `AuthConfigurationError`, `parseAuthError`, `isAuthConfigured`, types `LoginCredentials`, `LoginOptions`, `LoginWithCustomClientOptions`, `CompleteOAuthFlowOptions` |
| Error-code map | `ERROR_CODE_TO_TYPE`, `KNOWN_INLINE_CODES`, `mapErrorCodeToType`, `statusFallbackType` |
| Interceptors | `setupAuthInterceptors`, type `AuthStoreInterface` |
| Router | `setupAuthGuard`, `createAuthGuard`, type `AuthGuardDependencies` |
| JWT | `decodeJwt`, `extractEmailFromJwt`, `decodeAccessToken`, type `JwtPayload` |
| Circuit breaker | `recordLoginAttempt`, `resetLoginAttempts`, `isCircuitBroken` |
| Component | `AuthErrorBoundary` (default export from `.vue`) |
| Types barrel | See `src/types/index.ts` — `UserInfo`, `CheckAuthResponse`, `TokenResponse`, `AuthError`, `AuthErrorType`, `BackendAuthError`, `BackendTokenResponse`, `LogoutResponse`, `DecodedAccessToken`, `TwoFactorErrorCode`, `TwoFactor*Response`, `BffAuthPluginOptions`, `BffAuthConfig`, `AuthIcons`, `AuthText`, `AuthErrorViews`, per-view props types, `UnmappedErrorHook`, `AuthMode` |

Anything NOT in `src/index.ts` is internal and may change without notice.
