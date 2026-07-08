import React from 'react'
import type { AmevaEditor } from '../../editor/amevaBlockSchema'
import type { EditorMode } from '../../../shared/types'

interface RichStyleToolbarProps {
  editor: AmevaEditor | null
  editorMode: EditorMode
  hasRichStyling: boolean
  selectedFont: string
  setSelectedFont: (val: string) => void
  selectedSize: string
  setSelectedSize: (val: string) => void
}

export function RichStyleToolbar({
  editor,
  editorMode,
  hasRichStyling,
  selectedFont,
  setSelectedFont,
  selectedSize,
  setSelectedSize
}: RichStyleToolbarProps) {
  if (!hasRichStyling || editorMode !== 'edit') return null

  return (
    <div style={{
      padding: '8px 16px',
      borderBottom: '1px solid var(--border-muted)',
      backgroundColor: 'var(--bg-deep)',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      zIndex: 50,
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Font</span>
        <select
          value={selectedFont}
          onChange={(e) => setSelectedFont(e.target.value)}
          style={{
            background: '#16161a',
            border: '1px solid #2e2e38',
            borderRadius: '4px',
            color: '#fff',
            fontSize: '11px',
            padding: '3px 6px',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="Pretendard">Pretendard (Gothic)</option>
          <option value="'Courier New', Courier, monospace">Monospace (Hacker)</option>
          <option value="'Gungsuh', '궁서', serif">궁서체 (Classic)</option>
          <option value="'Batang', '바탕', serif">바탕체 (Serif)</option>
          <option value="system-ui, sans-serif">System UI</option>
        </select>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Size</span>
        <select
          value={selectedSize}
          onChange={(e) => setSelectedSize(e.target.value)}
          style={{
            background: '#16161a',
            border: '1px solid #2e2e38',
            borderRadius: '4px',
            color: '#fff',
            fontSize: '11px',
            padding: '3px 6px',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          <option value="12px">12px (Compact)</option>
          <option value="14px">14px (Default)</option>
          <option value="16px">16px (Medium)</option>
          <option value="18px">18px (Large)</option>
          <option value="22px">22px (Huge)</option>
        </select>
      </div>
    </div>
  )
}
