/**
 * LoginLoopView Unit Tests
 *
 * Covers the cooldown countdown (disabled sign-in until the window elapses),
 * the always-available sign-out escape, the re-enable when the cooldown lapses,
 * and text overrides. Store integration is covered in AuthErrorBoundary.spec.ts.
 */

import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import LoginLoopView from '../LoginLoopView.vue'
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
      loginLoop: IconStub,
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

const loginLoopError: AuthError = {
  type: 'service_unavailable',
  code: 'login_loop_detected',
  message: 'Too many sign-in attempts.'
}

describe('LoginLoopView', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-16T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function mountView(cooldownEndsAt: number | null, props: Record<string, unknown> = {}) {
    return mount(LoginLoopView, {
      props: {
        error: loginLoopError,
        onSignIn: vi.fn(),
        onSignOut: vi.fn(),
        cooldownEndsAt,
        config: makeConfig(),
        ...props
      }
    })
  }

  it('disables sign-in and shows a countdown while the cooldown is active', () => {
    const wrapper = mountView(Date.now() + 120_000)

    const signIn = wrapper.get('[data-testid="login-loop-sign-in-button"]')
    expect((signIn.element as HTMLButtonElement).disabled).toBe(true)
    expect(wrapper.get('[data-testid="login-loop-countdown-text"]').text()).toContain(
      'Try again in 120s'
    )
    // The countdown lives only under the progress bar — the disabled button
    // keeps its static label rather than duplicating the countdown.
    expect(signIn.text()).toBe('Sign in')
    // Sign-out is the always-available escape.
    expect(
      (wrapper.get('[data-testid="login-loop-sign-out-button"]').element as HTMLButtonElement)
        .disabled
    ).toBe(false)
  })

  it('counts the cooldown down each second', async () => {
    const wrapper = mountView(Date.now() + 120_000)

    await vi.advanceTimersByTimeAsync(1000)
    expect(wrapper.get('[data-testid="login-loop-countdown-text"]').text()).toContain(
      'Try again in 119s'
    )
  })

  it('re-enables sign-in once the cooldown elapses, without auto-redirecting', async () => {
    const onSignIn = vi.fn()
    const wrapper = mountView(Date.now() + 3000, { onSignIn })

    await vi.advanceTimersByTimeAsync(3000)

    const signIn = wrapper.get('[data-testid="login-loop-sign-in-button"]')
    expect((signIn.element as HTMLButtonElement).disabled).toBe(false)
    // The countdown UI disappears once ready.
    expect(wrapper.find('[data-testid="login-loop-countdown-text"]').exists()).toBe(false)
    // Re-enabling must not trigger a redirect on its own.
    expect(onSignIn).not.toHaveBeenCalled()

    await signIn.trigger('click')
    expect(onSignIn).toHaveBeenCalledTimes(1)
  })

  it('does not invoke onSignIn while the cooldown is still blocking', async () => {
    const onSignIn = vi.fn()
    const wrapper = mountView(Date.now() + 120_000, { onSignIn })

    await wrapper.get('[data-testid="login-loop-sign-in-button"]').trigger('click')
    expect(onSignIn).not.toHaveBeenCalled()
  })

  it('treats a null cooldown as immediately ready', () => {
    const wrapper = mountView(null)

    expect(
      (wrapper.get('[data-testid="login-loop-sign-in-button"]').element as HTMLButtonElement)
        .disabled
    ).toBe(false)
    expect(wrapper.find('[data-testid="login-loop-countdown-text"]').exists()).toBe(false)
  })

  it('invokes onSignOut when the sign-out button is clicked', async () => {
    const onSignOut = vi.fn()
    const wrapper = mountView(Date.now() + 120_000, { onSignOut })

    await wrapper.get('[data-testid="login-loop-sign-out-button"]').trigger('click')
    expect(onSignOut).toHaveBeenCalledTimes(1)
  })

  it('applies text overrides including the cooldown label', () => {
    const cooldownLabel = vi.fn((s: number) => `Hold ${s}`)
    const wrapper = mountView(Date.now() + 60_000, {
      config: makeConfig({
        text: {
          loginLoop: {
            title: 'Stuck',
            message: 'Bounced too many times',
            signIn: 'Retry login',
            signOut: 'Start over',
            cooldownLabel
          }
        }
      })
    })

    expect(wrapper.text()).toContain('Stuck')
    expect(wrapper.text()).toContain('Bounced too many times')
    expect(wrapper.get('[data-testid="login-loop-sign-out-button"]').text()).toContain('Start over')
    expect(wrapper.get('[data-testid="login-loop-countdown-text"]').text()).toContain('Hold 60')
    expect(cooldownLabel).toHaveBeenCalledWith(60)
  })

  it('clears the countdown interval on unmount', async () => {
    const wrapper = mountView(Date.now() + 120_000)
    const clearSpy = vi.spyOn(globalThis, 'clearInterval')
    wrapper.unmount()
    expect(clearSpy).toHaveBeenCalled()
  })

  it('omits the title icon when icons.loginLoop is false', () => {
    const config = makeConfig()
    config.icons.loginLoop = false
    const wrapper = mount(LoginLoopView, {
      props: {
        error: loginLoopError,
        onSignIn: vi.fn(),
        onSignOut: vi.fn(),
        cooldownEndsAt: Date.now() + 120_000,
        config
      }
    })

    expect(wrapper.find('.bff-auth-overlay__icon').exists()).toBe(false)
  })
})
