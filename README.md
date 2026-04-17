# @turnkeystaffing/get-native-vue-auth

A Vue 3 plugin for BFF (Backend-for-Frontend) authentication. Ships a Pinia state store, Axios interceptors, a Vue Router navigation guard, and a zero-framework `AuthErrorBoundary` overlay — all from a single `app.use()` call.

> **v2.0.0 — breaking change.** Vuetify is no longer a peer dependency. The three v1.x error components have been consolidated into one `AuthErrorBoundary`. If you're upgrading from 1.x, follow [`MIGRATION.md`](./MIGRATION.md).

---

## At a glance

- **Pinia auth store** with lazy token refresh and concurrent-refresh deduplication.
- **Axios interceptors** that inject `Authorization: Bearer` headers and route backend error codes into five recovery categories.
- **Vue Router nav guard** with a circuit breaker that prevents infinite login redirects.
- **`<AuthErrorBoundary />`** — a single Teleported overlay with five built-in recovery views, bundled FluentUI SVG icons, and full theme/copy/view overrides.
- **Two auth modes** — `token` (default, manages JWTs) and `cookie` (BFF session cookies, no token operations).
- **Consumer-opt-in layers** — adopt the store + interceptors without the overlay, or vice versa.

## Requirements

| Requirement | Version |
|---|---|
| Node.js | 18+ |
| Vue | ^3.4 |
| Pinia | ^3.0.4 |
| Vue Router | ^4.0 |
| Axios | ^1.6 |
| jwt-decode | ^4.0 |
| `@turnkeystaffing/get-native-vue-logger` | ^1.0 |

All runtime dependencies are **peer dependencies** — the library bundle never ships Vue, Pinia, Axios, Vue Router, jwt-decode, or the logger.

---

## Installation

This package is published to **GitHub Packages** under the `@turnkeystaffing` scope. Configure the registry and your auth token in your user-level Yarn config (`~/.yarnrc.yml`) so the token never lands in the repo:

```yaml
# ~/.yarnrc.yml
npmScopes:
  turnkeystaffing:
    npmRegistryServer: "https://npm.pkg.github.com"
    npmAuthToken: "your_github_token"
```

Install the package and its peer dependencies:

```bash
yarn add @turnkeystaffing/get-native-vue-auth
yarn add vue@^3.4 pinia@^3.0.4 vue-router@^4 axios@^1.6 jwt-decode@^4
yarn add @turnkeystaffing/get-native-vue-logger
```

---

## Quick start

A complete end-to-end wire-up. All four steps are usually needed in a typical SPA.

### 1. Install the plugin

```typescript
// main.ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { bffAuthPlugin } from '@turnkeystaffing/get-native-vue-auth'
import App from './App.vue'

const app = createApp(App)

app.use(createPinia())           // Pinia must be installed first
app.use(bffAuthPlugin, {
  bffBaseUrl: 'https://api.example.com',
  clientId: 'my-app-client-id'
})

app.mount('#app')
```

### 2. Protect routes

```typescript
// router/index.ts
import { createRouter, createWebHistory } from 'vue-router'
import { setupAuthGuard } from '@turnkeystaffing/get-native-vue-auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Home },
    { path: '/login', component: Login, meta: { public: true } },
    { path: '/dashboard', component: Dashboard } // protected by default
  ]
})

setupAuthGuard(router)
export default router
```

Routes are **protected by default** — mark a route as public with `meta: { public: true }`.

### 3. Attach Axios interceptors

```typescript
// services/api.ts
import axios from 'axios'
import { setupAuthInterceptors, useAuthStore } from '@turnkeystaffing/get-native-vue-auth'

const apiClient = axios.create({
  baseURL: 'https://api.example.com',
  withCredentials: true // required so cookies are sent with BFF requests
})

setupAuthInterceptors(apiClient, () => useAuthStore())
export default apiClient
```

### 4. Mount the error boundary

```vue
<!-- App.vue -->
<template>
  <router-view />
  <AuthErrorBoundary />
</template>
```

`AuthErrorBoundary` is registered globally by `app.use(bffAuthPlugin, ...)`, so no import is needed. Mount the tag once, anywhere in your app shell — the component uses Vue's `<Teleport to="body">` so its position in the template tree doesn't matter. It watches the auth store and renders a full-viewport overlay whenever an error sets `authStore.error`.

---

## Core concepts

### Auth modes — `token` vs `cookie`

The plugin operates in one of two modes, chosen at install time.

| Mode | When to use | Behavior |
|---|---|---|
| `token` *(default)* | Your BFF returns JWTs and you inject `Authorization: Bearer` headers. | Fetches tokens, injects them, refreshes on 401, reads roles/claims from the JWT. |
| `cookie` | Your BFF handles auth entirely via session cookies. | Skips all token operations. Auth state comes from `/bff/userinfo`. |

Choose with the `mode` option:

```typescript
app.use(bffAuthPlugin, {
  bffBaseUrl: 'https://api.example.com',
  clientId: 'my-app',
  mode: 'cookie'
})
```

