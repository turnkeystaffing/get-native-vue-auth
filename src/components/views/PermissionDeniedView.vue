<script setup lang="ts">
import { computed, ref } from 'vue'
import type { PermissionDeniedViewProps } from '../../types/config'

defineOptions({ name: 'PermissionDeniedView' })

const props = defineProps<PermissionDeniedViewProps>()
const emit = defineEmits<{
  dismiss: []
}>()

const DEFAULT_TITLE = 'Permission denied'
const DEFAULT_MESSAGE = "You don't have permission to perform this action."
const DEFAULT_DISMISS = 'Dismiss'

const title = computed(() => props.config.text.permissionDenied?.title ?? DEFAULT_TITLE)
const message = computed(
  () => props.config.text.permissionDenied?.message ?? props.error.message ?? DEFAULT_MESSAGE
)
const dismissLabel = computed(
  () => props.config.text.permissionDenied?.dismissButton ?? DEFAULT_DISMISS
)
const icon = computed(() => props.config.icons.permissionDenied)

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
    aria-labelledby="bff-auth-permission-denied-title"
    aria-describedby="bff-auth-permission-denied-message"
    aria-live="assertive"
    data-testid="permission-denied-view"
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
        id="bff-auth-permission-denied-title"
        class="bff-auth-overlay__title"
      >
        {{ title }}
      </h1>

      <p
        id="bff-auth-permission-denied-message"
        class="bff-auth-overlay__message"
      >
        {{ message }}
      </p>

      <div class="bff-auth-overlay__actions">
        <button
          ref="dismissButton"
          type="button"
          class="bff-auth-overlay__button bff-auth-overlay__button--primary"
          data-testid="permission-denied-dismiss-button"
          @click="handleDismiss"
        >
          <span>{{ dismissLabel }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style src="./overlay.css"></style>
