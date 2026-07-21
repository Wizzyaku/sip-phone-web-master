import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('sip.js')) return 'sip-vendor';
            if (id.includes('@supabase')) return 'supabase-vendor';
            if (id.includes('lucide-react') || id.includes('axios')) return 'ui-vendor';
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) return 'react-vendor';
          }
        },
      },
    },
  },
})
