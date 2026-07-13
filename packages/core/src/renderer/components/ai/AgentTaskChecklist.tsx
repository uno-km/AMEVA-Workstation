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

import React, { useState } from 'react'
import { useAIState } from '../../stores/useAIState'
import type { TaskStepStatus } from '../../services/ai/orchestrator/types'
import { 
  CheckCircle2, 
  Circle, 
  Loader2, 
  XCircle, 
  ChevronDown, 
  ChevronUp, 
  ClipboardList 
} from 'lucide-react'

/* ============================================================
 * 컴포넌트 내부 상수 (Phase 3 지역 상수)
 * ============================================================ */

/**
 * CHECKLIST_CONSTANTS
 * AgentTaskChecklist 컴포넌트 전용 로컬 상수.
 */
const CHECKLIST_CONSTANTS = {
  /** 최대 표시 단계 수 (접힘 상태) */
  MAX_VISIBLE_STEPS_COLLAPSED: 5
} as const

/* ============================================================
 * 헬퍼 함수
 * ============================================================ */

/**
 * getStepStyle
 * TaskStep의 status에 따른 스타일 정보를 반환한다.
 */
function getStepStyle(status: TaskStepStatus): {
  color: string
  opacity: number
  fontWeight: number
  strikethrough: boolean
} {
  const styles: Record<TaskStepStatus, ReturnType<typeof getStepStyle>> = {
    done: {
      color: '#10b981',
      opacity: 0.6,
      fontWeight: 400,
      strikethrough: true
    },
    in_progress: {
      color: '#a78bfa',
      opacity: 1,
      fontWeight: 600,
      strikethrough: false
    },
    pending: {
      color: 'rgba(200, 200, 220, 0.4)',
      opacity: 0.5,
      fontWeight: 400,
      strikethrough: false
    },
    failed: {
      color: '#ef4444',
      opacity: 0.95,
      fontWeight: 600,
      strikethrough: false
    }
  }
  return styles[status]
}

/**
 * getStepIcon
 * TaskStep의 status에 상응하는 Lucide 아이콘 리액트 요소를 반환한다.
 */
function getStepIcon(status: TaskStepStatus) {
  switch (status) {
    case 'done':
      return <CheckCircle2 size={13} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
    case 'in_progress':
      return <Loader2 size={13} style={{ color: '#a78bfa', animation: 'spin 2s linear infinite', flexShrink: 0, marginTop: '2px' }} />
    case 'pending':
      return <Circle size={13} style={{ color: 'rgba(255, 255, 255, 0.25)', flexShrink: 0, marginTop: '2px' }} />
    case 'failed':
      return <XCircle size={13} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
  }
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
  const planApprovalState = useAIState((s) => s.planApprovalState)
  const resolvePlanApproval = useAIState((s) => s.resolvePlanApproval)

  const [isCollapsed, setIsCollapsed] = useState(false)

  // Plan이 없으면 렌더링하지 않음
  if (!agentTaskPlan || agentTaskPlan.steps.length === 0) return null

  /*
   * [RUN-TIME STATE / INVARIANT]
   * - 변수 명: `steps`
   * - Rationale: 미사용 goal 변수 경고를 제거하기 위해 steps만 단독 비구조화 할당하여 사용한다.
   */
  const { steps } = agentTaskPlan
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
      {/* ── 헤더: 목표 + 진행률 (클릭 시 아코디언 접기/펼치기 토글) ── */}
      <div 
        onClick={() => setIsCollapsed(!isCollapsed)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          userSelect: 'none',
          paddingBottom: isCollapsed ? '0' : '10px',
          borderBottom: isCollapsed ? 'none' : '1px solid rgba(255, 255, 255, 0.05)',
          marginBottom: isCollapsed ? '0' : '10px'
        }}
      >
        <ClipboardList size={14} style={{ color: '#34d399' }} />
        <span style={{
          fontSize: '12px',
          fontWeight: 600,
          color: 'rgba(52, 211, 153, 0.9)',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          태스크 실행 계획 ({completedCount}/{steps.length} 완료)
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            fontSize: '11px',
            color: 'rgba(200, 200, 220, 0.5)',
            fontVariantNumeric: 'tabular-nums'
          }}>
            {progressPercent}%
          </span>
          {isCollapsed ? <ChevronDown size={14} style={{ color: 'rgba(200, 200, 220, 0.6)' }} /> : <ChevronUp size={14} style={{ color: 'rgba(200, 200, 220, 0.6)' }} />}
        </div>
      </div>

      {!isCollapsed && (
        <>
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
              const icon = getStepIcon(step.status)
              
              // 현재 진행 중인 노드는 은은한 보라빛 배경 펄 글로우(pulseGlow)를 입힙니다
              const isInProgress = step.status === 'in_progress'
              const isFailed = step.status === 'failed'
              
              return (
                <div
                  key={step.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    padding: isInProgress ? '6px 10px' : '5px 8px',
                    borderRadius: '8px',
                    background: isInProgress
                      ? 'linear-gradient(90deg, rgba(167, 139, 250, 0.12) 0%, rgba(99, 102, 241, 0.04) 100%)'
                      : isFailed
                        ? 'rgba(239, 68, 68, 0.06)'
                        : 'transparent',
                    border: isInProgress
                      ? '1px solid rgba(167, 139, 250, 0.25)'
                      : isFailed
                        ? '1px solid rgba(239, 68, 68, 0.2)'
                        : '1px solid transparent',
                    boxShadow: isInProgress ? '0 2px 8px rgba(139, 92, 246, 0.05)' : 'none',
                    transition: 'all 0.25s ease',
                    opacity: style.opacity,
                    animation: isInProgress ? 'pulseGlow 2s infinite ease-in-out' : 'none'
                  }}
                >
                  {/* 체크박스 아이콘 */}
                  <span style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '16px',
                    textAlign: 'center',
                    transition: 'color 0.25s ease'
                  }}>
                    {icon}
                  </span>

                  {/* 단계 설명 */}
                  <span style={{
                    fontSize: '12px',
                    color: isInProgress
                      ? 'rgba(220, 220, 240, 0.98)'
                      : step.status === 'done'
                        ? 'rgba(150, 150, 170, 0.55)'
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
                      background: 'rgba(239, 68, 68, 0.15)',
                      color: '#ef4444',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      whiteSpace: 'nowrap',
                      marginLeft: 'auto',
                      fontWeight: 600
                    }}>
                      실패
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

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

      {/* ── Human-in-the-loop: 플랜 승인 / 리뷰 인터랙션 카드 ── */}
      {planApprovalState === 'pending' && (
        <div style={{
          marginTop: '12px',
          paddingTop: '10px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          gap: '8px'
        }}>
          <button
            onClick={() => {
              if (resolvePlanApproval) {
                resolvePlanApproval({ approved: true })
              }
            }}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '6px',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: '#fff',
              fontSize: '11px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              transition: 'transform 0.15s ease',
              boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)'
            }}
          >
            실시 (Proceed)
          </button>
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('ameva:review-plan-request'))
            }}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '6px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: 'rgba(220, 220, 240, 0.9)',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            리뷰 (Review)
          </button>
        </div>
      )}

      {/* CSS 애니메이션 (인라인 keyframe) */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 4px rgba(139, 92, 246, 0.05); }
          50% { box-shadow: 0 0 12px rgba(139, 92, 246, 0.2); }
        }
      `}</style>
    </div>
  )
}
