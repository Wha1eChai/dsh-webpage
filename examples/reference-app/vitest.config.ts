import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['examples/reference-app/tests/**/*.spec.{ts,tsx}'],
  },
})
