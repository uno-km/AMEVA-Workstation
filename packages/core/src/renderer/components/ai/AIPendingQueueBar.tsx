/**
 * @file AIPendingQueueBar.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/ai/AIPendingQueueBar.tsx
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
 * AIPendingQueueBar.tsx
 *
 * AI 요청 대기 큐 표시 바 컴포넌트.
 * 현재 대기 중인 요청 목록을 컴팩트한 바 형태로 렌더링하며,
 * 개별 항목 취소 버튼을 제공한다.
 *
 * [단일 책임]
 * - 대기 중인 AI 요청 목록 렌더링
 * - 개별 항목 제거 버튼 이벤트
 * - 전체 큐 비어있으면 null 반환 (조건부 렌더링)
 */

import React from 'react'
import { X, Clock } from 'lucide-react'

export interface QueueItem {
  id: string
  userMessage: string
}

export interface AIPendingQueueBarProps {
  /** 대기 큐 항목 목록 */
  pendingQueue: QueueItem[]
  /** 개별 항목 제거 콜백 */
  onRemove: (id: string) => void
}

/**
 * AIPendingQueueBar
 * 대기 중인 AI 요청 목록을 컴팩트 바로 렌더링한다.
 */
export const AIPendingQueueBar: React.FC<AIPendingQueueBarProps> = ({ pendingQueue, onRemove }) => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `pendingQueue.length === 0`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (pendingQueue.length === 0)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
  if (pendingQueue.length === 0) return null

  return (
    <div style={{
      background: 'rgba(251, 191, 36, 0.05)',
      borderTop: '1px solid rgba(251, 191, 36, 0.2)',
      padding: '6px 12px',
      flexShrink: 0,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        marginBottom: '4px',
      }}>
        <Clock size={10} color="#f59e0b" />
        <span style={{ fontSize: '9px', color: '#f59e0b', fontWeight: 600 }}>
          대기 중 {pendingQueue.length}개
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {pendingQueue.map((item, idx) => (
          <div
            key={item.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 6px',
              background: 'rgba(251, 191, 36, 0.08)',
              borderRadius: '4px',
              border: '1px solid rgba(251, 191, 36, 0.15)',
            }}
          >
            <span style={{ fontSize: '9px', color: '#f59e0b', fontWeight: 600, flexShrink: 0 }}>
              #{idx + 1}
            </span>
            <span style={{
              flex: 1,
              fontSize: '9px',
              color: 'var(--text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {item.userMessage.length > 40
                ? item.userMessage.slice(0, 40) + '…'
                : item.userMessage}
            </span>
            <button
              onClick={() => onRemove(item.id)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#6b7280',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0,
              }}
            >
              <X size={10} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

