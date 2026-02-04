# Project Overview: @turnkeystaffing/get-native-vue-auth

**Generated:** 2026-02-04
**Version:** 1.3.3
**License:** Proprietary - Turnkey Staffing

## Purpose

Vue 3 authentication plugin for BFF (Backend-for-Frontend) authentication flows. Provides a complete client-side authentication solution for Vue applications that communicate with a BFF server handling OAuth flows, session management, and token issuance.

## Executive Summary

This library encapsulates all authentication concerns for Vue 3 applications in the Turnkey Staffing ecosystem. It implements the BFF pattern where a server-side component manages OAuth tokens and sessions, while this client-side plugin handles:

- **Session lifecycle** — init, check, login, logout
- **Token management** — acquisition, refresh, injection into API calls
- **Route protection** — Vue Router guards blocking unauthenticated access
- **Error handling** — typed error states with pre-built Vuetify UI components
- **JWT utilities** — decode tokens, extract user claims

The library supports two authentication flows:
1. **Product SPA flow** — redirect-based login via BFF
2. **Central Login flow** — credential submission + OAuth completion for the login application itself

## Tech Stack Summary

| Category | Technology |
|----------|-----------|
| Language | TypeScript (strict, ES2020) |
| Framework | Vue 3 (Composition API) |
| State | Pinia ^3.0.4 |
| HTTP | Axios ^1.6.0 |
| Router | Vue Router ^4.0.0 |
| UI | Vuetify ^3.0.0 |
| Build | Vite 7 (library mode, ES module) |
| Test | Vitest 4, @vue/test-utils, jsdom |
| Package Mgr | Yarn 4.12.0 |

## Architecture Type

**Plugin/Library** — distributed as a single ES module via GitHub Packages (`@turnkeystaffing` scope). All runtime dependencies are peer dependencies.

## Repository Structure

**Type:** Monolith (single cohesive codebase)

```
src/
├── index.ts          # Barrel exports
├── plugin.ts         # Vue plugin installer
├── config.ts         # Config injection
├── composables/      # useAuth composable
├── stores/           # Pinia auth store
├── services/         # AuthService + Axios interceptors
├── router/           # Auth guards
├── components/       # 3 Vuetify error UI components
├── types/            # TypeScript interfaces
└── utils/            # JWT utilities
```

## Key Documentation

- [Architecture](./architecture.md) — Module architecture, data flows, type system, BFF API contract
- [Source Tree Analysis](./source-tree-analysis.md) — Annotated directory structure
- [Development Guide](./development-guide.md) — Setup, build, test commands
- [Component Inventory](./component-inventory.md) — UI component catalog
- [README](../README.md) — Usage documentation and API reference
