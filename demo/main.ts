import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { bffAuthPlugin } from '../src/index'
import router from './router'
import App from './App.vue'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(bffAuthPlugin, {
  bffBaseUrl: 'https://demo.example.com',
  clientId: 'demo-app',
  // Demonstrates consumer overrides — a made-up code routed to server_error.
  errorCodeOverrides: {
    my_custom_code: 'server_error'
  },
  // Demonstrates drift observability — fires for any unmapped error code.
  onUnmappedError: (code, status, error) => {
    console.warn('[demo] onUnmappedError hook fired', { code, status, error })
  }
})

app.mount('#app')
