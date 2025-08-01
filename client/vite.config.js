import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  root: '.',
  publicDir: 'public',
  server: {
  port: 3000,
  host: true,
  open: false,
  allowedHosts: [
    'localhost',
    '127.0.0.1',
    '.railway.app',
    'real-time-polling-app-production-ff8b.up.railway.app'  // ← ADDED THIS
  ],
  proxy: {
    '/api': {
      target: process.env.NODE_ENV === 'production' 
        ? 'https://real-time-polling-app-production-ff8b.up.railway.app'  // ← ADDED THIS
        : 'http://localhost:5000',
      changeOrigin: true
    }
  }
},
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})

