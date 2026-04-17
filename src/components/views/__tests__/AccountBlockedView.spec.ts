/**
 * AccountBlockedView Unit Tests
 *
 * Covers rendering for both `account_inactive` and `insufficient_permissions`
 * branches (copy branches on `error.code`) and the Sign-out CTA.
 */

import { describe, it, expect, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import AccountBlockedView from '../AccountBlockedView.vue'
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

const inactiveError: AuthError = {
  type: 'account_blocked',
  message: 'Account disabled by admin',
  code: 'account_inactive'
}

const insufficientError: AuthError = {
  type: 'account_blocked',
  message: 'Access required',
  code: 'insufficient_permissions'
}

describe('AccountBlockedView — account_inactive branch', () => {
  it('renders generic "Account unavailable" copy and backend message', () => {
    const wrapper = mount(AccountBlockedView, {
      props: {
        error: inactiveError,
        onSignOut: vi.fn(),
        config: makeConfig()
      }
    })

    expect(wrapper.text()).toContain('Account unavailable')
    expect(wrapper.text()).toContain('Account disabled by admin')
  })

  it('renders Sign-out CTA and invokes onSignOut on click', async () => {
    const onSignOut = vi.fn()
    const wrapper = mount(AccountBlockedView, {
      props: {
        error: inactiveError,
        onSignOut,
        config: makeConfig()
      }
    })

    const btn = wrapper.get('[data-testid="account-blocked-sign-out-button"]')
    expect(btn.text()).toContain('Sign out')
    await btn.trigger('click')
    expect(onSignOut).toHaveBeenCalledTimes(1)
  })
})

describe('AccountBlockedView — insufficient_permissions branch', () => {
  it('renders access-required copy when code === insufficient_permissions', () => {
    const wrapper = mount(AccountBlockedView, {
      props: {
        error: insufficientError,
        onSignOut: vi.fn(),
        config: makeConfig()
      }
    })

    expect(wrapper.text()).toContain('Access required')
  })
})

describe('AccountBlockedView — overrides and ARIA', () => {
  it('applies text overrides', () => {
    const wrapper = mount(AccountBlockedView, {
      props: {
        error: inactiveError,
        onSignOut: vi.fn(),
        config: makeConfig({
          text: {
            accountBlocked: {
              title: 'Locked',
              message: 'No entry',
              signOut: 'Bail'
            }
          }
        })
      }
    })

    expect(wrapper.text()).toContain('Locked')
    expect(wrapper.text()).toContain('No entry')
    expect(wrapper.get('[data-testid="account-blocked-sign-out-button"]').text()).toContain(
      'Bail'
    )
  })

  it('has alertdialog role with matching aria ids', () => {
    const wrapper = mount(AccountBlockedView, {
      props: {
        error: inactiveError,
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
