# Error Handling Analysis — SPA Recovery Categories

Analysis of all auth service error codes mapped against what the SPA error overlay can actually do about them.

Source catalog: [auth-error-codes.md](./auth-error-codes.md)

---

## Current state

The library defines three frontend error types in `AuthErrorType`:

| Type | Trigger | Overlay behavior |
|------|---------|------------------|
| `session_expired` | 401 responses | Shows "Session Expired" view, user clicks "Sign In" → redirect to `/bff/login` |
| `permission_denied` | 403 responses | No dedicated overlay view |
| `service_unavailable` | 503 responses | Shows countdown + "Try Now" → auto-retry via `authStore.initAuth()` |

The response interceptor (`src/services/interceptors.ts`) maps HTTP status codes and structured `error_type` fields from the backend into these three types.

---

## Category 1: Recoverable via session refresh (redirect to `/bff/login`)

These errors mean the session is stale, expired, or invalidated. A fresh login resolves all of them.

| Error code | HTTP | Doc section | Why login fixes it |
|------------|------|-------------|-------------------|
| `invalid_grant` | 400 | OAuth | Auth code expired, redirect_uri mismatch, session stale |
| `MISSING_TOKEN` | 400 | Tokens & sessions | Authorization header absent — cookie/session lost |
| `INVALID_TOKEN` | 401 | Tokens & sessions | JWT expired, malformed, bad signature, blacklisted |
| `INVALID_USER_ID` | 400 | Tokens & sessions | Token `sub` claim corrupted — new token fixes it |
| `USER_NOT_FOUND` | 404 | Tokens & sessions | Token valid but user deleted — login will fail cleanly at IDP |
| `MISSING_REFRESH_TOKEN` | 400 | Tokens & sessions | Refresh token cookie lost |
| `INVALID_REFRESH_TOKEN` | 401 | Tokens & sessions | Refresh token revoked, rotated, or user inactive |
| `REAUTH_REQUIRED` | 403 | Tokens & sessions | Sudo/high-privilege op requires fresh login |
| `SESSION_COMPROMISED` | 403 | Tokens & sessions | Suspicious activity — server forces re-login |
| `FORBIDDEN` | 403 | Tokens & sessions | Cross-user action denied — stale session context |
| `invalid_session` | 401 | BFF proxy | Session cookie missing or expired |

### Gap in current implementation

Today only HTTP 401 triggers `session_expired`. Several recoverable errors arrive as **400, 403, or 404** and are either ignored or misclassified:

- `REAUTH_REQUIRED` (403) and `SESSION_COMPROMISED` (403) — currently lumped into `permission_denied`, but re-login is the correct action.
- `MISSING_TOKEN` (400), `MISSING_REFRESH_TOKEN` (400), `INVALID_USER_ID` (400) — 400 status is not intercepted at all.
- `USER_NOT_FOUND` (404) — not intercepted.

### Recommended overlay behavior

Same as current `session_expired`: show "Session Expired" view with "Sign In" button that redirects to `/bff/login`. The circuit breaker already prevents infinite loops if login itself fails.

---

## Category 2: Transient — auto-retry with backoff

Infrastructure or dependency failures that are expected to self-resolve. The user should wait and retry.

| Error code | HTTP | Doc section | Nature of transient failure |
|------------|------|-------------|-----------------------------|
| `temporarily_unavailable` | 503 | OAuth | Server overload or maintenance |
| `SERVICE_UNAVAILABLE` | 503 | Tokens & sessions | Dependency (Redis, DB) down |
| `LOGOUT_FAILED` | 500 | Tokens & sessions | Redis transient during session terminate |
| `SESSIONS_FETCH_FAILED` | 500 | Tokens & sessions | DB read error listing sessions |
| `REVOKE_FAILED` | 500 | Tokens & sessions | Session revocation DB error |
| `PASSWORD_CHANGE_ERROR` | 500 | Passwords & 2FA | DB write failure during password change |
| `RESEND_EMAIL_FAILED` | 400 | Passwords & 2FA | SMTP transient |
| `RESEND_EMAIL_ERROR` | 500 | Passwords & 2FA | SMTP transient |
| `2FA_SETUP_ERROR` | 500 | Passwords & 2FA | Backing service failure |
| `2FA_VERIFY_ERROR` | 500 | Passwords & 2FA | Backing service failure |
| `rate_limit_exceeded` | 429 | Rate limiting | Per-client or per-IP limit hit |
| `logout_failed` | 500 | BFF proxy | Upstream logout call failed |

