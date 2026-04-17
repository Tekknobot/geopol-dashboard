import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/gdelt': {
        target: 'https://api.gdeltproject.org',
        changeOrigin: true,
        rewrite: p => p.replace(/^\/api\/gdelt/, '')
      },
      '/api/reliefweb': {
        target: 'https://api.reliefweb.int',
        changeOrigin: true,
        rewrite: p => p.replace(/^\/api\/reliefweb/, '')
      }
    }
  }
})
