/**
 * ServerErrorView Unit Tests
 *
 * Covers rendering and the Dismiss button — the only CTA since
 * `AuthError` no longer carries auxiliary fields.
 */

import { describe, it, expect, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import ServerErrorView from '../ServerErrorView.vue'
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

const serverError: AuthError = {
  type: 'server_error',
  message: 'Internal server error',
  code: 'internal_error'
}

describe('ServerErrorView', () => {
  it('renders title and message', () => {
    const wrapper = mount(ServerErrorView, {
      props: {
        error: serverError,
        config: makeConfig()
      }
    })

    expect(wrapper.text()).toContain('Something went wrong')
    expect(wrapper.text()).toContain('Internal server error')
    // Always renders a Dismiss button as the primary CTA.
    expect(wrapper.find('[data-testid="server-error-dismiss-button"]').exists()).toBe(true)
  })

  it('emits `dismiss` when Dismiss is clicked', async () => {
    const wrapper = mount(ServerErrorView, {
      props: {
        error: serverError,
        config: makeConfig()
      }
    })

    await wrapper.get('[data-testid="server-error-dismiss-button"]').trigger('click')

    expect(wrapper.emitted('dismiss')).toHaveLength(1)
  })

  it('applies text overrides', () => {
    const wrapper = mount(ServerErrorView, {
      props: {
        error: serverError,
        config: makeConfig({
          text: {
            serverError: {
              title: 'Ouch',
              message: 'Please try later',
              dismissButton: 'Close'
            }
          }
        })
      }
    })

    expect(wrapper.text()).toContain('Ouch')
    expect(wrapper.text()).toContain('Please try later')
    expect(wrapper.get('[data-testid="server-error-dismiss-button"]').text()).toContain('Close')
  })

  it('has alertdialog role with matching aria ids', () => {
    const wrapper = mount(ServerErrorView, {
      props: {
        error: serverError,
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
