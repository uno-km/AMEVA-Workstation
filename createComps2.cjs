const fs = require('fs');

const createComponent = (name, content) => {
  fs.writeFileSync(`src/renderer/components/ai/${name}.tsx`, content, 'utf-8');
  console.log(`Created ${name}.tsx`);
};

// 4. AIModelHubModal
createComponent('AIModelHubModal', `
import React from 'react'

export function AIModelHubModal({ show, onClose, models, onDownload, downloadStatus }: any) {
  if (!show) return null;

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(10px)',
      zIndex: 200, display: 'flex', flexDirection: 'column'
    }}>
      <div style={{
        padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '14px' }}>추천 모델 다운로드 허브</h3>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>X</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {models.map((m: any) => (
          <div key={m.id} style={{
            padding: '12px', background: 'var(--bg-glass)', borderRadius: '8px',
            border: '1px solid var(--border-muted)'
          }}>
            <div style={{ color: 'var(--text-main)', fontWeight: 600, fontSize: '13px' }}>{m.name}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '4px' }}>{m.description}</div>
            <button 
              onClick={() => onDownload(m.id)}
              disabled={!!downloadStatus?.status}
              style={{
                marginTop: '12px', width: '100%', padding: '8px',
                background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: '6px',
                cursor: downloadStatus?.status ? 'not-allowed' : 'pointer', opacity: downloadStatus?.status ? 0.5 : 1
              }}
            >
              다운로드
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
`);

// 5. AIInputContextBar
createComponent('AIInputContextBar', `
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
`);

// 6. AIDocumentOutline
createComponent('AIDocumentOutline', `
import React from 'react'

export function AIDocumentOutline({ blocks }: any) {
  const getDocumentOutline = (items: any[]) => {
    let list: any[] = []
    const traverse = (nodes: any[]) => {
      for (const item of nodes) {
        if (item.type === 'heading') {
          let text = ''
          if (Array.isArray(item.content)) {
            text = item.content.map((c: any) => c.text).join('')
          } else if (typeof item.content === 'string') {
            text = item.content
          }
          list.push({ id: item.id, text, level: item.props?.level || 1 })
        }
        if (item.children) traverse(item.children)
      }
    }
    if (items && Array.isArray(items)) traverse(items)
    return list
  }

  const outline = getDocumentOutline(blocks)

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>
        문서 개요 (총 {outline.length}개 제목)
      </div>
      {outline.length === 0 ? (
        <div style={{ fontSize: '11px', color: 'var(--text-dark)', fontStyle: 'italic', textAlign: 'center', marginTop: '24px' }}>
          작성된 제목(Heading)이 없습니다.
        </div>
      ) : (
        outline.map((item) => (
          <div
            key={item.id}
            onClick={() => {
              const el = document.querySelector(\`[data-id="\${item.id}"]\`)
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                el.classList.add('pulse-indicator')
                setTimeout(() => el.classList.remove('pulse-indicator'), 1000)
              }
            }}
            style={{
              padding: '6px 10px', borderRadius: '6px', fontSize: '12px',
              color: item.level === 1 ? 'var(--text-main)' : 'var(--text-muted)',
              fontWeight: item.level === 1 ? 700 : item.level === 2 ? 600 : 500,
              paddingLeft: \`\${(item.level - 1) * 12 + 10}px\`,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
              transition: 'background 0.15s',
              borderLeft: item.level === 1 ? '2px solid var(--primary)' : '2px solid transparent',
              background: 'rgba(255,255,255,0.01)',
            }}
          >
            <span style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: item.level === 1 ? 'var(--primary)' : 'var(--text-dark)', display: 'inline-block' }} />
            {item.text}
          </div>
        ))
      )}
    </div>
  )
}
`);

// 7. AIPluginViews
createComponent('AIPluginViews', `
import React, { useEffect, useRef } from 'react'

export function AIPluginViews({ activeTab }: { activeTab: string }) {
  const pluginRefs = {
    calculator: useRef<HTMLDivElement>(null),
    finance: useRef<HTMLDivElement>(null),
    youtube: useRef<HTMLDivElement>(null),
    naver: useRef<HTMLDivElement>(null),
    google: useRef<HTMLDivElement>(null),
    calendar: useRef<HTMLDivElement>(null),
    'google-drive': useRef<HTMLDivElement>(null),
  }

  useEffect(() => {
    if (activeTab === 'ai' || activeTab === 'outline') return;
    const ref = pluginRefs[activeTab as keyof typeof pluginRefs];
    if (ref?.current) {
      const globalPlugins = (window as any).AMEVA_PLUGINS;
      if (globalPlugins?.[activeTab]) {
        try {
          globalPlugins[activeTab].render(ref.current.id);
        } catch (e) {
          console.error(\`\${activeTab} 플러그인 렌더링 실패:\`, e);
        }
      }
    }
  }, [activeTab]);

  const containerStyle = {
    flex: 1, display: 'flex', flexDirection: 'column' as const,
    backgroundColor: 'var(--bg-main)', height: '100%', padding: '16px', overflowY: 'auto' as const
  };

  switch (activeTab) {
    case 'calculator': return <div id="ameva-plugin-calculator" style={containerStyle} ref={pluginRefs.calculator} />
    case 'finance': return <div id="ameva-plugin-finance-dashboard" style={containerStyle} ref={pluginRefs.finance} />
    case 'youtube': return <div id="ameva-plugin-youtube" style={containerStyle} ref={pluginRefs.youtube} />
    case 'naver': return <div id="ameva-plugin-naver" style={containerStyle} ref={pluginRefs.naver} />
    case 'google': return <div id="ameva-plugin-google" style={containerStyle} ref={pluginRefs.google} />
    case 'calendar': return <div id="ameva-plugin-calendar" style={containerStyle} ref={pluginRefs.calendar} />
    case 'google-drive': return <div id="ameva-plugin-google-drive" style={containerStyle} ref={pluginRefs['google-drive']} />
    default: return null;
  }
}
`);
