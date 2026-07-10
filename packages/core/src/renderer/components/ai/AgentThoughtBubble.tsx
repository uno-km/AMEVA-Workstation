/**
 * @file AgentThoughtBubble.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/ai/AgentThoughtBubble.tsx
 * @role ReAct 에이전트 사고 과정 3단계 실시간 시각화 컴포넌트
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - AIPluginViews.tsx 또는 AI 채팅 메시지 렌더러에서 마운트되어
 *   deepReasoning 모드 활성화 시 에이전트 사고 과정을 시각화한다.
 *
 * [책임 범위 - RESPONSIBILITY]
 * - useAIState.agentPhase를 구독하여 3가지 상태를 전환한다:
 *   1. Thinking: <thought> 혼잣말 텍스트를 아코디언으로 표시
 *   2. Working: 도구 실행 중 상태 (도구명 + 애니메이션)
 *   3. Done: 버블이 접히고 최종 답변 표시
 *
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 * - MUST: 에이전트 상태 전환은 Zustand 스토어만을 통해 수행할 것.
 */

import { useState, useEffect, useRef } from 'react'
import { useAIState } from '../../stores/useAIState'

/* ============================================================
 * AgentThoughtBubble Props
 * ============================================================ */

/**
 * AgentThoughtBubbleProps
 * 컴포넌트 외부에서 주입하는 props 규격.
 */
export interface AgentThoughtBubbleProps {
  /** 이 버블이 연결된 메시지 ID. 해당 메시지의 에이전트 상태만 표시한다. */
  messageId: string
  /** 딥 리즈닝 모드가 활성화되어 있는지 여부. false이면 렌더링하지 않는다. */
  isDeepReasoning: boolean
}

/* ============================================================
 * 컴포넌트 내부 상수 (Phase 3 지역 상수)
 * ============================================================ */

/**
 * BUBBLE_CONSTANTS
 * AgentThoughtBubble 컴포넌트 전용 로컬 상수.
 */
const BUBBLE_CONSTANTS = {
  /** 아코디언 열림/닫힘 전환 애니메이션 지속시간(ms) */
  ACCORDION_TRANSITION_MS: 300,
  /** 혼잣말 표시 최대 글자 수 (아코디언 접힘 시 요약) */
  THOUGHT_PREVIEW_CHARS: 80,
  /** Working 상태 스피너 점 개수 */
  SPINNER_DOTS: 3
} as const

/* ============================================================
 * AgentThoughtBubble 컴포넌트
 * ============================================================ */

/**
 * AgentThoughtBubble
 * 에이전트의 실시간 사고 과정을 시각화하는 버블 컴포넌트.
 * Thinking → Working → Done 3단계 UI 전환을 처리한다.
 */
