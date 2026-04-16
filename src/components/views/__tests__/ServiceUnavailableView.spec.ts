/**
 * ServiceUnavailableView Unit Tests
 *
 * Covers countdown, auto-retry, manual retry, retryAfter prop reactivity,
 * and text overrides. Store integration is covered separately in
 * AuthErrorBoundary.spec.ts.
 */

import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import ServiceUnavailableView from '../ServiceUnavailableView.vue'
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

const serviceUnavailableError: AuthError = {
  type: 'service_unavailable',
  message: 'Upstream 503'
}

describe('ServiceUnavailableView', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders countdown starting at retryAfter', () => {
    const wrapper = mount(ServiceUnavailableView, {
      props: {
        error: serviceUnavailableError,
        onRetry: vi.fn(),
        config: makeConfig(),
        retryAfter: 15
      }
    })

    expect(wrapper.get('[data-testid="countdown-text"]').text()).toContain('Retry in 15s')
  })

  it('decrements countdown each second and fires onRetry at 0', async () => {
    const onRetry = vi.fn().mockResolvedValue(undefined)
    const wrapper = mount(ServiceUnavailableView, {
      props: {
        error: serviceUnavailableError,
        onRetry,
        config: makeConfig(),
        retryAfter: 2
      }
    })

    await vi.advanceTimersByTimeAsync(1000)
    expect(wrapper.get('[data-testid="countdown-text"]').text()).toContain('Retry in 1s')

    await vi.advanceTimersByTimeAsync(1000)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('fires onRetry immediately when Try Now button is clicked', async () => {
    const onRetry = vi.fn().mockResolvedValue(undefined)
    const wrapper = mount(ServiceUnavailableView, {
      props: {
        error: serviceUnavailableError,
        onRetry,
        config: makeConfig(),
        retryAfter: 30
      }
    })

    await wrapper.get('[data-testid="try-now-button"]').trigger('click')
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('restarts countdown when retryAfter prop changes', async () => {
    const wrapper = mount(ServiceUnavailableView, {
      props: {
        error: serviceUnavailableError,
        onRetry: vi.fn(),
        config: makeConfig(),
        retryAfter: 10
      }
    })

    await vi.advanceTimersByTimeAsync(3000)
    expect(wrapper.get('[data-testid="countdown-text"]').text()).toContain('Retry in 7s')

    await wrapper.setProps({ retryAfter: 20 } as any)
    expect(wrapper.get('[data-testid="countdown-text"]').text()).toContain('Retry in 20s')
  })

  it('clears the interval on unmount', async () => {
    const onRetry = vi.fn()
    const wrapper = mount(ServiceUnavailableView, {
      props: {
        error: serviceUnavailableError,
        onRetry,
        config: makeConfig(),
        retryAfter: 5
      }
    })

    wrapper.unmount()
    await vi.advanceTimersByTimeAsync(6000)
    expect(onRetry).not.toHaveBeenCalled()
  })

  it('restarts the countdown after a failed retry when retryAfter is unchanged', async () => {
    const onRetry = vi.fn().mockResolvedValue(undefined)
    const wrapper = mount(ServiceUnavailableView, {
      props: {
        error: serviceUnavailableError,
        onRetry,
        config: makeConfig(),
        retryAfter: 4
      }
    })

    // Countdown reaches 0 → auto-retry fires. Retry promise resolves without
    // the parent unmounting us (simulating a persistent service_unavailable
    // error). The countdown should start over rather than stay at "Retry in 0s".
    await vi.advanceTimersByTimeAsync(4000)
    expect(onRetry).toHaveBeenCalledTimes(1)

    // Drain any pending microtasks from the finally-block restart.
    await vi.advanceTimersByTimeAsync(0)
    expect(wrapper.get('[data-testid="countdown-text"]').text()).toContain('Retry in 4s')
  })

  it('falls back to 30s when retryAfter is NaN', () => {
    const wrapper = mount(ServiceUnavailableView, {
      props: {
        error: serviceUnavailableError,
        onRetry: vi.fn(),
        config: makeConfig(),
        retryAfter: Number.NaN
      }
    })

    expect(wrapper.get('[data-testid="countdown-text"]').text()).toContain('Retry in 30s')
  })

  it('applies text overrides including custom countdownLabel function', () => {
    const countdownLabel = vi.fn((s: number) => `Waiting ${s} more`)
    const wrapper = mount(ServiceUnavailableView, {
      props: {
        error: serviceUnavailableError,
        onRetry: vi.fn(),
        config: makeConfig({
          text: {
            serviceUnavailable: {
              title: 'Down',
              message: 'Hang tight',
              button: 'Go',
              retryingLabel: 'Pinging...',
              countdownLabel
            }
          }
        }),
        retryAfter: 30
      }
    })

    expect(wrapper.text()).toContain('Down')
    expect(wrapper.text()).toContain('Hang tight')
    expect(wrapper.text()).toContain('Go')
    expect(wrapper.get('[data-testid="countdown-text"]').text()).toContain('Waiting 30 more')
    expect(countdownLabel).toHaveBeenCalledWith(30)
  })

  it('omits the title icon when icons.serviceUnavailable is false', () => {
    const config = makeConfig()
    config.icons.serviceUnavailable = false
    const wrapper = mount(ServiceUnavailableView, {
      props: {
        error: serviceUnavailableError,
        onRetry: vi.fn(),
        config,
        retryAfter: 10
      }
    })

    expect(wrapper.find('.bff-auth-overlay__icon').exists()).toBe(false)
  })
})
