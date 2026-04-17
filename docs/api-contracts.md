# BFF API Contracts

**Version:** 2.0.0
**Generated:** 2026-04-18

Every HTTP call originates from `src/services/auth.ts` (`AuthService`). All requests use `withCredentials: true` (session cookie). `Authorization: Bearer` headers are added by the Axios request interceptor in token mode — `AuthService` itself never sets them.

Base URL: `config.bffBaseUrl` (resolved from plugin options via `getGlobalConfig()`).

---

## Endpoints Called by `AuthService`

| Method | Path | Purpose | Called by | Request body | Response body |
|---|---|---|---|---|---|
| `POST` | `/api/v1/oauth/login` | Submit login credentials (Central Login SPA only) | `submitCredentials(email, password, totp?)` | `{ email, password, totp_code? }` | 200 OK (session cookie set) |
| `GET` | `/bff/userinfo` | Check if session is active | `checkAuth()` | — | `UserInfo` (200) or 401 |
| `POST` | `/bff/token` | Exchange session cookie for access token (token mode only) | `getAccessToken()` | `{ client_id }` | `BackendTokenResponse` (200) or 401 |
| `POST` | `/bff/logout` | Revoke session and clear cookies | `logout()` | `{}` | `{ success: true }` or structured error |
| `POST` | `/api/v1/auth/2fa/setup` | Initiate 2FA setup | `setup2FA(token)` | `{ token }` | `TwoFactorSetupResponse` |
| `POST` | `/api/v1/auth/2fa/verify-setup` | Verify TOTP for setup | `verify2FASetup(token, totp)` | `{ token, totp_code }` | `TwoFactorVerifyResponse` |
| `POST` | `/api/v1/auth/2fa/resend-setup-email` | Resend setup email | `resend2FASetupEmail(email, password)` | `{ email, password }` | `TwoFactorResendResponse` |

**Navigational redirects** (not XHR calls — full-page `window.location.href` assignments):

| Triggered by | URL | Query params |
|---|---|---|
| `login({ returnUrl? })` | `${bffBaseUrl}/bff/login` | `client_id`, `redirect_url` (**forced same-origin**, falls back to `/`) |
| `loginWithCustomClient({ clientId, returnUrl })` | `${bffBaseUrl}/bff/login` | `client_id` (trimmed, non-empty), `redirect_url` (http/https, **cross-origin allowed**) |
| `completeOAuthFlow({ clientId, returnUrl })` | `${bffBaseUrl}/bff/login` | `client_id`, `redirect_url` (cross-origin allowed) |

---

## Request / Response Schemas

### `UserInfo` (from `GET /bff/userinfo`)
```typescript
{
  user_id: string
  email: string
  session_id: string
  created_at: string       // ISO 8601
  last_activity: string    // ISO 8601
  expires_at: string       // ISO 8601
}
```

### `BackendTokenResponse` (from `POST /bff/token`)
Wire format — snake_case. The store maps it to camelCase `TokenResponse` before persisting:
```typescript
{
  access_token: string
  token_type: string
  expires_in: number        // seconds
  scope: string
}
```

### `BackendAuthError` (error response body)
Canonical RFC 6749-style shape across every endpoint:
```typescript
{
  error?: string              // any casing — interceptor lowercases before routing
  error_description?: string  // human-readable; becomes AuthError.message
}
```

The `error` code is widened to `string` because the backend emits both RFC 6749 lowercase codes (`invalid_grant`) and UPPER_CASE Auth API codes (`MISSING_TOKEN`). `mapErrorCodeToType` lowercases before lookup.

### `TwoFactorSetupResponse`
```typescript
{
  user_id: string
  qr_code: string           // data:image/png;base64,...
  secret: string
  issuer: string
  account_name: string
}
```
⚠ **Security:** `qr_code` and `secret` MUST NOT be logged, persisted to storage, or sent to error reporting (documented in service JSDoc).

### `TwoFactorVerifyResponse`
```typescript
{
  message: string
  backup_codes: string[]
  user_id: string
}
```
⚠ **Security:** `backup_codes` MUST NOT be logged or persisted.

### `TwoFactorResendResponse`
```typescript
{ message: string }
```

### `DecodedAccessToken` (JWT claims)
Returned by `decodeAccessToken(token)` — **client-side decode only**, no signature verification:
```typescript
{
  username: string
  email: string
  roles: string[]
  guid: string
  user_id: string
  session_id: string
  client_id: string
  iss: string
  sub: string
  aud: string[]
  exp: number        // seconds
  nbf: number
  iat: number
  jti: string
}
```

