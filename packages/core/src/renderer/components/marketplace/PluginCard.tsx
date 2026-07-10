/**
 * @file PluginCard.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/marketplace/PluginCard.tsx
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

import { Check } from 'lucide-react'
import type { PluginMetadata } from './types'

interface PluginCardProps {
  plugin: PluginMetadata
  isInstalled: boolean
  isActionLoading: boolean
  onToggleInstall: (plugin: PluginMetadata) => void
}

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `PluginCard`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `PluginCard(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
export function PluginCard({
  plugin: p,
  isInstalled,
  isActionLoading,
  onToggleInstall,
}: PluginCardProps) {
  return (
    <div
      style={{
        padding: '14px 16px',
        background: 'var(--bg-main)',
        border: '1px solid var(--border-muted)',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--primary)'
        e.currentTarget.style.boxShadow = '0 0 8px color-mix(in srgb, var(--primary) 10%, transparent)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-muted)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
          <span style={{ fontSize: '12.5px', fontWeight: 'bold', color: 'var(--text-main)' }}>
            {p.name}
          </span>
          <span style={{ fontSize: '9px', color: 'var(--text-muted)', background: 'var(--bg-panel)', padding: '1px 5px', borderRadius: '4px' }}>
            v{p.version}
          </span>
          <span style={{
            fontSize: '9px',
            color: p.type === 'tool' ? '#f59e0b' : p.type === 'feature' ? '#06b6d4' : '#ec4899',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.05)',
            padding: '1px 5px',
            borderRadius: '4px',
            textTransform: 'uppercase',
            fontWeight: 700,
            letterSpacing: '0.3px'
          }}>
            {p.type}
          </span>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
          {p.description}
        </div>
      </div>

      <button
        onClick={() => onToggleInstall(p)}
        disabled={isActionLoading}
        style={{
          padding: '5px 12px',
          borderRadius: '6px',
          fontSize: '11px',
          fontWeight: 'bold',
          cursor: isActionLoading ? 'not-allowed' : 'pointer',
          background: isInstalled ? 'rgba(16,185,129,0.12)' : 'var(--primary)',
          border: isInstalled ? '1px solid rgba(16,185,129,0.3)' : '1px solid transparent',
          color: isInstalled ? '#34d399' : '#000',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          transition: 'all 0.15s',
          outline: 'none',
          flexShrink: 0
        }}
      >
        {isInstalled ? (
          <>
            <Check size={11} />
            Installed
          </>
        ) : (
          'Subscribe'
        )}
      </button>
    </div>
  )
}

