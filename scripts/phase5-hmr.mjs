import { runHmrScenario } from '../tests/browser/phase5-hmr.e2e.mjs'

try {
  await runHmrScenario()
} catch (error) {
  console.error(error instanceof Error ? error.stack : error)
  process.exitCode = 1
}
