/**
 * @file useAIResponseHandler.ts
 * @system AMEVA OS Desktop Workstation - Client Renderer
 * @location src/renderer/hooks/ai/useAIResponseHandler.ts
 * @role AI Inference Stream Completion & Editor Patch Handler
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - LLM 추론 완료(`handleDone`) 시, un-sanitized 누적 버퍼(rawAccum)를 파싱하여 EDIT_SUGGESTION 및 INSERT_SUGGESTION 구조를 추출한다.
 * - 추출된 코드/문서 패치 제안 사항이 있을 때, BlockNote API를 제어하여 문서 블록을 동기적으로 강제 업데이트한다.
 * - 파싱 결과 및 성공/실패 여부를 `finalizeAssistantMessage` 콜백에 라우팅하여 Zustand 상태 뷰를 최종 갱신한다.
 * 
 * [책임이 아닌 것 - NON-RESPONSIBILITY]
 * - 실시간 스트리밍 중인 토큰의 스로틀링 렌더링 업데이트 (useAIStreamProcessor가 소유).
 * - UI 스토어 업데이트 및 설정 패널 제어 (useAI 및 useUIStore가 소유).
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST NOT swallow errors: 에디터 수정 및 삽입 작업은 VFS 및 로컬 렌더링 상태를 건드리므로,
 *   예외 발생 시 catch 블록에서 로그를 삼키지 않고 `console.error`로 상세 역추적을 남길 것.
 * - MUST: `finalize` 결과로 나오는 `SanitizeResult` 객체에서 생각 버퍼(`thinkingContent`)와
 *   안전 정제 출력물(`finalContent`)을 손상 없이 획득하여 Assistant 메시지 모델에 밀어 넣어야 한다.
 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/App.tsx): 최상위 Facade 구조에 통합 마운트.
 * - 소비처 B (src/renderer/contexts/AppContext.tsx): 리액트 Context 훅 목록에 바인딩되어 하위 뷰에 전파.
 */

/* 
 * [IMPORT SEGMENTATION & CONTRACTS]
 * - useCallback: 메모이즈된 완료 액션 콜백 핸들러 바인딩을 위한 리액트 기본 API.
 */
import { useCallback } from 'react'

/* 
 * [AI UTILITIES & PARSERS]
 * - parseEditSuggestion: LLM 출력 텍스트 내부의 <edit_suggestion> 블록을 정규식을 통해 파싱하여 편집 대상 블록 ID와 코드 추출.
 * - parseInsertSuggestions: LLM 출력 텍스트 내부의 <insert_suggestion> 블록을 파싱하여 삽입될 새 블록 컨텐츠 목록 추출.
 */
import { parseEditSuggestion, parseInsertSuggestions } from '../../services/ai/aiStreamParser'

/* 
 * [TYPE DEFINITIONS]
 * - InsertSuggestion: 삽입 제안 블록 정보(블록 타입, 추가 위치, 레벨, 내용) 인터페이스 정의.
 * - SanitizeResult: 생각 태그와 실제 출력 텍스트를 발라낸 결과 레코드 구조체.
 */
import type { InsertSuggestion } from '../../types/aiTypes'
import type { SanitizeResult } from '../../utils/responseSanitizer'

/**
 * @hook useAIResponseHandler
 * @description LLM의 추론 출력 완료 트리거 시점의 데이터를 수신하여 파싱, 에디터 패치, 상태 종결 처리를 통합 조율하는 훅.
 */
