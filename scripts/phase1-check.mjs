import { readFile, readdir } from 'node:fs/promises'
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const coreDir = join(root, 'packages', 'webpage')
const coreManifestPath = join(coreDir, 'package.json')
const coreLib = join(coreDir, 'lib')
const rc6 = '0.1.0-rc.6'
const requiredScripts = [
  'build', 'typecheck', 'lint', 'test:unit', 'test:integration', 'test:browser', 'test:hmr', 'pack:verify', 'verify',
]
const staticPlatformModules = [
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-web-react', '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-attachment', '@deepseek-ai/dsh-client-schema-form',
]
const graphModules = ['@deepseek-ai/dsh-client-runtime/client']
const clientExternals = [...staticPlatformModules, ...graphModules]
const expectedClientInject = [
  '@deepseek-ai/dsh-client-runtime',
  '@deepseek-ai/dsh-client-ui-layout',
  '@deepseek-ai/dsh-client-ui-sidebar',
  '@deepseek-ai/dsh-client-locale',
  '@deepseek-ai/dsh-client-ui-primitives',
]

function fail(message) {
  throw new Error(`Phase 1 invariant failed: ${message}`)
}

async function json(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

function assert(condition, message) {
  if (!condition) fail(message)
}

function allDependencyEntries(manifest) {
  return Object.entries({
    ...manifest.dependencies,
    ...manifest.optionalDependencies,
    ...manifest.peerDependencies,
    ...manifest.devDependencies,
  })
}

async function assertManifest() {
  const rootManifest = await json(join(root, 'package.json'))
  assert(rootManifest.packageManager === 'pnpm@11.7.0', 'root packageManager must be pnpm@11.7.0')
  assert(rootManifest.engines?.node === '^22.19.0 || >=24.0.0', 'root Node engine is not the frozen range')
  for (const name of requiredScripts) assert(typeof rootManifest.scripts?.[name] === 'string', `missing root script ${name}`)

  const core = await json(coreManifestPath)
  assert(core.name === '@dshapps/webpage', 'core package name changed')
  assert(core.private !== true, 'core must remain future-publishable')
  assert(core.dsh?.client?.platform === 'web', 'core dsh.client.platform must be web')
  assert(core.dsh?.bundle?.patch === './cordis.patch.yml', 'core dsh.bundle.patch is missing')
  assert(Array.isArray(core.files) && core.files.includes('README.md') && core.files.includes('LICENSE'), 'core files allowlist must include README.md and LICENSE')
  assert(core.files.length > 0 && !core.files.includes('src'), 'core files allowlist must be explicit')
  assert(core.exports?.['.']?.import === './lib/index.js', 'core root import export is not built')
  assert(core.exports?.['./invariant']?.default === './lib/invariant.js', 'core invariant export is not built')
  assert(core.exports?.['./client']?.default === './lib/client.js', 'core client export is not built')
  assert(core.exports?.['./ui']?.default === './lib/ui.js', 'core ui export is not built')
  assert(core.files.includes('lib/ui.js'), 'core files allowlist must include lib/ui.js')
  assert(
    JSON.stringify(core.dsh?.client?.inject) === JSON.stringify(expectedClientInject),
    `core dsh.client.inject must match the used Phase 3 client graph: ${expectedClientInject.join(', ')}`,
  )

  for (const [name, version] of allDependencyEntries(core)) {
    if (/^@deepseek-ai\/dsh(?:-|$)/.test(name)) assert(version === rc6, `${name} must be pinned to ${rc6}, got ${version}`)
    if (name === '@deepseek-ai/cordis') assert(version === '4.0.1', `${name} must be pinned to 4.0.1, got ${version}`)
    assert(!String(version).startsWith('workspace:'), `core dependency ${name} leaks a workspace range`)
  }

  for (const dir of ['reference-app', 'reference-extension', 'reference-pack', 'crash-app']) {
    const manifest = await json(join(root, 'examples', dir, 'package.json'))
    assert(manifest.private === true, `${dir} must be private`)
  }
  const patch = await readFile(join(coreDir, 'cordis.patch.yml'), 'utf8')
  assert(patch.includes("name: '@dshapps/webpage'"), 'core patch must insert the core plugin')
}

async function sourceFiles(dir) {
  const result = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'lib' || entry.name === '.git') continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) result.push(...await sourceFiles(path))
    else if (/\.(?:ts|tsx|css|mjs|json)$/.test(entry.name)) result.push(path)
  }
  return result
}

