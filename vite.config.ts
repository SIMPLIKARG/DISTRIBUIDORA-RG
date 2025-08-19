import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    allowedHosts: 'all'
  },
  preview: {
    port: process.env.PORT ? parseInt(process.env.PORT) : 8080,
    host: true,
    allowedHosts: [
      'healthcheck.railway.app',
      '.railway.app',
      'localhost',
      '127.0.0.1',
      '0.0.0.0'
    ]
  }
})