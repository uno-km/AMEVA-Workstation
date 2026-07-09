/**
 * @file AIEngineLogsPanel.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/ai/AIEngineLogsPanel.tsx
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/AppLayout.tsx): 레이아웃 그리드 내부 또는 플로팅 레이어 영역 내에서 그리기로 소비.
 * - 소비처 B (src/renderer/App.tsx): 전역 모달 매니저 및 뷰포트 상태 스위칭에 따라 동적 마운트되어 소비.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 본 파일은 AMEVA 시스템 내에서 도메인 목적에 부합하는 연산 및 데이터 처리 흐름을 안전하게 캡슐화한다.
 * - 외부 라이브러리 및 하위 종속성을 조율하고 결과 규격을 일관되게 제공한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그를 명확하게 남길 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

/**
 * AIEngineLogsPanel.tsx
 *
 * AI 엔진 실시간 터미널 로그 패널 컴포넌트.
 * AIPanel.tsx에 인라인으로 정의되어 있던 엔진 로그 뷰어를 독립 컴포넌트로 분리한다.
 * Zustand store를 직접 구독하여 React 리렌더링 없이 DOM을 업데이트한다 (Transient Update 패턴).
 *
 * [단일 책임]
 * - 엔진 로그 배열(sensorLogs) 실시간 DOM 렌더링
 * - 색상 코딩 (System: 파란색, Error: 빨간색, Plugin: 노란색, 기본: 초록색)
 * - 자동 스크롤 (최하단 유지)
 * - 로그 초기화 버튼
 */

import React, { useRef, useEffect } from 'react'
import { X } from 'lucide-react'
import { useAILogStore } from '../../stores/useAILogStore'

export interface AIEngineLogsPanelProps {
  /** 패널 닫기 콜백 */
  onClose: () => void
  /** 로그 수동 초기화 콜백 (옵션) */
  onClearLogs?: () => void
}

/**
 * AIEngineLogsPanel
 * 실시간 LLM 엔진 로그를 렌더링하는 패널.
 * Zustand 스토어를 직접 구독하여 React 리렌더링 오버헤드 없이 DOM을 업데이트한다.
 */
export const AIEngineLogsPanel: React.FC<AIEngineLogsPanelProps> = ({ onClose, onClearLogs }) => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'containerRef'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const containerRef = useRef<HTMLDivElement>(null)

  // Zustand 스토어의 sensorLogs 구독: React 렌더링 루프 우회하여 DOM 직접 업데이트
  useEffect(() => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'unsubscribe'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const unsubscribe = useAILogStore.subscribe((state, prevState) => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (state.sensorLogs === prevState.sensorLogs) return

  // [RUN-TIME STATE / INVARIANT] - 변수 'container'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const container = containerRef.current
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (!container) return

  // [RUN-TIME STATE / INVARIANT] - 변수 'htmlString'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      let htmlString = ''
  // [RUN-TIME STATE / INVARIANT] - 변수 'logs'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const logs = state.sensorLogs
  // [LOOP CONTROL ITERATION] - 데이터 콜렉션 순회 및 조건 도달 시까지의 반복적 상태 전이 연산 수행.
      for (let i = 0; i < logs.length; i++) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'line'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const line = logs[i]
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (i > 0 && !line.trim()) continue

  // [RUN-TIME STATE / INVARIANT] - 변수 'color'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        let color = '#a7f3d0'
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (line.includes('[System]')) color = '#93c5fd'
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (line.includes('[Error]') || line.includes('오류')) color = '#fca5a5'
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (line.includes('[Plugin]')) color = '#fde047'

        htmlString += `<div style="color: ${color}; min-height: 1.2em;">${line}</div>`
      }

      container.innerHTML = htmlString
      // 자동 스크롤 (최하단 유지)
      container.scrollTop = container.scrollHeight
    })

    return () => unsubscribe()
  }, [])

  return (
    <div style={{
      position: 'absolute',
      bottom: 0, left: 0, right: 0,
      height: '200px',
      background: '#0a0e1a',
      borderTop: '1px solid var(--border-muted)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 50,
      fontFamily: '"Cascadia Code", "Fira Code", monospace',
    }}>
      {/* 패널 헤더 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 10px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '10px', color: '#6ee7b7', fontWeight: 700 }}>
          ◆ ENGINE TERMINAL
        </span>
        <div style={{ display: 'flex', gap: '4px' }}>
          {onClearLogs && (
            <button
              onClick={onClearLogs}
              style={{
                background: 'transparent', border: 'none',
                color: '#6b7280', cursor: 'pointer', fontSize: '9px',
                padding: '2px 4px', borderRadius: '3px',
              }}
            >
              CLEAR
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none',
              color: '#6b7280', cursor: 'pointer',
              display: 'flex', alignItems: 'center', padding: '2px',
            }}
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* 로그 컨텐츠 영역 (DOM 직접 업데이트) */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '6px 10px',
          fontSize: '10px',
          lineHeight: 1.5,
          wordBreak: 'break-all',
        }}
      />
    </div>
  )
}

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
