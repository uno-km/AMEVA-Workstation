/**
 * @file AgentTaskChecklist.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/ai/AgentTaskChecklist.tsx
 * @role 에이전트 Task Plan 체크리스트 실시간 시각화 컴포넌트
 *
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - AI 채팅 패널 상단 또는 메시지 버블 헤더 영역에 마운트되어
 *   에이전트가 수립한 Task Plan의 진행 상황을 체크박스 애니메이션으로 표시한다.
 *
 * [책임 범위 - RESPONSIBILITY]
 * - useAIState.agentTaskPlan을 구독하여 TaskStep 배열을 체크리스트로 렌더링한다.
 * - 각 단계의 status(pending/in_progress/done/failed)에 따라
 *   체크박스 아이콘과 색상을 동적으로 전환한다.
 * - 현재 진행 중인 단계를 하이라이트하고 완료된 단계를 시각적으로 구분한다.
 *
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 * - MUST: agentTaskPlan이 null이면 렌더링하지 않을 것.
 */

import { useAIState } from '../../stores/useAIState'
import type { TaskStepStatus } from '../../services/ai/orchestrator/types'

/* ============================================================
 * 컴포넌트 내부 상수 (Phase 3 지역 상수)
 * ============================================================ */

/**
 * CHECKLIST_CONSTANTS
 * AgentTaskChecklist 컴포넌트 전용 로컬 상수.
 */
const CHECKLIST_CONSTANTS = {
  /** 체크 완료 아이콘 */
  ICON_DONE: '✓',
  /** 진행 중 아이콘 */
  ICON_IN_PROGRESS: '◉',
  /** 대기 중 아이콘 */
  ICON_PENDING: '○',
  /** 실패 아이콘 */
  ICON_FAILED: '✗',
  /** 최대 표시 단계 수 (접힘 상태) */
  MAX_VISIBLE_STEPS_COLLAPSED: 5
} as const

/* ============================================================
 * 헬퍼 함수
 * ============================================================ */

/**
 * getStepStyle
 * TaskStep의 status에 따른 스타일 정보를 반환한다.
 * 매직 문자열 방지를 위해 상수 맵으로 관리한다.
 */
function getStepStyle(status: TaskStepStatus): {
  icon: string
  color: string
  opacity: number
  fontWeight: number
  strikethrough: boolean
} {
  const styles: Record<TaskStepStatus, ReturnType<typeof getStepStyle>> = {
    done: {
      icon: CHECKLIST_CONSTANTS.ICON_DONE,
      color: '#34d399',
      opacity: 0.7,
      fontWeight: 400,
      strikethrough: true
    },
    in_progress: {
      icon: CHECKLIST_CONSTANTS.ICON_IN_PROGRESS,
      color: '#a78bfa',
      opacity: 1,
      fontWeight: 600,
      strikethrough: false
    },
    pending: {
      icon: CHECKLIST_CONSTANTS.ICON_PENDING,
      color: 'rgba(200, 200, 220, 0.4)',
      opacity: 0.6,
      fontWeight: 400,
      strikethrough: false
    },
    failed: {
      icon: CHECKLIST_CONSTANTS.ICON_FAILED,
      color: '#f87171',
      opacity: 0.8,
      fontWeight: 400,
      strikethrough: false
    }
  }
  return styles[status]
}

/* ============================================================
 * AgentTaskChecklist 컴포넌트
 * ============================================================ */

/**
 * AgentTaskChecklist
 * agentTaskPlan의 steps 배열을 체크리스트 형태로 렌더링한다.
 * deepReasoning 모드에서 에이전트가 Plan을 방출했을 때 표시된다.
 */
