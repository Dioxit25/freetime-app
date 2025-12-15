import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // CRITICAL: Ensures assets are loaded correctly on static hosts
  server: {
    host: true,
    allowedHosts: true 
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  }
})