export function useAIResponseHandler(
  /*
   * [PARAMETER CONTRACTS]
   * - currentSessionIdRef: 응답 완료 꼬임 방지를 위한 세션 ID 동기화용 Mutable 레퍼런스.
   * - currentAssistantIdRef: 최종 업데이트 타깃이 될 Assistant 메시지 노드 ID Mutable 레퍼런스.
   * - rawAccumRef: 날 것의 응답 전문 문자열 Mutable 레퍼런스.
   * - finalize: 스트리밍 최종 정제 핸들러(생각/결과 분리).
   * - finalizeAssistantMessage: Assistant 메시지 노드 완료 저장 콜백.
   * - unsubscribeSession: IPC 완료에 따른 세션 리스너 해제 콜백.
   * - editorRef: 대상 에디터 인스턴스 획득용 Mutable 레퍼런스.
   * - processNextQueueRef: 대기 큐 연쇄 실행 콜백 Mutable 레퍼런스.
   */
  currentSessionIdRef: React.MutableRefObject<string | null>,
  currentAssistantIdRef: React.MutableRefObject<string | null>,
  rawAccumRef: React.MutableRefObject<string>,
  finalize: () => SanitizeResult,
  finalizeAssistantMessage: (args: any) => void,
  unsubscribeSession: () => void,
  editorRef: React.MutableRefObject<any>,
  processNextQueueRef: React.MutableRefObject<(() => void) | null>
) {
  /**
   * [CONTRACT - LLM Completion Handle Done Entry]
   * - AI의 스트리밍이 최종 완료되었을 때 실행되는 라이프사이클 핸들러.
   */
  const handleDone = useCallback((
    data: { success: boolean; error?: string },
    sessId: string,
    _assistantId: string,
    taggedBlocks?: { id: string; text: string }[],
    intent?: string
  ) => {
    /* 
     * [INVARIANT - Session Lock Protection]
     * - 현재 활성화된 세션 ID와 콜백 매개변수의 세션 ID가 다를 경우 패치를 즉시 중단한다.
     * - Rationale: 비동기 응답 지연으로 인해 이전 세션의 완료 콜백이 현재 진행 중인 세션에 침투하는 레이스 컨디션을 완전히 차단함.
     */
    if (sessId !== currentSessionIdRef.current) return

    // 스트림 종료 및 최종 정제 결과 획득 (생각 버퍼와 최종 결과 분리)
    const sanitizeResult = finalize()
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `rawForEdit`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const rawForEdit = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const rawForEdit = rawAccumRef.current
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `targetId`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const targetId = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const targetId = currentAssistantIdRef.current

    /*
     * [DOWNSTREAM DEPENDENCY - Suggestion Parsing]
     * - raw 누적 문자열 내의 <edit_suggestion> 블록을 파싱한다.
     */
    const editSuggestionResult = data.success ? parseEditSuggestion(rawForEdit) : null

    // 에디터 활성 문서 트리 내 모든 블록의 flat id 배열 획득 (삽입 시 상대 위치 검증용)
    let siblingBlockIds: string[] = []
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `editorRef.current`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (editorRef.current)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (editorRef.current) {
      try {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `flatBlocks`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const flatBlocks = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const flatBlocks = (function flatten(blocks: any[]): any[] {
          return blocks.flatMap((b: any) => [b, ...flatten(b.children || [])])
        })(editorRef.current.document || [])
        siblingBlockIds = flatBlocks.map((b: any) => b.id)
      } catch (e) {
        // WARNING: 에디터 블록 목록 조회 실패 시 경고를 무시하지 않고 로그로 원인 남김.
        console.warn('[useAIAgent] 에디터 블록 목록 조회 실패:', e)
      }
    }

    /*
     * [DOWNSTREAM DEPENDENCY - Insert Suggestion Parsing]
     * - 에디터 내 특정 블록 뒤에 요소를 삽입하는 <insert_suggestion> 블록이 있는지 파싱한다.
     */
    const insertResult = (!editSuggestionResult && data.success)
      ? parseInsertSuggestions(rawForEdit, sanitizeResult.finalContent, siblingBlockIds)
      : null

    const insertSuggestions: InsertSuggestion[] = insertResult?.suggestions ?? []

    /*
     * [SIDE EFFECT - EDITOR AUTO PATCH (EDIT)]
     * - 파싱된 EDIT 제안서가 있고 성공 시, 에디터의 특정 블록 내용물(또는 Jupyter 코드 블록)을 덮어씌운다.
     */
    if (editSuggestionResult && data.success && editorRef.current) {
      try {
        const { blockId: editBlockId, proposedText } = editSuggestionResult
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `block`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const block = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const block = editorRef.current.getBlock(editBlockId)
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `block`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (block)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (block) {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `block.type === 'jupyter'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (block.type === 'jupyter')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
          if (block.type === 'jupyter') {
            editorRef.current.updateBlock(editBlockId, {
              type: 'jupyter',
              props: { ...block.props, code: proposedText }
            })
          } else {
            editorRef.current.updateBlock(editBlockId, {
              content: [{ type: 'text', text: proposedText, styles: {} }]
            })
          }
        }
      } catch (e) {
        // CONTRACT: 에디터 DOM 조작 에러는 치명적이므로 catch 후 무조건 에러 출력 (예외 삼키기 금지)
        console.error('[useAIAgent] EDIT_SUGGESTION 자동 반영 실패:', e)
      }
    }

    /*
     * [SIDE EFFECT - EDITOR AUTO PATCH (INSERT)]
     * - 파싱된 INSERT 제안서가 있고 성공 시, 대상 블록 바로 뒤에Heading 또는 Paragraph 블록을 밀어 넣는다.
     */
    if (insertSuggestions.length > 0 && data.success && editorRef.current) {
      insertSuggestions.forEach((s) => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `s.afterBlockId && s.afterBlockId !== 'undefined'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (s.afterBlockId && s.afterBlockId !== 'undefined')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (s.afterBlockId && s.afterBlockId !== 'undefined') {
          try {
            editorRef.current.insertBlocks(
              [{
                type: s.blockType === 'heading' ? 'heading' : 'paragraph',
                props: s.level ? { level: s.level } : undefined,
                content: [{ type: 'text', text: s.content, styles: {} }]
              }],
              s.afterBlockId,
              'after'
            )
          } catch (insErr) {
            // CONTRACT: 개별 블록 삽입 실패 시에도 전체 루프가 붕괴되지 않도록 에러 격리 로깅 수행.
            console.warn('[useAIAgent] INSERT_SUGGESTION 자동 반영 실패:', insErr)
          }
        }
      })
    }

    /*
     * [SIDE EFFECT - EDITOR AUTO PATCH (FALLBACK TAGGED BLOCKS)]
     * - 특정 편집 모드(EDIT/WRITE) 중 명시적 제안 블록이 파싱되지 않았고 태그 지정된 영역이 있다면,
     *   최종 정제 텍스트에서 특수 지시 헤더를 날린 후 대상 블록을 덮어쓴다.
     */
    if (!editSuggestionResult && insertSuggestions.length === 0 && data.success && editorRef.current) {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `taggedBlocks && taggedBlocks.length > 0 && (intent === 'EDIT' || intent === 'WRITE')`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (taggedBlocks && taggedBlocks.length > 0 && (intent === 'EDIT' || intent === 'WRITE'))` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (taggedBlocks && taggedBlocks.length > 0 && (intent === 'EDIT' || intent === 'WRITE')) {
        try {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `firstBlock`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const firstBlock = ...` 형태로 안전 캐싱 후 가공 기동.
       */
          const firstBlock = taggedBlocks[0]
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `block`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const block = ...` 형태로 안전 캐싱 후 가공 기동.
       */
          const block = editorRef.current.getBlock(firstBlock.id)
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `block`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (block)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
          if (block) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `finalClean`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const finalClean = ...` 형태로 안전 캐싱 후 가공 기동.
       */
            const finalClean = sanitizeResult.finalContent
              .replace(/^\[(WRITE|EDIT|CHAT|SUMMARY)\]\s*/i, '')
              .trim()
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `block.type === 'jupyter'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (block.type === 'jupyter')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
            if (block.type === 'jupyter') {
              editorRef.current.updateBlock(firstBlock.id, {
                type: 'jupyter',
                props: { ...block.props, code: finalClean }
              })
            } else {
              editorRef.current.updateBlock(firstBlock.id, {
                content: [{ type: 'text', text: finalClean, styles: {} }]
              })
            }
          }
        } catch (e) {
          // CONTRACT: 폴백 업데이트 실패 시에도 UI 상태 동기화는 이어질 수 있도록 로깅 후 무력화.
          console.error('[useAIAgent] 태그블록 자동 반영 실패:', e)
        }
      }
    }

    /*
     * [CONTRACT - UI State Finalization]
     * - 메시지 상태 저장을 종료하고, 로딩 바를 내린 후, DB 이력 갱신 처리를 최종 유도한다.
     */
    finalizeAssistantMessage({
      targetId,
      sanitizeResult,
      rawForEdit,
      success: data.success,
      error: data.error,
      editSuggestion: editSuggestionResult,
      insertSuggestions
    })

    // 라이브러리/어댑터 세션 토큰 리스너 및 메모리 리소스 해제
    unsubscribeSession()

    /*
     * [CONTRACT - Queue Release Gate]
     * - 수동으로 수락/거절을 선택해야 하는 제안서가 팝업되어 있을 때는, 대기 중인 다음 AI 명령을 자동으로 실행하지 않고 홀딩한다.
     * - Rationale: 사용자가 이전 수락/거절을 수동 결정하기 전까지 뒤의 큐들이 에디터를 덮어쓰는 동기화 꼬임 현상을 차단함.
     */
    const hasPendingDecision = data.success && (!!editSuggestionResult || insertSuggestions.length > 0)
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!hasPendingDecision`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!hasPendingDecision)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (!hasPendingDecision) {
      setTimeout(() => processNextQueueRef.current?.(), 80)
    }
  }, [currentSessionIdRef, currentAssistantIdRef, rawAccumRef, finalize, finalizeAssistantMessage, unsubscribeSession, editorRef, processNextQueueRef])

  return { handleDone }
}

/**
 * ============================================================================
 * FUTURE DEVELOPMENT GUIDE (AI Agent Instruction Layer)
 * ============================================================================
 * 1. 신규 에디터 패치 문법이나 파싱 포맷을 도입하고자 할 때:
 *    - `src/renderer/services/ai/aiStreamParser.ts` 내의 정규식 파서에 신규 파싱 함수를 추가할 것.
 *    - `handleDone` 콜백 상단에서 해당 파서를 호출하여 데이터를 바인딩할 것.
 * 
 * 2. Jupyter 코드 블록 외에 신규 블록 커스텀 타입(예: 차트, 드로잉) 패치가 필요할 때:
 *    - `block.type === 'jupyter'` 등의 분기문 하단에 안전 타입 체크와 갱신 로직을 보강할 것.
 *    - 각 분기 내부마다 예외가 전역으로 퍼지지 않도록 `try-catch` 가드를 단단히 씌울 것.
 * ============================================================================
 */

