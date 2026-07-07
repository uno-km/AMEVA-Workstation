/**
 * AIQuickActionBar.tsx
 *
 * AI 패널 상단 퀵 액션 버튼 바 컴포넌트.
 * AIPanel.tsx에 인라인으로 정의되어 있던 퀵 액션 버튼 목록을 독립 컴포넌트로 분리한다.
 *
 * [단일 책임]
 * 요약/교정/번역/확장/설명 퀵 액션 버튼들을 렌더링하고 클릭 이벤트를 상위로 전달한다.
 */

import React from 'react'
import { FileText, Wand2, Languages, Expand, Lightbulb } from 'lucide-react'

/** 퀵 액션 항목 정의 */
const QUICK_ACTIONS = [
  { id: 'summarize', icon: FileText, label: '요약', prompt: '현재 문서 내용을 핵심만 3줄로 요약해줘.' },
  { id: 'improve', icon: Wand2, label: '교정', prompt: '현재 문서의 문체와 표현을 자연스럽게 개선해줘.' },
  { id: 'translate', icon: Languages, label: '번역', prompt: '현재 문서를 영어로 번역해줘.' },
  { id: 'expand', icon: Expand, label: '확장', prompt: '현재 문서 내용을 더 풍부하게 확장해줘.' },
  { id: 'explain', icon: Lightbulb, label: '설명', prompt: '현재 문서의 핵심 개념을 쉽게 설명해줘.' },
] as const

export interface AIQuickActionBarProps {
  /** 생성 중 여부 (버튼 비활성화 조건) */
  isGenerating: boolean
  /** 퀵 액션 클릭 콜백. 해당 프롬프트를 상위로 전달한다. */
  onAction: (prompt: string) => void
}

/**
 * AIQuickActionBar
 * 퀵 액션 버튼 목록을 렌더링한다.
 */
export const AIQuickActionBar: React.FC<AIQuickActionBarProps> = ({ isGenerating, onAction }) => {
  return (
    <div style={{
      display: 'flex',
      gap: '4px',
      padding: '6px 12px',
      overflowX: 'auto',
      flexShrink: 0,
      borderBottom: '1px solid var(--border-muted)',
    }}>
      {QUICK_ACTIONS.map(({ id, icon: Icon, label, prompt }) => (
        <button
          key={id}
          onClick={() => !isGenerating && onAction(prompt)}
          disabled={isGenerating}
          title={prompt}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '4px 8px',
            background: 'var(--bg-glass)',
            border: '1px solid var(--border-muted)',
            borderRadius: '6px',
            color: isGenerating ? 'var(--text-muted)' : 'var(--text-main)',
            fontSize: '10px',
            cursor: isGenerating ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            opacity: isGenerating ? 0.5 : 1,
            transition: 'all 0.15s',
          }}
        >
          <Icon size={11} />
          {label}
        </button>
      ))}
    </div>
  )
}
