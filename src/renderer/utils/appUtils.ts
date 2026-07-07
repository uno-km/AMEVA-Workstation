export const matchHotkey = (e: KeyboardEvent, hotkeyStr: string) => {
  if (!hotkeyStr) return false
  
  const parts = hotkeyStr.toLowerCase().split('+')
  const key = parts.pop()
  
  const needCtrl = parts.includes('control') || parts.includes('ctrl')
  const needShift = parts.includes('shift')
  const needAlt = parts.includes('alt')
  const needMeta = parts.includes('meta') || parts.includes('cmd')
  
  const hasCtrl = e.ctrlKey || e.metaKey
  const hasShift = e.shiftKey
  const hasAlt = e.altKey
  const hasMeta = e.metaKey
  
  if (needCtrl && !hasCtrl) return false
  if (needShift && !hasShift) return false
  if (needAlt && !hasAlt) return false
  if (needMeta && !hasMeta) return false
  
  if (!needCtrl && hasCtrl) return false
  if (!needShift && hasShift) return false
  
  return e.key.toLowerCase() === key
}

export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
