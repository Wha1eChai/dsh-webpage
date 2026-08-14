import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { HostObservable, LiveSlotNode } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '../slots.js'

/** A disposable, React-free observable view of the Webpage slot topology. */
export interface SlotTopologySource extends HostObservable<readonly LiveSlotNode[]> {
  dispose(): void
}

const sources = new WeakMap<ClientContext, SlotTopologySource>()

/**
 * Return the context-stable topology source used by the Inspector's injected
 * hook. The source deliberately observes the global event so child declarations
 * beneath a keyed App are not missed.
 */
export function createSlotTopologySource(ctx: ClientContext): SlotTopologySource {
  const existing = sources.get(ctx)
  if (existing) return existing

  const source = new SlotTopologySourceImpl(ctx)
  sources.set(ctx, source)
  return source
}

class SlotTopologySourceImpl implements SlotTopologySource {
  private readonly owner: ClientContext
  private readonly slots: ClientContext['slots']
  private snapshot: readonly LiveSlotNode[]
  private serialization: string
  private notificationQueued = false
  private disposed = false
  private readonly subscribers = new Set<() => void>()
  private readonly removeContextListener: () => boolean

  constructor(ctx: ClientContext) {
    this.owner = ctx
    this.slots = ctx.slots
    this.snapshot = freezeSnapshot(this.slots.snapshot('webpage.app'))
    this.serialization = serialize(this.snapshot)
    this.removeContextListener = ctx.on('slots/changed', () => this.queueRefresh())
  }

  getSnapshot(): readonly LiveSlotNode[] {
    return this.snapshot
  }

  subscribe(listener: () => void): () => void {
    this.subscribers.add(listener)
    let active = true
    return () => {
      if (!active) return
      active = false
      this.subscribers.delete(listener)
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.removeContextListener()
    this.subscribers.clear()
    sources.delete(this.owner)
  }

  private queueRefresh(): void {
    if (this.disposed || this.notificationQueued) return
    this.notificationQueued = true
    queueMicrotask(() => this.flush())
  }

  private flush(): void {
    this.notificationQueued = false
    if (this.disposed) return

    const next = freezeSnapshot(this.snapshotSource())
    const serialization = serialize(next)
    if (serialization === this.serialization) return

    this.snapshot = next
    this.serialization = serialization
    for (const subscriber of [...this.subscribers]) {
      if (this.disposed) return
      try {
        subscriber()
      } catch (error) {
        console.error('[dsh-webpage] topology subscriber failed:', error)
      }
    }
  }

  private snapshotSource(): LiveSlotNode[] {
    return this.slots.snapshot('webpage.app')
  }
}

function serialize(snapshot: readonly LiveSlotNode[]): string {
  return JSON.stringify(snapshot)
}

function freezeSnapshot(snapshot: readonly LiveSlotNode[]): readonly LiveSlotNode[] {
  const frozen = [...snapshot]
  frozen.forEach(freezeNode)
  return Object.freeze(frozen)
}

function freezeNode(node: LiveSlotNode): void {
  node.occupants.forEach(occupant => Object.freeze(occupant))
  node.children.forEach(freezeNode)
  Object.freeze(node.occupants)
  Object.freeze(node.children)
  Object.freeze(node)
}
