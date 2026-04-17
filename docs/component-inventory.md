# Component Inventory: @turnkeystaffing/get-native-vue-auth

**Version:** 2.0.0
**Generated:** 2026-04-18

All components live in `src/components/`. The only publicly exported component is `AuthErrorBoundary`. Views are used internally by the boundary and are NOT exported from `src/index.ts`, but their props types are (`SessionExpiredViewProps`, `ServiceUnavailableViewProps`, `DevErrorViewProps`, `AccountBlockedViewProps`, `ServerErrorViewProps`) so consumers can write type-safe replacements.

---

## Public

### `AuthErrorBoundary` — `src/components/AuthErrorBoundary.vue`

**Role:** Top-level overlay controller. Watches `useAuth().error` and renders the appropriate view (or the consumer-provided override) based on `error.type`.

**How to mount:** The plugin registers it globally as `<AuthErrorBoundary/>`. Place it once in your root layout — it renders nothing when `error === null`.

**Responsibilities:**
- View selection via `error.type → config.errorViews.<type> ?? bundled view`.
- Props assembly — each view receives only the props its contract defines.
- **Accessibility:**
  - `<Teleport to="body">` — escapes the app shell.
  - Focus trap — Tab/Shift+Tab cycle within the overlay root.
  - Scroll lock — `document.body.style.overflow = 'hidden'`.
  - Previously-focused element captured on open, restored on close.
  - `primaryAction` focused on mount AND when `error.type` changes (so auto-retry escalations move focus correctly).
- **Sign-in flow** — applies `recordLoginAttempt()` itself before calling `authStore.login(window.location.href)`; on trip, flips to `service_unavailable` so the overlay stays in place instead of looping the redirect.
- **Sign-out flow** — calls `authStore.logout()`; clears error as a safety net for test environments where the redirect doesn't execute.
- **Retry flow** — calls `authStore.initAuth()`; clears error on successful re-auth; escalates to `session_expired` when the backend responds OK but identity is still missing.
- **Dismiss flow** — `ServerErrorView` emits `dismiss` → `authStore.clearError()`.

---

## Bundled Views

Each view consumes its typed props interface, exposes a `primaryAction` ref via `defineExpose`, and pulls copy from `config.text.<category>?.*` with English defaults. All share `overlay.css`.

### `SessionExpiredView.vue`
- **Props:** `SessionExpiredViewProps` — `{ error, onSignIn, config }`.
- **Root:** `role="alertdialog"`, `aria-modal="true"`, `aria-live="assertive"`.
- **Default copy:** title `"Session expired"`, message `"Your session has ended. Sign in again to continue."`, CTA `"Sign in"`. Message falls back to `error.message` if a custom message wasn't injected via `config.text`.
- **Icon slots:** `config.icons.sessionExpired` (title), `config.icons.login` (inside button).
- **Behavior:** Primary button calls `onSignIn`; `isLoading` disables it while the promise is pending. `aria-busy` mirrors `isLoading`.

### `ServiceUnavailableView.vue`
- **Props:** `ServiceUnavailableViewProps` — `{ error, onRetry, config }`.
- **Default copy:** title `"Service unavailable"`, message `"We're having trouble connecting to authentication services."`, CTA `"Try now"`, retrying label `"Retrying..."`, countdown `"Retry in {n}s"` (overridable via `config.text.serviceUnavailable.countdownLabel(seconds)`).
- **Icon slots:** `config.icons.serviceUnavailable` (pulsing danger styling), `config.icons.retry` (spinning icon while retrying).
- **Behavior:**
  - 30-second countdown (`COUNTDOWN_SECONDS`). Hit zero → auto-retry.
  - `progressbar` role with `aria-valuenow/min/max`.
  - If retry resolves and the view is still mounted (parent kept `service_unavailable`), restart countdown — avoids stuck `"Retry in 0s"`.
  - `dark-mode` media query adjusts muted/danger tokens.
  - `bff-icon-pulse` keyframes animate icon opacity; `bff-spin` rotates the retry icon while retrying.

