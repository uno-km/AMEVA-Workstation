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
                  if (onApplySuggestion && msg.proposedText) onApplySuggestion(msg.proposedText, 'replace', msg.blockId);
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
