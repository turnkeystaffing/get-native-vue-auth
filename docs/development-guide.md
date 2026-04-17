# Development Guide: @turnkeystaffing/get-native-vue-auth

**Version:** 2.0.0
**Generated:** 2026-04-18

## Prerequisites

- **Node.js** — any version that supports the installed Vite / Vitest majors (Node 18+ recommended).
- **Yarn Berry** 4.12.0 (pinned via `packageManager` field in `package.json`). Corepack will activate it automatically if enabled.
- **GitHub Packages access** for the `@turnkeystaffing` scope — a classic PAT with `read:packages` is required to install the logger peer dep. See the **Registry auth** section below.

This project uses **Yarn exclusively**. Do not run `npm install` or touch `package-lock.json`.

## Registry auth

The package itself publishes to GitHub Packages, and the logger peer dep pulls from there too. The repo ships `.yarnrc.yml` with:

```yaml
nodeLinker: node-modules
npmScopes:
  turnkeystaffing:
    npmRegistryServer: "https://npm.pkg.github.com"
```

Add your auth token to `~/.yarnrc.yml`:

```yaml
npmScopes:
  turnkeystaffing:
    npmAuthToken: "your_github_pat_with_read_packages"
```

## Install

```bash
yarn install
```

## Scripts

| Command | What it does |
|---|---|
| `yarn build` | `vite build` — library build to `dist/` (ESM + rolled-up dts + CSS). |
| `yarn dev` | `vite build --watch` — rebuilds `dist/` on source changes. Useful with `yarn link` in consumer projects. |
| `yarn demo` | `vite --config vite.config.demo.ts` — starts the dev-only demo app at `demo/`. The logger peer is stubbed via `demo/logger-stub.ts` so you don't need the real package for local visual testing. |
| `yarn typecheck` | `tsc --noEmit` — strict TS type check across `src/`. |
| `yarn test` | `vitest run` — runs all spec files once. |
| `yarn test:watch` | `vitest` — interactive watch mode. |
| `yarn lint` | `eslint .` — flat config (tseslint + eslint-plugin-vue recommended). |
| `yarn lint:fix` | `eslint . --fix`. |

## Project layout quick reference

See [source-tree-analysis.md](./source-tree-analysis.md) for the annotated tree. Key files when you're orienting:

- `src/index.ts` — public API barrel. Anything NOT re-exported here is internal.
- `src/plugin.ts` — plugin install entry point.
- `src/services/errorCodeMap.ts` — canonical error code → `AuthErrorType` routing table.
- `src/components/AuthErrorBoundary.vue` — overlay controller.
- `src/components/views/*.vue` — the five bundled recovery views.
- `docs/error-handling-analysis.md` — recovery category reasoning.

## Demo app workflow

`yarn demo` boots a local Vue app at `demo/` that mounts `<AuthErrorBoundary/>` and a `DemoControlPanel` for triggering every error type and view combination without wiring up a real BFF. Useful for:

- Visual regression checks after touching `overlay.css` or any view's template.
- Verifying focus trap / scroll lock behavior in a real browser (jsdom only approximates these).
- Theming experiments — all `--bff-auth-*` tokens can be set on `:root` in `demo/` to preview.

The demo's Vite config aliases `@turnkeystaffing/get-native-vue-logger` to a local stub (`demo/logger-stub.ts`) so demo-only work doesn't require the real logger package to be installed.

## Testing

- **Runner:** Vitest 4.
- **DOM:** jsdom 26.
- **Setup:** `src/test-setup.ts` bootstraps a fresh Pinia instance before each suite.
- **Config merge:** `vitest.config.ts` imports `vite.config.ts`, so aliases (`@ → src`) and the Vue plugin work in specs.

Spec locations:
- `src/services/__tests__/{auth,interceptors,errorCodeMap}.spec.ts`
- `src/stores/__tests__/auth.spec.ts`
- `src/components/__tests__/AuthErrorBoundary.spec.ts`
- `src/components/views/__tests__/*.spec.ts` (one per view)

