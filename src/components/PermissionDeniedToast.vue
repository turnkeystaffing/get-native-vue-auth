<script setup lang="ts">
/**
 * PermissionDeniedToast Component
 *
 * Displays a non-blocking toast notification when user attempts
 * an unauthorized action (403 error).
 *
 * @see Story 3.2: Permission Denied Toast
 * @see ADR-003 Error response contract
 * @see FR12, FR13 Permission denied UX
 */

import { computed } from 'vue'
import { useAuth } from '../composables/useAuth'
import { createLogger } from '@turnkeystaffing/get-native-vue-logger'

defineOptions({ name: 'PermissionDeniedToast' })

const logger = createLogger('PermissionDeniedToast')
const { error, clearError } = useAuth()

/** Timeout in milliseconds (5 seconds as per AC3) */
const TOAST_TIMEOUT = 5000

/** Default message when error.message is not available */
const DEFAULT_MESSAGE = 'You do not have permission to perform this action.'

/**
 * Show toast when error type is permission_denied
 * Uses computed for reactive binding to v-snackbar model
 */
const showToast = computed({
  get: () => error.value?.type === 'permission_denied',
  set: (value: boolean) => {
    // When v-snackbar sets to false (timeout or user close), clear error
    if (!value) {
      handleClose()
    }
  }
})

/**
 * Error message to display - uses actual error message if available,
 * falls back to default message for better user context
 */
const errorMessage = computed(() =>
  error.value?.type === 'permission_denied'
    ? (error.value.message || DEFAULT_MESSAGE)
    : DEFAULT_MESSAGE
)

/**
 * Handle toast close (manual or auto)
 * Clears the error state
 */
function handleClose() {
  logger.info('Permission denied toast closed')
  clearError()
}
</script>

<template>
  <v-snackbar
    v-model="showToast"
    :timeout="TOAST_TIMEOUT"
    color="warning"
    location="top"
    data-testid="permission-denied-toast"
    role="status"
    aria-live="polite"
  >
    <div class="d-flex align-center">
      <v-icon class="mr-2">mdi-shield-alert</v-icon>
      <span>{{ errorMessage }}</span>
    </div>
    <template #actions>
      <v-btn
        variant="text"
        data-testid="permission-denied-close-button"
        aria-label="Dismiss notification"
        @click="handleClose"
      >
        Close
      </v-btn>
    </template>
  </v-snackbar>
</template>
