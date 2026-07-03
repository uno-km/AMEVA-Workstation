import React from 'react'
import { X, HelpCircle, BookOpen, Key } from 'lucide-react'

interface MarkdownGuideModalProps {
  isOpen: boolean
  onClose: () => void
}

export function MarkdownGuideModal({ isOpen, onClose }: MarkdownGuideModalProps) {
  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'var(--bg-deep)',
        opacity: 0.95,
        backdropFilter: 'blur(12px)',
        zIndex: 10001,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        className="glass-panel glow-primary"
        style={{
          width: '90%',
          maxWidth: '700px',
          height: '80vh',
          borderRadius: '16px',
          border: '1px solid var(--border-glow)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px rgba(139, 92, 246, 0.35)',
          color: 'var(--text-main)',
        }}
      >
        {/* 헤더 */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-muted)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--bg-glass-active)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
            <BookOpen size={20} />
            <h3 style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'var(--font-sans)' }}>AMEVA Markdown Guide</h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* 바디 (스크롤 가능) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* 단축키 및 에디터 사용법 */}
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
              <Key size={16} /> 에디터 핵심 단축키
            </h4>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <div style={{ padding: '8px', background: 'var(--bg-glass-active)', borderRadius: '6px', border: '1px solid var(--border-muted)' }}>
                <span style={{ color: 'var(--primary)' }}>Ctrl + S</span> : 문서 즉시 저장
              </div>
              <div style={{ padding: '8px', background: 'var(--bg-glass-active)', borderRadius: '6px', border: '1px solid var(--border-muted)' }}>
                <span style={{ color: 'var(--primary)' }}>Ctrl + Wheel</span> : 뷰포트 확대 / 축소
              </div>
              <div style={{ padding: '8px', background: 'var(--bg-glass-active)', borderRadius: '6px', border: '1px solid var(--border-muted)' }}>
                <span style={{ color: 'var(--primary)' }}>Ctrl + + / -</span> : 화면 크기 조절
              </div>
              <div style={{ padding: '8px', background: 'var(--bg-glass-active)', borderRadius: '6px', border: '1px solid var(--border-muted)' }}>
                <span style={{ color: 'var(--primary)' }}>Ctrl + 0</span> : 화면 크기 초기화
              </div>
            </div>
          </div>

          <div style={{ height: '1px', backgroundColor: 'var(--border-muted)' }} />

          {/* 마크다운 기본 문법 */}
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
              <HelpCircle size={16} /> 기본 마크다운 문법
            </h4>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-muted)' }}>
                  <th style={{ padding: '8px', color: 'var(--text-muted)' }}>문법</th>
                  <th style={{ padding: '8px', color: 'var(--text-muted)' }}>마크다운 타이핑</th>
                  <th style={{ padding: '8px', color: 'var(--text-muted)' }}>결과</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                  <td style={{ padding: '10px 8px' }}>제목 (Heading)</td>
                  <td style={{ padding: '10px 8px', fontFamily: 'var(--font-mono)' }}># 제목 1 / ## 제목 2</td>
                  <td style={{ padding: '10px 8px', fontWeight: 'bold' }}>대제목 / 소제목</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                  <td style={{ padding: '10px 8px' }}>굵게 (Bold)</td>
                  <td style={{ padding: '10px 8px', fontFamily: 'var(--font-mono)' }}>**텍스트**</td>
                  <td style={{ padding: '10px 8px', fontWeight: 'bold' }}>텍스트</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                  <td style={{ padding: '10px 8px' }}>기울임 (Italic)</td>
                  <td style={{ padding: '10px 8px', fontFamily: 'var(--font-mono)' }}>*텍스트*</td>
                  <td style={{ padding: '10px 8px', fontStyle: 'italic' }}>텍스트</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                  <td style={{ padding: '10px 8px' }}>코드 블록</td>
                  <td style={{ padding: '10px 8px', fontFamily: 'var(--font-mono)' }}>\`\`\`javascript ... \`\`\`</td>
                  <td style={{ padding: '10px 8px', fontFamily: 'var(--font-mono)', color: 'var(--secondary)' }}>코드 입력창</td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border-muted)' }}>
                  <td style={{ padding: '10px 8px' }}>표 (Table)</td>
                  <td style={{ padding: '10px 8px', fontFamily: 'var(--font-mono)' }}>| 헤더1 | 헤더2 |</td>
                  <td style={{ padding: '10px 8px' }}>구조화된 데이터 표</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* 푸터 */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-muted)',
            display: 'flex',
            justifyContent: 'flex-end',
            backgroundColor: 'var(--bg-glass-active)',
          }}
        >
          <button className="btn btn-primary" style={{ padding: '6px 20px', fontSize: '12px' }} onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
