
import { Code2 } from 'lucide-react'
import { MarkdownPreview } from '../MarkdownPreview'
import { type AmevaEditor } from '../../editor/amevaBlockSchema'

export interface WelcomeBannerProps {
  onStartWelcomeEdit?: () => void
  onStartNewDocument?: () => void
  onOpenFile?: () => void
  currentContent: string
  editor: AmevaEditor | null
}

export function WelcomeBanner({
  onStartWelcomeEdit,
  onStartNewDocument,
  onOpenFile,
  currentContent,
  editor,
}: WelcomeBannerProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 눈부신 웰컴 오로라 그래디언트 배너 */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(139,92,246,0.18) 0%, rgba(249,115,22,0.12) 100%)',
        border: '1px solid rgba(139, 92, 246, 0.35)',
        borderRadius: '16px',
        padding: '24px 32px',
        boxShadow: '0 8px 32px rgba(139, 92, 246, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ zIndex: 2 }}>
          <h1 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 6px 0', background: 'linear-gradient(90deg, #a78bfa, #fdba74)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'flex', alignItems: 'center', gap: '8px' }}>
            🚀 AMEVA Workstation Guide Book
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
            아메바 워크스테이션에 오신 것을 환영합니다! 아래는 손실 없이 완전히 렌더링된 공식 안내 백서입니다.<br />
            문서를 직접 작성하거나 웰컴 가이드를 편집하려면 아래 버튼 중 하나를 클릭해 편집을 바로 시작하십시오.
          </p>
        </div>

        {/* 아름다운 액션 버튼 그룹 */}
        <div style={{ display: 'flex', gap: '12px', zIndex: 2, flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            style={{
              padding: '8px 16px',
              fontSize: '12px',
              fontWeight: 'bold',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onClick={onStartWelcomeEdit}
          >
            <Code2 size={14} /> ✍ 가이드 문서 편집하기
          </button>
          
          <button
            className="btn btn-glass"
            style={{
              padding: '8px 16px',
              fontSize: '12px',
              fontWeight: 'bold',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#fff',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onClick={onStartNewDocument}
          >
            ➕ 새 문서 작성하기
          </button>

          <button
            className="btn btn-glass"
            style={{
              padding: '8px 16px',
              fontSize: '12px',
              fontWeight: 'bold',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#fff',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onClick={onOpenFile}
          >
            📂 기존 파일 열기
          </button>
        </div>
      </div>

      {/* 마크다운 원본의 완전 무결 렌더링 뷰포트 */}
      <div style={{
        background: 'var(--bg-deep)',
        border: '1px solid var(--border-muted)',
        borderRadius: '16px',
        padding: '24px 36px',
      }}>
        <MarkdownPreview markdown={currentContent} editor={editor} />
      </div>
    </div>
  )
}