---

## Auth Mode Impact

| Mode | Token endpoints | Behavior |
|---|---|---|
| `token` (default) | `POST /bff/token` is called by `getAccessToken()` | Interceptor attaches `Authorization: Bearer`. Store manages `accessToken` / `tokenExpiresAt`. Lazy refresh with 60s buffer. |
| `cookie` | Token endpoints not used | Request interceptor early-exits (no Bearer). `getAccessToken()` **throws** `AuthConfigurationError`. `ensureValidToken()` returns `null`. All auth rides on BFF session cookies via `withCredentials: true`. |

---

## Error-Code → Category Routing

Full table in [error-handling-analysis.md](./error-handling-analysis.md). Summary of the canonical `ERROR_CODE_TO_TYPE` map (lowercase keys):

| `AuthErrorType` | Canonical codes |
|---|---|
| `session_expired` | `invalid_grant`, `missing_token`, `invalid_token`, `invalid_user_id`, `user_not_found`, `missing_refresh_token`, `invalid_refresh_token`, `reauth_required`, `session_compromised`, `forbidden`, `invalid_session`, `authentication_error` |
| `service_unavailable` | `temporarily_unavailable`, `service_unavailable`, `auth_service_unavailable`, `logout_failed`, `sessions_fetch_failed`, `revoke_failed`, `password_change_error`, `resend_email_failed`, `resend_email_error`, `2fa_setup_error`, `2fa_verify_error`, `rate_limit_exceeded` |
| `dev_error` | `invalid_client`, `unauthorized_client`, `unsupported_response_type`, `unsupported_grant_type`, `invalid_scope`, `invalid_redirect_uri`, `client_inactive`, `cors_error` |
| `account_blocked` | `account_inactive`, `insufficient_permissions` |
| `server_error` | `server_error`, `internal_error`, `not_implemented`, `unknown_host` |

**`KNOWN_INLINE_CODES`** — codes the interceptor stays silent for (caller renders inline): passwords (`missing_current_password`, `invalid_current_password`, `weak_password`, …), 2FA/TOTP (`missing_totp_code`, `invalid_totp_code`, `invalid_setup_token`, `2fa_already_enabled`, …), login form (`invalid_credentials`), email management (`email_not_found`, `email_exists`, `email_not_verified`, `cannot_remove_primary`, …), session UI (`missing_session_id`, `session_not_found`, …), consent (`invalid_request`, `access_denied`), security middleware (`payload_too_large`).

**Status fallbacks** (applied only when response body has no `error` code):
- `401` → `session_expired` (with generic message `"Your session has expired. Please sign in again."`)
- `429` → `service_unavailable` (synthesized code `rate_limit_exceeded`)
- Anything else → no overlay (rejection propagates)

**Bare 503** is intentionally NOT mapped — it's not necessarily an auth error without an accompanying code.

---

## Customization Points

- **`errorCodeOverrides`** (plugin option) — shallow-merges over `ERROR_CODE_TO_TYPE`. Values may be any `AuthErrorType` OR `null` (marks the code as inline/silent). Keys must be lowercase.
- **`onUnmappedError(code, status, error)`** (plugin option) — fired when the interceptor receives a non-empty code that is neither in the merged map nor in `KNOWN_INLINE_CODES`. Sync and async hooks are both supported; rejections are logged via the plugin logger, not thrown.
- **`parseAuthError(error, overrides?)`** (exported) — direct access for code that needs to pre-parse responses (e.g., bulk handling, custom toast systems). Returns `null` for known-inline / unknown / override-null codes; callers apply their own fallback.

---

## Security Notes for API Integration

| Concern | Where enforced |
|---|---|
| Open redirect | `login()` restricts `redirect_url` to same origin; malformed URLs fall back to current page. |
| Cross-origin (Central Login session-reuse) | `loginWithCustomClient` / `completeOAuthFlow` validate scheme (http/https only) and trim `clientId`; BFF is trusted to validate against registered client URIs. |
| Redirect loops | Client-side circuit breaker (3 attempts / 2 minutes, sessionStorage) in `utils/loginCircuitBreaker.ts`. Trips to `service_unavailable` so the UI stops redirecting. |
| Logging | `qr_code`, `secret`, `backup_codes`, `password`, `totp_code` MUST NOT be logged. Interceptor logs `error.message` only. |
| JWT | `decodeAccessToken` is decode-only. Never trust client-side claims for authorization — the BFF is authoritative. |
