/**
 * AuthErrorBoundary Unit Tests
 *
 * Covers state-driven view selection, Teleport behavior, body scroll lock,
 * consumer view overrides, and the onSignIn / onRetry wiring into the auth
 * store + login circuit breaker.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import AuthErrorBoundary from '../AuthErrorBoundary.vue'
import { useAuthStore } from '../../stores/auth'
import { setGlobalConfig, getGlobalConfig } from '../../config'
import { resetLoginAttempts } from '../../utils/loginCircuitBreaker'
import type { BffAuthConfig } from '../../types/config'

vi.mock('@turnkeystaffing/get-native-vue-logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

vi.mock('../../services/auth', () => ({
  authService: {
    checkAuth: vi.fn(),
    getAccessToken: vi.fn(),
    login: vi.fn(),
    logout: vi.fn()
  },
  AuthConfigurationError: class AuthConfigurationError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'AuthConfigurationError'
    }
  }
}))

const IconStub = defineComponent({
  name: 'IconStub',
  render: () => h('span', { 'data-testid': 'icon-stub' })
})

function installConfig(overrides: Partial<BffAuthConfig> = {}) {
  const config: BffAuthConfig = {
    bffBaseUrl: 'http://localhost:8080',
    clientId: 'test-client',
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as any,
    icons: {
      sessionExpired: IconStub,
      login: IconStub,
      serviceUnavailable: IconStub,
      retry: IconStub,
      devError: IconStub,
      accountBlocked: IconStub,
      serverError: IconStub,
      signOut: IconStub
    },
    errorViews: {},
    text: {},
    mode: 'token',
    ...overrides
  }
  setGlobalConfig(config)
  return config
}

describe('AuthErrorBoundary', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetLoginAttempts()
    document.body.innerHTML = ''
    document.body.style.overflow = ''
    installConfig()
  })

  afterEach(() => {
    document.body.style.overflow = ''
  })

  it('renders nothing when there is no error', async () => {
    mount(AuthErrorBoundary, { attachTo: document.body })
    await nextTick()

    expect(document.querySelector('[data-testid="session-expired-view"]')).toBeNull()
    expect(document.querySelector('[data-testid="service-unavailable-view"]')).toBeNull()
    expect(document.body.style.overflow).toBe('')
  })

  it('renders DevErrorView when error.type is dev_error', async () => {
    mount(AuthErrorBoundary, { attachTo: document.body })
    const store = useAuthStore()
    store.setError({ type: 'dev_error', message: 'bad client', code: 'invalid_client' })
    await nextTick()

    expect(document.querySelector('[data-testid="dev-error-view"]')).not.toBeNull()
  })

  it('renders AccountBlockedView when error.type is account_blocked', async () => {
    mount(AuthErrorBoundary, { attachTo: document.body })
    const store = useAuthStore()
    store.setError({
      type: 'account_blocked',
      message: 'inactive',
      code: 'account_inactive'
    })
    await nextTick()

    expect(document.querySelector('[data-testid="account-blocked-view"]')).not.toBeNull()
  })

  it('renders ServerErrorView when error.type is server_error', async () => {
    mount(AuthErrorBoundary, { attachTo: document.body })
    const store = useAuthStore()
    store.setError({
      type: 'server_error',
      message: 'boom',
      code: 'internal_error'
    })
    await nextTick()

    expect(document.querySelector('[data-testid="server-error-view"]')).not.toBeNull()
  })

  it('renders SessionExpiredView via Teleport when error.type is session_expired', async () => {
    mount(AuthErrorBoundary, { attachTo: document.body })
    const store = useAuthStore()
    store.setError({ type: 'session_expired', message: 'gone' })
    await nextTick()

    const view = document.querySelector('[data-testid="session-expired-view"]')
    expect(view).not.toBeNull()
    // Teleported to body: the overlay root is a direct child of body, and the view sits inside it.
    const overlayRoot = document.body.querySelector('.bff-auth-overlay-root')
    expect(overlayRoot?.parentElement).toBe(document.body)
    expect(overlayRoot?.contains(view!)).toBe(true)
  })

  it('renders ServiceUnavailableView when error.type is service_unavailable', async () => {
    mount(AuthErrorBoundary, { attachTo: document.body })
    const store = useAuthStore()
    store.setError({ type: 'service_unavailable', message: '503' })
    await nextTick()

    expect(document.querySelector('[data-testid="service-unavailable-view"]')).not.toBeNull()
  })

  it('invokes authStore.logout when Sign out is clicked from AccountBlockedView', async () => {
    mount(AuthErrorBoundary, { attachTo: document.body })
    const store = useAuthStore()
    const logoutSpy = vi.spyOn(store, 'logout').mockResolvedValue(undefined)

    store.setError({
      type: 'account_blocked',
      message: 'inactive',
      code: 'account_inactive'
    })
    await nextTick()

    const button = document.querySelector<HTMLButtonElement>(
      '[data-testid="account-blocked-sign-out-button"]'
    )
    expect(button).not.toBeNull()
    button!.click()
    await nextTick()

    expect(logoutSpy).toHaveBeenCalledTimes(1)
  })

  it('invokes authStore.logout when Sign out is clicked from DevErrorView', async () => {
    mount(AuthErrorBoundary, { attachTo: document.body })
    const store = useAuthStore()
    const logoutSpy = vi.spyOn(store, 'logout').mockResolvedValue(undefined)

    store.setError({
      type: 'dev_error',
      message: 'bad client',
      code: 'invalid_client'
    })
    await nextTick()

    const button = document.querySelector<HTMLButtonElement>(
      '[data-testid="dev-error-sign-out-button"]'
    )
    expect(button).not.toBeNull()
    button!.click()
    await nextTick()

    expect(logoutSpy).toHaveBeenCalledTimes(1)
  })

  it('locks body scroll while an error view is visible and restores on clear', async () => {
    document.body.style.overflow = 'scroll'
    mount(AuthErrorBoundary, { attachTo: document.body })
    const store = useAuthStore()

    store.setError({ type: 'session_expired', message: '' })
    await nextTick()
    expect(document.body.style.overflow).toBe('hidden')

    store.clearError()
    await nextTick()
    expect(document.body.style.overflow).toBe('scroll')
  })

  it('invokes authStore.login with current URL when Sign In is clicked', async () => {
    mount(AuthErrorBoundary, { attachTo: document.body })
    const store = useAuthStore()
    const loginSpy = vi.spyOn(store, 'login').mockImplementation(() => {})

    store.setError({ type: 'session_expired', message: '' })
    await nextTick()

    const button = document.querySelector<HTMLButtonElement>(
      '[data-testid="session-expired-sign-in-button"]'
    )
    expect(button).not.toBeNull()
    button!.click()
    await nextTick()

    expect(loginSpy).toHaveBeenCalledTimes(1)
    expect(loginSpy).toHaveBeenCalledWith(window.location.href)
  })

  it('trips to service_unavailable when the login circuit breaker blocks the redirect', async () => {
    const { recordLoginAttempt } = await import('../../utils/loginCircuitBreaker')
    // Default threshold is 3; consume all three before mounting so the first
    // in-view click trips the breaker.
    recordLoginAttempt()
    recordLoginAttempt()
    recordLoginAttempt()

    mount(AuthErrorBoundary, { attachTo: document.body })
    const store = useAuthStore()
    const loginSpy = vi.spyOn(store, 'login').mockImplementation(() => {})

    store.setError({ type: 'session_expired', message: '' })
    await nextTick()

    document
      .querySelector<HTMLButtonElement>('[data-testid="session-expired-sign-in-button"]')!
      .click()
    await nextTick()

    expect(loginSpy).not.toHaveBeenCalled()
    expect(store.error?.type).toBe('service_unavailable')
  })

  it('renders a consumer-provided sessionExpired view with stable props', async () => {
    const CustomView = defineComponent({
      name: 'CustomSessionExpired',
      props: {
        error: { type: Object as any, required: true },
        onSignIn: { type: Function as any, required: true },
        config: { type: Object as any, required: true }
      },
      render() {
        return h('div', { 'data-testid': 'custom-session-expired' }, [
          h('span', {}, (this.error as any).message),
          h(
            'button',
            {
              'data-testid': 'custom-sign-in',
              onClick: () => (this.onSignIn as () => void)()
            },
            'Custom sign in'
          )
        ])
      }
    })

    installConfig({ errorViews: { sessionExpired: CustomView } })
    mount(AuthErrorBoundary, { attachTo: document.body })
    const store = useAuthStore()
    const loginSpy = vi.spyOn(store, 'login').mockImplementation(() => {})

    store.setError({ type: 'session_expired', message: 'custom!' })
    await nextTick()

    expect(document.querySelector('[data-testid="custom-session-expired"]')).not.toBeNull()
    expect(document.querySelector('[data-testid="session-expired-view"]')).toBeNull()

    document.querySelector<HTMLButtonElement>('[data-testid="custom-sign-in"]')!.click()
    await nextTick()
    expect(loginSpy).toHaveBeenCalledWith(window.location.href)
  })

  it('exposes getGlobalConfig() to test that plugin config is installed', () => {
    expect(getGlobalConfig()).not.toBeNull()
  })

  it('traps Tab focus within the overlay root', async () => {
    mount(AuthErrorBoundary, { attachTo: document.body })
    const store = useAuthStore()
    store.setError({ type: 'session_expired', message: '' })
    await nextTick()

    const root = document.body.querySelector<HTMLElement>('.bff-auth-overlay-root')
    expect(root).not.toBeNull()
    const button = root!.querySelector<HTMLButtonElement>(
      '[data-testid="session-expired-sign-in-button"]'
    )
    expect(button).not.toBeNull()

    // Tab from the only focusable element should wrap to itself (single-item trap).
    button!.focus()
    expect(document.activeElement).toBe(button)
    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    root!.dispatchEvent(tabEvent)
    expect(tabEvent.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(button)
  })

  it('uses the fixed 30s default countdown for service_unavailable', async () => {
    mount(AuthErrorBoundary, { attachTo: document.body })
    const store = useAuthStore()
    store.setError({
      type: 'service_unavailable',
      message: '503'
    })
    await nextTick()

    const countdown = document.querySelector('[data-testid="countdown-text"]')
    expect(countdown?.textContent).toContain('Retry in 30s')
  })
})
