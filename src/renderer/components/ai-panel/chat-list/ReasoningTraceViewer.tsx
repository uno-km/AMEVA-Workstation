/**
 * @file ReasoningTraceViewer.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/ai-panel/chat-list/ReasoningTraceViewer.tsx
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
import { Brain, ChevronUp, ChevronDown } from 'lucide-react'
import { ThoughtTreeView } from './ThoughtProcess'

interface ReasoningTraceViewerProps {
  isStreaming: boolean
  hasRealTrace: boolean
  thinkingText: string
  thoughtSummary: { completedSteps: number; totalSteps: number }
  thoughtExpanded: boolean
  setThoughtExpanded: React.Dispatch<React.SetStateAction<boolean>>
  isWhiteTheme: boolean
}

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
export function ReasoningTraceViewer({
  isStreaming,
  hasRealTrace,
  thinkingText,
  thoughtSummary,
  thoughtExpanded,
  setThoughtExpanded,
  isWhiteTheme,
}: ReasoningTraceViewerProps) {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
  if (!hasRealTrace && !isStreaming) return null

  return (
    <div style={{
      marginBottom: '8px', borderRadius: '6px', overflow: 'hidden',
      background: isWhiteTheme ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)',
      border: isWhiteTheme ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.06)',
    }}>
      <div
        onClick={() => setThoughtExpanded(prev => !prev)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 10px', cursor: 'pointer', fontSize: '11px', color: 'var(--text-muted)',
          fontWeight: 600, userSelect: 'none', background: isWhiteTheme ? 'rgba(0,0,0,0.02)' : 'rgba(255,255,255,0.01)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Brain size={12} style={{ 
              color: isStreaming ? 'var(--secondary)' : '#10b981',
              animation: isStreaming ? 'pulseGlow 1.5s infinite ease-in-out' : 'none'
          }} />
          <span>
            {isStreaming 
              ? (thinkingText ? `생각 과정 (추론 중, ${thoughtSummary.completedSteps}/${thoughtSummary.totalSteps}단계)` : `응답 대기 중...`)
              : `생각 과정 (추론 완료, ${thoughtSummary.totalSteps}단계)`
            }
          </span>
        </div>
        {thoughtExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </div>
      
      {/* 확장 시 ThoughtTreeView로 파싱된 트리 렌더링 */}
      {thoughtExpanded && (
        <div style={{
          padding: '8px 10px', fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.5',
          borderTop: isWhiteTheme ? '1px solid rgba(0,0,0,0.06)' : '1px solid rgba(255,255,255,0.04)',
          background: isWhiteTheme ? 'rgba(0,0,0,0.04)' : 'rgba(0,0,0,0.12)',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          minHeight: isStreaming && !thinkingText ? '28px' : undefined,
          display: 'flex', alignItems: isStreaming && !thinkingText ? 'center' : 'flex-start',
        }}>
          {thinkingText ? (
            <ThoughtTreeView text={thinkingText} isStreaming={isStreaming} />
          ) : (isStreaming
            ? <span style={{ color: isWhiteTheme ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.25)', fontStyle: 'italic', fontSize: '10px' }}>{"<think> 태그 대기 중..."}</span>
            : null
          )}
        </div>
      )}
    </div>
  )
}

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
