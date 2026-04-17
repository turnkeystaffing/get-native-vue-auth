<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch, type Component } from 'vue'
import { useAuth } from '../composables/useAuth'
import { useAuthStore } from '../stores/auth'
import { getGlobalConfig } from '../config'
import { createLogger } from '@turnkeystaffing/get-native-vue-logger'
import { recordLoginAttempt } from '../utils/loginCircuitBreaker'
import SessionExpiredView from './views/SessionExpiredView.vue'
import ServiceUnavailableView from './views/ServiceUnavailableView.vue'
import DevErrorView from './views/DevErrorView.vue'
import AccountBlockedView from './views/AccountBlockedView.vue'
import ServerErrorView from './views/ServerErrorView.vue'

defineOptions({ name: 'AuthErrorBoundary' })

const logger = createLogger('AuthErrorBoundary')
const { error } = useAuth()
const authStore = useAuthStore()

const viewRef = ref<{ primaryAction: HTMLElement | null } | null>(null)
const overlayRoot = ref<HTMLElement | null>(null)

const activeView = computed<Component | null>(() => {
  const type = error.value?.type
  const config = getGlobalConfig()
  if (!config) return null
  if (type === 'session_expired') {
    return config.errorViews.sessionExpired ?? SessionExpiredView
  }
  if (type === 'service_unavailable') {
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
  return null
})

function handleSignIn() {
  if (!recordLoginAttempt()) {
    logger.warn('Login redirect circuit breaker tripped from session expired view')
    authStore.setError({
      type: 'service_unavailable',
      message: 'Too many login attempts. Authentication service may be unavailable.'
    })
    return
  }

  logger.info('User initiated re-authentication from session expired view')

  try {
    const returnUrl = window.location.href
    authStore.login(returnUrl)
  } catch (err) {
    logger.error('Failed to initiate login redirect', err)
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
  logger.info('User dismissed server_error overlay')
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
