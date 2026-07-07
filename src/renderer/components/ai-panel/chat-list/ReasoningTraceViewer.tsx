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

export function ReasoningTraceViewer({
  isStreaming,
  hasRealTrace,
  thinkingText,
  thoughtSummary,
  thoughtExpanded,
  setThoughtExpanded,
  isWhiteTheme,
}: ReasoningTraceViewerProps) {
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
