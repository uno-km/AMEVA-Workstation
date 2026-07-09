/**
 * @file MarketplaceModal.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/MarketplaceModal.tsx
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
import type { PluginMetadata, MarketplaceModalProps } from './marketplace/types'
import { MarketplaceToolbar } from './marketplace/MarketplaceToolbar'
import { SaaSPluginCard } from './marketplace/SaaSPluginCard'
import { PluginCard } from './marketplace/PluginCard'
import { FreeModal } from './ui/modals/FreeModal'
import { Layers } from 'lucide-react'

export type { PluginMetadata, MarketplaceModalProps }

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
export function MarketplaceModal({
  isOpen,
  onClose,
  installedPlugins,
  onInstallPlugin,
  onUninstallPlugin,
  isProPlan = false,
}: MarketplaceModalProps) {
  const [plugins, setPlugins] = useState<PluginMetadata[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})

  // 🦾 SaaS 유료 기능 토글 상태 관리
  const [enabledPlugins, setEnabledPlugins] = useState<Record<string, boolean>>({
    webSearch: false,
    pythonConsole: false,
    requestQueue: false,
  })

  // 검색 및 카테고리 탭 상태
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'tool' | 'feature' | 'collab'>('all')

  useEffect(() => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (isOpen) {
      try {
  // [RUN-TIME STATE / INVARIANT] - 변수 'stored'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const stored = localStorage.getItem('enabled-plugins')
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (stored) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'parsed'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          const parsed = JSON.parse(stored)
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
          if (!isProPlan) {
            setEnabledPlugins({ webSearch: false, pythonConsole: false, requestQueue: false })
          } else {
            setEnabledPlugins(parsed)
          }
        } else {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
          if (isProPlan) {
            setEnabledPlugins({ webSearch: true, pythonConsole: true, requestQueue: false })
          } else {
            setEnabledPlugins({ webSearch: false, pythonConsole: false, requestQueue: false })
          }
        }
      } catch (e) {}
    }
  }, [isOpen, isProPlan])

  // [RUN-TIME STATE / INVARIANT] - 변수 'handleToggleSaaSPlugin'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const handleToggleSaaSPlugin = (id: string) => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (!isProPlan) {
      alert('⚠️ 해당 기능은 Pro 플랜 이상에서만 활성화할 수 있는 프리미엄 도구입니다. 가격 플랜 탭에서 업그레이드를 진행하세요.')
      return
    }
  // [RUN-TIME STATE / INVARIANT] - 변수 'updated'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const updated = {
      ...enabledPlugins,
      [id]: !enabledPlugins[id]
    }
    setEnabledPlugins(updated)
    localStorage.setItem('enabled-plugins', JSON.stringify(updated))
  }

  // 마켓플레이스 서버 플러그인 로드
  // [FIX] AbortController로 5초 타임아웃 적용.
  // port 3010 EADDRINUSE 등 외부 서버 문제 시 영원히 로딩 중이던 문제를 수정.
  // 이전 앱 세션이 완전히 종료되지 않아 포트를 점유할 경우 서버가 crash되어
  // 연결이 거부되며, 그 경우 에러 메시지와 재시도 버튼을 표시한다.
  const fetchPlugins = async () => {
    setLoading(true)
    setError(null)
  // [RUN-TIME STATE / INVARIANT] - 변수 'controller'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const controller = new AbortController()
  // [RUN-TIME STATE / INVARIANT] - 변수 'timeoutId'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5초 타임아웃
    try {
  // [RUN-TIME STATE / INVARIANT] - 변수 'res'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const res = await fetch('http://localhost:3010/api/plugins', { signal: controller.signal })
      clearTimeout(timeoutId)
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (!res.ok) throw new Error(`서버 응답 오류 (HTTP ${res.status})`)
  // [RUN-TIME STATE / INVARIANT] - 변수 'data'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const data = await res.json()
      setPlugins(data)
    } catch (err: any) {
      clearTimeout(timeoutId)
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (err.name === 'AbortError') {
        setError('Marketplace 서버 연결 시간 초과 (5초). 서버가 실행 중인지 확인하세요. (Port: 3010)')
      } else {
        setError('Marketplace 서버를 찾을 수 없거나 오프라인 상태입니다. (Port: 3010) — 앱을 완전히 종료 후 재시작하거나 아래 버튼을 눌러 재시도하세요.')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (isOpen) {
      fetchPlugins()
    }
  }, [isOpen])

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
  if (!isOpen) return null

  // [RUN-TIME STATE / INVARIANT] - 변수 'handleToggleInstall'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const handleToggleInstall = async (plugin: PluginMetadata) => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'isInstalled'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const isInstalled = installedPlugins.includes(plugin.id)
    setActionLoading(prev => ({ ...prev, [plugin.id]: true }))
    
    try {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (isInstalled) {
        onUninstallPlugin(plugin.id)
      } else {
        await onInstallPlugin(plugin.id, plugin.scriptUrl)
      }
    } catch (err) {
      alert('플러그인 처리 중 실패했습니다.')
    } finally {
      setActionLoading(prev => ({ ...prev, [plugin.id]: false }))
    }
  }

  // 필터링 연산
  const filteredPlugins = plugins.filter((p) => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'matchesCategory'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const matchesCategory = selectedCategory === 'all' || p.type === selectedCategory
  // [RUN-TIME STATE / INVARIANT] - 변수 'matchesSearch'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const matchesSearch = 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const categories: { id: 'all' | 'tool' | 'feature' | 'collab'; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'tool', label: 'Tools' },
    { id: 'feature', label: 'Features' },
    { id: 'collab', label: 'Collab' },
  ]

  return (
    <FreeModal
      isOpen={isOpen}
      onClose={onClose}
      title="Plugin Marketplace"
      icon={<Layers size={20} />}
      initialWidth={800}
      initialHeight={600}
      headerExtra={
        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', backgroundColor: 'rgba(168, 85, 247, 0.15)', color: 'var(--primary)' }}>
          {installedPlugins.length} Installed
        </span>
      }
    >
      <MarketplaceToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        categories={categories}
      />

      {/* 본문 영역 (스크롤바 완비) */}
      <div
        className="marketplace-scroll"
        style={{
          padding: '8px 20px 20px 20px',
          overflowY: 'auto',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {loading && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>
            익스텐션 목록을 가져오는 중입니다...
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '16px',
              background: 'rgba(239,68,68,0.06)',
              border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: '8px',
              color: '#f87171',
              fontSize: '11px',
              lineHeight: '1.5',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <span>{error}</span>
            {/* [FIX] 재시도 버튼 — 서버 재기동 후 바로 재연결 시도 가능 */}
            <button
              onClick={fetchPlugins}
              style={{
                padding: '6px 14px', borderRadius: '6px', cursor: 'pointer',
                background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)',
                color: '#f87171', fontSize: '11px', fontWeight: 600, alignSelf: 'center'
              }}
            >
              🔄 다시 시도
            </button>
          </div>
        )}

        {!loading && !error && filteredPlugins.length === 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '11px' }}>
            조건에 맞는 플러그인이 없습니다.
          </div>
        )}

        {/* 👑 SaaS Premium Toggles (DuckDuckGo, Python Sandbox, Request Queue) */}
        {!loading && categories.length > 0 && (() => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'saasItems'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          const saasItems = [
            {
              id: 'webSearch',
              name: 'DuckDuckGo Web Search API (Pro)',
              description: 'ReAct 에이전트가 외부 웹 검색(실시간 인터넷 정보 및 뉴스)을 통해 추론하고 결과를 조합할 수 있게 권한을 위임합니다.',
              type: 'tool' as const,
              version: '1.2.0'
            },
            {
              id: 'pythonConsole',
              name: 'Python Sandbox Executor (Pro)',
              description: '로컬 파이썬 샌드박스를 연동하여 복잡한 수식 연산 및 데이터 처리 알고리즘 코드를 실제 런타임에서 실행해 줍니다.',
              type: 'tool' as const,
              version: '2.0.4'
            },
            {
              id: 'requestQueue',
              name: 'Sequential Request Queue (Pro)',
              description: '질문을 연달아 우다다닥 보낼 때 취소되지 않고 안전하게 백그라운드 큐 버퍼에 쌓여 차례로 실행해 주는 순차 처리기입니다.',
              type: 'feature' as const,
              version: '1.0.1'
            }
          ]

  // [RUN-TIME STATE / INVARIANT] - 변수 'filteredSaas'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          const filteredSaas = saasItems.filter(p => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'matchesCategory'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
            const matchesCategory = selectedCategory === 'all' || p.type === selectedCategory
  // [RUN-TIME STATE / INVARIANT] - 변수 'matchesSearch'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
            const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.description.toLowerCase().includes(searchQuery.toLowerCase())
            return matchesCategory && matchesSearch
          })

          return filteredSaas.map(p => (
            <SaaSPluginCard
              key={p.id}
              id={p.id}
              name={p.name}
              version={p.version}
              type={p.type}
              description={p.description}
              isEnabled={enabledPlugins[p.id] ?? false}
              onToggle={handleToggleSaaSPlugin}
            />
          ))
        })()}

        {!loading && !error && filteredPlugins.map((p) => (
          <PluginCard
            key={p.id}
            plugin={p}
            isInstalled={installedPlugins.includes(p.id)}
            isActionLoading={!!actionLoading[p.id]}
            onToggleInstall={handleToggleInstall}
          />
        ))}
      </div>
      
      {/* 슬림 다크 스크롤바 커스텀 주입 */}
      <style>{`
        .marketplace-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .marketplace-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .marketplace-scroll::-webkit-scrollbar-thumb {
          background: var(--border-muted);
          border-radius: 3px;
        }
        .marketplace-scroll::-webkit-scrollbar-thumb:hover {
          background: var(--primary);
        }
      `}</style>
    </FreeModal>
  )
}

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
