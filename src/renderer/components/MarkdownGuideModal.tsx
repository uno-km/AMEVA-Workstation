import { Key, BookOpen, HelpCircle } from 'lucide-react'
import { StrictModal } from './ui/modals/StrictModal'

interface MarkdownGuideModalProps {
  isOpen: boolean
  onClose: () => void
}

export function MarkdownGuideModal({ isOpen, onClose }: MarkdownGuideModalProps) {
  if (!isOpen) return null

  return (
    <StrictModal
      isOpen={isOpen}
      onClose={onClose}
      title="AMEVA Markdown Guide"
      icon={<BookOpen size={20} />}
      width={700}
      height="80vh"
    >

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
    </StrictModal>
  )
}
