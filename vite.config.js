import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { devAuthApi } from './scripts/dev-api.js'

export default defineConfig({
  plugins: [react(), devAuthApi()],
  build: {
    target: 'es2020',
    minify: 'esbuild',
    cssCodeSplit: true,
    sourcemap: false,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':  ['react', 'react-dom', 'react-router-dom'],
          'vendor-redux':  ['@reduxjs/toolkit', 'react-redux'],
          'vendor-motion': ['framer-motion'],
          'vendor-icons':  ['@phosphor-icons/react'],
        },
      },
    },
  },
  server: {
    host: true,
  },
})
