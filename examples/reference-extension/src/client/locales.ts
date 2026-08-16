/** The extension-owned DSH locale namespace. */
export const LOCALE_NAMESPACE = 'dshapps.reference.extension' as const

/** Keys shared by the extension's Chinese and English dictionaries. */
export type ReferenceExtensionLocaleKey = 'actionTitle' | 'pathLabel'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    [LOCALE_NAMESPACE]: ReferenceExtensionLocaleKey
  }
}

export const zh: Record<ReferenceExtensionLocaleKey, string> = {
  actionTitle: '参考扩展动作',
  pathLabel: '当前应用路径',
}

export const en: Record<ReferenceExtensionLocaleKey, string> = {
  actionTitle: 'Reference extension action',
  pathLabel: 'Current App path',
}

/** Globally namespaced child slot owned and rendered by the reference App. */
export const ACTION_SLOT = 'dshapps.reference.actions' as const

/** Stable list-entry identity for this extension contribution. */
export const ACTION_ID = 'reference-extension.action'
