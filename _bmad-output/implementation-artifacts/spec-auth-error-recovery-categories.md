---
title: 'Reshape AuthErrorType into five recovery categories with lowercase error-code routing'
type: 'refactor'
created: '2026-04-17'
status: 'done'
baseline_commit: 'b85a476'
context:
  - '{project-root}/docs/auth-error-codes.md'
  - '{project-root}/docs/error-handling-analysis.md'
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The interceptor maps HTTP status alone into three buckets (`session_expired`/401, `permission_denied`/403, `service_unavailable`/503). The analysis in `docs/error-handling-analysis.md` shows this mis-routes many backend codes: `REAUTH_REQUIRED`/`SESSION_COMPROMISED` (403, fixable by re-login) and `ACCOUNT_INACTIVE` (403, terminal) all render as the same "Permission denied"; `invalid_client`/`invalid_scope` can drive infinite redirect loops if the route guard fires on them; `rate_limit_exceeded` (429) and structured transient 500s (`LOGOUT_FAILED`, `SESSIONS_FETCH_FAILED`) aren't intercepted. Codes also arrive in mixed casing (`invalid_grant` vs. `MISSING_TOKEN`) and are matched case-sensitively.

**Approach:** Widen `AuthErrorType` to the five recovery categories from the analysis doc (`session_expired`, `service_unavailable`, `dev_error`, `account_blocked`, `server_error`), drive routing from a single **code→category map** keyed on lowercased codes with HTTP-status fallbacks only when the code is absent, and add three new terminal overlay views reusing `overlay.css`. Remove `permission_denied` entirely. Handle 429 via `Retry-After`.

## Decision Rationale (ADR)

**Status:** Accepted (this spec)

**Context.** The interceptor routes on HTTP status alone (401/403/503). Two distinct problems fall out of that: (a) 403 is overloaded — `REAUTH_REQUIRED` (fixable by re-login), `ACCOUNT_INACTIVE` (terminal), `INSUFFICIENT_PERMISSIONS` (terminal, scope-specific), and `INVALID_CLIENT` (misconfig) all collapse to "Permission denied"; (b) whole code classes (`rate_limit_exceeded`/429, structured transient 500s, dev misconfig) bypass the overlay entirely. Error codes arrive in mixed casing and are matched case-sensitively.

**Decision.** Route on a lowercased error code via a single authoritative map, with HTTP-status fallback only when the code is absent. Five categories, each corresponding to a distinct recovery UX:

| Category | User's next action | CTA | Clears auth state |
|---|---|---|---|
| `session_expired` | re-authenticate | "Log in" | yes |
| `service_unavailable` | wait and retry | countdown → retry | no |
| `account_blocked` | contact account admin (or sign out to switch) | "Sign out" (+ scope list if `insufficient_permissions`) | yes |
| `dev_error` | contact app developer (or sign out) | "Sign out" | no |
| `server_error` | report incident ref | "Copy ref" | no |

**Axis chosen: recovery action**, not HTTP status, not backend taxonomy, not "who is at fault." The user-facing recovery step is what differentiates the UI; grouping by that keeps view count minimal while guaranteeing each view has a single coherent CTA.

**Alternatives considered.**

| Option | Categories | Rejected because |
|---|---|---|
| A. Keep 3 status-based buckets | 401/403/503 | This is the defect — 403 and transient 5xx are ambiguous by status alone. |
| B. Binary: transient vs. terminal | 2 | Merges "re-login" and "wait-and-retry" — behaviorally incompatible CTAs in one view. |
| C. Merge `dev_error` into `server_error` | 4 | Audiences differ (dev fixes config vs. ops investigates incident). Copy diverges; one view would grow conditionals. |
| D. Split `account_blocked` into `inactive` + `insufficient_permissions` | 6 | Views would be ~95% identical; difference is a scope list, handled as a conditional branch inside one view. |
| E. Per-code view slots, no categories | N | Pushes taxonomy onto every consumer; loses the "recovery action" abstraction that the map exists to express. |
| F. Axis = "who fixes it" (user/dev/ops/time) | 4–5 | Near-isomorphic to the chosen split; rejected for clarity — "recovery action" names what the UI does, the audience axis names who the UI is addressing. |

**Consequences.**