Recommended patterns:
- Use the factory signatures (`createAuthGuard(deps)`, `setupAuthInterceptors(instance, getStore)`) to inject test doubles — avoid monkey-patching module exports.
- Reset `refreshPromise` at module scope between tests that exercise concurrent refresh (see `stores/__tests__/auth.spec.ts` for the pattern).
- Use `@vue/test-utils` `mount` (not `shallowMount`) for `AuthErrorBoundary` tests — the Teleport + focus logic needs a real DOM root.

## Linting & types

- ESLint 9 flat config (`eslint.config.mjs`) — tseslint recommended + `eslint-plugin-vue/flat/recommended`.
- Multi-word component names are disabled (`vue/multi-word-component-names: off`).
- `@typescript-eslint/no-explicit-any`: `warn` in source, `off` in tests.
- `@typescript-eslint/no-unused-vars`: `error` with `argsIgnorePattern: ^_`.
- `tsconfig.json`: strict, ES2020, `moduleResolution: bundler`, `rootDir: src`, `outDir: dist`, `paths: { @/*: ./src/* }`.

## Build output & peer externalization

`vite.config.ts`:
- Entry: `src/index.ts`.
- Format: ESM only (`formats: ['es']`), output `dist/index.js`.
- Global name: `GetNativeVueAuth`.
- **Externals:** `vue`, `pinia`, `axios`, `vue-router`, `jwt-decode`, `@turnkeystaffing/get-native-vue-logger`. The bundle never ships these — consumers provide them.
- `vite-plugin-dts` with `rollupTypes: true` collapses all types into a single `dist/index.d.ts`.

The `"files"` field in `package.json` limits what `yarn npm publish` actually uploads — only `dist/`.

## CI / release

No in-repo CI exists (`.github/workflows/` absent). Release automation (tagging, publishing to GitHub Packages) lives outside this repository. When cutting a release locally:

1. Bump `version` in `package.json`.
2. Update `README.md` migration notes if this is a minor/major change.
3. `yarn build && yarn test && yarn typecheck && yarn lint` — everything green.
4. Commit, tag `vX.Y.Z`, push.
5. Publish: `yarn npm publish` (requires a GitHub PAT with `write:packages` for the `@turnkeystaffing` scope in your `~/.yarnrc.yml`).

## Common development tasks

### Adding a new backend error code
1. Add the lowercase code to `ERROR_CODE_TO_TYPE` in `src/services/errorCodeMap.ts` (or `KNOWN_INLINE_CODES` if the caller handles it inline).
2. Add a spec in `src/services/__tests__/errorCodeMap.spec.ts` covering the new code.
3. Update the canonical-codes table in [api-contracts.md](./api-contracts.md) and [error-handling-analysis.md](./error-handling-analysis.md).

### Adding / modifying a recovery view
1. Ensure the props interface (`SessionExpiredViewProps` / etc.) in `src/types/config.ts` still matches — it is a **public API**.
2. Expose a focus target via `defineExpose({ primaryAction: <HTMLElementRef> })`.
3. Add `data-testid` attributes that match the existing convention (`<view-name>-<purpose>`).
4. Update the corresponding spec under `src/components/views/__tests__/`.
5. If adding a new category: extend `AuthErrorType`, `ERROR_CODE_TO_TYPE`, `AuthErrorViews`, `AuthIcons`, and `AuthText` in lockstep; add a branch in `AuthErrorBoundary.vue` (`activeView` + `viewProps`); include the new view file in `src/components/views/` and update `component-inventory.md`.

### Theming / CSS changes
`src/components/views/overlay.css` is the shared stylesheet. Prefer extending via CSS custom properties (`--bff-auth-*`) over adding new selectors; document any new token in [README.md](../README.md).

### Breaking changes
Every change to the symbols listed in `src/index.ts` is potentially breaking. If a change requires consumer migration, document it in the `README.md` under the next-version migration section BEFORE merging.

## Related documentation

- [Project Overview](./project-overview.md)
- [Architecture](./architecture.md)
- [Source Tree Analysis](./source-tree-analysis.md)
- [Component Inventory](./component-inventory.md)
- [State Management](./state-management.md)
- [API Contracts](./api-contracts.md)
- [Error Handling Analysis](./error-handling-analysis.md)
- [Auth Error Codes](./auth-error-codes.md)
- [README](../README.md)
