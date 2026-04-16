/**
 * SessionExpiredView Unit Tests
 *
 * Covers default rendering, text overrides, icon disable, and onSignIn
 * invocation for the default session-expired view. Store integration is
 * covered separately in AuthErrorBoundary.spec.ts.
 */

import { describe, it, expect, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import SessionExpiredView from '../SessionExpiredView.vue'
import type { BffAuthConfig } from '../../../types/config'
import type { AuthError } from '../../../types/auth'

const IconStub = defineComponent({
  name: 'IconStub',
  render: () => h('span', { 'data-testid': 'icon-stub' })
})

function makeConfig(overrides: Partial<BffAuthConfig> = {}): BffAuthConfig {
  return {
    bffBaseUrl: 'http://localhost:8080',
    clientId: 'test-client',
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } as any,
    icons: {
      sessionExpired: IconStub,
      login: IconStub,
      serviceUnavailable: IconStub,
      retry: IconStub
    },
    errorViews: {},
    text: {},
    mode: 'token',
    ...overrides
  }
}

const sessionExpiredError: AuthError = {
  type: 'session_expired',
  message: 'Backend-provided message'
}

describe('SessionExpiredView', () => {
  it('renders default title, message, and button copy', () => {
    const wrapper = mount(SessionExpiredView, {
      props: {
        error: sessionExpiredError,
        onSignIn: vi.fn(),
        config: makeConfig()
      }
    })

    expect(wrapper.text()).toContain('Session expired')
    // Backend-provided message takes precedence over default copy.
    expect(wrapper.text()).toContain('Backend-provided message')
    expect(wrapper.get('[data-testid="session-expired-sign-in-button"]').text()).toContain(
      'Sign in'
    )
  })

  it('applies text overrides for title/message/button', () => {
    const wrapper = mount(SessionExpiredView, {
      props: {
        error: sessionExpiredError,
        onSignIn: vi.fn(),
        config: makeConfig({
          text: {
            sessionExpired: {
              title: 'Custom Title',
              message: 'Custom Message',
              button: 'Custom Button'
            }
          }
        })
      }
    })

    expect(wrapper.text()).toContain('Custom Title')
    expect(wrapper.text()).toContain('Custom Message')
    expect(wrapper.text()).toContain('Custom Button')
    expect(wrapper.text()).not.toContain('Backend-provided message')
  })

  it('omits the title icon when icons.sessionExpired is false', () => {
    const config = makeConfig()
    config.icons.sessionExpired = false
    const wrapper = mount(SessionExpiredView, {
      props: {
        error: sessionExpiredError,
        onSignIn: vi.fn(),
        config
      }
    })

    expect(wrapper.find('.bff-auth-overlay__icon').exists()).toBe(false)
  })

  it('invokes onSignIn when the primary button is clicked', async () => {
    const onSignIn = vi.fn()
    const wrapper = mount(SessionExpiredView, {
      props: {
        error: sessionExpiredError,
        onSignIn,
        config: makeConfig()
      }
    })

    await wrapper.get('[data-testid="session-expired-sign-in-button"]').trigger('click')
    expect(onSignIn).toHaveBeenCalledTimes(1)
  })

  it('has alertdialog role with matching aria-labelledby/describedby targets', () => {
    const wrapper = mount(SessionExpiredView, {
      props: {
        error: sessionExpiredError,
        onSignIn: vi.fn(),
        config: makeConfig()
      }
    })

    const root = wrapper.get('[role="alertdialog"]')
    expect(root.attributes('aria-modal')).toBe('true')
    const titleId = root.attributes('aria-labelledby')
    const msgId = root.attributes('aria-describedby')
    expect(wrapper.find(`#${titleId}`).exists()).toBe(true)
    expect(wrapper.find(`#${msgId}`).exists()).toBe(true)
  })
})
