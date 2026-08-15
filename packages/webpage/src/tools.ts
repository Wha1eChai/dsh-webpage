import { isAppId, isValidAppPath } from './app-id.js'

/** Wire name of the Webpage `open_app` tool. */
export const OPEN_APP_TOOL_NAME = 'open_app'

const OPEN_APP_DESCRIPTION = [
  'Open an installed Webpage App for the user as a suggestion card.',
  'The user clicks the card to open it; this tool does not navigate by itself.',
  'Use App IDs from context (for example `wha1echai.usage`).',
  'Optional `path` is an in-app route and must be a valid App path.',
].join(' ')

/** Minimal Host context used to register tools without a hard `inject` export. */
export interface WebpageHostContext {
  inject?(names: readonly string[], callback: (ctx: WebpageHostContext) => void): unknown
  get?(name: string): unknown
  logger?: { warn(message: string): void }
}

/** The `defineTool` / `ToolArgsError` face loaded lazily from `@deepseek-ai/dsh-tools`. */
export type DshToolsModule = Pick<typeof import('@deepseek-ai/dsh-tools'), 'defineTool' | 'ToolArgsError'>

/** Lazy loader for the tools package. The default is a dynamic import. */
export type DshToolsLoader = () => Promise<DshToolsModule>

interface ToolsRegistry {
  register(definition: unknown): unknown
}

/** Build the `open_app` tool definition. Host `execute` validates grammar only. */
export function createOpenAppTool({ defineTool, ToolArgsError }: DshToolsModule) {
  return defineTool({
    name: OPEN_APP_TOOL_NAME,
    description: OPEN_APP_DESCRIPTION,
    parameters: {
      app_id: {
        type: 'string',
        required: true,
        description: 'Installed Webpage App ID, such as `wha1echai.usage`.',
      },
      path: {
        type: 'string',
        description: 'Optional in-app route. Must be a valid App path when present.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          appId: { type: 'string', required: true },
          path: { type: 'string' },
        },
      },
      render(_args, value) {
        return [{ type: 'text', text: `Open /apps/${value.appId}${value.path ?? ''}` }]
      },
    },
    execute(args) {
      if (!isAppId(args.app_id)) {
        throw new ToolArgsError([`invalid App ID ${String(args.app_id)}`])
      }
      if (args.path !== undefined && !isValidAppPath(args.path)) {
        throw new ToolArgsError(['invalid App path'])
      }
      if (args.path === undefined) {
        return Promise.resolve({ appId: args.app_id })
      }
      return Promise.resolve({ appId: args.app_id, path: args.path })
    },
  })
}

/** Register `open_app` when `ctx.tools` is present. Never throws or rejects. */
export async function registerOpenAppTool(
  ctx: WebpageHostContext,
  loadDshTools?: DshToolsLoader,
): Promise<void> {
  const tools = toolsOf(ctx)
  if (tools === undefined) return
  let module: DshToolsModule
  try {
    module = await (loadDshTools ?? loadDshToolsModule)()
  } catch (error) {
    ctx.logger?.warn(`wha1echai-webpage: load @deepseek-ai/dsh-tools failed: ${String(error)}`)
    return
  }
  try {
    tools.register(createOpenAppTool(module))
  } catch (error) {
    ctx.logger?.warn(`wha1echai-webpage: open_app registration failed: ${String(error)}`)
  }
}

function loadDshToolsModule(): Promise<DshToolsModule> {
  return import('@deepseek-ai/dsh-tools')
}

function toolsOf(ctx: WebpageHostContext): ToolsRegistry | undefined {
  try {
    const value = ctx.get?.('tools')
    return isToolsRegistry(value) ? value : undefined
  } catch {
    return undefined
  }
}

function isToolsRegistry(value: unknown): value is ToolsRegistry {
  return value !== null && typeof value === 'object' && typeof (value as ToolsRegistry).register === 'function'
}