*Positive.*
- One source of truth (`ERROR_CODE_TO_TYPE`) — adding a new backend code is a one-line map entry; consumers can extend the map without replacing the function via `mapErrorCodeToType(code, overrides?)`.
- Each view has a single CTA obligation; no conditional-CTA forks.
- Auth state is cleared on categories where the user's identity is no longer valid on this session (`session_expired`, `account_blocked`) and preserved on operator-facing categories (`dev_error`, `server_error`) so consumer telemetry keeps user context intact for bug reports.
- Terminal views (`account_blocked`, `dev_error`) expose a "Sign out" CTA so the user is never stranded — switching accounts is often the real recovery for `insufficient_permissions`.
- Rate-limit and structured transient 500s now surface in the overlay with the existing countdown UX; `Retry-After` accepts both integer-seconds and HTTP-date per RFC 7231.

*Negative / accepted trade-offs.*
- **Pre-release refinement, not a released-API break.** 2.0.0 is unreleased, so removing `permission_denied` is churn inside the 2.0.0 surface area, not a breaking change against shipped consumers. Version stays at `2.0.0`.
- **Unknown 403 is not overlaid.** An unrecognized 403 propagates without an overlay, but the unmapped code is surfaced via `console.warn` in dev and through the optional `onUnmappedError` hook (see Boundaries) so map drift is visible. Silence is intentional at the UI layer, not at the observability layer.
- **Map drift risk.** The code→category table lives in one file; if backend adds a code and the map isn't updated, it falls through to `statusFallbackType` or becomes unknown. Mitigated by: (1) map is exported + extensible via `overrides`; (2) `onUnmappedError` hook catches drift in prod; (3) `console.warn` in dev; (4) interceptor tests cover every listed code; (5) doc `auth-error-codes.md` is the contract.
- **Lowercase normalization cost.** One `.toLowerCase()` per intercepted error — negligible.

**Non-decisions (deliberately open).**
- Whether `dev_error` should log to a monitoring sink by default — out of scope; consumers wire this themselves via the view slot.
- Whether `server_error` should auto-retry once before showing — rejected for now; `request_id` should surface immediately so users can report without waiting.

## Boundaries & Constraints

**Always:**
- Lowercase any backend `error_type` / `error` string before lookup; treat RFC-6749 lowercase codes and Auth API `UPPER_CASE` codes as one input space.
- Keep the public-API prop shapes of existing view replacements (`SessionExpiredViewProps`, `ServiceUnavailableViewProps`) byte-compatible. New view prop types follow the same `{ error, config, ... }` shape.
- Every path that today calls `authStore.setError()` must still set an error in the correct new category — no regression into silence.
- Category 5 (inline/form) errors continue to propagate as rejected promises without touching store state.
- Surface unknown/unmapped error codes via `console.warn` in dev builds **and** the optional `onUnmappedError(code, status, error)` plugin hook so map drift is always observable — never silently drop an error whose code is not in the map and isn't a known inline code.
- `mapErrorCodeToType(code, overrides?)` accepts an optional `overrides: Record<string, AuthErrorType | null>` so consumers can extend the canonical map (or mark a custom code as inline) without forking the function. Overrides shallow-merge over `ERROR_CODE_TO_TYPE`.
- Terminal overlay views (`account_blocked`, `dev_error`) always render a "Sign out" CTA so the user has a non-destructive escape hatch. The CTA calls `authStore.logout()` and dismisses the overlay.
- All new exports routed through `src/index.ts`.

**Ask First:**
- Final field names on `AuthError` additions: `code`, `requestId`, `missingScopes`, `requiredScopes` — confirm before committing consumers to them.

