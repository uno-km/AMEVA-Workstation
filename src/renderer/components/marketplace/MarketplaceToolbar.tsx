import { Search } from 'lucide-react'

interface MarketplaceToolbarProps {
  searchQuery: string
  onSearchChange: (val: string) => void
  selectedCategory: 'all' | 'tool' | 'feature' | 'collab'
  onCategoryChange: (val: 'all' | 'tool' | 'feature' | 'collab') => void
  categories: { id: 'all' | 'tool' | 'feature' | 'collab'; label: string }[]
}

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