### Gap in current implementation

- **429 is not handled.** The backend sends `Retry-After` and `X-RateLimit-*` headers — the overlay should use `Retry-After` for the countdown timer.
- **500 errors with known transient causes** (`LOGOUT_FAILED`, `SESSIONS_FETCH_FAILED`, `REVOKE_FAILED`) are not distinguished from terminal 500s. They currently fall through without a retry UI.

### Recommended overlay behavior

Same as current `service_unavailable`: show countdown timer with "Try Now" button. For 429 responses, read `Retry-After` header to set the countdown duration.

---

## Category 3: Terminal — developer misconfiguration (DEV)

These errors mean the OAuth client integration is misconfigured. **Redirecting to login will create an infinite loop** because login itself will fail with the same error.

| Error code | HTTP | Doc section | What is misconfigured |
|------------|------|-------------|----------------------|
| `invalid_client` | 401 / 302 | OAuth | Unknown `client_id` or client auth failed |
| `unauthorized_client` | 400 / 302 | OAuth | Client not allowed this grant type / response type |
| `unsupported_response_type` | 400 / 302 | OAuth | `response_type` not supported for this client |
| `unsupported_grant_type` | 400 | OAuth | `grant_type` not supported |
| `invalid_scope` | 400 | OAuth | Requested scope unknown or disallowed for client |
| `invalid_redirect_uri` | 400 | OAuth | `redirect_uri` cannot be parsed or not registered |
| `CLIENT_INACTIVE` | 403 | Tokens & sessions | OAuth client disabled in admin |
| `invalid_request` (BFF) | 400 | BFF proxy | Wrong HTTP method or malformed body |
| `cors_error` | 403 | Security | Origin not in server allowlist |

### Gap in current implementation

**No handling exists for this category.** These errors either:
- Fall through silently (400 status not intercepted)
- Get misclassified as `permission_denied` (403 status)
- Cause infinite redirect loops if the router guard triggers login

### Recommended overlay behavior

Terminal error page with message directed at the application developer, not the end user. Should display:
- The RFC 6749 `error` and `error_description` values (already present in backend responses)
- A "Contact the application developer" CTA
- No "Sign In" or "Retry" buttons — these would make things worse

The backend already hardcodes English messages for these in `pkg/httputil/oauth_errors.go` — reuse those strings.

---

## Category 4: Terminal — server/admin failure (ADMIN)

Server-side failures or account-level blocks that neither the user nor a login redirect can fix.

| Error code | HTTP | Doc section | What happened |
|------------|------|-------------|---------------|
| `server_error` | 500 / 302 | OAuth / BFF | Unhandled server failure |
| `INTERNAL_ERROR` | 500 | Tokens & sessions | Unexpected state (e.g., missing auth context) |
| `NOT_IMPLEMENTED` | 501 | Tokens & sessions | Endpoint disabled on server |
| `unknown_host` | 403 | BFF proxy | Host not in BFF allowlist |

### Special cases — user-facing but not self-fixable

| Error code | HTTP | Doc section | What the user should see |
|------------|------|-------------|-------------------------|
| `ACCOUNT_INACTIVE` | 403 | Tokens & sessions | "Your account has been disabled. Contact your administrator." |
| `INSUFFICIENT_PERMISSIONS` | 403 | Scope / RBAC | "You don't have access to this feature. Required scopes: {missing_scopes}." |

### Gap in current implementation

- `server_error` and `INTERNAL_ERROR` (500) have no overlay — they fail silently or bubble as unhandled promise rejections.
- `ACCOUNT_INACTIVE` (403) is misclassified as `permission_denied` with no useful message.
- `INSUFFICIENT_PERMISSIONS` (403) — same issue; the backend sends `required_scopes`, `missing_scopes`, `user_scopes` but none of this reaches the overlay.

