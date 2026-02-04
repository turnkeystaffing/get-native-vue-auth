# Project Documentation Index

**@turnkeystaffing/get-native-vue-auth** v1.3.3
**Generated:** 2026-02-04 | **Scan Level:** Quick | **Mode:** Initial Scan

## Project Overview

- **Type:** Monolith (single cohesive library)
- **Primary Language:** TypeScript
- **Architecture:** Plugin/Library (Vue 3 BFF authentication plugin)
- **Registry:** GitHub Packages (`@turnkeystaffing` scope)

## Quick Reference

- **Tech Stack:** Vue 3 + Pinia + Axios + Vue Router + Vuetify + jwt-decode
- **Entry Point:** `src/index.ts`
- **Architecture Pattern:** Vue Plugin with Composition API, Pinia Store, Service Layer
- **Build:** Vite 7 library mode → `dist/index.js` (ES module)
- **Test:** Vitest 4 + @vue/test-utils (jsdom)
- **Package Manager:** Yarn 4.12.0

## Generated Documentation

- [Project Overview](./project-overview.md) — Executive summary, purpose, tech stack
- [Architecture](./architecture.md) — Module architecture, data flows, type system, BFF API contract
- [Source Tree Analysis](./source-tree-analysis.md) — Annotated directory structure with file descriptions
- [Component Inventory](./component-inventory.md) — 3 Vuetify error UI components catalog
- [Development Guide](./development-guide.md) — Prerequisites, setup, build, test, publish

## Existing Documentation

- [README](../README.md) — Usage documentation, API reference, configuration options, exports list

## Getting Started

### For Consumers

```bash
# Configure GitHub Packages for @turnkeystaffing scope
# Then install:
yarn add @turnkeystaffing/get-native-vue-auth
```

See [README](../README.md) for full usage instructions.

### For Contributors

```bash
corepack enable
yarn install
yarn dev          # Watch mode build
yarn test:watch   # Test in watch mode
```

See [Development Guide](./development-guide.md) for full setup instructions.
