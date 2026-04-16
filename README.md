# @turnkeystaffing/get-native-vue-auth

Vue 3 authentication plugin for BFF (Backend for Frontend) authentication flows. Provides session management, token handling, router guards, and a zero-framework error boundary component.

> **2.0.0 breaking change:** Vuetify is no longer a peer dependency. The three previous error components (`SessionExpiredModal`, `PermissionDeniedToast`, `ServiceUnavailableOverlay`) have been replaced with a single `AuthErrorBoundary` component that ships with built-in FluentUI SVG icons, CSS custom properties for theming, and consumer-overridable views. See the [Migration from 1.x](#migration-from-1x) section below.

## Installation

This package is hosted on GitHub Packages. Configure your `.yarnrc.yml` to use the GitHub npm registry for the `@turnkeystaffing` scope:

```yaml
npmScopes:
  turnkeystaffing:
    npmRegistryServer: "https://npm.pkg.github.com"
```

Then add authentication in `~/.yarnrc.yml`:

```yaml
npmScopes:
  turnkeystaffing:
    npmAuthToken: "your_github_token"
```

Install the package:

```bash
yarn add @turnkeystaffing/get-native-vue-auth
```

### Peer Dependencies

```bash
yarn add vue@^3.4.0 pinia@^3.0.4 axios@^1.6.0 vue-router@^4.0.0 jwt-decode@^4.0.0
yarn add @turnkeystaffing/get-native-vue-logger
```

Vuetify is **not** required in 2.x — the plugin ships its own presentation layer.

## Quick Start

### 1. Install the Plugin

```typescript
// main.ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { bffAuthPlugin } from '@turnkeystaffing/get-native-vue-auth'
import App from './App.vue'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(bffAuthPlugin, {
  bffBaseUrl: 'https://api.example.com',
  clientId: 'my-app-client-id'
})

app.mount('#app')
```

### 2. Set Up Router Guards

```typescript
// router/index.ts
import { createRouter, createWebHistory } from 'vue-router'
import { setupAuthGuard } from '@turnkeystaffing/get-native-vue-auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Home },
    { path: '/login', component: Login, meta: { public: true } },
    { path: '/dashboard', component: Dashboard } // Protected by default
  ]
})

setupAuthGuard(router)

export default router
```

### 3. Set Up Axios Interceptors

```typescript
// services/api.ts
import axios from 'axios'
import { setupAuthInterceptors, useAuthStore } from '@turnkeystaffing/get-native-vue-auth'

const apiClient = axios.create({
  baseURL: 'https://api.example.com'
})

setupAuthInterceptors(apiClient, () => useAuthStore())

export default apiClient
```

### 4. Add the Auth Error Boundary

The plugin registers `AuthErrorBoundary` globally during `app.use(bffAuthPlugin, ...)`. Place a single tag anywhere in your app shell — it renders a full-viewport overlay via `<Teleport to="body">` whenever the auth store reports `session_expired` or `service_unavailable`:

```vue
<!-- App.vue -->
<template>
  <router-view />
  <AuthErrorBoundary />
</template>
```

The boundary:
- Watches `useAuth().error` reactively.
- Renders the built-in `SessionExpiredView` or `ServiceUnavailableView` based on error type — no DOM footprint otherwise.
- Locks body scroll and moves focus to the primary action while visible; restores both on dismiss.
- Does **not** render UI for `permission_denied` — the store still exposes the error so consumers can show their own non-blocking toast if they want one.

### Cookie Mode (BFF Proxy Auth)

For environments where a BFF proxy handles authentication entirely via session cookies, use `mode: 'cookie'`. This skips all token operations — no fetch, no store, no refresh, no Bearer header injection. Auth state is determined via `/bff/userinfo`.

```typescript
app.use(bffAuthPlugin, {
  bffBaseUrl: 'https://api.example.com',
  clientId: 'my-app-client-id',
  mode: 'cookie'
})
```

**What changes in cookie mode:**
- Request interceptor skips `ensureValidToken()` and Bearer header injection
- `initAuth()` skips token prefetch (still calls `checkAuth()`)
- `ensureValidToken()` returns `null` immediately
- `getAccessToken()` throws `AuthConfigurationError`
- Token-derived getters (`decodedToken`, `userRoles`) return `null`/`[]`
- `userEmail` falls back to `user.email` from `/bff/userinfo` (so it still works without a token)

**What stays the same:**
- Login/logout flows
- `checkAuth()` via `/bff/userinfo`
- Response interceptor (401/403/503 error handling)
- Router guards
- `AuthErrorBoundary` error UI

**Important:** When using cookie mode with `setupAuthInterceptors` on your own Axios instances, you must configure `withCredentials: true` as a default on those instances so cookies are sent with requests.

## Usage

### useAuth Composable

```vue
<script setup lang="ts">
import { useAuth } from '@turnkeystaffing/get-native-vue-auth'

const { isAuthenticated, isLoading, user, error, login, logout, clearError } = useAuth()

function handleLogin() {
  login('/dashboard') // Redirects to BFF login, returns to /dashboard
}

async function handleLogout() {
  await logout()
}
</script>

<template>
  <div v-if="isLoading">Loading...</div>
  <div v-else-if="isAuthenticated">
    Welcome, {{ user?.user_id }}
    <button @click="handleLogout">Logout</button>
  </div>
  <div v-else>
    <button @click="handleLogin">Login</button>
  </div>
</template>
```

### Direct Store Access

```typescript
import { useAuthStore } from '@turnkeystaffing/get-native-vue-auth'

const authStore = useAuthStore()

// State
authStore.isAuthenticated
authStore.isLoading
authStore.user
authStore.accessToken
authStore.error

// Actions
authStore.initAuth()
authStore.login('/return-url')
await authStore.logout()
await authStore.ensureValidToken()
authStore.setError({ type: 'session_expired', message: 'Session expired' })
authStore.clearError()
```

### Auth Service

```typescript
import { authService } from '@turnkeystaffing/get-native-vue-auth'

// Check authentication status
const { isAuthenticated, user } = await authService.checkAuth()

// Get access token
const token = await authService.getAccessToken()

// Start login flow - redirects to Central Login (for Product SPAs)
authService.login({ returnUrl: '/dashboard' })

// Logout
await authService.logout()
```

### Central Login Integration

Central Login handles the credential submission, then redirects back through BFF to complete the OAuth flow:

```typescript
import { authService } from '@turnkeystaffing/get-native-vue-auth'
import { useRoute } from 'vue-router'

const route = useRoute()

// Get params passed from /oauth/authorize redirect
const clientId = route.query.client_id as string
const returnUrl = route.query.redirect_url as string

async function handleLogin(email: string, password: string, authCode?: string) {
  try {
    // Submit credentials with optional TOTP code (sets oauth_session cookie)
    await authService.submitCredentials(email, password, authCode)

    // Complete OAuth flow - redirects to /bff/login then back to originating SPA
    // Note: This allows cross-origin redirects (required to return to Product SPA)
    authService.completeOAuthFlow({ clientId, returnUrl })
  } catch (error: any) {
    const detail = error.response?.data?.detail
    if (detail === '2fa_setup_required') {
      // Redirect user to 2FA setup flow
    } else if (detail === '2fa_code_required') {
      // Prompt user for TOTP code and re-submit
    } else {
      throw error
    }
  }
}
```

### Two-Factor Authentication (2FA)

The auth service provides methods for 2FA setup and verification. These are called directly by consuming apps — no composable or store integration.

```typescript
import { authService } from '@turnkeystaffing/get-native-vue-auth'
import type {
  TwoFactorSetupResponse,
  TwoFactorVerifyResponse,
  TwoFactorErrorCode
} from '@turnkeystaffing/get-native-vue-auth'

// 1. Initiate 2FA setup (returns QR code and secret)
const setup: TwoFactorSetupResponse = await authService.setup2FA(setupToken)
// setup.qr_code — data URI for QR code image
// setup.secret — TOTP shared secret (security-sensitive, do not log or persist)

// 2. Verify 2FA setup with TOTP code from authenticator app
const result: TwoFactorVerifyResponse = await authService.verify2FASetup(token, totpCode)
// result.backup_codes — one-time recovery codes (security-sensitive, do not log or persist)

// 3. Resend 2FA setup email
await authService.resend2FASetupEmail('user@example.com')
```

### JWT Utilities

```typescript
import { decodeJwt, extractEmailFromJwt } from '@turnkeystaffing/get-native-vue-auth'

const payload = decodeJwt(accessToken)
const email = extractEmailFromJwt(accessToken)
```

## Configuration

### Plugin Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `bffBaseUrl` | `string` | Yes | Base URL of the BFF server |
| `clientId` | `string` | Yes | OAuth client ID |
| `logger` | `Logger` | No | Custom logger instance |
| `mode` | `'token' \| 'cookie'` | No | Auth mode: `'token'` (default) manages JWTs; `'cookie'` relies on BFF session cookies |
| `icons` | `Partial<AuthIcons>` | No | Swap individual icons (Vue component refs) or set to `false` to hide one |
| `text` | `AuthText` | No | Per-state copy overrides for title/message/button/countdown |
| `errorViews` | `AuthErrorViews` | No | Replace the default views entirely with your own Vue components |

### Theming via CSS custom properties

The default views scope these custom properties under `.bff-auth-overlay`. Set them at `:root` (or any ancestor) to theme the overlay without overriding any selectors:

| Variable | Default | Purpose |
|----------|---------|---------|
| `--bff-auth-bg` | `#ffffff` (light) / `#0d1117` (dark) | Overlay background |
| `--bff-auth-fg` | `#1f2328` (light) / `#e6edf3` (dark) | Title and body text |
| `--bff-auth-muted` | `#57606a` (light) / `#8b949e` (dark) | Secondary text |
| `--bff-auth-accent` | `#2563eb` | Primary button + progress bar |
| `--bff-auth-accent-fg` | `#ffffff` | Primary button label |
| `--bff-auth-danger` | `#d1242f` | Service-unavailable icon tint |
| `--bff-auth-max-width` | `480px` | Content column width |
| `--bff-auth-z-index` | `2147483000` | Stacking layer (high, always-on-top) |
| `--bff-auth-font-family` | `inherit` | Font stack |

### Custom Icons

Icons are Vue component refs in 2.x — swap in any icon from your own library, or set to `false` to disable:

```typescript
import MySessionIcon from '@/icons/MySessionIcon.vue'

app.use(bffAuthPlugin, {
  bffBaseUrl: 'https://api.example.com',
  clientId: 'my-app',
  icons: {
    sessionExpired: MySessionIcon, // Your own component
    retry: false                    // Hide the retry icon entirely
  }
})
```

| Icon | Default (bundled FluentUI SVG) | Used In |
|------|--------------------------------|---------|
| `sessionExpired` | `clock_24_regular` | Session expired view title |
| `login` | `arrow_right_24_regular` | Sign-in button |
| `serviceUnavailable` | `cloud_off_24_regular` | Service unavailable view title |
| `retry` | `arrow_clockwise_24_regular` | Try-now button |

Each icon accepts a Vue component ref or `false` to hide it.

### Custom Copy

Override any of the default English strings per state:

```typescript
app.use(bffAuthPlugin, {
  // ...
  text: {
    sessionExpired: {
      title: 'Votre session a expiré',
      message: 'Veuillez vous reconnecter.',
      button: 'Se connecter'
    },
    serviceUnavailable: {
      title: 'Service indisponible',
      button: 'Réessayer',
      retryingLabel: 'Tentative en cours...',
      countdownLabel: (s) => `Nouvelle tentative dans ${s} s`
    }
  }
})
```

### Full View Replacement

For total control, swap the built-in views for your own. Custom views receive a stable prop contract (public API from 2.0.0):

```typescript
import CustomSessionExpired from '@/auth/CustomSessionExpired.vue'
import CustomServiceUnavailable from '@/auth/CustomServiceUnavailable.vue'

app.use(bffAuthPlugin, {
  // ...
  errorViews: {
    sessionExpired: CustomSessionExpired,       // receives { error, onSignIn, config }
    serviceUnavailable: CustomServiceUnavailable // receives { error, onRetry, config, retryAfter }
  }
})
```

The `onSignIn` / `onRetry` handlers encapsulate the circuit-breaker and `initAuth` logic — call them and the plugin will update store state accordingly.

### Route Meta

Mark routes as public (no auth required):

```typescript
{
  path: '/public-page',
  component: PublicPage,
  meta: { public: true }
}
```

## Components

### AuthErrorBoundary

The single component you place in your app shell. Watches the auth store and renders a full-viewport overlay via `<Teleport to="body">` for `session_expired` (sign-in view) and `service_unavailable` (retry view with countdown). Locks body scroll, moves focus to the primary action on show, restores focus on dismiss. Does not render for `permission_denied` — consumers handle that error themselves.

## Error Types

```typescript
type AuthErrorType = 'session_expired' | 'permission_denied' | 'service_unavailable'

interface AuthError {
  type: AuthErrorType
  message: string
  retryAfter?: number // For service_unavailable
}
```

## Exports

### Plugin
- `bffAuthPlugin` - Vue plugin

### Config
- `useAuthConfig` - Access plugin config in components
- `BffAuthPluginOptions` - Plugin options type
- `BffAuthConfig` - Resolved config type

### Store
- `useAuthStore` - Pinia auth store

### Composable
- `useAuth` - Vue composable for auth state and actions

### Services
- `authService` - Auth service client
- `setupAuthInterceptors` - Axios interceptor setup
- `AuthConfigurationError` - Error class for missing config
- `parseAuthError` - Parse backend auth errors
- `mapErrorType` - Map backend error types to frontend types
- `isAuthConfigured` - Check if auth is configured

### Router
- `setupAuthGuard` - Set up router guards with default dependencies
- `createAuthGuard` - Create guard with custom dependencies

### Utilities
- `decodeJwt` - Decode JWT payload
- `extractEmailFromJwt` - Extract email from JWT

### Components
- `AuthErrorBoundary` - Consumer-placed error boundary (also auto-registered globally during `app.use(bffAuthPlugin, ...)`)

### Types
- `AuthMode`, `UserInfo`, `AuthError`, `AuthErrorType`, `AuthIcons`, `AuthText`, `AuthErrorViews`, `TokenResponse`, `CheckAuthResponse`, `BackendAuthError`, `LogoutResponse`
- `TwoFactorErrorCode`, `TwoFactorSetupResponse`, `TwoFactorVerifyResponse`, `TwoFactorResendResponse`, `TwoFactorErrorResponse`

## Migration from 1.x

2.0.0 is a breaking release that drops Vuetify as a peer dependency. The wire-up changes are small:

### 1. Remove Vuetify (if it was only installed for this plugin)

```bash
yarn remove vuetify
```

If your app uses Vuetify for other features, keep it — the plugin just doesn't require it anymore.

### 2. Replace the three error components with one

Before (1.x):

```vue
<template>
  <router-view />
  <SessionExpiredModal />
  <PermissionDeniedToast />
  <ServiceUnavailableOverlay />
</template>

<script setup lang="ts">
import {
  SessionExpiredModal,
  PermissionDeniedToast,
  ServiceUnavailableOverlay
} from '@turnkeystaffing/get-native-vue-auth'
</script>
```

After (2.x):

```vue
<template>
  <router-view />
  <AuthErrorBoundary />
</template>
```

No import is needed — the plugin registers `AuthErrorBoundary` globally during `app.use()`. If you prefer an explicit import, `AuthErrorBoundary` is also re-exported from the package.

### 3. Update the `icons` option (if you customized it)

Icons are now Vue component refs instead of MDI class strings. The `permissionDenied` field is removed.

```diff
 app.use(bffAuthPlugin, {
   bffBaseUrl: '...',
   clientId: '...',
-  icons: {
-    sessionExpired: 'mdi-clock-alert-outline',
-    login: 'mdi-login',
-    permissionDenied: 'mdi-shield-alert',
-    serviceUnavailable: 'mdi-cloud-off-outline',
-    retry: 'mdi-refresh'
-  }
+  icons: {
+    sessionExpired: MyClockIcon, // Vue component ref
+    login: false                 // or `false` to hide
+  }
 })
```

If you didn't set `icons`, no change is needed — the plugin ships sensible FluentUI SVG defaults.

### 4. Handle `permission_denied` yourself

The plugin no longer renders UI for `permission_denied`. The store still tracks the error, so continue reading it via `useAuth()` or `useAuthStore()` and render whatever notification your app design calls for:

```ts
const { error, clearError } = useAuth()
watch(error, (e) => {
  if (e?.type === 'permission_denied') {
    myToast.show(e.message)
    clearError()
  }
})
```

## License

Proprietary - Turnkey Staffing
