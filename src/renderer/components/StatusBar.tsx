import React, { useState, useRef } from 'react'
import { Settings, ZoomIn, WrapText } from 'lucide-react'
import { AIStatusIndicator } from './statusbar/AIStatusIndicator'
import { MCPStatusIndicator } from './statusbar/MCPStatusIndicator'
import { DocStatusIndicator } from './statusbar/DocStatusIndicator'
import { CollabIndicator } from './statusbar/CollabIndicator'

import { useAppContext } from '../contexts/AppContext'
import { useUIStore } from '../stores/useUIStore'
import { useWorkspaceStore } from '../stores/useWorkspaceStore'
import { useProcessStore } from '../stores/useProcessStore'
import { useAI } from '../hooks/useAI'

export interface StatusBarProps {}

export function StatusBar({}: StatusBarProps = {}) {
  const { peers, serverRunning, settings, handleUpdateSettings, mcpServers, isProPlan } = useAppContext()
  const { setIsSettingsOpen } = useUIStore()
  const { editorZoom: zoomLevel, browserZoom = 1.0 } = useProcessStore()
  const { filePath, currentContent, lastSavedTime, originalContent } = useWorkspaceStore()
  const { downloadStatus } = useProcessStore()
  const { settings: aiSettings, isAvailable: aiAvailable } = useAI()
  
  const wordWrap = settings?.wordWrap || false
  const onToggleWordWrap = () => handleUpdateSettings({ wordWrap: !wordWrap })
  const onOpenSettings = () => setIsSettingsOpen(true)
  const isDirty = currentContent !== originalContent
  // 🦾 커스텀 툴팁 상태 관리
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null)
  const tooltipTimerRef = useRef<any>(null)

  const handleMouseEnter = (id: string) => {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current)
    setActiveTooltip(id)
  }

  const handleMouseLeave = () => {
    tooltipTimerRef.current = setTimeout(() => {
      setActiveTooltip(null)
    }, 250)
  }

  // 글자 수, 단어 수, 줄 수 계산
  const charCount = currentContent.length
  const wordCount = currentContent.trim() ? currentContent.trim().split(/\s+/).length : 0
  const lineCount = currentContent ? currentContent.split('\n').length : 0

  // 공통 커스텀 툴팁 스타일 (글래스모피즘 + 섀도우)
  const tooltipStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '32px',
    background: 'rgba(15, 15, 20, 0.88)',
    backdropFilter: 'blur(14px)',
    border: '1px solid rgba(139, 92, 246, 0.35)',
    boxShadow: '0 10px 30px rgba(0,0,0,0.65), inset 0 1px 1px rgba(255,255,255,0.05)',
    borderRadius: '8px',
    padding: '12px 14px',
    zIndex: 9999,
    pointerEvents: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    textAlign: 'left',
    color: 'var(--text-main)',
    fontFamily: 'var(--font-sans)',
  }
  
  // zoomLevel은 이제 CSS zoom 배율 (1.0 = 100%, 0.5 = 50%, 2.0 = 200%)
  const zoomPercent = Math.round(zoomLevel * 100)

  return (
    <div
      className="glass-panel"
      style={{
        height: '28px',
        width: '100%',
        borderTop: '1px solid var(--border-muted)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        backgroundColor: 'var(--bg-main)',
        color: 'var(--text-main)',
        zIndex: 101,
        userSelect: 'none',
      }}
    >
      {/* 1. 파일 상태 정보 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <DocStatusIndicator 
          filePath={filePath}
          isDirty={isDirty}
          lastSavedTime={lastSavedTime}
          activeTooltip={activeTooltip}
          setActiveTooltip={setActiveTooltip}
          tooltipStyle={tooltipStyle}
        />
        <div style={{ width: '1px', height: '12px', backgroundColor: 'var(--border-muted)' }} />
        <span>
          줄 수: <strong>{lineCount}</strong>줄 | 공백 포함: <strong>{charCount}</strong>자 | 단어: <strong>{wordCount}</strong>개
        </span>
      </div>

      {/* 📥 모델 다운로드 실시간 진행률 표시 */}
      {downloadStatus && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(6, 182, 212, 0.08)',
          border: '1px solid rgba(6, 182, 212, 0.25)',
          borderRadius: '6px',
          padding: '2px 10px',
          color: 'var(--secondary)',
          fontWeight: 600,
          fontSize: '10.5px',
          height: '20px',
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            📥 {downloadStatus.filename?.split(/[\\/]/).pop()}: {downloadStatus.progress}%
          </span>
          <div style={{ width: '70px', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: `${downloadStatus.progress}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary), var(--secondary))' }} />
          </div>
          <span style={{ fontSize: '9px', opacity: 0.85 }}>({downloadStatus.speed || 0} MB/s)</span>
        </div>
      )}

      {/* 2. 우측 제어 및 단축키 안내 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* MCP 서버 상태 뱃지 */}
        <MCPStatusIndicator 
          isProPlan={isProPlan}
          mcpServers={mcpServers || []}
          activeTooltip={activeTooltip}
          handleMouseEnter={handleMouseEnter}
          handleMouseLeave={handleMouseLeave}
          tooltipStyle={tooltipStyle}
        />
        {isProPlan && mcpServers && mcpServers.length > 0 && <div style={{ width: '1px', height: '12px', backgroundColor: 'var(--border-muted)' }} />}

        {/* AI 에이전트 서버 상태 뱃지 */}
        <AIStatusIndicator 
          aiSettings={aiSettings}
          aiAvailable={aiAvailable}
          activeTooltip={activeTooltip}
          handleMouseEnter={handleMouseEnter}
          handleMouseLeave={handleMouseLeave}
          tooltipStyle={tooltipStyle}
        />
        {aiSettings && <div style={{ width: '1px', height: '12px', backgroundColor: 'var(--border-muted)' }} />}

        {/* 협업 상태 및 피어 아바타 목록 */}
        {serverRunning && (
          <CollabIndicator peers={peers} />
        )}

        {serverRunning && <div style={{ width: '1px', height: '12px', backgroundColor: 'var(--border-muted)' }} />}

        {/* 상하좌우 고정 기능 (줄바꿈 방지 토글) */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            cursor: 'pointer',
            color: !wordWrap ? 'var(--secondary)' : 'var(--text-muted)',
            fontWeight: !wordWrap ? 600 : 400,
            transition: 'var(--transition-fast)',
          }}
          title="줄바꿈을 끄고 본문을 한 줄로 길게 보이며 가로 스크롤을 활성화합니다."
        >
          <input
            type="checkbox"
            checked={!wordWrap}
            onChange={onToggleWordWrap}
            style={{ cursor: 'pointer', accentColor: 'var(--secondary)' }}
          />
          <WrapText size={12} />
          <span>줄바꿈 비활성화 (가로 스크롤)</span>
        </label>

        <div style={{ width: '1px', height: '12px', backgroundColor: 'var(--border-muted)' }} />

        {/* 줌 배율 — 문서(CSS zoom) + UI(브라우저 zoom) 분리 표시 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <ZoomIn size={12} />
          <span>
            문서: <strong>{zoomPercent}%</strong>
            {browserZoom !== 1.0 && (
              <span style={{ color: 'var(--secondary)', marginLeft: '6px' }}>
                UI: <strong>{Math.round(browserZoom * 100)}%</strong>
              </span>
            )}
          </span>
        </div>

        <div style={{ width: '1px', height: '12px', backgroundColor: 'var(--border-muted)' }} />

        {/* 환경 설정 버튼 */}
        <button
          onClick={onOpenSettings}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-main)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 4px',
            borderRadius: '4px',
            transition: 'var(--transition-fast)',
          }}
          title="환경 설정"
        >
          <Settings size={12} style={{ color: 'var(--primary)' }} />
          <span>설정</span>
        </button>
      </div>
    </div>
  )
}
