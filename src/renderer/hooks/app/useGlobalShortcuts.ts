/**
 * useGlobalShortcuts.ts
 *
 * 전역 키보드 단축키(Hotkey) 처리 전담 훅.
 * App.tsx에 인라인으로 정의되어 있던 keydown/wheel 이벤트 핸들러를 격리한다.
 *
 * [포함 로직]
 * - Ctrl+S: 파일 저장
 * - Ctrl+O: 파일 열기
 * - Ctrl+N: 새 탭
 * - Ctrl+P: PDF 내보내기
 * - Ctrl+E: 에디터/미리보기 전환
 * - Ctrl+\: AI 패널 토글
 * - Ctrl+=/-/0: 에디터 줌 인/아웃/리셋
 * - Ctrl+Wheel: 에디터/사이드바 영역에 따라 다른 줌 동작
 * - F11: 전체화면
 * - 커스텀 핫키: settings.hotkeys 바인딩
 */

import { useEffect, useCallback } from 'react'
import { useProcessStore } from '../../stores/useProcessStore'
import type { AppSettings, HotkeyConfig } from '../../components/SettingsModal'
import type { EditorMode } from '../../../shared/types'

/** useGlobalShortcuts 파라미터 타입 */
export interface GlobalShortcutsParams {
  /** 현재 앱 설정 */
  settings: AppSettings
  /** 현재 에디터 인스턴스 */
  editor: any
  /** 현재 파일 경로 */
  filePath: string | null
  /** 현재 콘텐츠 */
  currentContent: string
  /** 현재 에디터 모드 */
  editorMode: EditorMode
  /** 저장 핸들러 */
  onSave: () => Promise<void>
  /** 열기 핸들러 */
  onOpen: () => Promise<void>
  /** 새 탭 핸들러 */
  onNewTab: () => void
  /** AI 패널 토글 핸들러 */
  onToggleAI: () => void
  /** 에디터 모드 전환 핸들러 */
  onToggleMode: () => void
  /** 줌 인 핸들러 */
  onZoomIn: () => void
  /** 줌 아웃 핸들러 */
  onZoomOut: () => void
  /** 줌 리셋 핸들러 */
  onZoomReset: () => void
}

/** matchHotkey 유틸: 키 이벤트와 단축키 문자열 비교 */
function matchHotkey(e: KeyboardEvent, hotkey: string): boolean {
  const parts = hotkey.toLowerCase().split('+')
  const key = parts[parts.length - 1]
  const needsCtrl = parts.includes('control') || parts.includes('ctrl')
  const needsShift = parts.includes('shift')
  const needsAlt = parts.includes('alt')

  if (needsCtrl && !e.ctrlKey) return false
  if (needsShift && !e.shiftKey) return false
  if (needsAlt && !e.altKey) return false

  const eKey = e.key.toLowerCase()
  return eKey === key || (key === '\\' && eKey === '\\')
}

/**
 * useGlobalShortcuts
 * window keydown 이벤트 리스너와 wheel 줌 이벤트 리스너를 등록한다.
 */
export function useGlobalShortcuts(params: GlobalShortcutsParams) {
  const {
    settings,
    onSave, onOpen, onNewTab, onToggleAI, onToggleMode,
    onZoomIn, onZoomOut, onZoomReset
  } = params

  const { adjustEditorZoom, setBrowserZoom } = useProcessStore()

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const hotkeys: HotkeyConfig = settings.hotkeys || {
      save: 'Control+s', open: 'Control+o', newFile: 'Control+n',
      pdfExport: 'Control+p', toggleAI: 'Control+\\', toggleMode: 'Control+e',
      zoomIn: 'Control+=', zoomOut: 'Control+-', zoomReset: 'Control+0'
    }

    // F11 — 전체화면 토글
    if (e.key === 'F11') {
      e.preventDefault()
      if (document.fullscreenElement) document.exitFullscreen()
      else document.documentElement.requestFullscreen()
      return
    }

    if (matchHotkey(e, hotkeys.save || 'Control+s')) {
      e.preventDefault()
      onSave()
    } else if (matchHotkey(e, hotkeys.open || 'Control+o')) {
      e.preventDefault()
      onOpen()
    } else if (matchHotkey(e, hotkeys.newFile || 'Control+n')) {
      e.preventDefault()
      onNewTab()
    } else if (matchHotkey(e, hotkeys.toggleAI || 'Control+\\')) {
      e.preventDefault()
      onToggleAI()
    } else if (matchHotkey(e, hotkeys.toggleMode || 'Control+e')) {
      e.preventDefault()
      onToggleMode()
    } else if (matchHotkey(e, hotkeys.zoomIn || 'Control+=')) {
      e.preventDefault()
      onZoomIn()
    } else if (matchHotkey(e, hotkeys.zoomOut || 'Control+-')) {
      e.preventDefault()
      onZoomOut()
    } else if (matchHotkey(e, hotkeys.zoomReset || 'Control+0')) {
      e.preventDefault()
      onZoomReset()
    }
  }, [settings.hotkeys, onSave, onOpen, onNewTab, onToggleAI, onToggleMode, onZoomIn, onZoomOut, onZoomReset])

  const handleWheelZoom = useCallback((e: WheelEvent) => {
    if (!e.ctrlKey) return

    const editorWrapper = document.querySelector('.editor-zoom-wrapper')
    const isInsideEditor = editorWrapper?.contains(e.target as Node) ?? false

    if (isInsideEditor) {
      // 에디터 내부: CSS zoom으로 처리
      e.preventDefault()
      const delta = e.deltaY < 0 ? 0.1 : -0.1
      adjustEditorZoom(delta)
    } else {
      // 에디터 외부: Electron webFrame zoom
      if ((window as any).electronAPI?.setZoomFactor) {
        e.preventDefault()
        const step = e.deltaY < 0 ? 0.1 : -0.1
        const prev = useProcessStore.getState().browserZoom
        const next = Math.min(3.0, Math.max(0.3, Math.round((prev + step) * 10) / 10))
        setBrowserZoom(next)
        ;(window as any).electronAPI.setZoomFactor(next)
      }
      // 일반 브라우저 환경: 브라우저 기본 줌 동작에 위임
    }
  }, [adjustEditorZoom, setBrowserZoom])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('wheel', handleWheelZoom, { passive: false })
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('wheel', handleWheelZoom)
    }
  }, [handleKeyDown, handleWheelZoom])
}
