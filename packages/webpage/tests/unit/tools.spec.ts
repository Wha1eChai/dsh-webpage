import { defineTool, ToolArgsError } from '@deepseek-ai/dsh-tools'
import { describe, expect, it, vi } from 'vitest'

import { apply } from '../../src/index.js'
import {
  createOpenAppTool,
  registerOpenAppTool,
  type DshToolsLoader,
  type DshToolsModule,
  type WebpageHostContext,
} from '../../src/tools.js'

const dshTools: DshToolsModule = { defineTool, ToolArgsError }

function fakeExec() {
  return { signal: new AbortController().signal }
}

function loadTools(): Promise<DshToolsModule> {
  return Promise.resolve(dshTools)
}

function toolsContext(register: (definition: unknown) => unknown, extras: Partial<WebpageHostContext> = {}): WebpageHostContext {
  return {
    get(name: string) {
      if (name !== 'tools') return undefined
      return { register }
    },
    ...extras,
  }
}

async function settle(work: () => void): Promise<void> {
  work()
  await Promise.resolve()
  await Promise.resolve()
}

describe('open_app tool definition', () => {
  it('returns canonical JSON and a short render line', async () => {
    const tool = createOpenAppTool(dshTools)
    expect(tool.name).toBe('open_app')
    expect(tool.description).toContain('suggestion card')
    expect(tool.description).toContain('wha1echai.usage')

    const withoutPath = await tool.execute({ app_id: 'wha1echai.usage' }, fakeExec())
    expect(withoutPath).toEqual({ appId: 'wha1echai.usage' })
    expect(tool.output.render({ app_id: 'wha1echai.usage' }, withoutPath)).toEqual([
      { type: 'text', text: 'Open /apps/wha1echai.usage' },
    ])

    const withPath = await tool.execute({ app_id: 'wha1echai.usage', path: '/today' }, fakeExec())
    expect(withPath).toEqual({ appId: 'wha1echai.usage', path: '/today' })
    expect(tool.output.render({ app_id: 'wha1echai.usage', path: '/today' }, withPath)).toEqual([
      { type: 'text', text: 'Open /apps/wha1echai.usage/today' },
    ])
  })

  it('rejects grammar violations as ToolArgsError', async () => {
    const tool = createOpenAppTool(dshTools)
    await expect(tool.execute({ app_id: 'Usage' }, fakeExec())).rejects.toMatchObject({
      name: 'ToolArgsError',
      violations: ['invalid App ID Usage'],
    })
    await expect(tool.execute({ app_id: 'acme' }, fakeExec())).rejects.toMatchObject({
      name: 'ToolArgsError',
      violations: ['invalid App ID acme'],
    })
    await expect(tool.execute({ app_id: 'wha1echai.usage', path: 'today' }, fakeExec())).rejects.toMatchObject({
      name: 'ToolArgsError',
      violations: ['path must start with "/"'],
    })
    await expect(tool.execute({}, fakeExec())).rejects.toMatchObject({
      name: 'ToolArgsError',
    })
  })
})

describe('Host apply open_app registration', () => {
  it('is a no-op without ctx or tools', async () => {
    expect(() => apply()).not.toThrow()
    expect(() => apply(undefined)).not.toThrow()
    expect(() => apply({})).not.toThrow()
    expect(() => apply({ get: () => undefined })).not.toThrow()
    expect(() => apply({ get: () => ({}) })).not.toThrow()
    expect(() => apply({
      get() {
        throw new Error('cannot get property "tools" without inject')
      },
    })).not.toThrow()
    expect(() => apply({
      inject() {
        throw new Error('tools not ready')
      },
      get: () => null,
    })).not.toThrow()
    await expect(registerOpenAppTool({})).resolves.toBeUndefined()
  })

  it('waits on ctx.inject(["tools"]) and registers when the callback runs', async () => {
    const register = vi.fn()
    let captured: ((ctx: WebpageHostContext) => void) | undefined
    const ctx: WebpageHostContext = {
      inject(names, callback) {
        expect(names).toEqual(['tools'])
        captured = callback
      },
    }

    apply(ctx, loadTools)
    expect(register).not.toHaveBeenCalled()
    expect(captured).toBeTypeOf('function')
    await settle(() => captured!(toolsContext(register)))
    expect(register).toHaveBeenCalledTimes(1)
    expect((register.mock.calls[0]![0] as { name: string }).name).toBe('open_app')
  })

  it('falls back to soft-get when inject is absent', async () => {
    const register = vi.fn()
    await settle(() => apply(toolsContext(register), loadTools))
    expect(register).toHaveBeenCalledTimes(1)
  })

  it('warns and falls back when inject throws', async () => {
    const register = vi.fn()
    const warn = vi.fn()
    await settle(() => apply({
      inject() {
        throw new Error('tools not ready')
      },
      get(name) {
        if (name !== 'tools') return undefined
        return { register }
      },
      logger: { warn },
    }, loadTools))
    expect(warn).toHaveBeenCalledWith('wha1echai-webpage: inject tools failed: Error: tools not ready')
    expect(register).toHaveBeenCalledTimes(1)
  })

  it('registers through the default dynamic import when the package is present', async () => {
    const register = vi.fn()
    await registerOpenAppTool(toolsContext(register))
    expect(register).toHaveBeenCalledTimes(1)
    expect((register.mock.calls[0]![0] as { name: string }).name).toBe('open_app')

    const registerFromApply = vi.fn()
    apply(toolsContext(registerFromApply))
    await vi.waitFor(() => expect(registerFromApply).toHaveBeenCalledTimes(1))
  })

  it('warns and skips when the tools package cannot be imported', async () => {
    const register = vi.fn()
    const warn = vi.fn()
    const rejections: unknown[] = []
    const onUnhandled = (reason: unknown) => {
      rejections.push(reason)
    }
    process.on('unhandledRejection', onUnhandled)
    const load: DshToolsLoader = () => Promise.reject(new Error("Cannot find package '@deepseek-ai/dsh-tools'"))
    try {
      await settle(() => apply(toolsContext(register, { logger: { warn } }), load))
      await expect(registerOpenAppTool(toolsContext(register), load)).resolves.toBeUndefined()
      expect(warn).toHaveBeenCalledWith(
        "wha1echai-webpage: load @deepseek-ai/dsh-tools failed: Error: Cannot find package '@deepseek-ai/dsh-tools'",
      )
      expect(register).not.toHaveBeenCalled()
      expect(rejections).toEqual([])
    } finally {
      process.off('unhandledRejection', onUnhandled)
    }
  })

  it('skips a missing tools package when logger is absent', async () => {
    const register = vi.fn()
    await expect(registerOpenAppTool(
      toolsContext(register),
      () => Promise.reject(new Error('missing')),
    )).resolves.toBeUndefined()
    expect(register).not.toHaveBeenCalled()
  })

  it('tolerates duplicate registration without throwing', async () => {
    const warn = vi.fn()
    await registerOpenAppTool(toolsContext(() => {
      throw new Error('tool "open_app" is already registered (for a per-agent variant, register through that agent\'s `agent.ctx` instead)')
    }, { logger: { warn } }), loadTools)
    expect(warn.mock.calls[0]![0]).toContain('open_app registration failed')
    expect(warn.mock.calls[0]![0]).toContain('already registered')
  })

  it('swallows a duplicate registration when logger is absent', async () => {
    await expect(registerOpenAppTool(toolsContext(() => {
      throw new Error('tool "open_app" is already registered in this scope')
    }), loadTools)).resolves.toBeUndefined()
  })
})
