---
project_name: 'get-native-vue-auth'
user_name: 'Volodymyr'
date: '2026-03-02'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'code_quality', 'workflow_rules', 'critical_rules']
status: 'complete'
rule_count: 58
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

- **TypeScript** ^5.3.3 — strict mode, ES2020 target, bundler module resolution
- **Vue 3** ^3.4.0 — Composition API with `<script setup lang="ts">`
- **Pinia** ^3.0.4 — Options-style stores via `defineStore`
- **Axios** ^1.6.0 — HTTP client with interceptor pattern
- **Vue Router** ^4.0.0 — `RouteMeta` augmented with `public` flag
- **Vuetify** ^3.0.0 — MDI icons, individual component imports from `vuetify/components`
- **jwt-decode** ^4.0.0 — Client-side JWT decoding (no signature verification)
- **@turnkeystaffing/get-native-vue-logger** ^1.0.0 — Internal logging (peer dep)
- **Vite** ^7.0.0 — Library mode, single ES module output (`dist/index.js`)
- **Vitest** ^4.0.18 — jsdom environment, co-located `__tests__/` dirs
- **ESLint** ^9.39.2 — Flat config (`eslint.config.mjs`) with typescript-eslint + eslint-plugin-vue
- **Yarn** 4.12.0 — Package manager

**CRITICAL:** All runtime deps are **peer dependencies** — never add them as regular `dependencies`. The built output externalizes all of them.

## Critical Implementation Rules

### TypeScript Rules

- **Strict mode** — all code must satisfy `strict: true`; no `any` except in test files (ESLint warns on `@typescript-eslint/no-explicit-any`, disabled in `*.spec.ts`)
- **ESM only** — use `import`/`export` exclusively; no `require()`, no `const enum`, no namespace merging (`isolatedModules: true`)
- **Separate type exports** — use `export type { Foo }` for type-only exports; re-export everything public from `src/index.ts`
- **Path alias** — `@/*` maps to `src/*` (configured in tsconfig + vite)
- **Backend ↔ Frontend case mapping** — backend sends `snake_case`, frontend uses `camelCase`; map explicitly in service methods (e.g., `response.data.access_token` → `accessToken`), never use generic transformers
- **Guard-first error handling** — check `isAuthConfigured()` before HTTP calls; use `AuthConfigurationError` to prevent redirect loops; use `axios.isAxiosError()` for typed error handling
- **Unused variables** — prefix with `_` (ESLint rule: `argsIgnorePattern: '^_'`)

### Vue / Pinia / Vuetify Rules

- **Dual config access** — composables/components use `useAuthConfig()` (Vue inject); services use `getGlobalConfig()` (module-level holder). Never use inject outside Vue's reactive context.
- **Pinia options API** — use `defineStore('name', { state, getters, actions })`; do NOT use setup stores
- **Non-reactive checks as methods** — `Date.now()` comparisons (like token expiry) must be actions/methods, NOT getters; getters would cache stale results
- **Module-level state outside Pinia** — promises and non-serializable state (e.g., `refreshPromise`) must be kept as module-level variables, not in Pinia state
- **Composable facade** — wrap store access in `computed()` for reactivity; return plain functions for actions
- **Vuetify imports** — import components individually from `vuetify/components`, never import the full library
- **Component setup** — always use `<script setup lang="ts">` + `defineOptions({ name: 'ComponentName' })`
- **Icons** — use MDI icon strings from config (`config.icons.xxx`); support `false` to disable; never hardcode icon names in templates
- **Test IDs** — add `data-testid` on interactive elements; add ARIA attributes for accessibility
- **Router guards** — use factory pattern with DI for testability; mark public routes via `meta: { public: true }`
- **Store type exports** — export `type AuthStore = ReturnType<typeof useAuthStore>` for consumer type-checking

### Testing Rules

- **Co-located tests** — place tests in `__tests__/` directory next to the source file; name as `{module}.spec.ts`
- **Pinia setup** — every test file using stores MUST call `setActivePinia(createPinia())` in `beforeEach`
- **Mock lifecycle** — `vi.clearAllMocks()` in `beforeEach`, `vi.restoreAllMocks()` in `afterEach`
- **Logger mock** — always mock `@turnkeystaffing/get-native-vue-logger` with `vi.mock()` factory returning `createLogger` stub
- **Preserve real classes in mocks** — when mocking services, use `importOriginal` to keep error classes (e.g., `AuthConfigurationError`) for `instanceof` checks
- **Type-safe mocking** — use `vi.mocked(fn)` for assertions, not raw casts
- **JWT test helper** — use `createTestToken(payload)` to create fake JWTs for decode testing; never use real tokens
- **Global test setup** — `src/test-setup.ts` provides Vuetify polyfills (`ResizeObserver`, `IntersectionObserver`, `matchMedia`) and default `BffAuthConfig`; do not duplicate these mocks in individual test files
- **No `any` in tests** — ESLint rule `@typescript-eslint/no-explicit-any` is disabled for `*.spec.ts` files, but prefer typed mocks when possible

