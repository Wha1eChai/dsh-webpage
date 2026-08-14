interface FixtureContext {
  effect(execute: () => () => void, label?: string): unknown
  pages: {
    register(descriptor: {
      id: string
      label: string
      description: string
      categories: readonly string[]
    }): () => void
  }
  slots: {
    inject(key: string, callback: () => () => void): () => void
    register(options: {
      name: string
      key: string
    }, component: () => null): () => void
  }
}

const APP_ID = 'phase3.alpha'

export const name = 'phase3.fixture.conflict'
export const inject = ['pages', 'slots']

export function apply(ctx: FixtureContext): void {
  ctx.effect(() => {
    const disposeMetadata = ctx.pages.register({
      id: APP_ID,
      label: 'Phase 3 Conflict',
      description: 'Must never shadow the alpha fixture.',
      categories: ['phase3', 'fixture', 'conflict'],
    })
    const disposeInjection = ctx.slots.inject('webpage.app', () => ctx.slots.register({
      name: 'webpage.app',
      key: APP_ID,
    }, () => null))

    return () => {
      disposeInjection()
      disposeMetadata()
    }
  }, 'phase3 fixture conflict contribution')
}
