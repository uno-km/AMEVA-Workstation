import { useEffect } from 'react';
import type { EditorMode } from '../../../shared/types';

export interface MenuBarShortcutsOptions {
  isAltMode: boolean;
  activeMenu: string | null;
  editorMode: EditorMode;
  showStatusBar: boolean;
  showSidebar: boolean;
  showConsole: boolean;
  isProPlan: boolean;
  
  setIsAltMode: React.Dispatch<React.SetStateAction<boolean>>;
  setActiveMenu: (menu: string | null) => void;
  triggerAction: (action?: () => void) => void;
  
  onNewWindow: () => void;
  onOpenFile: () => void;
  onSaveFile: () => void;
  onSaveAs: () => void;
  onPrint: () => void;
  onCloseApp: () => void;
  
  setEditorMode: (mode: EditorMode) => void;
  setShowStatusBar: (val: boolean) => void;
  setShowSidebar: (val: boolean) => void;
  setShowConsole: (val: boolean) => void;
  
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onToggleFullscreen: () => void;
  
  onOpenSettings: () => void;
  onOpenMarketplace: () => void;
  onOpenAbout: () => void;
  onOpenGuide: () => void;
  onOpenPricing?: () => void;
  onOpenGithub: () => void;
}

export function useMenuBarShortcuts(options: MenuBarShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Alt 단독 키 입력 (Alt 모드 토글)
      if (e.key === 'Alt') {
        e.preventDefault()
        options.setIsAltMode(prev => {
          const next = !prev
          if (!next) options.setActiveMenu(null)
          return next
        })
        return
      }

      // 2. Escape로 메뉴 닫기
      if (e.key === 'Escape') {
        options.setIsAltMode(false)
        options.setActiveMenu(null)
        return
      }

      const key = e.key.toLowerCase()

      // 3. 상단 메뉴바 진입 (Alt+알파벳, 또는 Alt 모드 상태에서 알파벳)
      if (e.altKey || (options.isAltMode && !options.activeMenu)) {
        if (key === 'f') { e.preventDefault(); options.setIsAltMode(true); options.setActiveMenu('file') }
        else if (key === 'v') { e.preventDefault(); options.setIsAltMode(true); options.setActiveMenu('view') }
        else if (key === 'w') { e.preventDefault(); options.setIsAltMode(true); options.setActiveMenu('window') }
        else if (key === 's') { e.preventDefault(); options.setIsAltMode(false); options.setActiveMenu(null); options.onOpenSettings() }
        else if (key === 'm' && options.isProPlan) { e.preventDefault(); options.setIsAltMode(false); options.setActiveMenu(null); options.onOpenMarketplace() }
        else if (key === 'h') { e.preventDefault(); options.setIsAltMode(true); options.setActiveMenu('help') }
        return
      }

      // 4. 활성화된 하위 메뉴 내비게이션
      if (options.activeMenu) {
        if (options.activeMenu === 'file') {
          if (key === 'n') { e.preventDefault(); options.triggerAction(options.onNewWindow) }
          else if (key === 'o') { e.preventDefault(); options.triggerAction(options.onOpenFile) }
          else if (key === 's') { e.preventDefault(); options.triggerAction(options.onSaveFile) }
          else if (key === 'a') { e.preventDefault(); options.triggerAction(options.onSaveAs) }
          else if (key === 'p') { e.preventDefault(); options.triggerAction(options.onPrint) }
          else if (key === 'x') { e.preventDefault(); options.triggerAction(options.onCloseApp) }
        } else if (options.activeMenu === 'view') {
          if (key === 'e') { e.preventDefault(); options.triggerAction(() => options.setEditorMode(options.editorMode === 'preview' ? 'edit' : 'preview')) }
          else if (key === 't') { e.preventDefault(); options.triggerAction(() => options.setShowStatusBar(!options.showStatusBar)) }
          else if (key === 'b') { e.preventDefault(); options.triggerAction(() => options.setShowSidebar(!options.showSidebar)) }
          else if (key === 'c') { e.preventDefault(); options.triggerAction(() => options.setShowConsole(!options.showConsole)) }
        } else if (options.activeMenu === 'window') {
          if (key === 'i') { e.preventDefault(); options.triggerAction(options.onZoomIn) }
          else if (key === 'o') { e.preventDefault(); options.triggerAction(options.onZoomOut) }
          else if (key === 'r') { e.preventDefault(); options.triggerAction(options.onZoomReset) }
          else if (key === 'f') { e.preventDefault(); options.triggerAction(options.onToggleFullscreen) }
        } else if (options.activeMenu === 'help') {
          if (key === 'a') { e.preventDefault(); options.triggerAction(options.onOpenAbout) }
          else if (key === 'g') { e.preventDefault(); options.triggerAction(options.onOpenGuide) }
          else if (key === 'p') { e.preventDefault(); options.triggerAction(options.onOpenPricing) }
          else if (key === 'c') { e.preventDefault(); options.triggerAction(options.onOpenGithub) }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    options.isAltMode, options.activeMenu, options.editorMode, options.showStatusBar, 
    options.showSidebar, options.showConsole, options.isProPlan,
    options.onNewWindow, options.onOpenFile, options.onSaveFile, options.onSaveAs, 
    options.onPrint, options.onCloseApp,
    options.setEditorMode, options.setShowStatusBar, options.setShowSidebar, options.setShowConsole,
    options.onZoomIn, options.onZoomOut, options.onZoomReset, options.onToggleFullscreen,
    options.onOpenSettings, options.onOpenMarketplace, options.onOpenAbout, 
    options.onOpenGuide, options.onOpenPricing, options.onOpenGithub,
    options.setIsAltMode, options.setActiveMenu, options.triggerAction
  ])
}