export function AgentTaskChecklist() {
  /*
   * [ZUSTAND SUBSCRIPTION]
   * - agentTaskPlan: 에이전트가 수립한 태스크 플랜 (null이면 표시하지 않음).
   * - agentPhase: 완료 상태 감지용.
   */
  const agentTaskPlan = useAIState((s) => s.agentTaskPlan)
  const agentPhase = useAIState((s) => s.agentPhase)
  const taskProgress = useAIState((s) => s.taskProgress)

  // Plan이 없으면 렌더링하지 않음
  if (!agentTaskPlan || agentTaskPlan.steps.length === 0) return null

  const { steps, goal } = agentTaskPlan
  const completedCount = steps.filter((s) => s.status === 'done').length
  const progressPercent = taskProgress // 신규 Task Runtime의 실질 진행률로 대체

  return (
    <div
      style={{
        margin: '8px 0',
        borderRadius: '12px',
        border: '1px solid rgba(52, 211, 153, 0.2)',
        background: 'linear-gradient(135deg, rgba(52, 211, 153, 0.04) 0%, rgba(99, 102, 241, 0.04) 100%)',
        padding: '12px 14px',
        fontFamily: 'Inter, system-ui, sans-serif'
      }}
    >
      {/* ── 헤더: 목표 + 진행률 ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '10px'
      }}>
        <span style={{ fontSize: '14px' }}>📋</span>
        <span style={{
          fontSize: '12px',
          fontWeight: 600,
          color: 'rgba(52, 211, 153, 0.9)',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          Task Plan
        </span>
        <span style={{
          fontSize: '11px',
          color: 'rgba(200, 200, 220, 0.5)',
          fontVariantNumeric: 'tabular-nums'
        }}>
          {completedCount}/{steps.length}
        </span>
      </div>

      {/* ── 진행률 바 ── */}
      <div style={{
        height: '3px',
        borderRadius: '9999px',
        background: 'rgba(255, 255, 255, 0.08)',
        marginBottom: '10px',
        overflow: 'hidden'
      }}>
        <div style={{
          height: '100%',
          width: `${progressPercent}%`,
          borderRadius: '9999px',
          background: 'linear-gradient(90deg, #34d399, #6366f1)',
          transition: 'width 0.4s ease'
        }} />
      </div>

      {/* ── 단계 목록 ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {steps.map((step) => {
          const style = getStepStyle(step.status)
          return (
            <div
              key={step.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                padding: '5px 8px',
                borderRadius: '8px',
                background: step.status === 'in_progress'
                  ? 'rgba(167, 139, 250, 0.08)'
                  : 'transparent',
                border: step.status === 'in_progress'
                  ? '1px solid rgba(167, 139, 250, 0.15)'
                  : '1px solid transparent',
                transition: 'all 0.25s ease',
                opacity: style.opacity
              }}
            >
              {/* 체크박스 아이콘 */}
              <span style={{
                fontSize: '13px',
                color: style.color,
                lineHeight: '1.4',
                minWidth: '16px',
                textAlign: 'center',
                transition: 'color 0.25s ease'
              }}>
                {step.status === 'in_progress' ? (
                  <span style={{
                    display: 'inline-block',
                    animation: 'pulse 1.2s ease-in-out infinite'
                  }}>
                    {style.icon}
                  </span>
                ) : style.icon}
              </span>

              {/* 단계 설명 */}
              <span style={{
                fontSize: '12px',
                color: step.status === 'in_progress'
                  ? 'rgba(220, 220, 240, 0.95)'
                  : step.status === 'done'
                    ? 'rgba(150, 150, 170, 0.6)'
                    : 'rgba(200, 200, 220, 0.7)',
                fontWeight: style.fontWeight,
                textDecoration: style.strikethrough ? 'line-through' : 'none',
                lineHeight: '1.4',
                transition: 'all 0.25s ease'
              }}>
                {step.id}. {step.description}
              </span>

              {/* 상태 배지 */}
              {step.status === 'failed' && (
                <span style={{
                  fontSize: '10px',
                  padding: '1px 6px',
                  borderRadius: '9999px',
                  background: 'rgba(248, 113, 113, 0.15)',
                  color: '#f87171',
                  border: '1px solid rgba(248, 113, 113, 0.2)',
                  whiteSpace: 'nowrap',
                  marginLeft: 'auto'
                }}>
                  실패
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* ── 완료 배너 ── */}
      {agentPhase === 'done' && completedCount === steps.length && (
        <div style={{
          marginTop: '10px',
          padding: '6px 10px',
          borderRadius: '8px',
          background: 'rgba(52, 211, 153, 0.1)',
          border: '1px solid rgba(52, 211, 153, 0.2)',
          fontSize: '12px',
          color: 'rgba(52, 211, 153, 0.8)',
          textAlign: 'center'
        }}>
          ✓ 모든 단계 완료
        </div>
      )}

      {/* CSS 애니메이션 (인라인 keyframe) */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
