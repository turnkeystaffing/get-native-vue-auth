# Deferred Work

Findings surfaced during review that are **not caused by** the current story but are worth addressing in future focused work.

## 2026-04-17 — from spec-remove-vuetify-error-overlay.md review

- **`docs/project-scan-report.json` is stale.** The file still reflects a mid-workflow scanner snapshot (`current_step: "step_2"`, outputs list truncated) even though the `docs/` tree has long-since contained the full generated architecture/component-inventory/source-tree content. Pre-existing inconsistency that was incidentally edited in this story (Vuetify→Pinia framework field). Fix: re-run the project-scanner and overwrite the report, or delete it if no longer authoritative. Not blocking this ship.
- **Login circuit breaker has no session-wide ceiling.** `recordLoginAttempt()` increments unbounded while the breaker is tripped — each Sign-In click past the threshold still writes to `sessionStorage` even though the redirect is blocked. Within the 2-minute window this is bounded by user clicks, and the state self-expires, so it's not a leak, but a hard ceiling would be defensive. Pre-existing; not in this story's scope.
- **No SSR guards around `document.body.style` and `document.activeElement`.** Plugin is documented as client-side; no consumer has reported SSR usage. Worth revisiting if SSR support is ever requested.