### Code Quality & Style Rules

- **No Prettier** — ESLint handles all formatting; do not add Prettier
- **File naming** — `camelCase.ts` for modules, `PascalCase.vue` for components
- **Type naming** — `PascalCase` for types/interfaces; `UPPER_SNAKE_CASE` for injection keys; `camelCase` for functions and non-injection-key constants
- **JSDoc required** — all exported functions, classes, and interfaces must have JSDoc with `@see` ADR/story references where applicable
- **Security tags** — use `@security` JSDoc tag for operations handling sensitive data (secrets, backup codes, tokens)
- **Barrel exports** — `src/index.ts` is the single public API surface; every new public export must be added there
- **Module per concern** — types in `types/`, stores in `stores/`, services in `services/`, composables in `composables/`, router logic in `router/`, utilities in `utils/`, Vue components in `components/`
- **Singleton services** — export a singleton instance + the class (for testing): `export const authService = new AuthService()` + `export { AuthService }`
- **Logger per module** — each module creates its own logger via `createLogger('ModuleName')`

### Development Workflow Rules

- **Build output** — Vite library mode produces `dist/index.js` (ES module) + `dist/index.d.ts` (rolled-up types); verify build after changes with `yarn build`
- **New peer deps** — when adding a runtime dependency, add it to BOTH `peerDependencies` in `package.json` AND `rollupOptions.external` in `vite.config.ts`; also add to `devDependencies` for local development
- **Typecheck before commit** — run `yarn typecheck` to verify; `tsc --noEmit` catches errors the build might miss
- **Lint before commit** — run `yarn lint`; fix with `yarn lint:fix`
- **Test before commit** — run `yarn test`; all tests must pass
- **Package manager** — use Yarn 4 exclusively (`yarn` commands, not `npm`); `.yarnrc.yml` configures the project
- **Published scope** — `@turnkeystaffing` on GitHub Packages; version in `package.json` must be bumped before publishing

### Critical Don't-Miss Rules

- **NEVER add runtime deps as `dependencies`** — this is a library; all runtime deps are `peerDependencies` externalized by the build
- **NEVER use `inject()` in services** — services run outside Vue's reactive context; use `getGlobalConfig()` instead
- **NEVER put Promises or non-serializable state in Pinia** — use module-level variables (e.g., `let refreshPromise`)
- **NEVER use getters for time-based checks** — `Date.now()` is not a reactive dependency; use actions/methods instead
- **NEVER redirect without `isAuthConfigured()` guard** — missing config causes infinite redirect loops; throw `AuthConfigurationError` instead. Exception: `loginWithCustomClient()` intentionally skips the full `isAuthConfigured()` check because it accepts its own `clientId` param; it still checks `getBffBaseUrl()` directly and throws `AuthConfigurationError` if missing.
- **Same-origin redirect enforcement** — `login()` blocks cross-origin redirects. `loginWithCustomClient()` skips same-origin enforcement (BFF validates the redirect_url against registered client URIs server-side). `completeOAuthFlow()` also skips same-origin (BFF validates server-side).
- **Sensitive data handling** — never log, persist, or report 2FA `secret`, `qr_code`, or `backup_codes`; use `@security` JSDoc tag
- **All BFF requests** — must include `withCredentials: true` for cookie-based sessions
- **Token validation** — reject empty/whitespace `accessToken`; clamp `expiresIn` to minimum 5 seconds for 0/negative/non-finite values
- **Concurrent refresh prevention** — share a single module-level `refreshPromise`; never start parallel refresh requests
- **Guard initialization** — `initialized` flag must be closure-scoped per `createAuthGuard()` call, not module-scoped
- **Graceful logout** — always reset state via `$reset()` even if the logout API call throws

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing any code
- Follow ALL rules exactly as documented
- When in doubt, prefer the more restrictive option
- Update this file if new patterns emerge

**For Humans:**

- Keep this file lean and focused on agent needs
- Update when technology stack changes
- Review quarterly for outdated rules
- Remove rules that become obvious over time

Last Updated: 2026-03-02
