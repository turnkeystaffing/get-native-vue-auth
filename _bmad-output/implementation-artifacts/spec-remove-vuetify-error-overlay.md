---
title: 'Remove Vuetify peer dependency, replace with plugin-owned full-page error overlay'
type: 'refactor'
created: '2026-04-17'
status: 'done'
baseline_commit: '27bf23b73187b43233a6df09a3bab60d3908db25'
context:
  - '{project-root}/CLAUDE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Plugin forces consumers to install Vuetify 3 as a peer dep just to render three error UIs (`SessionExpiredModal`, `ServiceUnavailableOverlay`, `PermissionDeniedToast`), and the integration surface leaks implementation by requiring consumers to import and mount those components in their `App.vue`.

**Approach:** Ship v2.0.0 that drops Vuetify entirely. The plugin registers `AuthErrorBoundary` via `app.component()` during `install()` — consumers add a single `<AuthErrorBoundary />` tag to their `App.vue` (standard Vue plugin pattern, no sub-app). The boundary watches the auth store's `error` and renders one of two internal full-viewport views (`SessionExpiredView`, `ServiceUnavailableView`) via `<Teleport to="body">`, styled as regular pages, with pure-CSS scaffolding, CSS custom properties for theming, bundled FluentUI SVGs as Vue icon components, and a config surface for full view-replacement, text overrides, and icon overrides. `permission_denied` UI is dropped; the store still exposes the error for consumers to handle.

## Boundaries & Constraints

**Always:**
- `vuetify`, `vuetify/components`, `vuetify/directives` must not appear in any `src/**`, `package.json`, `vite.config.ts`, or `src/test-setup.ts` after the change.
- Consumer integration is `app.use(bffAuthPlugin, {...})` plus `<AuthErrorBoundary />` in `App.vue`. Requires `createPinia()` to have been installed on the app first (documented).
- All existing store/service/interceptor behavior (error types, retry, circuit breaker, `setError`/`clearError` contract) is preserved byte-for-byte. This refactor only replaces presentation.
- Overlay is full-viewport (`position: fixed; inset: 0;`), opaque background, looks like a standalone page (not a dimmed modal over app content). Always-on-top via high `z-index` CSS var.
- Accessibility parity: `role="alertdialog"`, `aria-modal`, `aria-live`, `aria-labelledby`/`aria-describedby`, focus moves to primary action on show, body scroll locked while visible.
- Use `yarn`, never `npm install` or edit `package-lock.json`.

**Ask First:**
- If FluentUI SVG sourcing requires any runtime dep (not just copy-pasted paths in repo), HALT.

