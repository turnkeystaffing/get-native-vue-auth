import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import { resolve } from 'path'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  root: resolve(__dirname, 'demo'),
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@turnkeystaffing/get-native-vue-logger': resolve(__dirname, 'demo/logger-stub.ts')
    }
  }
})
