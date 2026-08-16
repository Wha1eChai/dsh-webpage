import { registerOpenAppTool, type DshToolsLoader, type WebpageHostContext } from './tools.js'

/**
 * Host-side lifecycle entry. Soft-acquire `tools` inside `apply` — a hard
 * `export const inject = ['tools']` would leave this boot-path plugin pending
 * when the peer is missing (app-authoring §7). Node exports stay `["apply"]`.
 */
export function apply(ctx?: WebpageHostContext, loadDshTools?: DshToolsLoader): void {
  if (ctx === undefined) return
  try {
    if (typeof ctx.inject === 'function') {
      ctx.inject(['tools'], inner => {
        void registerOpenAppTool(inner, loadDshTools)
      })
      return
    }
  } catch (error) {
    ctx.logger?.warn(`dshapps-webpage: inject tools failed: ${String(error)}`)
  }
  void registerOpenAppTool(ctx, loadDshTools)
}
