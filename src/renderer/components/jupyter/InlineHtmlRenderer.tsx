import React from 'react'
import { Globe } from 'lucide-react'

// HTML 미리보기 샌드박스 렌더러
export function InlineHtmlRenderer({ code }: { code: string }) {
  return (
    <div style={{
      border: '1px solid rgba(249,115,22,0.35)',
      borderRadius: '10px',
      overflow: 'hidden',
      margin: '16px 0',
      background: '#fff',
      boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
    }}>
      <div style={{
        background: '#111827',
        padding: '8px 14px',
        fontSize: '11px',
        color: '#f97316',
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        borderBottom: '1px solid rgba(249,115,22,0.2)',
        userSelect: 'none',
      }}>
        <Globe size={12} style={{ color: '#f97316' }} />
        HTML 실시간 렌더링 화면 (Live Sandbox)
      </div>
      <iframe
        sandbox="allow-scripts allow-modals"
        title="Inline HTML Preview"
        srcDoc={code}
        style={{
          width: '100%',
          height: '380px',
          border: 'none',
          background: '#fff',
        }}
      />
    </div>
  )
}
