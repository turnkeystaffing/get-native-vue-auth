/**
 * PermissionDeniedView Unit Tests
 *
 * Covers rendering and the Dismiss button — the only CTA, since this is a
 * terminal per-request authorization denial (the user is authenticated, so
 * no Sign-in / Sign-out path is offered).
 */

import { describe, it, expect, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import PermissionDeniedView from '../PermissionDeniedView.vue'
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
      permissionDenied: IconStub,
      signOut: IconStub
    },
    errorViews: {},
    text: {},
    mode: 'token',
    ...overrides
  }
}

const permissionDeniedError: AuthError = {
  type: 'permission_denied',
  message: 'Cross-user action denied',
  code: 'forbidden'
}

describe('PermissionDeniedView', () => {
  it('renders title and message', () => {
    const wrapper = mount(PermissionDeniedView, {
      props: {
        error: permissionDeniedError,
        config: makeConfig()
      }
    })

    expect(wrapper.text()).toContain('Permission denied')
    expect(wrapper.text()).toContain('Cross-user action denied')
    expect(wrapper.find('[data-testid="permission-denied-dismiss-button"]').exists()).toBe(true)
  })

  it('emits `dismiss` when Dismiss is clicked', async () => {
    const wrapper = mount(PermissionDeniedView, {
      props: {
        error: permissionDeniedError,
        config: makeConfig()
      }
    })

    await wrapper.get('[data-testid="permission-denied-dismiss-button"]').trigger('click')

    expect(wrapper.emitted('dismiss')).toHaveLength(1)
  })

  it('applies text overrides', () => {
    const wrapper = mount(PermissionDeniedView, {
      props: {
        error: permissionDeniedError,
        config: makeConfig({
          text: {
            permissionDenied: {
              title: 'Not allowed',
              message: 'Ask your admin',
              dismissButton: 'OK'
            }
          }
        })
      }
    })

    expect(wrapper.text()).toContain('Not allowed')
    expect(wrapper.text()).toContain('Ask your admin')
    expect(wrapper.get('[data-testid="permission-denied-dismiss-button"]').text()).toContain('OK')
  })

  it('has alertdialog role with matching aria ids', () => {
    const wrapper = mount(PermissionDeniedView, {
      props: {
        error: permissionDeniedError,
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
