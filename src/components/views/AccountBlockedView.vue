<script setup lang="ts">
import { computed, ref } from 'vue'
import type { AccountBlockedViewProps } from '../../types/config'

defineOptions({ name: 'AccountBlockedView' })

const props = defineProps<AccountBlockedViewProps>()

const DEFAULT_TITLE = 'Account unavailable'
const DEFAULT_MESSAGE =
  'Your account has been disabled. Please contact your administrator for assistance.'
const DEFAULT_INSUFFICIENT_TITLE = 'Access required'
const DEFAULT_INSUFFICIENT_MESSAGE =
  "You don't have access to this feature. Please request access from your administrator."
const DEFAULT_SIGN_OUT = 'Sign out'

const isInsufficientPermissions = computed(
  () => props.error.code === 'insufficient_permissions'
)

const title = computed(() => {
  if (isInsufficientPermissions.value) {
    return (
      props.config.text.accountBlocked?.insufficientPermissionsTitle ??
      DEFAULT_INSUFFICIENT_TITLE
    )
  }
  return props.config.text.accountBlocked?.title ?? DEFAULT_TITLE
})

const message = computed(() => {
  if (isInsufficientPermissions.value) {
    return (
      props.config.text.accountBlocked?.insufficientPermissionsMessage ??
      props.error.message ??
      DEFAULT_INSUFFICIENT_MESSAGE
    )
  }
  return props.config.text.accountBlocked?.message ?? props.error.message ?? DEFAULT_MESSAGE
})

const signOutLabel = computed(
  () => props.config.text.accountBlocked?.signOut ?? DEFAULT_SIGN_OUT
)
const icon = computed(() => props.config.icons.accountBlocked)
const signOutIcon = computed(() => props.config.icons.signOut)

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
    aria-labelledby="bff-auth-account-blocked-title"
    aria-describedby="bff-auth-account-blocked-message"
    aria-live="assertive"
    data-testid="account-blocked-view"
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
        id="bff-auth-account-blocked-title"
        class="bff-auth-overlay__title"
      >
        {{ title }}
      </h1>

      <p
        id="bff-auth-account-blocked-message"
        class="bff-auth-overlay__message"
      >
        {{ message }}
      </p>

      <div class="bff-auth-overlay__actions">
        <button
          ref="signOutButton"
          type="button"
          class="bff-auth-overlay__button bff-auth-overlay__button--primary"
          :disabled="isLoading"
          :aria-busy="isLoading"
          data-testid="account-blocked-sign-out-button"
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
