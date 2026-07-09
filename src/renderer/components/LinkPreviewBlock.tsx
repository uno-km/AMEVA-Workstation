/**
 * @file LinkPreviewBlock.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/LinkPreviewBlock.tsx
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

import React from 'react'
import { createReactBlockSpec } from '@blocknote/react'
import { Globe, ExternalLink } from 'lucide-react'

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `LinkPreviewBlockSpec`
   * - 역할: 유입 인자를 가공하고 비즈니스 계약 조건에 맞춰 최종 객체/바이너리를 생산함.
   * - 예시: `LinkPreviewBlockSpec(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
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

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `handleClick`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const handleClick = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const handleClick = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `url && (window as any).electronAPI?.openExternalLink`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (url && (window as any).electronAPI?.openExternalLink)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (url && (window as any).electronAPI?.openExternalLink) {
          (window as any).electronAPI.openExternalLink(url)
        } else if (url) {
          window.open(url, '_blank')
        }
      }

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `isFailed`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const isFailed = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const isFailed = title === '서버 코드: 404' || title?.startsWith('연결 실패') || title === '연결 시간 초과'
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `isLoading`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const isLoading = ...` 형태로 안전 캐싱 후 가공 기동.
       */
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

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `LinkPreviewBlock`
   * - 역할: 유입 인자를 가공하고 비즈니스 계약 조건에 맞춰 최종 객체/바이너리를 생산함.
   * - 예시: `LinkPreviewBlock(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
export const LinkPreviewBlock = LinkPreviewBlockSpec()

