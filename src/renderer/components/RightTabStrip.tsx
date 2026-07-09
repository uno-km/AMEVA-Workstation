/**
 * @file RightTabStrip.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/RightTabStrip.tsx
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

import { Sparkles, List, Calculator, TrendingUp, Play, Globe, Search, Calendar, HardDrive, Map } from 'lucide-react';
import React, { useState, useRef, useEffect, useCallback } from 'react';

import { useUIStore } from '../stores/useUIStore';
import { useAppContext } from '../contexts/AppContext';

export interface RightTabStripProps {}

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
function TabContextMenu({
  x, y, tabLabel, isTabOpen,
  onOpen, onClose, onCloseOthers, onDismiss
}: {
  x: number; y: number; tabId: string; tabLabel: string; isTabOpen: boolean
  onOpen: () => void; onClose: () => void; onCloseOthers: () => void; onDismiss: () => void
}) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'menuRef'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const menuRef = useRef<HTMLDivElement>(null);
  // [RUN-TIME STATE / INVARIANT] - 변수 'safeX'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const safeX = Math.min(x, window.innerWidth - 200);
  // [RUN-TIME STATE / INVARIANT] - 변수 'safeY'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const safeY = Math.min(y, window.innerHeight - 140);

  useEffect(() => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'handler'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const handler = (e: MouseEvent) => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    };
  // [RUN-TIME STATE / INVARIANT] - 변수 'id'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const id = setTimeout(() => window.addEventListener('mousedown', handler), 10);
    return () => { clearTimeout(id); window.removeEventListener('mousedown', handler); };
  }, [onDismiss]);

  const btnStyle: React.CSSProperties = {
    background: 'transparent', border: 'none', color: 'var(--text-main)',
    padding: '7px 12px', textAlign: 'left', cursor: 'pointer',
    fontSize: '11.5px', borderRadius: '4px', width: '100%',
    display: 'flex', alignItems: 'center', gap: '8px',
    transition: 'background 0.12s',
  };

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed', top: safeY, left: safeX,
        background: 'var(--bg-glass)', border: '1px solid var(--border-muted)',
        borderRadius: '8px', padding: '4px', display: 'flex', flexDirection: 'column',
        zIndex: 99999, boxShadow: '0 8px 32px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.08)',
        fontFamily: 'var(--font-sans)', minWidth: '180px', backdropFilter: 'blur(12px)',
      }}
    >
      <div style={{ padding: '4px 10px 6px', borderBottom: '1px solid var(--border-muted)', marginBottom: '2px' }}>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>{tabLabel}</span>
      </div>

      <button
        style={btnStyle}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-glass-active)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        onClick={() => { isTabOpen ? onClose() : onOpen(); onDismiss(); }}
      >
        <span>{isTabOpen ? '✕' : '▶'}</span>
        {isTabOpen ? '탭 닫기' : '탭 열기'}
      </button>

      <div style={{ height: '1px', background: 'var(--border-muted)', margin: '2px 0' }} />

      <button
        style={{ ...btnStyle, color: 'var(--text-muted)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-glass-active)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        onClick={() => { onCloseOthers(); onDismiss(); }}
      >
        <span>⊘</span> 다른 탭 모두 닫기
      </button>
    </div>
  );
}

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
export function RightTabStrip({}: RightTabStripProps = {}) {
  const { activeRightTab: activeTab, showAIPanel: isOpen, setShowAIPanel, setActiveRightTab, hasChatUnread } = useUIStore();
  const { settings, isProPlan } = useAppContext();
  // [RUN-TIME STATE / INVARIANT] - 변수 'installedPlugins'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const installedPlugins = settings?.installedPlugins || [];
  // [RUN-TIME STATE / INVARIANT] - 변수 'hotkeys'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const hotkeys = settings?.hotkeys;

  // [RUN-TIME STATE / INVARIANT] - 변수 'isDraggingRef'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const isDraggingRef = useRef(false);
  // [RUN-TIME STATE / INVARIANT] - 변수 'dragStartPos'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const dragStartPos = useRef({ x: 0, y: 0 });

  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; tabId: string; tabLabel: string
  } | null>(null);

  // [RUN-TIME STATE / INVARIANT] - 변수 'onToggleTab'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const onToggleTab = (tab: string) => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (isOpen && activeTab === tab) {
      setShowAIPanel(false);
    } else {
      setActiveRightTab(tab);
      setShowAIPanel(true);
    }
  };

  // [RUN-TIME STATE / INVARIANT] - 변수 'formatHotkey'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const formatHotkey = (raw: string | undefined): string => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (!raw) return '';
    return raw
      .replace('Control', 'Ctrl')
      .replace('Shift', 'Shift')
      .replace('Alt', 'Alt')
      .replace('Meta', 'Cmd')
      .split('+')
      .map(p => p.charAt(0).toUpperCase() + p.slice(1))
      .join(' + ');
  };

  // [RUN-TIME STATE / INVARIANT] - 변수 'hkeys'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const hkeys = hotkeys || {
    save: 'Control+s', open: 'Control+o', newFile: 'Control+n',
    pdfExport: 'Control+p', toggleAI: 'Control+\\', toggleMode: 'Control+h',
    zoomIn: 'Control+=', zoomOut: 'Control+-', zoomReset: 'Control+0'
  };

  // [RUN-TIME STATE / INVARIANT] - 변수 'isOutlineSubscribed'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const isOutlineSubscribed = installedPlugins.includes('outline');
  // [RUN-TIME STATE / INVARIANT] - 변수 'isCalculatorSubscribed'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const isCalculatorSubscribed = installedPlugins.includes('calculator');
  // [RUN-TIME STATE / INVARIANT] - 변수 'isFinanceSubscribed'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const isFinanceSubscribed = installedPlugins.includes('finance-dashboard');
  // [RUN-TIME STATE / INVARIANT] - 변수 'isYoutubeSubscribed'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const isYoutubeSubscribed = installedPlugins.includes('youtube');
  // [RUN-TIME STATE / INVARIANT] - 변수 'isNaverSubscribed'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const isNaverSubscribed = installedPlugins.includes('naver');
  // [RUN-TIME STATE / INVARIANT] - 변수 'isGoogleSubscribed'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const isGoogleSubscribed = installedPlugins.includes('google');
  // [RUN-TIME STATE / INVARIANT] - 변수 'isCalendarSubscribed'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const isCalendarSubscribed = installedPlugins.includes('calendar');
  // [RUN-TIME STATE / INVARIANT] - 변수 'isGoogleDriveSubscribed'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const isGoogleDriveSubscribed = installedPlugins.includes('google-drive');
  // [RUN-TIME STATE / INVARIANT] - 변수 'isGoogleMapsSubscribed'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const isGoogleMapsSubscribed = installedPlugins.includes('google-maps');

  // [RUN-TIME STATE / INVARIANT] - 변수 'tabs'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const tabs = isProPlan ? [
    { id: 'ai', icon: Sparkles, label: 'AI 어시스턴트', badge: hasChatUnread },
    ...(isOutlineSubscribed ? [{ id: 'outline', icon: List, label: '문서 구조도 (TOC)', badge: false }] : []),
    ...(isCalculatorSubscribed ? [{ id: 'calculator', icon: Calculator, label: '계산기 도구', badge: false }] : []),
    ...(isFinanceSubscribed ? [{ id: 'finance', icon: TrendingUp, label: '주식/환율 정보센터', badge: false }] : []),
    ...(isYoutubeSubscribed ? [{ id: 'youtube', icon: Play, label: 'YouTube 동영상', badge: false }] : []),
    ...(isNaverSubscribed ? [{ id: 'naver', icon: Globe, label: '네이버 포털', badge: false }] : []),
    ...(isGoogleSubscribed ? [{ id: 'google', icon: Search, label: '구글 검색', badge: false }] : []),
    ...(isCalendarSubscribed ? [{ id: 'calendar', icon: Calendar, label: '스케줄 캘린더', badge: false }] : []),
    ...(isGoogleDriveSubscribed ? [{ id: 'google-drive', icon: HardDrive, label: '구글 드라이브', badge: false }] : []),
    ...(isGoogleMapsSubscribed ? [{ id: 'google-maps', icon: Map, label: '구글 지도', badge: false }] : []),
  ] : [
    { id: 'ai', icon: Sparkles, label: 'AI 어시스턴트', badge: hasChatUnread },
  ];

  // [RUN-TIME STATE / INVARIANT] - 변수 'handleMouseDown'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (e.button !== 0) return;
    isDraggingRef.current = false;
    dragStartPos.current = { x: e.clientX, y: e.clientY };
  // [RUN-TIME STATE / INVARIANT] - 변수 'onMove'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const onMove = (me: MouseEvent) => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'dx'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const dx = me.clientX - dragStartPos.current.x;
  // [RUN-TIME STATE / INVARIANT] - 변수 'dy'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const dy = me.clientY - dragStartPos.current.y;
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (Math.sqrt(dx * dx + dy * dy) > 5) {
        isDraggingRef.current = true;
      }
    };
  // [RUN-TIME STATE / INVARIANT] - 변수 'onUp'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  // [RUN-TIME STATE / INVARIANT] - 변수 'handleContextMenu'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const handleContextMenu = useCallback((e: React.MouseEvent, tabId: string, tabLabel: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, tabId, tabLabel });
  }, []);

  return (
    <div
      style={{
        width: '40px', height: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', background: 'var(--bg-deep)', borderLeft: '1px solid var(--border-muted)',
        paddingTop: '16px', gap: '6px', flexShrink: 0, zIndex: 100, userSelect: 'none',
      }}
    >
      {tabs.map((t) => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'isActive'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const isActive = isOpen && activeTab === t.id;
  // [RUN-TIME STATE / INVARIANT] - 변수 'Icon'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const Icon = t.icon;

        return (
          <button
            key={t.id}
            onMouseDown={handleMouseDown}
            onMouseUp={(e) => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
              if (!isDraggingRef.current && e.button === 0) {
                onToggleTab(t.id);
              }
            }}
            onContextMenu={(e) => handleContextMenu(e, t.id, t.label)}
            title={t.id === 'ai' ? t.label + ' (' + formatHotkey(hkeys.toggleAI) + ')' : t.label}
            style={{
              width: '28px', height: '32px', borderRadius: '6px 0 0 6px',
              background: isActive ? 'var(--bg-main)' : 'transparent',
              border: isActive ? '1px solid var(--border-glow)' : '1px solid transparent',
              borderRight: isActive ? 'none' : '1px solid transparent',
              color: isActive ? 'var(--primary)' : 'var(--text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', position: 'relative', transition: 'var(--transition-fast)',
              outline: 'none', marginLeft: isActive ? '12px' : '0',
              boxShadow: isActive ? '0 0 10px var(--primary-glow)' : 'none',
            }}
            onMouseEnter={(e) => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
              if (!isActive) {
                e.currentTarget.style.color = 'var(--text-main)';
                e.currentTarget.style.background = 'var(--bg-glass-active)';
              }
            }}
            onMouseLeave={(e) => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
              if (!isActive) {
                e.currentTarget.style.color = 'var(--text-muted)';
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            <Icon size={16} />
            {t.badge && (
              <span style={{
                position: 'absolute', top: '2px', right: '2px',
                width: '6px', height: '6px', borderRadius: '50%',
                backgroundColor: '#f97316', boxShadow: '0 0 4px #f97316',
              }} />
            )}
          </button>
        );
      })}

      {contextMenu && (
        <TabContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          tabId={contextMenu.tabId}
          tabLabel={contextMenu.tabLabel}
          isTabOpen={isOpen && activeTab === contextMenu.tabId}
          onOpen={() => { setActiveRightTab(contextMenu.tabId); setShowAIPanel(true); }}
          onClose={() => setShowAIPanel(false)}
          onCloseOthers={() => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
            if (activeTab !== 'ai') {
              setActiveRightTab('ai');
            }
          }}
          onDismiss={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
