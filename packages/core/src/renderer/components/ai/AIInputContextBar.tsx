/**
 * @file AIInputContextBar.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/ai/AIInputContextBar.tsx
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


import { Trash2 } from 'lucide-react'

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `AIInputContextBar`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `AIInputContextBar(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
export function AIInputContextBar({
  manualMode, setManualMode,
  selectedText, onClearSelectedText,
  taggedBlocks, setTaggedBlocks,
  pendingQueue, removeFromQueue
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

      {Array.isArray(taggedBlocks) && taggedBlocks.length > 0 && (
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
                onClick={() => setTaggedBlocks((p: any) => Array.isArray(p) ? p.filter((t: any) => t.id !== tag.id) : [])}
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
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{
                fontSize: '11px', color: '#f59e0b', display: 'flex', alignItems: 'center',
                gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                maxWidth: '80%'
              }}>
                <span style={{ fontWeight: 800 }}>[대기]</span>
                <span>
                  {item.userMessage && item.userMessage.length > 30
                    ? item.userMessage.slice(0, 30) + '…'
                    : (item.userMessage || '대기 중인 요청')}
                </span>
              </span>
              <button onClick={() => removeFromQueue(item.id)} style={{ background: 'transparent', border: 'none', color: '#fca5a5', cursor: 'pointer', flexShrink: 0 }}>취소</button>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

