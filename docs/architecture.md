# Architecture: @turnkeystaffing/get-native-vue-auth

**Generated:** 2026-02-04
**Scan Level:** Quick
**Version:** 1.3.3

## Executive Summary

A Vue 3 authentication plugin library implementing the BFF (Backend-for-Frontend) pattern. Provides a complete client-side auth solution including session management, token handling, route protection, Axios interceptors, and pre-built error UI components. Distributed as an ES module via GitHub Packages.

## Technology Stack

| Category | Technology | Version |
|----------|-----------|---------|
| Language | TypeScript | ^5.3.3 |
| Framework | Vue 3 | ^3.4.0 |
| State Management | Pinia | ^3.0.4 |
| HTTP Client | Axios | ^1.6.0 |
| Router | Vue Router | ^4.0.0 |
| UI Framework | None (bundled CSS + FluentUI SVGs, v2.0.0+) | n/a |
| JWT | jwt-decode | ^4.0.0 |
| Logging | @turnkeystaffing/get-native-vue-logger | ^1.0.0 |
| Build | Vite 7 (library mode) | ^7.0.0 |
| Test | Vitest 4 + @vue/test-utils | ^4.0.18 |
| Package Manager | Yarn 4 | 4.12.0 |

All runtime dependencies are **peer dependencies** — they are not bundled into the library output.

## Architecture Pattern

**Plugin/Library Architecture** with the following design patterns:

- **Vue Plugin Pattern**: Single entry point via `app.use(bffAuthPlugin, options)` for installation
- **Provide/Inject**: Config distributed via Vue's dependency injection (`InjectionKey<BffAuthConfig>`)
- **Global Config Holder**: Parallel config access for services outside Vue's reactive context
- **Composition API**: `useAuth()` composable for component integration
- **Pinia Store**: Centralized auth state management (`useAuthStore`)
- **Service Layer**: `AuthService` class encapsulating all BFF HTTP interactions
- **Interceptor Pattern**: Axios request/response interceptors for automatic token injection and error handling
- **Navigation Guard Pattern**: Vue Router `beforeEach` guards for route protection

## Module Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Consumer App                       │
│                                                     │
│   app.use(bffAuthPlugin, { bffBaseUrl, clientId })  │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│                   plugin.ts                          │
│   - Validates options                                │
│   - Creates resolved config (merges icon defaults)   │
│   - app.provide(BFF_AUTH_CONFIG_KEY, config)         │
│   - setGlobalConfig(config)                          │
└──────────────────────┬──────────────────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
┌─────────────┐ ┌───────────┐ ┌──────────────┐
│  config.ts  │ │ stores/   │ │  services/   │
│             │ │ auth.ts   │ │  auth.ts     │
│ Vue inject  │ │           │ │              │
│ + global    │ │ Pinia     │ │ AuthService  │
│ holder      │ │ store     │ │ (BFF HTTP)   │
└──────┬──────┘ └─────┬─────┘ └──────┬───────┘
       │              │              │
       ▼              ▼              ▼
┌─────────────────────────────────────────────┐
│              composables/useAuth.ts          │
│   Reactive facade: isAuthenticated, login,   │
│   logout, user, isLoading, error             │
└──────────────────────┬──────────────────────┘
                       │
       ┌───────────────┼────────────────────┐
       ▼               ▼                    ▼
