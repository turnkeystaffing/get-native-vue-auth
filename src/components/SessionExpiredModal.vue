<script setup lang="ts">
/**
 * SessionExpiredModal Component
 *
 * Displays a persistent modal when user session has expired,
 * prompting re-authentication via Central Login.
 *
 * @see Story 3.1: Session Expired Modal
 * @see ADR-003 Error response contract
 * @see FR11 Session expiry modal
 */

import { computed, ref } from 'vue'
import { useAuth } from '../composables/useAuth'
import { createLogger } from '@turnkeystaffing/get-native-vue-logger'

defineOptions({ name: 'SessionExpiredModal' })

const logger = createLogger('SessionExpiredModal')
const { error, login } = useAuth()

/** Loading state to prevent double-click during redirect */
const isLoading = ref(false)

/** Default message when error.message is not available */
const DEFAULT_MESSAGE = 'Your session has ended. Sign in again to continue.'

/**
 * Show modal when error type is session_expired
 * Uses computed for reactive binding to v-dialog model
 */
const showModal = computed(() => error.value?.type === 'session_expired')

/**
 * Error message to display - uses actual error message if available,
 * falls back to default message for better user context
 */
const errorMessage = computed(() =>
  error.value?.type === 'session_expired'
    ? (error.value.message || DEFAULT_MESSAGE)
    : DEFAULT_MESSAGE
)

/**
 * Handle sign in action
 * Captures current URL and redirects to Central Login
 */
function handleSignIn() {
  if (isLoading.value) return
  isLoading.value = true

  logger.info('User initiated re-authentication from session expired modal')

  try {
    // Capture current URL for return after authentication
    const returnUrl = window.location.href
    login(returnUrl)
    // Note: login() redirects - loading state won't reset on success
  } catch (err) {
    // Reset loading state if login fails (e.g., auth service unreachable)
    isLoading.value = false
    logger.error('Failed to initiate login redirect', err)
  }
}
</script>

<template>
  <v-dialog
    :model-value="showModal"
    persistent
    max-width="400"
    data-testid="session-expired-modal"
    aria-labelledby="session-expired-title"
    aria-describedby="session-expired-message"
  >
    <v-card>
      <v-card-title
        id="session-expired-title"
        class="text-h5 d-flex align-center"
      >
        <v-icon color="warning" class="mr-2">mdi-clock-alert-outline</v-icon>
        Session Expired
      </v-card-title>

      <v-card-text id="session-expired-message">
        {{ errorMessage }}
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn
          color="primary"
          variant="elevated"
          prepend-icon="mdi-login"
          :loading="isLoading"
          :disabled="isLoading"
          data-testid="session-expired-sign-in-button"
          aria-label="Sign in to continue"
          @click="handleSignIn"
        >
          Sign In
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
