import { useState, useEffect } from 'react'
import { createReactBlockSpec } from '@blocknote/react'
import { Video, Play, ExternalLink } from 'lucide-react'

export const YoutubeBlockSpec = createReactBlockSpec(
  {
    type: 'youtube',
    propSchema: {
      url: { default: '' },
      videoId: { default: '' },
      title: { default: 'YouTube Video' },
      description: { default: '동영상 설명을 불러오려면 클릭하세요.' },
      thumbnail: { default: '' }
    },
    content: 'none'
  },
  {
    render: ({ block, editor }) => {
      const { videoId, url, title, description, thumbnail } = block.props
      const [isPlaying, setIsPlaying] = useState(false)
      const [localTitle, setLocalTitle] = useState(title)
      const [localThumbnail] = useState(thumbnail || (videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : ''))

      useEffect(() => {
        if (videoId && title === 'YouTube Video') {
          fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`)
            .then(res => res.json())
            .then(data => {
              if (data.title) {
                setLocalTitle(data.title)
                editor.updateBlock(block, { props: { ...block.props, title: data.title } })
              }
            }).catch(console.error)
        }
      }, [videoId, title, editor, block])

      if (!videoId) {
        return (
          <div style={{
            padding: '12px', backgroundColor: '#1c1c24', border: '1px dashed var(--border-muted)',
            borderRadius: '8px', color: 'var(--text-muted)', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px'
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
            width: '100%', backgroundColor: '#18181c', border: '1px solid var(--border-muted)',
            borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column', marginBottom: '12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
          }}
        >
          {/* 헤더 바 */}
          <div style={{
            padding: '8px 12px', borderBottom: '1px solid var(--border-muted)', display: 'flex',
            alignItems: 'center', justifyContent: 'space-between', background: '#121215'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Video size={14} style={{ color: '#ff0000' }} />
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#f8fafc' }}>YouTube Player</span>
            </div>
            <a href={url} target="_blank" rel="noreferrer" style={{ fontSize: '9.5px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}>
              {url} <ExternalLink size={10} />
            </a>
          </div>

          <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', backgroundColor: '#000' }}>
            {!isPlaying ? (
              <div 
                onClick={() => setIsPlaying(true)}
                style={{
                  position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                  background: `url(${localThumbnail}) center/cover no-repeat`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                <div style={{
                  position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0.2))'
                }} />
                <div style={{
                  width: '60px', height: '40px', background: 'rgba(255, 0, 0, 0.9)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2,
                  boxShadow: '0 4px 12px rgba(255,0,0,0.3)', transition: 'transform 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}>
                  <Play size={20} fill="#fff" color="#fff" />
                </div>
                <div style={{ position: 'absolute', bottom: '16px', left: '16px', right: '16px', zIndex: 2 }}>
                  <h3 style={{ margin: 0, color: '#fff', fontSize: '16px', fontWeight: 'bold', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>{localTitle}</h3>
                  <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.8)', fontSize: '12px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {description}
                  </p>
                </div>
              </div>
            ) : (
              <iframe
                src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
                title="YouTube video player" frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
              />
            )}
          </div>
        </div>
      )
    }
  }
)

export const YoutubeBlock = YoutubeBlockSpec()