export function AgentThoughtBubble({ messageId, isDeepReasoning }: AgentThoughtBubbleProps) {
  /*
   * [ZUSTAND SUBSCRIPTION]
   * - agentPhase: 현재 에이전트 단계 (idle/thinking/tool_calling/observing/answering/done/error).
   * - agentThoughts: 혼잣말 토큰 누적 배열.
   * - agentCurrentToolName: 현재 실행 중인 도구 명칭.
   */
  const agentPhase = useAIState((s) => s.agentPhase)
  const agentThoughts = useAIState((s) => s.agentThoughts)
  const agentCurrentToolName = useAIState((s) => s.agentCurrentToolName)

  /*
   * [LOCAL STATE]
   * - isAccordionOpen: 혼잣말 아코디언 열림 여부. 기본 false(접힘).
   * - animateDot: 스피너 점 애니메이션 인덱스 (0~SPINNER_DOTS-1 순환).
   */
  const [isAccordionOpen, setIsAccordionOpen] = useState(false)
  const [animateDot, setAnimateDot] = useState(0)

  /*
   * [REF]
   * - prevPhaseRef: 이전 단계를 기억하여 Done 전환 시 애니메이션을 트리거한다.
   */
  const prevPhaseRef = useRef<string>('')

  /*
   * [EFFECT - Spinner Animation]
   * - Working/Thinking 상태에서 점(.) 애니메이션을 주기적으로 갱신한다.
   * - Done/Idle 상태에서는 인터벌을 정리한다.
   */
  useEffect(() => {
    const isActive = agentPhase === 'thinking' || agentPhase === 'tool_calling' || agentPhase === 'observing'
    if (!isActive) return

    const interval = setInterval(() => {
      setAnimateDot((d) => (d + 1) % BUBBLE_CONSTANTS.SPINNER_DOTS)
    }, 500)

    return () => clearInterval(interval)
  }, [agentPhase])

  /*
   * [EFFECT - Accordion Auto-Open on Thinking]
   * - 새로운 thinking 단계 진입 시 아코디언을 자동으로 열어 혼잣말을 보여준다.
   */
  useEffect(() => {
    if (agentPhase === 'thinking' && prevPhaseRef.current !== 'thinking') {
      setIsAccordionOpen(true)
    }
    if (agentPhase === 'done' || agentPhase === 'answering') {
      setIsAccordionOpen(false)
    }
    prevPhaseRef.current = agentPhase
  }, [agentPhase])

  // deepReasoning 모드 비활성 또는 idle 상태에서는 렌더링하지 않음
  if (!isDeepReasoning || agentPhase === 'idle') return null

  /*
   * [COMPUTED VALUES]
   * - thoughtText: 혼잣말 배열을 하나의 문자열로 합산한다.
   * - phaseLabel: 현재 단계에 표시할 레이블 텍스트.
   * - spinnerDots: 애니메이션 점 문자열.
   */
  const thoughtText = agentThoughts.join('')
  const spinnerDots = '.'.repeat(animateDot + 1).padEnd(BUBBLE_CONSTANTS.SPINNER_DOTS, ' ')

  const phaseLabel: Record<string, string> = {
    thinking: `AI가 고민 중${spinnerDots}`,
    tool_calling: `도구 실행 중${spinnerDots}`,
    observing: `결과 분석 중${spinnerDots}`,
    answering: '답변 작성 중...',
    done: '완료',
    error: '오류 발생'
  }

  const currentLabel = phaseLabel[agentPhase] ?? '처리 중...'

  return (
    <div
      style={{
        margin: '8px 0',
        borderRadius: '12px',
        border: '1px solid rgba(99, 102, 241, 0.3)',
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.06) 0%, rgba(139, 92, 246, 0.06) 100%)',
        overflow: 'hidden',
        transition: `all ${BUBBLE_CONSTANTS.ACCORDION_TRANSITION_MS}ms ease`,
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '13px'
      }}
    >
      {/* ── 상단 헤더 (항상 표시) ── */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsAccordionOpen((o) => !o)}
        onKeyDown={(e) => e.key === 'Enter' && setIsAccordionOpen((o) => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 14px',
          cursor: 'pointer',
          userSelect: 'none'
        }}
      >
        {/* 단계별 아이콘 */}
        <span style={{ fontSize: '15px' }}>
          {agentPhase === 'thinking' && '🧠'}
          {agentPhase === 'tool_calling' && '⚙️'}
          {agentPhase === 'observing' && '🔍'}
          {agentPhase === 'answering' && '✍️'}
          {agentPhase === 'done' && '✅'}
          {agentPhase === 'error' && '❌'}
        </span>

        {/* 단계 레이블 */}
        <span style={{
          color: agentPhase === 'error' ? '#f87171' : 'rgba(139, 92, 246, 0.9)',
          fontWeight: 500,
          flex: 1,
          letterSpacing: '0.01em'
        }}>
          {currentLabel}
        </span>

        {/* 도구명 배지 (Working 상태에서만) */}
        {agentPhase === 'tool_calling' && agentCurrentToolName && (
          <span style={{
            fontSize: '11px',
            padding: '2px 8px',
            borderRadius: '9999px',
            background: 'rgba(99, 102, 241, 0.15)',
            color: 'rgba(139, 92, 246, 0.9)',
            fontFamily: 'monospace',
            border: '1px solid rgba(99, 102, 241, 0.2)'
          }}>
            {agentCurrentToolName}
          </span>
        )}

        {/* 스피너 (활성 상태) */}
        {(agentPhase === 'thinking' || agentPhase === 'tool_calling' || agentPhase === 'observing') && (
          <div style={{ display: 'flex', gap: '3px' }}>
            {Array.from({ length: BUBBLE_CONSTANTS.SPINNER_DOTS }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  background: i <= animateDot ? 'rgba(139, 92, 246, 0.8)' : 'rgba(139, 92, 246, 0.2)',
                  transition: 'background 0.2s ease'
                }}
              />
            ))}
          </div>
        )}

        {/* 아코디언 화살표 */}
        {thoughtText.trim() !== '' && (
          <span style={{
            color: 'rgba(139, 92, 246, 0.5)',
            fontSize: '11px',
            transition: `transform ${BUBBLE_CONSTANTS.ACCORDION_TRANSITION_MS}ms ease`,
            transform: isAccordionOpen ? 'rotate(180deg)' : 'rotate(0deg)'
          }}>
            ▾
          </span>
        )}
      </div>

      {/* ── 아코디언 본문 (혼잣말 텍스트) ── */}
      {isAccordionOpen && thoughtText.trim() !== '' && (
        <div style={{
          padding: '0 14px 12px 14px',
          borderTop: '1px solid rgba(99, 102, 241, 0.1)'
        }}>
          <pre style={{
            margin: 0,
            padding: '10px 12px',
            borderRadius: '8px',
            background: 'rgba(0, 0, 0, 0.15)',
            color: 'rgba(200, 200, 220, 0.75)',
            fontSize: '12px',
            lineHeight: '1.6',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: 'JetBrains Mono, Fira Code, monospace',
            maxHeight: '200px',
            overflowY: 'auto'
          }}>
            {thoughtText}
          </pre>
        </div>
      )}

      {/* ── Working: 도구 실행 상세 정보 ── */}
      {agentPhase === 'tool_calling' && agentCurrentToolName && !isAccordionOpen && (
        <div style={{
          padding: '0 14px 10px 37px',
          color: 'rgba(200, 200, 220, 0.6)',
          fontSize: '12px'
        }}>
          <code style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            {agentCurrentToolName}()
          </code>{' '}
          명령어를 실행하고 있습니다...
        </div>
      )}
    </div>
  )
}
