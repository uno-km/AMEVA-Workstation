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
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `containerRef`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const containerRef = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const containerRef = useRef<HTMLDivElement>(null)

  // Zustand 스토어의 sensorLogs 구독: React 렌더링 루프 우회하여 DOM 직접 업데이트
  useEffect(() => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `unsubscribe`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const unsubscribe = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const unsubscribe = useAILogStore.subscribe((state, prevState) => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `state.sensorLogs === prevState.sensorLogs`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (state.sensorLogs === prevState.sensorLogs)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (state.sensorLogs === prevState.sensorLogs) return

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `container`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const container = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const container = containerRef.current
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!container`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!container)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (!container) return

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `htmlString`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const htmlString = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      let htmlString = ''
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `logs`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const logs = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const logs = state.sensorLogs
      /*
       * [LOOP CONTROL ITERATION]
       * - 루프 조건: `for (let i = 0; i < logs.length; i++) {`
       * - 예상 시나리오: 지정된 조건 한계 도달 시점까지 콜렉션 항목의 순차 매핑, 변환 및 동기 적재 처리를 수행함.
       * - 예시: `for (const item of list)` 루프 실행 시 모든 개별 블록의 html 포맷 정제 완료 후 스택 종결.
       */
      for (let i = 0; i < logs.length; i++) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `line`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const line = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const line = logs[i]
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `i > 0 && !line.trim()`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (i > 0 && !line.trim())` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (i > 0 && !line.trim()) continue

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `color`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const color = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        let color = '#a7f3d0'
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `line.includes('[System]')`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (line.includes('[System]'))` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (line.includes('[System]')) color = '#93c5fd'
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `line.includes('[Error]') || line.includes('오류')`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (line.includes('[Error]') || line.includes('오류'))` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (line.includes('[Error]') || line.includes('오류')) color = '#fca5a5'
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `line.includes('[Plugin]')`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (line.includes('[Plugin]'))` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
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