**Never:**
- Do **not** add an overlay fallback for unknown 403s. If a 403 arrives without a recognized code, propagate the rejection but do not call `setError` — that was the prior source of misclassification. (Observability still fires via `onUnmappedError` / `console.warn`.)
- Do **not** re-introduce `permission_denied` under another name. 403 splits across `session_expired` and `account_blocked`.
- Do **not** add Vuetify or any new runtime peer dep.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Case-insensitive code match | Any status + `error_type: "REAUTH_REQUIRED"` (or lowercase equivalent) | `setError({ type: 'session_expired', code: 'reauth_required', ... })` | N/A |
| Dev error | `error_type: "INVALID_CLIENT"` (any status) | `setError({ type: 'dev_error', code, message })` — DevErrorView, no auth CTA | N/A |
| Account inactive | 403 `error_type: "ACCOUNT_INACTIVE"` | `setError({ type: 'account_blocked', code: 'account_inactive' })` | N/A |
| Insufficient scopes | 403 `INSUFFICIENT_PERMISSIONS`, body `{ missing_scopes, required_scopes }` | `setError({ type: 'account_blocked', code, missingScopes, requiredScopes })` | N/A |
| Rate limit (seconds) | 429, `Retry-After: 60`, body may lack `error_type` | `setError({ type: 'service_unavailable', code: 'rate_limit_exceeded', retryAfter: 60 })` | Non-integer → 30s default |
| Rate limit (HTTP-date) | 429, `Retry-After: Wed, 21 Oct 2026 07:28:00 GMT` (RFC 7231) | `setError({ ..., retryAfter })` where `retryAfter = Math.max(1, Math.round((Date.parse(value) - Date.now()) / 1000))` | Unparseable or past-date → 30s default |
| Transient 500 | 500 `error_type: "LOGOUT_FAILED"` | `setError({ type: 'service_unavailable', code: 'logout_failed' })` with default retryAfter | N/A |
| Server error | 500 `error_type: "INTERNAL_ERROR"` or `"server_error"`, body may carry `request_id`/`ref` | `setError({ type: 'server_error', code, requestId? })` — ServerErrorView | N/A |
| Unknown 403 (no code or unmapped code) | 403 without `error_type`, or with a code not in the map and not in `KNOWN_INLINE_CODES` | Propagate only — no store error set. Fire `onUnmappedError(code, 403, error)` if configured; `console.warn` in dev | Prior `permission_denied` fallback removed |
| Unknown 401 | 401 without `error_type` | `setError({ type: 'session_expired' })` — generic fallback kept | N/A |
| Generic 503 | 503 without `error_type` | Propagate only — not an auth error | Prior behavior |
| Inline/form (Category 5, known) | e.g. `error_type: "weak_password"` listed in `KNOWN_INLINE_CODES` | Propagate — `mapErrorCodeToType` returns `null`; interceptor detects inline-code membership and stays quiet | Caller renders inline |
| Unknown code (not in map, not inline) | Lowercased code absent from both the map and `KNOWN_INLINE_CODES` | Propagate; apply `statusFallbackType(status)` if it yields a type, else no-op; fire `onUnmappedError` | Distinct from Category 5 — membership in `KNOWN_INLINE_CODES` separates "known and handled by caller" from "don't know" |

</frozen-after-approval>

## Code Map

- `src/types/auth.ts` — owns `AuthErrorType`, `AuthError`, `BackendAuthError`.
- `src/services/errorCodeMap.ts` *(new)* — canonical code→category table + `mapErrorCodeToType` + `statusFallbackType`.
- `src/services/auth.ts` — hosts current `parseAuthError` and `mapErrorType`.
- `src/services/interceptors.ts` — 401/403/503 branches today; 429 missing.
- `src/stores/auth.ts` — `setError` today clears auth on `session_expired`.
- `src/components/AuthErrorBoundary.vue` — 2-branch dispatcher to views.
- `src/components/views/{Session,Service}*.vue` + `overlay.css` — existing views to pattern from.
- `src/components/views/{DevError,AccountBlocked,ServerError}View.vue` *(new)*.
- `src/types/config.ts` — `AuthText`, `AuthIcons`, `AuthErrorViews`, `*ViewProps`, optional `onUnmappedError` hook, optional `errorCodeOverrides` map.
- `src/plugin.ts` — `DEFAULT_ICONS`; threads `onUnmappedError` + `errorCodeOverrides` from plugin config into the interceptor.
- `src/index.ts` — barrel.
- `demo/components/DemoControlPanel.vue` — manual verification surface.
- Tests: `src/services/__tests__/interceptors.spec.ts`, `src/stores/__tests__/auth.spec.ts`, new view specs under `src/components/views/__tests__/`.
- `package.json` — version.

## Tasks & Acceptance

