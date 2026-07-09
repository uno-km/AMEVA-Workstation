/**
 * @file markdownUtils.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/utils/markdownUtils.ts
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/hooks/): 관련 비즈니스 훅 내부 연산 시 순수 함수 유틸리티로 수입 소비.
 * - 소비처 B (src/renderer/components/): 렌더링 전 데이터 정제 단계에서 포맷터 유틸리티로 소비.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 본 파일은 AMEVA 시스템 내에서 도메인 목적에 부합하는 연산 및 데이터 처리 흐름을 안전하게 캡슐화한다.
 * - 외부 라이브러리 및 하위 종속성을 조율하고 결과 규격을 일관되게 제공한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그를 명확하게 남길 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `convertJupyterToCodeBlocks`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `convertJupyterToCodeBlocks(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
export function convertJupyterToCodeBlocks(blocks: any[]): any[] {
  return blocks.map(block => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `copy`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const copy = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const copy = { ...block }
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `copy.type === 'jupyter'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (copy.type === 'jupyter')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (copy.type === 'jupyter') {
      copy.type = 'codeBlock'
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `lang`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const lang = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const lang = copy.props?.language || 'javascript'
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `finalCodeText`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const finalCodeText = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const finalCodeText = copy.props?.code || ''
      copy.content = [{ type: 'text', text: finalCodeText, styles: {} }]
      copy.props = {
        language: lang
      }
    } else if (copy.type === 'drawing') {
      copy.type = 'codeBlock'
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `dataText`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const dataText = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const dataText = copy.props?.data || '[]'
      copy.content = [{ type: 'text', text: dataText, styles: {} }]
      copy.props = {
        language: 'ameva-drawing'
      }
    } else if (copy.children) {
      copy.children = convertJupyterToCodeBlocks(copy.children)
    }
    return copy
  })
}

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `normalizeMarkdown`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `normalizeMarkdown(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
export function normalizeMarkdown(raw: string): string {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `content`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const content = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  let content = raw.replace(/\r\n/g, '\n')
  content = content.replace(/^(#{1,6})([^\s#])/gm, '$1 $2')

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `parts`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const parts = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const parts = content.split('```')
      /*
       * [LOOP CONTROL ITERATION]
       * - 루프 조건: `for (let i = 1; i < parts.length; i += 2) {`
       * - 예상 시나리오: 지정된 조건 한계 도달 시점까지 콜렉션 항목의 순차 매핑, 변환 및 동기 적재 처리를 수행함.
       * - 예시: `for (const item of list)` 루프 실행 시 모든 개별 블록의 html 포맷 정제 완료 후 스택 종결.
       */
  for (let i = 1; i < parts.length; i += 2) {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `parts[i]`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (parts[i])` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (parts[i]) {
      parts[i] = parts[i].replace(/\n\s*\n/g, '\n\u200B\n')
      parts[i] = parts[i].replace(/</g, '__LT_TEMP__')
      parts[i] = parts[i].replace(/>/g, '__GT_TEMP__')
    }
  }
  content = parts.join('```')
  
  content = content.replace(/\n*```([a-zA-Z0-9_-]+)[^\n]*\n+/g, (_, lang) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `l`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const l = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const l = lang.toLowerCase()
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `mapped`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const mapped = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const mapped = l === 'js' ? 'javascript' : l === 'ts' ? 'typescript' : l === 'py' ? 'python' : l
    return `\n\n\`\`\`${mapped}\n`
  })
  content = content.replace(/\n*```[ \t]*\n+/g, '\n```\n\n')
  content = content.replace(/\n{3,}/g, '\n\n')
  return content.trim()
}

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `cleanCodeBlocks`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `cleanCodeBlocks(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
export function cleanCodeBlocks(blocks: any[]) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `supportedLangs`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const supportedLangs = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const supportedLangs = ['python', 'py', 'javascript', 'js', 'html', 'css', 'c', 'cpp', 'java', 'xml', 'json', 'text', 'txt', 'plaintext', 'mermaid', 'bash', 'sh', 'typescript', 'ts', 'sql', 'ameva-drawing']
  blocks.forEach(block => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `block.type === 'codeBlock'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (block.type === 'codeBlock')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (block.type === 'codeBlock') {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `text`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const text = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const text = block.content ? block.content.map((c: any) => c.text).join('') : ''
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `cleaned`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const cleaned = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      let cleaned = text.replace(/\u200B/g, '').replace(/__LT_TEMP__/g, '<').replace(/__GT_TEMP__/g, '>')
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `lines`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const lines = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const lines = cleaned.split('\n')
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `firstLine`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const firstLine = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const firstLine = lines[0]?.trim()
      
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `lang`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const lang = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      let lang = 'javascript'
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `finalCode`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const finalCode = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      let finalCode = cleaned
      
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `amevaLangMatch`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const amevaLangMatch = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const amevaLangMatch = firstLine ? firstLine.match(/^(?:\/\/#|--|<!--)\s*\[AMEVA_LANG:([a-zA-Z0-9_-]+)\](?:\s*-->)?/) || firstLine.match(/^(?:\/\/|#|--)\s*\[AMEVA_LANG:([a-zA-Z0-9_-]+)\]/) : null
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `amevaLangMatch`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (amevaLangMatch)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (amevaLangMatch) {
        lang = amevaLangMatch[1].toLowerCase()
        finalCode = lines.slice(1).join('\n')
      } 
      else if (firstLine && (
        supportedLangs.includes(firstLine.toLowerCase()) ||
        (block.props?.language && firstLine.toLowerCase() === block.props.language.toLowerCase()) ||
        (block.props?.language && firstLine.toLowerCase() === 'py' && block.props.language.toLowerCase() === 'python') ||
        (block.props?.language && firstLine.toLowerCase() === 'js' && block.props.language.toLowerCase() === 'javascript') ||
        (block.props?.language && firstLine.toLowerCase() === 'ts' && block.props.language.toLowerCase() === 'typescript')
      )) {
        lang = firstLine.toLowerCase() === 'py' ? 'python' : firstLine.toLowerCase() === 'js' ? 'javascript' : firstLine.toLowerCase() === 'ts' ? 'typescript' : firstLine.toLowerCase()
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `block.props?.language && !supportedLangs.includes(firstLine.toLowerCase())`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (block.props?.language && !supportedLangs.includes(firstLine.toLowerCase()))` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (block.props?.language && !supportedLangs.includes(firstLine.toLowerCase())) {
          lang = block.props.language.toLowerCase()
        }
        finalCode = lines.slice(1).join('\n')
      } 
      else {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `rawLang`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const rawLang = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const rawLang = (block.props?.language || 'javascript').toLowerCase()
        lang = rawLang === 'js' ? 'javascript' : rawLang === 'ts' ? 'typescript' : rawLang === 'py' ? 'python' : rawLang
      }
      
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `lang === 'ameva-drawing'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (lang === 'ameva-drawing')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (lang === 'ameva-drawing') {
        block.type = 'drawing'
        block.props = {
          data: finalCode
        }
        block.content = undefined
        return
      }

      block.type = 'jupyter'
      block.props = {
        language: lang,
        code: finalCode,
        runState: JSON.stringify({ hasRun: false, success: null, outputLines: [] })
      }
      block.content = undefined
    }
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `block.type === 'image' && block.props?.url`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (block.type === 'image' && block.props?.url)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (block.type === 'image' && block.props?.url) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `url`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const url = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const url = block.props.url.toLowerCase()
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `isVideo`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const isVideo = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const isVideo = url.endsWith('.mp4') || 
                      url.endsWith('.webm') || 
                      url.endsWith('.mov') || 
                      url.endsWith('.ogg') ||
                      url.startsWith('data:video/')
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `isVideo`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (isVideo)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (isVideo) {
        block.type = 'video'
      }
    }
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `block.children`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (block.children)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (block.children) {
      cleanCodeBlocks(block.children)
    }
  })
}

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `ensureBlockIds`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `ensureBlockIds(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
export function ensureBlockIds(blocks: any[]) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `generateId`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const generateId = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const generateId = () => Math.random().toString(36).substring(2, 10)
  blocks.forEach(block => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!block.id`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!block.id)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (!block.id) {
      block.id = generateId()
    }
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `block.children`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (block.children)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (block.children) {
      ensureBlockIds(block.children)
    }
  })
}

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `cleanMarkdownCodeBlocks`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `cleanMarkdownCodeBlocks(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
export function cleanMarkdownCodeBlocks(markdown: string): string {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `norm`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const norm = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const norm = (l: string) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `low`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const low = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const low = l.toLowerCase()
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `low === 'js'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (low === 'js')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (low === 'js') return 'javascript'
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `low === 'ts'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (low === 'ts')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (low === 'ts') return 'typescript'
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `low === 'py'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (low === 'py')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (low === 'py') return 'python'
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `low === 'txt'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (low === 'txt')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (low === 'txt') return 'text'
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `low === 'sh'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (low === 'sh')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (low === 'sh') return 'bash'
    return low
  }
  return markdown.replace(/```([a-zA-Z0-9_-]+)\n\s*([a-zA-Z0-9_-]+)\n/g, (match, lang1, lang2) => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `norm(lang1) === norm(lang2)`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (norm(lang1) === norm(lang2))` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (norm(lang1) === norm(lang2)) {
      return `\`\`\`${lang1}\n`
    }
    return match
  })
}
