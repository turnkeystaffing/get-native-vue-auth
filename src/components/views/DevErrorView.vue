<script setup lang="ts">
import { computed, ref } from 'vue'
import type { DevErrorViewProps } from '../../types/config'

defineOptions({ name: 'DevErrorView' })

const props = defineProps<DevErrorViewProps>()

const DEFAULT_TITLE = 'Configuration error'
const DEFAULT_MESSAGE =
  'The application is not correctly configured to connect to authentication services.'
const DEFAULT_CONTACT = 'Contact the application developer.'
const DEFAULT_SIGN_OUT = 'Sign out'

const title = computed(() => props.config.text.devError?.title ?? DEFAULT_TITLE)
const message = computed(
  () => props.config.text.devError?.message ?? props.error.message ?? DEFAULT_MESSAGE
)
const contactLine = computed(
  () => props.config.text.devError?.contactLine ?? DEFAULT_CONTACT
)
const signOutLabel = computed(
  () => props.config.text.devError?.signOut ?? DEFAULT_SIGN_OUT
)
const icon = computed(() => props.config.icons.devError)
const signOutIcon = computed(() => props.config.icons.signOut)
const code = computed(() => props.error.code ?? null)

const isLoading = ref(false)
const signOutButton = ref<HTMLButtonElement | null>(null)

defineExpose({ primaryAction: signOutButton })

async function handleClick() {
  if (isLoading.value) return
  isLoading.value = true
  try {
    await props.onSignOut()
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
    aria-labelledby="bff-auth-dev-error-title"
    aria-describedby="bff-auth-dev-error-message"
    aria-live="assertive"
    data-testid="dev-error-view"
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
        id="bff-auth-dev-error-title"
        class="bff-auth-overlay__title"
      >
        {{ title }}
      </h1>

      <p
        id="bff-auth-dev-error-message"
        class="bff-auth-overlay__message"
      >
        {{ message }}
      </p>

      <p
        class="bff-auth-overlay__message"
        data-testid="dev-error-contact-line"
      >
        {{ contactLine }}
      </p>

      <p
        v-if="code"
        class="bff-auth-overlay__code"
        data-testid="dev-error-code"
      >
        <span class="bff-auth-overlay__code-label">Error code:</span>
        <code>{{ code }}</code>
      </p>

      <div class="bff-auth-overlay__actions">
        <button
          ref="signOutButton"
          type="button"
          class="bff-auth-overlay__button bff-auth-overlay__button--primary"
          :disabled="isLoading"
          :aria-busy="isLoading"
          data-testid="dev-error-sign-out-button"
          @click="handleClick"
        >
          <span
            v-if="signOutIcon"
            class="bff-auth-overlay__button-icon"
            aria-hidden="true"
          >
            <component :is="signOutIcon" />
          </span>
          <span>{{ signOutLabel }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style src="./overlay.css"></style>

<style>
.bff-auth-overlay__code {
  margin: 0;
  font-size: 13px;
  color: var(--bff-auth-muted, #57606a);
  display: inline-flex;
  gap: 6px;
  align-items: baseline;
  flex-wrap: wrap;
  justify-content: center;
}
.bff-auth-overlay__code-label {
  font-weight: 600;
}
.bff-auth-overlay__code code {
  font-family: 'SF Mono', 'Fira Code', ui-monospace, monospace;
  background: var(--bff-auth-code-bg, color-mix(in srgb, var(--bff-auth-muted, #57606a) 10%, transparent));
  padding: 2px 6px;
  border-radius: 4px;
}
</style>
