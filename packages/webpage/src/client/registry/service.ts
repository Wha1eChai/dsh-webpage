import { Service, type Context } from '@deepseek-ai/cordis'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import type { AppDescriptor, PagesService as PagesServiceContract, RegisteredApp } from '../contract.js'
import { assertAppDescriptor } from './validation.js'

/** Cordis-owned metadata registry exposed as `ctx.pages`. */
export class PagesService extends Service<PagesServiceContract> implements PagesServiceContract {
  public readonly list: ObservableSnapshot<readonly RegisteredApp[]>

  private readonly apps = new Map<string, RegisteredApp>()
  private readonly subscribers = new Set<() => void>()
  private snapshot: readonly RegisteredApp[] = Object.freeze([])
  private notificationQueued = false

  constructor(ctx: Context) {
    super(ctx, 'pages')
    this.list = Object.freeze({
      getSnapshot: () => this.snapshot,
      subscribe: (listener: () => void) => this.subscribe(listener),
    })
  }

  register(descriptor: AppDescriptor): () => void {
    assertAppDescriptor(descriptor)
    const sourcePlugin = this.ctx.fiber.name
    const existing = this.apps.get(descriptor.id)
    if (existing) {
      throw new Error(
        `duplicate App ID "${descriptor.id}": existing sourcePlugin <${provenance(existing)}>; `
        + `incoming sourcePlugin <${sourcePlugin}>`,
      )
    }

    const record = freezeRecord(descriptor, sourcePlugin)
    const effectDisposer = this.ctx.effect(() => () => this.withdraw(record), 'pages.register()')
    this.apps.set(record.id, record)
    this.publish()
    let disposed = false
    return () => {
      if (disposed) return
      disposed = true
      this.withdraw(record)
      void effectDisposer()
    }
  }

  get(id: string): RegisteredApp | undefined {
    return this.apps.get(id)
  }

  private subscribe(listener: () => void): () => void {
    this.subscribers.add(listener)
    let active = true
    return () => {
      if (!active) return
      active = false
      this.subscribers.delete(listener)
    }
  }

  private withdraw(record: RegisteredApp): void {
    if (this.apps.get(record.id) !== record) return
    this.apps.delete(record.id)
    this.publish()
  }

  private publish(): void {
    this.snapshot = Object.freeze([...this.apps.values()].sort(compareApps))
    if (this.notificationQueued) return
    this.notificationQueued = true
    queueMicrotask(() => {
      this.notificationQueued = false
      for (const subscriber of this.subscribers) {
        try {
          subscriber()
        } catch (error) {
          console.error('[dsh-webpage] pages subscriber failed:', error)
        }
      }
    })
  }
}

function freezeRecord(descriptor: AppDescriptor, sourcePlugin: string): RegisteredApp {
  const record: RegisteredApp = {
    id: descriptor.id,
    label: descriptor.label,
    ...(descriptor.description === undefined ? {} : { description: descriptor.description }),
    ...(descriptor.order === undefined ? {} : { order: descriptor.order }),
    ...(descriptor.categories === undefined ? {} : { categories: Object.freeze([...descriptor.categories]) }),
    sourcePlugin,
  }
  return Object.freeze(record)
}

function compareApps(left: RegisteredApp, right: RegisteredApp): number {
  const orderDifference = (left.order ?? 0) - (right.order ?? 0)
  if (orderDifference !== 0) return orderDifference
  if (left.id < right.id) return -1
  return 1
}

function provenance(record: RegisteredApp): string {
  return record.sourcePlugin!
}