┌────────────┐  ┌────────────┐  ┌──────────────────────┐
│  router/   │  │ services/  │  │  components/         │
│ guards.ts  │  │ intercep-  │  │                      │
│            │  │ tors.ts    │  │ AuthErrorBoundary    │
│ beforeEach │  │            │  │ + views/SessionExp   │
│ guard      │  │ Axios req/ │  │ + views/ServiceUnav  │
│            │  │ res hooks  │  │ + icons/*            │
└────────────┘  └────────────┘  └──────────────────────┘
```

## Data Flow

### Authentication Check Flow
1. `authStore.initAuth()` called on app startup
2. `authService.checkAuth()` → `GET /bff/userinfo` (with cookies)
3. BFF validates session cookie, returns `UserInfo` or 401
4. Store updates: `isAuthenticated`, `user`, `isLoading`

### Login Flow (Product SPA)
1. `authService.login({ returnUrl })` called
2. Redirects browser to `{bffBaseUrl}/bff/login?client_id={clientId}&return_url={returnUrl}`
3. BFF handles OAuth flow with identity provider
4. Browser redirected back to `returnUrl` with session cookie set

### Login Flow (Central Login)
1. `authService.submitCredentials(email, password)` → `POST /oauth/token`
2. Sets `oauth_session` cookie
3. `authService.completeOAuthFlow({ clientId, returnUrl })` → redirects to `/bff/login`
4. BFF completes OAuth, redirects to originating Product SPA

### Token Injection Flow
1. Axios interceptor on request: calls `authStore.ensureValidToken()`
2. Store checks token expiry, refreshes via `authService.getAccessToken()` if needed
3. `GET /bff/token` → BFF returns `{ access_token, token_type, expires_in, scope }`
4. Token added to `Authorization: Bearer {token}` header

### Error Handling Flow
1. Axios response interceptor catches auth errors (401, 403, 503)
2. `parseAuthError()` maps backend `error_type` to frontend `AuthErrorType`
3. `authStore.setError({ type, message })` updates store
4. `<AuthErrorBoundary />` (consumer-placed, plugin-registered) reacts to the error state:
   - `session_expired` → `SessionExpiredView` (full-viewport overlay with Sign In)
   - `service_unavailable` → `ServiceUnavailableView` (full-viewport overlay with retry countdown)
   - `permission_denied` → plugin UI is a no-op; the error stays on the store for the consumer to surface

## Type System

### Core Domain Types

| Type | Purpose |
|------|---------|
| `UserInfo` | User session data from `/bff/userinfo` (`user_id`, `email`, `session_id`, `created_at`, `last_activity`, `expires_at`) |
| `CheckAuthResponse` | Auth check result (`isAuthenticated` + `user`) |
| `TokenResponse` | Access token response (camelCase frontend) |
| `BackendTokenResponse` | Token response (snake_case from BFF) |
| `AuthError` | Frontend error structure (`type`, `message`, `retryAfter?`) |
| `AuthErrorType` | Error union: `session_expired \| permission_denied \| service_unavailable` |
| `BackendAuthError` | Backend error response (`detail`, `error_type`, `retry_after?`) |
| `DecodedAccessToken` | JWT claims (username, email, roles, guid, standard claims) |
| `LogoutResponse` | Logout result (`success: boolean`) |

### Configuration Types

| Type | Purpose |
|------|---------|
| `BffAuthPluginOptions` | Plugin install options (bffBaseUrl, clientId, logger?, icons?, text?, errorViews?, mode?) |
| `BffAuthConfig` | Resolved config with defaults applied |
| `AuthIcons` | Per-view icon config (`Component \| false`) |
| `AuthText` | Per-state copy overrides (title/message/button/countdown) |
| `AuthErrorViews` | Full view replacements (`sessionExpired`, `serviceUnavailable`) |

## BFF API Contract

The library communicates with a BFF server at `{bffBaseUrl}` using the following endpoints:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/bff/userinfo` | GET | Check auth status, get user info |
| `/bff/token` | GET | Get/refresh access token |
| `/bff/login` | GET (redirect) | Initiate OAuth login flow |
| `/bff/logout` | POST | End session |
| `/oauth/token` | POST | Submit credentials (Central Login only) |

All requests include cookies for session management (BFF pattern).

## Testing Strategy

- **Framework:** Vitest 4 with jsdom environment
- **Component Testing:** @vue/test-utils for Vue component mounting
- **Coverage:** Co-located tests in `__tests__/` directories
- **Test Files:** Spec files co-located with the modules they cover

## Build & Distribution

- **Build Tool:** Vite 7 in library mode
- **Output:** Single ES module (`dist/index.js`, ~27KB) + rolled-up declarations (`dist/index.d.ts`, ~21KB)
- **Externals:** All peer dependencies excluded from bundle
- **Registry:** GitHub Packages (`@turnkeystaffing` scope)
- **Module System:** ESM only (`"type": "module"`)
