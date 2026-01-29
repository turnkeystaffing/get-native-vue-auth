<script setup lang="ts">
/**
 * ServiceUnavailableOverlay Component
 *
 * Displays a full-screen overlay when auth service is unavailable,
 * with automatic retry countdown and manual retry option.
 *
 * @see Story 3.3: Service Unavailable Overlay
 * @see ADR-003 Error response contract
 * @see FR14, FR15, FR16 Service unavailability UX
 */

import { computed, ref, watch, onUnmounted } from 'vue'
import { VOverlay, VCard, VCardTitle, VCardText, VCardActions, VIcon, VProgressLinear, VBtn } from 'vuetify/components'
import { useAuth } from '../composables/useAuth'
import { useAuthStore } from '../stores/auth'
import { authService } from '../services/auth'
import { createLogger } from '@turnkeystaffing/get-native-vue-logger'

defineOptions({ name: 'ServiceUnavailableOverlay' })

const logger = createLogger('ServiceUnavailableOverlay')
const { error } = useAuth()
const authStore = useAuthStore()

/** Default countdown in seconds when retryAfter not provided */
const DEFAULT_COUNTDOWN = 30

/** Countdown timer state */
const countdown = ref(DEFAULT_COUNTDOWN)
const totalTime = ref(DEFAULT_COUNTDOWN)
const isRetrying = ref(false)
let countdownInterval: ReturnType<typeof setInterval> | null = null

/** Default message when error.message is not available */
const DEFAULT_MESSAGE = "We're having trouble connecting to authentication services."

/**
 * Show overlay when error type is service_unavailable
 * Uses computed for reactive binding to v-overlay model
 */
const showOverlay = computed(() => error.value?.type === 'service_unavailable')

/**
 * Error message to display - uses actual error message if available,
 * falls back to default message for better user context
 */
const errorMessage = computed(() =>
  error.value?.type === 'service_unavailable'
    ? (error.value.message || DEFAULT_MESSAGE)
    : DEFAULT_MESSAGE
)

/**
 * Progress percentage for countdown bar (0 to 100)
 * Starts at 0 and fills to 100 as countdown progresses
 */
const progress = computed(() => {
  if (totalTime.value === 0) return 0
  return Math.floor(((totalTime.value - countdown.value) / totalTime.value) * 100)
})

/**
 * Start countdown timer
 * @param seconds - countdown duration in seconds
 */
function startCountdown(seconds: number) {
  stopCountdown() // Clear any existing interval

  totalTime.value = seconds
  countdown.value = seconds

  countdownInterval = setInterval(() => {
    if (countdown.value > 0) {
      countdown.value--

      // Trigger auto-retry when countdown reaches 0
      if (countdown.value === 0) {
        triggerRetry()
      }
    }
  }, 1000)
}

/**
 * Stop countdown timer
 */
function stopCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval)
    countdownInterval = null
  }
}

/**
 * Trigger auth service retry
 * Used for both manual "Try Now" and automatic countdown retry
 */
async function triggerRetry() {
  if (isRetrying.value) return

  isRetrying.value = true
  stopCountdown()

  logger.info('Attempting auth service retry')

  try {
    // Check if auth service is back online via authService.checkAuth()
    // This is a lightweight connectivity check - not full auth initialization
    const result = await authService.checkAuth()

    // If checkAuth succeeds, auth service is back online
    // Clear the error state to dismiss the overlay
    authStore.clearError()
    logger.info('Auth service retry successful', { isAuthenticated: result.isAuthenticated })
  } catch (err) {
    logger.warn('Auth service retry failed, restarting countdown', err)

    // Retry failed - restart countdown
    // Use retryAfter from new error if available, else default
    const newRetryAfter = error.value?.retryAfter ?? DEFAULT_COUNTDOWN
    startCountdown(newRetryAfter)
  } finally {
    isRetrying.value = false
  }
}

/**
 * Handle "Try Now" button click
 * Manual retry triggered by user
 */
function handleTryNow() {
  logger.info('User initiated manual retry from service unavailable overlay')
  triggerRetry()
}

/**
 * Watch for error state changes to start/stop countdown
 */
watch(
  () => error.value,
  (newError) => {
    if (newError?.type === 'service_unavailable') {
      const retrySeconds = newError.retryAfter ?? DEFAULT_COUNTDOWN
      logger.info(`Auth service unavailable, starting countdown: ${retrySeconds}s`)
      startCountdown(retrySeconds)
    } else {
      stopCountdown()
    }
  },
  { immediate: true }
)

/**
 * Cleanup interval on component unmount
 */
onUnmounted(() => {
  stopCountdown()
})
</script>

<template>
  <v-overlay
    :model-value="showOverlay"
    persistent
    class="align-center justify-center"
    scrim="rgba(0, 0, 0, 0.8)"
    data-testid="service-unavailable-overlay"
    role="alertdialog"
    aria-modal="true"
    aria-labelledby="service-unavailable-title"
    aria-describedby="service-unavailable-message"
    aria-live="assertive"
  >
    <v-card
      max-width="450"
      class="pa-4"
      elevation="24"
    >
      <v-card-title
        id="service-unavailable-title"
        class="text-h5 d-flex align-center justify-center"
      >
        <v-icon color="error" size="32" class="mr-2">mdi-cloud-off-outline</v-icon>
        Service Issue
      </v-card-title>

      <v-card-text id="service-unavailable-message" class="text-center">
        <p class="text-body-1 mb-4">{{ errorMessage }}</p>
        <p class="text-body-2 text-medium-emphasis mb-4">Retrying automatically...</p>

        <!-- Countdown Progress Bar -->
        <v-progress-linear
          :model-value="progress"
          color="primary"
          height="8"
          rounded
          class="mb-2"
          data-testid="countdown-progress-bar"
        />

        <!-- Countdown Text -->
        <p
          class="text-body-2 text-medium-emphasis"
          data-testid="countdown-text"
          :aria-label="`Retry in ${countdown} seconds`"
        >
          Retry in {{ countdown }}s
        </p>
      </v-card-text>

      <v-card-actions class="justify-center">
        <v-btn
          color="primary"
          variant="elevated"
          prepend-icon="mdi-refresh"
          :loading="isRetrying"
          :disabled="isRetrying"
          data-testid="try-now-button"
          aria-label="Try connecting now"
          @click="handleTryNow"
        >
          Try Now
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-overlay>
</template>
