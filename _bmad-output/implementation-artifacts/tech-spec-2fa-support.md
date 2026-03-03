---
title: '2FA Support for get-native-vue-auth'
slug: '2fa-support'
created: '2026-02-04'
status: 'completed'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['vue3', 'typescript5', 'axios', 'pinia', 'vitest', 'vite7']
files_to_modify: ['src/types/auth.ts', 'src/types/index.ts', 'src/services/auth.ts', 'src/index.ts', 'src/services/__tests__/auth.spec.ts']
code_patterns: ['try-catch-rethrow', 'getBffBaseUrl()', 'withCredentials:true', 'logger.info/error', 'singleton-export']
test_patterns: ['vi.mock-axios', 'mockedAxios.post.mockResolvedValueOnce', 'mockedAxios.post.mockRejectedValueOnce', 'setGlobalConfig-in-beforeEach', '@/-path-alias']
---

# Tech-Spec: 2FA Support for get-native-vue-auth

**Created:** 2026-02-04

## Overview

### Problem Statement

The auth plugin has no two-factor authentication support. There is no way to pass TOTP codes during login, and no endpoints exist for 2FA setup, verification, or resend flows. Consuming apps that need 2FA are blocked.

### Solution

Extend `submitCredentials` with an optional `authCode` parameter and add three new service methods (`setup2FA`, `verify2FASetup`, `resend2FASetupEmail`). Add typed 2FA error codes and response types, and export everything from the package.

### Scope

**In Scope:**
- Modify `submitCredentials(email, password, authCode?)` to include `authCode` in payload when provided
- New method `setup2FA(token)` - POST to `/api/v1/auth/2fa/setup`
- New method `verify2FASetup(token, totpCode)` - POST to `/api/v1/auth/2fa/verify-setup`
- New method `resend2FASetupEmail(email)` - POST to `/api/v1/auth/2fa/resend-setup-email`
- Add known 2FA error codes as union type (`2fa_setup_required`, `2fa_code_required`, `token_expired`, `token_invalid`, `token_used`)
- Add response types in snake_case (no camelCase mapping)
- Export all new types from package
- Tests for all new/modified methods

**Out of Scope:**
- Composable (`useAuth`) or Pinia store integration - consuming app calls service directly
- UI components for 2FA flows
- Backend implementation
- Frontend rate limiting logic (backend enforced, frontend disables button during request)

## Context for Development

### Codebase Patterns

- **HTTP calls**: Raw axios with `getBffBaseUrl()` + `{ withCredentials: true }` on every call
- **Method pattern**: try → axios call → `logger.info('...')` on success → catch → `logger.error('...', error)` → `throw error`
- **Types**: Backend types use snake_case (`BackendAuthError`, `BackendTokenResponse`). New 2FA types stay snake_case per user preference.
- **Error responses**: `BackendAuthError` interface with `detail`, `error_type`, `required_scope?`, `retry_after?`
- **Singleton**: `export const authService = new AuthService()` + `export { AuthService }` for testing
- **Imports**: Use `@/` path alias (e.g., `@/types/auth`, `@/services/auth`, `@/config`)
- **Payload construction**: `submitCredentials` passes `{ email, password }` directly — when `authCode` is present, conditionally add it

### Files to Modify

| File | Purpose | Anchor Point |
| ---- | ------- | ------------ |
| `src/types/auth.ts` | Add 2FA types and error codes | After `BackendAuthError` (L62-67) |
| `src/types/index.ts` | Export new 2FA types | L7-17 (add to re-export list) |
| `src/services/auth.ts` | Modify `submitCredentials`, add 3 new methods, update imports | L17-26 (imports), L147-159 (submitCredentials), after L353 (new methods) |
| `src/index.ts` | Export new 2FA types from package | L54-67 (Types section) |
| `src/services/__tests__/auth.spec.ts` | Add tests for modified + new methods | L10 (imports), after L432 (new describe blocks) |

### Technical Decisions

