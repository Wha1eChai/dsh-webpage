import { runScenarios } from '../tests/browser/phase5-web.e2e.mjs'

try {
  await runScenarios()
} catch (error) {
  console.error(error instanceof Error ? error.stack : error)
  process.exitCode = 1
}
