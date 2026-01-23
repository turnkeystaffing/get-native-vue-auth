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
yarn add vue@^3.4.0 pinia@^2.0.0 axios@^1.6.0 vue-router@^4.0.0 vuetify@^3.0.0 jwt-decode@^4.0.0
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
  clientId: 'my-app-client-id',
  tokenClientId: 'my-token-client-id' // Optional, defaults to clientId
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

// Initiate login redirect
authService.initiateLogin('/return-url')

// Logout
await authService.logout()
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
| `clientId` | `string` | Yes | OAuth client ID for login |
| `tokenClientId` | `string` | No | Client ID for token requests (defaults to `clientId`) |
| `logger` | `Logger` | No | Custom logger instance |

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
- `UserInfo`, `AuthError`, `AuthErrorType`, `TokenResponse`, `CheckAuthResponse`, `BackendAuthError`, `LogoutResponse`

## License

Proprietary - Turnkey Staffing
