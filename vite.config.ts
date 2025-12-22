import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    // Node environment is enough for current tests (they mock localStorage manually)
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: [],
    reporters: 'default',
  },
})
