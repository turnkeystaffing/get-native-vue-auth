# Component Inventory: @turnkeystaffing/get-native-vue-auth

**Generated:** 2026-02-04
**Scan Level:** Quick

## Overview

The library includes 3 pre-built Vuetify UI components for authentication error handling. All components are Vue 3 Single File Components (SFCs) that react to the Pinia auth store's error state.

## Components

### SessionExpiredModal

- **File:** `src/components/SessionExpiredModal.vue`
- **Test:** `src/components/__tests__/SessionExpiredModal.spec.ts`
- **Category:** Error UI / Modal
- **Purpose:** Displays a persistent modal dialog when the user's session expires (401 error)
- **Trigger:** `authStore.error.type === 'session_expired'`
- **Behavior:** Persistent (cannot be dismissed without action), prompts user to sign in again
- **Dependencies:** Vuetify dialog components
- **Icons:** `sessionExpired` (default: `mdi-clock-alert-outline`), `login` (default: `mdi-login`)

### PermissionDeniedToast

- **File:** `src/components/PermissionDeniedToast.vue`
- **Test:** `src/components/__tests__/PermissionDeniedToast.spec.ts`
- **Category:** Error UI / Toast
- **Purpose:** Shows a non-blocking toast notification when the user lacks permission for an action (403 error)
- **Trigger:** `authStore.error.type === 'permission_denied'`
- **Behavior:** Auto-dismisses after 5 seconds
- **Dependencies:** Vuetify snackbar components
- **Icons:** `permissionDenied` (default: `mdi-shield-alert`)

### ServiceUnavailableOverlay

- **File:** `src/components/ServiceUnavailableOverlay.vue`
- **Test:** `src/components/__tests__/ServiceUnavailableOverlay.spec.ts`
- **Category:** Error UI / Overlay
- **Purpose:** Full-screen overlay with retry countdown when the auth service is unavailable (503 error)
- **Trigger:** `authStore.error.type === 'service_unavailable'`
- **Behavior:** Automatic retry countdown + manual "Try Now" button
- **Dependencies:** Vuetify overlay components
- **Icons:** `serviceUnavailable` (default: `mdi-cloud-off-outline`), `retry` (default: `mdi-refresh`)

## Icon Customization

All component icons are configurable via the plugin options. Each icon accepts a `string` (icon class name) or `false` (disables the icon entirely):

```typescript
app.use(bffAuthPlugin, {
  bffBaseUrl: '...',
  clientId: '...',
  icons: {
    sessionExpired: 'fa-solid fa-clock',    // Override with Font Awesome
    permissionDenied: false,                 // Disable icon
    // Others keep MDI defaults
  }
})
```

## Design Patterns

- **Reactive store binding:** Components watch `authStore.error` for their specific error type
- **Vuetify-based:** All components use Vuetify's component library for consistent Material Design UI
- **Zero-config:** Components work out of the box when placed in the app template
- **Configurable icons:** MDI defaults with full override/disable support via plugin options
