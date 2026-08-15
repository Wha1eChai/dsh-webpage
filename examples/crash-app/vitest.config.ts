import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['examples/crash-app/tests/**/*.spec.{ts,tsx}'],
  },
})
