<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch, type Component } from 'vue'
import { useAuth } from '../composables/useAuth'
import { useAuthStore } from '../stores/auth'
import { getGlobalConfig } from '../config'
import { createLogger } from '@turnkeystaffing/get-native-vue-logger'
import {
  recordLoginAttempt,
  resetLoginAttempts,
  getCircuitBreakerResetAt,
  hasExceededTripCeiling,
  LOGIN_LOOP_DETECTED
} from '../utils/loginCircuitBreaker'
import SessionExpiredView from './views/SessionExpiredView.vue'
import ServiceUnavailableView from './views/ServiceUnavailableView.vue'
import LoginLoopView from './views/LoginLoopView.vue'
import DevErrorView from './views/DevErrorView.vue'
import AccountBlockedView from './views/AccountBlockedView.vue'
import ServerErrorView from './views/ServerErrorView.vue'
import PermissionDeniedView from './views/PermissionDeniedView.vue'

defineOptions({ name: 'AuthErrorBoundary' })

const logger = createLogger('AuthErrorBoundary')
const { error } = useAuth()
const authStore = useAuthStore()

const viewRef = ref<{ primaryAction: HTMLElement | null } | null>(null)
const overlayRoot = ref<HTMLElement | null>(null)

// The login-redirect circuit breaker reports as `service_unavailable` but
// carries the `login_loop_detected` code so it can be told apart from a genuine
// server outage / 429 (which keeps the wait-and-retry UX).
const isLoginLoop = computed(
  () => error.value?.type === 'service_unavailable' && error.value?.code === LOGIN_LOOP_DETECTED
)

const activeView = computed<Component | null>(() => {
  const type = error.value?.type
  const config = getGlobalConfig()
  if (!config) return null
  if (type === 'session_expired') {
    return config.errorViews.sessionExpired ?? SessionExpiredView
  }
  if (type === 'service_unavailable') {
    if (isLoginLoop.value) {
      return config.errorViews.loginLoop ?? LoginLoopView
    }
    return config.errorViews.serviceUnavailable ?? ServiceUnavailableView
  }
  if (type === 'dev_error') {
    return config.errorViews.devError ?? DevErrorView
  }
  if (type === 'account_blocked') {
    return config.errorViews.accountBlocked ?? AccountBlockedView
  }
  if (type === 'server_error') {
    return config.errorViews.serverError ?? ServerErrorView
  }
  if (type === 'permission_denied') {
    return config.errorViews.permissionDenied ?? PermissionDeniedView
  }
  return null
})

const viewProps = computed(() => {
  const currentError = error.value
  const config = getGlobalConfig()
  if (!currentError || !config) return null
  if (currentError.type === 'session_expired') {
    return {
      error: currentError,
      onSignIn: handleSignIn,
      config
    }
  }
  if (currentError.type === 'service_unavailable') {
    if (isLoginLoop.value) {
      return {
        error: currentError,
        onSignIn: handleSignIn,
        onSignOut: handleLoginLoopSignOut,
        cooldownEndsAt: getCircuitBreakerResetAt(),
        config
      }
    }
    return {
      error: currentError,
      onRetry: handleRetry,
      config
    }
  }
  if (currentError.type === 'dev_error') {
    return {
      error: currentError,
      onSignOut: handleSignOut,
      config
    }
  }
  if (currentError.type === 'account_blocked') {
    return {
      error: currentError,
      onSignOut: handleSignOut,
      config
    }
  }
  if (currentError.type === 'server_error') {
    return {
      error: currentError,
      config
    }
  }
  if (currentError.type === 'permission_denied') {
    return {
      error: currentError,
      config
    }
  }
  return null
})

async function handleSignIn() {
  if (!recordLoginAttempt()) {
    // Persistent loop — escalate to a clean logout that clears the stale BFF
    // session that keeps re-driving the bounce, instead of looping forever.
    if (hasExceededTripCeiling()) {
      logger.error('Login loop trip ceiling exceeded; forcing clean logout')
      await handleLoginLoopSignOut()
      return
    }

    // Breaker tripped: surface the cooldown/recovery view rather than swapping
    // to a dead-end service_unavailable. The login-loop view disables sign-in
    // until the cooldown elapses and always offers a sign-out escape.
    logger.warn('Login redirect circuit breaker tripped; showing cooldown')
    authStore.setError({
      type: 'service_unavailable',
      code: LOGIN_LOOP_DETECTED,
      message: 'Too many sign-in attempts. Wait a moment, then try again or sign out.'
    })
    return
  }

  logger.info('User initiated re-authentication')

  try {
    const returnUrl = window.location.href
    authStore.login(returnUrl)
  } catch (err) {
    logger.error('Failed to initiate login redirect', err)
  }
}

