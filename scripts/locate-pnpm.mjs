import { existsSync } from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import { dirname, extname, join, resolve } from 'node:path'

const PINNED_PNPM = '11.7.0'

/** @returns {string[]} */
function corepackCliCandidates() {
  const candidates = []
  const nodeDir = dirname(process.execPath)
  candidates.push(
    join(nodeDir, '..', 'lib', 'node_modules', 'corepack', 'dist', 'corepack.js'),
    join(nodeDir, 'node_modules', 'corepack', 'dist', 'corepack.js'),
  )
  if (process.platform === 'win32') {
    try {
      const commands = execFileSync('where.exe', ['corepack.cmd'], { encoding: 'utf8' })
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
      for (const command of commands) {
        candidates.unshift(join(dirname(command), 'node_modules', 'corepack', 'dist', 'corepack.js'))
      }
    } catch {
      // where.exe may fail when corepack.cmd is not on PATH
    }
  }
  return candidates
}

/** @returns {{ cli: string, prefix: string[] } | null} */
function tryCorepackPnpm() {
  const prefix = [`pnpm@${PINNED_PNPM}`]
  for (const corepackCli of corepackCliCandidates()) {
    if (!existsSync(corepackCli)) continue
    try {
      const version = execFileSync(process.execPath, [corepackCli, ...prefix, '--version'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim()
      if (version === PINNED_PNPM) return { cli: resolve(corepackCli), prefix }
    } catch {
      // try the next Corepack install layout
    }
  }
  return null
}

/**
 * @param {(message: string) => never} fail
 * @returns {{ cli: string, prefix: string[] }}
 */
export function locatePnpm(fail) {
  const cli = process.env.npm_execpath
  if (typeof cli === 'string' && cli.length > 0 && existsSync(cli)) {
    try {
      const extension = extname(cli).toLowerCase()
      const windowsShim = process.platform === 'win32' && (extension === '.cmd' || extension === '.bat')
      const command = windowsShim ? (process.env.ComSpec ?? 'cmd.exe') : process.execPath
      const commandArgs = windowsShim ? ['/d', '/s', '/c', cli, '--version'] : [cli, '--version']
      const version = spawnSync(command, commandArgs, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).stdout.trim()
      if (version === PINNED_PNPM) return { cli: resolve(cli), prefix: [] }
    } catch {
      // Nested pnpm 11.0.9 from `pnpm run` is not usable; fall through to Corepack.
    }
  }
  const corepack = tryCorepackPnpm()
  if (corepack) return corepack
  fail(`could not locate pnpm ${PINNED_PNPM} through npm_execpath or Corepack`)
}

/**
 * @param {string[]} args
 * @param {string} cwd
 * @param {(message: string) => never} fail
 * @returns {string}
 */
export function runPnpm(args, cwd, fail) {
  const pnpm = locatePnpm(fail)
  const pnpmArgs = [...pnpm.prefix, ...args]
  const extension = extname(pnpm.cli).toLowerCase()
  const windowsShim = process.platform === 'win32' && (extension === '.cmd' || extension === '.bat')
  const usesNode = pnpm.cli.endsWith('.js')
  const command = windowsShim ? (process.env.ComSpec ?? 'cmd.exe') : process.execPath
  const commandArgs = windowsShim
    ? ['/d', '/s', '/c', pnpm.cli, ...pnpmArgs]
    : usesNode
      ? [pnpm.cli, ...pnpmArgs]
      : [pnpm.cli, ...pnpmArgs]
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
