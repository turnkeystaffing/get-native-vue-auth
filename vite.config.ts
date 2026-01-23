import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import { resolve } from 'path'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    vue(),
    dts({
      include: ['src'],
      exclude: ['src/__tests__'],
      rollupTypes: true
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'GetNativeVueAuth',
      formats: ['es'],
      fileName: () => 'index.js'
    },
    rollupOptions: {
      // Externalize peer dependencies
      external: [
        'vue',
        'pinia',
        'axios',
        'vue-router',
        'jwt-decode',
        'vuetify',
        'vuetify/components',
        'vuetify/directives',
        '@get-native/get-native-vue-logger'
      ],
      output: {
        globals: {
          vue: 'Vue',
          pinia: 'Pinia',
          axios: 'axios',
          'vue-router': 'VueRouter',
          'jwt-decode': 'jwtDecode',
          vuetify: 'Vuetify',
          '@get-native/get-native-vue-logger': 'GetNativeVueLogger'
        }
      }
    }
  }
})
