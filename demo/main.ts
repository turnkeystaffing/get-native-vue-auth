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
  clientId: 'demo-app'
})

app.mount('#app')
