# Theming & Customization

`@turnkeystaffing/get-native-vue-auth` ships an opinionated but fully overridable presentation layer. You can customize the overlay at four escalating levels:

1. **[Theme via CSS custom properties](#theme-via-css-custom-properties)** — change colors, typography, sizing without touching JS.
2. **[Swap icons](#swap-icons)** — provide your own Vue icon components, or hide icons entirely.
3. **[Override copy](#override-copy)** — replace the built-in English strings per state.
4. **[Full view replacement](#full-view-replacement)** — drop in your own Vue components for any of the five recovery states.

You can mix levels freely — e.g., use the default view but with your brand colors and your own icons.

Two additional customization hooks are documented at the bottom:

- **[Error-code overrides](#error-code-overrides)** — re-route specific backend codes into different recovery categories, or silence them.
- **[Unmapped-error telemetry hook](#unmapped-error-telemetry-hook)** — catch backend codes the frontend doesn't know about yet.

---

## Theme via CSS custom properties

The default views scope these custom properties under `.bff-auth-overlay`. Set them at `:root` (or any ancestor) to theme the overlay without overriding any selectors:

| Variable | Default | Purpose |
|---|---|---|
| `--bff-auth-bg` | `#ffffff` (light) / `#0d1117` (dark) | Overlay background |
| `--bff-auth-fg` | `#1f2328` (light) / `#e6edf3` (dark) | Title and body text |
| `--bff-auth-muted` | `#57606a` (light) / `#8b949e` (dark) | Secondary text |
| `--bff-auth-accent` | `#2563eb` | Primary button + progress bar |
| `--bff-auth-accent-fg` | `#ffffff` | Primary button label |
| `--bff-auth-danger` | `#d1242f` | Service-unavailable icon tint |
| `--bff-auth-max-width` | `480px` | Content column width |
| `--bff-auth-z-index` | `2147483000` | Stacking layer (high, always-on-top) |
| `--bff-auth-font-family` | `inherit` | Font stack |

**Example — align with your brand:**

```css
:root {
  --bff-auth-accent: #7c3aed;        /* your primary */
  --bff-auth-accent-fg: #ffffff;
  --bff-auth-font-family: 'Inter', system-ui, sans-serif;
  --bff-auth-max-width: 520px;
}
```

The overlay respects `prefers-color-scheme: dark` automatically. To opt out of automatic dark-mode switching, pin the tokens explicitly under `:root`:

```css
:root {
  --bff-auth-bg: #ffffff;  /* pinned — ignores OS dark mode */
  --bff-auth-fg: #1f2328;
}
```

To theme dark mode separately, wrap overrides in `@media (prefers-color-scheme: dark) { :root { … } }`.

---

## Swap icons

Icons are Vue component refs — provide any component from your icon library, or pass `false` to hide an icon entirely.

```ts
import MySessionIcon from '@/icons/MySessionIcon.vue'

app.use(bffAuthPlugin, {
  bffBaseUrl: 'https://api.example.com',
  clientId: 'my-app',
  icons: {
    sessionExpired: MySessionIcon, // your own component
    retry: false                   // hide the retry icon entirely
  }
})
```

Unspecified slots keep their defaults — your override object shallow-merges over the bundled icon set. All eight slots with their defaults:

| Slot | Default (FluentUI System Icons v2 slug) | Used in |
|---|---|---|
| `sessionExpired` | `clock_24_regular` | Session-expired view title |
| `login` | `arrow_right_24_regular` | Sign-in button |
| `serviceUnavailable` | `cloud_off_24_regular` | Service-unavailable view title |
| `retry` | `arrow_clockwise_24_regular` | "Try now" button |
| `devError` | *(reuses `serviceUnavailable`)* | Dev-error view title |
| `accountBlocked` | *(reuses `serviceUnavailable`)* | Account-blocked view title |
| `serverError` | *(reuses `serviceUnavailable`)* | Server-error view title |
| `signOut` | *(reuses `login`)* | Sign-out CTA on terminal views |

Each slot accepts a Vue `Component` ref or `false`.

---

## Override copy

Replace the built-in English strings per state. Omitted fields fall back to the defaults — partial overrides are fine.

```ts
app.use(bffAuthPlugin, {
  bffBaseUrl: 'https://api.example.com',
  clientId: 'my-app',
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

All overridable fields per state:

| State | Fields |
|---|---|
| `sessionExpired` | `title`, `message`, `button` |
| `serviceUnavailable` | `title`, `message`, `button`, `retryingLabel`, `countdownLabel(seconds)` |
| `devError` | `title`, `message`, `contactLine`, `signOut` |
| `accountBlocked` | `title`, `message`, `insufficientPermissionsTitle`, `insufficientPermissionsMessage`, `signOut` |
| `serverError` | `title`, `message`, `dismissButton` |

`countdownLabel` is a function so you can format the seconds however your locale needs.

---

## Full view replacement

For total control over layout, animation, or branding, swap any default view for your own Vue component. Custom views receive a **stable prop contract** (public API from v2.0.0) — the plugin hands you the handler functions so your custom view still gets the circuit-breaker and `initAuth()` behavior for free.

```ts
import CustomSessionExpired from '@/auth/CustomSessionExpired.vue'
import CustomServiceUnavailable from '@/auth/CustomServiceUnavailable.vue'

app.use(bffAuthPlugin, {
  bffBaseUrl: '...',
  clientId: '...',
  errorViews: {
    sessionExpired: CustomSessionExpired,
    serviceUnavailable: CustomServiceUnavailable
  }
})
```

### Prop contracts

| View | Props |
|---|---|
| `sessionExpired` | `error: AuthError`, `onSignIn: () => void \| Promise<void>`, `config: BffAuthConfig` |
| `serviceUnavailable` | `error: AuthError`, `onRetry: () => void \| Promise<void>`, `config: BffAuthConfig` |
| `devError` | `error: AuthError`, `onSignOut: () => void \| Promise<void>`, `config: BffAuthConfig` |
| `accountBlocked` | `error: AuthError`, `onSignOut: () => void \| Promise<void>`, `config: BffAuthConfig` |
| `serverError` | `error: AuthError`, `config: BffAuthConfig` (emits `dismiss`) |

Call the handler exactly once per user action — `AuthErrorBoundary` listens and updates the store accordingly. For `serverError`, emit the `dismiss` event when the user closes the overlay; the boundary calls `authStore.clearError()` in response.

### Minimal custom view example

```vue
<!-- CustomSessionExpired.vue -->
<script setup lang="ts">
import type { SessionExpiredViewProps } from '@turnkeystaffing/get-native-vue-auth'

const props = defineProps<SessionExpiredViewProps>()
</script>

<template>
  <div class="my-overlay">
    <h1>{{ props.config.text.sessionExpired?.title ?? 'Your session has ended' }}</h1>
    <p>{{ props.error.message }}</p>
    <button @click="props.onSignIn()">Sign in again</button>
  </div>
</template>
```

Overrides are per-view — any view you don't override continues to use the default.

---

## Error-code overrides

Sometimes a backend code should route to a different recovery category than the canonical map gives you — or you want to silence a code entirely so it never surfaces in the overlay. The `errorCodeOverrides` option accepts a lowercase-keyed map that shallow-merges over the built-in `ERROR_CODE_TO_TYPE`:

```ts
app.use(bffAuthPlugin, {
  bffBaseUrl: '...',
  clientId: '...',
  errorCodeOverrides: {
    some_backend_code: 'service_unavailable', // re-route
    noisy_but_harmless: null                  // silence (treated as inline)
  }
})
```

Keys are lowercased before lookup, so match the canonical form. A value of `null` flags the code as inline/silent — the interceptor won't call `setError()` for it.

For the canonical code → category routing, see [`auth-error-codes.md`](./auth-error-codes.md).

---

## Unmapped-error telemetry hook

When the response interceptor receives a non-empty backend error code that is neither in the canonical map, nor in your `errorCodeOverrides`, nor in `KNOWN_INLINE_CODES`, it considers that code *unmapped*. Wire `onUnmappedError` to your telemetry sink to surface drift between backend and frontend:

```ts
app.use(bffAuthPlugin, {
  bffBaseUrl: '...',
  clientId: '...',
  onUnmappedError: (code, status, error) => {
    telemetry.track('auth.unmapped_error_code', { code, status })
  }
})
```

The hook fires only for unmapped **codes** — naked status errors (HTTP status with no `error_type` on the body) fall through to the status-based fallback (`401` → `session_expired`, `429` → `service_unavailable`) and do not fire this hook.

---

## See also

- **[Architecture](./architecture.md)** — how the presentation layer fits into the plugin's overall design.
- **[Component inventory](./component-inventory.md)** — per-view breakdown of default views, what props they render, and accessibility behavior.
- **[Auth error codes](./auth-error-codes.md)** — canonical backend error-code catalog and the recovery-category each one maps to.
