import type { FileOpenEventData, UrlMetadata } from '../ipcTypes'

export async function openFile(): Promise<FileOpenEventData | null> {
  if (!window.electronAPI) return null
  return window.electronAPI.openFile()
}

export async function saveFile(
  content: string,
  filePath?: string | null
): Promise<{ filePath?: string; success: boolean }> {
  if (!window.electronAPI) return { success: false }
  return window.electronAPI.saveFile(content, filePath)
}

export async function saveFileAs(
  content: string,
  filePath?: string | null
): Promise<{ filePath?: string; success: boolean }> {
  if (!window.electronAPI) return { success: false }
  return window.electronAPI.saveFileAs(content, filePath)
}

export async function selectLocalFile(
  filters?: Array<{ name: string; extensions: string[] }>
): Promise<{ filePath: string; base64: string } | null> {
  if (!window.electronAPI) return null
  return window.electronAPI.selectLocalFile(filters)
}

export function onFileOpenArgv(
  callback: (event: unknown, file: FileOpenEventData) => void
): () => void {
  if (!window.electronAPI) return () => {}
  return window.electronAPI.onFileOpenArgv(callback)
}

export async function fetchUrlMetadata(url: string): Promise<UrlMetadata> {
  if (!window.electronAPI?.fetchUrlMetadata) return {}
  try {
    return await window.electronAPI.fetchUrlMetadata(url)
  } catch (e) {
    console.error('[fetchUrlMetadata] URL 메타데이터 조회 실패:', e)
    return {}
  }
}

export function openExternalLink(url: string): void {
  if (!window.electronAPI?.openExternalLink) {
    if (url.startsWith('http')) {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
    return
  }
  window.electronAPI.openExternalLink(url)
}
