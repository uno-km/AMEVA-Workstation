import React from 'react'
import { createReactBlockSpec } from '@blocknote/react'
import { Globe, ExternalLink } from 'lucide-react'

export const LinkPreviewBlockSpec = createReactBlockSpec(
  {
    type: 'linkPreview',
    propSchema: {
      url: { default: '' },
      title: { default: 'Loading preview...' },
      description: { default: '' },
      thumbnail: { default: '' }
    },
    content: 'none'
  },
  {
    render: ({ block }) => {
      const { url, title, description, thumbnail } = block.props

      const handleClick = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (url && (window as any).electronAPI?.openExternalLink) {
          (window as any).electronAPI.openExternalLink(url)
        } else if (url) {
          window.open(url, '_blank')
        }
      }

      const isFailed = title === '서버 코드: 404' || title?.startsWith('연결 실패') || title === '연결 시간 초과'
      const isLoading = title === 'Loading preview...'

      return (
        <div
          className="bn-block-content-wrapper"
          onClick={handleClick}
          style={{
            width: '100%',
            backgroundColor: 'rgba(30, 30, 40, 0.45)',
            backdropFilter: 'blur(12px)',
            border: '1px solid var(--border-muted)',
            borderRadius: '12px',
            overflow: 'hidden',
            display: 'flex',
            cursor: 'pointer',
            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            marginBottom: '12px',
            userSelect: 'none',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.borderColor = 'var(--primary)'
            e.currentTarget.style.backgroundColor = 'rgba(139, 92, 246, 0.08)'
            e.currentTarget.style.boxShadow = '0 8px 30px rgba(139, 92, 246, 0.15)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.borderColor = 'var(--border-muted)'
            e.currentTarget.style.backgroundColor = 'rgba(30, 30, 40, 0.45)'
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)'
          }}
        >
          {thumbnail ? (
            <div style={{
              width: '160px',
              minWidth: '160px',
              height: '110px',
              background: `url(${thumbnail}) center/cover no-repeat`,
              borderRight: '1px solid var(--border-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#16161d'
            }} />
          ) : (
            <div style={{
              width: '100px',
              minWidth: '100px',
              height: '110px',
              backgroundColor: 'rgba(255,255,255,0.02)',
              borderRight: '1px solid var(--border-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)'
            }}>
              <Globe size={24} style={{ opacity: 0.5 }} />
            </div>
          )}

          <div style={{
            flex: 1,
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                fontWeight: 700,
                color: isFailed ? '#ef4444' : 'var(--text-main)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {title}
                <ExternalLink size={11} style={{ opacity: 0.5, flexShrink: 0 }} />
              </div>
              <div style={{
                fontSize: '11.5px',
                color: 'var(--text-muted)',
                lineHeight: 1.4,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {description || (isLoading ? '웹 페이지의 상세 설명을 가져오는 중입니다...' : '설명이 없는 페이지입니다.')}
              </div>
            </div>

            <div style={{
              fontSize: '9.5px',
              color: 'var(--primary)',
              opacity: 0.8,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              marginTop: '4px',
              fontWeight: 500,
            }}>
              {url}
            </div>
          </div>
        </div>
      )
    }
  }
)

export const LinkPreviewBlock = LinkPreviewBlockSpec()
