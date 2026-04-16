<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { ServiceUnavailableViewProps } from '../../types/config'

defineOptions({ name: 'ServiceUnavailableView' })

const props = defineProps<ServiceUnavailableViewProps>()

const DEFAULT_TITLE = 'Service unavailable'
const DEFAULT_MESSAGE = "We're having trouble connecting to authentication services."
const DEFAULT_BUTTON = 'Try now'
const DEFAULT_RETRYING_LABEL = 'Retrying...'
const defaultCountdownLabel = (seconds: number) => `Retry in ${seconds}s`

const title = computed(() => props.config.text.serviceUnavailable?.title ?? DEFAULT_TITLE)
const message = computed(
  () =>
    props.config.text.serviceUnavailable?.message ?? props.error.message ?? DEFAULT_MESSAGE
)
const buttonLabel = computed(
  () => props.config.text.serviceUnavailable?.button ?? DEFAULT_BUTTON
)
const retryingLabel = computed(
  () => props.config.text.serviceUnavailable?.retryingLabel ?? DEFAULT_RETRYING_LABEL
)
const countdownLabelFn = computed(
  () => props.config.text.serviceUnavailable?.countdownLabel ?? defaultCountdownLabel
)
const icon = computed(() => props.config.icons.serviceUnavailable)
const retryIcon = computed(() => props.config.icons.retry)

function sanitizeSeconds(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 30
  return Math.floor(value)
}

const totalTime = ref(sanitizeSeconds(props.retryAfter))
const countdown = ref(sanitizeSeconds(props.retryAfter))
const isRetrying = ref(false)
const tryNowButton = ref<HTMLButtonElement | null>(null)
let intervalId: ReturnType<typeof setInterval> | null = null
let unmounted = false

defineExpose({ primaryAction: tryNowButton })

const progress = computed(() => {
  if (totalTime.value <= 0) return 0
  return Math.min(
    100,
    Math.max(0, Math.floor(((totalTime.value - countdown.value) / totalTime.value) * 100))
  )
})

const countdownText = computed(() => countdownLabelFn.value(countdown.value))

function stopCountdown() {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
}

function startCountdown(seconds: number) {
  stopCountdown()
  const safeSeconds = sanitizeSeconds(seconds)
  totalTime.value = safeSeconds
  countdown.value = safeSeconds
  if (safeSeconds <= 0) {
    void triggerRetry()
    return
  }
  intervalId = setInterval(() => {
    if (countdown.value > 0) {
      countdown.value--
      if (countdown.value === 0) {
        stopCountdown()
        void triggerRetry()
      }
    }
  }, 1000)
}

async function triggerRetry() {
  if (isRetrying.value) return
  isRetrying.value = true
  stopCountdown()
  try {
    await props.onRetry()
  } finally {
    isRetrying.value = false
    // If we're still mounted after the retry resolved, the parent kept the
    // service_unavailable state — restart the countdown so the user sees a
    // fresh retry window instead of a stuck "Retry in 0s". If the parent
    // updated `retryAfter` in response to the retry, the immediate-mode
    // prop watcher has already restarted us with the new value; otherwise
    // we fall back to the current value here.
    if (!unmounted) {
      startCountdown(props.retryAfter)
    }
  }
}

function handleTryNow() {
  void triggerRetry()
}

watch(
  () => props.retryAfter,
  (seconds) => {
    startCountdown(seconds)
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  unmounted = true
  stopCountdown()
})
</script>