**Execution:**
- [x] `src/types/auth.ts` -- widen `AuthErrorType` to 5 members; add optional `code`, `requestId`, `missingScopes`, `requiredScopes` on `AuthError`; widen `BackendAuthError.error_type` to `string`; add optional `missing_scopes`, `required_scopes`, `request_id`, `ref` fields -- enables structured routing
- [x] `src/services/errorCodeMap.ts` -- author the authoritative lowercase `ERROR_CODE_TO_TYPE` map + `KNOWN_INLINE_CODES: ReadonlySet<string>` + `mapErrorCodeToType(code, overrides?: Record<string, AuthErrorType | null>)` + `statusFallbackType(status)`; table listed in Design Notes below -- single source of truth + consumer-extensible
- [x] `src/services/auth.ts` -- delete `mapErrorType`; rewrite `parseAuthError` to lowercase the code, call `mapErrorCodeToType`, fall back to `statusFallbackType(status)`, copy through `missing_scopes`/`required_scopes`/`request_id`/`ref` -- structured output for overlays
- [x] `src/services/interceptors.ts` -- remove the 403 `permission_denied` fallback; add a 429 branch that synthesizes `{ type: 'service_unavailable', code: 'rate_limit_exceeded', retryAfter }` from the `Retry-After` header when the body lacks a code (accept integer seconds **or** HTTP-date via `Date.parse`, clamp to ≥ 1s, fall back to 30s on parse failure / past-date); emit `onUnmappedError(code, status, error)` + `console.warn` (dev only) whenever `mapErrorCodeToType` returns `null` **and** the code is not in `KNOWN_INLINE_CODES`; thread `errorCodeOverrides` from plugin config; keep the 401 fallback and the `isAuthConfigured` guard -- close mis-routing + transient gaps + drift observability
- [x] `src/stores/auth.ts` -- widen the auth-state clearing in `setError` so it fires for `session_expired` **and** `account_blocked`; leave `dev_error`/`server_error` non-clearing; update JSDoc to document the invariant ("clear auth when the user's identity is no longer valid on this session") -- prevents accidental logout on operator-facing errors while avoiding surreal "authenticated but blocked" store state
- [x] `src/components/AuthErrorBoundary.vue` -- expand `activeView`/`viewProps` to 5 branches dispatching to the new views -- wire UX
- [x] `src/components/views/DevErrorView.vue` *(new)* -- terminal view, surfaces `error.code` + `error.message` with a "Contact the application developer" line; renders a "Sign out" CTA that calls `authStore.logout()` and dismisses the overlay
- [x] `src/components/views/AccountBlockedView.vue` *(new)* -- terminal view; when `error.code === 'insufficient_permissions'` render `missingScopes` list; otherwise generic "account disabled" copy; renders a "Sign out" CTA that calls `authStore.logout()` and dismisses the overlay (switching accounts is the real recovery for most cases)
- [x] `src/components/views/ServerErrorView.vue` *(new)* -- terminal view; render `error.requestId` with a "Copy ref" button (clipboard API)
- [x] `src/types/config.ts` -- add `AuthText.{devError,accountBlocked,serverError}` (including `signOut` label for the two terminal views), matching `AuthIcons` + `AuthErrorViews` slots, new `*ViewProps` interfaces, optional `onUnmappedError?: (code: string | null, status: number, error: unknown) => void`, and optional `errorCodeOverrides?: Record<string, AuthErrorType | null>` on plugin config -- consumer override surface
- [x] `src/plugin.ts` -- default icons (or `false`) for the three new categories; read `onUnmappedError` + `errorCodeOverrides` from consumer config and pass them into the interceptor factory
- [x] `src/index.ts` -- export new prop types, `mapErrorCodeToType`, the read-only `ERROR_CODE_TO_TYPE` map, and `KNOWN_INLINE_CODES`
- [x] `demo/components/DemoControlPanel.vue` -- replace the permission-denied button with 4 triggers: dev_error, account_blocked (with toggle for insufficient_permissions), server_error (with request_id), rate_limit_exceeded using the retryAfter slider; add a toggle to emit 429 as HTTP-date instead of seconds; add a button to emit an unmapped 403 code so the dev can watch `console.warn` / `onUnmappedError` fire
- [x] `src/services/__tests__/interceptors.spec.ts` -- rewrite 403 section; add 429 + per-category code tests + case-insensitive tests matching the I/O matrix; cover HTTP-date `Retry-After`, past-date fallback, and unmapped-code `onUnmappedError` invocation; cover `errorCodeOverrides` threading
- [x] `src/stores/__tests__/auth.spec.ts` -- update `setError` tests: `session_expired` **and** `account_blocked` clear auth state; `dev_error` / `server_error` do not
- [x] `src/components/views/__tests__/{DevError,AccountBlocked,ServerError}View.spec.ts` *(new)* -- render + prop-driven copy; DevError/AccountBlocked render Sign-out CTA and invoke `authStore.logout()` on click; ServerError renders Copy-ref and writes `requestId` to `navigator.clipboard`
- [x] `package.json` -- stays at `2.0.0` (unreleased); no version bump needed. Removing `permission_denied` is pre-release refinement, not a consumer-breaking change.

