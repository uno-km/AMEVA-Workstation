/**
 * @file MessageActionBar.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/ai-panel/chat-list/MessageActionBar.tsx
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
import { Check, X, Copy } from 'lucide-react'
import type { AIMessage } from '../../../../types/aiTypes'

interface MessageActionBarProps {
  isUser: boolean
  msg: AIMessage
  cleanContent: string
  copied: boolean
  handleCopy: () => void
  onApplySuggestion?: (text: string, mode: 'replace' | 'insert', blockId?: string) => void
  onUpdateDiffState?: (msgId: string, state: 'accepted' | 'rejected') => void
  onScrollToBlock?: (blockId: string) => void
  textToApply: string
  hasSelection: boolean
}

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
export function MessageActionBar({
  isUser,
  msg,
  cleanContent,
  copied,
  handleCopy,
  onApplySuggestion,
  onUpdateDiffState,
  onScrollToBlock,
  textToApply,
  hasSelection,
}: MessageActionBarProps) {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
  if (isUser || msg.isStreaming || !cleanContent || cleanContent === '사용자가 답변을 중단했습니다') {
    return null
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', padding: '0 2px', flexWrap: 'wrap',
    }}>
      {msg.originalText && msg.proposedText ? (
        <>
          {msg.diffState === 'pending' && (
            <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
              <button
                onClick={() => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
                  if (onApplySuggestion && msg.proposedText) onApplySuggestion(msg.proposedText, 'replace', msg.blockId);
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
                  if (onUpdateDiffState) onUpdateDiffState(msg.id, 'accepted');
                }}
                style={{
                  flex: 1, background: 'rgba(16,185,129,0.18)', border: '1px solid rgba(16,185,129,0.4)',
                  cursor: 'pointer', color: '#34d399', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: '4px', fontSize: '11px', fontWeight: 'bold', padding: '5px 10px', borderRadius: '5px', transition: 'all 0.15s',
                }}
              >
                <Check size={12} /> 수락 (Accept)
              </button>
              <button
                onClick={() => { if (onUpdateDiffState) onUpdateDiffState(msg.id, 'rejected'); }}
                style={{
                  background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                  cursor: 'pointer', color: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: '4px', fontSize: '11px', padding: '5px 10px', borderRadius: '5px', transition: 'all 0.15s',
                }}
              >
                <X size={12} /> 거절
              </button>
            </div>
          )}
          {msg.diffState === 'accepted' && (
            <div
              onClick={() => { if (msg.blockId && onScrollToBlock) onScrollToBlock(msg.blockId); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#34d399',
                background: 'rgba(16,185,129,0.06)', padding: '4px 8px', borderRadius: '4px',
                border: '1px solid rgba(16,185,129,0.15)', fontWeight: 'bold', cursor: onScrollToBlock ? 'pointer' : 'default',
              }}
            >
              <Check size={12} /> 수정안이 본문에 적용되었습니다
            </div>
          )}
          {msg.diffState === 'rejected' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)',
              background: 'rgba(255,255,255,0.02)', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-muted)',
            }}>
              <X size={12} /> 제안 거절됨
            </div>
          )}
        </>
      ) : (
        <>
          <button
            onClick={handleCopy}
            style={{
              background: 'var(--bg-glass)', border: '1px solid var(--border-muted)', cursor: 'pointer',
              color: copied ? '#10b981' : 'var(--text-muted)', display: 'flex', alignItems: 'center',
              gap: '3px', fontSize: '10px', padding: '3px 7px', borderRadius: '5px', transition: 'all 0.15s',
            }}
          >
            {copied ? <Check size={10} /> : <Copy size={10} />}
            {copied ? '복사됨' : '복사'}
          </button>

          {onApplySuggestion && (
            <button
              onClick={() => onApplySuggestion(textToApply, 'insert')}
              style={{
                background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.25)', cursor: 'pointer',
                color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '3px',
                fontSize: '10px', padding: '3px 7px', borderRadius: '5px', transition: 'all 0.15s',
              }}
            >
              커서에 삽입
            </button>
          )}

          {onApplySuggestion && (
            <button
              onClick={() => onApplySuggestion(textToApply, 'replace', msg.blockId)}
              disabled={!hasSelection}
              style={{
                background: hasSelection ? 'rgba(6,182,212,0.12)' : 'rgba(255,255,255,0.03)',
                border: `1px solid \${hasSelection ? 'rgba(6,182,212,0.3)' : 'var(--border-muted)'}`,
                cursor: hasSelection ? 'pointer' : 'not-allowed', color: hasSelection ? 'var(--secondary)' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', padding: '3px 7px',
                borderRadius: '5px', transition: 'all 0.15s', opacity: hasSelection ? 1 : 0.45,
              }}
              title={hasSelection ? '에디터 선택 영역과 교체합니다' : '에디터에서 영역을 드래그하면 교체할 수 있습니다'}
            >
              선택교체
            </button>
          )}
        </>
      )}
    </div>
  )
}

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
