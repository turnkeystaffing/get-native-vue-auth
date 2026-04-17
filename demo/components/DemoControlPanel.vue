<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '../../src/stores/auth'

const authStore = useAuthStore()
const insufficientPermissions = ref(false)
const lastDriftLog = ref<string>('')

const cssVars = ref({
  '--bff-auth-bg': '#ffffff',
  '--bff-auth-fg': '#1f2328',
  '--bff-auth-muted': '#57606a',
  '--bff-auth-accent': '#2563eb',
  '--bff-auth-accent-fg': '#ffffff',
  '--bff-auth-danger': '#d1242f',
  '--bff-auth-surface': '#ffffff',
  '--bff-auth-border': 'rgba(0,0,0,0.08)',
  '--bff-auth-backdrop': 'rgba(0,0,0,0.45)',
  '--bff-auth-radius': '20px',
  '--bff-auth-button-radius': '12px',
  '--bff-auth-max-width': '480px'
})

const darkMode = ref(false)

function triggerSessionExpired() {
  authStore.setError({
    type: 'session_expired',
    message: 'Your session has expired. Please sign in again.',
    code: 'invalid_token'
  })
}

function triggerServiceUnavailable() {
  authStore.setError({
    type: 'service_unavailable',
    message: 'Authentication service is temporarily unavailable.',
    code: 'rate_limit_exceeded'
  })
}

function triggerDevError() {
  authStore.setError({
    type: 'dev_error',
    message: 'The OAuth client is not allowed this grant type.',
    code: 'invalid_client'
  })
}

function triggerAccountBlocked() {
  if (insufficientPermissions.value) {
    authStore.setError({
      type: 'account_blocked',
      message: "You don't have access to this feature.",
      code: 'insufficient_permissions'
    })
  } else {
    authStore.setError({
      type: 'account_blocked',
      message: 'Your account has been disabled.',
      code: 'account_inactive'
    })
  }
}

function triggerServerError() {
  authStore.setError({
    type: 'server_error',
    message: 'An unexpected error occurred.',
    code: 'internal_error'
  })
}

function triggerUnmappedCode() {
  // Simulates an unmapped-403 response in dev mode so consumers can watch the
  // plugin's `onUnmappedError` hook fire + console.warn. The overlay does NOT
  // render (intentional) — the dev console is the observable surface.
  const fakeCode = 'totally_unmapped_code'
  lastDriftLog.value = `onUnmappedError(${fakeCode}, 403) — check console.warn`
  console.warn('[demo] simulated unmapped 403', { code: fakeCode, status: 403 })
}

function triggerOverrideDemo() {
  // Demonstrates `errorCodeOverrides`: a custom backend code routed to
  // server_error via consumer plugin config. Here we set the resolved state
  // directly to show the overlay the override would produce.
  authStore.setError({
    type: 'server_error',
    message: 'Custom consumer code routed via errorCodeOverrides.',
    code: 'my_custom_code'
  })
}

function clearError() {
  authStore.clearError()
}

function applyTheme() {
  const root = document.documentElement
  for (const [key, value] of Object.entries(cssVars.value)) {
    root.style.setProperty(key, value)
  }
}

function toggleDarkMode() {
  darkMode.value = !darkMode.value
  if (darkMode.value) {
    cssVars.value = {
      '--bff-auth-bg': '#0d1117',
      '--bff-auth-fg': '#e6edf3',
      '--bff-auth-muted': '#8b949e',
      '--bff-auth-accent': '#58a6ff',
      '--bff-auth-accent-fg': '#ffffff',
      '--bff-auth-danger': '#f85149',
      '--bff-auth-surface': '#161b22',
      '--bff-auth-border': 'rgba(255,255,255,0.08)',
      '--bff-auth-backdrop': 'rgba(0,0,0,0.6)',
      '--bff-auth-radius': '20px',
      '--bff-auth-button-radius': '12px',
      '--bff-auth-max-width': '480px'
    }
  } else {
    cssVars.value = {
      '--bff-auth-bg': '#ffffff',
      '--bff-auth-fg': '#1f2328',
      '--bff-auth-muted': '#57606a',
      '--bff-auth-accent': '#2563eb',
      '--bff-auth-accent-fg': '#ffffff',
      '--bff-auth-danger': '#d1242f',
      '--bff-auth-surface': '#ffffff',
      '--bff-auth-border': 'rgba(0,0,0,0.08)',
      '--bff-auth-backdrop': 'rgba(0,0,0,0.45)',
      '--bff-auth-radius': '20px',
      '--bff-auth-button-radius': '12px',
      '--bff-auth-max-width': '480px'
    }
  }
  applyTheme()
}

function resetTheme() {
  const root = document.documentElement
  for (const key of Object.keys(cssVars.value)) {
    root.style.removeProperty(key)
  }
  darkMode.value = false
  cssVars.value = {
    '--bff-auth-bg': '#ffffff',
    '--bff-auth-fg': '#1f2328',
    '--bff-auth-muted': '#57606a',
    '--bff-auth-accent': '#2563eb',
    '--bff-auth-accent-fg': '#ffffff',
    '--bff-auth-danger': '#d1242f',
    '--bff-auth-surface': '#ffffff',
    '--bff-auth-border': 'rgba(0,0,0,0.08)',
    '--bff-auth-backdrop': 'rgba(0,0,0,0.45)',
    '--bff-auth-radius': '20px',
    '--bff-auth-button-radius': '12px',
    '--bff-auth-max-width': '480px'
  }
}
</script>

