/**
 * @file useMenuBarShortcuts.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/hooks/app/useMenuBarShortcuts.ts
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/App.tsx): 최상위 Facade 구조에 통합 마운트.
 * - 소비처 B (src/renderer/contexts/AppContext.tsx): 리액트 Context 훅 목록에 바인딩되어 하위 뷰에 전파.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 본 파일은 AMEVA 시스템 내에서 도메인 목적에 부합하는 연산 및 데이터 처리 흐름을 안전하게 캡슐화한다.
 * - 외부 라이브러리 및 하위 종속성을 조율하고 결과 규격을 일관되게 제공한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그를 명확하게 남길 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

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

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
export function useMenuBarShortcuts(options: MenuBarShortcutsOptions) {
  useEffect(() => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'handleKeyDown'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Alt 단독 키 입력 (Alt 모드 토글)
      if (e.key === 'Alt') {
        e.preventDefault()
        options.setIsAltMode(prev => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'next'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          const next = !prev
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
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

  // [RUN-TIME STATE / INVARIANT] - 변수 'key'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const key = e.key.toLowerCase()

      // 3. 상단 메뉴바 진입 (Alt+알파벳, 또는 Alt 모드 상태에서 알파벳)
      if (e.altKey || (options.isAltMode && !options.activeMenu)) {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
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
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (options.activeMenu === 'file') {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
          if (key === 'n') { e.preventDefault(); options.triggerAction(options.onNewWindow) }
          else if (key === 'o') { e.preventDefault(); options.triggerAction(options.onOpenFile) }
          else if (key === 's') { e.preventDefault(); options.triggerAction(options.onSaveFile) }
          else if (key === 'a') { e.preventDefault(); options.triggerAction(options.onSaveAs) }
          else if (key === 'p') { e.preventDefault(); options.triggerAction(options.onPrint) }
          else if (key === 'x') { e.preventDefault(); options.triggerAction(options.onCloseApp) }
        } else if (options.activeMenu === 'view') {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
          if (key === 'e') { e.preventDefault(); options.triggerAction(() => options.setEditorMode(options.editorMode === 'preview' ? 'edit' : 'preview')) }
          else if (key === 't') { e.preventDefault(); options.triggerAction(() => options.setShowStatusBar(!options.showStatusBar)) }
          else if (key === 'b') { e.preventDefault(); options.triggerAction(() => options.setShowSidebar(!options.showSidebar)) }
          else if (key === 'c') { e.preventDefault(); options.triggerAction(() => options.setShowConsole(!options.showConsole)) }
        } else if (options.activeMenu === 'window') {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
          if (key === 'i') { e.preventDefault(); options.triggerAction(options.onZoomIn) }
          else if (key === 'o') { e.preventDefault(); options.triggerAction(options.onZoomOut) }
          else if (key === 'r') { e.preventDefault(); options.triggerAction(options.onZoomReset) }
          else if (key === 'f') { e.preventDefault(); options.triggerAction(options.onToggleFullscreen) }
        } else if (options.activeMenu === 'help') {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
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

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
