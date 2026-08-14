import { spawnSync } from 'node:child_process'
import { access, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises'
import { constants, existsSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const expectedVersion = '0.1.0'
const packageNames = Object.freeze({
  webpage: '@wha1echai/dsh-webpage',
  app: '@wha1echai/dsh-webpage-reference-app',
  extension: '@wha1echai/dsh-webpage-reference-extension',
  pack: '@wha1echai/dsh-webpage-reference-pack',
})

const packageDirectories = Object.freeze({
  webpage: join(root, 'packages', 'webpage'),
  app: join(root, 'examples', 'reference-app'),
  extension: join(root, 'examples', 'reference-extension'),
  pack: join(root, 'examples', 'reference-pack'),
})

// These are intentionally explicit. A package's `files` field is not sufficient
// proof that a changed build did not leak an unexpected file into its tarball.
const payloadAllowlist = Object.freeze({
  webpage: Object.freeze([
    'package/package.json',
    'package/README.md',
    'package/LICENSE',
    'package/cordis.patch.yml',
    'package/lib/index.js',
    'package/lib/invariant.js',
    'package/lib/client.js',
    'package/lib/client.js.map',
    'package/lib/types/index.d.ts',
    'package/lib/types/invariant.d.ts',
    'package/lib/types/client/contract.d.ts',
    'package/lib/types/client/index.d.ts',
    'package/lib/types/client/slots.d.ts',
    'package/lib/types/client/locales.d.ts',
    'package/lib/types/client/outlet/AppOutlet.d.ts',
    'package/lib/types/client/launcher/AppsLauncher.d.ts',
    'package/lib/types/client/inspector/index.d.ts',
    'package/lib/types/client/inspector/topology.d.ts',
    'package/lib/types/client/registry/index.d.ts',
    'package/lib/types/client/registry/service.d.ts',
    'package/lib/types/client/registry/validation.d.ts',
    'package/lib/types/client/route/controller.d.ts',
    'package/lib/types/client/route/index.d.ts',
    'package/lib/types/client/route/parser.d.ts',
  ].sort()),
  app: Object.freeze([
    'package/package.json',
    'package/LICENSE',
    'package/lib/index.js',
    'package/lib/client.js',
    'package/lib/client.js.map',
    'package/lib/types/index.d.ts',
    'package/lib/types/client/index.d.ts',
    'package/lib/types/client/locales.d.ts',
    'package/lib/types/client/ReferenceApp.d.ts',
  ].sort()),
  extension: Object.freeze([
    'package/package.json',
    'package/LICENSE',
    'package/lib/index.js',
    'package/lib/client.js',
    'package/lib/client.js.map',
    'package/lib/types/index.d.ts',
    'package/lib/types/client/index.d.ts',
    'package/lib/types/client/locales.d.ts',
    'package/lib/types/client/ReferenceAction.d.ts',
  ].sort()),
  pack: Object.freeze([
    'package/package.json',
    'package/LICENSE',
    'package/lib/index.js',
    'package/lib/types/index.d.ts',
    'package/cordis.patch.yml',
  ].sort()),
})

const expectedClientInject = Object.freeze({
  webpage: Object.freeze([
    '@deepseek-ai/dsh-client-runtime',
    '@deepseek-ai/dsh-client-ui-layout',
    '@deepseek-ai/dsh-client-ui-sidebar',
    '@deepseek-ai/dsh-client-locale',
  ]),
  app: Object.freeze([packageNames.webpage]),
  extension: Object.freeze([packageNames.app]),
})

const expectedManifests = Object.freeze({
  webpage: Object.freeze({
    name: packageNames.webpage,
    private: false,
    clientInject: expectedClientInject.webpage,
    dependencies: Object.freeze({}),
  }),
  app: Object.freeze({
    name: packageNames.app,
    private: true,
    clientInject: expectedClientInject.app,
    dependencies: Object.freeze({ [packageNames.webpage]: expectedVersion }),
  }),
  extension: Object.freeze({
    name: packageNames.extension,
    private: true,
    clientInject: expectedClientInject.extension,
    dependencies: Object.freeze({ [packageNames.app]: expectedVersion }),
  }),
  pack: Object.freeze({
    name: packageNames.pack,
    private: true,
    dependencies: Object.freeze({
      [packageNames.webpage]: expectedVersion,
      [packageNames.app]: expectedVersion,
      [packageNames.extension]: expectedVersion,
    }),
  }),
})

function fail(message) {
  throw new Error(`Phase 4 verification failed: ${message}`)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

function normalized(path) {
  return process.platform === 'win32' ? path.toLowerCase() : path
}

function isWithin(parent, candidate) {
  const parentPath = resolve(parent)
  const candidatePath = resolve(candidate)
  const child = normalized(relative(parentPath, candidatePath))
  return child === '' || (!child.startsWith(`..${sep}`) && child !== '..' && !isAbsolute(child))
}

async function assertDirectory(path, label) {
  let info
  try {
    info = statSync(path)
  } catch (error) {
    fail(`${label} does not exist: ${error.message}`)
  }
  assert(info.isDirectory(), `${label} is not a directory: ${path}`)
}

async function createTempRoot() {
  await assertDirectory(tmpdir(), 'system temp root')
  const systemTemp = resolve(await realpath(tmpdir()))
  const directory = await mkdtemp(join(systemTemp, 'dsh-webpage-phase4-'))
  const canonical = resolve(await realpath(directory))
  assert(isWithin(systemTemp, canonical) && canonical !== systemTemp, 'validated temp directory escaped system temp root')
  return canonical
}

function pnpmCommand(args, cwd) {
  const pnpmCli = process.env.npm_execpath
  assert(typeof pnpmCli === 'string' && pnpmCli.length > 0, 'pnpm did not expose npm_execpath; invoke this script with npm_execpath set')
  assert(existsSync(pnpmCli), `npm_execpath does not exist: ${pnpmCli}`)

  const extension = extname(pnpmCli).toLowerCase()
  const windowsShim = process.platform === 'win32' && (extension === '.cmd' || extension === '.bat')
  const command = windowsShim ? (process.env.ComSpec ?? 'cmd.exe') : process.execPath
  const commandArgs = windowsShim ? ['/d', '/s', '/c', pnpmCli, ...args] : [pnpmCli, ...args]
  const result = spawnSync(command, commandArgs, {
    cwd,
    encoding: 'utf8',
    env: process.env,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  if (result.error) fail(`pnpm command failed to start: ${result.error.message}`)
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    fail(`pnpm ${args.join(' ')} failed with exit code ${result.status}${output ? `:\n${output}` : ''}`)
  }
  return result.stdout
}

async function packPackage(key, destination) {
  await mkdir(destination, { recursive: true })
  assert(isWithin(dirname(destination), destination), `pack destination escaped its parent: ${destination}`)
  pnpmCommand(['pack', '--pack-destination', destination], packageDirectories[key])

  const entries = (await readdir(destination, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.tgz'))
  assert(entries.length === 1, `${key} pack must produce exactly one tarball, found ${entries.length}`)
  const archive = join(destination, entries[0].name)
  assert(isWithin(destination, archive), `${key} tarball escaped its pack destination`)
  return archive
}

function tarExecutable() {
  return process.platform === 'win32' ? 'tar.exe' : 'tar'
}

function tarRead(archive, member) {
  const result = spawnSync(tarExecutable(), ['-xOf', archive, member], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.error) fail(`tar could not read ${member} from ${archive}: ${result.error.message}`)
  if (result.status !== 0) {
    fail(`tar could not read ${member} from ${archive}: ${(result.stderr || '').trim()}`)
  }
  return result.stdout
}

function tarMembers(archive) {
  const result = spawnSync(tarExecutable(), ['-tzf', archive], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.error) fail(`tar could not list ${archive}: ${result.error.message}`)
  if (result.status !== 0) fail(`tar could not list ${archive}: ${(result.stderr || '').trim()}`)
  return result.stdout.split(/\r?\n/).filter(Boolean).sort()
}

function parsePackedManifest(archive, key) {
  let manifest
  try {
    manifest = JSON.parse(tarRead(archive, 'package/package.json'))
  } catch (error) {
    fail(`${key} packed package.json is not valid JSON: ${error.message}`)
  }
  return manifest
}

function dependencyEntries(manifest) {
  return {
    ...manifest.dependencies,
    ...manifest.optionalDependencies,
    ...manifest.peerDependencies,
    ...manifest.devDependencies,
  }
}

function assertNoWorkspaceRanges(manifest, key) {
  assert(!JSON.stringify(manifest).includes('workspace:'), `${key} packed manifest leaks a workspace: range`)
}

function assertExactDependencies(manifest, expected, key) {
  assert(JSON.stringify(manifest.dependencies ?? {}) === JSON.stringify(expected), `${key} dependencies changed: expected ${JSON.stringify(expected)}, got ${JSON.stringify(manifest.dependencies ?? {})}`)
}

function assertPackedManifest(manifest, key) {
  const expected = expectedManifests[key]
  assert(manifest.name === expected.name, `${key} packed manifest name is ${manifest.name}`)
  assert(manifest.version === expectedVersion, `${key} packed manifest version is ${manifest.version}`)
  assertNoWorkspaceRanges(manifest, key)
  if (key !== 'webpage') assert(manifest.private === true, `${key} example must remain private in its packed manifest`)
  else assert(manifest.private !== true, 'webpage package must remain packable/publishable')

  if (expected.clientInject) {
    assert(manifest.dsh?.client?.platform === 'web', `${key} dsh.client.platform must remain web`)
    assert(JSON.stringify(manifest.dsh.client.inject) === JSON.stringify(expected.clientInject), `${key} dsh.client.inject contract changed`)
    assert(manifest.exports?.['./package.json'] === './package.json', `${key} must export ./package.json for DSH client-module discovery`)
  }
  if (key === 'webpage' || key === 'pack') {
    assert(manifest.dsh?.bundle?.patch === './cordis.patch.yml', `${key} dsh.bundle.patch must remain ./cordis.patch.yml`)
  }
  assertExactDependencies(manifest, expected.dependencies, key)

  for (const [name, version] of Object.entries(dependencyEntries(manifest))) {
    assert(!String(version).startsWith('workspace:'), `${key} dependency ${name} leaks a workspace: range`)
  }
  if (key === 'pack') {
    assertExactDependencies(manifest, {
      [packageNames.webpage]: expectedVersion,
      [packageNames.app]: expectedVersion,
      [packageNames.extension]: expectedVersion,
    }, 'pack')
  }
}

function assertPayload(archive, key) {
  const actual = tarMembers(archive)
  const expected = payloadAllowlist[key]
  assert(JSON.stringify(actual) === JSON.stringify(expected), `${key} packed payload mismatch:\nexpected ${expected.join(', ')}\nactual ${actual.join(', ')}`)
  console.log(`Verified ${key} payload: ${actual.length} files`)
}

function assertPackPatch(archive, key) {
  const patch = tarRead(archive, 'package/cordis.patch.yml')
  assert(patch.includes("name: '@wha1echai/dsh-webpage'"), `${key} packed Pack patch lacks webpage insertion`)
  assert(patch.includes("name: '@wha1echai/dsh-webpage-reference-app'"), `${key} packed Pack patch lacks reference App insertion`)
  assert(patch.includes("name: '@wha1echai/dsh-webpage-reference-extension'"), `${key} packed Pack patch lacks reference extension insertion`)
  return patch
}

function fileDependencyValue(profileDirectory, archive) {
  const value = relative(profileDirectory, archive).replaceAll('\\', '/')
  assert(value && !isAbsolute(value), `profile file dependency path is invalid: ${archive}`)
  return `file:${value.startsWith('.') ? value : `./${value}`}`
}

async function writeProfile(profileDirectory, archives) {
  const fileDependencies = {
    [packageNames.webpage]: fileDependencyValue(profileDirectory, archives.webpage),
    [packageNames.app]: fileDependencyValue(profileDirectory, archives.app),
    [packageNames.extension]: fileDependencyValue(profileDirectory, archives.extension),
    [packageNames.pack]: fileDependencyValue(profileDirectory, archives.pack),
  }
  const manifest = {
    name: 'dsh-webpage-phase4-profile',
    version: '0.0.0',
    private: true,
    dependencies: fileDependencies,
    pnpm: {
      // pack rewrites workspace:* to a semver range. Keep nested Pack deps local
      // to the four tarballs instead of allowing a registry lookup for these
      // unpublished example packages.
      overrides: fileDependencies,
    },
    dsh: {
      profile: {
        bundles: [packageNames.pack],
      },
    },
  }
  assert(Object.values(manifest.dependencies).every((value) => value.startsWith('file:')), 'profile dependencies must all be file: tarballs')
  assert(JSON.stringify(manifest.dsh.profile.bundles) === JSON.stringify([packageNames.pack]), 'profile must declare only the Reference Pack bundle')
  await writeFile(join(profileDirectory, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  const overrides = Object.entries(fileDependencies)
    .map(([name, specifier]) => `  ${JSON.stringify(name)}: ${JSON.stringify(specifier)}`)
    .join('\n')
  await writeFile(join(profileDirectory, 'pnpm-workspace.yaml'), `overrides:\n${overrides}\n`, 'utf8')
  return manifest
}

async function installProfile(tempRoot, profileDirectory) {
  const storeDirectory = join(tempRoot, 'pnpm-store')
  await mkdir(storeDirectory, { recursive: true })
  pnpmCommand([
    'install',
    '--ignore-scripts',
    '--config.auto-install-peers=false',
    '--lockfile=false',
    '--prefer-offline',
    '--store-dir',
    storeDirectory,
  ], profileDirectory)
}

async function resolvedPackageRoot(profileDirectory, name) {
  const packagePath = join(profileDirectory, 'node_modules', ...name.split('/'), 'package.json')
  try {
    await access(packagePath, constants.F_OK)
  } catch (error) {
    fail(`profile dependency ${name} is not installed: ${error.message}`)
  }
  const manifestPath = await realpath(packagePath)
  const packageRoot = dirname(manifestPath)
  assert(isWithin(profileDirectory, packageRoot), `${name} resolved outside the disposable profile: ${packageRoot}`)
  assert(!isWithin(root, packageRoot), `${name} resolved back into the workspace: ${packageRoot}`)
  return packageRoot
}

async function verifyResolvedProfile(profileDirectory, archives, packedManifests, packPatch) {
  const roots = {}
  for (const key of Object.keys(packageNames)) {
    roots[key] = await resolvedPackageRoot(profileDirectory, packageNames[key])
    const manifest = JSON.parse(await readFile(join(roots[key], 'package.json'), 'utf8'))
    assert(JSON.stringify(manifest) === JSON.stringify(packedManifests[key]), `${key} profile manifest differs from its packed manifest`)
    assert(manifest.name === packedManifests[key].name, `${key} profile manifest name changed`)
    assert(manifest.version === expectedVersion, `${key} profile manifest version changed`)
    assertNoWorkspaceRanges(manifest, `${key} profile`)
  }

  const profilePackPatch = await readFile(join(roots.pack, 'cordis.patch.yml'), 'utf8')
  assert(profilePackPatch === packPatch, 'Reference Pack patch is not accessible after profile installation')
  assert(isWithin(roots.pack, join(roots.pack, 'cordis.patch.yml')), 'Reference Pack patch escaped its resolved package root')
  assert(isWithin(profileDirectory, roots.pack), `Reference Pack root is not under the temp profile: ${roots.pack}`)
  assert(isWithin(profileDirectory, roots.webpage) && isWithin(profileDirectory, roots.app) && isWithin(profileDirectory, roots.extension), 'one or more profile package roots escaped the temp profile')
  assert(Object.values(archives).every((archive) => isWithin(tempRootOf(profileDirectory), archive)), 'profile tarball escaped the validated temp root')
  console.log(`Verified profile roots under temp directory: ${Object.values(roots).join(', ')}`)
}

function tempRootOf(profileDirectory) {
  return resolve(profileDirectory, '..')
}

async function main() {
  let tempRoot
  try {
    tempRoot = await createTempRoot()
    const packsDirectory = join(tempRoot, 'packs')
    const profileDirectory = join(tempRoot, 'profile')
    await mkdir(packsDirectory, { recursive: true })
    await mkdir(profileDirectory, { recursive: true })
    assert(isWithin(tempRoot, packsDirectory) && isWithin(tempRoot, profileDirectory), 'temporary work directories escaped validated temp root')

    const archives = {
      webpage: await packPackage('webpage', join(packsDirectory, 'webpage')),
      app: await packPackage('app', join(packsDirectory, 'reference-app')),
      extension: await packPackage('extension', join(packsDirectory, 'reference-extension')),
      pack: await packPackage('pack', join(packsDirectory, 'reference-pack')),
    }
    const packedManifests = {}
    for (const key of Object.keys(archives)) {
      assertPayload(archives[key], key)
      packedManifests[key] = parsePackedManifest(archives[key], key)
      assertPackedManifest(packedManifests[key], key)
    }
    const packPatch = assertPackPatch(archives.pack, 'Reference Pack')

    await writeProfile(profileDirectory, archives)
    await installProfile(tempRoot, profileDirectory)
    await verifyResolvedProfile(profileDirectory, archives, packedManifests, packPatch)

    console.log('Phase 4 packed-artifact/profile resolution verification passed.')
    console.log('Phase 4 packed-artifact verification complete; the Phase 5 lane owns real DSH CLI, Web, and HMR acceptance.')
  } finally {
    if (tempRoot) await rm(tempRoot, { recursive: true, force: true })
  }
}

try {
  await main()
} catch (error) {
  console.error(error instanceof Error ? error.stack : error)
  process.exitCode = 1
}
