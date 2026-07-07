export function triggerBrowserDownload(data: Blob | string, filename: string) {
  const blob = typeof data === 'string' ? new Blob([data], { type: 'text/markdown;charset=utf-8' }) : data
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
