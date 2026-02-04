# Development Guide: @turnkeystaffing/get-native-vue-auth

**Generated:** 2026-02-04

## Prerequisites

- **Node.js** — No version pinned (.nvmrc / .node-version not present); use a version compatible with Vite 7 (Node 18+)
- **Corepack** — Required for Yarn 4.12.0 (`corepack enable`)
- **GitHub Packages access** — A GitHub token with `read:packages` scope for the `@turnkeystaffing` npm scope

## Environment Setup

### 1. Configure GitHub Packages Registry

Create or update `~/.yarnrc.yml` with your GitHub token:

```yaml
npmScopes:
  turnkeystaffing:
    npmAuthToken: "your_github_personal_access_token"
```

The project-level `.yarnrc.yml` already configures the registry:

```yaml
nodeLinker: node-modules
npmScopes:
  turnkeystaffing:
    npmRegistryServer: "https://npm.pkg.github.com"
```

### 2. Install Dependencies

```bash
corepack enable
yarn install
```

### 3. No .env Required

No environment files are needed for development or testing. The library is configured at runtime by consuming applications via plugin options.

## Development Commands

| Command | Script | Description |
|---------|--------|-------------|
| `yarn build` | `vite build` | Build library to `dist/` (ES module + declarations) |
| `yarn dev` | `vite build --watch` | Watch mode — rebuilds on file changes |
| `yarn typecheck` | `tsc --noEmit` | Run TypeScript type checking without emitting |
| `yarn test` | `vitest run` | Run all tests once |
| `yarn test:watch` | `vitest` | Run tests in watch mode |

## Build Process

The library is built using Vite 7 in library mode:

- **Entry:** `src/index.ts`
- **Output:** `dist/index.js` (ES module, ~27KB) + `dist/index.d.ts` (rolled-up declarations, ~21KB)
- **Format:** ES module only
- **Externals:** All peer dependencies are excluded from the bundle:
  - `vue`, `pinia`, `axios`, `vue-router`, `jwt-decode`, `vuetify`, `vuetify/components`, `vuetify/directives`, `@turnkeystaffing/get-native-vue-logger`
- **Declaration Generation:** `vite-plugin-dts` with `rollupTypes: true` for a single `.d.ts` file

## Testing

### Configuration

- **Framework:** Vitest 4
- **Environment:** jsdom
- **Setup file:** `src/test-setup.ts`
- **Vuetify:** Inlined in test dependencies for component rendering
- **CSS:** Enabled in test environment

### Test File Convention

Tests are co-located with source code in `__tests__/` subdirectories:

```
src/
├── services/
│   ├── auth.ts
│   ├── interceptors.ts
│   └── __tests__/
│       ├── auth.spec.ts
│       └── interceptors.spec.ts
├── stores/
│   ├── auth.ts
│   └── __tests__/
│       └── auth.spec.ts
...
```

### Test Coverage

| Module | Test File | Coverage Area |
|--------|-----------|---------------|
| `services/auth.ts` | `services/__tests__/auth.spec.ts` | AuthService BFF calls |
| `services/interceptors.ts` | `services/__tests__/interceptors.spec.ts` | Axios interceptor behavior |
| `stores/auth.ts` | `stores/__tests__/auth.spec.ts` | Pinia store state & actions |
| `composables/useAuth.ts` | `composables/__tests__/useAuth.spec.ts` | Composable reactivity |
| `utils/jwt.ts` | `utils/__tests__/jwt.spec.ts` | JWT decode utilities |
| `router/guards.ts` | `router/__tests__/guards.spec.ts` | Route guard logic |
| `components/SessionExpiredModal.vue` | `components/__tests__/SessionExpiredModal.spec.ts` | Modal rendering & interactions |
| `components/PermissionDeniedToast.vue` | `components/__tests__/PermissionDeniedToast.spec.ts` | Toast rendering & auto-dismiss |
| `components/ServiceUnavailableOverlay.vue` | `components/__tests__/ServiceUnavailableOverlay.spec.ts` | Overlay rendering & retry |

## Publishing

The package is published to GitHub Packages under the `@turnkeystaffing` scope:

```bash
yarn build
npm publish  # or yarn npm publish
```

**Package registry:** `https://npm.pkg.github.com`
**Package name:** `@turnkeystaffing/get-native-vue-auth`

No CI/CD pipeline is currently configured for automated publishing.

## Common Development Tasks

### Adding a new export

1. Create the new module in the appropriate `src/` subdirectory
2. Add exports to `src/index.ts`
3. Add corresponding tests in `__tests__/` subdirectory
4. Run `yarn typecheck && yarn test` to verify
5. Run `yarn build` to confirm the export appears in `dist/index.d.ts`

### Updating peer dependencies

1. Update version ranges in `peerDependencies` and `devDependencies` in `package.json`
2. If the dependency is used at build time, also update the `external` array in `vite.config.ts`
3. Run `yarn install` to update lockfile
4. Run full test suite to verify compatibility