### Recommended overlay behavior

Terminal error page with:
- `request_id` / `ref` for support correlation (the backend already appends `?ref=<request_id>` via `RedirectInternalError()`)
- A "Contact your administrator" CTA
- For `ACCOUNT_INACTIVE`: distinct message explaining the account is disabled
- For `INSUFFICIENT_PERMISSIONS`: show the missing scopes and a "Request access" or "Contact administrator" CTA
- No "Sign In" or "Retry" buttons

---

## Category 5: User-fixable inline (not overlay territory)

Form-level validation errors that belong to the consuming application's UI, not the auth library's error overlay.

| Error codes | Doc section | Handling |
|-------------|-------------|----------|
| `MISSING_CURRENT_PASSWORD`, `MISSING_NEW_PASSWORD`, `MISSING_PASSWORD` | Passwords & 2FA | Inline form validation |
| `INVALID_CURRENT_PASSWORD` | Passwords & 2FA | Inline form error |
| `WEAK_PASSWORD` | Passwords & 2FA | Inline form error |
| `MISSING_TOTP_CODE`, `INVALID_TOTP_CODE` | Passwords & 2FA | Inline form error |
| `MISSING_SETUP_TOKEN`, `INVALID_SETUP_TOKEN` | Passwords & 2FA | Restart 2FA enrollment flow |
| `NO_PROVISIONAL_SECRET` | Passwords & 2FA | Restart 2FA enrollment flow |
| `2FA_ALREADY_ENABLED` | Passwords & 2FA | Informational — show current state |
| `invalid_totp` | Passwords & 2FA | Inline login form error |
| `invalid_credentials` | Passwords & 2FA | Inline login form error |
| `email_not_found`, `email_exists`, `email_not_verified`, etc. | Email management | Inline form errors |
| `invalid_email`, `validation_failed` | Email management | Inline form errors |
| `payload_too_large` | Security | Inline — reduce input size |
| `MISSING_SESSION_ID`, `INVALID_SESSION_ID`, `SESSION_NOT_FOUND` | Tokens & sessions | Inline — session management UI |
| `invalid_request` (OAuth, user-caused) | OAuth | Inline — fix input params |
| `access_denied` | OAuth | Inline — user declined consent or account inactive |

The overlay should **not intercept** these. They should propagate to the calling code via rejected promises so the consuming app can render appropriate inline feedback.

---

## Summary of gaps

| Gap | Impact | Severity |
|-----|--------|----------|
| 403 errors not differentiated by error code | `REAUTH_REQUIRED` (fixable by login) treated same as `ACCOUNT_INACTIVE` (terminal) | High |
| No DEV error type | `invalid_client`, `invalid_scope` etc. can cause infinite redirect loops | High |
| No ADMIN error type | `server_error`, `INTERNAL_ERROR` fail silently — no user feedback | Medium |
| 429 not intercepted | Rate-limited users get no feedback or retry guidance | Medium |
| Known-transient 500s not retried | `LOGOUT_FAILED`, `SESSIONS_FETCH_FAILED` treated as terminal instead of showing retry UI | Low |
| `ACCOUNT_INACTIVE` has no distinct message | User sees generic "Permission denied" instead of "Account disabled" | Medium |
| `INSUFFICIENT_PERMISSIONS` drops scope details | Backend sends `missing_scopes` but overlay doesn't render them | Low |

---

## Proposed `AuthErrorType` expansion

```
Current:  session_expired | permission_denied | service_unavailable

Proposed: session_expired        — re-login will fix (Category 1)
          service_unavailable    — wait and retry (Category 2)
          dev_error              — client misconfiguration, terminal (Category 3)
          account_blocked        — account inactive or insufficient permissions (Category 4, user-facing)
          server_error           — unhandled server failure, terminal (Category 4, infra)
```

`permission_denied` would be removed — its current callers split into `session_expired` (for `REAUTH_REQUIRED`, `SESSION_COMPROMISED`) or `account_blocked` (for `ACCOUNT_INACTIVE`, `INSUFFICIENT_PERMISSIONS`).
