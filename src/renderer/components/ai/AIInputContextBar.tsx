
import React from 'react'
import { Check, Trash2, Settings2 } from 'lucide-react'

export function AIInputContextBar({
  manualMode, setManualMode,
  selectedText, onClearSelectedText,
  useContext, setUseContext,
  taggedBlocks, setTaggedBlocks,
  pendingQueue, removeFromQueue,
  models, apiModel, onModelChange
}: any) {
  return (
    <>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
        {['auto', 'edit', 'summary', 'chat'].map(m => (
          <button
            key={m}
            onClick={() => setManualMode(m as any)}
            style={{
              padding: '4px 10px', borderRadius: '14px', fontSize: '11px', fontWeight: 600,
              background: manualMode === m ? 'var(--primary)' : 'var(--bg-glass)',
              color: manualMode === m ? '#fff' : 'var(--text-muted)',
              border: manualMode === m ? '1px solid var(--primary)' : '1px solid var(--border-muted)',
              cursor: 'pointer', transition: 'all 0.2s', textTransform: 'capitalize'
            }}
          >
            {m}
          </button>
        ))}
      </div>
      
      {selectedText && (
        <div style={{
          padding: '8px 12px', background: 'rgba(6,182,212,0.1)',
          border: '1px solid rgba(6,182,212,0.3)', borderRadius: '8px',
          marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div style={{ color: 'var(--text-main)', fontSize: '12px' }}>
            <span style={{ fontWeight: 600, color: 'var(--secondary)' }}>선택 영역:</span>
            <span style={{ marginLeft: '6px', opacity: 0.8 }}>{selectedText.substring(0, 30)}...</span>
          </div>
          <button onClick={onClearSelectedText} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <Trash2 size={14} />
          </button>
        </div>
      )}

      {taggedBlocks.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
          {taggedBlocks.map((tag: any) => (
            <div key={tag.id} style={{
              padding: '4px 8px', background: 'var(--bg-glass-active)', borderRadius: '6px',
              border: '1px solid var(--border-muted)', display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '11px', color: 'var(--text-main)'
            }}>
              <span style={{ color: 'var(--primary)', fontWeight: 600 }}>@</span>
              <span style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {tag.text || '빈 블록'}
              </span>
              <button 
                onClick={() => setTaggedBlocks((p: any) => p.filter((t: any) => t.id !== tag.id))}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
              >
                <Trash2 size={10} />
              </button>
            </div>
          ))}
        </div>
      )}
      
      {pendingQueue && pendingQueue.length > 0 && (
        <div style={{ marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {pendingQueue.map((item: any) => (
            <div key={item.id} style={{
              padding: '6px 10px', background: 'rgba(245,158,11,0.1)',
              border: '1px solid rgba(245,158,11,0.3)', borderRadius: '6px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <span style={{ fontSize: '11px', color: '#f59e0b' }}>대기 중...</span>
              <button onClick={() => removeFromQueue(item.id)} style={{ background: 'transparent', border: 'none', color: '#fca5a5', cursor: 'pointer' }}>취소</button>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
