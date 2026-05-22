<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import type { LoginLoopViewProps } from '../../types/config'

defineOptions({ name: 'LoginLoopView' })

const props = defineProps<LoginLoopViewProps>()

const DEFAULT_TITLE = 'Trouble signing in'
const DEFAULT_MESSAGE =
  "We couldn't complete sign-in after several attempts. Wait a moment and try again, or sign out to start fresh."
const DEFAULT_SIGN_IN = 'Sign in'
const DEFAULT_SIGN_OUT = 'Sign out'
const defaultCooldownLabel = (seconds: number) => `Try again in ${seconds}s`

const title = computed(() => props.config.text.loginLoop?.title ?? DEFAULT_TITLE)
const message = computed(
  () => props.config.text.loginLoop?.message ?? props.error.message ?? DEFAULT_MESSAGE
)
const signInLabel = computed(() => props.config.text.loginLoop?.signIn ?? DEFAULT_SIGN_IN)
const signOutLabel = computed(() => props.config.text.loginLoop?.signOut ?? DEFAULT_SIGN_OUT)
const cooldownLabelFn = computed(
  () => props.config.text.loginLoop?.cooldownLabel ?? defaultCooldownLabel
)
const icon = computed(() => props.config.icons.loginLoop)
const loginIcon = computed(() => props.config.icons.login)
const signOutIcon = computed(() => props.config.icons.signOut)

// Cooldown is driven by an absolute end timestamp so the countdown stays
// accurate across re-renders and tab throttling. A null end means there's no
// active cooldown — treat sign-in as immediately available.
const now = ref(Date.now())
const initialRemainingMs =
  props.cooldownEndsAt !== null ? Math.max(0, props.cooldownEndsAt - now.value) : 0

const remainingMs = computed(() =>
  props.cooldownEndsAt !== null ? Math.max(0, props.cooldownEndsAt - now.value) : 0
)
const remainingSeconds = computed(() => Math.ceil(remainingMs.value / 1000))
const canSignIn = computed(() => props.cooldownEndsAt === null || remainingMs.value <= 0)

const progress = computed(() => {
  if (initialRemainingMs <= 0) return 100
  return Math.min(
    100,
    Math.max(0, Math.floor(((initialRemainingMs - remainingMs.value) / initialRemainingMs) * 100))
  )
})

const cooldownText = computed(() => cooldownLabelFn.value(remainingSeconds.value))

const signingIn = ref(false)
const signingOut = ref(false)
const signInButton = ref<HTMLButtonElement | null>(null)
const signOutButton = ref<HTMLButtonElement | null>(null)

// Focus whichever control is actionable: sign-out while the cooldown blocks
// sign-in, then sign-in once it re-enables.
const primaryAction = computed(() =>
  canSignIn.value ? signInButton.value : signOutButton.value
)
defineExpose({ primaryAction })

let intervalId: ReturnType<typeof setInterval> | null = null

function stopTicking() {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
}

function startTicking() {
  if (props.cooldownEndsAt === null || remainingMs.value <= 0) return
  intervalId = setInterval(() => {
    now.value = Date.now()
    if (remainingMs.value <= 0) {
      stopTicking()
    }
  }, 1000)
}

async function handleSignIn() {
  if (!canSignIn.value || signingIn.value || signingOut.value) return
  signingIn.value = true
  try {
    await props.onSignIn()
  } finally {
    // Sign-in triggers a full-page redirect on success; reset the flag only as
    // a safety net for test environments where no redirect occurs.
    signingIn.value = false
  }
}

async function handleSignOut() {
  if (signingOut.value) return
  signingOut.value = true
  try {
    await props.onSignOut()
  } finally {
    signingOut.value = false
  }
}

startTicking()

onBeforeUnmount(() => {
  stopTicking()
})
</script>

<template>
  <div
    class="bff-auth-overlay"
    role="alertdialog"
    aria-modal="true"
    aria-labelledby="bff-auth-login-loop-title"
    aria-describedby="bff-auth-login-loop-message"
    aria-live="assertive"
    data-testid="login-loop-view"
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
        id="bff-auth-login-loop-title"
        class="bff-auth-overlay__title"
      >
        {{ title }}
      </h1>

      <p
        id="bff-auth-login-loop-message"
        class="bff-auth-overlay__message"
      >
        {{ message }}
      </p>

      <div
        v-if="!canSignIn"
        class="bff-auth-overlay__progress-wrapper"
      >
        <div
          class="bff-auth-overlay__progress"
          role="progressbar"
          :aria-valuenow="progress"
          aria-valuemin="0"
          aria-valuemax="100"
          data-testid="login-loop-progress-bar"
        >
          <div
            class="bff-auth-overlay__progress-bar"
            :style="{ width: progress + '%' }"
          />
        </div>

        <p
          class="bff-auth-overlay__countdown"
          data-testid="login-loop-countdown-text"
        >
          {{ cooldownText }}
        </p>
      </div>

      <div class="bff-auth-overlay__actions">
        <button
          ref="signInButton"
          type="button"
          class="bff-auth-overlay__button bff-auth-overlay__button--primary"
          :disabled="!canSignIn || signingIn || signingOut"
          :aria-busy="signingIn"
          data-testid="login-loop-sign-in-button"
          @click="handleSignIn"
        >
          <span
            v-if="loginIcon"
            class="bff-auth-overlay__button-icon"
            aria-hidden="true"
          >
            <component :is="loginIcon" />
          </span>
          <span>{{ signInLabel }}</span>
        </button>

        <button
          ref="signOutButton"
          type="button"
          class="bff-auth-overlay__button bff-auth-overlay__button--secondary"
          :disabled="signingOut"
          :aria-busy="signingOut"
          data-testid="login-loop-sign-out-button"
          @click="handleSignOut"
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
@keyframes bff-icon-pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
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
