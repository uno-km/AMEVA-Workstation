/**
 * @file adcPackager.ts
 * @system AMEVA OS Desktop Workstation - Utilities
 * @location src/renderer/utils/adcPackager.ts
 * @role Media-embedded Markdown integration package (.adc) packer/unpacker
 * 
 * [설계 의도 - DESIGN INTENT / ADR / PERFORMANCE CRITICAL]
 * - 마크다운 본문에 대용량 오디오/비디오 및 이미지를 base64 Data URL로 주입해 버리면,
 *   네트워크 전송 및 일반 텍스트 렌더링 파이프라인에서 수십 메가바이트의 JSON 버퍼 렉이 유발된다.
 * - 이를 해결하기 위해 **Ameva Document Container (.adc) 압축 패키징 기법**을 제안함.
 * - 내장 정규식(`dataUrlRegex`) 매칭을 돌려 base64로 박힌 비디오/오디오/이미지를 추출한 후 
 *   **`media/file_N.ext` 형태의 바이너리 개별 파일**로 분리하여 JSZip 아카이브 스레드에 격리 기입하고, 
 *   원문 마크다운에는 미디어 상대경로(media/file_N.ext)만 맵핑 기재함으로써 파일 용량 최적화 및 렌더 가속을 구현한다.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 평문 텍스트 내 dataurl 데이터들을 바이너리 버퍼(`base64ToArrayBuffer`)로 복원하여 jszip 아카이브에 압축 기입(`packMarkdownToADC`)한다.
 * - 룸에 로드할 때 .adc zip 압축을 풀어 `document.md` 원문을 획득하고, 미디어 상대 경로들을 다시 브라우저가 다이렉트 렌더 가능한 dataurl base64로 환원(`unpackADCToMarkdown`) 주입한다.
 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/hooks/): 관련 비즈니스 훅 내부 연산 시 순수 함수 유틸리티로 수입 소비.
 * - 소비처 B (src/renderer/components/): 렌더링 전 데이터 정제 단계에서 포맷터 유틸리티로 소비.
 */

/* 
 * [IMPORT SEGMENTATION & DEPS]
 * - JSZip: 브라우저 가상 zip 아카이빙 처리 라이브러리.
 */
import JSZip from 'jszip'

/**
 * [CONTRACT - ArrayBuffer to Base64 String]
 * - Rationale: 압축 해제 시 zip 내 이진 버퍼를 브라우저가 출력 가능한 base64 String으로 디코딩한다.
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `binary`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const binary = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  let binary = ''
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `bytes`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const bytes = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const bytes = new Uint8Array(buffer)
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `len`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const len = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const len = bytes.byteLength
      /*
       * [LOOP CONTROL ITERATION]
       * - 루프 조건: `for (let i = 0; i < len; i++) {`
       * - 예상 시나리오: 지정된 조건 한계 도달 시점까지 콜렉션 항목의 순차 매핑, 변환 및 동기 적재 처리를 수행함.
       * - 예시: `for (const item of list)` 루프 실행 시 모든 개별 블록의 html 포맷 정제 완료 후 스택 종결.
       */
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return window.btoa(binary)
}

/**
 * [CONTRACT - Base64 String to ArrayBuffer]
 * - Rationale: 아카이빙 시 base64 텍스트를 zip 라이브러리가 이해할 수 있는 ArrayBuffer 이진 포맷으로 복원한다.
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `binaryString`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const binaryString = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const binaryString = window.atob(base64)
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `len`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const len = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const len = binaryString.length
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `bytes`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const bytes = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const bytes = new Uint8Array(len)
      /*
       * [LOOP CONTROL ITERATION]
       * - 루프 조건: `for (let i = 0; i < len; i++) {`
       * - 예상 시나리오: 지정된 조건 한계 도달 시점까지 콜렉션 항목의 순차 매핑, 변환 및 동기 적재 처리를 수행함.
       * - 예시: `for (const item of list)` 루프 실행 시 모든 개별 블록의 html 포맷 정제 완료 후 스택 종결.
       */
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes.buffer
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
  
  // 1) Electron 환경에서의 media:// 절대 경로 감지 및 파일 바인딩
  const mediaUrlRegex = /media:\/\/([^\s"'()#?]+)/g
  const mediaMatches: { full: string; absolutePath: string; zipPath: string }[] = []
  let mediaMatch
  
  const tempMediaRegex = new RegExp(mediaUrlRegex)
  while ((mediaMatch = tempMediaRegex.exec(markdown)) !== null) {
    const full = mediaMatch[0]
    const absolutePath = mediaMatch[1]
    
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
          const base64 = arrayBufferToBase64(buffer)
          const relativeTarget = `temp_media/${sessionUuid}/${path.split('/').pop()}`
          const res = await window.electronAPI!.writeBinary(relativeTarget, base64)
          if (res.success && res.path) {
            const mediaUrl = `media://${res.path}`
            markdown = markdown.split(path).join(mediaUrl)
          } else {
            throw new Error(res.error || '실패')
          }
        } catch (err) {
          console.error(`[unpackADCToMarkdown] Electron 로컬 복원 실패, DataURL 폴백 작동: ${path}`, err)
          const base64 = arrayBufferToBase64(buffer)
          const ext = path.split('.').pop()?.toLowerCase() || ''
          const mime = getMimeType(ext)
          const dataUrl = `data:${mime};base64,${base64}`
          markdown = markdown.split(path).join(dataUrl)
        }
      } else {
        // 일반 브라우저 환경: 기존 DataURL 변환 폴백
        const base64 = arrayBufferToBase64(buffer)
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

