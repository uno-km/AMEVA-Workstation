/**
 * AITaggedBlockPill.tsx
 *
 * AI 패널 입력창의 태그 블록 필 컴포넌트.
 * 태깅된 블록(참조 컨텍스트)의 목록을 입력창 위에 Pill 형태로 렌더링하며,
 * 개별 태그 삭제 및 클릭 시 해당 블록으로 스크롤 이동 기능을 제공한다.
 *
 * [단일 책임]
 * - 태그된 블록 Pill 렌더링
 * - 개별 Pill 삭제 버튼 이벤트
 * - Pill 클릭 → 에디터 스크롤 이동
 */

import React from 'react'
import { X } from 'lucide-react'

export interface TaggedBlock {
  id: string
  text: string
}

export interface AITaggedBlockPillProps {
  /** 현재 태그된 블록 목록 */
  taggedBlocks: TaggedBlock[]
  /** 개별 태그 제거 콜백 */
  onRemove: (blockId: string) => void
  /** 블록 클릭 시 에디터 스크롤 콜백 */
  onScrollToBlock: (blockId: string) => void
}

/**
 * AITaggedBlockPill
 * 입력창 상단에 위치하는 컨텍스트 블록 태그 Pill 목록.
 */
export const AITaggedBlockPill: React.FC<AITaggedBlockPillProps> = ({
  taggedBlocks,
  onRemove,
  onScrollToBlock
}) => {
  if (taggedBlocks.length === 0) return null

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '4px',
      padding: '6px 12px 0',
    }}>
      {taggedBlocks.map((block) => (
        <div
          key={block.id}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            background: 'var(--primary-glow)',
            border: '1px solid var(--primary)',
            borderRadius: '999px',
            padding: '2px 8px',
            fontSize: '10px',
            color: 'var(--primary)',
            cursor: 'default',
            maxWidth: '180px',
            overflow: 'hidden',
          }}
        >
          <span
            onClick={() => onScrollToBlock(block.id)}
            title={block.text}
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              flex: 1,
            }}
          >
            {block.text.length > 20 ? block.text.slice(0, 20) + '…' : block.text}
          </span>
          <button
            onClick={() => onRemove(block.id)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--primary)',
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
  )
}
