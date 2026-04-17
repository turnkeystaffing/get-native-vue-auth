# HTTP Error Codes — Catalog by Domain & Recoverability

Sources: `pkg/httputil/oauth_errors.go` (RFC 6749), `internal/auth/gateway/shared/error_codes.go` (auth API constants),
`internal/auth/gateway/validation/error_mapping.go` (validation map), plus per-handler emissions.

## Recoverability legend

- **USER** — user can fix by re-entering input / retrying. Show inline error, let them continue.
- **AUTH** — session-level problem. Force re-login, then flow resumes.
- **WAIT** — transient infra/rate limit. Auto-retry with backoff / tell user to try again shortly.
- **DEV** — caller (the app integrating OAuth) misconfigured. Message should point at the app developer, not the end
  user.
- **ADMIN** — server/config failure. Terminal state, show error page with request_id and "contact administrator".

---

## 1. OAuth / authorization (RFC 6749, lowercase)

`pkg/httputil/oauth_errors.go`, emitted from `internal/auth/gateway/oauth/*.go` and `internal/bff/gateway/http/*.go`.

| error                       | HTTP            | Recoverability | Trigger                                                                       |
|-----------------------------|-----------------|----------------|-------------------------------------------------------------------------------|
| `invalid_request`           | 400 / 302       | USER           | Missing/malformed params, wrong HTTP method                                   |
| `invalid_client`            | 401 / 302       | DEV            | Client auth failed, unknown client_id                                         |
| `unauthorized_client`       | 400 / 302       | DEV            | Client not allowed this grant type / response type                            |
| `unsupported_response_type` | 400 / 302       | DEV            | response_type not supported                                                   |
| `unsupported_grant_type`    | 400             | DEV            | grant_type not supported                                                      |
| `invalid_scope`             | 400             | DEV            | Requested scope unknown/disallowed for client                                 |
| `access_denied`             | 401 / 403 / 302 | USER           | User declined consent, or inactive account (auth_middleware)                  |
| `invalid_grant`             | 400             | AUTH           | Authorization code expired/revoked/used, redirect_uri mismatch, session stale |
| `server_error`              | 500 / 302       | ADMIN          | Unhandled server failure in token/authorize/grant                             |
| `temporarily_unavailable`   | 503             | WAIT           | Overload / maintenance (rarely emitted directly; rate-limit path)             |
| `invalid_redirect_uri`      | 400             | DEV            | Fallback when redirect_uri cannot be parsed                                   |

## 2. Authentication API — tokens & sessions (UPPER_CASE)

`internal/auth/gateway/auth/*.go`, `internal/auth/gateway/oauth/middleware.go`.

| error                   | HTTP | Recoverability | Trigger                                                   |
|-------------------------|------|----------------|-----------------------------------------------------------|
| `MISSING_TOKEN`         | 400  | AUTH           | Authorization header absent                               |
| `INVALID_TOKEN`         | 401  | AUTH           | JWT malformed / bad signature / expired / blacklisted     |
| `INVALID_USER_ID`       | 400  | AUTH           | Token `sub` claim not a UUID                              |
| `USER_NOT_FOUND`        | 404  | AUTH           | Token valid but user gone                                 |
| `ACCOUNT_INACTIVE`      | 403  | ADMIN (user)   | Account disabled — user must contact admin                |
| `CLIENT_INACTIVE`       | 403  | DEV            | OAuth client disabled                                     |
| `MISSING_REFRESH_TOKEN` | 400  | AUTH           | refresh_token not in body                                 |
| `INVALID_REFRESH_TOKEN` | 401  | AUTH           | Refresh token invalid / revoked / rotated / user inactive |
| `LOGOUT_FAILED`         | 500  | WAIT           | Session terminate failed (often Redis transient)          |
| `REAUTH_REQUIRED`       | 403  | AUTH           | Sudo/high-privilege op requires fresh login               |
| `SESSION_COMPROMISED`   | 403  | AUTH           | Suspicious activity → force re-login                      |
| `SESSIONS_FETCH_FAILED` | 500  | WAIT           | DB read error listing sessions                            |
| `MISSING_SESSION_ID`    | 400  | USER           | Missing session_id path param                             |
| `INVALID_SESSION_ID`    | 400  | USER           | session_id not a UUID                                     |
| `SESSION_NOT_FOUND`     | 404  | USER           | Already revoked / unknown id                              |
| `REVOKE_FAILED`         | 500  | WAIT           | Session revocation DB error                               |
| `FORBIDDEN`             | 403  | AUTH           | Cross-user action denied                                  |
| `INTERNAL_ERROR`        | 500  | ADMIN          | Unexpected state (e.g., missing auth context)             |
| `NOT_IMPLEMENTED`       | 501  | ADMIN          | Endpoint disabled                                         |
| `SERVICE_UNAVAILABLE`   | 503  | WAIT           | Dependency down                                           |

## 3. Passwords & 2FA

`internal/auth/gateway/auth/change_password_handler.go`, `two_factor_handler.go`, `password_reset_handler.go`,
`credential_handler.go`.