### `DevErrorView.vue`
- **Props:** `DevErrorViewProps` — `{ error, onSignOut, config }`.
- **Default copy:** title `"Configuration error"`, message `"The application is not correctly configured to connect to authentication services."`, contact line `"Contact the application developer."`, CTA `"Sign out"`.
- **Icon slots:** `config.icons.devError` (danger styling), `config.icons.signOut`.
- **Distinctive:** Renders `error.code` in a monospace pill labeled `"Error code:"` — this is the one category where the raw code is shown, because the audience is a developer.

### `AccountBlockedView.vue`
- **Props:** `AccountBlockedViewProps` — `{ error, onSignOut, config }`.
- **Default copy (branched on `error.code`):**
  - `insufficient_permissions` → title `"Access required"`, message `"You don't have access to this feature. Please request access from your administrator."`
  - otherwise (e.g., `account_inactive`) → title `"Account unavailable"`, message `"Your account has been disabled. Please contact your administrator for assistance."`
- **Icon slots:** `config.icons.accountBlocked` (danger), `config.icons.signOut`.
- **CTA:** Sign out — the only recovery, since the identity is invalid at the backend level.

### `ServerErrorView.vue`
- **Props:** `ServerErrorViewProps` — `{ error, config }`.
- **Emits:** `dismiss` (no payload).
- **Default copy:** title `"Something went wrong"`, message `"An unexpected error occurred. Please contact your administrator for assistance."`, CTA `"Dismiss"`.
- **Icon slot:** `config.icons.serverError` (danger).
- **Distinctive:** No action callback — dismiss-only. `AuthErrorBoundary` wires the `dismiss` event to `authStore.clearError()`.

---

## Icons — `src/components/icons/*`

Bundled FluentUI SVG components (Vue SFCs). Each is a component ref that consumers can swap via `config.icons.*`.

| Icon | File | Used by (default) |
|---|---|---|
| `IconSessionExpired` | `IconSessionExpired.vue` | `sessionExpired` |
| `IconLogin` | `IconLogin.vue` | `login` (session-expired button) AND `signOut` (directional door reads both ways) |
| `IconServiceUnavailable` | `IconServiceUnavailable.vue` | `serviceUnavailable`, `devError`, `accountBlocked`, `serverError` — reused as "something's not right" |
| `IconRetry` | `IconRetry.vue` | `retry` |

`DEFAULT_ICONS` (exported from `src/plugin.ts`) wires these defaults. Consumers may:
- Pass `config.icons.<slot>` to override with any component.
- Pass `config.icons.<slot> = false` to disable rendering entirely.

---

## Theming Surface

All styling is scoped to `src/components/views/overlay.css` and uses CSS custom properties prefixed `--bff-auth-*`. Consumers override by setting these variables on any ancestor (usually `:root`). The full list is documented in [README.md](../README.md) under **Theming**.

Key tokens (from the stylesheet):
- `--bff-auth-danger` / dark-mode override
- `--bff-auth-accent` (progress bar fill)
- `--bff-auth-muted`
- `--bff-auth-progress-bg`
- `--bff-auth-icon-danger-bg`
- `--bff-auth-code-bg`

`prefers-color-scheme: dark` adjusts muted/danger tokens automatically without consumer config.

---

## Escape Hatch: Full View Replacement

Consumers can replace any bundled view wholesale via `config.errorViews.<category>`:

```typescript
import type { SessionExpiredViewProps } from '@turnkeystaffing/get-native-vue-auth'
import MyCustomSessionExpiredView from './MyCustomSessionExpiredView.vue'

app.use(bffAuthPlugin, {
  bffBaseUrl: '...',
  clientId: '...',
  errorViews: {
    sessionExpired: MyCustomSessionExpiredView
  }
})
```

The custom component must accept the corresponding `*ViewProps` interface. For `ServerErrorView` replacements, emit `dismiss` to close the overlay (the boundary handles the rest).

To expose a primary action for the boundary's focus management:

```vue
<script setup lang="ts">
import { ref } from 'vue'
const myButton = ref<HTMLButtonElement | null>(null)
defineExpose({ primaryAction: myButton })
</script>
```

If `primaryAction` isn't exposed, the boundary falls back to focusing the first focusable element in the overlay.
