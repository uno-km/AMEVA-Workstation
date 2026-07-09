/**
 * @file useAIBlockProcessor.ts
 * @system AMEVA OS Desktop Workstation - Client Renderer
 * @location src/renderer/hooks/ai/useAIBlockProcessor.ts
 * @role Editor selected block quick prompt analyzer Hook
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 요약(summarize), 번역(translate), 교정(improve), 확장(expand), 설명(explain)의 5개 퀵 프롬프트 명령어를 처리(`processBlock`)한다.
 * - 메인 스레드에 IPC 추론 요청을 단발적으로 발행하고, Promise 비동기 래퍼를 통해 결과 본문 텍스트만 동기화 반환한다.
 * - IPC 토큰 수신 및 완료 리스너 구독을 제어하며, 비정상 세션 홀딩 방지를 위해 **60초 글로벌 안전 타임아웃**을 구현한다.
 * 
 * [책임이 아닌 것 - NON-RESPONSIBILITY]
 * - AI 패널 대화창 말풍선 기록에 메시지 추가 (이 훅은 순수 단발 텍스트 반환만 담당함).
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST NOT bypass listener cleanup: 추론 성공, 실패, 혹은 60초 타임아웃 종료 시점 모두에서
 *   반드시 리스너 해제 콜백(`unsubToken()`, `unsubDone()`)을 호출하여 렌더러 IPC 리스너 누수를 방지할 것.
 * - MUST: 리스너가 먼저 메인 스레드 HMR/RPC 이벤트를 잡을 수 있도록,
 *   `ipc.llmGenerate` 호출 패킷을 쏘기 전에 리스너 구독 등록을 선행 수행할 것. (Race Condition 방지 계약).
 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/App.tsx): 최상위 Facade 구조에 통합 마운트.
 * - 소비처 B (src/renderer/contexts/AppContext.tsx): 리액트 Context 훅 목록에 바인딩되어 하위 뷰에 전파.
 */

/* 
 * [IMPORT SEGMENTATION & CONTRACTS]
 * - useCallback: 컴포넌트 재생성 시 퀵 액션 가동 참조 무결성을 지키기 위한 메모이즈 훅.
 */
import { useCallback } from 'react'

/* 
 * [ELECTRON IPC CONNECTOR]
 * - ipc: 네이티브 쉘 LLM 연산 가동 및 단발 토큰 수신 이벤트 채널 바인더.
 */
import * as ipc from '../../services/ipc/electronApiAdapter'

/* 
 * [TYPES]
 * - AISettings: AI 설정 정보 규격 인터페이스.
 */
import type { AISettings } from '../../types/aiTypes'

/**
 * @hook useAIBlockProcessor
 * @description 에디터 단락 블록에 대해 빠른 인라인 자연어 변환을 전담 수행하는 훅.
 */
export function useAIBlockProcessor(settings: AISettings) {
  /**
   * [CONTRACT - Quick Action Prompt Processor]
   * - Rationale: 선택 단락을 지정된 템플릿과 매핑하여, IPC 단발 세션을 통해 텍스트로 치환 반환한다.
   */
  const processBlock = useCallback(async (
    action: 'summarize' | 'translate' | 'improve' | 'expand' | 'explain',
    content: string,
    targetLang?: string
  ): Promise<string> => {
    // 데스크톱 앱 런타임 외에는 빈값 반환
    if (!ipc.isElectronEnv()) return ''

    // 퀵 액션 프롬프트 템플릿 매핑 레코드 정의
    const prompts: Record<string, string> = {
      summarize: `다음 텍스트를 3줄 이내로 핵심만 요약하세요:\n\n${content}`,
      translate: `다음 텍스트를 ${targetLang || '영어'}로 번역하세요. 번역문만 출력하세요:\n\n${content}`,
      improve: `다음 텍스트의 문체와 표현을 개선하세요. 개선된 텍스트만 출력하세요:\n\n${content}`,
      expand: `다음 텍스트를 더 자세하고 풍부하게 확장하세요:\n\n${content}`,
      explain: `다음 내용을 쉽게 설명하세요:\n\n${content}`
    }

    // 단발성 IPC 토큰 처리를 위한 Promise 비동기 래퍼 가동
    return new Promise<string>((resolve) => {
      /*
       * [CONTRACT - Local Variables Initialization]
       * - result: 누적 수신된 텍스트 버퍼 변수.
       * - settled: 프로미스 종결 및 중복 리졸브 차단 락 플래그.
       * - sessId: 챗 세션과 격리하기 위한 단발성 세션 고유 키.
       */
      let result = ''
      let settled = false
      const sessId = `quick-${Date.now()}`

      // IPC 리스너 안전 해제를 위한 클린업 이너 헬퍼 함수
      const cleanup = (unsubToken: () => void, unsubDone: () => void) => {
        if (!settled) {
          settled = true
          unsubToken()
          unsubDone()
        }
      }

      // CONTRACT: llmGenerate 기동 전, 리스너를 먼저 선행 구독한다.
      const unsubToken = ipc.onLLMToken(sessId, (token) => {
        if (!settled) result += token
      })
      const unsubDone = ipc.onLLMDone(sessId, (data) => {
        if (settled) return
        cleanup(unsubToken, unsubDone)
        resolve(data.success ? result.trim() : (data.error || ''))
      })

      // 3. 60초 글로벌 비정상 프리징 복구 타임아웃 세팅
      const timeoutId = setTimeout(() => {
        if (!settled) {
          cleanup(unsubToken, unsubDone)
          resolve(result.trim() || '')
        }
      }, 60_000)

      // IPC 단발 추론 시작 패킷 발송
      ipc.llmGenerate({
        sessionId: sessId,
        modelPath: settings.modelPath,
        prompt: prompts[action] || content,
        systemPrompt: 'You are a document editing assistant. Output only the requested content without any explanation or preamble.',
        maxTokens: 512,
        temperature: 0.5,
        apiType: settings.apiType === 'wasm' ? 'local' : settings.apiType,
        apiKey: settings.apiKey,
        apiEndpoint: settings.apiEndpoint,
        apiModel: settings.apiModel,
        gpuOnly: settings.gpuOnly
      }).catch(() => {
        // 전송 자체 에러 시 타이머 해제 및 리스너 제거
        clearTimeout(timeoutId)
        cleanup(unsubToken, unsubDone)
        resolve('')
      })
    })
  }, [settings.modelPath, settings.apiType, settings.apiKey, settings.apiEndpoint, settings.apiModel, settings.gpuOnly])

  return { processBlock }
}

/**
 * ============================================================================
 * FUTURE DEVELOPMENT GUIDE (AI Agent Instruction Layer)
 * ============================================================================
 * 1. 신규 퀵 액션 모드(예: 'grammar' 문법 검사 등)가 추가될 때:
 *    - `prompts` 매핑 레코드와 `action` 인자 유니온 타입에 지시 텍스트를 추가할 것.
 * ============================================================================
 */
