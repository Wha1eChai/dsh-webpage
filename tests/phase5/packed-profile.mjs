import { spawnSync } from 'node:child_process'
import { constants, existsSync, statSync } from 'node:fs'
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const workspaceRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const expectedDshVersion = '0.1.0-rc.6'
const profileName = 'web'

export const phase5PackageNames = Object.freeze({
  webpage: '@dshapps/webpage',
  app: '@dshapps/webpage-reference-app',
  extension: '@dshapps/webpage-reference-extension',
  pack: '@dshapps/webpage-reference-pack',
})

const packageDirectories = Object.freeze({
  webpage: join(workspaceRoot, 'packages', 'webpage'),
  app: join(workspaceRoot, 'examples', 'reference-app'),
  extension: join(workspaceRoot, 'examples', 'reference-extension'),
  pack: join(workspaceRoot, 'examples', 'reference-pack'),
})

function fail(message) {
  throw new Error(`Phase 5 packed profile failed: ${message}`)
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

function commandOutput(result) {
  return [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
}

function runSync(command, args, options, label) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  })
  if (result.error) fail(`${label} failed to start: ${result.error.message}`)
  if (result.status !== 0) {
    const output = commandOutput(result)
    fail(`${label} exited with ${result.status}${output ? `:\n${output}` : ''}`)
  }
  return result.stdout
}

async function createTempRoot() {
  const tempBase = resolve(await realpath(tmpdir()))
  assert(statSync(tempBase).isDirectory(), `system temp root is not a directory: ${tempBase}`)
  const created = await mkdtemp(join(tempBase, 'dsh-webpage-phase5-'))
  const canonical = resolve(await realpath(created))
  assert(canonical !== tempBase && isWithin(tempBase, canonical), 'validated temp root escaped the system temp directory')
  return canonical
}

function currentPnpmCommand() {
  const cli = process.env.npm_execpath
  if (typeof cli === 'string' && cli.length > 0 && existsSync(cli)) {
    const version = runSync(process.execPath, [cli, '--version'], {}, 'pnpm --version').trim()
    if (version === '11.7.0') return Object.freeze({ cli: resolve(cli), prefix: Object.freeze([]) })
  }

  if (process.platform === 'win32') {
    const commands = runSync('where.exe', ['corepack.cmd'], {}, 'where.exe corepack.cmd')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
    for (const command of commands) {
      const corepackCli = join(dirname(command), 'node_modules', 'corepack', 'dist', 'corepack.js')
      if (!existsSync(corepackCli)) continue
      const prefix = Object.freeze(['pnpm@11.7.0'])
      const version = runSync(process.execPath, [corepackCli, ...prefix, '--version'], {}, 'corepack pnpm@11.7.0 --version').trim()
      assert(version === '11.7.0', `corepack resolved pnpm ${version}`)
      return Object.freeze({ cli: corepackCli, prefix })
    }
  }

  fail('could not locate pnpm 11.7.0 through npm_execpath or Corepack')
}

async function createPnpmShim(tempRoot, pnpm) {
  const binDirectory = join(tempRoot, 'bin')
  await mkdir(binDirectory, { recursive: true })
  assert(isWithin(tempRoot, binDirectory), 'temporary pnpm shim directory escaped the temp root')

  if (process.platform === 'win32') {
    const shim = join(binDirectory, 'pnpm.cmd')
    const prefix = pnpm.prefix.map((value) => ` "${value}"`).join('')
    await writeFile(shim, `@echo off\r\n"${process.execPath}" "${pnpm.cli}"${prefix} %*\r\n`, 'utf8')
    return binDirectory
  }

  const shim = join(binDirectory, 'pnpm')
  const prefix = pnpm.prefix.map((value) => ` "${value}"`).join('')
  await writeFile(shim, `#!/bin/sh\nexec "${process.execPath}" "${pnpm.cli}"${prefix} "$@"\n`, { encoding: 'utf8', mode: 0o755 })
  return binDirectory
}

