import JSZip from 'jszip'

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return window.btoa(binary)
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64)
  const len = binaryString.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes.buffer
}

export async function packMarkdownToADC(markdown: string, metadata?: any): Promise<Blob> {
  const zip = new JSZip()
  let processedMarkdown = markdown
  let mediaIndex = 0
  
  // base64 Data URL 정규식 매칭
  const dataUrlRegex = /data:([a-zA-Z0-9/+\-_]+);base64,([a-zA-Z0-9+/=]+)/g
  
  const matches: { full: string; mime: string; base64: string; path: string }[] = []
  let match
  const tempRegex = new RegExp(dataUrlRegex)
  while ((match = tempRegex.exec(markdown)) !== null) {
    const full = match[0]
    const mime = match[1]
    const base64 = match[2]
    
    if (matches.some(m => m.full === full)) continue
    
    const ext = mime.split('/')[1] || 'png'
    const fileName = `media/file_${mediaIndex++}.${ext}`
    matches.push({ full, mime, base64, path: fileName })
  }
  
  for (const item of matches) {
    const buffer = base64ToArrayBuffer(item.base64)
    zip.file(item.path, buffer)
    processedMarkdown = processedMarkdown.split(item.full).join(item.path)
  }
  
  zip.file('document.md', processedMarkdown)
  
  const metaObj = {
    title: metadata?.title || 'Ameva Document',
    author: metadata?.author || 'Unknown',
    createdAt: metadata?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  zip.file('meta.json', JSON.stringify(metaObj, null, 2))
  
  return await zip.generateAsync({ type: 'blob' })
}

export async function unpackADCToMarkdown(arrayBuffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(arrayBuffer)
  
  const docFile = zip.file('document.md')
  if (!docFile) {
    throw new Error('Invalid .adc package: document.md not found')
  }
  
  let markdown = await docFile.async('text')
  
  const mediaRegex = /media\/file_\d+\.[a-zA-Z0-9]+/g
  const matches = Array.from(markdown.matchAll(mediaRegex)).map(m => m[0])
  const uniquePaths = Array.from(new Set(matches))
  
  for (const path of uniquePaths) {
    const file = zip.file(path)
    if (file) {
      const buffer = await file.async('arraybuffer')
      const base64 = arrayBufferToBase64(buffer)
      
      const ext = path.split('.').pop()?.toLowerCase() || ''
      let mime = 'image/png'
      if (['mp4', 'webm', 'mov', 'ogg'].includes(ext)) {
        mime = `video/${ext === 'mov' ? 'quicktime' : ext}`
      } else if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) {
        mime = `audio/${ext === 'm4a' ? 'mp4' : ext}`
      } else if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
        mime = `image/${ext === 'svg' ? 'svg+xml' : ext}`
      }
      
      const dataUrl = `data:${mime};base64,${base64}`
      markdown = markdown.split(path).join(dataUrl)
    }
  }
  
  return markdown
}