For the full behavior matrix — which getters return `null`, which interceptor paths short-circuit — see [`docs/architecture.md`](./docs/architecture.md).

### The five recovery categories

When an auth error occurs, the plugin maps it to one of five categories. `AuthErrorBoundary` renders a view per category:

| Category | Default view | Typical cause |
|---|---|---|
| `session_expired` | Sign-in CTA | Token expired; 401 on a protected call. |
| `service_unavailable` | 30s auto-retry | Upstream 429/503; temporary outage. |
| `dev_error` | Error code + sign-out CTA | OAuth misconfig, invalid client — app is unusable until fixed. |
| `account_blocked` | Sign-out CTA | `account_inactive` or `insufficient_permissions`. |
| `server_error` | Dismissible message | Unexpected 5xx without a mapped code. |

Each backend code is mapped in [`docs/auth-error-codes.md`](./docs/auth-error-codes.md). You can re-route or silence codes per-app — see [`docs/theming.md#error-code-overrides`](./docs/theming.md#error-code-overrides).

### Composable, store, or service?

Three ways to read and drive auth state. Pick the one that fits where you're reading from:

- **`useAuth()`** (composable) — Vue components. Reactive refs + action functions. The common choice.
- **`useAuthStore()`** (Pinia store) — full state/getter/action access when the composable's surface is too narrow (e.g., non-component code that already has access to Pinia).
- **`authService`** (module singleton) — Vue-free code paths (tests, background workers, explicit BFF calls like 2FA). Services must **never** call Vue's `inject()`; they use the module-level config holder instead.

See [`docs/state-management.md`](./docs/state-management.md) for the full auth state machine.

---

## Configuration

### Plugin options

| Option | Type | Required | Description |
|---|---|---|---|
| `bffBaseUrl` | `string` | ✅ | Base URL of the BFF server. |
| `clientId` | `string` | ✅ | OAuth client ID used for login flow. |
| `mode` | `'token' \| 'cookie'` | — | Auth mode (default: `'token'`). |
| `logger` | `Logger` | — | Custom logger instance. Defaults to `createLogger('BffAuth')`. |
| `icons` | `Partial<AuthIcons>` | — | Swap any built-in icon for your own component, or `false` to hide. |
| `text` | `AuthText` | — | Per-state copy overrides (title/message/button/etc.). |
| `errorViews` | `AuthErrorViews` | — | Replace default views entirely with your own components. |
| `errorCodeOverrides` | `Record<string, AuthErrorType \| null>` | — | Per-app overrides for the code → category map; `null` silences a code. |
| `onUnmappedError` | `(code, status, error) => void` | — | Telemetry hook for backend codes the frontend doesn't know yet. |

### Deep-dive references

Everything beyond the table above is documented in dedicated guides so this README stays skimmable:

- **[Theming & customization](./docs/theming.md)** — CSS custom properties, icon swaps, copy overrides, full view replacement, error-code overrides, unmapped-error telemetry.
- **[API contracts](./docs/api-contracts.md)** — BFF endpoints, request/response schemas, error-code → category routing.
- **[State management](./docs/state-management.md)** — Pinia store state, getters, actions, and transitions.
- **[Component inventory](./docs/component-inventory.md)** — per-view breakdown, accessibility behavior, prop contracts.

---

## Using the library

### `useAuth` composable

```vue
<script setup lang="ts">
import { useAuth } from '@turnkeystaffing/get-native-vue-auth'

const {
  isAuthenticated, isLoading, user, userEmail, error,
  userRoles, userId, hasRole,
  login, logout, clearError
} = useAuth()

function handleLogin() {
  login('/dashboard') // redirects to BFF login, returns to /dashboard
}
</script>

<template>
  <div v-if="isLoading">Loading…</div>
  <div v-else-if="isAuthenticated">
    <p>Welcome, {{ userEmail }}</p>
    <button @click="logout()">Sign out</button>
  </div>
  <button v-else @click="handleLogin">Sign in</button>
</template>
```

Full `useAuth()` surface:

- **Reactive state** — `isAuthenticated`, `isLoading`, `user`, `userEmail`, `error`
- **Decoded-token getters** — `decodedToken`, `userRoles`, `userId`, `userGuid`, `username`, `sessionId`
- **Actions** — `login(returnUrl?)`, `logout()`, `clearError()`, `hasRole(role)`

### `authService` (for non-component code)

```typescript
import { authService } from '@turnkeystaffing/get-native-vue-auth'

const { isAuthenticated, user } = await authService.checkAuth()
const token = await authService.getAccessToken()
authService.login({ returnUrl: '/dashboard' }) // redirects to Central Login
await authService.logout()
```

Two-factor authentication flows are handled directly on the service (`setup2FA`, `verify2FASetup`, `resend2FASetupEmail`) and are not wired through the store or composable. See [`docs/api-contracts.md`](./docs/api-contracts.md) for the full 2FA contract — `setup.secret` and `backup_codes` are **security-sensitive** and must never be logged or persisted.

### JWT helpers

```typescript
import { decodeJwt, extractEmailFromJwt } from '@turnkeystaffing/get-native-vue-auth'

const payload = decodeJwt(accessToken)
const email = extractEmailFromJwt(accessToken)
```

Decoding only — signature verification is the backend's responsibility.

---

## Public API

The main runtime exports, grouped. The complete, always-up-to-date list — including every type — lives in [`src/index.ts`](./src/index.ts); schema and behavior details are in [`docs/api-contracts.md`](./docs/api-contracts.md).

| Group | Exports |
|---|---|
| **Plugin** | `bffAuthPlugin`, `DEFAULT_ICONS` |
| **Config** | `useAuthConfig`, `BFF_AUTH_CONFIG_KEY`, `getGlobalConfig`, `setGlobalConfig` |
| **Store** | `useAuthStore` |
| **Composable** | `useAuth` |
| **Auth service** | `authService`, `useAuthService`, `AuthService`, `AuthConfigurationError`, `parseAuthError`, `isAuthConfigured` |
| **Error-code map** | `ERROR_CODE_TO_TYPE`, `KNOWN_INLINE_CODES`, `mapErrorCodeToType`, `statusFallbackType` |
| **Interceptors** | `setupAuthInterceptors` |
| **Router** | `setupAuthGuard`, `createAuthGuard` |
| **JWT** | `decodeJwt`, `extractEmailFromJwt`, `decodeAccessToken` |
| **Circuit breaker** | `recordLoginAttempt`, `resetLoginAttempts`, `isCircuitBroken` |
| **Component** | `AuthErrorBoundary` |
| **Types** | `AuthMode`, `AuthError`, `AuthErrorType`, `UserInfo`, `CheckAuthResponse`, `TokenResponse`, `BackendAuthError`, `LogoutResponse`, `DecodedAccessToken`, `BffAuthPluginOptions`, `BffAuthConfig`, `AuthIcons`, `AuthText`, `AuthErrorViews`, `UnmappedErrorHook`, per-view prop types (`SessionExpiredViewProps`, `ServiceUnavailableViewProps`, `DevErrorViewProps`, `AccountBlockedViewProps`, `ServerErrorViewProps`), service option types (`LoginOptions`, `LoginCredentials`, `LoginWithCustomClientOptions`, `CompleteOAuthFlowOptions`), 2FA types (`TwoFactorErrorCode`, `TwoFactorSetupResponse`, `TwoFactorVerifyResponse`, `TwoFactorResendResponse`, `TwoFactorErrorResponse`), store types (`AuthState`, `AuthStore`), composable type `UseAuth`, `JwtPayload`, `AuthStoreInterface`, `AuthGuardDependencies` |

> Anything not exported from `src/index.ts` is internal and may change without notice.

---

## Documentation

| Document | Read when you need to… |
|---|---|
| [Architecture](./docs/architecture.md) | Understand the layered design, module responsibilities, auth modes, and security model. |
| [State management](./docs/state-management.md) | Know exactly what the Pinia store tracks and how transitions work. |
| [API contracts](./docs/api-contracts.md) | Look up BFF endpoints, request/response schemas, and error-code routing. |
| [Component inventory](./docs/component-inventory.md) | Understand `AuthErrorBoundary`'s five views and their prop contracts. |
| [Auth error codes](./docs/auth-error-codes.md) | See the canonical backend code catalog and recovery-category mapping. |
| [Theming & customization](./docs/theming.md) | Theme the overlay, swap icons, override copy, or replace views. |
| [Development guide](./docs/development-guide.md) | Build, test, or release the library. |
| [Documentation index](./docs/index.md) | See everything that's documented. |

---

## Versioning & migration

This library follows **semantic versioning**. Breaking changes are released as a major version bump and documented in [`MIGRATION.md`](./MIGRATION.md).

- **v2.0.0** (current) — drops Vuetify peer dependency; consolidates three error components into `AuthErrorBoundary`. See [`MIGRATION.md`](./MIGRATION.md).

---

## Development

```bash
git clone https://github.com/turnkeystaffing/get-native-vue-auth.git
cd get-native-vue-auth
yarn install
```

Common scripts:

| Command | Purpose |
|---|---|
| `yarn build` | Build the library to `dist/` (ESM + rolled-up types + CSS). |
| `yarn dev` | Rebuild on file change (library watch mode). |
| `yarn demo` | Run the interactive demo app (visual testing). |
| `yarn typecheck` | Type-check without emitting (`tsc --noEmit`). |
| `yarn test` | Run the Vitest suite once. |
| `yarn test:watch` | Watch mode for Vitest. |
| `yarn lint` | ESLint across the repo. |
| `yarn lint:fix` | ESLint with autofix. |

See [`docs/development-guide.md`](./docs/development-guide.md) for prerequisites, project conventions, and the release workflow.

---

## License

Proprietary — Turnkey Staffing. Not for redistribution.