<template>
  <div
    class="bff-auth-overlay"
    role="alertdialog"
    aria-modal="true"
    aria-labelledby="bff-auth-service-unavailable-title"
    aria-describedby="bff-auth-service-unavailable-message"
    aria-live="assertive"
    data-testid="service-unavailable-view"
  >
    <div class="bff-auth-overlay__content">
      <div
        v-if="icon"
        class="bff-auth-overlay__icon bff-auth-overlay__icon--danger"
        aria-hidden="true"
      >
        <component :is="icon" />
      </div>

      <h1
        id="bff-auth-service-unavailable-title"
        class="bff-auth-overlay__title"
      >
        {{ title }}
      </h1>

      <p
        id="bff-auth-service-unavailable-message"
        class="bff-auth-overlay__message"
      >
        {{ message }}
      </p>

      <div
        class="bff-auth-overlay__progress"
        role="progressbar"
        :aria-valuenow="progress"
        aria-valuemin="0"
        aria-valuemax="100"
        data-testid="countdown-progress-bar"
      >
        <div
          class="bff-auth-overlay__progress-bar"
          :style="{ width: progress + '%' }"
        />
      </div>

      <p
        class="bff-auth-overlay__countdown"
        data-testid="countdown-text"
      >
        <template v-if="isRetrying">
          {{ retryingLabel }}
        </template>
        <template v-else>
          {{ countdownText }}
        </template>
      </p>

      <div class="bff-auth-overlay__actions">
        <button
          ref="tryNowButton"
          type="button"
          class="bff-auth-overlay__button bff-auth-overlay__button--primary"
          :disabled="isRetrying"
          :aria-busy="isRetrying"
          data-testid="try-now-button"
          @click="handleTryNow"
        >
          <span
            v-if="retryIcon"
            class="bff-auth-overlay__button-icon"
            aria-hidden="true"
          >
            <component :is="retryIcon" />
          </span>
          <span>{{ buttonLabel }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bff-auth-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--bff-auth-z-index, 2147483000);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--bff-auth-bg, #ffffff);
  color: var(--bff-auth-fg, #1f2328);
  font-family: var(--bff-auth-font-family, inherit);
  overflow: auto;
}

.bff-auth-overlay__content {
  width: 100%;
  max-width: var(--bff-auth-max-width, 480px);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.bff-auth-overlay__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  color: var(--bff-auth-accent, #2563eb);
}

.bff-auth-overlay__icon--danger {
  color: var(--bff-auth-danger, #d1242f);
}

.bff-auth-overlay__icon :deep(svg) {
  width: 100%;
  height: 100%;
}

.bff-auth-overlay__title {
  margin: 0;
  font-size: 24px;
  line-height: 1.2;
  font-weight: 600;
  color: var(--bff-auth-fg, #1f2328);
}

.bff-auth-overlay__message {
  margin: 0;
  font-size: 16px;
  line-height: 1.5;
  color: var(--bff-auth-muted, #57606a);
}

.bff-auth-overlay__progress {
  width: 100%;
  max-width: 320px;
  height: 8px;
  background: color-mix(in srgb, var(--bff-auth-muted, #57606a) 20%, transparent);
  border-radius: 999px;
  overflow: hidden;
}

.bff-auth-overlay__progress-bar {
  height: 100%;
  background: var(--bff-auth-accent, #2563eb);
  border-radius: inherit;
  transition: width 1s linear;
}

.bff-auth-overlay__countdown {
  margin: 0;
  font-size: 14px;
  color: var(--bff-auth-muted, #57606a);
}

.bff-auth-overlay__actions {
  margin-top: 8px;
  display: flex;
  justify-content: center;
  gap: 12px;
}

.bff-auth-overlay__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 40px;
  padding: 0 20px;
  border: 1px solid transparent;
  border-radius: 8px;
  font: inherit;
  font-size: 15px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  transition: background-color 120ms ease, opacity 120ms ease;
}

.bff-auth-overlay__button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.bff-auth-overlay__button--primary {
  background: var(--bff-auth-accent, #2563eb);
  color: var(--bff-auth-accent-fg, #ffffff);
}

.bff-auth-overlay__button--primary:hover:not(:disabled),
.bff-auth-overlay__button--primary:focus-visible {
  background: color-mix(in srgb, var(--bff-auth-accent, #2563eb) 88%, black);
}

.bff-auth-overlay__button:focus-visible {
  outline: 2px solid var(--bff-auth-accent, #2563eb);
  outline-offset: 2px;
}

.bff-auth-overlay__button-icon {
  display: inline-flex;
  width: 18px;
  height: 18px;
}

.bff-auth-overlay__button-icon :deep(svg) {
  width: 100%;
  height: 100%;
}

@media (prefers-color-scheme: dark) {
  .bff-auth-overlay {
    background: var(--bff-auth-bg, #0d1117);
    color: var(--bff-auth-fg, #e6edf3);
  }
  .bff-auth-overlay__title {
    color: var(--bff-auth-fg, #e6edf3);
  }
  .bff-auth-overlay__message,
  .bff-auth-overlay__countdown {
    color: var(--bff-auth-muted, #8b949e);
  }
}
</style>
