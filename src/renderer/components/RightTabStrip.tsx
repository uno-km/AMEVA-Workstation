import { Sparkles, List, Calculator, TrendingUp, Play, Globe, Search, Calendar, HardDrive, Map } from 'lucide-react';
import React, { useState, useRef, useEffect, useCallback } from 'react';

import { useUIStore } from '../stores/useUIStore';
import { useAppContext } from '../contexts/AppContext';

export interface RightTabStripProps {}

function TabContextMenu({
  x, y, tabLabel, isTabOpen,
  onOpen, onClose, onCloseOthers, onDismiss
}: {
  x: number; y: number; tabId: string; tabLabel: string; isTabOpen: boolean
  onOpen: () => void; onClose: () => void; onCloseOthers: () => void; onDismiss: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const safeX = Math.min(x, window.innerWidth - 200);
  const safeY = Math.min(y, window.innerHeight - 140);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    };
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

export function RightTabStrip({}: RightTabStripProps = {}) {
  const { activeRightTab: activeTab, showAIPanel: isOpen, setShowAIPanel, setActiveRightTab, hasChatUnread } = useUIStore();
  const { settings, isProPlan } = useAppContext();
  const installedPlugins = settings?.installedPlugins || [];
  const hotkeys = settings?.hotkeys;

  const isDraggingRef = useRef(false);
  const dragStartPos = useRef({ x: 0, y: 0 });

  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; tabId: string; tabLabel: string
  } | null>(null);

  const onToggleTab = (tab: string) => {
    if (isOpen && activeTab === tab) {
      setShowAIPanel(false);
    } else {
      setActiveRightTab(tab);
      setShowAIPanel(true);
    }
  };

  const formatHotkey = (raw: string | undefined): string => {
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

  const hkeys = hotkeys || {
    save: 'Control+s', open: 'Control+o', newFile: 'Control+n',
    pdfExport: 'Control+p', toggleAI: 'Control+\\', toggleMode: 'Control+h',
    zoomIn: 'Control+=', zoomOut: 'Control+-', zoomReset: 'Control+0'
  };

  const isOutlineSubscribed = installedPlugins.includes('outline');
  const isCalculatorSubscribed = installedPlugins.includes('calculator');
  const isFinanceSubscribed = installedPlugins.includes('finance-dashboard');
  const isYoutubeSubscribed = installedPlugins.includes('youtube');
  const isNaverSubscribed = installedPlugins.includes('naver');
  const isGoogleSubscribed = installedPlugins.includes('google');
  const isCalendarSubscribed = installedPlugins.includes('calendar');
  const isGoogleDriveSubscribed = installedPlugins.includes('google-drive');
  const isGoogleMapsSubscribed = installedPlugins.includes('google-maps');

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

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isDraggingRef.current = false;
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    const onMove = (me: MouseEvent) => {
      const dx = me.clientX - dragStartPos.current.x;
      const dy = me.clientY - dragStartPos.current.y;
      if (Math.sqrt(dx * dx + dy * dy) > 5) {
        isDraggingRef.current = true;
      }
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

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
        const isActive = isOpen && activeTab === t.id;
        const Icon = t.icon;

        return (
          <button
            key={t.id}
            onMouseDown={handleMouseDown}
            onMouseUp={(e) => {
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
              if (!isActive) {
                e.currentTarget.style.color = 'var(--text-main)';
                e.currentTarget.style.background = 'var(--bg-glass-active)';
              }
            }}
            onMouseLeave={(e) => {
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
