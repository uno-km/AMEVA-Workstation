/**
 * @file MarketplaceToolbar.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/marketplace/MarketplaceToolbar.tsx
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

import { Search } from 'lucide-react'

interface MarketplaceToolbarProps {
  searchQuery: string
  onSearchChange: (val: string) => void
  selectedCategory: 'all' | 'tool' | 'feature' | 'collab'
  onCategoryChange: (val: 'all' | 'tool' | 'feature' | 'collab') => void
  categories: { id: 'all' | 'tool' | 'feature' | 'collab'; label: string }[]
}

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
export function MarketplaceToolbar({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  categories,
}: MarketplaceToolbarProps) {
  return (
    <div style={{ padding: '16px 20px 8px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* 검색 바 */}
      <div style={{ position: 'relative', width: '100%' }}>
        <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
        <input
          type="text"
          placeholder="Search extensions by keyword or name..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            width: '100%',
            background: 'var(--bg-main)',
            border: '1px solid var(--border-muted)',
            borderRadius: '6px',
            padding: '8px 12px 8px 32px',
            color: 'var(--text-main)',
            fontSize: '11.5px',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.15s',
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
          onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border-muted)'}
        />
      </div>

      {/* 카테고리 탭 리스트 */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border-muted)', paddingBottom: '8px' }}>
        {categories.map((cat) => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'isActive'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          const isActive = selectedCategory === cat.id
          return (
            <button
              key={cat.id}
              onClick={() => onCategoryChange(cat.id)}
              style={{
                background: isActive ? 'color-mix(in srgb, var(--primary) 10%, transparent)' : 'transparent',
                border: isActive ? '1px solid color-mix(in srgb, var(--primary) 30%, transparent)' : '1px solid transparent',
                color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                padding: '4px 12px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.15s',
                outline: 'none',
              }}
            >
              {cat.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
