# Source Tree Analysis

**Scope:** `@turnkeystaffing/get-native-vue-auth` v2.0.0 — single-part Vue 3 library.
**Generated:** 2026-04-18 (full rescan, deep)

---

## Annotated Tree

```
get-native-vue-auth/
├── src/                             # All shipped source (dts + esm bundle target)
│   ├── index.ts                     # ★ Public barrel — every exported symbol
│   ├── plugin.ts                    # ★ `bffAuthPlugin` install() + DEFAULT_ICONS
│   ├── config.ts                    # Vue InjectionKey + module-scoped global config
│   ├── shims-vue.d.ts               # TS declarations for *.vue modules
│   ├── test-setup.ts                # Vitest global setup (bootstraps Pinia)
│   │
│   ├── stores/
│   │   ├── auth.ts                  # Pinia `auth` store — state, getters, actions
│   │   └── __tests__/auth.spec.ts
│   │
│   ├── services/
│   │   ├── auth.ts                  # `AuthService` singleton — BFF HTTP calls, login redirects, 2FA
│   │   ├── interceptors.ts          # `setupAuthInterceptors` — request/response Axios interceptors
│   │   ├── errorCodeMap.ts          # ERROR_CODE_TO_TYPE + KNOWN_INLINE_CODES + mapErrorCodeToType + statusFallbackType
│   │   └── __tests__/{auth,interceptors,errorCodeMap}.spec.ts
│   │
│   ├── composables/
│   │   └── useAuth.ts               # Reactive wrapper over `useAuthStore()` for components
│   │
│   ├── router/
│   │   └── guards.ts                # `createAuthGuard` / `setupAuthGuard` — navigation guard factory
│   │
│   ├── utils/
│   │   ├── jwt.ts                   # `decodeJwt`, `extractEmailFromJwt`, `decodeAccessToken`
│   │   └── loginCircuitBreaker.ts   # sessionStorage-backed redirect loop breaker (3 attempts / 2 min)
│   │
│   ├── types/
│   │   ├── auth.ts                  # UserInfo, AuthError, AuthErrorType (5 categories), tokens, 2FA
│   │   ├── config.ts                # BffAuthPluginOptions, BffAuthConfig, per-view props contracts
│   │   └── index.ts                 # Re-export barrel
│   │
│   └── components/
│       ├── AuthErrorBoundary.vue    # ★ Teleported overlay — picks the right view for error.type
│       ├── icons/                   # Bundled FluentUI SVG icons (Login, Retry, SessionExpired, ServiceUnavailable)
│       └── views/
│           ├── overlay.css          # Shared card/button/overlay styles (CSS custom properties)
│           ├── SessionExpiredView.vue
│           ├── ServiceUnavailableView.vue    # Includes 30s countdown + auto-retry
│           ├── DevErrorView.vue              # Terminal — shows error.code
│           ├── AccountBlockedView.vue        # Branches copy on `insufficient_permissions`
│           ├── ServerErrorView.vue           # Terminal — emits `dismiss`
│           └── __tests__/*.spec.ts
│
├── demo/                            # Dev-only Vue app (NOT shipped) — run via `yarn demo`
│   ├── main.ts
│   ├── logger-stub.ts               # Aliased to `@turnkeystaffing/get-native-vue-logger` in demo vite config
│   └── components/DemoControlPanel.vue
│
├── dist/                            # Built artifacts, rebuilt by `vite build`
│   ├── index.js                     # ESM bundle, peer deps externalized
│   ├── index.d.ts                   # Rollup-bundled types (single file)
│   └── get-native-vue-auth.css
│
├── docs/                            # Generated + hand-written documentation (this folder)
│   ├── index.md                     # Master navigation
│   ├── project-overview.md          # ← generated
│   ├── architecture.md              # ← generated
│   ├── source-tree-analysis.md      # ← generated (this file)
│   ├── component-inventory.md       # ← generated
│   ├── state-management.md          # ← generated
│   ├── api-contracts.md             # ← generated
│   ├── development-guide.md         # ← generated
│   ├── auth-error-codes.md          # ← hand-written (backend catalog)
│   ├── error-handling-analysis.md   # ← hand-written (SPA recovery categories)
│   └── project-scan-report.json     # Workflow state file
│
├── _bmad/                           # BMAD framework install (config + installer metadata)
├── _bmad-output/
│   ├── planning-artifacts/          # Planning docs (tech-specs, PRFAQs)
│   └── implementation-artifacts/    # Per-feature implementation specs + deferred work
│
├── package.json                     # scripts, peer/dev deps, Yarn Berry 4.12.0
├── tsconfig.json                    # strict, ES2020, bundler resolution, rootDir=src, outDir=dist
├── vite.config.ts                   # Library build — ESM only, peer deps externalized, dts plugin
├── vite.config.demo.ts              # Demo app build — demo/ as root, logger stubbed
├── vitest.config.ts                 # jsdom + src/test-setup.ts, merges vite.config.ts
├── eslint.config.mjs                # flat config — tseslint + eslint-plugin-vue recommended
├── .yarnrc.yml                      # node-modules linker + @turnkeystaffing scope → GitHub Packages
└── README.md                        # Public docs (quickstart, API, migration guide, theming)
```

