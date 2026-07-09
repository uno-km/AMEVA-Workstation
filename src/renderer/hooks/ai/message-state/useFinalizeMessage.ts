/**
 * @file useFinalizeMessage.ts
 * @system AMEVA OS Desktop Workstation - Client Renderer
 * @location src/renderer/hooks/ai/message-state/useFinalizeMessage.ts
 * @role Assistant Chat Message finalization & Output mapper Hook
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - LLM 추론 완료 통보 수신 시, Assistant 메시지 노드 상태를 종결(`isStreaming: false`)로 변경한다.
 * - 사용자가 요청을 중간 중단(Abort)했는지 여부(checkAbortError)를 감지하여, 중단 시까지 수집된 파편 텍스트를 메시지 본문으로 보존한다.
 * - 정제된 텍스트(`finalContent`), 생각 흐름(`thinkingContent`), 제안(edit/insert) 목록을 최종 Assistant 메시지 개체 내의 필드(content, reasoningTrace 등)로 매핑 매핑한다.
 * - Zustand 락 해제(`setIsGenerating(false)`) 및 스트리밍 버퍼 텍스트 초기화를 연동 처리한다.
 * 
 * [책임이 아닌 것 - NON-RESPONSIBILITY]
 * - 에디터 블록 노드 실제 수정 지시 (상위 useAIResponseHandler에서 직접 DOM을 변경함).
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST NOT bypass state termination: 추론 실패 및 Abort 발생 시점에도 반드시 `setIsGenerating(false)`와 `setStreamingText('')`를 실행하여,
 *   화면 락을 풀고 대화 버퍼를 비워 렌더러가 무한 대기 상태(UI freeze)에 빠지지 않도록 보장할 것.
 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/App.tsx): 최상위 Facade 구조에 통합 마운트.
 * - 소비처 B (src/renderer/contexts/AppContext.tsx): 리액트 Context 훅 목록에 바인딩되어 하위 뷰에 전파.
 */

/* 
 * [IMPORT SEGMENTATION & CONTRACTS]
 * - useCallback: 메모이즈된 메시지 완료 패치 함수를 반환하기 위한 리액트 기본 API.
 */
import { useCallback } from 'react'

/* 
 * [TYPES & SCHEMAS]
 * - AIMessage: 대화 목록 노드 구조 인터페이스.
 * - InsertSuggestion: 에디터 단락 신규 삽입 제안 레코드 규격.
 * - ReasoningTraceEvent: 실시간으로 발라낸 생각 흐름 구조체 규격.
 */
import type { AIMessage, InsertSuggestion } from '../../../types/aiTypes'
import type { ReasoningTraceEvent } from '../../../../shared/reasoningTypes'

/* 
 * [ABORT DETECT SERVICE]
 * - checkAbortError: 에러 객체 또는 메세지 내에 'abort' 나 'cancel' 단어가 포함되었는지 진단하여 true/false를 내는 함수.
 */
import { isAbortError as checkAbortError } from '../../../services/ai/cleanAIResponse'

/**
 * @hook useFinalizeMessage
 * @description 추론이 종결된 AI 메시지의 본문 텍스트, 생각 과정, 제안 내역들을 최종 말풍선 상태 객체에 합산 저장하는 훅.
 */