**Acceptance Criteria:**
- Given any response carrying an `error_type` listed in the Design Notes table (any case), when the interceptor runs, then `setError` is called with the matching category and `error.code` equals the lowercased input.
- Given a 429 with `Retry-After: 60` (integer seconds), when the interceptor runs, then the store receives `service_unavailable` + `retryAfter: 60` and ServiceUnavailableView counts down from 60.
- Given a 429 with `Retry-After: <HTTP-date>` 60 seconds in the future, when the interceptor runs, then `retryAfter` is within `[55, 65]` (allowing clock skew) and the countdown starts from that value.
- Given a 429 with `Retry-After: <HTTP-date>` in the past or unparseable, when the interceptor runs, then `retryAfter` falls back to 30.
- Given a 403 with no `error_type`, **or** with a code not in the map and not in `KNOWN_INLINE_CODES`, when the interceptor runs, then no `setError` call occurs, the rejection propagates, and `onUnmappedError(code, 403, error)` is invoked (if configured).
- Given a known inline/form code (member of `KNOWN_INLINE_CODES`), when the interceptor runs, then no `setError` call occurs, the rejection propagates, and `onUnmappedError` is **not** invoked.
- Given an `AuthError` of type `session_expired` or `account_blocked`, when set, then `isAuthenticated`, `user`, and `accessToken` are cleared.
- Given an `AuthError` of type `dev_error` or `server_error`, when set, then `isAuthenticated` / `user` / `accessToken` are NOT cleared.
- Given AccountBlockedView or DevErrorView is active, when the user clicks the "Sign out" CTA, then `authStore.logout()` is called and the overlay dismisses.
- Given `INSUFFICIENT_PERMISSIONS` with body `missing_scopes: ["admin"]`, when AccountBlockedView renders, then "admin" is visible in the missing-scopes section.
- Given a 500 with `request_id` in the body, when ServerErrorView renders, then the ref is visible and the "Copy ref" button writes it to `navigator.clipboard`.
- Given plugin config with `errorCodeOverrides: { 'my_custom_code': 'server_error' }`, when the interceptor receives a response with `error_type: "MY_CUSTOM_CODE"`, then `setError({ type: 'server_error', code: 'my_custom_code' })` is called.
- `yarn typecheck && yarn lint && yarn test` pass; `yarn build` produces a `dist/index.js` whose `index.d.ts` exposes the widened `AuthErrorType`, the three new `*ViewProps`, `onUnmappedError` + `errorCodeOverrides` config fields, and `KNOWN_INLINE_CODES`.

## Design Notes

**Authoritative code→category table** (keys must be lowercase in the map; match both lowercase and `UPPER_CASE` backend inputs by lowercasing before lookup):

- **session_expired**: `invalid_grant`, `missing_token`, `invalid_token`, `invalid_user_id`, `user_not_found`, `missing_refresh_token`, `invalid_refresh_token`, `reauth_required`, `session_compromised`, `forbidden`, `invalid_session`, `authentication_error`
- **service_unavailable**: `temporarily_unavailable`, `service_unavailable`, `auth_service_unavailable`, `logout_failed`, `sessions_fetch_failed`, `revoke_failed`, `password_change_error`, `resend_email_failed`, `resend_email_error`, `2fa_setup_error`, `2fa_verify_error`, `rate_limit_exceeded`
- **dev_error**: `invalid_client`, `unauthorized_client`, `unsupported_response_type`, `unsupported_grant_type`, `invalid_scope`, `invalid_redirect_uri`, `client_inactive`, `cors_error`
- **account_blocked**: `account_inactive`, `insufficient_permissions`
- **server_error**: `server_error`, `internal_error`, `not_implemented`, `unknown_host`

