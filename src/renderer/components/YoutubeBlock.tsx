import React from 'react'
import { createReactBlockSpec } from '@blocknote/react'
import { Video } from 'lucide-react'

export const YoutubeBlockSpec = createReactBlockSpec(
  {
    type: 'youtube',
    propSchema: {
      url: { default: '' },
      videoId: { default: '' }
    },
    content: 'none'
  },
  {
    render: ({ block }) => {
      const { videoId, url } = block.props

      if (!videoId) {
        return (
          <div style={{
            padding: '12px',
            backgroundColor: '#1c1c24',
            border: '1px dashed var(--border-muted)',
            borderRadius: '8px',
            color: 'var(--text-muted)',
            fontSize: '11.5px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '10px'
          }}>
            <Video size={16} />
            <span>유효하지 않은 YouTube 링크입니다. ({url})</span>
          </div>
        )
      }

      return (
        <div
          className="bn-block-content-wrapper"
          style={{
            width: '100%',
            backgroundColor: '#18181c',
            border: '1px solid var(--border-muted)',
            borderRadius: '12px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            marginBottom: '12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
          }}
        >
          {/* 헤더 바 */}
          <div style={{
            padding: '8px 12px',
            borderBottom: '1px solid var(--border-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#121215'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Video size={14} style={{ color: '#ff0000' }} />
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#f8fafc' }}>YouTube Player</span>
            </div>
            <span style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>{url}</span>
          </div>

          {/* 비디오 iframe 영역 (16:9 비율 유지) */}
          <div style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16/9',
            backgroundColor: '#000'
          }}>
            <iframe
              src={`https://www.youtube.com/embed/${videoId}`}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%'
              }}
            />
          </div>
        </div>
      )
    }
  }
)

export const YoutubeBlock = YoutubeBlockSpec()
