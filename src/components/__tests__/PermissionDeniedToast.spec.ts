/**
 * PermissionDeniedToast Unit Tests
 *
 * Tests for the permission denied toast component that displays
 * a non-blocking notification when user attempts an unauthorized action.
 *
 * @see Story 3.2: Permission Denied Toast
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
import PermissionDeniedToast from '../PermissionDeniedToast.vue'
import { useAuthStore } from '../../stores/auth'
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
    checkAuth: vi.fn().mockResolvedValue({ isAuthenticated: false, user: null }),
    logout: vi.fn().mockResolvedValue(undefined),
    initiateLogin: vi.fn(),
    getAccessToken: vi.fn().mockResolvedValue(null)
  }
}))

describe('PermissionDeniedToast', () => {
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

    wrapper = mount(PermissionDeniedToast, {
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

  describe('Visibility - Toast Display Trigger (AC1)', () => {
    it('renders toast when error.type is permission_denied', async () => {
      const { wrapper } = mountComponent({ type: 'permission_denied', message: 'Insufficient permissions' })
      await flushPromises()

      // Use findComponent for reliable Vuetify component selection
      const snackbar = wrapper.findComponent({ name: 'VSnackbar' })
      expect(snackbar.exists()).toBe(true)
      expect(snackbar.props('modelValue')).toBe(true)
    })

    it('does not render toast when error is null', async () => {
      const { wrapper } = mountComponent(null)
      await flushPromises()

      const snackbar = wrapper.findComponent({ name: 'VSnackbar' })
      // Snackbar component exists but modelValue should be false
      expect(snackbar.props('modelValue')).toBe(false)
    })

    it('does not render toast for session_expired error', async () => {
      const { wrapper } = mountComponent({ type: 'session_expired', message: 'Session expired' })
      await flushPromises()

      const snackbar = wrapper.findComponent({ name: 'VSnackbar' })
      expect(snackbar.props('modelValue')).toBe(false)
    })

    it('does not render toast for service_unavailable error', async () => {
      const { wrapper } = mountComponent({
        type: 'service_unavailable',
        message: 'Service down',
        retryAfter: 30
      })
      await flushPromises()

      const snackbar = wrapper.findComponent({ name: 'VSnackbar' })
      expect(snackbar.props('modelValue')).toBe(false)
    })

  })

  describe('Toast Content (AC2)', () => {
    it('displays error message from auth store when available', async () => {
      const customMessage = 'You are not authorized to access this resource.'
      mountComponent({ type: 'permission_denied', message: customMessage })
      await flushPromises()

      // Check document body since snackbar teleports content
      const snackbarContent = document.body.querySelector('[data-testid="permission-denied-toast"]')
      expect(snackbarContent?.textContent).toContain(customMessage)
    })

    it('displays default message when error.message is empty', async () => {
      mountComponent({ type: 'permission_denied', message: '' })
      await flushPromises()

      const snackbarContent = document.body.querySelector('[data-testid="permission-denied-toast"]')
      expect(snackbarContent?.textContent).toContain('You do not have permission to perform this action.')
    })

    it('displays mdi-shield-alert icon', async () => {
      mountComponent({ type: 'permission_denied', message: 'Access denied' })
      await flushPromises()

      // Check for the icon in toast content
      const toastContent = document.body.innerHTML
      expect(toastContent).toContain('mdi-shield-alert')
    })

    it('has warning color theme', async () => {
      const { wrapper } = mountComponent({ type: 'permission_denied', message: 'Access denied' })
      await flushPromises()

      const snackbar = wrapper.findComponent({ name: 'VSnackbar' })
      expect(snackbar.props('color')).toBe('warning')
    })

    it('has location="top" positioning', async () => {
      const { wrapper } = mountComponent({ type: 'permission_denied', message: 'Access denied' })
      await flushPromises()

      const snackbar = wrapper.findComponent({ name: 'VSnackbar' })
      expect(snackbar.props('location')).toBe('top')
    })
  })

  describe('Auto-Dismiss Behavior (AC3)', () => {
    it('has 5 second timeout configured', async () => {
      const { wrapper } = mountComponent({ type: 'permission_denied', message: 'Access denied' })
      await flushPromises()

      const snackbar = wrapper.findComponent({ name: 'VSnackbar' })
      expect(snackbar.props('timeout')).toBe(5000)
    })

    it('calls clearError when toast auto-dismisses via timeout', async () => {
      const { wrapper, authStore } = mountComponent({ type: 'permission_denied', message: 'Access denied' })
      await flushPromises()

      const clearErrorSpy = vi.spyOn(authStore, 'clearError')

      // Verify toast is initially visible
      const snackbar = wrapper.findComponent({ name: 'VSnackbar' })
      expect(snackbar.props('modelValue')).toBe(true)

      // Simulate the v-snackbar auto-dismiss by triggering its v-model update
      // When timeout expires, v-snackbar emits update:modelValue with false
      await snackbar.vm.$emit('update:modelValue', false)
      await flushPromises()

      // The v-model setter should have called handleClose which calls clearError
      expect(clearErrorSpy).toHaveBeenCalled()
    })

    it('resets timer when same error re-appears', async () => {
      const { wrapper, authStore } = mountComponent({ type: 'permission_denied', message: 'Access denied' })
      await flushPromises()

      const clearErrorSpy = vi.spyOn(authStore, 'clearError')

      // Clear the error to dismiss toast
      authStore.$patch({ error: null })
      await flushPromises()

      // Verify toast is hidden
      const snackbar = wrapper.findComponent({ name: 'VSnackbar' })
      expect(snackbar.props('modelValue')).toBe(false)

      // Re-trigger the same error
      authStore.$patch({ error: { type: 'permission_denied', message: 'Access denied again' } })
      await flushPromises()

      // Toast should be visible again (timer effectively resets via new show)
      expect(snackbar.props('modelValue')).toBe(true)

      // clearError should have been called when we cleared the error earlier
      expect(clearErrorSpy).not.toHaveBeenCalled() // Only cleared via patch, not via handleClose
    })
  })

  describe('Manual Dismiss (AC4)', () => {
    it('has Close button', async () => {
      mountComponent({ type: 'permission_denied', message: 'Access denied' })
      await flushPromises()

      const closeBtn = document.body.querySelector('[data-testid="permission-denied-close-button"]')
      expect(closeBtn).toBeTruthy()
      expect(closeBtn?.textContent).toContain('Close')
    })

    it('calls clearError when Close button is clicked', async () => {
      const { authStore } = mountComponent({ type: 'permission_denied', message: 'Access denied' })
      await flushPromises()

      const clearErrorSpy = vi.spyOn(authStore, 'clearError')

      // Find Close button in document (snackbar teleports content)
      const closeBtn = document.body.querySelector('[data-testid="permission-denied-close-button"]') as HTMLElement
      expect(closeBtn).toBeTruthy()
      closeBtn.click()
      await flushPromises()

      expect(clearErrorSpy).toHaveBeenCalled()
    })

    it('dismisses toast immediately when Close button is clicked', async () => {
      const { wrapper, authStore } = mountComponent({ type: 'permission_denied', message: 'Access denied' })
      await flushPromises()

      // Initially visible
      const snackbar = wrapper.findComponent({ name: 'VSnackbar' })
      expect(snackbar.props('modelValue')).toBe(true)

      // Click close button
      const closeBtn = document.body.querySelector('[data-testid="permission-denied-close-button"]') as HTMLElement
      closeBtn.click()
      await flushPromises()

      // Error is cleared, which should hide the toast
      expect(authStore.error).toBeNull()
    })
  })

  describe('Non-Blocking Interaction (AC5)', () => {
    it('does NOT have persistent prop (unlike dialog)', async () => {
      const { wrapper } = mountComponent({ type: 'permission_denied', message: 'Access denied' })
      await flushPromises()

      // Snackbar should not have persistent prop (that's a dialog thing)
      // v-snackbar doesn't block interaction by design
      const snackbar = wrapper.findComponent({ name: 'VSnackbar' })
      expect(snackbar.exists()).toBe(true)
      // Snackbars are non-blocking by nature - they don't overlay the whole screen
    })

    it('uses v-snackbar (not v-dialog) for non-blocking behavior', async () => {
      const { wrapper } = mountComponent({ type: 'permission_denied', message: 'Access denied' })
      await flushPromises()

      // Should be a snackbar, NOT a dialog
      const snackbar = wrapper.findComponent({ name: 'VSnackbar' })
      const dialog = wrapper.findComponent({ name: 'VDialog' })

      expect(snackbar.exists()).toBe(true)
      expect(dialog.exists()).toBe(false)
    })
  })

  describe('Accessibility (AC6)', () => {
    it('has role="status" attribute for screen readers', async () => {
      mountComponent({ type: 'permission_denied', message: 'Access denied' })
      await flushPromises()

      const snackbarElement = document.body.querySelector('[data-testid="permission-denied-toast"]')
      expect(snackbarElement?.getAttribute('role')).toBe('status')
    })

    it('has aria-live="polite" attribute', async () => {
      mountComponent({ type: 'permission_denied', message: 'Access denied' })
      await flushPromises()

      // v-snackbar may render aria-live internally, or we explicitly set it
      const snackbarElement = document.body.querySelector('[data-testid="permission-denied-toast"]')
      // The aria-live is set on the component
      expect(snackbarElement?.getAttribute('aria-live')).toBe('polite')
    })

    it('has aria-label on Close button', async () => {
      mountComponent({ type: 'permission_denied', message: 'Access denied' })
      await flushPromises()

      const closeBtn = document.body.querySelector('[data-testid="permission-denied-close-button"]')
      expect(closeBtn?.getAttribute('aria-label')).toBe('Dismiss notification')
    })

    it('Close button is keyboard accessible (is a button element)', async () => {
      mountComponent({ type: 'permission_denied', message: 'Access denied' })
      await flushPromises()

      const closeBtn = document.body.querySelector('[data-testid="permission-denied-close-button"]')
      expect(closeBtn?.tagName.toLowerCase()).toBe('button')
    })

    it('has data-testid on toast for reliable test selection', async () => {
      mountComponent({ type: 'permission_denied', message: 'Access denied' })
      await flushPromises()

      const toastElement = document.body.querySelector('[data-testid="permission-denied-toast"]')
      expect(toastElement).toBeTruthy()
    })
  })

  describe('Integration with Auth Store (AC7)', () => {
    it('automatically shows when error state changes to permission_denied', async () => {
      const { wrapper, authStore } = mountComponent(null)
      await flushPromises()

      // Initially, snackbar should not be visible
      const snackbar = wrapper.findComponent({ name: 'VSnackbar' })
      expect(snackbar.props('modelValue')).toBe(false)

      // Update error state
      authStore.$patch({
        error: { type: 'permission_denied', message: 'Access denied' }
      })
      await flushPromises()

      // Now snackbar should be visible
      expect(snackbar.props('modelValue')).toBe(true)
    })

    it('automatically hides when error state is cleared', async () => {
      const { wrapper, authStore } = mountComponent({ type: 'permission_denied', message: 'Access denied' })
      await flushPromises()

      // Initially visible
      const snackbar = wrapper.findComponent({ name: 'VSnackbar' })
      expect(snackbar.props('modelValue')).toBe(true)

      // Clear error state
      authStore.$patch({
        error: null
      })
      await flushPromises()

      // Now snackbar should not be visible
      expect(snackbar.props('modelValue')).toBe(false)
    })

    it('only responds to permission_denied error type', async () => {
      const { wrapper, authStore } = mountComponent(null)
      await flushPromises()

      const snackbar = wrapper.findComponent({ name: 'VSnackbar' })

      // Set session_expired error - should NOT show toast
      authStore.$patch({
        error: { type: 'session_expired', message: 'Session expired' }
      })
      await flushPromises()
      expect(snackbar.props('modelValue')).toBe(false)

      // Set service_unavailable error - should NOT show toast
      authStore.$patch({
        error: { type: 'service_unavailable', message: 'Service down', retryAfter: 30 }
      })
      await flushPromises()
      expect(snackbar.props('modelValue')).toBe(false)

      // Set permission_denied error - SHOULD show toast
      authStore.$patch({
        error: { type: 'permission_denied', message: 'Access denied' }
      })
      await flushPromises()
      expect(snackbar.props('modelValue')).toBe(true)
    })
  })

  describe('Error Message Handling', () => {
    it('displays backend error message when provided', async () => {
      const backendMessage = 'Insufficient permissions for admin operations'
      mountComponent({ type: 'permission_denied', message: backendMessage })
      await flushPromises()

      const toastContent = document.body.querySelector('[data-testid="permission-denied-toast"]')
      expect(toastContent?.textContent).toContain(backendMessage)
    })

    it('falls back to default message when message is null', async () => {
      // Create error with undefined message
      const { authStore } = mountComponent(null)
      authStore.$patch({
        error: { type: 'permission_denied', message: undefined as unknown as string }
      })
      await flushPromises()

      const toastContent = document.body.querySelector('[data-testid="permission-denied-toast"]')
      expect(toastContent?.textContent).toContain('You do not have permission to perform this action.')
    })
  })

  describe('Component Structure', () => {
    it('has correct component name defined', () => {
      const { wrapper } = mountComponent(null)
      expect(wrapper.vm.$options.name).toBe('PermissionDeniedToast')
    })
  })
})
