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
import { useAIState } from '../../../stores/useAIState'
import { ExecutionTraceTimeline } from '../../ai/ExecutionTraceTimeline'

interface ReasoningTraceViewerProps {
  isStreaming: boolean
  hasRealTrace: boolean
  thinkingText: string
  thoughtSummary: { completedSteps: number; totalSteps: number }
  thoughtExpanded: boolean
  setThoughtExpanded: React.Dispatch<React.SetStateAction<boolean>>
  isWhiteTheme: boolean
}

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `ReasoningTraceViewer`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `ReasoningTraceViewer(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
export function ReasoningTraceViewer({
  isStreaming,
  hasRealTrace,
  thinkingText,
  thoughtSummary,
  thoughtExpanded,
  setThoughtExpanded,
  isWhiteTheme,
}: ReasoningTraceViewerProps) {
  const recoveryState = useAIState((s) => s.recoveryState)
  const recoveryReason = useAIState((s) => s.recoveryReason)
  const recoveryElapsed = useAIState((s) => s.recoveryElapsed)
  const inferencePhase = useAIState((s) => s.inferencePhase)
  const resumeFromCheckpoint = useAIState((s) => s.resumeFromCheckpoint)

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!hasRealTrace && !isStreaming`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!hasRealTrace && !isStreaming)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
  if (!hasRealTrace && !isStreaming) return null

  return (
    <div style={{
      marginBottom: '8px', 
      borderRadius: '10px', 
      overflow: 'hidden',
      background: isWhiteTheme 
        ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.03) 0%, rgba(99, 102, 241, 0.01) 100%)' 
        : 'linear-gradient(135deg, rgba(139, 92, 246, 0.05) 0%, rgba(99, 102, 241, 0.02) 100%)',
      border: isWhiteTheme 
        ? '1px solid rgba(139, 92, 246, 0.15)' 
        : '1px solid rgba(139, 92, 246, 0.22)',
      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      {/* ── 아코디언 헤더 (클릭 시 토글) ── */}
      <div
        onClick={() => setThoughtExpanded(prev => !prev)}
        style={{
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          padding: '8px 12px', 
          cursor: 'pointer', 
          fontSize: '11px', 
          color: isWhiteTheme ? 'rgba(75, 85, 99, 0.85)' : 'rgba(200, 200, 220, 0.8)',
          fontWeight: 600, 
          userSelect: 'none', 
          background: isWhiteTheme ? 'rgba(139, 92, 246, 0.01)' : 'rgba(139, 92, 246, 0.02)',
          transition: 'background 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = isWhiteTheme ? 'rgba(139, 92, 246, 0.04)' : 'rgba(139, 92, 246, 0.08)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = isWhiteTheme ? 'rgba(139, 92, 246, 0.01)' : 'rgba(139, 92, 246, 0.02)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Brain 
            size={12} 
            style={{ 
              color: isStreaming ? '#a78bfa' : '#10b981',
              animation: isStreaming ? 'pulseGlow 1.5s infinite ease-in-out' : 'none',
              filter: isStreaming ? 'drop-shadow(0 0 4px rgba(167, 139, 250, 0.5))' : 'none'
            }} 
          />
          <span style={{ letterSpacing: '0.2px' }}>
            {isStreaming 
              ? (thinkingText ? `생각 과정 (추론 진행 중 · ${thoughtSummary.completedSteps}/${thoughtSummary.totalSteps}단계)` : `생각 구성 중...`)
              : `생각 과정 (추론 완료 · 총 ${thoughtSummary.totalSteps}단계)`
            }
          </span>
        </div>
        
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '18px',
          height: '18px',
          borderRadius: '50%',
          background: isWhiteTheme ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.05)',
          transition: 'transform 0.25s ease'
        }}>
          {thoughtExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
        </div>
      </div>
      
      {/* ── 아코디언 컨텐츠: 확장 시 ThoughtTreeView로 파싱된 트리 렌더링 ── */}
      {thoughtExpanded && (
        <div style={{
          padding: '10px 12px', 
          fontSize: '11px', 
          color: isWhiteTheme ? '#374151' : 'rgba(220, 220, 240, 0.85)', 
          lineHeight: '1.55',
          borderTop: isWhiteTheme ? '1px solid rgba(139, 92, 246, 0.08)' : '1px solid rgba(139, 92, 246, 0.12)',
          background: isWhiteTheme ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.18)',
          whiteSpace: 'pre-wrap', 
          wordBreak: 'break-word',
          minHeight: isStreaming && !thinkingText ? '32px' : undefined,
          display: 'flex', 
          alignItems: isStreaming && !thinkingText ? 'center' : 'flex-start',
          transition: 'all 0.2s ease'
        }}>
          {thinkingText ? (
            <ThoughtTreeView text={thinkingText} isStreaming={isStreaming} />
          ) : (isStreaming
            ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="spinner-mini" style={{
                  width: '8px',
                  height: '8px',
                  border: '1.5px solid rgba(167, 139, 250, 0.35)',
                  borderTop: '1.5px solid #a78bfa',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                <span style={{ color: isWhiteTheme ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.3)', fontStyle: 'italic', fontSize: '10px' }}>
                  생각 흐름을 가다듬고 있습니다...
                </span>
              </div>
            ) : null
          )}
        </div>
      )}

      {/* ── 복구 및 정체 경고 카드 (스트리밍 중에만 노출) ── */}
      {isStreaming && recoveryState !== 'normal' && (
        <div style={{
          margin: '6px 10px',
          padding: '10px 12px',
          borderRadius: '8px',
          fontSize: '11px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          background: recoveryState === 'recovery_failed'
            ? 'rgba(239, 68, 68, 0.08)'
            : 'rgba(245, 158, 11, 0.08)',
          border: recoveryState === 'recovery_failed'
            ? '1px solid rgba(239, 68, 68, 0.2)'
            : '1px solid rgba(245, 158, 11, 0.2)',
          color: recoveryState === 'recovery_failed' ? '#f87171' : '#fbbf24',
          transition: 'all 0.3s ease',
          fontFamily: 'Inter, system-ui, sans-serif'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
            <span>{recoveryState === 'recovery_failed' ? '❌' : '⚠️'}</span>
            <span>
              {recoveryState === 'suspicious' && `생각 중... ${recoveryElapsed}초 경과 (추론 진행률 분석 중 - 현재 단계: ${inferencePhase})`}
              {recoveryState === 'stalled' && `정체 감지 (경과: ${recoveryElapsed}초, 단계: ${inferencePhase})`}
              {recoveryState === 'recovering' && `정체 감지: 복구 시도 중 (단계: ${inferencePhase}, 원인: ${recoveryReason})`}
              {recoveryState === 'recovery_failed' && '자동 복구가 실패하였습니다.'}
            </span>
          </div>
          
          {recoveryState === 'recovery_failed' && resumeFromCheckpoint && (
            <button
              onClick={() => void resumeFromCheckpoint()}
              style={{
                alignSelf: 'flex-start',
                marginTop: '4px',
                padding: '4px 10px',
                borderRadius: '6px',
                border: 'none',
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '10px',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(239, 68, 68, 0.2)',
                transition: 'transform 0.1s ease, filter 0.2s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.15)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}
              onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.96)'; }}
              onMouseUp={(e) => { e.currentTarget.style.transform = 'none'; }}
            >
              마지막 지점부터 이어서 진행
            </button>
          )}
        </div>
      )}
      
      {/* ── Phase 4 Execution Trace (Mission Trace가 있다면 렌더링) ── */}
      {thoughtExpanded && <ExecutionTraceTimeline />}
    </div>
  )
}

