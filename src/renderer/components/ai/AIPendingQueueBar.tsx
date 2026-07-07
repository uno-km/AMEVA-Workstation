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
