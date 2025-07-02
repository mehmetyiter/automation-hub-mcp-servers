import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api/n8n': {
        target: 'http://localhost:3100',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/n8n/, '')
      },
      '/api/database': {
        target: 'http://localhost:3101',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/database/, '')
      },
      '/api/auth': {
        target: 'http://localhost:3102',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/auth/, '')
      },
      '/api/make': {
        target: 'http://localhost:3103',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/make/, '')
      },
      '/api/zapier': {
        target: 'http://localhost:3104',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/zapier/, '')
      },
      '/api/vapi': {
        target: 'http://localhost:3105',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/vapi/, '')
      }
    }
  }
})