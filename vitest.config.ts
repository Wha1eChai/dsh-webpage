import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [{
    name: 'stub-plain-css',
    enforce: 'pre',
    resolveId(source) {
      if (source.endsWith('.css') && !source.includes('.module.css')) return '\0stub-plain-css'
    },
    load(id) {
      if (id === '\0stub-plain-css') return 'export default {}'
    },
  }],
  test: {
    server: {
      deps: {
        inline: ['@deepseek-ai/dsh-client-ui-primitives', 'katex'],
      },
    },
    include: ['packages/webpage/tests/unit/**/*.spec.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: 'coverage/unit',
      include: [
        'packages/webpage/src/index.ts',
        'packages/webpage/src/tools.ts',
        'packages/webpage/src/app-id.ts',
        'packages/webpage/src/client/index.tsx',
        'packages/webpage/src/client/open-app/**/*.{ts,tsx}',
        'packages/webpage/src/client/registry/**/*.ts',
        'packages/webpage/src/client/route/**/*.ts',
        'packages/webpage/src/client/outlet/**/*.{ts,tsx}',
        'packages/webpage/src/client/launcher/**/*.{ts,tsx}',
        'packages/webpage/src/client/inspector/**/*.{ts,tsx}',
        'packages/webpage/src/ui/**/*.{ts,tsx}',
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
