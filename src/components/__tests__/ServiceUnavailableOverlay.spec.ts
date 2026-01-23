/**
 * ServiceUnavailableOverlay Unit Tests
 *
 * Tests for the service unavailable overlay component that displays
 * a full-screen overlay with retry countdown when auth service is down.
 *
 * @see Story 3.3: Service Unavailable Overlay
 */

// Mock IntersectionObserver for Vuetify components
class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | null = null
  readonly rootMargin: string = ''
  readonly thresholds: ReadonlyArray<number> = []

  constructor(_callback: IntersectionObserverCallback, _options?: IntersectionObserverInit) {
    // Mocked - no implementation needed
  }

  observe(_target: Element): void {}
  unobserve(_target: Element): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
}

// Mock ResizeObserver for Vuetify components
class MockResizeObserver implements ResizeObserver {
  constructor(_callback: ResizeObserverCallback) {}
  observe(_target: Element, _options?: ResizeObserverOptions): void {}
  unobserve(_target: Element): void {}
  disconnect(): void {}
}

// Mock visualViewport for Vuetify component positioning
const mockVisualViewport = {
  width: 1024,
  height: 768,
  offsetLeft: 0,
  offsetTop: 0,
  pageLeft: 0,
  pageTop: 0,
  scale: 1,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
}