/**
 * Explicit escape from the login-loop view: clear the breaker first so the
 * forced logout can't immediately re-trip it, then sign out (which revokes the
 * stale BFF session and lands on a clean Central Login).
 */
async function handleLoginLoopSignOut() {
  logger.info('User initiated sign-out from login-loop view')
  resetLoginAttempts()
  try {
    await authStore.logout()
  } catch (err) {
    logger.error('Sign-out failed from login-loop view', err)
  } finally {
    // Safety net for test environments where logout doesn't redirect; in real
    // usage authStore.logout() triggers a full page redirect and this is a noop.
    authStore.clearError()
  }
}

async function handleSignOut() {
  logger.info('User initiated sign-out from terminal view')
  try {
    await authStore.logout()
  } catch (err) {
    logger.error('Sign-out failed from terminal view', err)
  } finally {
    // Safety net for test environments where logout doesn't redirect; in real
    // usage authStore.logout() triggers a full page redirect and this is a noop.
    authStore.clearError()
  }
}

function handleDismiss() {
  logger.info('User dismissed error overlay', { type: error.value?.type })
  authStore.clearError()
}

async function handleRetry() {
  logger.info('Attempting auth service retry')
  try {
    await authStore.initAuth()

    if (authStore.isAuthenticated) {
      authStore.clearError()
      logger.info('Auth retry successful, user authenticated')
    } else if (!authStore.hasError) {
      authStore.setError({
        type: 'session_expired',
        message: 'Your session has ended. Sign in again to continue.'
      })
      logger.info('Auth service reachable but session invalid')
    }
  } catch (err) {
    logger.warn('Auth service retry failed', err)
  }
}

let previousBodyOverflow: string | null = null
let previouslyFocused: HTMLElement | null = null

function lockScroll() {
  if (previousBodyOverflow !== null) return
  previousBodyOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
}

function unlockScroll() {
  if (previousBodyOverflow === null) return
  document.body.style.overflow = previousBodyOverflow
  previousBodyOverflow = null
}

function captureFocus() {
  previouslyFocused = (document.activeElement as HTMLElement | null) ?? null
}

function restoreFocus() {
  if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
    try {
      previouslyFocused.focus()
    } catch {
      /* noop */
    }
  }
  previouslyFocused = null
}

function getFocusableElements(): HTMLElement[] {
  const root = overlayRoot.value
  if (!root) return []
  const selector =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  return Array.from(root.querySelectorAll<HTMLElement>(selector))
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key !== 'Tab') return
  const focusable = getFocusableElements()
  if (focusable.length === 0) {
    event.preventDefault()
    return
  }
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  const active = document.activeElement as HTMLElement | null
  if (event.shiftKey) {
    if (active === first || active === null || !overlayRoot.value?.contains(active)) {
      event.preventDefault()
      last.focus()
    }
  } else {
    if (active === last || active === null || !overlayRoot.value?.contains(active)) {
      event.preventDefault()
      first.focus()
    }
  }
}

async function focusPrimaryAction() {
  await nextTick()
  const exposedEl = viewRef.value?.primaryAction as HTMLElement | null | undefined
  if (exposedEl && typeof exposedEl.focus === 'function') {
    exposedEl.focus()
    return
  }
  // Fallback for consumer-provided views that don't expose `primaryAction`.
  const fallback = getFocusableElements()[0]
  if (fallback) fallback.focus()
}

watch(
  () => activeView.value !== null,
  (visible, wasVisible) => {
    if (visible && !wasVisible) {
      captureFocus()
      lockScroll()
      void focusPrimaryAction()
    } else if (!visible && wasVisible) {
      unlockScroll()
      restoreFocus()
    }
  },
  { immediate: true }
)

watch(
  () => error.value?.type,
  () => {
    if (activeView.value) {
      void focusPrimaryAction()
    }
  }
)

onBeforeUnmount(() => {
  unlockScroll()
  restoreFocus()
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="activeView && viewProps"
      ref="overlayRoot"
      class="bff-auth-overlay-root"
      @keydown="handleKeydown"
    >
      <component
        :is="activeView"
        ref="viewRef"
        v-bind="viewProps"
        @dismiss="handleDismiss"
      />
    </div>
  </Teleport>
</template>

<style scoped>
.bff-auth-overlay-root {
  display: contents;
}
</style>
