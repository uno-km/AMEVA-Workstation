/**
 * @file YoutubeBlock.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/YoutubeBlock.tsx
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/AppLayout.tsx): 레이아웃 그리드 내부 또는 플로팅 레이어 영역 내에서 그리기로 소비.
 * - 소비처 B (src/renderer/App.tsx): 전역 모달 매니저 및 뷰포트 상태 스위칭에 따라 동적 마운트되어 소비.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 본 파일은 AMEVA 시스템 내에서 도메인 목적에 부합하는 연산 및 데이터 처리 흐름을 안전하게 캡슐화한다.
 * - 외부 라이브러리 및 하위 종속성을 조율하고 결과 규격을 일관되게 제공한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그를 명확하게 남길 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

import { useState, useEffect } from 'react'
import { createReactBlockSpec } from '@blocknote/react'
import { Video, Play, ExternalLink } from 'lucide-react'

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `YoutubeBlockSpec`
   * - 역할: 유입 인자를 가공하고 비즈니스 계약 조건에 맞춰 최종 객체/바이너리를 생산함.
   * - 예시: `YoutubeBlockSpec(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
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
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `videoId && title === 'YouTube Video'`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (videoId && title === 'YouTube Video')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (videoId && title === 'YouTube Video') {
          fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`)
            .then(res => res.json())
            .then(data => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `data.title`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (data.title)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
              if (data.title) {
                setLocalTitle(data.title)
                editor.updateBlock(block, { props: { ...block.props, title: data.title } })
              }
            }).catch(console.error)
        }
      }, [videoId, title, editor, block])

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!videoId`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!videoId)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
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

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `YoutubeBlock`
   * - 역할: 유입 인자를 가공하고 비즈니스 계약 조건에 맞춰 최종 객체/바이너리를 생산함.
   * - 예시: `YoutubeBlock(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
export const YoutubeBlock = YoutubeBlockSpec()