- Keep 2FA response types in snake_case (no mapping to camelCase) per user preference
- Add 2FA error codes as a TypeScript union type `TwoFactorErrorCode` for type safety
- No composable or store wrappers - service methods called directly by consuming app
- Follow existing axios + try-catch + logger pattern for all new methods
- `submitCredentials` payload conditionally includes `authCode` only when provided (not `undefined`)
- New 2FA endpoints use `/api/v1/auth/2fa/` prefix (distinct from login's `/api/v1/oauth/`)

## Implementation Plan

### Tasks

- [x] Task 1: Add 2FA types and error codes to `src/types/auth.ts`
  - File: `src/types/auth.ts`
  - Action: After `BackendAuthError` interface (L67), add:
    - `TwoFactorErrorCode` — union type: `'2fa_setup_required' | '2fa_code_required' | 'token_expired' | 'token_invalid' | 'token_used'`
    - `TwoFactorSetupResponse` — interface with fields: `user_id: string`, `qr_code: string`, `secret: string`, `issuer: string`, `account_name: string`
    - `TwoFactorVerifyResponse` — interface with fields: `message: string`, `backup_codes: string[]`, `user_id: string`
    - `TwoFactorResendResponse` — interface with fields: `message: string`
    - `TwoFactorErrorResponse` — interface with field: `detail: string`
  - Notes: All interfaces use snake_case field names (no camelCase mapping). Add JSDoc comments matching existing style.

- [x] Task 2: Export new 2FA types from `src/types/index.ts`
  - File: `src/types/index.ts`
  - Action: Add to the re-export list from `'./auth'`:
    - `TwoFactorErrorCode`
    - `TwoFactorSetupResponse`
    - `TwoFactorVerifyResponse`
    - `TwoFactorResendResponse`
    - `TwoFactorErrorResponse`

- [x] Task 3: Modify `submitCredentials` in `src/services/auth.ts`
  - File: `src/services/auth.ts`
  - Action:
    - Update import list (L17-26) to include `TwoFactorSetupResponse`, `TwoFactorVerifyResponse`, `TwoFactorResendResponse`
    - Change signature from `submitCredentials(email: string, password: string)` to `submitCredentials(email: string, password: string, authCode?: string)`
    - Build payload conditionally: `const payload: Record<string, string> = { email, password }; if (authCode) { payload.authCode = authCode; }`
    - Pass `payload` instead of `{ email, password }` to the axios.post call
    - Update JSDoc to document the new `authCode` parameter and 2FA error codes
  - Notes: The payload key is `authCode` (camelCase) as specified in the design spec. Only include when truthy.

- [x] Task 4: Add `setup2FA` method to `src/services/auth.ts`
  - File: `src/services/auth.ts`
  - Action: Add method to `AuthService` class (before the class closing brace):
    ```
    async setup2FA(token: string): Promise<TwoFactorSetupResponse>
    ```
    - POST to `${getBffBaseUrl()}/api/v1/auth/2fa/setup`
    - Payload: `{ token }`
    - Config: `{ withCredentials: true }`
    - Return `response.data`
    - Follow try-catch pattern: `logger.info('2FA setup initiated successfully')` / `logger.error('Failed to initiate 2FA setup', error)` / rethrow
    - Add JSDoc documenting endpoint, payload, response, and error codes (`token_expired`, `token_invalid`, `token_used`)

- [x] Task 5: Add `verify2FASetup` method to `src/services/auth.ts`
  - File: `src/services/auth.ts`
  - Action: Add method to `AuthService` class:
    ```
    async verify2FASetup(token: string, totpCode: string): Promise<TwoFactorVerifyResponse>
    ```
    - POST to `${getBffBaseUrl()}/api/v1/auth/2fa/verify-setup`
    - Payload: `{ token, totp_code: totpCode }`
    - Config: `{ withCredentials: true }`
    - Return `response.data`
    - Follow try-catch pattern: `logger.info('2FA setup verified successfully')` / `logger.error('Failed to verify 2FA setup', error)` / rethrow
    - Add JSDoc documenting endpoint, payload, response
  - Notes: Payload field is `totp_code` (snake_case) to match backend API. Method parameter is `totpCode` (camelCase) for TypeScript convention.

- [x] Task 6: Add `resend2FASetupEmail` method to `src/services/auth.ts`
  - File: `src/services/auth.ts`
  - Action: Add method to `AuthService` class:
    ```
    async resend2FASetupEmail(email: string): Promise<TwoFactorResendResponse>
    ```
    - POST to `${getBffBaseUrl()}/api/v1/auth/2fa/resend-setup-email`
    - Payload: `{ email }`
    - Config: `{ withCredentials: true }`
    - Return `response.data`
    - Follow try-catch pattern: `logger.info('2FA setup email resent successfully')` / `logger.error('Failed to resend 2FA setup email', error)` / rethrow
    - Add JSDoc documenting endpoint, payload, response

- [x] Task 7: Export new 2FA types from `src/index.ts`
  - File: `src/index.ts`
  - Action: Add to the `export type { ... } from './types'` block (L54-67):
    - `TwoFactorErrorCode`
    - `TwoFactorSetupResponse`
    - `TwoFactorVerifyResponse`
    - `TwoFactorResendResponse`
    - `TwoFactorErrorResponse`

- [x] Task 8: Add tests for modified `submitCredentials` in `src/services/__tests__/auth.spec.ts`
  - File: `src/services/__tests__/auth.spec.ts`
  - Action: Within the existing `describe('submitCredentials')` block, add tests:
    - `it('posts credentials without authCode when not provided')` — verify payload is `{ email, password }` (no `authCode` key)
    - `it('includes authCode in payload when provided')` — call `submitCredentials('test@example.com', 'pass', '123456')`, verify payload is `{ email: 'test@example.com', password: 'pass', authCode: '123456' }`
    - `it('throws error with 2fa_setup_required detail')` — mock 401 response with `{ detail: '2fa_setup_required' }`, verify error propagates
    - `it('throws error with 2fa_code_required detail')` — mock 401 response with `{ detail: '2fa_code_required' }`, verify error propagates
  - Notes: Update imports to include new 2FA types if needed for type assertions.

- [x] Task 9: Add tests for `setup2FA` in `src/services/__tests__/auth.spec.ts`
  - File: `src/services/__tests__/auth.spec.ts`
  - Action: Add new `describe('setup2FA')` block with tests:
    - `it('posts token and returns setup response')` — mock success with `{ user_id, qr_code, secret, issuer, account_name }`, verify POST to `/api/v1/auth/2fa/setup` with `{ token }` and `{ withCredentials: true }`, verify return value
    - `it('throws error on token_expired')` — mock rejection, verify rethrow
    - `it('throws error on token_invalid')` — mock rejection, verify rethrow
    - `it('throws error on token_used')` — mock rejection, verify rethrow
    - `it('throws error on network failure')` — mock `new Error('Network error')`, verify rethrow

- [x] Task 10: Add tests for `verify2FASetup` in `src/services/__tests__/auth.spec.ts`
  - File: `src/services/__tests__/auth.spec.ts`
  - Action: Add new `describe('verify2FASetup')` block with tests:
    - `it('posts token and totp_code and returns verify response')` — mock success with `{ message, backup_codes, user_id }`, verify POST to `/api/v1/auth/2fa/verify-setup` with `{ token, totp_code }` and `{ withCredentials: true }`, verify return value
    - `it('throws error on invalid TOTP code')` — mock rejection with `{ detail: 'invalid totp code' }`, verify rethrow
    - `it('throws error on network failure')` — mock `new Error('Network error')`, verify rethrow

- [x] Task 11: Add tests for `resend2FASetupEmail` in `src/services/__tests__/auth.spec.ts`
  - File: `src/services/__tests__/auth.spec.ts`
  - Action: Add new `describe('resend2FASetupEmail')` block with tests:
    - `it('posts email and returns resend response')` — mock success with `{ message }`, verify POST to `/api/v1/auth/2fa/resend-setup-email` with `{ email }` and `{ withCredentials: true }`, verify return value
    - `it('throws error on failure')` — mock rejection, verify rethrow
    - `it('throws error on network failure')` — mock `new Error('Network error')`, verify rethrow

- [x] Task 12: Run tests and verify build
  - Action: Run `yarn test` to verify all new and existing tests pass. Run `yarn build` to verify TypeScript compilation and no type errors.

### Acceptance Criteria

- [x] AC 1: Given `submitCredentials` is called with `(email, password)` only, when the request is made, then the payload contains `{ email, password }` with no `authCode` field
- [x] AC 2: Given `submitCredentials` is called with `(email, password, authCode)`, when the request is made, then the payload contains `{ email, password, authCode }` where `authCode` is the provided TOTP code
- [x] AC 3: Given the backend returns `{ detail: '2fa_setup_required' }` on login, when `submitCredentials` throws, then the error response data contains the `2fa_setup_required` code accessible via `error.response.data.detail`
- [x] AC 4: Given the backend returns `{ detail: '2fa_code_required' }` on login, when `submitCredentials` throws, then the error response data contains the `2fa_code_required` code accessible via `error.response.data.detail`
- [x] AC 5: Given a valid setup token, when `setup2FA(token)` is called, then it POSTs to `/api/v1/auth/2fa/setup` with `{ token }` and returns `{ user_id, qr_code, secret, issuer, account_name }`
- [x] AC 6: Given an expired/invalid/used token, when `setup2FA(token)` is called, then the error is rethrown with the backend error response containing `detail` with the appropriate error code
- [x] AC 7: Given a valid token and TOTP code, when `verify2FASetup(token, totpCode)` is called, then it POSTs to `/api/v1/auth/2fa/verify-setup` with `{ token, totp_code }` and returns `{ message, backup_codes, user_id }`
- [x] AC 8: Given an invalid TOTP code, when `verify2FASetup(token, totpCode)` is called, then the error is rethrown with the backend error response
- [x] AC 9: Given a valid email, when `resend2FASetupEmail(email)` is called, then it POSTs to `/api/v1/auth/2fa/resend-setup-email` with `{ email }` and returns `{ message }`
- [x] AC 10: Given a network failure on any 2FA method, when the method is called, then the error is logged and rethrown
- [x] AC 11: Given the package is built, when a consuming app imports from `@turnkeystaffing/get-native-vue-auth`, then `TwoFactorErrorCode`, `TwoFactorSetupResponse`, `TwoFactorVerifyResponse`, `TwoFactorResendResponse`, and `TwoFactorErrorResponse` are available as type imports
- [x] AC 12: Given all changes are complete, when `yarn test` is run, then all existing tests continue to pass and all new tests pass
- [x] AC 13: Given all changes are complete, when `yarn build` is run, then TypeScript compiles without errors

## Additional Context

### Dependencies

- No new dependencies required — uses existing axios and `@turnkeystaffing/get-native-vue-logger`
- Backend 2FA endpoints must be implemented and available for integration testing (out of scope for this spec)

### Testing Strategy

- **Unit tests**: All new and modified methods tested via mocked axios in `src/services/__tests__/auth.spec.ts`
- **Test patterns**: Follow existing `mockedAxios.post.mockResolvedValueOnce` / `mockRejectedValueOnce` patterns
- **Coverage**: Success paths, error paths (backend errors), network failures for each method
- **Backward compatibility**: Existing `submitCredentials` tests remain unchanged to verify no regression when `authCode` is omitted
- **Build verification**: `yarn build` must succeed with no TypeScript errors

### Notes

- Backend error format is consistent: `{ "detail": "<error_code_or_message>" }`
- `submitCredentials` currently POSTs to `/api/v1/oauth/login` — the `authCode` field gets added to that same payload
- New 2FA endpoints are under `/api/v1/auth/2fa/` (different path prefix from login)
- Response types: `setup2FA` returns `{ user_id, qr_code, secret, issuer, account_name }`, `verify2FASetup` returns `{ message, backup_codes, user_id }`, `resend2FASetupEmail` returns `{ message }`
- The `totp_code` payload field uses snake_case to match backend API, while the TypeScript method parameter uses camelCase (`totpCode`)

## Review Notes
- Adversarial review completed
- Findings: 15 total, 8 fixed, 7 skipped
- Resolution approach: walk-through
- Fixed: F1 (authCode falsy check), F2 (security JSDoc), F5 (LoginCredentials updated), F7 (stronger error assertions), F10 (authCode success path test), F12 (@throws annotations), F13 (merged duplicate test), F14 (qr_code format doc), F15 (error code phase docs)
- Skipped: F3, F4 (consumer types by design), F6 (consistent with existing methods), F8 (out of scope per spec), F9 (consistent with submitCredentials), F11 (backend API naming), F13 (noise)
