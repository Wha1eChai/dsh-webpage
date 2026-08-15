/** Crash App product copy: Chinese is the default and English is complete. */
export const zh = Object.freeze({
  title: '崩溃演示',
  description: '打开后立即抛错，用来验证应用故障域。',
})

export const en = Object.freeze({
  title: 'Crash App',
  description: 'Throws on open so the App failure domain can be demonstrated.',
})

export type CrashLocaleKey = keyof typeof zh

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    crash: CrashLocaleKey
  }
}
