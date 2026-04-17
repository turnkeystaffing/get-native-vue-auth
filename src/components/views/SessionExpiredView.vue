<script setup lang="ts">
import { computed, ref } from 'vue'
import type { SessionExpiredViewProps } from '../../types/config'

defineOptions({ name: 'SessionExpiredView' })

const props = defineProps<SessionExpiredViewProps>()

const DEFAULT_TITLE = 'Session expired'
const DEFAULT_MESSAGE = 'Your session has ended. Sign in again to continue.'
const DEFAULT_BUTTON = 'Sign in'

const title = computed(() => props.config.text.sessionExpired?.title ?? DEFAULT_TITLE)
const message = computed(
  () => props.config.text.sessionExpired?.message ?? props.error.message ?? DEFAULT_MESSAGE
)
const buttonLabel = computed(() => props.config.text.sessionExpired?.button ?? DEFAULT_BUTTON)
const icon = computed(() => props.config.icons.sessionExpired)
const loginIcon = computed(() => props.config.icons.login)

const isLoading = ref(false)
const signInButton = ref<HTMLButtonElement | null>(null)

defineExpose({ primaryAction: signInButton })

async function handleClick() {
  if (isLoading.value) return
  isLoading.value = true
  try {
    await props.onSignIn()
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div
    class="bff-auth-overlay"
    role="alertdialog"
    aria-modal="true"
    aria-labelledby="bff-auth-session-expired-title"
    aria-describedby="bff-auth-session-expired-message"
    aria-live="assertive"
    data-testid="session-expired-view"
  >
    <div class="bff-auth-overlay__content">
      <div
        v-if="icon"
        class="bff-auth-overlay__icon"
        aria-hidden="true"
      >
        <component :is="icon" />
      </div>

      <h1
        id="bff-auth-session-expired-title"
        class="bff-auth-overlay__title"
      >
        {{ title }}
      </h1>

      <p
        id="bff-auth-session-expired-message"
        class="bff-auth-overlay__message"
      >
        {{ message }}
      </p>

      <div class="bff-auth-overlay__actions">
        <button
          ref="signInButton"
          type="button"
          class="bff-auth-overlay__button bff-auth-overlay__button--primary"
          :disabled="isLoading"
          :aria-busy="isLoading"
          data-testid="session-expired-sign-in-button"
          @click="handleClick"
        >
          <span
            v-if="loginIcon"
            class="bff-auth-overlay__button-icon"
            aria-hidden="true"
          >
            <component :is="loginIcon" />
          </span>
          <span>{{ buttonLabel }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style src="./overlay.css"></style>