async function assertSources() {
  const files = await sourceFiles(root)
  for (const file of files) {
    if (file === join(root, 'scripts', 'phase1-check.mjs')) continue
    const text = await readFile(file, 'utf8')
    assert(!text.includes('deepseek-harness'), `source references adjacent checkout: ${file}`)
    assert(!/react-router|tailwindcss|@mui\//i.test(text), `forbidden UI/router dependency in ${file}`)
  }
  const preset = await readFile(join(root, 'tsdown.client.ts'), 'utf8')
  assert(preset.includes('window.__ModuleLoader__.load'), 'local preset lacks Loader handoff')
  assert(preset.includes('lightningcss') && preset.includes('CLIENT_EXTERNALS'), 'local preset lacks CSS/external contract')
  assert(preset.includes("name: 'dsh-client-bundle-purity'"), 'local preset lacks the client bundle purity gate')
  assert(preset.includes('codeSplitting: false'), 'client preset must disable code splitting; the DSH Loader cannot load async chunks')
  for (const module of clientExternals) assert(preset.includes(`'${module}'`), `local preset lacks external ${module}`)
  assert(preset.includes('GRAPH_MODULES'), 'runtime/client must be classified as a graph-row external, not a static seed')
  const locale = await readFile(join(coreDir, 'src', 'client', 'locales.ts'), 'utf8')
  assert(locale.includes('zh') && locale.includes('en') && /[\u4e00-\u9fff]/u.test(locale), 'locale foundation must contain Chinese and English dictionaries')
}

async function assertBuilt() {
  const nodePath = join(coreLib, 'index.js')
  const invariantPath = join(coreLib, 'invariant.js')
  const clientPath = join(coreLib, 'client.js')
  const uiPath = join(coreLib, 'ui.js')
  assert(existsSync(nodePath) && existsSync(invariantPath) && existsSync(clientPath) && existsSync(uiPath), 'core Node/invariant/client/ui artifacts are missing; run pnpm build first')
  const consumerRequire = createRequire(join(root, 'examples', 'reference-app', 'probe.mjs'))
  assert(consumerRequire.resolve('@dshapps/webpage') === nodePath, 'core root export does not resolve to lib/index.js')
  assert(consumerRequire.resolve('@dshapps/webpage/invariant') === invariantPath, 'core invariant export does not resolve to lib/invariant.js')
  assert(consumerRequire.resolve('@dshapps/webpage/client') === clientPath, 'core ./client export does not resolve to lib/client.js')
  assert(consumerRequire.resolve('@dshapps/webpage/ui') === uiPath, 'core ./ui export does not resolve to lib/ui.js')
  const nodeModule = await import(`${pathToFileURL(nodePath).href}?phase1=${Date.now()}`)
  assert(JSON.stringify(Object.keys(nodeModule).sort()) === '["apply"]', `Node exports must be named apply only, got ${Object.keys(nodeModule)}`)
  const client = await readFile(clientPath, 'utf8')
  assert(client.includes('window.__ModuleLoader__.load'), 'client artifact lacks Loader handoff')
  assert(client.includes('data-plugin-css') && client.includes('_'), 'client artifact lacks Lightning CSS Modules injection/class output')
  const requireSpecifiers = [...client.matchAll(/require\("([^"]+)"\)/g)].map(match => match[1])
  for (const specifier of requireSpecifiers) assert(clientExternals.includes(specifier), `client artifact contains an unresolvable external require(${JSON.stringify(specifier)})`)
  const ui = await readFile(uiPath, 'utf8')
  assert(!ui.includes('window.__ModuleLoader__.load'), 'ui kit must not be a Loader factory')
  assert(ui.includes('data-plugin-css'), 'ui kit lacks Lightning CSS Modules injection')
  for (const path of [nodePath, invariantPath, clientPath, uiPath]) {
    const text = await readFile(path, 'utf8')
    assert(!text.includes('deepseek-harness'), `built artifact references adjacent checkout: ${path}`)
    assert(!text.includes('tsdown.client.ts'), `built artifact references official/local build helper: ${path}`)
  }
}

function packedFiles(archive) {
  const tar = process.platform === 'win32' ? 'tar.exe' : 'tar'
  return execFileSync(tar, ['-tzf', basename(archive)], { encoding: 'utf8', cwd: dirname(archive) })
    .split(/\r?\n/)
    .filter(Boolean)
}

function assertPackedPayload() {
  const prefix = join(tmpdir(), 'dsh-webpage-pack-')
  const directory = mkdtempSync(prefix)
  assert(directory.startsWith(tmpdir()), 'pack temporary directory escaped the system temp root')
  try {
    const pnpmCli = process.env.npm_execpath
    assert(typeof pnpmCli === 'string' && pnpmCli.length > 0, 'pnpm did not expose npm_execpath')
    execFileSync(process.execPath, [pnpmCli, '--dir', coreDir, 'pack', '--pack-destination', directory], { stdio: 'pipe' })
    const archives = readdirSync(directory).filter(file => file.endsWith('.tgz'))
    assert(archives.length === 1, `expected one packed tarball, found ${archives.length}`)
    const archive = join(directory, archives[0])
    const files = packedFiles(archive)
    const expected = [
      'package/package.json', 'package/README.md', 'package/LICENSE', 'package/cordis.patch.yml',
      'package/lib/index.js', 'package/lib/invariant.js', 'package/lib/client.js', 'package/lib/client.js.map',
      'package/lib/ui.js',
      'package/lib/types/index.d.ts', 'package/lib/types/invariant.d.ts',
      'package/lib/types/app-id.d.ts', 'package/lib/types/tools.d.ts',
      'package/lib/types/client/contract.d.ts', 'package/lib/types/client/index.d.ts',
      'package/lib/types/client/open-app/OpenAppCard.d.ts',
      'package/lib/types/client/slots.d.ts',
      'package/lib/types/client/locales.d.ts',
      'package/lib/types/client/outlet/AppOutlet.d.ts',
      'package/lib/types/client/outlet/AppBoundary.d.ts',
      'package/lib/types/client/launcher/AppsLauncher.d.ts',
      'package/lib/types/client/inspector/index.d.ts',
      'package/lib/types/client/inspector/CatalogPane.d.ts',
      'package/lib/types/client/inspector/TopologyPane.d.ts',
      'package/lib/types/client/inspector/fields.d.ts',
      'package/lib/types/client/inspector/topology.d.ts',
      'package/lib/types/client/registry/index.d.ts', 'package/lib/types/client/registry/service.d.ts',
      'package/lib/types/client/registry/validation.d.ts',
      'package/lib/types/client/route/controller.d.ts', 'package/lib/types/client/route/index.d.ts',
      'package/lib/types/client/route/parser.d.ts',
      'package/lib/types/ui/index.d.ts',
      'package/lib/types/ui/AppActions.d.ts',
      'package/lib/types/ui/AppEmpty.d.ts',
      'package/lib/types/ui/AppFields.d.ts',
      'package/lib/types/ui/AppList.d.ts',
      'package/lib/types/ui/AppPage.d.ts',
    ].sort()
    const actual = [...files].sort()
    assert(JSON.stringify(actual) === JSON.stringify(expected), `packed payload mismatch:\nexpected ${expected.join(', ')}\nactual ${actual.join(', ')}`)
    console.log(`Verified packed payload: ${archives[0]} (${files.length} files)`)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

async function lint() {
  const files = await sourceFiles(root)
  for (const file of files) {
    const text = await readFile(file, 'utf8')
    assert(!/[ \t]+\r?\n/.test(text), `trailing whitespace in ${file}`)
  }
  await assertManifest()
  await assertSources()
  console.log('Phase 1 lint/invariant source checks passed')
}

const mode = process.argv.find(arg => arg.startsWith('--'))
if (mode === '--lane') {
  const lane = process.argv[process.argv.indexOf(mode) + 1] ?? 'unknown'
  console.log(`SKIPPED: ${lane} is outside the Phase 1 workspace/build gate; no browser/HMR/business claim is made.`)
  process.exit(0)
}

await assertManifest()
if (mode === '--lint') {
  await lint()
} else if (mode === '--unit') {
  await assertSources()
  await assertBuilt()
  console.log('Phase 1 static/package/build invariants passed')
} else if (mode === '--pack') {
  await assertSources()
  await assertBuilt()
  assertPackedPayload()
  console.log('Phase 1 tarball payload checks passed; repository-external DSH profile installation remains a Phase 5 gate.')
} else {
  fail(`unknown mode ${mode ?? '(none)'}`)
}
