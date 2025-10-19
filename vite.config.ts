import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Existing examples…
      // '/wb': { target: 'https://api.worldbank.org', changeOrigin: true, rewrite: p => p.replace(/^\/wb/, '') },
      // '/reliefweb': { target: 'https://api.reliefweb.int', changeOrigin: true, rewrite: p => p.replace(/^\/reliefweb/, '') },
      // '/eonet': { target: 'https://eonet.gsfc.nasa.gov', changeOrigin: true, rewrite: p => p.replace(/^\/eonet/, '') },
      // '/restcountries': { target: 'https://restcountries.com', changeOrigin: true, rewrite: p => p.replace(/^\/restcountries/, '') },

      // ✅ Add this:
      '/gdelt': {
        target: 'https://api.gdeltproject.org',
        changeOrigin: true,
        rewrite: p => p.replace(/^\/gdelt/, '')
      }
    }
  }
})
