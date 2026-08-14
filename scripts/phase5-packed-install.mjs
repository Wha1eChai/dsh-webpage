import { createPackedWebProfile, phase5PackageNames } from '../tests/phase5/packed-profile.mjs'

let fixture
try {
  fixture = await createPackedWebProfile()
  console.log(`Verified external DSH CLI: ${fixture.dsh.version}`)
  console.log(`Verified one-install Pack dependency: ${phase5PackageNames.pack}`)
  console.log(`Verified profile bundle order: @deepseek-ai/dsh-base -> @deepseek-ai/dsh-web-app -> ${phase5PackageNames.pack}`)
  console.log(`Verified packed package roots under disposable temp: ${Object.values(fixture.packageRoots).join(', ')}`)
  console.log('Verified dump-config contains one ordered webpage, reference App, and reference extension row.')
  console.log('Phase 5 real packed-install/profile verification passed.')
} catch (error) {
  console.error(error instanceof Error ? error.stack : error)
  process.exitCode = 1
} finally {
  await fixture?.dispose()
}
