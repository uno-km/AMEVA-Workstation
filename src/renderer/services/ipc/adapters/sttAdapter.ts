export async function sttTranscribe(audioPath: string, language?: string): Promise<{ success: boolean; text?: string; error?: string }> {
  if (!window.electronAPI?.sttTranscribe) return { success: false, error: 'STT API is not exposed' }
  return window.electronAPI.sttTranscribe({ audioPath, language })
}

export async function sttGetTempPath(): Promise<string | null> {
  if (!window.electronAPI?.sttGetTempPath) return null
  return window.electronAPI.sttGetTempPath()
}
