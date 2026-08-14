interface FixtureContext {
  slots: {
    inject(key: string, callback: () => () => void): () => void
    register(options: {
      name: string
      id: string
    }, component: () => null): () => void
  }
}

export const name = 'phase3.fixture.extension'
export const inject = ['slots']

export function apply(ctx: FixtureContext): void {
  ctx.slots.inject('phase3.beta.extension', () => ctx.slots.register({
    name: 'phase3.beta.extension',
    id: 'phase3.extension.entry',
  }, () => null))
}
