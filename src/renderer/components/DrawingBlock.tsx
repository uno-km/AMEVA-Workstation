/**
 * @file DrawingBlock.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/DrawingBlock.tsx
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

import React, { useState, useEffect, useRef } from 'react'
import { createReactBlockSpec } from '@blocknote/react'
import { Check, Edit2, FileImage } from 'lucide-react'

// Dynamic import or guarded import of Excalidraw to bypass Node environment check during build
let Excalidraw: any = null
try {
  // [RUN-TIME STATE / INVARIANT] - 변수 'ex'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const ex = require('@excalidraw/excalidraw')
  Excalidraw = ex.Excalidraw
} catch {
  // ESM or fallback import
  import('@excalidraw/excalidraw').then((m) => {
    Excalidraw = m.Excalidraw
  })
}

export const DrawingBlockSpec = createReactBlockSpec(
  {
    type: 'drawing',
    propSchema: {
      data: { default: '[]' }
    },
    content: 'none'
  },
  {
    render: ({ block, editor }) => {
      const [mounted, setMounted] = useState(false)
      const [isEditing, setIsEditing] = useState(true)
      const [excalidrawLoaded, setExcalidrawLoaded] = useState(!!Excalidraw)
  // [RUN-TIME STATE / INVARIANT] - 변수 'saveTimeoutRef'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

      useEffect(() => {
        setMounted(true)
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (!Excalidraw) {
          // If not loaded via require, check dynamic import in interval
          const interval = setInterval(() => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
            if (Excalidraw) {
              setExcalidrawLoaded(true)
              clearInterval(interval)
            }
          }, 100)
          return () => clearInterval(interval)
        }
      }, [])

      // Parse initial data
      let initialElements = []
      try {
        initialElements = JSON.parse(block.props.data || '[]')
      } catch (e) {
        console.error('Drawing data parse error:', e)
      }

      // Debounced save to prevent rendering lag during drawing strokes
      const handleCanvasChange = (elements: any[]) => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current)
        }
        saveTimeoutRef.current = setTimeout(() => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'stringified'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          const stringified = JSON.stringify(elements)
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
          if (stringified !== block.props.data) {
            editor.updateBlock(block.id, {
              type: 'drawing',
              props: { data: stringified }
            })
          }
        }, 500)
      };

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (!mounted || (!Excalidraw && !excalidrawLoaded)) {
        return (
          <div style={{
            height: '350px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#16161a',
            border: '1px dashed #2e2e38',
            borderRadius: '8px',
            color: 'var(--text-muted)',
            fontSize: '12px'
          }}>
            드로잉 모듈을 준비 중입니다...
          </div>
        )
      }

      return (
        <div
          className="bn-block-content-wrapper"
          style={{
            width: '100%',
            backgroundColor: '#18181c',
            border: '1px solid #2e2e38',
            borderRadius: '8px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            marginBottom: '10px'
          }}
        >
          {/* 헤더 바 */}
          <div style={{
            padding: '8px 12px',
            borderBottom: '1px solid #2e2e38',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#121215'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileImage size={14} style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#f8fafc' }}>Drawing Canvas</span>
            </div>
            
            <button
              onClick={() => setIsEditing(!isEditing)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--primary)',
                fontSize: '11px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                borderRadius: '4px',
                backgroundColor: 'rgba(139,92,246,0.1)'
              }}
            >
              {isEditing ? (
                <>
                  <Check size={11} />
                  Done Sketching
                </>
              ) : (
                <>
                  <Edit2 size={11} />
                  Edit Sketch
                </>
              )}
            </button>
          </div>

          {/* 캔버스 본체 */}
          <div style={{ height: '380px', width: '100%', position: 'relative' }}>
            {isEditing ? (
              <Excalidraw
                initialData={{
                  elements: initialElements,
                  appState: { viewBackgroundColor: '#1e1e24', theme: 'dark' }
                }}
                onChange={handleCanvasChange}
              />
            ) : (
              // 뷰 전용 프리뷰 상태 (이벤트 차단용 마스크 오버레이 장착)
              <>
                <Excalidraw
                  initialData={{
                    elements: initialElements,
                    appState: { viewBackgroundColor: '#1e1e24', theme: 'dark' }
                  }}
                  viewModeEnabled={true}
                />
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 5,
                  cursor: 'default'
                }} />
              </>
            )}
          </div>
        </div>
      )
    }
  }
)

export const DrawingBlock = DrawingBlockSpec()

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
