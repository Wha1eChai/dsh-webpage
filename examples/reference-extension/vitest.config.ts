import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['examples/reference-extension/tests/**/*.spec.{ts,tsx}'],
  },
})
