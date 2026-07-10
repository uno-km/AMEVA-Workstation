/**
 * @file useAIRAG.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/hooks/ai/useAIRAG.ts
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/App.tsx): 최상위 Facade 구조에 통합 마운트.
 * - 소비처 B (src/renderer/contexts/AppContext.tsx): 리액트 Context 훅 목록에 바인딩되어 하위 뷰에 전파.
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
   * - 함수 명: `useAIRAG`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `useAIRAG(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
export function useAIRAG(
  blocks: any[],
  currentContent: string,
  selectedText: string,
  useContext: boolean,
  manualMode: string,
  activeBlockId: string | undefined,
  apiType: string,
  gpuOnly: boolean,
  apiKey: string,
  modelPath: string,
  onSend: (msg: string, context?: string, selected?: string, blockId?: string, settings?: any) => void
) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `getContextWithRAG`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const getContextWithRAG = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const getContextWithRAG = (_query: string, useFullFallback = false) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `buildBlockIndex`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const buildBlockIndex = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const buildBlockIndex = () => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!blocks || blocks.length === 0`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!blocks || blocks.length === 0)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (!blocks || blocks.length === 0) return ''
      const flatAll: any[] = (function flatten(bks: any[]): any[] {
        return (bks || []).flatMap((b: any) => [b, ...flatten(b.children || [])])
      })(blocks)
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `lines`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const lines = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const lines = flatAll.map((b: any) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `txt`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const txt = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const txt = Array.isArray(b.content)
          ? b.content.map((c: any) => c.text || '').join('').slice(0, 60)
          : ''
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `extra`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const extra = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const extra = b.type === 'heading' && b.props?.level ? ` level=${b.props.level}` : ''
        return `[Block ID: ${b.id}, Type: ${b.type}${extra}] ${txt}`
      })
      return `[문서 블록 구조 목록 — 삽입 위치(afterBlockId) 선택 시 사용]\n` + lines.join('\n')
    }

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `selectedText`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (selectedText)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (selectedText) {
      return `[선택한 부분 텍스트]\n${selectedText}\n\n[문서 내용 전체]\n${currentContent}\n\n${buildBlockIndex()}`
    }
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!useContext && !useFullFallback) return buildBlockIndex(`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!useContext && !useFullFallback) return buildBlockIndex()` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (!useContext && !useFullFallback) return buildBlockIndex() || undefined

    return (currentContent ? currentContent + '\n\n' : '') + buildBlockIndex()
  }

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `getActiveMode`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const getActiveMode = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const getActiveMode = (queryText: string): 'write' | 'edit' | 'summary' | 'chat' => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `manualMode !== 'auto'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (manualMode !== 'auto')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (manualMode !== 'auto') return manualMode as any
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `cleanInput`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const cleanInput = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const cleanInput = queryText.toLowerCase().trim()
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `summaryKeywords`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const summaryKeywords = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const summaryKeywords = ['요약', '정리', '줄여', 'summarize', 'summary', 'brief']
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `summaryKeywords.some(k => cleanInput.includes(k))`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (summaryKeywords.some(k => cleanInput.includes(k)))` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (summaryKeywords.some(k => cleanInput.includes(k))) return 'summary'
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `writeKeywords`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const writeKeywords = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const writeKeywords = [
      '써줘', '써', '작성', '보고서', '리포트', '문서 만들어', '글 써줘',
      '제목', '본문', '넣어줘', '넣어', '입력해', '추가해줘', '만들어줘',
      '생성해', '도입말', '서론', '결론', 'write', 'draft', 'create', 'compose', 'generate', 'insert',
    ]
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `writeKeywords.some(k => cleanInput.includes(k))`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (writeKeywords.some(k => cleanInput.includes(k)))` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (writeKeywords.some(k => cleanInput.includes(k))) return 'write'
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `selectedText`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (selectedText)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (selectedText) return 'edit'
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `editKeywords`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const editKeywords = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const editKeywords = [
      '수정', '변경', '바꿔', '고쳐', '삽입', '지워', '교체', '고쳐줘',
      'edit', 'modify', 'replace', 'rewrite', 'correct'
    ]
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `editKeywords.some(k => cleanInput.includes(k))`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (editKeywords.some(k => cleanInput.includes(k)))` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (editKeywords.some(k => cleanInput.includes(k))) return 'edit'
    return 'chat'
  }

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `handleSendAction`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const handleSendAction = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const handleSendAction = (text: string, isQuickAction = false) => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!text.trim()`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!text.trim())` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (!text.trim()) return
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `finalContext`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const finalContext = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const finalContext = getContextWithRAG(text.trim(), isQuickAction)
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `resolvedMode`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const resolvedMode = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const resolvedMode = getActiveMode(text)

    onSend(text.trim(), finalContext, selectedText || undefined, activeBlockId, {
      apiType, gpuOnly, apiKey, modelPath, resolvedMode, isQuickAction
    })
  }

  return { getContextWithRAG, getActiveMode, handleSendAction }
}

