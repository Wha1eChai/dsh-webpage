import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { build } from 'tsdown'

const FIXTURE_ROOT = resolve(import.meta.dirname)
const SOURCE_ROOT = join(FIXTURE_ROOT, 'src')

const FIXTURES = ['alpha', 'beta', 'conflict', 'extension'] as const

/**
 * Build fixture client entries with the same registration envelope as the
 * workspace client bundles. The output is kept outside the repository so the
 * integration lane never leaves generated files in the shared worktree.
 */
export interface BuiltPhase3Fixtures {
  readonly bundles: ReadonlyMap<string, string>
  dispose(): Promise<void>
}

export async function buildPhase3Fixtures(): Promise<BuiltPhase3Fixtures> {
  const outputRoot = await mkdtemp(join(tmpdir(), 'dsh-phase3-loader-'))
  await mkdir(outputRoot, { recursive: true })

  const result = new Map<string, string>()
  try {
    for (const fixture of FIXTURES) {
      const outDir = join(outputRoot, fixture)
      await build({
        entry: { client: join(SOURCE_ROOT, `${fixture}.ts`) },
        outDir,
        format: 'cjs',
        platform: 'browser',
        target: 'es2022',
        dts: false,
        sourcemap: false,
        clean: true,
        outputOptions: {
          entryFileNames: 'client.js',
          banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(`phase3.fixture.${fixture}`)}, factory: (require) => {`,
          footer: 'return module.exports; } });',
          intro: 'var module = { exports: {} }; var exports = module.exports;',
        },
      })
      result.set(`phase3.fixture.${fixture}`, join(outDir, 'client.js'))
    }
  } catch (error) {
    await rm(outputRoot, { recursive: true, force: true })
    throw error
  }
  let disposed = false
  return {
    bundles: result,
    async dispose() {
      if (disposed) return
      disposed = true
      await rm(outputRoot, { recursive: true, force: true })
    },
  }
}
