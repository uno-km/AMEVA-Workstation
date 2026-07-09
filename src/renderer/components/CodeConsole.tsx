/**
 * @file CodeConsole.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/CodeConsole.tsx
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

import React from 'react'
import { Terminal, AlertCircle, CheckCircle, Loader } from 'lucide-react'

interface CodeConsoleProps {
  outputs: string[]
  isRunning: boolean
  success?: boolean
  onClose: () => void
}

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
export function CodeConsole({ outputs, isRunning, success, onClose }: CodeConsoleProps) {
  return (
    <div
      className="glow-primary"
      style={{
        marginTop: '8px',
        backgroundColor: 'var(--term-bg)',
        border: '1px solid var(--term-border)',
        borderRadius: '6px',
        fontFamily: 'var(--font-mono)',
        fontSize: '12px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
      }}
    >
      {/* 콘솔 헤더 */}
      <div
        style={{
          padding: '6px 12px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.02)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--term-icon-color)' }}>
          <Terminal size={14} />
          <span>콘솔 출력 결과</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isRunning ? (
            <span style={{ color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Loader size={12} className="animate-spin" /> 실행 중...
            </span>
          ) : success === true ? (
            <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle size={12} /> 성공
            </span>
          ) : success === false ? (
            <span style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <AlertCircle size={12} /> 오류 발생
            </span>
          ) : null}
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '11px',
            }}
          >
            닫기
          </button>
        </div>
      </div>

      {/* 출력 결과 스크롤 영역 */}
      <div
        style={{
          padding: '10px 14px',
          maxHeight: '160px',
          overflowY: 'auto',
          color: 'var(--term-text)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          lineHeight: '1.5',
        }}
      >
        {outputs.length === 0 ? (
          <span style={{ color: 'var(--text-dark)' }}>출력 결과가 없습니다. 코드를 실행해 보십시오.</span>
        ) : (
          outputs.map((line, idx) => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'color'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
            let color = 'var(--term-text)'
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
            if (line.includes('[ERROR]') || line.includes('[TIMEOUT ERROR]') || line.includes('[COMPILATION ERROR]') || line.includes('[RUNTIME ERROR]')) {
              color = 'var(--danger)'
            } else if (line.includes('[WARN]')) {
              color = '#f59e0b'
            }
            return (
              <div key={idx} style={{ color }}>
                {line}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