**Never:**
- Do not re-implement `permission_denied` UI in the plugin. Store still tracks it; consumers handle it.
- Do not introduce a new UI framework (no Tailwind, no headless UI lib). Inline SFC styles + CSS custom properties only.
- Do not add `vue-router` coupling; overlay is presentation-only, does not navigate.
- Do not add backwards-compat shims for `SessionExpiredModal` / `PermissionDeniedToast` / `ServiceUnavailableOverlay` exports — clean break at 2.0.0.
- Do not add new peer dependencies.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Session expired | `authStore.error.type === 'session_expired'` | `SessionExpiredView` renders full-page; Sign In button focused; click invokes circuit breaker + `login(returnUrl)` | If circuit breaker trips, store transitions to `service_unavailable` (existing behavior preserved) |
| Service unavailable | `authStore.error.type === 'service_unavailable'`, optional `retryAfter` | `ServiceUnavailableView` renders full-page; countdown starts from `retryAfter ?? 30`; progress bar fills; auto-retry at 0; manual "Try Now" button | On retry failure, countdown restarts using new `retryAfter`; interval cleaned up on state change / unmount |
| Permission denied | `authStore.error.type === 'permission_denied'` | Plugin UI does **not** render. Store still exposes error via `useAuth().error` | N/A — consumer responsibility |
| No error | `authStore.error === null` | Nothing rendered; body scroll unlocked; no DOM footprint beyond Teleport anchor | N/A |
| Consumer provides `errorViews.sessionExpired` | Custom component ref in plugin options | Boundary renders consumer's component with props `{ error, onSignIn, config }` instead of default view (props shape is stable public API from v2.0.0) | If consumer component throws, error surfaces to Vue error handler; default view is not a fallback |
| Consumer omits `<AuthErrorBoundary />` | Component registered but not placed in template | No overlay renders on error; store still works; plugin logs no warning (consumer's choice) | N/A — consumer responsibility |
| Icon set to `false` | `icons.sessionExpired: false` in options | View renders without icon; layout unaffected | N/A |

</frozen-after-approval>

## Code Map

- `package.json` -- remove `vuetify` from peerDependencies and devDependencies; bump version to `2.0.0`; no new deps.
- `vite.config.ts` -- remove `vuetify`, `vuetify/components`, `vuetify/directives` from `external` and `globals`.
- `src/plugin.ts` -- change `DEFAULT_ICONS` to `Component` refs (bundled FluentUI SVG components); register `AuthErrorBoundary` via `app.component('AuthErrorBoundary', AuthErrorBoundary)` during `install()`.
- `src/types/config.ts` -- change `AuthIcons` from `string | false` to `Component | false`; add optional `errorViews?: { sessionExpired?: Component; serviceUnavailable?: Component }` and `text?: { sessionExpired?, serviceUnavailable? }` (see Design Notes).
- `src/components/AuthErrorBoundary.vue` -- NEW. Consumer-placed component: reads `useAuth().error`, picks view, renders inside `<Teleport to="body">`, locks body scroll while visible, moves focus to primary action on show.
- `src/components/views/SessionExpiredView.vue` -- NEW. Full-viewport page layout; icon + title + message + Sign In button; preserves existing circuit-breaker + `login(returnUrl)` logic.
- `src/components/views/ServiceUnavailableView.vue` -- NEW. Full-viewport page layout; icon + title + message + countdown progress + "Try Now"; preserves existing retry/`initAuth`/`session_expired`-on-invalid behavior.
- `src/components/icons/IconSessionExpired.vue`, `IconLogin.vue`, `IconServiceUnavailable.vue`, `IconRetry.vue` -- NEW. Tiny SFCs with inline `<svg>` paths copied from `@fluentui/svg-icons` (attribution comment at top of each).
- `src/components/SessionExpiredModal.vue`, `ServiceUnavailableOverlay.vue`, `PermissionDeniedToast.vue` -- DELETE.
- `src/components/__tests__/*.spec.ts` -- DELETE (three old specs).
- `src/components/__tests__/AuthErrorBoundary.spec.ts`, `SessionExpiredView.spec.ts`, `ServiceUnavailableView.spec.ts` -- NEW. Vuetify-free, cover the I/O matrix above.
- `src/index.ts` -- remove the three `SessionExpiredModal` / `PermissionDeniedToast` / `ServiceUnavailableOverlay` exports. Export `AuthErrorBoundary` (consumers need it for template use). Do not export internal views.
- `src/test-setup.ts` -- remove `ResizeObserver`, `IntersectionObserver`, `matchMedia` mocks (Vuetify-only); update `testConfig.icons` to use Component refs (or stub components).
- `README.md`, `docs/architecture.md`, `docs/component-inventory.md`, `docs/development-guide.md`, `docs/source-tree-analysis.md` -- update integration docs, add 1.x → 2.0.0 migration section, remove Vuetify references.

## Tasks & Acceptance

**Execution:**
- [x] `src/components/icons/*.vue` -- create four tiny SVG-wrapping SFCs from `@fluentui/svg-icons` paths -- icon layer for default views
- [x] `src/types/config.ts` -- widen `AuthIcons` to `Component | false`; add `errorViews` and `text` option trees -- config surface for full customization
- [x] `src/components/views/SessionExpiredView.vue` -- build full-viewport page view with CSS custom properties and preserved sign-in logic -- default session_expired UI
- [x] `src/components/views/ServiceUnavailableView.vue` -- build full-viewport page view with countdown, progress, retry logic preserved -- default service_unavailable UI
- [x] `src/components/AuthErrorBoundary.vue` -- consumer-placed component: state-driven view selection, `<Teleport to="body">`, scroll lock, focus management, consumer-override wiring
- [x] `src/plugin.ts` -- switch `DEFAULT_ICONS` to Component refs; register `AuthErrorBoundary` via `app.component()` -- standard plugin registration
- [x] `src/index.ts` -- remove three old component exports; export `AuthErrorBoundary` -- clean export surface
- [x] `src/test-setup.ts` -- drop Vuetify-only mocks; rewrite `testConfig.icons` with Component refs (or stub) -- test environment reflects v2
- [x] `src/components/__tests__/AuthErrorBoundary.spec.ts` + view specs -- cover I/O matrix scenarios, replace deleted specs -- unit coverage
- [x] Delete `src/components/{SessionExpiredModal,ServiceUnavailableOverlay,PermissionDeniedToast}.vue` and their spec files -- remove Vuetify-coupled code
- [x] `vite.config.ts` -- remove vuetify entries from `external` and `globals` -- bundle config cleanup
- [x] `package.json` -- remove `vuetify` from peer + dev deps; bump `version` to `2.0.0` -- ship break
- [x] `README.md` + `docs/*.md` -- update integration + add migration section -- consumers can upgrade without guessing
- [x] Update any existing test that references `icons: { ... 'mdi-...' ... }` or `permissionDenied` icon field (search: `stores/__tests__`, `services/__tests__`, `router/__tests__`) -- keep the suite green after config shape change

**Acceptance Criteria:**
- Given a fresh consumer app with `createPinia()`, `app.use(bffAuthPlugin, { bffBaseUrl, clientId })`, and `<AuthErrorBoundary />` in `App.vue`, when `authStore.setError({ type: 'session_expired' })` is called, then a full-viewport page appears via Teleport to body.
- Given the plugin is installed, when `grep -ri vuetify src/ package.json vite.config.ts` runs, then there are zero matches.
- Given `yarn test` runs, then all suites pass and no spec imports from `vuetify`.
- Given `yarn typecheck` runs, then there are zero errors (including the widened `AuthIcons` type).
- Given the overlay is visible, when a keyboard user presses Tab, then focus is trapped within the view's actions; when the error clears, focus returns and body scroll is restored.

## Design Notes

**Plugin registration pattern** (plugin.ts sketch — do not copy verbatim into implementation without reviewing current imports):
```ts
import AuthErrorBoundary from './components/AuthErrorBoundary.vue'
// inside install(app, options):
app.component('AuthErrorBoundary', AuthErrorBoundary)
```
Standard Vue plugin component registration. `AuthErrorBoundary` lives in the consumer's app tree, uses `useAuth()` for store access (same Pinia instance), and reads config via the module-level `getGlobalConfig()` (already set via `setGlobalConfig(config)`).

**Config shape additions:**
```ts
interface BffAuthPluginOptions {
  // ...existing
  icons?: Partial<AuthIcons>           // now Component | false
  errorViews?: {                        // advanced escape hatch — full view replacement
    sessionExpired?: Component          // receives props: { error, onSignIn, config } (stable API)
    serviceUnavailable?: Component      // receives props: { error, onRetry, config, retryAfter } (stable API)
  }
  text?: {                              // per-state label overrides
    sessionExpired?: { title?: string; message?: string; button?: string }
    serviceUnavailable?: {
      title?: string; message?: string; button?: string
      retryingLabel?: string
      countdownLabel?: (seconds: number) => string
    }
  }
}
```

**CSS custom properties exposed on the Teleport target (scoped to `.bff-auth-overlay`):**
`--bff-auth-bg`, `--bff-auth-fg`, `--bff-auth-muted`, `--bff-auth-accent`, `--bff-auth-accent-fg`, `--bff-auth-danger`, `--bff-auth-max-width` (default 480px), `--bff-auth-z-index` (default 2147483000), `--bff-auth-font-family` (default `inherit`). Include sensible light defaults; respect `@media (prefers-color-scheme: dark)` for fallback dark values.

**FluentUI icon source:** Copy SVG `<path>` data from `@fluentui/svg-icons` (MIT, © Microsoft) for: `clock_alert_24_regular`, `arrow_enter_24_regular`, `cloud_off_24_regular`, `arrow_clockwise_24_regular`. Attribution comment at the top of each icon SFC. No runtime package dep.

## Verification

**Commands:**
- `yarn typecheck` -- expected: exits 0
- `yarn lint` -- expected: exits 0
- `yarn test` -- expected: all suites pass, zero Vuetify imports resolved
- `yarn build` -- expected: succeeds; `dist/index.js` has no Vuetify chunks
- `grep -ri 'vuetify\|@vicons\|mdi-' src/ package.json vite.config.ts` -- expected: zero matches
- `node -e "const p=require('./package.json'); if(p.peerDependencies.vuetify||p.devDependencies.vuetify) process.exit(1)"` -- expected: exits 0
- `node -e "const p=require('./package.json'); if(p.version!=='2.0.0') process.exit(1)"` -- expected: exits 0

**Manual checks:**
- In a scratch consumer app: install the built tarball, wire `app.use(createPinia()); app.use(bffAuthPlugin, { bffBaseUrl, clientId })` and add `<AuthErrorBoundary />` to `App.vue`, then dispatch both error types from devtools and confirm the full-page overlays appear.
- Keyboard: Tab cycles within view actions, no focus escape to background app; Shift+Tab behaves symmetrically.
- With `prefers-color-scheme: dark` set, verify dark palette applies.

## Suggested Review Order

**Public surface & config contract**

- Entry point: consumer API shape — options, typed view-prop contract, icon/text/errorViews shape.
  [`config.ts:1`](../../src/types/config.ts#L1)

- Plugin install: global `AuthErrorBoundary` registration, resolved config merging, Component-ref `DEFAULT_ICONS`.
  [`plugin.ts:30`](../../src/plugin.ts#L30)

- Exports barrel: one component out (`AuthErrorBoundary`), two new type exports for consumer view replacement.
  [`index.ts:79`](../../src/index.ts#L79)

**Error boundary orchestration**

- State-driven view selection, sanitized `retryAfter`, Teleport-to-body with focus trap and scroll lock.
  [`AuthErrorBoundary.vue:21`](../../src/components/AuthErrorBoundary.vue#L21)

- `handleSignIn` / `handleRetry`: circuit-breaker preservation + `initAuth` + session_expired transition.
  [`AuthErrorBoundary.vue:68`](../../src/components/AuthErrorBoundary.vue#L68)

- Tab-wrap keydown handler + fallback focus for consumer views without `primaryAction` expose.
  [`AuthErrorBoundary.vue:137`](../../src/components/AuthErrorBoundary.vue#L137)

**Default views**

- Countdown + auto-retry + restart-on-failure + NaN guard — the highest-complexity view.
  [`ServiceUnavailableView.vue:42`](../../src/components/views/ServiceUnavailableView.vue#L42)

- CSS custom properties + accessibility attrs + dark-mode fallback via `prefers-color-scheme`.
  [`ServiceUnavailableView.vue:186`](../../src/components/views/ServiceUnavailableView.vue#L186)

- Simpler sibling view — text/icon overrides, loading guard on the Sign In button.
  [`SessionExpiredView.vue:1`](../../src/components/views/SessionExpiredView.vue#L1)

**Presentation assets**

- Bundled FluentUI SVG path data, `currentColor` fills, attribution comments.
  [`IconServiceUnavailable.vue:1`](../../src/components/icons/IconServiceUnavailable.vue#L1)

**Build & dep cleanup**

- Version bump to 2.0.0, Vuetify removed from both peer and dev deps.
  [`package.json:3`](../../package.json#L3)

- Vuetify entries removed from rollup externals and globals.
  [`vite.config.ts:30`](../../vite.config.ts#L30)

- Test setup: Vuetify-only polyfills gone, `testConfig.icons` uses a stub Component ref.
  [`test-setup.ts:22`](../../src/test-setup.ts#L22)

**Tests**

- Boundary integration: view selection, Teleport, scroll-lock, sign-in wiring, consumer override, focus trap, NaN sanitation.
  [`AuthErrorBoundary.spec.ts:75`](../../src/components/__tests__/AuthErrorBoundary.spec.ts#L75)

- Service-unavailable view: countdown, auto-retry, manual retry, retryAfter reactivity, unmount cleanup, restart-on-failure.
  [`ServiceUnavailableView.spec.ts:57`](../../src/components/views/__tests__/ServiceUnavailableView.spec.ts#L57)

- Interceptor fixture update: icon fields now `false`, `errorViews` + `text` present.
  [`interceptors.spec.ts:66`](../../src/services/__tests__/interceptors.spec.ts#L66)

**Docs & migration**

- 2.0.0 breaking-change banner + migration section with `icons` diff and `permission_denied` consumer handler example.
  [`README.md:1`](../../README.md#L1)

- Updated error-handling flow, type system entries, component tree.
  [`architecture.md:115`](../../docs/architecture.md#L115)

- Consolidated component catalog reflecting `AuthErrorBoundary` + views + icons.
  [`component-inventory.md:1`](../../docs/component-inventory.md#L1)
