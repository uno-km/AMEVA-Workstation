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
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `zip`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const zip = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const zip = new JSZip()
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `processedMarkdown`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const processedMarkdown = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  let processedMarkdown = markdown
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `mediaIndex`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const mediaIndex = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  let mediaIndex = 0
  
  // base64 Data URL 매칭용 정규식
  const dataUrlRegex = /data:([a-zA-Z0-9/+\-_]+);base64,([a-zA-Z0-9+/=]+)/g
  
  const matches: { full: string; mime: string; base64: string; path: string }[] = []
  let match
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `tempRegex`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const tempRegex = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const tempRegex = new RegExp(dataUrlRegex)
  
  // 정규식 매칭 루프
  while ((match = tempRegex.exec(markdown)) !== null) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `full`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const full = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const full = match[0]
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `mime`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const mime = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const mime = match[1]
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `base64`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const base64 = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const base64 = match[2]
    
    // 중복 매칭 제거
    if (matches.some(m => m.full === full)) continue
    
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `ext`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const ext = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const ext = mime.split('/')[1] || 'png'
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `fileName`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const fileName = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const fileName = `media/file_${mediaIndex++}.${ext}`
    matches.push({ full, mime, base64, path: fileName })
  }
  
  // 수집한 미디어 바이트들을 개별 파일로 변환하여 jszip 아카이브에 기입
  for (const item of matches) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `buffer`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const buffer = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const buffer = base64ToArrayBuffer(item.base64)
    zip.file(item.path, buffer)
    // 원문 텍스트 내 base64 String을 상대 경로 문자열로 전역 치환
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

/**
 * [CONTRACT - Unpack ADC Package to Base64 embedded Markdown]
 * - Rationale: 주입된 ArrayBuffer 패키지 zip 압축을 풀어 document.md를 독출하고, 
 *   media/ 하위의 파일들을 브라우저 렌더용 base64 Data URL로 완전히 재조립하여 리턴한다.
 */
export async function unpackADCToMarkdown(arrayBuffer: ArrayBuffer): Promise<string> {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `zip`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const zip = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const zip = await JSZip.loadAsync(arrayBuffer)
  
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `docFile`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const docFile = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const docFile = zip.file('document.md')
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!docFile`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!docFile)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
  if (!docFile) {
    throw new Error('Invalid .adc package: document.md not found')
  }
  
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `markdown`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const markdown = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  let markdown = await docFile.async('text')
  
  // 미디어 파일 경로 추출
  const mediaRegex = /media\/file_\d+\.[a-zA-Z0-9]+/g
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `matches`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const matches = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const matches = Array.from(markdown.matchAll(mediaRegex)).map(m => m[0])
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `uniquePaths`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const uniquePaths = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const uniquePaths = Array.from(new Set(matches))
  
  // 수집된 상대 경로들을 하나씩 읽어서 base64 변환 후 본문에 역주입
  for (const path of uniquePaths) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `file`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const file = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const file = zip.file(path)
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `file`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (file)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (file) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `buffer`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const buffer = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const buffer = await file.async('arraybuffer')
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `base64`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const base64 = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const base64 = arrayBufferToBase64(buffer)
      
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `ext`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const ext = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const ext = path.split('.').pop()?.toLowerCase() || ''
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `mime`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const mime = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      let mime = 'image/png'
      
      // 파일 확장자 기반 MIME 타입 검출 분기
      if (['mp4', 'webm', 'mov', 'ogg'].includes(ext)) {
        mime = `video/${ext === 'mov' ? 'quicktime' : ext}`
      } else if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) {
        mime = `audio/${ext === 'm4a' ? 'mp4' : ext}`
      } else if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
        mime = `image/${ext === 'svg' ? 'svg+xml' : ext}`
      }
      
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `dataUrl`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const dataUrl = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const dataUrl = `data:${mime};base64,${base64}`
      // 상대경로 문자열을 브라우저 렌더용 Data URL로 전역 치환
      markdown = markdown.split(path).join(dataUrl)
    }
  }
  
  return markdown
}

