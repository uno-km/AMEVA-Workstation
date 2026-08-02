import JSZip from 'jszip';

/**
 * @file adcPackager.ts
 */

async function arrayBufferToBase64(buffer: ArrayBuffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([buffer]);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * [CONTRACT - Base64 String to ArrayBuffer]
 * - Rationale: 아카이빙 시 base64 텍스트를 zip 라이브러리가 이해할 수 있는 ArrayBuffer 이진 포맷으로 복원한다.
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * [CONTRACT - Pack Markdown and Base64 Media to ADC Blob]
 * - Rationale: 마크다운 텍스트 내의 모든 base64 Data URL을 추출하여 media/ 폴더 하위에 바이너리 저장 파일로 파킹하고,
 *   원문에는 상대 경로로 교체한 뒤 메타데이터 JSON(`meta.json`)과 함께 최종 ZIP Blob 객체를 구성해 리턴한다.
 */
export async function packMarkdownToADC(markdown: string, metadata?: any): Promise<Blob> {
  const zip = new JSZip()
  let processedMarkdown = markdown
  let mediaIndex = 0
  
  const localMediaRegex = /(media:\/\/|file:\/\/\/|[a-zA-Z]:[\\/])([^\s"'()#?,]+)/g
  const mediaMatches: { full: string; absolutePath: string; zipPath: string }[] = []
  let mediaMatch
  
  const tempMediaRegex = new RegExp(localMediaRegex)
  while ((mediaMatch = tempMediaRegex.exec(markdown)) !== null) {
    const full = mediaMatch[0]
    
    // 순수 로컬 절대 경로 추출 및 윈도우 경로 정규화
    let absolutePath = full
    if (absolutePath.startsWith('media://')) {
      absolutePath = absolutePath.substring(8)
    } else if (absolutePath.startsWith('file:///')) {
      absolutePath = absolutePath.substring(8)
    }
    absolutePath = absolutePath.replace(/\\/g, '/')
    
    if (mediaMatches.some(m => m.full === full)) continue
    
    const ext = absolutePath.split('.').pop()?.toLowerCase() || 'png'
    const zipPath = `media/file_${mediaIndex++}.${ext}`
    mediaMatches.push({ full, absolutePath, zipPath })
  }
  
  // Electron API를 이용해 로컬 미디어 바이너리를 읽어 zip 아카이브에 기입
  if (mediaMatches.length > 0 && typeof window !== 'undefined' && window.electronAPI?.readBinary) {
    for (const item of mediaMatches) {
      try {
        const res = await window.electronAPI.readBinary(item.absolutePath)
        if (res.success && res.content) {
          const buffer = base64ToArrayBuffer(res.content)
          zip.file(item.zipPath, buffer)
          processedMarkdown = processedMarkdown.split(item.full).join(item.zipPath)
        }
      } catch (err) {
        console.error(`[packMarkdownToADC] 로컬 미디어 파일 읽기 실패: ${item.absolutePath}`, err)
      }
    }
  }
  
  // 2) 기존 dataUrlRegex 매칭 (폴백 및 타 리소스용)
  const dataUrlRegex = /data:([a-zA-Z0-9/+\-_]+);base64,([a-zA-Z0-9+/=]+)/g
  const dataMatches: { full: string; mime: string; base64: string; path: string }[] = []
  let dataMatch
  const tempRegex = new RegExp(dataUrlRegex)
  while ((dataMatch = tempRegex.exec(processedMarkdown)) !== null) {
    const full = dataMatch[0]
    const mime = dataMatch[1]
    const base64 = dataMatch[2]
    
    if (dataMatches.some(m => m.full === full)) continue
    
    const ext = mime.split('/')[1] || 'png'
    const fileName = `media/file_${mediaIndex++}.${ext}`
    dataMatches.push({ full, mime, base64, path: fileName })
  }
  
  for (const item of dataMatches) {
    const buffer = base64ToArrayBuffer(item.base64)
    zip.file(item.path, buffer)
    processedMarkdown = processedMarkdown.split(item.full).join(item.path)
  }
  
  // 경로 변환된 마크다운 문서 삽입
  zip.file('document.md', processedMarkdown)
  
  // 아메바 문서 작성 정보 메타 기록
  const metaObj = {
    title: metadata?.title || 'Ameva Document',
    author: metadata?.author || 'Unknown',
    createdAt: metadata?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  zip.file('meta.json', JSON.stringify(metaObj, null, 2))
  
  // jszip 바이너리 패키지 출력 리턴
  return await zip.generateAsync({ type: 'blob' })
}

export async function unpackADCToMarkdown(arrayBuffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(arrayBuffer)
  const docFile = zip.file('document.md')
  if (!docFile) {
    throw new Error('Invalid .adc package: document.md not found')
  }
  
  let markdown = await docFile.async('text')
  
  // 미디어 파일 경로 추출
  const mediaRegex = /media\/file_\d+\.[a-zA-Z0-9]+/g
  const matches = Array.from(markdown.matchAll(mediaRegex)).map(m => m[0])
  const uniquePaths = Array.from(new Set(matches))
  
  const hasElectronIO = typeof window !== 'undefined' && window.electronAPI?.writeBinary
  const sessionUuid = Math.random().toString(36).substring(2, 10)
  
  // 수집된 상대 경로들을 하나씩 읽어서 복원 진행
  for (const path of uniquePaths) {
    const file = zip.file(path)
    if (file) {
      const buffer = await file.async('arraybuffer')
      
      if (hasElectronIO) {
        // Electron 환경: 임시 폴더에 디스크 저장 후 media:// 복원
        try {
          const base64 = await arrayBufferToBase64(buffer)
          const relativeTarget = `temp_media/${sessionUuid}/${path.split('/').pop()}`
          const res = await window.electronAPI!.writeBinary(relativeTarget, base64) as any
          if (res.success && res.path) {
            const mediaUrl = `media://${res.path}`
            markdown = markdown.split(path).join(mediaUrl)
          } else {
            throw new Error(res.error || '실패')
          }
        } catch (err) {
          console.error(`[unpackADCToMarkdown] Electron 로컬 복원 실패, DataURL 폴백 작동: ${path}`, err)
          const base64 = await arrayBufferToBase64(buffer)
          const ext = path.split('.').pop()?.toLowerCase() || ''
          const mime = getMimeType(ext)
          const dataUrl = `data:${mime};base64,${base64}`
          markdown = markdown.split(path).join(dataUrl)
        }
      } else {
        // 일반 브라우저 환경: 기존 DataURL 변환 폴백
        const base64 = await arrayBufferToBase64(buffer)
        const ext = path.split('.').pop()?.toLowerCase() || ''
        const mime = getMimeType(ext)
        const dataUrl = `data:${mime};base64,${base64}`
        markdown = markdown.split(path).join(dataUrl)
      }
    }
  }
  
  return markdown
}

// 헬퍼: 확장자에 따른 MIME 타입 검출
function getMimeType(ext: string): string {
  if (['mp4', 'webm', 'mov', 'ogg'].includes(ext)) {
    return `video/${ext === 'mov' ? 'quicktime' : ext}`
  } else if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) {
    return `audio/${ext === 'm4a' ? 'mp4' : ext}`
  } else if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
    return `image/${ext === 'svg' ? 'svg+xml' : ext}`
  } else if (['pptx', 'ppt'].includes(ext)) {
    return 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  }
  return 'application/octet-stream'
}