export function useFinalizeMessage(
  /*
   * [HOOK CONSTRUCTOR INJECTIONS]
   * - setMessages: 메시지 갱신용 Zustand 액션.
   * - setStreamingText: 누적 출력 갱신용 Zustand 액션.
   * - setIsGenerating: 생성 중 플래그 갱신용 Zustand 액션.
   */
  setMessages: (updater: (prev: AIMessage[]) => AIMessage[]) => void,
  setStreamingText: (val: string) => void,
  setIsGenerating: (val: boolean) => void
) {
  return useCallback((params: {
    targetId: string | null
    sanitizeResult: { finalContent: string; thinkingContent?: string; hadInternalTags: boolean }
    rawForEdit: string
    success: boolean
    error?: string
    editSuggestion: { blockId: string; proposedText: string; cleanContent: string } | null
    insertSuggestions: InsertSuggestion[]
  }) => {
    /*
     * [PARAMETER DESCRIPTIONS]
     * - targetId: 최종 갱신 타깃인 어시스턴트 메시지 고유 ID.
     * - sanitizeResult: 생각 태그와 최종 글자가 분리된 정제 결과물.
     * - rawForEdit: 파싱용 un-sanitized 전문 버퍼 사본.
     * - success: 최종 API 응답 성공 여부.
     * - error: 실패 시 전달된 사유 텍스트.
     * - editSuggestion: 파싱된 단락 덮어쓰기 제안 구조.
     * - insertSuggestions: 파싱된 단락 신규 삽입 제안 목록.
     */
    const { targetId, sanitizeResult, rawForEdit: _rawForEdit, success, error, editSuggestion, insertSuggestions } = params

    // CONTRACT: 무조건 생성 락 상태를 내리고 렌더 버퍼를 완전히 비운다.
    setIsGenerating(false)
    setStreamingText('')

    // 메시지 목록 갱신 작업 실행
    setMessages((prev) => {
      // 대상 타깃이 어레이 내부에서 탐색 및 업데이트되었는지 검사하는 플래그
      let updated = false
      
      const next = prev.map((m) => {
        if (targetId && m.id === targetId) {
          updated = true
          
          // 사용자가 도중에 생성 중단을 실행했는지 여부
          const isAbort = checkAbortError(error)

          // 1. 에러 및 중단 여부에 따라 최종 표출될 텍스트 결정
          let cleanContent: string
          if (!success) {
            cleanContent = isAbort
              ? (sanitizeResult.finalContent.trim() || m.content || '사용자가 답변을 중단했습니다')
              : (error || '오류가 발생했습니다.')
          } else {
            cleanContent = sanitizeResult.finalContent
          }

          // 2. 최종 생각 궤적 구조 결정
          const finalTrace: ReasoningTraceEvent[] = sanitizeResult.thinkingContent
            ? [{
                id: `trace_final_${m.id}`,
                source: 'model' as const,
                type: 'thinking' as const,
                text: sanitizeResult.thinkingContent,
                model: 'streaming',
                timestamp: new Date().toISOString()
              }]
            : (m.reasoningTrace ?? [])

          // 3. 메시지 필드 데이터 병합 갱신
          return {
            ...m,
            isStreaming: false,
            error: !success && !isAbort,
            aborted: isAbort || m.aborted,
            content: cleanContent,
            finalAnswer: success ? sanitizeResult.finalContent : undefined,
            reasoningTrace: finalTrace,
            reasoningStatus: sanitizeResult.hadInternalTags ? 'ok' : m.reasoningStatus,
            proposedText: (success || (isAbort && cleanContent.trim()))
              ? (editSuggestion ? editSuggestion.proposedText : cleanContent)
              : undefined,
            originalText: (success || (isAbort && cleanContent.trim()))
              ? (editSuggestion ? m.originalText : m.originalText)
              : undefined,
            diffState: (editSuggestion && success) ? 'pending' : m.diffState,
            blockId: editSuggestion ? editSuggestion.blockId : m.blockId,
            insertSuggestion: success ? insertSuggestions[0] : undefined,
            insertSuggestions: success ? insertSuggestions : undefined
          }
        }
        return m
      })

      // [FALLBACK MATCHING]
      // targetId를 찾지 못했으나 챗 목록의 맨 마지막 노드가 assistant인 경우 폴백 보정 적용
      if (!updated && next.length > 0 && next[next.length - 1].role === 'assistant') {
        const lastIdx = next.length - 1
        const lastMsg = next[lastIdx]
        const isAbort = checkAbortError(error)

        let cleanContent: string
        if (!success) {
          cleanContent = isAbort
            ? (sanitizeResult.finalContent.trim() || lastMsg.content || '사용자가 답변을 중단했습니다')
            : (error || '오류가 발생했습니다.')
        } else {
          cleanContent = sanitizeResult.finalContent
        }

        next[lastIdx] = {
          ...lastMsg,
          isStreaming: false,
          error: !success && !isAbort,
          aborted: isAbort || lastMsg.aborted,
          content: cleanContent,
          finalAnswer: success ? sanitizeResult.finalContent : undefined,
          reasoningStatus: sanitizeResult.hadInternalTags ? 'ok' : lastMsg.reasoningStatus,
          proposedText: (success || (isAbort && cleanContent.trim())) ? cleanContent : undefined
        }
      }

      // 혹시라도 이외에 스트리밍 플래그(isStreaming: true)가 켜진 채 탈출된 메시지가 있다면 모두 일괄 해제
      return next.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m))
    })
  }, [setMessages, setStreamingText, setIsGenerating])
}

/**
 * ============================================================================
 * FUTURE DEVELOPMENT GUIDE (AI Agent Instruction Layer)
 * ============================================================================
 * 1. 챗 메시지 완료 시점에 로컬 파일 로그로 자동 디스크 백업하고 싶을 때:
 *    - 본 `useCallback` 콜백 하단에 백업용 IPC API(`ipc.writeLog`) 호출을 덧붙일 것.
 * ============================================================================
 */
