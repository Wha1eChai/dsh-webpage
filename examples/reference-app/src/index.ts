/** Owner data passed to the reference App's action contributions. */
export interface ReferenceAppOwner {
  readonly appPath: string
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /** Actions contributed by plugins to the reference App. */
    'wha1echai.reference.actions': {
      kind: 'list'
      scope: 'root'
      owner: ReferenceAppOwner
    }
  }
}

/** Host-side lifecycle entry; the App is a client composition contribution. */
export function apply(): void {}
