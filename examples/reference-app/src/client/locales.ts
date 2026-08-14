/** Reference App product copy: Chinese is the default and English is complete. */
export const zh = Object.freeze({
  title: '参考应用',
  description: '这是一个验证 DSH Webpage 应用路由与扩展槽组合的参考应用。',
  rootTitle: '应用首页',
  rootDescription: '当前位于参考应用的根路径。',
  detailsTitle: '详情页',
  detailsDescription: '这是参考应用的第二个本地页面。',
  openDetails: '打开详情页',
  backToRoot: '返回首页',
  close: '关闭应用',
  actions: '扩展操作',
  notFoundTitle: '页面未找到',
  notFoundDescription: '参考应用没有这个本地路径。',
})

export const en = Object.freeze({
  title: 'Reference App',
  description: 'A reference App for verifying DSH Webpage routes and extension slots.',
  rootTitle: 'App home',
  rootDescription: 'You are at the reference App root route.',
  detailsTitle: 'Details',
  detailsDescription: 'This is the second local page in the reference App.',
  openDetails: 'Open details',
  backToRoot: 'Back to home',
  close: 'Close app',
  actions: 'Extension actions',
  notFoundTitle: 'Page not found',
  notFoundDescription: 'The reference App has no page at this local path.',
})

export type ReferenceLocaleKey = keyof typeof zh

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    reference: ReferenceLocaleKey
  }
}