<template>
  <div class="demo-panel">
    <h1>Auth Plugin Demo</h1>

    <section class="demo-section">
      <h2>Trigger Error States</h2>
      <div class="button-group">
        <button
          class="btn btn-warning"
          @click="triggerSessionExpired"
        >
          Session Expired
        </button>
        <button
          class="btn btn-danger"
          @click="triggerServiceUnavailable"
        >
          Service Unavailable (429)
        </button>
        <button
          class="btn btn-muted"
          @click="triggerDevError"
        >
          Dev Error (invalid_client)
        </button>
        <button
          class="btn btn-muted"
          @click="triggerAccountBlocked"
        >
          Account Blocked
        </button>
        <button
          class="btn btn-muted"
          @click="triggerServerError"
        >
          Server Error
        </button>
        <button
          class="btn btn-muted"
          @click="triggerUnmappedCode"
        >
          Unmapped 403 (drift demo)
        </button>
        <button
          class="btn btn-muted"
          @click="triggerOverrideDemo"
        >
          errorCodeOverrides demo
        </button>
        <button
          class="btn btn-clear"
          :disabled="!authStore.hasError"
          @click="clearError"
        >
          Clear Error
        </button>
      </div>
    </section>

    <section class="demo-section">
      <h2>Account Blocked variant</h2>
      <label class="toggle-row">
        <input
          v-model="insufficientPermissions"
          type="checkbox"
        >
        <span>Use insufficient_permissions (swaps copy)</span>
      </label>
    </section>

    <section
      v-if="lastDriftLog"
      class="demo-section"
    >
      <h2>Last Drift Log</h2>
      <pre class="state-display">{{ lastDriftLog }}</pre>
    </section>

    <section class="demo-section">
      <h2>Current Store State</h2>
      <pre class="state-display">{{ JSON.stringify({
        error: authStore.error,
        isAuthenticated: authStore.isAuthenticated,
        isLoading: authStore.isLoading,
        hasError: authStore.hasError
      }, null, 2) }}</pre>
    </section>

    <section class="demo-section">
      <h2>Theme Controls</h2>
      <div
        class="button-group"
        style="margin-bottom: 12px;"
      >
        <button
          class="btn"
          :class="darkMode ? 'btn-warning' : 'btn-muted'"
          @click="toggleDarkMode"
        >
          {{ darkMode ? 'Light Mode' : 'Dark Mode' }}
        </button>
        <button
          class="btn btn-clear"
          @click="resetTheme"
        >
          Reset Theme
        </button>
      </div>
      <div class="theme-grid">
        <label
          v-for="(value, key) in cssVars"
          :key="key"
          class="theme-field"
        >
          <span class="theme-label">{{ key }}</span>
          <div class="theme-input-row">
            <input
              v-if="/^#[0-9a-fA-F]{6}$/.test(value)"
              type="color"
              :value="value"
              class="color-input"
              @input="cssVars[key] = ($event.target as HTMLInputElement).value; applyTheme()"
            >
            <input
              type="text"
              :value="value"
              class="text-input"
              @input="cssVars[key] = ($event.target as HTMLInputElement).value; applyTheme()"
            >
          </div>
        </label>
      </div>
    </section>
  </div>
</template>

<style scoped>
.demo-panel {
  max-width: 600px;
  margin: 40px auto;
  padding: 24px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #1f2328;
}

h1 {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 24px;
}

h2 {
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #57606a;
  margin-bottom: 12px;
}

.demo-section {
  margin-bottom: 28px;
}

.button-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.btn {
  padding: 8px 16px;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  background: #f6f8fa;
  color: #1f2328;
  transition: background 0.15s;
}
.btn:hover { background: #eaeef2; }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-warning { background: #bf8700; color: #fff; border-color: #bf8700; }
.btn-warning:hover { background: #9a6700; }
.btn-danger { background: #cf222e; color: #fff; border-color: #cf222e; }
.btn-danger:hover { background: #a40e26; }
.btn-muted { background: #6e7781; color: #fff; border-color: #6e7781; }
.btn-muted:hover { background: #57606a; }
.btn-clear { background: #fff; border-color: #1f883d; color: #1f883d; }
.btn-clear:hover { background: #f0fff4; }

.slider-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.slider-row input[type="range"] { flex: 1; }
.slider-value {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  min-width: 40px;
}

.toggle-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  font-size: 13px;
  color: #57606a;
  cursor: pointer;
}
.toggle-row input[type="checkbox"] { cursor: pointer; }

.state-display {
  background: #f6f8fa;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  padding: 12px 16px;
  font-size: 13px;
  font-family: 'SF Mono', 'Fira Code', monospace;
  overflow-x: auto;
  line-height: 1.5;
}

.theme-grid {
  display: grid;
  gap: 8px;
}

.theme-field {
  display: flex;
  align-items: center;
  gap: 8px;
}

.theme-label {
  font-size: 12px;
  font-family: 'SF Mono', 'Fira Code', monospace;
  color: #57606a;
  min-width: 200px;
}

.theme-input-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
}

.color-input {
  width: 32px;
  height: 32px;
  padding: 2px;
  border: 1px solid #d0d7de;
  border-radius: 4px;
  cursor: pointer;
  background: none;
}

.text-input {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid #d0d7de;
  border-radius: 4px;
  font-size: 13px;
  font-family: 'SF Mono', 'Fira Code', monospace;
}
</style>
