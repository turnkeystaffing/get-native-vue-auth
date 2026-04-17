<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ServerErrorViewProps } from '../../types/config'

defineOptions({ name: 'ServerErrorView' })

const props = defineProps<ServerErrorViewProps>()
const emit = defineEmits<{
  dismiss: []
}>()

const DEFAULT_TITLE = 'Something went wrong'
const DEFAULT_MESSAGE =
  'An unexpected error occurred. Please contact your administrator for assistance.'
const DEFAULT_DISMISS = 'Dismiss'

const title = computed(() => props.config.text.serverError?.title ?? DEFAULT_TITLE)
const message = computed(
  () => props.config.text.serverError?.message ?? props.error.message ?? DEFAULT_MESSAGE
)
const dismissLabel = computed(
  () => props.config.text.serverError?.dismissButton ?? DEFAULT_DISMISS
)
const icon = computed(() => props.config.icons.serverError)

const dismissButton = ref<HTMLButtonElement | null>(null)

defineExpose({ primaryAction: dismissButton })

function handleDismiss() {
  emit('dismiss')
}
</script>

<template>
  <div
    class="bff-auth-overlay"
    role="alertdialog"
    aria-modal="true"
    aria-labelledby="bff-auth-server-error-title"
    aria-describedby="bff-auth-server-error-message"
    aria-live="assertive"
    data-testid="server-error-view"
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
        id="bff-auth-server-error-title"
        class="bff-auth-overlay__title"
      >
        {{ title }}
      </h1>

      <p
        id="bff-auth-server-error-message"
        class="bff-auth-overlay__message"
      >
        {{ message }}
      </p>

      <div class="bff-auth-overlay__actions">
        <button
          ref="dismissButton"
          type="button"
          class="bff-auth-overlay__button bff-auth-overlay__button--primary"
          data-testid="server-error-dismiss-button"
          @click="handleDismiss"
        >
          <span>{{ dismissLabel }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style src="./overlay.css"></style>
