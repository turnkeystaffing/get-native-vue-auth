---
title: 'Add interactive demo app for visual component testing'
type: 'chore'
created: '2026-04-17'
status: 'done'
baseline_commit: '27bf23b73187b43233a6df09a3bab60d3908db25'
context:
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The plugin's error overlay components (`AuthErrorBoundary`, `SessionExpiredView`, `ServiceUnavailableView`) can only be verified by writing a separate consumer app or reading tests — there's no way to visually see and interact with them during development.

**Approach:** Add a `demo/` directory with a standalone Vite dev app that imports the plugin from source, provides a control panel to trigger error states (`session_expired`, `service_unavailable`) on the auth store, and lets the developer see the overlays render in real time. A `yarn demo` script starts the dev server. The demo is excluded from the library build and npm package.

## Boundaries & Constraints

**Always:**
- Demo lives in `demo/` with its own `index.html`, `main.ts`, `App.vue`, and a dedicated `vite.config.demo.ts` at project root.
- Demo imports from `../src/index.ts` (source), not from `dist/` — no build step needed to iterate.
- Demo is excluded from `package.json` `files` array and from the library build. Add `demo/` to `.gitignore` only if the user wants it excluded from version control (default: include it).
- Mock `@turnkeystaffing/get-native-vue-logger` with a console-based stub so the demo runs without installing the private peer dep.
- No new dependencies — use only what's already in devDependencies (vue, pinia, vue-router, vite).
- Use `yarn`, never `npm`.

**Ask First:**
- If the demo needs any dependency not already in devDependencies, HALT.

**Never:**
- Do not modify the library source (`src/`) for demo purposes.
- Do not add demo-specific code paths to the plugin.
- Do not add production dependencies.

</frozen-after-approval>

## Code Map

- `demo/index.html` -- HTML entry point with `<div id="app">` and script tag pointing to `main.ts`
- `demo/main.ts` -- Creates Vue app, installs Pinia + vue-router + bffAuthPlugin with mock config, mounts app
- `demo/App.vue` -- Layout with `<AuthErrorBoundary />` and `<DemoControlPanel />`, router-view for future pages
- `demo/components/DemoControlPanel.vue` -- Buttons to trigger `session_expired`, `service_unavailable`, clear error; `retryAfter` input; CSS variable controls for theming
- `demo/logger-stub.ts` -- Minimal `createLogger` stub that logs to console, satisfying the peer dep
- `demo/router.ts` -- Simple vue-router with a home route (needed since plugin uses vue-router as peer)
- `vite.config.demo.ts` -- Vite config: root=`demo/`, resolves `@turnkeystaffing/get-native-vue-logger` to the stub, aliases `@/` to `src/`
- `package.json` -- Add `"demo": "vite --config vite.config.demo.ts"` script

## Tasks & Acceptance

**Execution:**
- [x] `demo/logger-stub.ts` -- create console-based logger stub matching the `createLogger` API -- satisfies peer dep without private package
- [x] `demo/router.ts` -- create minimal router with home route -- satisfies vue-router peer dep
- [x] `demo/main.ts` + `demo/index.html` -- create Vue app entry that installs Pinia, router, and bffAuthPlugin -- demo app bootstrap
- [x] `demo/components/DemoControlPanel.vue` -- build control panel: error-trigger buttons, retryAfter slider, CSS variable inputs for theming, dark mode toggle -- interactive testing surface
- [x] `demo/App.vue` -- layout with AuthErrorBoundary + DemoControlPanel side-by-side -- top-level demo shell
- [x] `vite.config.demo.ts` -- Vite dev config: aliases logger stub, resolves `@/` to src, sets root to demo -- separate from library build
- [x] `package.json` -- add `"demo"` script -- `yarn demo` starts the dev server

**Acceptance Criteria:**
- Given `yarn demo` is run, when the dev server starts, then the browser shows the control panel with trigger buttons.
- Given the demo is running, when "Session Expired" button is clicked, then the `SessionExpiredView` full-page overlay appears via Teleport.
- Given the demo is running, when "Service Unavailable" button is clicked with retryAfter=30, then the `ServiceUnavailableView` overlay appears with a 30-second countdown.
- Given an overlay is visible, when "Clear Error" is clicked, then the overlay disappears and the control panel is visible again.
- Given `yarn build` is run, then the demo directory is not included in the library output.

## Design Notes

**Logger stub shape** (must match `@turnkeystaffing/get-native-vue-logger` API):
```ts
export function createLogger(name: string) {
  return {
    debug: (...args: unknown[]) => console.debug(`[${name}]`, ...args),
    info: (...args: unknown[]) => console.info(`[${name}]`, ...args),
    warn: (...args: unknown[]) => console.warn(`[${name}]`, ...args),
    error: (...args: unknown[]) => console.error(`[${name}]`, ...args),
  }
}
```

**Control panel** triggers errors by directly calling `useAuthStore().setError({ type, retryAfter })` — same mechanism the interceptors use, no mock HTTP needed.

**Theming controls** set CSS custom properties on `document.documentElement` so they cascade into the Teleported overlay (which renders on `<body>`).

## Verification

**Commands:**
- `yarn demo` -- expected: Vite dev server starts, page loads in browser
- `yarn build` -- expected: succeeds, `dist/` contains no demo files
- `yarn typecheck` -- expected: exits 0 (demo files excluded from library tsconfig)

## Suggested Review Order

**App bootstrap & config**

- Demo entry point: Pinia + router + bffAuthPlugin wired with mock config.
  [`main.ts:1`](../../demo/main.ts#L1)

- Separate Vite config: logger alias, demo root, no interference with library build.
  [`vite.config.demo.ts:1`](../../vite.config.demo.ts#L1)

- Console-based logger stub satisfying the private peer dep contract.
  [`logger-stub.ts:1`](../../demo/logger-stub.ts#L1)

**Interactive control panel**

- Error-trigger buttons, retryAfter slider, live store state display, CSS variable theming controls.
  [`DemoControlPanel.vue:1`](../../demo/components/DemoControlPanel.vue#L1)

**Shell & wiring**

- App shell mounting AuthErrorBoundary (global) alongside the control panel.
  [`App.vue:1`](../../demo/App.vue#L1)

- Minimal router with public home route to satisfy vue-router peer dep.
  [`router.ts:1`](../../demo/router.ts#L1)

**Build integration**

- Added `"demo"` script — single touchpoint in library package.json.
  [`package.json:26`](../../package.json#L26)