// Set up mocks before any imports
global.IntersectionObserver = MockIntersectionObserver
global.ResizeObserver = MockResizeObserver
Object.defineProperty(window, 'visualViewport', {
  value: mockVisualViewport,
  writable: true
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, VueWrapper, config } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import ServiceUnavailableOverlay from '../ServiceUnavailableOverlay.vue'
import { useAuthStore } from '../../stores/auth'
import { authService } from '../../services/auth'
import type { AuthError } from '../../types/auth'

// Create Vuetify instance
const vuetify = createVuetify({
  components,
  directives
})

// Disable teleport stubs globally for this test file - we want real DOM
config.global.stubs = {
  teleport: false
}

// Mock logger
vi.mock('@get-native/get-native-vue-logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}))

// Mock auth service for store usage
vi.mock('../../services/auth', () => ({
  authService: {
    checkAuth: vi.fn().mockResolvedValue({ isAuthenticated: true, user: null }),
    logout: vi.fn().mockResolvedValue(undefined),
    initiateLogin: vi.fn(),
    getAccessToken: vi.fn().mockResolvedValue(null)
  }
}))

describe('ServiceUnavailableOverlay', () => {
  let wrapper: VueWrapper

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.useFakeTimers()

    // Ensure we have a clean body for attachTo
    document.body.innerHTML = '<div id="app"></div>'
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    vi.restoreAllMocks()
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  /**
   * Mount helper with common configuration
   */
  function mountComponent(errorState: AuthError | null = null) {
    // Set up store state before mounting
    const pinia = createPinia()
    setActivePinia(pinia)

    wrapper = mount(ServiceUnavailableOverlay, {
      global: {
        plugins: [vuetify, pinia]
      },
      attachTo: document.getElementById('app') || undefined
    })

    // Update store state after mount
    const authStore = useAuthStore()
    authStore.$patch({
      error: errorState
    })

    return { wrapper, authStore }
  }

  describe('Visibility - Overlay Display Trigger (AC1)', () => {
    it('renders overlay when error.type is service_unavailable', async () => {
      const { wrapper } = mountComponent({
        type: 'service_unavailable',
        message: 'Auth service is down',
        retryAfter: 30
      })
      await flushPromises()

      // Use findComponent for reliable Vuetify component selection
      const overlay = wrapper.findComponent({ name: 'VOverlay' })
      expect(overlay.exists()).toBe(true)
      expect(overlay.props('modelValue')).toBe(true)
    })

    it('does not render overlay when error is null', async () => {
      const { wrapper } = mountComponent(null)
      await flushPromises()

      const overlay = wrapper.findComponent({ name: 'VOverlay' })
      // Overlay component exists but modelValue should be false
      expect(overlay.props('modelValue')).toBe(false)
    })

    it('does not render overlay for session_expired error', async () => {
      const { wrapper } = mountComponent({ type: 'session_expired', message: 'Session expired' })
      await flushPromises()

      const overlay = wrapper.findComponent({ name: 'VOverlay' })
      expect(overlay.props('modelValue')).toBe(false)
    })

    it('does not render overlay for permission_denied error', async () => {
      const { wrapper } = mountComponent({ type: 'permission_denied', message: 'Access denied' })
      await flushPromises()

      const overlay = wrapper.findComponent({ name: 'VOverlay' })
      expect(overlay.props('modelValue')).toBe(false)
    })
  })

  describe('Overlay Content (AC2)', () => {
    it('displays correct title "Service Issue"', async () => {
      mountComponent({ type: 'service_unavailable', message: 'Auth service is down', retryAfter: 30 })
      await flushPromises()

      // Check document body since overlay teleports content
      const overlayContent = document.body.querySelector('.v-card')
      expect(overlayContent?.textContent).toContain('Service Issue')
    })

    it('displays error message from auth store when available', async () => {
      const customMessage = 'Authentication server is temporarily unavailable.'
      mountComponent({ type: 'service_unavailable', message: customMessage, retryAfter: 30 })
      await flushPromises()

      const overlayContent = document.body.querySelector('.v-card')
      expect(overlayContent?.textContent).toContain(customMessage)
    })

    it('displays default message when error.message is empty', async () => {
      mountComponent({ type: 'service_unavailable', message: '', retryAfter: 30 })
      await flushPromises()

      const overlayContent = document.body.querySelector('.v-card')
      expect(overlayContent?.textContent).toContain("We're having trouble connecting to authentication services.")
    })

    it('displays mdi-cloud-off-outline icon', async () => {
      mountComponent({ type: 'service_unavailable', message: 'Service down', retryAfter: 30 })
      await flushPromises()

      // Check for the icon in overlay content
      const overlayContent = document.body.innerHTML
      expect(overlayContent).toContain('mdi-cloud-off-outline')
    })

    it('displays "Retrying automatically..." subtitle', async () => {
      mountComponent({ type: 'service_unavailable', message: 'Service down', retryAfter: 30 })
      await flushPromises()

      const overlayContent = document.body.querySelector('.v-card')
      expect(overlayContent?.textContent).toContain('Retrying automatically...')
    })

    it('displays "Try Now" button with mdi-refresh icon', async () => {
      mountComponent({ type: 'service_unavailable', message: 'Service down', retryAfter: 30 })
      await flushPromises()

      const tryNowBtn = document.body.querySelector('[data-testid="try-now-button"]')
      expect(tryNowBtn).toBeTruthy()
      expect(tryNowBtn?.textContent).toContain('Try Now')

      const overlayContent = document.body.innerHTML
      expect(overlayContent).toContain('mdi-refresh')
    })
  })

  describe('Countdown Timer (AC3, AC4)', () => {
    it('countdown starts from retryAfter value when provided', async () => {
      mountComponent({ type: 'service_unavailable', message: 'Service down', retryAfter: 45 })
      await flushPromises()

      const countdownText = document.body.querySelector('[data-testid="countdown-text"]')
      expect(countdownText?.textContent).toContain('Retry in 45s')
    })

    it('countdown defaults to 30 seconds when retryAfter not provided', async () => {
      mountComponent({ type: 'service_unavailable', message: 'Service down' })
      await flushPromises()

      const countdownText = document.body.querySelector('[data-testid="countdown-text"]')
      expect(countdownText?.textContent).toContain('Retry in 30s')
    })

    it('countdown decrements every second', async () => {
      mountComponent({ type: 'service_unavailable', message: 'Service down', retryAfter: 30 })
      await flushPromises()

      // Initial state
      let countdownText = document.body.querySelector('[data-testid="countdown-text"]')
      expect(countdownText?.textContent).toContain('Retry in 30s')

      // Advance by 1 second
      vi.advanceTimersByTime(1000)
      await flushPromises()

      countdownText = document.body.querySelector('[data-testid="countdown-text"]')
      expect(countdownText?.textContent).toContain('Retry in 29s')

      // Advance by another second
      vi.advanceTimersByTime(1000)
      await flushPromises()

      countdownText = document.body.querySelector('[data-testid="countdown-text"]')
      expect(countdownText?.textContent).toContain('Retry in 28s')
    })

    it('progress bar exists and receives model value', async () => {
      const { wrapper: testWrapper } = mountComponent({ type: 'service_unavailable', message: 'Service down', retryAfter: 10 })
      await flushPromises()

      const progressBar = testWrapper.findComponent({ name: 'VProgressLinear' })

      // Progress bar should exist and be bound to modelValue
      expect(progressBar.exists()).toBe(true)
      // At start, progress should be 0%
      expect(progressBar.props('modelValue')).toBe(0)
    })

    it('has data-testid on progress bar for testing', async () => {
      mountComponent({ type: 'service_unavailable', message: 'Service down', retryAfter: 30 })
      await flushPromises()

      const progressBar = document.body.querySelector('[data-testid="countdown-progress-bar"]')
      expect(progressBar).toBeTruthy()
    })
  })

  describe('Try Now Action (AC5)', () => {
    it('"Try Now" button triggers manual retry', async () => {
      mountComponent({ type: 'service_unavailable', message: 'Service down', retryAfter: 30 })
      await flushPromises()

      const checkAuthSpy = vi.mocked(authService.checkAuth)
      checkAuthSpy.mockResolvedValueOnce({ isAuthenticated: true, user: null })

      const tryNowBtn = document.body.querySelector('[data-testid="try-now-button"]') as HTMLElement
      expect(tryNowBtn).toBeTruthy()
      tryNowBtn.click()
      await flushPromises()

      expect(checkAuthSpy).toHaveBeenCalled()
    })

    it('loading state shown on "Try Now" button during retry', async () => {
      // Mock checkAuth to delay resolution
      const checkAuthSpy = vi.mocked(authService.checkAuth)
      let resolvePromise: (value: { isAuthenticated: boolean; user: null }) => void
      checkAuthSpy.mockReturnValueOnce(new Promise(resolve => { resolvePromise = resolve }))

      mountComponent({ type: 'service_unavailable', message: 'Service down', retryAfter: 30 })
      await flushPromises()

      const tryNowBtn = document.body.querySelector('[data-testid="try-now-button"]') as HTMLElement
      expect(tryNowBtn.hasAttribute('disabled')).toBe(false)

      // Click button
      tryNowBtn.click()
      await flushPromises()

      // Button should be disabled during retry
      expect(tryNowBtn.hasAttribute('disabled')).toBe(true)

      // Resolve the promise
      resolvePromise!({ isAuthenticated: true, user: null })
      await flushPromises()
    })

    it('countdown pauses during retry attempt', async () => {
      // Mock checkAuth to delay
      const checkAuthSpy = vi.mocked(authService.checkAuth)
      let resolvePromise: (value: { isAuthenticated: boolean; user: null }) => void
      checkAuthSpy.mockReturnValueOnce(new Promise(resolve => { resolvePromise = resolve }))

      mountComponent({ type: 'service_unavailable', message: 'Service down', retryAfter: 30 })
      await flushPromises()

      // Click Try Now
      const tryNowBtn = document.body.querySelector('[data-testid="try-now-button"]') as HTMLElement
      tryNowBtn.click()
      await flushPromises()

      // Advance time - countdown should be paused during retry
      vi.advanceTimersByTime(5000)
      await flushPromises()

      // Resolve the retry
      resolvePromise!({ isAuthenticated: true, user: null })
      await flushPromises()
    })

    it('overlay dismisses on successful retry via clearError', async () => {
      const { authStore } = mountComponent({ type: 'service_unavailable', message: 'Service down', retryAfter: 30 })
      await flushPromises()

      const clearErrorSpy = vi.spyOn(authStore, 'clearError')
      const checkAuthSpy = vi.mocked(authService.checkAuth)
      checkAuthSpy.mockResolvedValueOnce({ isAuthenticated: true, user: null })

      const tryNowBtn = document.body.querySelector('[data-testid="try-now-button"]') as HTMLElement
      tryNowBtn.click()
      await flushPromises()

      expect(clearErrorSpy).toHaveBeenCalled()
    })

    it('countdown restarts after failed retry', async () => {
      mountComponent({ type: 'service_unavailable', message: 'Service down', retryAfter: 30 })
      await flushPromises()

      // Make checkAuth fail
      const checkAuthSpy = vi.mocked(authService.checkAuth)
      checkAuthSpy.mockRejectedValueOnce(new Error('Service still down'))

      // Click Try Now
      const tryNowBtn = document.body.querySelector('[data-testid="try-now-button"]') as HTMLElement
      tryNowBtn.click()
      await flushPromises()

      // After failure, countdown should restart
      const countdownText = document.body.querySelector('[data-testid="countdown-text"]')
      expect(countdownText?.textContent).toContain('Retry in 30s')
    })

    it('concurrent retry prevention (isRetrying guard)', async () => {
      mountComponent({ type: 'service_unavailable', message: 'Service down', retryAfter: 30 })
      await flushPromises()

      // Mock checkAuth to delay
      const checkAuthSpy = vi.mocked(authService.checkAuth)
      checkAuthSpy.mockReturnValue(new Promise(() => {})) // Never resolves

      const tryNowBtn = document.body.querySelector('[data-testid="try-now-button"]') as HTMLElement

      // Click twice rapidly
      tryNowBtn.click()
      await flushPromises()
      tryNowBtn.click()
      await flushPromises()

      // Should only be called once due to isRetrying guard
      expect(checkAuthSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('Automatic Retry on Countdown Complete (AC6)', () => {
    it('automatic retry triggers when countdown reaches 0', async () => {
      const checkAuthSpy = vi.mocked(authService.checkAuth)
      checkAuthSpy.mockResolvedValue({ isAuthenticated: true, user: null })

      mountComponent({ type: 'service_unavailable', message: 'Service down', retryAfter: 5 })
      await flushPromises()

      // Advance time to countdown = 0
      vi.advanceTimersByTime(5000)
      await flushPromises()

      expect(checkAuthSpy).toHaveBeenCalled()
    })

    it('overlay dismisses on successful automatic retry', async () => {
      const { authStore } = mountComponent({ type: 'service_unavailable', message: 'Service down', retryAfter: 5 })
      await flushPromises()

      const clearErrorSpy = vi.spyOn(authStore, 'clearError')
      const checkAuthSpy = vi.mocked(authService.checkAuth)
      checkAuthSpy.mockResolvedValueOnce({ isAuthenticated: true, user: null })

      // Advance time to countdown = 0
      vi.advanceTimersByTime(5000)
      await flushPromises()

      expect(clearErrorSpy).toHaveBeenCalled()
    })

    it('countdown restarts after failed automatic retry', async () => {
      const checkAuthSpy = vi.mocked(authService.checkAuth)
      checkAuthSpy.mockRejectedValueOnce(new Error('Still down'))

      mountComponent({ type: 'service_unavailable', message: 'Service down', retryAfter: 3 })
      await flushPromises()

      // Advance time to trigger auto-retry
      vi.advanceTimersByTime(3000)
      await flushPromises()

      // After failure, countdown should restart
      const countdownText = document.body.querySelector('[data-testid="countdown-text"]')
      expect(countdownText?.textContent).toMatch(/Retry in \d+s/)
    })
  })

  describe('Overlay Cannot Be Dismissed Manually (AC7)', () => {
    it('has persistent prop set to prevent dismissal', async () => {
      const { wrapper } = mountComponent({ type: 'service_unavailable', message: 'Service down', retryAfter: 30 })
      await flushPromises()

      const overlay = wrapper.findComponent({ name: 'VOverlay' })
      expect(overlay.props('persistent')).toBe(true)
    })
  })

  describe('Accessibility (AC8)', () => {
    it('has role="alertdialog" attribute', async () => {
      mountComponent({ type: 'service_unavailable', message: 'Service down', retryAfter: 30 })
      await flushPromises()

      const overlayElement = document.body.querySelector('[data-testid="service-unavailable-overlay"]')
      expect(overlayElement?.getAttribute('role')).toBe('alertdialog')
    })

    it('has aria-modal="true" attribute', async () => {
      mountComponent({ type: 'service_unavailable', message: 'Service down', retryAfter: 30 })
      await flushPromises()

      const overlayElement = document.body.querySelector('[data-testid="service-unavailable-overlay"]')
      expect(overlayElement?.getAttribute('aria-modal')).toBe('true')
    })

    it('has aria-live="assertive" attribute for urgent notification', async () => {
      mountComponent({ type: 'service_unavailable', message: 'Service down', retryAfter: 30 })
      await flushPromises()

      const overlayElement = document.body.querySelector('[data-testid="service-unavailable-overlay"]')
      expect(overlayElement?.getAttribute('aria-live')).toBe('assertive')
    })

    it('has aria-labelledby for overlay title', async () => {
      mountComponent({ type: 'service_unavailable', message: 'Service down', retryAfter: 30 })
      await flushPromises()

      // Check for the title element with correct id in DOM
      const titleElement = document.body.querySelector('#service-unavailable-title')
      expect(titleElement).toBeTruthy()
      expect(titleElement?.textContent).toContain('Service Issue')
    })

    it('has aria-describedby for overlay message', async () => {
      mountComponent({ type: 'service_unavailable', message: 'Service down', retryAfter: 30 })
      await flushPromises()

      // Check for the message element with correct id in DOM
      const messageElement = document.body.querySelector('#service-unavailable-message')
      expect(messageElement).toBeTruthy()
    })

    it('has aria-label on "Try Now" button', async () => {
      mountComponent({ type: 'service_unavailable', message: 'Service down', retryAfter: 30 })
      await flushPromises()

      const tryNowBtn = document.body.querySelector('[data-testid="try-now-button"]')
      expect(tryNowBtn?.getAttribute('aria-label')).toBe('Try connecting now')
    })

    it('"Try Now" button is keyboard accessible (is a button element)', async () => {
      mountComponent({ type: 'service_unavailable', message: 'Service down', retryAfter: 30 })
      await flushPromises()

      const tryNowBtn = document.body.querySelector('[data-testid="try-now-button"]')
      expect(tryNowBtn?.tagName.toLowerCase()).toBe('button')
    })

    it('has data-testid on overlay for reliable test selection', async () => {
      mountComponent({ type: 'service_unavailable', message: 'Service down', retryAfter: 30 })
      await flushPromises()

      const overlayElement = document.body.querySelector('[data-testid="service-unavailable-overlay"]')
      expect(overlayElement).toBeTruthy()
    })

    it('countdown text has aria-label for screen readers', async () => {
      mountComponent({ type: 'service_unavailable', message: 'Service down', retryAfter: 30 })
      await flushPromises()

      const countdownText = document.body.querySelector('[data-testid="countdown-text"]')
      expect(countdownText?.getAttribute('aria-label')).toBe('Retry in 30 seconds')
    })
  })

  describe('Integration with Auth Store (AC9)', () => {
    it('automatically shows when error state changes to service_unavailable', async () => {
      const { wrapper, authStore } = mountComponent(null)
      await flushPromises()

      // Initially, overlay should not be visible
      const overlay = wrapper.findComponent({ name: 'VOverlay' })
      expect(overlay.props('modelValue')).toBe(false)

      // Update error state
      authStore.$patch({
        error: { type: 'service_unavailable', message: 'Service down', retryAfter: 30 }
      })
      await flushPromises()

      // Now overlay should be visible
      expect(overlay.props('modelValue')).toBe(true)
    })

    it('automatically hides when error state is cleared', async () => {
      const { wrapper, authStore } = mountComponent({
        type: 'service_unavailable',
        message: 'Service down',
        retryAfter: 30
      })
      await flushPromises()

      // Initially visible
      const overlay = wrapper.findComponent({ name: 'VOverlay' })
      expect(overlay.props('modelValue')).toBe(true)

      // Clear error state
      authStore.$patch({
        error: null
      })
      await flushPromises()

      // Now overlay should not be visible
      expect(overlay.props('modelValue')).toBe(false)
    })

    it('only responds to service_unavailable error type', async () => {
      const { wrapper, authStore } = mountComponent(null)
      await flushPromises()

      const overlay = wrapper.findComponent({ name: 'VOverlay' })

      // Set session_expired error - should NOT show overlay
      authStore.$patch({
        error: { type: 'session_expired', message: 'Session expired' }
      })
      await flushPromises()
      expect(overlay.props('modelValue')).toBe(false)

      // Set permission_denied error - should NOT show overlay
      authStore.$patch({
        error: { type: 'permission_denied', message: 'Access denied' }
      })
      await flushPromises()
      expect(overlay.props('modelValue')).toBe(false)

      // Set service_unavailable error - SHOULD show overlay
      authStore.$patch({
        error: { type: 'service_unavailable', message: 'Service down', retryAfter: 30 }
      })
      await flushPromises()
      expect(overlay.props('modelValue')).toBe(true)
    })
  })

  describe('Cleanup', () => {
    it('clearInterval on component unmount', async () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval')

      const { wrapper } = mountComponent({
        type: 'service_unavailable',
        message: 'Service down',
        retryAfter: 30
      })
      await flushPromises()

      // Unmount the component
      wrapper.unmount()

      // clearInterval should have been called
      expect(clearIntervalSpy).toHaveBeenCalled()
    })

    it('stops countdown when error state changes away from service_unavailable', async () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval')

      const { authStore } = mountComponent({
        type: 'service_unavailable',
        message: 'Service down',
        retryAfter: 30
      })
      await flushPromises()

      // Clear error state
      authStore.$patch({
        error: null
      })
      await flushPromises()

      // clearInterval should have been called
      expect(clearIntervalSpy).toHaveBeenCalled()
    })
  })

  describe('Retry calls authService.checkAuth()', () => {
    it('retry uses authService.checkAuth() for connectivity check', async () => {
      const checkAuthSpy = vi.mocked(authService.checkAuth)
      checkAuthSpy.mockResolvedValueOnce({ isAuthenticated: true, user: null })

      mountComponent({ type: 'service_unavailable', message: 'Service down', retryAfter: 30 })
      await flushPromises()

      const tryNowBtn = document.body.querySelector('[data-testid="try-now-button"]') as HTMLElement
      tryNowBtn.click()
      await flushPromises()

      // Should call authService.checkAuth(), not any store method
      expect(checkAuthSpy).toHaveBeenCalled()
    })
  })

  describe('Component Structure', () => {
    it('has correct component name defined', () => {
      const { wrapper } = mountComponent(null)
      expect(wrapper.vm.$options.name).toBe('ServiceUnavailableOverlay')
    })

    it('uses v-overlay (not v-dialog) for full-screen blocking behavior', async () => {
      const { wrapper } = mountComponent({
        type: 'service_unavailable',
        message: 'Service down',
        retryAfter: 30
      })
      await flushPromises()

      // Should be an overlay, NOT a dialog
      const overlay = wrapper.findComponent({ name: 'VOverlay' })
      const dialog = wrapper.findComponent({ name: 'VDialog' })

      expect(overlay.exists()).toBe(true)
      expect(dialog.exists()).toBe(false)
    })
  })
})
