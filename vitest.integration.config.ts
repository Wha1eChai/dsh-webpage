import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

const cordisEntry = resolve('packages/webpage/node_modules/@deepseek-ai/cordis/lib/index.js')
const packageEntry = (name: string) => resolve(`packages/webpage/node_modules/@deepseek-ai/${name}/lib/index.js`)

export default defineConfig({
  resolve: {
    alias: {
      '@deepseek-ai/cordis': cordisEntry,
      '@deepseek-ai/dsh-client-ui-slots': packageEntry('dsh-client-ui-slots'),
      '@deepseek-ai/dsh-client-web-react': packageEntry('dsh-client-web-react'),
      '@deepseek-ai/dsh-client-ui-primitives': packageEntry('dsh-client-ui-primitives'),
      '@deepseek-ai/dsh-client-ui-attachment': packageEntry('dsh-client-ui-attachment'),
      '@deepseek-ai/dsh-client-schema-form': packageEntry('dsh-client-schema-form'),
    },
  },
  test: {
    include: ['tests/integration/**/*.spec.{ts,tsx}'],
    environment: 'jsdom',
    isolate: true,
    fileParallelism: false,
    server: {
      deps: {
        inline: ['@deepseek-ai/dsh-client-ui-primitives', '@deepseek-ai/dsh-client-ui-attachment', 'katex'],
      },
    },
  },
})