★ = entry-point / primary integration surface.

---

## Critical Directories

| Path | Purpose | Change-risk hotspot |
|---|---|---|
| `src/services/` | BFF client, interceptors, canonical error-code map | Yes — any backend error-code addition lands here first (`errorCodeMap.ts`). |
| `src/stores/auth.ts` | Pinia state machine driving auth + overlay. Owns `setError()` semantics (clears identity on `session_expired`/`account_blocked`). | Yes — state-clear rules must match view recovery CTAs. |
| `src/components/AuthErrorBoundary.vue` + `views/` | Zero-framework overlay — five recovery views + shared overlay.css. | Yes — accessibility (focus trap, scroll lock, aria) and public view-props contracts live here. |
| `src/router/guards.ts` | Navigation guard + login redirect with circuit breaker integration. | Low — stable since 1.8.x. |
| `src/utils/loginCircuitBreaker.ts` | Prevents infinite `/bff/login` ↔ `/bff/userinfo` loops via sessionStorage (3 attempts / 2 min). | Low. |
| `src/types/` | Public types — especially `AuthErrorType` (5 categories), `BffAuthPluginOptions`, per-view props. | Yes — any type change is a consumer-breaking API change. |
| `src/index.ts` | Public barrel; anything NOT re-exported here is not part of the library's contract. | Yes — exports define the public API. |

---

## Entry Points

| Concern | File | Symbol |
|---|---|---|
| Library runtime entry (ESM) | `src/index.ts` | barrel |
| Plugin install | `src/plugin.ts` | `bffAuthPlugin`, `DEFAULT_ICONS` |
| Pinia store | `src/stores/auth.ts` | `useAuthStore` |
| Axios interceptors | `src/services/interceptors.ts` | `setupAuthInterceptors(instance, getStore)` |
| Router guard | `src/router/guards.ts` | `setupAuthGuard(router)`, `createAuthGuard()` |
| Reactive composable | `src/composables/useAuth.ts` | `useAuth()` |
| Error routing | `src/services/errorCodeMap.ts` | `ERROR_CODE_TO_TYPE`, `mapErrorCodeToType`, `statusFallbackType`, `KNOWN_INLINE_CODES` |
| Overlay component | `src/components/AuthErrorBoundary.vue` | default export, registered globally as `AuthErrorBoundary` |

---

## Module Relationships

```
bffAuthPlugin.install(app, options)
    ├── validates options (bffBaseUrl, clientId, mode)
    ├── provides BFF_AUTH_CONFIG_KEY ─────────► useAuthConfig() (components)
    ├── sets module-scoped globalConfig ──────► getGlobalConfig() (services, store, interceptors)
    └── registers <AuthErrorBoundary/>

Router navigation ──► createAuthGuard() ──► authStore.initAuth()
                                              ├── authService.checkAuth()  (GET /bff/userinfo)
                                              └── (if authed, token mode) ensureValidToken()
                                                                             └── authService.getAccessToken()  (POST /bff/token)

Protected Axios call ──► request interceptor
                            ├── skip entirely in cookie mode
                            ├── ensureValidToken() — lazy refresh, 60s buffer, single-flight
                            └── Authorization: Bearer {token}
                         ──► response interceptor
                            ├── parseAuthError → mapErrorCodeToType (canonical map ⊕ overrides)
                            ├── store.setError({ type, code, message })
                            ├── unmapped? → onUnmappedError(code, status, error) + DEV console.warn
                            └── bare 401 → session_expired ; bare 429 → service_unavailable

store.setError()
    ├── session_expired / account_blocked → clear identity (isAuthenticated, user, accessToken, expiresAt)
    └── dev_error / server_error / service_unavailable → preserve identity

error.value in <AuthErrorBoundary/>
    └── picks view by type (session_expired | service_unavailable | dev_error | account_blocked | server_error)
        └── uses config.errorViews override, else bundled view + config.icons + config.text
            ├── SessionExpiredView       — onSignIn → authStore.login() (guarded by circuit breaker)
            ├── ServiceUnavailableView   — onRetry → authStore.initAuth(); 30s countdown auto-retries
            ├── DevErrorView / AccountBlockedView — onSignOut → authStore.logout()
            └── ServerErrorView          — emits `dismiss` → authStore.clearError()
```

No external integrations beyond the BFF (HTTP) and the injected `@turnkeystaffing/get-native-vue-logger`.