**Category 5 (inline/form) — explicit allow list.** A separate `KNOWN_INLINE_CODES: ReadonlySet<string>` lists codes that are *recognized* as inline/form errors (e.g., `weak_password`, `email_in_use`, `invalid_verification_code` — populate from `docs/auth-error-codes.md`; extend as new form flows land). `mapErrorCodeToType` returns `null` for these, and the interceptor stays silent (no `setError`, no `onUnmappedError`). **This list exists to distinguish "known and handled by caller" from "don't know at all."** Codes that are in neither `ERROR_CODE_TO_TYPE` nor `KNOWN_INLINE_CODES` also return `null` but are reported as drift via `onUnmappedError` + `console.warn`.

**HTTP-status fallback** (used only when `error_type` is absent): `401 → session_expired`; `429 → service_unavailable`; `503 → service_unavailable` **only** when `error_type === 'auth_service_unavailable'` (i.e., don't set anything for bare 503); everything else → no overlay. The old 403 fallback is deleted.

**Retry-After.** Read via `error.response.headers['retry-after']` (axios lowercases headers). Accept either:
- **delta-seconds** — non-negative integer; used as-is.
- **HTTP-date** (RFC 7231 §7.1.3) — parsed via `Date.parse(value)`; `retryAfter = Math.max(1, Math.round((parsed - Date.now()) / 1000))`.

Unparseable, `NaN`, or past-date values fall through to the 30s default in `AuthErrorBoundary.sanitizeRetryAfter`. Negative or zero delta-seconds also clamp to 1s (never 0).

**Consumer map overrides.** `mapErrorCodeToType(code, overrides?: Record<string, AuthErrorType | null>)` accepts an optional per-call overrides record, keyed on lowercased codes. Overrides shallow-merge *over* `ERROR_CODE_TO_TYPE` — lookup consults `overrides` first, falls through to the canonical map. Use `null` as a value to explicitly mark a custom code as inline. The plugin reads `errorCodeOverrides` from consumer config and threads it into the interceptor so consumers never rewrite the mapper. Overrides do **not** extend `KNOWN_INLINE_CODES`; if a consumer wants a custom code treated as inline *and* silent (no drift warning), they map it to `null` in overrides — the interceptor treats `overrides` hits as known, identical to inline.

**Unmapped-error observability.** The interceptor flags drift **only** when a non-empty `error_type`/`error` string is present on the response, was lowercased, and:
- is not a key in the merged `ERROR_CODE_TO_TYPE` + `overrides` map, and
- is not in `KNOWN_INLINE_CODES`.

When those conditions hold the interceptor:
1. Calls `onUnmappedError(code, status, error)` if the plugin was configured with one.
2. Emits `console.warn('[auth] unmapped error code', { code, status })` when `import.meta.env.DEV` is truthy (no warn in production bundles).
3. Applies `statusFallbackType(status)` and, if it yields a type, calls `setError` with a generic payload of that type; otherwise propagates silently.

A response with no `error_type` at all is **not** drift — it's a naked-status error. The interceptor applies `statusFallbackType(status)` and does not fire `onUnmappedError`.

## Verification

**Commands:**
- `yarn typecheck` -- expected: 0 errors
- `yarn lint` -- expected: clean
- `yarn test` -- expected: all pass, including new interceptor + view specs
- `yarn build` -- expected: clean build; widened types present in `dist/index.d.ts`

**Manual checks:**
- `yarn dev` the demo. Trigger each of the 5 categories; verify correct overlay, CTA, and `Clear Error` dismisses each.
- Trigger the 429 button with slider at 15s; verify countdown from 15 and auto-retry.
- Toggle the 429 trigger to HTTP-date mode with "+60s" preset; verify retryAfter resolves to ~60 and countdown matches.
- Trigger the 429 with an HTTP-date 10 minutes in the past; verify fallback to 30s default (no negative countdown, no NaN).
- On AccountBlockedView (with `insufficient_permissions` toggle off) and DevErrorView: click "Sign out"; verify `authStore.logout()` fires, overlay dismisses, and the user lands in signed-out state.
- Trigger the unmapped-403 demo button with a stubbed `onUnmappedError` handler on the plugin; verify `console.warn` fires in dev and the hook receives `(code, 403, error)`.
- Provide `errorCodeOverrides: { 'my_custom_code': 'server_error' }` in demo plugin config; trigger a response with `error_type: "MY_CUSTOM_CODE"`; verify ServerErrorView renders.

## Suggested Review Order

**Error-code routing (the heart of the change)**

- Canonical map, inline allow-list, and `mapErrorCodeToType` with consumer overrides — single source of truth for every lookup.
  [`errorCodeMap.ts:31`](../../src/services/errorCodeMap.ts#L31)

- `parseAuthError` lowercases the incoming code, walks the merged map, copies structured fields (`missing_scopes`, `required_scopes`, `request_id`/`ref`) into `AuthError`.
  [`auth.ts:97`](../../src/services/auth.ts#L97)

- Response interceptor: status-less routing via the code map, drift hook, 429 header handling, service-unavailable retry-after fallback.
  [`interceptors.ts:198`](../../src/services/interceptors.ts#L198)

- Drift observability: `onUnmappedError` promise-safe invocation + dev-only `console.warn` gated on statically-replaced `import.meta.env.DEV`.
  [`interceptors.ts:228`](../../src/services/interceptors.ts#L228)

- Naked-429 fallback synthesizes `rate_limit_exceeded` with `Retry-After`; supports integer seconds and RFC 7231 HTTP-date.
  [`interceptors.ts:254`](../../src/services/interceptors.ts#L254)

**Widened types & public API**

- `AuthErrorType` grows from 3 to 5 members; `AuthError` gains `code`, `requestId`, `missingScopes`, `requiredScopes`.
  [`types/auth.ts:49`](../../src/types/auth.ts#L49)

- New config slots, `UnmappedErrorHook`, `errorCodeOverrides`, and the `ServerErrorViewProps.onDismiss` escape hatch.
  [`types/config.ts:42`](../../src/types/config.ts#L42)

- Barrel: widened type + helper exports consumers lean on.
  [`index.ts:80`](../../src/index.ts#L80)

**Store semantics**

- `setError` clears identity on `session_expired` AND `account_blocked`; preserves it for `dev_error` / `server_error`.
  [`stores/auth.ts:345`](../../src/stores/auth.ts#L345)

**Overlay dispatcher + new terminal views**

- Five-branch view dispatch with handler wiring (sign-in / retry / sign-out / dismiss).
  [`AuthErrorBoundary.vue:32`](../../src/components/AuthErrorBoundary.vue#L32)

- Dismiss handler: safety-net for `server_error` without a `request_id` so the modal is never locked.
  [`AuthErrorBoundary.vue:130`](../../src/components/AuthErrorBoundary.vue#L130)

- `ServerErrorView` renders Copy-ref when a ref is present + always-available Dismiss.
  [`ServerErrorView.vue:69`](../../src/components/views/ServerErrorView.vue#L69)

- `DevErrorView` — terminal, code+message, Sign-out CTA.
  [`DevErrorView.vue:1`](../../src/components/views/DevErrorView.vue#L1)

- `AccountBlockedView` — scope list when `insufficient_permissions`, Sign-out CTA.
  [`AccountBlockedView.vue:1`](../../src/components/views/AccountBlockedView.vue#L1)

**Tests**

- Full interceptor matrix: case-insensitivity, each category, 429 seconds/HTTP-date/past-date, header fallback on body-coded 429, drift hook, overrides.
  [`interceptors.spec.ts:1`](../../src/services/__tests__/interceptors.spec.ts#L1)

- `errorCodeMap` table tests + inline-codes membership + overrides semantics.
  [`errorCodeMap.spec.ts:1`](../../src/services/__tests__/errorCodeMap.spec.ts#L1)

- Store semantics: `account_blocked` clears auth; `dev_error` / `server_error` do not.
  [`auth.spec.ts:1`](../../src/stores/__tests__/auth.spec.ts#L1)

- Terminal-view specs including the Dismiss-without-requestId case.
  [`ServerErrorView.spec.ts:1`](../../src/components/views/__tests__/ServerErrorView.spec.ts#L1)

**Plugin & demo**

- Plugin threads `onUnmappedError` + `errorCodeOverrides` into the resolved config; adds default icons for the three new categories.
  [`plugin.ts:1`](../../src/plugin.ts#L1)

- Demo panel triggers the four new categories, the HTTP-date toggle, past-date fallback, unmapped-code, and override cases.
  [`DemoControlPanel.vue:1`](../../demo/components/DemoControlPanel.vue#L1)
