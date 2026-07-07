export interface LangMeta {
  color: string
  label: string
  runnable: boolean   // JS/TS/Python → Run 버튼
  previewable: boolean // HTML/Mermaid → Preview 버튼
  isHtml: boolean
  isMermaid: boolean
}

export const LANG_META: Record<string, LangMeta> = {
  javascript: { color: '#f59e0b', label: 'JavaScript', runnable: true,  previewable: false, isHtml: false, isMermaid: false },
  js:         { color: '#f59e0b', label: 'JavaScript', runnable: true,  previewable: false, isHtml: false, isMermaid: false },
  typescript: { color: '#60a5fa', label: 'TypeScript', runnable: true,  previewable: false, isHtml: false, isMermaid: false },
  ts:         { color: '#60a5fa', label: 'TypeScript', runnable: true,  previewable: false, isHtml: false, isMermaid: false },
  python:     { color: '#3b82f6', label: 'Python',     runnable: true,  previewable: false, isHtml: false, isMermaid: false },
  py:         { color: '#3b82f6', label: 'Python',     runnable: true,  previewable: false, isHtml: false, isMermaid: false },
  html:       { color: '#f97316', label: 'HTML',       runnable: true,  previewable: true,  isHtml: true,  isMermaid: false },
  css:        { color: '#a78bfa', label: 'CSS',        runnable: false, previewable: false, isHtml: false, isMermaid: false },
  mermaid:    { color: '#8b5cf6', label: 'Mermaid',    runnable: false, previewable: true,  isHtml: false, isMermaid: true  },
  markdown:   { color: '#34d399', label: 'Markdown',   runnable: false, previewable: true,  isHtml: false, isMermaid: false },
  json:       { color: '#34d399', label: 'JSON',       runnable: false, previewable: false, isHtml: false, isMermaid: false },
  xml:        { color: '#fb923c', label: 'XML',        runnable: false, previewable: false, isHtml: false, isMermaid: false },
  sql:        { color: '#e879f9', label: 'SQL',        runnable: true,  previewable: false, isHtml: false, isMermaid: false },
  bash:       { color: '#94a3b8', label: 'Bash',       runnable: false, previewable: false, isHtml: false, isMermaid: false },
  sh:         { color: '#94a3b8', label: 'Shell',      runnable: false, previewable: false, isHtml: false, isMermaid: false },
  c:          { color: '#10b981', label: 'C',          runnable: false, previewable: false, isHtml: false, isMermaid: false },
  cpp:        { color: '#10b981', label: 'C++',        runnable: false, previewable: false, isHtml: false, isMermaid: false },
  java:       { color: '#f43f5e', label: 'Java',       runnable: false, previewable: false, isHtml: false, isMermaid: false },
  text:       { color: '#6b7280', label: 'Text',       runnable: false, previewable: false, isHtml: false, isMermaid: false },
  plaintext:  { color: '#6b7280', label: 'Text',       runnable: false, previewable: false, isHtml: false, isMermaid: false },
}

export function getLangMeta(lang: string): LangMeta {
  return LANG_META[lang.toLowerCase()] ?? {
    color: '#6b7280', label: lang, runnable: false,
    previewable: false, isHtml: false, isMermaid: false,
  }
}
