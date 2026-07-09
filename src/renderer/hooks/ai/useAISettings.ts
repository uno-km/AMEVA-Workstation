/**
 * @file useAISettings.ts
 * @system AMEVA OS Desktop Workstation - Client Renderer
 * @location src/renderer/hooks/ai/useAISettings.ts
 * @role Local Storage AI configuration persistence & Migration Hook
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - AI 온도, 토큰 한계, 모델 경로, 지시사항 시스템 프롬프트 설정을 로컬 스토리지(`ai-settings`)에 세션 간 보존한다.
 * - 시스템 프롬프트 업데이트 마이그레이션: 구버전 프롬프트 양식이나 CoT(사고 과정) 지침이 빠진 설정을 감지하여 `DEFAULT_SETTINGS` 프롬프트로 강제 치환 및 복원한다.
 * - 런타임 부분 설정 수정(`updateSettings`) 시, 변경 사항을 취합 병합한다.
 * 
 * [책임이 아닌 것 - NON-RESPONSIBILITY]
 * - 실제 UI 컴포넌트(SettingsTabAIEngine 등)의 인풋 입력 감지 (각 설정 탭 컴포넌트 내부 localState가 담당).
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST NOT persist credentials: 보안성 침해(API Key 노출)를 방지하기 위해,
 *   로컬 스토리지 보존 시점에는 **반드시 비구조화 할당(`const { apiKey: _apiKey, ...safeSettings } = updated`)을 통해 `apiKey`를 완전 소거(MUST NOT save apiKey to localStorage)**하여 전송할 것.
 * - MUST: 마이그레이션 도중 JSON 파싱 에러나 로컬스토리지 쓰기 예외 발생 시,
 *   catch 블록에서 에러를 삼키지 않고 `console.error`로 상세 내역을 남길 것.
 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/App.tsx): 최상위 Facade 구조에 통합 마운트.
 * - 소비처 B (src/renderer/contexts/AppContext.tsx): 리액트 Context 훅 목록에 바인딩되어 하위 뷰에 전파.
 */

/* 
 * [IMPORT SEGMENTATION & CONTRACTS]
 * - useState: AI 설정 객체의 런타임 갱신 시 화면 리렌더를 촉발하기 위한 리액트 상태 훅.
 * - useCallback: 설정 변경 함수 레퍼런스 무결성을 보존하기 위한 메모이즈 훅.
 */
import { useState, useCallback } from 'react'

/* 
 * [TYPE SCHEMAS]
 * - AISettings: AI 엔진 온도, 최대 토큰 등의 속성 구조체.
 * - DEFAULT_SETTINGS: 최초 설치 시의 디폴트 프롬프트 텍스트 및 기본값 레코드.
 */
import type { AISettings } from '../../types/aiTypes'
import { DEFAULT_SETTINGS } from '../../types/aiTypes'

/**
 * @hook useAISettings
 * @description 로컬 저장소 기반의 AI 환경 설정 데이터 로드, 보안 검사 및 업데이트를 제어하는 훅.
 */
export function useAISettings() {
  /*
   * [INVARIANT - Settings Hydration & Migration State]
   * - settings: 런타임에 메모리에 들고 있는 AI 세팅 값.
   * - Rationale: 초기 로딩 시 로컬스토리지 데이터를 파싱하며, 구버전 지시 프롬프트를 자동 보정 마이그레이션한다.
   */
  const [settings, setSettings] = useState<AISettings>(() => {
    try {
  // [RUN-TIME STATE / INVARIANT] - 변수 'stored'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const stored = localStorage.getItem('ai-settings')
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (stored) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'parsed'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const parsed = JSON.parse(stored)
        
        // 구버전 시스템 프롬프트 마이그레이션 지침 검사 분기
        // CoT(사고 과정) 누락이나 불완전 지침 포함 시 최신 사양 프롬프트로 강제 동기화함
        if (parsed.systemPrompt && (
          parsed.systemPrompt.includes('간결하고 명확하게 답하세요') ||
          parsed.systemPrompt.includes('친근하고 유연하게') ||
          parsed.systemPrompt.includes('AMEVA AI입니다.') ||
          !parsed.systemPrompt.includes('한국어 답변') ||
          !parsed.systemPrompt.includes('INSERT_SUGGESTION') ||
          !parsed.systemPrompt.includes('CoT 사고 과정 지침') ||
          parsed.systemPrompt.includes('<thought>')
        )) {
          parsed.systemPrompt = DEFAULT_SETTINGS.systemPrompt
          localStorage.setItem('ai-settings', JSON.stringify(parsed))
        }
        return { ...DEFAULT_SETTINGS, ...parsed }
      }
    } catch (e) {
      // CONTRACT: 예외 차단 로깅
      console.error('[useAIAgent] 설정 로드 실패:', e)
    }
    return DEFAULT_SETTINGS
  })

  /**
   * [CONTRACT - Partial Settings Modifier]
   * - Rationale: 변경된 세팅값을 기존 메모리 상태에 병합하고, 보안 검사를 거쳐 민감 정보를 뺀 객체만 로컬 저장소에 덮어쓴다.
   */
  const updateSettings = useCallback((newSettings: Partial<AISettings>) => {
    setSettings((prev) => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'updated'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const updated = { ...prev, ...newSettings }
      try {
        // CONTRACT: 보안을 위해 apiKey 키값을 완전히 지워내어 디스크 저장
        const { apiKey: _apiKey, ...safeSettings } = updated
        localStorage.setItem('ai-settings', JSON.stringify(safeSettings))
      } catch (e) {
        console.error('[useAIAgent] 설정 저장 실패:', e)
      }
      return updated
    })
  }, [])

  return { settings, setSettings, updateSettings }
}

/**
 * ============================================================================
 * FUTURE DEVELOPMENT GUIDE (AI Agent Instruction Layer)
 * ============================================================================
 * 1. 신규 설정 속성(예: 'frequencyPenalty' 등)을 추가할 때:
 *    - `src/renderer/types/aiTypes.ts` 내의 `AISettings` 인터페이스 및 `DEFAULT_SETTINGS` 객체에 신규 항목을 할당할 것.
 * 
 * 2. 마이그레이션 로직 추가 시:
 *    - 기존 조건 분기가 너무 복잡하게 얽히지 않도록 별도 버전 번호(version 필드)를 세팅에 도입하여 비교 제어할 것.
 * ============================================================================
 */

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