| error                                                                    | HTTP      | Recoverability | Trigger                                              |
|--------------------------------------------------------------------------|-----------|----------------|------------------------------------------------------|
| `MISSING_CURRENT_PASSWORD` / `MISSING_NEW_PASSWORD` / `MISSING_PASSWORD` | 400       | USER           | Empty field                                          |
| `INVALID_CURRENT_PASSWORD`                                               | 401       | USER           | Current password mismatch                            |
| `WEAK_PASSWORD`                                                          | 400       | USER           | Too short / doesn't meet policy                      |
| `PASSWORD_CHANGE_ERROR`                                                  | 500       | WAIT           | DB write failure                                     |
| `MISSING_TOTP_CODE` / `INVALID_TOTP_CODE`                                | 400       | USER           | Code missing / not 6 digits / wrong value            |
| `MISSING_SETUP_TOKEN` / `INVALID_SETUP_TOKEN`                            | 400 / 401 | USER           | 2FA enroll token absent/expired → restart enrollment |
| `NO_PROVISIONAL_SECRET`                                                  | 400       | USER           | Tried to verify before /setup was called             |
| `2FA_ALREADY_ENABLED`                                                    | 400       | USER (info)    | Idempotent; show current state                       |
| `RESEND_EMAIL_FAILED` / `RESEND_EMAIL_ERROR`                             | 400 / 500 | WAIT           | SMTP transient                                       |
| `2FA_SETUP_ERROR` / `2FA_VERIFY_ERROR`                                   | 500       | WAIT           | Backing service failure                              |
| `invalid_totp` (lowercase)                                               | 401       | USER           | Login-time TOTP mismatch (OAuth-style path)          |
| `invalid_credentials`                                                    | 401       | USER           | Login password wrong                                 |

## 4. Email management

`internal/auth/gateway/auth/email_handler.go`.

| error                                                                            | HTTP | Recoverability | Trigger                                     |
|----------------------------------------------------------------------------------|------|----------------|---------------------------------------------|
| `email_not_found`                                                                | 404  | USER           | Email not on account                        |
| `email_exists`                                                                   | 409  | USER           | Already present on this/another user        |
| `email_not_verified`                                                             | 409  | USER           | Verify first, then retry                    |
| `email_already_verified`                                                         | 409  | USER (info)    | No-op                                       |
| `invalid_token`                                                                  | 404  | USER           | Verification link expired → request new one |
| `cannot_remove_primary` / `cannot_remove_last` / `cannot_set_primary_unverified` | 409  | USER           | Remove/change another email first           |
| `invalid_password`                                                               | 403  | USER           | Confirm-password mismatch                   |
| `invalid_email` / `validation_failed`                                            | 400  | USER           | Format rejected                             |
| `max_emails_exceeded`                                                            | 409  | USER           | Remove one before adding                    |

## 5. BFF proxy (SPA-facing)

`internal/bff/gateway/http/*.go`.

| error             | HTTP      | Recoverability | Trigger                                             |
|-------------------|-----------|----------------|-----------------------------------------------------|
| `invalid_request` | 400       | DEV            | Wrong method / malformed body                       |
| `invalid_session` | 401       | AUTH           | Session cookie missing/expired → redirect to /login |
| `server_error`    | 500 / 302 | ADMIN          | Upstream auth-service call failed                   |
| `logout_failed`   | 500       | WAIT           | Upstream logout failed                              |
| `unknown_host`    | 403       | ADMIN          | Host not in BFF allowlist (misconfig)               |

## 6. Scope / RBAC

`internal/auth/gateway/scope_middleware.go`.

| error                      | HTTP | Recoverability | Trigger                                                                                                          |
|----------------------------|------|----------------|------------------------------------------------------------------------------------------------------------------|
| `INSUFFICIENT_PERMISSIONS` | 403  | ADMIN (user)   | Response includes `required_scopes`, `missing_scopes`, `user_scopes` — user cannot self-fix, must request access |

## 7. Rate limiting

`pkg/ratelimiter/middleware.go`, `internal/auth/gateway/shared/ratelimit_handler.go`.

| error                 | HTTP      | Recoverability | Trigger                                                                          |
|-----------------------|-----------|----------------|----------------------------------------------------------------------------------|
| `rate_limit_exceeded` | 429 / 302 | WAIT           | Per-client or per-IP limit hit. `Retry-After` + `X-RateLimit-*` headers included |

## 8. Security middleware

`pkg/security/middleware.go`.

| error               | HTTP | Recoverability | Trigger                 |
|---------------------|------|----------------|-------------------------|
| `payload_too_large` | 413  | USER           | Body + query > 8 KB     |
| `cors_error`        | 403  | DEV            | Origin not in allowlist |

## 9. Generic validation

`validation/error_mapping.go` default. Unmapped validation errors → `INVALID_REQUEST` / `invalid_request` (400) — **USER
** recoverable.

---

## UX routing recommendation

- **USER / AUTH / WAIT** → inline toast or banner; user stays in the flow. AUTH routes back to /login with
  `error_description`; WAIT auto-retries with backoff and surfaces the banner only after N failures.
- **DEV** → terminal page with the RFC 6749 description plus "Contact the application developer" (this is what
  `pkg/httputil/oauth_errors.go` already hardcodes in the English message column — re-use those strings).
- **ADMIN** → terminal page with `request_id` for correlation. The existing `RedirectInternalError()` already appends
  `?ref=<request_id>` for this purpose (`pkg/httputil/response.go:155`) — the frontend error page just needs to render
  the ref and the "contact administrator" CTA.

The two terminal buckets (DEV vs ADMIN) already have different natural audiences, so I'd suggest two distinct terminal
templates rather than one. Everything else is a banner.