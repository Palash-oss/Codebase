import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../public',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/upload': 'http://localhost:3000',
      '/github': 'http://localhost:3000',
      '/chat': 'http://localhost:3000',
      '/api': 'http://localhost:3000',
    }
  }
})
