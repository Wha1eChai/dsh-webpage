import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['packages/webpage/tests/unit/**/*.spec.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'coverage/unit',
      include: [
        'packages/webpage/src/client/index.tsx',
        'packages/webpage/src/client/registry/**/*.ts',
        'packages/webpage/src/client/route/**/*.ts',
        'packages/webpage/src/client/outlet/**/*.{ts,tsx}',
        'packages/webpage/src/client/launcher/**/*.{ts,tsx}',
        'packages/webpage/src/client/inspector/**/*.{ts,tsx}',
      ],
      exclude: ['**/*.d.ts'],
      thresholds: {
        perFile: true,
        lines: 100,
        functions: 100,
        statements: 100,
        branches: 100,
      },
    },
  },
})
