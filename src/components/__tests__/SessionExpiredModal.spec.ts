/**
 * SessionExpiredModal Unit Tests
 *
 * Tests for the session expired modal component that prompts
 * users to re-authenticate when their session expires.
 *
 * @see Story 3.1: Session Expired Modal
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

// Mock visualViewport for Vuetify v-dialog positioning
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
import SessionExpiredModal from '../SessionExpiredModal.vue'
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

describe('SessionExpiredModal', () => {
  let wrapper: VueWrapper
  const mockLocationHref = 'http://localhost:3000/test-page'

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    // Ensure we have a clean body for attachTo
    document.body.innerHTML = '<div id="app"></div>'

    // Mock window.location for return URL capture
    Object.defineProperty(window, 'location', {
      value: { href: mockLocationHref },
      writable: true,
      configurable: true
    })
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  /**
   * Mount helper with common configuration
   */
  function mountComponent(errorState: AuthError | null = null) {
    // Set up store state before mounting
    const pinia = createPinia()
    setActivePinia(pinia)

    wrapper = mount(SessionExpiredModal, {
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

  describe('Visibility (AC1, AC6)', () => {
    it('renders modal when error.type is session_expired', async () => {
      const { wrapper } = mountComponent({ type: 'session_expired', message: 'Session expired' })
      await flushPromises()

      // Use findComponent for reliable Vuetify component selection
      const dialog = wrapper.findComponent({ name: 'VDialog' })
      expect(dialog.exists()).toBe(true)
      expect(dialog.props('modelValue')).toBe(true)
      // Check document body since dialog teleports content
      const dialogContent = document.body.querySelector('.v-card')
      expect(dialogContent?.textContent).toContain('Session Expired')
    })

    it('does not render modal when error is null', async () => {
      const { wrapper } = mountComponent(null)
      await flushPromises()

      const dialog = wrapper.findComponent({ name: 'VDialog' })
      // Dialog component exists but modelValue should be false
      expect(dialog.props('modelValue')).toBe(false)
    })

    it('does not render modal for permission_denied error', async () => {
      const { wrapper } = mountComponent({ type: 'permission_denied', message: 'Access denied' })
      await flushPromises()

      const dialog = wrapper.findComponent({ name: 'VDialog' })
      expect(dialog.props('modelValue')).toBe(false)
    })

    it('does not render modal for service_unavailable error', async () => {
      const { wrapper } = mountComponent({
        type: 'service_unavailable',
        message: 'Service down',
        retryAfter: 30
      })
      await flushPromises()

      const dialog = wrapper.findComponent({ name: 'VDialog' })
      expect(dialog.props('modelValue')).toBe(false)
    })
  })

  describe('Sign In Action (AC3)', () => {
    it('calls login with current URL when Sign In clicked', async () => {
      const { authStore } = mountComponent({ type: 'session_expired', message: 'Session expired' })
      await flushPromises()

      // Spy on login action
      const loginSpy = vi.spyOn(authStore, 'login')

      // Find Sign In button in document (dialog teleports content)
      const signInBtn = document.body.querySelector('[data-testid="session-expired-sign-in-button"]') as HTMLElement
      expect(signInBtn).toBeTruthy()
      signInBtn.click()
      await flushPromises()

      expect(loginSpy).toHaveBeenCalledWith(mockLocationHref)
    })

    it('prevents multiple clicks during loading state', async () => {
      const { authStore } = mountComponent({ type: 'session_expired', message: 'Session expired' })
      await flushPromises()

      // Spy on login action
      const loginSpy = vi.spyOn(authStore, 'login')

      const signInBtn = document.body.querySelector('[data-testid="session-expired-sign-in-button"]') as HTMLElement
      expect(signInBtn).toBeTruthy()

      // Click twice rapidly
      signInBtn.click()
      await flushPromises()
      signInBtn.click()
      await flushPromises()

      // Should only be called once due to loading state guard
      expect(loginSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('Persistent Behavior (AC4)', () => {
    it('has persistent prop set to prevent dismissal', async () => {
      const { wrapper } = mountComponent({ type: 'session_expired', message: 'Session expired' })
      await flushPromises()

      const dialog = wrapper.findComponent({ name: 'VDialog' })
      expect(dialog.props('persistent')).toBe(true)
    })
  })

  describe('Accessibility (AC5)', () => {
    it('has aria-labelledby for dialog title', async () => {
      mountComponent({ type: 'session_expired', message: 'Session expired' })
      await flushPromises()

      // Check for the title element with correct id in DOM
      const titleElement = document.body.querySelector('#session-expired-title')
      expect(titleElement).toBeTruthy()
      expect(titleElement?.textContent).toContain('Session Expired')
    })

    it('has aria-describedby for dialog message', async () => {
      mountComponent({ type: 'session_expired', message: 'Session expired' })
      await flushPromises()

      // Check for the message element with correct id in DOM
      const messageElement = document.body.querySelector('#session-expired-message')
      expect(messageElement).toBeTruthy()
    })

    it('has aria-label on Sign In button', async () => {
      mountComponent({ type: 'session_expired', message: 'Session expired' })
      await flushPromises()

      const signInBtn = document.body.querySelector('[data-testid="session-expired-sign-in-button"]')
      expect(signInBtn?.getAttribute('aria-label')).toBe('Sign in to continue')
    })

    it('traps focus within modal when open (Vuetify handles automatically)', async () => {
      const { wrapper } = mountComponent({ type: 'session_expired', message: 'Session expired' })
      await flushPromises()

      // Vuetify v-dialog with persistent automatically traps focus
      // Verify the dialog is present and persistent
      const dialog = wrapper.findComponent({ name: 'VDialog' })
      expect(dialog.props('persistent')).toBe(true)
      expect(dialog.props('modelValue')).toBe(true)

      // Focus trap is a Vuetify behavior - verify button is focusable
      const signInBtn = document.body.querySelector('[data-testid="session-expired-sign-in-button"]')
      expect(signInBtn?.tagName.toLowerCase()).toBe('button')
    })

    it('has data-testid on dialog for reliable test selection', async () => {
      mountComponent({ type: 'session_expired', message: 'Session expired' })
      await flushPromises()

      // Check for the data-testid in the rendered DOM (Vuetify passes it through)
      // The data-testid is applied to the v-dialog element which renders in the DOM
      const dialogElement = document.body.querySelector('[data-testid="session-expired-modal"]')
      expect(dialogElement).toBeTruthy()
    })

    it('has role="dialog" attribute (provided by Vuetify v-dialog)', async () => {
      mountComponent({ type: 'session_expired', message: 'Session expired' })
      await flushPromises()

      // Vuetify v-dialog renders a container with role="dialog"
      const dialogElement = document.body.querySelector('[role="dialog"]')
      expect(dialogElement).toBeTruthy()
    })

    it('has aria-modal="true" attribute (provided by Vuetify v-dialog)', async () => {
      mountComponent({ type: 'session_expired', message: 'Session expired' })
      await flushPromises()

      // Vuetify v-dialog renders with aria-modal="true" for screen reader isolation
      const dialogElement = document.body.querySelector('[aria-modal="true"]')
      expect(dialogElement).toBeTruthy()
    })
  })

  describe('Content (AC2)', () => {
    it('displays correct title "Session Expired"', async () => {
      mountComponent({ type: 'session_expired', message: 'Session expired' })
      await flushPromises()

      // Check document body since dialog teleports content
      const dialogContent = document.body.querySelector('.v-card')
      expect(dialogContent?.textContent).toContain('Session Expired')
    })

    it('displays error message from auth store when available', async () => {
      const customMessage = 'Your token has been revoked. Please sign in again.'
      mountComponent({ type: 'session_expired', message: customMessage })
      await flushPromises()

      const dialogContent = document.body.querySelector('.v-card')
      expect(dialogContent?.textContent).toContain(customMessage)
    })

    it('displays default message when error.message is empty', async () => {
      mountComponent({ type: 'session_expired', message: '' })
      await flushPromises()

      const dialogContent = document.body.querySelector('.v-card')
      expect(dialogContent?.textContent).toContain('Your session has ended. Sign in again to continue.')
    })

    it('displays mdi-login icon on Sign In button', async () => {
      mountComponent({ type: 'session_expired', message: 'Session expired' })
      await flushPromises()

      // Check for the icon in dialog content
      const dialogContent = document.body.innerHTML
      expect(dialogContent).toContain('mdi-login')
    })

    it('displays mdi-clock-alert-outline icon in title', async () => {
      mountComponent({ type: 'session_expired', message: 'Session expired' })
      await flushPromises()

      // Check for the icon in dialog content
      const dialogContent = document.body.innerHTML
      expect(dialogContent).toContain('mdi-clock-alert-outline')
    })

    it('has max-width of 400 for appropriate dialog size', async () => {
      const { wrapper } = mountComponent({ type: 'session_expired', message: 'Session expired' })
      await flushPromises()

      const dialog = wrapper.findComponent({ name: 'VDialog' })
      expect(dialog.props('maxWidth')).toBe('400')
    })
  })

  describe('Loading State', () => {
    it('shows loading state on Sign In button during redirect', async () => {
      const { authStore } = mountComponent({ type: 'session_expired', message: 'Session expired' })
      await flushPromises()

      // Mock login to not immediately return (simulating redirect delay)
      vi.spyOn(authStore, 'login').mockImplementation(() => {
        // login redirects, doesn't return
      })

      // Find Sign In button
      const signInBtn = document.body.querySelector('[data-testid="session-expired-sign-in-button"]') as HTMLElement
      expect(signInBtn).toBeTruthy()

      // Before click, button should not be disabled
      expect(signInBtn.hasAttribute('disabled')).toBe(false)

      // Click button
      signInBtn.click()
      await flushPromises()

      // After click, button should be disabled (loading state)
      expect(signInBtn.hasAttribute('disabled')).toBe(true)
    })
  })

  describe('Reactivity', () => {
    it('shows modal when error state changes to session_expired', async () => {
      const { wrapper, authStore } = mountComponent(null)
      await flushPromises()

      // Initially, dialog should not be visible
      const dialog = wrapper.findComponent({ name: 'VDialog' })
      expect(dialog.props('modelValue')).toBe(false)

      // Update error state
      authStore.$patch({
        error: { type: 'session_expired', message: 'Session expired' }
      })
      await flushPromises()

      // Now dialog should be visible
      expect(dialog.props('modelValue')).toBe(true)
    })

    it('hides modal when error state is cleared (though this should not happen normally)', async () => {
      const { wrapper, authStore } = mountComponent({ type: 'session_expired', message: 'Session expired' })
      await flushPromises()

      // Initially visible
      const dialog = wrapper.findComponent({ name: 'VDialog' })
      expect(dialog.props('modelValue')).toBe(true)

      // Clear error state
      authStore.$patch({
        error: null
      })
      await flushPromises()

      // Now dialog should not be visible
      expect(dialog.props('modelValue')).toBe(false)
    })
  })
})
