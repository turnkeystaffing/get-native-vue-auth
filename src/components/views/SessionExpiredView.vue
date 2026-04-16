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
  .bff-auth-overlay__message {
    color: var(--bff-auth-muted, #8b949e);
  }
}
</style>
