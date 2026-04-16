# Component Inventory: @turnkeystaffing/get-native-vue-auth

**Generated:** 2026-02-04
**Updated:** 2026-04-17 (v2.0.0)

## Overview

As of v2.0.0, the library exposes a single consumer-placed component — `AuthErrorBoundary` — plus internal views and bundled FluentUI SVG icons. All components are Vue 3 SFCs with no external UI framework dependency. Presentation is pure CSS with custom properties for theming; accessibility parity with v1.x is preserved (`role="alertdialog"`, `aria-modal`, `aria-live`, focus management, body scroll lock).

## Components

### AuthErrorBoundary (public)

- **File:** `src/components/AuthErrorBoundary.vue`
- **Test:** `src/components/__tests__/AuthErrorBoundary.spec.ts`
- **Category:** Public API / Error UI orchestrator
- **Purpose:** Watches `useAuth().error` and renders a full-viewport overlay via `<Teleport to="body">` when the error type is `session_expired` or `service_unavailable`. Renders nothing for `permission_denied` or `null`.
- **Registration:** Registered globally by `bffAuthPlugin` during `app.use(...)`. Consumers add `<AuthErrorBoundary />` to their root template; no import required.
- **Responsibilities:** Body scroll lock, focus capture/restore, primary-action focus on show, wiring of `onSignIn` (login circuit breaker + `authStore.login(returnUrl)`) and `onRetry` (`authStore.initAuth()` + session-expired transition).
- **Consumer override:** When `errorViews.sessionExpired` / `errorViews.serviceUnavailable` are provided, the boundary renders those components instead of the defaults; the `{ error, onSignIn/onRetry, config, retryAfter? }` prop contract is a stable public API.

### SessionExpiredView (internal default)

- **File:** `src/components/views/SessionExpiredView.vue`
- **Test:** `src/components/views/__tests__/SessionExpiredView.spec.ts`
- **Category:** Internal default view
- **Trigger:** `authStore.error.type === 'session_expired'`
- **Behavior:** Full-viewport page styled via CSS custom properties; icon + title + message + Sign In button. Backend-provided `error.message` takes precedence over the default copy unless `text.sessionExpired.message` is set.
- **Icons:** `sessionExpired` (title), `login` (button). Each `Component | false`.

### ServiceUnavailableView (internal default)

- **File:** `src/components/views/ServiceUnavailableView.vue`
- **Test:** `src/components/views/__tests__/ServiceUnavailableView.spec.ts`
- **Category:** Internal default view
- **Trigger:** `authStore.error.type === 'service_unavailable'`
- **Behavior:** Full-viewport page with a countdown (starts from `error.retryAfter ?? 30`), progress bar, auto-retry at 0, and manual "Try Now" button. Watches the `retryAfter` prop — when the boundary passes a new value (because a retry failed and a fresh `service_unavailable` error landed with a new `retryAfter`), the countdown restarts.
- **Icons:** `serviceUnavailable` (title), `retry` (button). Each `Component | false`.

### Icon SFCs (internal defaults)

- **Files:** `src/components/icons/{IconSessionExpired,IconLogin,IconServiceUnavailable,IconRetry}.vue`
- **Source:** SVG `<path>` data copied from `@fluentui/svg-icons` (MIT, © Microsoft) — `clock_24_regular`, `arrow_right_24_regular`, `cloud_off_24_regular`, `arrow_clockwise_24_regular`. Each SFC carries an attribution comment.
- **Color:** All paths use `currentColor`; theming via `--bff-auth-accent` / `--bff-auth-danger`.

## Customization Surface

| Plugin option | Purpose |
|---------------|---------|
| `icons` | Swap individual icon components (Vue component refs) or set any to `false` to hide |
| `text` | Per-state copy overrides (`title`, `message`, `button`, `retryingLabel`, `countdownLabel(seconds)`) |
| `errorViews` | Replace the default views entirely with your own components |

Per-state CSS custom properties (scoped to the overlay root): `--bff-auth-bg`, `--bff-auth-fg`, `--bff-auth-muted`, `--bff-auth-accent`, `--bff-auth-accent-fg`, `--bff-auth-danger`, `--bff-auth-max-width`, `--bff-auth-z-index`, `--bff-auth-font-family`. Sensible light defaults ship; dark-mode fallbacks apply automatically under `@media (prefers-color-scheme: dark)`.

```typescript
import MyClockIcon from '@/icons/MyClockIcon.vue'

app.use(bffAuthPlugin, {
  bffBaseUrl: '...',
  clientId: '...',
  icons: {
    sessionExpired: MyClockIcon,
    retry: false
  },
  text: {
    sessionExpired: { title: 'Signed out' }
  }
})
```

## Design Patterns

- **State-driven rendering:** The boundary mirrors `authStore.error` — no imperative show/hide API.
- **No UI framework dependency:** Plain `<div>` + scoped CSS with custom properties; FluentUI SVGs are bundled path data, not a runtime dep.
- **Stable override contract:** View prop shape is frozen from v2.0.0 forward so consumer-provided `errorViews` don't churn between minor versions.
- **Presentation-only default for permission_denied:** The plugin does not render this state; consumers are expected to surface it with their own notification UI via `useAuth().error`.
