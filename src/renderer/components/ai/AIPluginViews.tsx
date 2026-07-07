
import React, { useEffect, useRef } from 'react'

export function AIPluginViews({ activeTab }: { activeTab: string }) {
  const pluginRefs = {
    calculator: useRef<HTMLDivElement>(null),
    finance: useRef<HTMLDivElement>(null),
    youtube: useRef<HTMLDivElement>(null),
    naver: useRef<HTMLDivElement>(null),
    google: useRef<HTMLDivElement>(null),
    calendar: useRef<HTMLDivElement>(null),
    'google-drive': useRef<HTMLDivElement>(null),
  }

  useEffect(() => {
    if (activeTab === 'ai' || activeTab === 'outline') return;
    const ref = pluginRefs[activeTab as keyof typeof pluginRefs];
    if (ref?.current) {
      const globalPlugins = (window as any).AMEVA_PLUGINS;
      if (globalPlugins?.[activeTab]) {
        try {
          globalPlugins[activeTab].render(ref.current.id);
        } catch (e) {
          console.error(`${activeTab} 플러그인 렌더링 실패:`, e);
        }
      }
    }
  }, [activeTab]);

  const containerStyle = {
    flex: 1, display: 'flex', flexDirection: 'column' as const,
    backgroundColor: 'var(--bg-main)', height: '100%', padding: '16px', overflowY: 'auto' as const
  };

  switch (activeTab) {
    case 'calculator': return <div id="ameva-plugin-calculator" style={containerStyle} ref={pluginRefs.calculator} />
    case 'finance': return <div id="ameva-plugin-finance-dashboard" style={containerStyle} ref={pluginRefs.finance} />
    case 'youtube': return <div id="ameva-plugin-youtube" style={containerStyle} ref={pluginRefs.youtube} />
    case 'naver': return <div id="ameva-plugin-naver" style={containerStyle} ref={pluginRefs.naver} />
    case 'google': return <div id="ameva-plugin-google" style={containerStyle} ref={pluginRefs.google} />
    case 'calendar': return <div id="ameva-plugin-calendar" style={containerStyle} ref={pluginRefs.calendar} />
    case 'google-drive': return <div id="ameva-plugin-google-drive" style={containerStyle} ref={pluginRefs['google-drive']} />
    default: return null;
  }
}