function locateDshInstallation() {
  if (process.platform !== 'win32') {
    const executable = runSync('which', ['dsh'], {}, 'which dsh').trim()
    const packageRoot = resolve(dirname(awaitRealpathSync(executable)), '..')
    return validateDshInstallation(packageRoot)
  }

  const matches = runSync('where.exe', ['dsh.cmd'], {}, 'where.exe dsh.cmd')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  assert(matches.length > 0, 'where.exe found no dsh.cmd')
  for (const command of matches) {
    const packageRoot = join(dirname(command), 'node_modules', '@deepseek-ai', 'dsh')
    if (existsSync(join(packageRoot, 'package.json'))) return validateDshInstallation(packageRoot)
  }
  fail(`could not resolve @deepseek-ai/dsh beside: ${matches.join(', ')}`)
}

function awaitRealpathSync(path) {
  const result = spawnSync(process.execPath, ['-e', 'process.stdout.write(require("node:fs").realpathSync(process.argv[1]))', path], {
    encoding: 'utf8',
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.status !== 0) fail(`could not resolve dsh executable ${path}: ${commandOutput(result)}`)
  return result.stdout
}

function validateDshInstallation(packageRoot) {
  const manifestPath = join(packageRoot, 'package.json')
  const manifest = JSON.parse(runSync(process.execPath, ['-e', 'process.stdout.write(require("node:fs").readFileSync(process.argv[1], "utf8"))', manifestPath], {}, 'read installed DSH manifest'))
  assert(manifest.name === '@deepseek-ai/dsh', `resolved CLI package is ${manifest.name}`)
  assert(manifest.version === expectedDshVersion, `expected DSH ${expectedDshVersion}, found ${manifest.version}`)
  const binPath = join(packageRoot, manifest.bin?.dsh ?? 'lib/bin.js')
  assert(existsSync(binPath), `installed DSH bin does not exist: ${binPath}`)
  const reportedVersion = runSync(process.execPath, [binPath, '--version'], {}, 'dsh --version').trim()
  assert(reportedVersion === expectedDshVersion, `DSH bin reports ${reportedVersion}`)
  return Object.freeze({ packageRoot: resolve(packageRoot), binPath: resolve(binPath), version: manifest.version })
}

function pnpmPack(pnpm, key, destination) {
  runSync(process.execPath, [pnpm.cli, ...pnpm.prefix, 'pack', '--pack-destination', destination], { cwd: packageDirectories[key], env: process.env }, `pnpm pack ${key}`)
}

function buildWorkspaceArtifacts(pnpm) {
  runSync(
    process.execPath,
    [pnpm.cli, ...pnpm.prefix, 'run', 'build'],
    { cwd: workspaceRoot, env: process.env, shell: false },
    'pnpm run build (fresh workspace artifacts before packing)',
  )
  console.log('Phase 5 fresh workspace artifacts built before packing.')
}

async function packAll(tempRoot, pnpm) {
  const packsRoot = join(tempRoot, 'packs')
  await mkdir(packsRoot, { recursive: true })
  const archives = {}
  for (const key of Object.keys(packageDirectories)) {
    const destination = join(packsRoot, key)
    await mkdir(destination, { recursive: true })
    pnpmPack(pnpm, key, destination)
    const tarballs = (await readdir(destination, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith('.tgz'))
    assert(tarballs.length === 1, `${key} pack produced ${tarballs.length} tarballs`)
    archives[key] = join(destination, tarballs[0].name)
    assert(isWithin(tempRoot, archives[key]), `${key} tarball escaped the temp root`)
  }
  return Object.freeze(archives)
}

async function configureLocalOverrides(profileDirectory, archives) {
  const manifestPath = join(profileDirectory, 'package.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  const overrides = Object.fromEntries(Object.entries(phase5PackageNames).map(([key, name]) => [name, `file:${archives[key].replaceAll('\\', '/')}`]))
  manifest.packageManager = 'pnpm@11.7.0'
  manifest.pnpm = { ...manifest.pnpm, overrides }
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

  const yamlOverrides = Object.entries(overrides)
    .map(([name, value]) => `  ${JSON.stringify(name)}: ${JSON.stringify(value)}`)
    .join('\n')
  await writeFile(join(profileDirectory, 'pnpm-workspace.yaml'), `packages:\n  - .\n\nnodeLinker: hoisted\nautoInstallPeers: false\noverrides:\n${yamlOverrides}\n`, 'utf8')
}

async function resolvedPackageRoot(profileDirectory, tempRoot, packageName) {
  const manifestPath = join(profileDirectory, 'node_modules', ...packageName.split('/'), 'package.json')
  await access(manifestPath, constants.F_OK)
  const canonicalManifest = await realpath(manifestPath)
  const root = dirname(canonicalManifest)
  assert(isWithin(tempRoot, root), `${packageName} resolved outside the disposable temp root: ${root}`)
  assert(!isWithin(workspaceRoot, root), `${packageName} resolved back into the workspace: ${root}`)
  return root
}

const crashPackageName = '@dshapps/webpage-crash-app'
const crashDirectory = join(workspaceRoot, 'examples', 'crash-app')

async function installCrashFixture(tempRoot, pnpm, profileDirectory, runDsh, pnpmOptions) {
  const destination = join(tempRoot, 'packs', 'crash')
  await mkdir(destination, { recursive: true })
  pnpmPackAt(pnpm, crashDirectory, destination)
  const tarballs = (await readdir(destination, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.tgz'))
  assert(tarballs.length === 1, `crash pack produced ${tarballs.length} tarballs`)
  const archive = join(destination, tarballs[0].name)
  assert(isWithin(tempRoot, archive), 'crash tarball escaped the temp root')

  const fileSpec = `file:${archive.replaceAll('\\', '/')}`
  const manifestPath = join(profileDirectory, 'package.json')
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  manifest.pnpm = { ...manifest.pnpm, overrides: { ...manifest.pnpm?.overrides, [crashPackageName]: fileSpec } }
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

  const yamlPath = join(profileDirectory, 'pnpm-workspace.yaml')
  const yaml = await readFile(yamlPath, 'utf8')
  await writeFile(yamlPath, `${yaml.trimEnd()}\n  ${JSON.stringify(crashPackageName)}: ${JSON.stringify(fileSpec)}\n`, 'utf8')

  runDsh(['plugin', '--profile', profileName, 'add', archive, ...pnpmOptions])
}

function pnpmPackAt(pnpm, directory, destination) {
  runSync(process.execPath, [pnpm.cli, ...pnpm.prefix, 'pack', '--pack-destination', destination], { cwd: directory, env: process.env }, `pnpm pack ${directory}`)
}

function assertDumpConfig(dump) {
  const expectedRows = [
    "name: '@dshapps/webpage'",
    "name: '@dshapps/webpage-reference-app'",
    "name: '@dshapps/webpage-reference-extension'",
  ]
  let previous = -1
  for (const row of expectedRows) {
    const matches = dump.split(row).length - 1
    assert(matches === 1, `dump-config expected exactly one ${row}, found ${matches}`)
    const index = dump.indexOf(row)
    assert(index > previous, `dump-config row order is wrong at ${row}`)
    previous = index
  }
}

export async function createPackedWebProfile() {
  const tempRoot = await createTempRoot()
  let disposed = false
  try {
    const pnpm = currentPnpmCommand()
    const dsh = locateDshInstallation()
    const shimDirectory = await createPnpmShim(tempRoot, pnpm)
    const dshHome = join(tempRoot, 'home')
    const profileDirectory = join(dshHome, 'profiles', profileName)
    const storeDirectory = join(tempRoot, 'pnpm-store')
    await mkdir(dshHome, { recursive: true })
    await mkdir(storeDirectory, { recursive: true })
    const pathValue = `${shimDirectory}${sep === '\\' ? ';' : ':'}${process.env.PATH ?? ''}`
    const env = Object.freeze({
      ...process.env,
      DSH_HOME: dshHome,
      DSH_TELEMETRY_DISABLED: '1',
      PATH: pathValue,
    })
    const runDsh = (args, options = {}) => runSync(
      process.execPath,
      [dsh.binPath, ...args],
      { cwd: workspaceRoot, env, ...options },
      `dsh ${args.join(' ')}`,
    )
    buildWorkspaceArtifacts(pnpm)
    const archives = await packAll(tempRoot, pnpm)
    const pnpmOptions = ['--ignore-scripts', '--config.auto-install-peers=false', '--lockfile=false', '--offline', '--store-dir', storeDirectory]
    runDsh(['plugin', '--profile', profileName, 'install', ...pnpmOptions])
    assert(existsSync(join(profileDirectory, 'package.json')), 'real DSH did not initialize the web profile')
    await configureLocalOverrides(profileDirectory, archives)
    runDsh(['plugin', '--profile', profileName, 'add', archives.pack, ...pnpmOptions])

    const manifest = JSON.parse(await readFile(join(profileDirectory, 'package.json'), 'utf8'))
    const dshappsDependencies = Object.keys(manifest.dependencies ?? {}).filter((name) => name.startsWith('@dshapps/'))
    assert(JSON.stringify(dshappsDependencies) === JSON.stringify([phase5PackageNames.pack]), `top-level plugin dependencies must contain only the Pack, found ${JSON.stringify(dshappsDependencies)}`)
    const expectedBundles = ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', phase5PackageNames.pack]
    assert(JSON.stringify(manifest.dsh?.profile?.bundles) === JSON.stringify(expectedBundles), `profile bundles changed: ${JSON.stringify(manifest.dsh?.profile?.bundles)}`)

    const packageRoots = {}
    for (const [key, name] of Object.entries(phase5PackageNames)) {
      packageRoots[key] = await resolvedPackageRoot(profileDirectory, tempRoot, name)
    }
    const profileRequire = createRequire(join(profileDirectory, 'package.json'))
    for (const name of [phase5PackageNames.webpage, phase5PackageNames.app, phase5PackageNames.extension]) {
      let clientManifest
      try {
        clientManifest = profileRequire.resolve(`${name}/package.json`)
      } catch (error) {
        fail(`${name} package.json is not exported for DSH client-module discovery: ${error.message}`)
      }
      assert(isWithin(tempRoot, clientManifest), `${name} client manifest resolved outside the disposable temp root: ${clientManifest}`)
    }
    const dumpConfig = runDsh(['--profile', profileName, '--dump-config'])
    assertDumpConfig(dumpConfig)
    await installCrashFixture(tempRoot, pnpm, profileDirectory, runDsh, pnpmOptions)

    const dispose = async () => {
      if (disposed) return
      disposed = true
      const tempBase = resolve(await realpath(tmpdir()))
      assert(tempRoot !== tempBase && isWithin(tempBase, tempRoot), `refusing to remove unsafe Phase 5 root: ${tempRoot}`)
      await rm(tempRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
    }

    return Object.freeze({
      archives,
      dispose,
      dsh: Object.freeze({
        ...dsh,
        bin: dsh.binPath,
        manifest: Object.freeze({ version: dsh.version }),
      }),
      dshInvocation: Object.freeze({
        cwd: workspaceRoot,
        env,
        executable: process.execPath,
        profile: profileName,
        script: dsh.binPath,
      }),
      home: dshHome,
      dshHome,
      dumpConfig,
      env,
      packageRoots: Object.freeze(packageRoots),
      profileDir: profileDirectory,
      profileDirectory,
      profileName,
      tempRoot,
    })
  } catch (error) {
    if (!disposed) {
      const tempBase = resolve(await realpath(tmpdir()))
      if (tempRoot !== tempBase && isWithin(tempBase, tempRoot)) {
        await rm(tempRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
      }
    }
    throw error
  }
}
