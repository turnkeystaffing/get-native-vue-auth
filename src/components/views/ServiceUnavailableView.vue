<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import type { ServiceUnavailableViewProps } from '../../types/config'

defineOptions({ name: 'ServiceUnavailableView' })

const props = defineProps<ServiceUnavailableViewProps>()

const DEFAULT_TITLE = 'Service unavailable'
const DEFAULT_MESSAGE = "We're having trouble connecting to authentication services."
const DEFAULT_BUTTON = 'Try now'
const DEFAULT_RETRYING_LABEL = 'Retrying...'
/** Fixed countdown window (seconds) between auto-retries. */
const COUNTDOWN_SECONDS = 30
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

const countdown = ref(COUNTDOWN_SECONDS)
const isRetrying = ref(false)
const tryNowButton = ref<HTMLButtonElement | null>(null)
let intervalId: ReturnType<typeof setInterval> | null = null
let unmounted = false

defineExpose({ primaryAction: tryNowButton })

const progress = computed(() =>
  Math.min(
    100,
    Math.max(0, Math.floor(((COUNTDOWN_SECONDS - countdown.value) / COUNTDOWN_SECONDS) * 100))
  )
)

const countdownText = computed(() => countdownLabelFn.value(countdown.value))

function stopCountdown() {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
}

function startCountdown() {
  stopCountdown()
  countdown.value = COUNTDOWN_SECONDS
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
    // fresh retry window instead of a stuck "Retry in 0s".
    if (!unmounted) {
      startCountdown()
    }
  }
}

function handleTryNow() {
  void triggerRetry()
}

startCountdown()

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

      <div class="bff-auth-overlay__progress-wrapper">
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
      </div>

      <div class="bff-auth-overlay__actions">
        <button
          ref="tryNowButton"
          type="button"
          class="bff-auth-overlay__button bff-auth-overlay__button--primary"
          :class="{ 'bff-auth-overlay__button--loading': isRetrying }"
          :disabled="isRetrying"
          :aria-busy="isRetrying"
          data-testid="try-now-button"
          @click="handleTryNow"
        >
          <span
            v-if="retryIcon"
            class="bff-auth-overlay__button-icon"
            :class="{ 'bff-auth-overlay__button-icon--spin': isRetrying }"
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

<style src="./overlay.css"></style>

<style>
@keyframes bff-icon-pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

@keyframes bff-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.bff-auth-overlay__icon--danger {
  color: var(--bff-auth-danger, #d1242f);
  background: var(--bff-auth-icon-danger-bg, color-mix(in srgb, var(--bff-auth-danger, #d1242f) 10%, transparent));
  animation: bff-icon-pulse 2.5s ease-in-out infinite;
}

.bff-auth-overlay__progress-wrapper {
  width: 100%;
  max-width: 320px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  margin-top: 4px;
}

.bff-auth-overlay__progress {
  width: 100%;
  height: 6px;
  background: var(--bff-auth-progress-bg, color-mix(in srgb, var(--bff-auth-muted, #57606a) 15%, transparent));
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
  font-size: 13px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: var(--bff-auth-muted, #57606a);
}

.bff-auth-overlay__button-icon--spin {
  animation: bff-spin 0.8s linear infinite;
}

@media (prefers-color-scheme: dark) {
  .bff-auth-overlay__countdown {
    color: var(--bff-auth-muted, #8b949e);
  }
  .bff-auth-overlay__icon--danger {
    color: var(--bff-auth-danger, #f85149);
    background: var(--bff-auth-icon-danger-bg, color-mix(in srgb, var(--bff-auth-danger, #f85149) 12%, transparent));
  }
}
</style>
