export interface WebSearchResult {
  success?: boolean
  result?: string
  error?: string
  [key: string]: unknown
}

export async function runPythonCode(code: string): Promise<{ success: boolean; result?: string; error?: string }> {
  if (!window.electronAPI?.runPythonCode) return { success: false, error: 'API not available' }
  return window.electronAPI.runPythonCode(code)
}

export async function webSearch(query: string): Promise<WebSearchResult | null> {
  if (!window.electronAPI?.webSearch) return null
  return window.electronAPI.webSearch(query)
}
