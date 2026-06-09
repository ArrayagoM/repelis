import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    css: false,
    coverage: {
      reporter: ['text', 'html'],
      exclude: ['node_modules/', 'dist/', '**/*.test.{js,jsx}', 'src/test/'],
    },
  },
})
