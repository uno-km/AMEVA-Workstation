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

/*
 * [FIX-DRAWING-001] Excalidraw ESM/Node 환경 호환 로드 가드 강화.
 * - @excalidraw/excalidraw 는 브라우저 전용 API(window.ResizeObserver 등)에 강하게 의존한다.
 * - require() 로드 실패 시 동적 import()를 시도하지만, 타임아웃 없이 폴링하면 무한 로딩 상태가 된다.
 * - 해결: Promise.race + 5초 타임아웃으로 로드를 시도하고, 실패 시 excalidrawFailed 플래그를 세워
 *   Canvas API 기반 경량 스케치패드 폴백으로 즉시 전환하도록 한다.
 */
let Excalidraw: React.ComponentType<any> | null = null
let excalidrawFailed = false

// 비동기 로드를 즉시 시작 (앱 부팅 시 한 번만 실행)
const loadExcalidraw = async () => {
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Excalidraw load timeout (5s)')), 5000)
    )
    const loaded = import('@excalidraw/excalidraw').then(m => m.Excalidraw)
    Excalidraw = await Promise.race([loaded, timeout])
  } catch (err) {
    console.warn('[DrawingBlock] Excalidraw 로드 실패 — Canvas 폴백 활성화:', err)
    excalidrawFailed = true
  }
}

// require() 로 동기 로드 우선 시도 (CJS 번들 환경)
try {
  const ex = require('@excalidraw/excalidraw') as { Excalidraw: typeof Excalidraw }
  Excalidraw = ex.Excalidraw
} catch {
  // CJS 로드 실패 시 비동기 로드 트리거
  loadExcalidraw()
}

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `DrawingBlockSpec`
   * - 역할: 유입 인자를 가공하고 비즈니스 계약 조건에 맞춰 최종 객체/바이너리를 생산함.
   * - 예시: `DrawingBlockSpec(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
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
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `saveTimeoutRef`
       * - 자료형 / 예상 값: NodeJS.Timeout | null
       * - 시나리오: 드로잉 스트로크마다 에디터 업데이트가 연속으로 호출되는 것을 방지하는 디바운서 타이머 핸들.
       */
      const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
      // Canvas API 폴백용 캔버스 ref: Excalidraw 로드 실패 시 사용할 경량 스케치패드
      const fallbackCanvasRef = useRef<HTMLCanvasElement>(null)
      const isDrawingRef = useRef(false)
      const lastPosRef = useRef<{ x: number; y: number } | null>(null)

      useEffect(() => {
        setMounted(true)
        /*
         * [FIX-DRAWING-POLL] Excalidraw 로드 완료 폴링 (최대 5초 후 자동 중단)
         * - excalidrawFailed 플래그가 세워지거나, Excalidraw가 성공적으로 로드되면 폴링을 중단한다.
         */
        if (!Excalidraw && !excalidrawFailed) {
          const interval = setInterval(() => {
            if (Excalidraw) {
              setExcalidrawLoaded(true)
              clearInterval(interval)
            } else if (excalidrawFailed) {
              // 실패 플래그가 세워지면 폴백 뷰를 즉시 표시하기 위해 상태를 갱신한다.
              setExcalidrawLoaded(false)
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
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `saveTimeoutRef.current`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (saveTimeoutRef.current)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current)
        }
        saveTimeoutRef.current = setTimeout(() => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `stringified`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const stringified = ...` 형태로 안전 캐싱 후 가공 기동.
       */
          const stringified = JSON.stringify(elements)
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `stringified !== block.props.data`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (stringified !== block.props.data)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
          if (stringified !== block.props.data) {
            editor.updateBlock(block.id, {
              type: 'drawing',
              props: { data: stringified }
            })
          }
        }, 500)
      };

      /*
       * [FIX-DRAWING-FALLBACK] Excalidraw 로드 실패 시 Canvas API 기반 경량 스케치패드를 표시한다.
       * - excalidrawFailed가 true이고 mounted가 완료된 경우: 폴백 캔버스를 즉시 표시한다.
       * - 아직 로드 중인 경우: 로딩 스피너를 표시하고 완료 대기한다.
       */
      if (!mounted) {
        return (
          <div style={{
            height: '350px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: '#16161a', border: '1px dashed #2e2e38', borderRadius: '8px',
            color: 'var(--text-muted)', fontSize: '12px'
          }}>
            드로잉 모듈을 준비 중입니다...
          </div>
        )
      }

      // Excalidraw 로드 실패 시 표시할 Canvas API 기반 경량 스케치패드
      // [FIX-DRAWING-NULL-GUARD] excalidrawLoaded 상태와 무관하게, 실제 렌더 시점에
      // Excalidraw 참조가 null이면 크래시를 방지하기 위해 폴백으로 즉시 전환한다.
      if (excalidrawFailed || !Excalidraw || (!Excalidraw && !excalidrawLoaded)) {
        return (
          <div className="bn-block-content-wrapper" style={{
            width: '100%', backgroundColor: '#18181c', border: '1px solid #2e2e38',
            borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column', marginBottom: '10px'
          }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #2e2e38', display: 'flex', alignItems: 'center', gap: '6px', background: '#121215' }}>
              <FileImage size={14} style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#f8fafc' }}>Drawing Pad (경량 모드)</span>
              <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginLeft: 'auto' }}>마우스로 자유롭게 그리세요</span>
            </div>
            <canvas
              ref={fallbackCanvasRef}
              width={800}
              height={380}
              style={{ width: '100%', height: '380px', background: '#1e1e24', cursor: 'crosshair', display: 'block' }}
              onMouseDown={(e) => {
                isDrawingRef.current = true
                const rect = e.currentTarget.getBoundingClientRect()
                lastPosRef.current = { x: (e.clientX - rect.left) * (e.currentTarget.width / rect.width), y: (e.clientY - rect.top) * (e.currentTarget.height / rect.height) }
              }}
              onMouseMove={(e) => {
                if (!isDrawingRef.current || !lastPosRef.current) return
                const canvas = fallbackCanvasRef.current
                if (!canvas) return
                const ctx = canvas.getContext('2d')
                if (!ctx) return
                const rect = e.currentTarget.getBoundingClientRect()
                const x = (e.clientX - rect.left) * (canvas.width / rect.width)
                const y = (e.clientY - rect.top) * (canvas.height / rect.height)
                ctx.strokeStyle = '#a78bfa'
                ctx.lineWidth = 2
                ctx.lineCap = 'round'
                ctx.lineJoin = 'round'
                ctx.beginPath()
                ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y)
                ctx.lineTo(x, y)
                ctx.stroke()
                lastPosRef.current = { x, y }
              }}
              onMouseUp={() => { isDrawingRef.current = false; lastPosRef.current = null }}
              onMouseLeave={() => { isDrawingRef.current = false; lastPosRef.current = null }}
            />
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
            {/* [FIX-DRAWING-NULL-GUARD] Excalidraw 참조가 null일 경우 추가 안전 가드 적용.
               excalidrawLoaded 상태가 true로 갱신되었더라도 실제 컴포넌트 참조가 null이면
               렌더링 시점에 크래시가 발생하므로 이중 가드로 폴백 캔버스를 대신 표시한다. */}
          {!Excalidraw ? (
            <div style={{ height: '380px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
              드로잉 모듈 로드 중...
            </div>
          ) : isEditing ? (
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

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `DrawingBlock`
   * - 역할: 유입 인자를 가공하고 비즈니스 계약 조건에 맞춰 최종 객체/바이너리를 생산함.
   * - 예시: `DrawingBlock(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
export const DrawingBlock = DrawingBlockSpec()

