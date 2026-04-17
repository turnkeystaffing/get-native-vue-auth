# Migration Guide

## 1.x → 2.0.0

**Headline:** Vuetify is no longer a peer dependency. The three v1.x error components — `SessionExpiredModal`, `PermissionDeniedToast`, `ServiceUnavailableOverlay` — have been replaced with a single `AuthErrorBoundary` component that ships with bundled FluentUI SVG icons, CSS-custom-property theming, and consumer-overridable views.

The wire-up changes are small. A typical app needs four edits.

---

### 1. Remove Vuetify (if it was only installed for this plugin)

```bash
yarn remove vuetify
```

If your app uses Vuetify for other features, keep it — the plugin no longer requires or touches it.

### 2. Replace the three error components with one

**Before (1.x)**

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

**After (2.x)**

```vue
<template>
  <router-view />
  <AuthErrorBoundary />
</template>
```

No import is needed — the plugin registers `AuthErrorBoundary` globally during `app.use()`. If you prefer an explicit import, it's also re-exported from the package.

### 3. Update the `icons` option (if you customized it)

Icons are now **Vue component refs** instead of MDI class strings. The `permissionDenied` field is removed.

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

If you never set `icons`, no change is needed — the plugin ships sensible FluentUI SVG defaults.

### 4. Replace any `permission_denied` handlers

The `permission_denied` recovery category has been removed. What used to fall under it is now routed to two more-specific categories that `AuthErrorBoundary` renders for you:

| v1.x | v2.x |
|---|---|
| `permission_denied` (blocked account, insufficient permissions) | `account_blocked` — rendered as a sign-out CTA. |
| `permission_denied` (OAuth misconfig, invalid client) | `dev_error` — rendered with the error code and a sign-out CTA. |

**If you had custom handling for `permission_denied`** — e.g., a `watch()` that showed a toast — delete it. `AuthErrorBoundary` now covers both cases with built-in views, and TypeScript will reject the old string literal because it is no longer a member of `AuthErrorType`.

```diff
-watch(error, (e) => {
-  if (e?.type === 'permission_denied') {
-    myToast.show(e.message)
-    clearError()
-  }
-})
```

**If you want custom UI for these cases** instead of the default views, use the `errorViews` option:

```ts
import CustomAccountBlocked from '@/auth/CustomAccountBlocked.vue'

app.use(bffAuthPlugin, {
  bffBaseUrl: '...',
  clientId: '...',
  errorViews: {
    accountBlocked: CustomAccountBlocked
  }
})
```

See [`docs/theming.md#full-view-replacement`](./docs/theming.md#full-view-replacement) for the prop contract.

---

### What else changed

- The recovery-category model expanded from three categories to **five**: `session_expired`, `service_unavailable`, `dev_error`, `account_blocked`, `server_error`. See [`docs/auth-error-codes.md`](./docs/auth-error-codes.md) for the full catalog.
- The `errorViews` plugin option lets you replace any of the five default views with your own Vue components; the prop contract is a stable public API from 2.0.0. See [`docs/theming.md`](./docs/theming.md#full-view-replacement).
- Presentation is now theme-able via CSS custom properties under the `.bff-auth-overlay` scope — no more framework styles leaking in.

### Questions not covered here

If you hit something that this guide doesn't answer, please file an issue on the repository with the error you're seeing and the v1.x code you're migrating from.
