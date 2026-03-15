import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
const repository = process.env.GITHUB_REPOSITORY?.split('/')[1]
const pagesBase = repository ? `/${repository}/` : '/'
const apiTarget = process.env.VITE_API_TARGET || 'http://127.0.0.1:8787'

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? pagesBase : '/',
  plugins: [vue()],
  server: {
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
})
