/**
 * DevErrorView Unit Tests
 *
 * Covers rendering, prop-driven copy, and Sign-out CTA invocation for the
 * default dev-error (OAuth misconfiguration) view.
 */

import { describe, it, expect, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import DevErrorView from '../DevErrorView.vue'
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
}

const devError: AuthError = {
  type: 'dev_error',
  message: 'Invalid client configuration',
  code: 'invalid_client'
}

describe('DevErrorView', () => {
  it('renders default title, backend message, contact line, and code', () => {
    const wrapper = mount(DevErrorView, {
      props: {
        error: devError,
        onSignOut: vi.fn(),
        config: makeConfig()
      }
    })

    expect(wrapper.text()).toContain('Configuration error')
    expect(wrapper.text()).toContain('Invalid client configuration')
    expect(wrapper.text()).toContain('Contact the application developer.')
    const codeEl = wrapper.get('[data-testid="dev-error-code"]')
    expect(codeEl.text()).toContain('invalid_client')
  })

  it('applies text overrides', () => {
    const wrapper = mount(DevErrorView, {
      props: {
        error: devError,
        onSignOut: vi.fn(),
        config: makeConfig({
          text: {
            devError: {
              title: 'Custom Title',
              message: 'Custom message',
              contactLine: 'Custom contact',
              signOut: 'Get out'
            }
          }
        })
      }
    })

    expect(wrapper.text()).toContain('Custom Title')
    expect(wrapper.text()).toContain('Custom message')
    expect(wrapper.text()).toContain('Custom contact')
    expect(wrapper.get('[data-testid="dev-error-sign-out-button"]').text()).toContain(
      'Get out'
    )
  })

  it('omits the code block when error.code is absent', () => {
    const wrapper = mount(DevErrorView, {
      props: {
        error: { type: 'dev_error', message: 'Broken' },
        onSignOut: vi.fn(),
        config: makeConfig()
      }
    })

    expect(wrapper.find('[data-testid="dev-error-code"]').exists()).toBe(false)
  })

  it('omits the title icon when icons.devError is false', () => {
    const config = makeConfig()
    config.icons.devError = false
    const wrapper = mount(DevErrorView, {
      props: {
        error: devError,
        onSignOut: vi.fn(),
        config
      }
    })

    expect(wrapper.find('.bff-auth-overlay__icon').exists()).toBe(false)
  })

  it('invokes onSignOut when the Sign out CTA is clicked', async () => {
    const onSignOut = vi.fn()
    const wrapper = mount(DevErrorView, {
      props: {
        error: devError,
        onSignOut,
        config: makeConfig()
      }
    })

    await wrapper.get('[data-testid="dev-error-sign-out-button"]').trigger('click')
    expect(onSignOut).toHaveBeenCalledTimes(1)
  })

  it('has alertdialog role with matching aria ids', () => {
    const wrapper = mount(DevErrorView, {
      props: {
        error: devError,
        onSignOut: vi.fn(),
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
