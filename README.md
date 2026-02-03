# @turnkeystaffing/get-native-vue-auth

Vue 3 authentication plugin for BFF (Backend for Frontend) authentication flows. Provides session management, token handling, router guards, and error UI components.

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
yarn add vue@^3.4.0 pinia@^3.0.4 axios@^1.6.0 vue-router@^4.0.0 vuetify@^3.0.0 jwt-decode@^4.0.0
yarn add @turnkeystaffing/get-native-vue-logger
```

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

### 4. Add Error Components

```vue
<!-- App.vue -->
<template>
  <router-view />

  <!-- Auth error UI components -->
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

async function handleLogin(email: string, password: string) {
  // Submit credentials (sets oauth_session cookie)
  await authService.submitCredentials(email, password)

  // Complete OAuth flow - redirects to /bff/login then back to originating SPA
  // Note: This allows cross-origin redirects (required to return to Product SPA)
  authService.completeOAuthFlow({ clientId, returnUrl })
}
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
| `icons` | `Partial<AuthIcons>` | No | Override or disable component icons |

### Custom Icons

Override default MDI icons with any icon library, or set to `false` to disable individual icons:

```typescript
app.use(bffAuthPlugin, {
  bffBaseUrl: 'https://api.example.com',
  clientId: 'my-app',
  icons: {
    // Use Font Awesome instead of MDI
    sessionExpired: 'fa-solid fa-clock',
    login: 'fa-solid fa-right-to-bracket',
    // Disable specific icons entirely
    permissionDenied: false,
    retry: false
  }
})
```

| Icon | Default | Used In |
|------|---------|---------|
| `sessionExpired` | `mdi-clock-alert-outline` | SessionExpiredModal title |
| `login` | `mdi-login` | SessionExpiredModal sign-in button |
| `permissionDenied` | `mdi-shield-alert` | PermissionDeniedToast |
| `serviceUnavailable` | `mdi-cloud-off-outline` | ServiceUnavailableOverlay title |
| `retry` | `mdi-refresh` | ServiceUnavailableOverlay try-now button |

Each icon accepts a `string` (icon class name) or `false` (disables the icon).

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

### SessionExpiredModal

Displays a persistent modal when the session expires, prompting the user to sign in again.

### PermissionDeniedToast

Shows a non-blocking toast notification when the user lacks permission for an action. Auto-dismisses after 5 seconds.

### ServiceUnavailableOverlay

Full-screen overlay with retry countdown when the auth service is unavailable. Includes automatic retry and manual "Try Now" button.

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
- `SessionExpiredModal` - Session expired modal
- `PermissionDeniedToast` - Permission denied toast
- `ServiceUnavailableOverlay` - Service unavailable overlay

### Types
- `UserInfo`, `AuthError`, `AuthErrorType`, `AuthIcons`, `TokenResponse`, `CheckAuthResponse`, `BackendAuthError`, `LogoutResponse`

## License

Proprietary - Turnkey Staffing
