import React from 'react'
import { Info, AlertTriangle, Check } from 'lucide-react'

interface DocStatusIndicatorProps {
  filePath: string | null
  isDirty: boolean
  lastSavedTime: Date | null
  activeTooltip: string | null
  setActiveTooltip: (id: string | null) => void
  tooltipStyle: React.CSSProperties
}

export function DocStatusIndicator({
  filePath,
  isDirty,
  lastSavedTime,
  activeTooltip,
  setActiveTooltip,
  tooltipStyle
}: DocStatusIndicatorProps) {
  const formatSavedTime = (date: Date | null) => {
    if (!date) return '최근 저장 시간 기록 없음 (새 문서)'
    const yyyy = date.getFullYear()
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    const hh = String(date.getHours()).padStart(2, '0')
    const min = String(date.getMinutes()).padStart(2, '0')
    const ss = String(date.getSeconds()).padStart(2, '0')
    return `최근 저장 시간: ${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <Info size={12} style={{ color: 'var(--primary)' }} />
        <span style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: '260px' }}>
          {filePath ? filePath.split(/[\\/]/).pop() : '무제 문서.md'}
        </span>
      </div>
      <div style={{ width: '1px', height: '12px', backgroundColor: 'var(--border-muted)' }} />
      {isDirty ? (
        <span 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '4px', 
            color: '#fb923c', // 주황색 계열 (수정 중)
            cursor: 'help',
            fontWeight: 600,
            fontSize: '11px',
            position: 'relative'
          }}
          onMouseEnter={() => setActiveTooltip('save')}
          onMouseLeave={() => setActiveTooltip(null)}
        >
          <AlertTriangle size={11} style={{ color: '#fb923c' }} /> 저장되지 않음

          {activeTooltip === 'save' && (
            <div style={{ ...tooltipStyle, width: '280px', left: 0 }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#fb923c', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px', marginBottom: '4px' }}>
                ⚠️ 미저장 수정사항 존재
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-main)', lineHeight: '1.4' }}>
                에디터 본문에 저장되지 않은 변경사항이 있습니다. <br />
                <span style={{ color: 'var(--primary)', fontWeight: 700 }}>Ctrl+S</span> 단축키를 눌러 디스크에 안전하게 저장하십시오.
              </div>
            </div>
          )}
        </span>
      ) : (
        <span 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '4px', 
            color: 'var(--success)', 
            cursor: 'help',
            fontSize: '11px',
            position: 'relative'
          }}
          onMouseEnter={() => setActiveTooltip('save')}
          onMouseLeave={() => setActiveTooltip(null)}
        >
          <Check size={11} style={{ color: 'var(--success)' }} /> 저장됨

          {activeTooltip === 'save' && (
            <div style={{ ...tooltipStyle, width: '260px', left: 0 }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--success)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px', marginBottom: '4px' }}>
                ✓ 문서가 디스크에 동기화됨
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-main)' }}>
                {formatSavedTime(lastSavedTime)}
              </div>
            </div>
          )}
        </span>
      )}
    </>
  )
}
