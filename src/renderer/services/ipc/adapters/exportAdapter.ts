import type { ExportProgressEvent } from '../ipcTypes'

export function onExportProgress(callback: (data: ExportProgressEvent) => void): () => void {
  if (!window.electronAPI?.onExportProgress) return () => {}
  return window.electronAPI.onExportProgress(callback)
}

export async function printToPDF(htmlContent: string): Promise<string | null> {
  if (!window.electronAPI?.printToPDF) return null
  return window.electronAPI.printToPDF(htmlContent)
}

export async function saveExportedFile(data: string, isBase64: boolean, defaultName: string, filters: { name: string; extensions: string[] }[]): Promise<string | null> {
  if (!window.electronAPI?.saveExportedFile) return null
  return window.electronAPI.saveExportedFile(data, isBase64, defaultName, filters)
}

export async function exportConvert(payload: { blocks: Record<string, unknown>[]; format: string; defaultName: string }): Promise<{ success: boolean; savedPath?: string; error?: string }> {
  if (!window.electronAPI?.exportConvert) return { success: false, error: 'API not available' }
  return window.electronAPI.exportConvert(payload)
}
