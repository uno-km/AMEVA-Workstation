/**
 * @file SettingsModal.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/SettingsModal.tsx
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
import { Settings, Sliders, Monitor, Move, Bot, ToyBrick, User, Shield, Keyboard, ShieldAlert, Key, Cpu } from 'lucide-react'
import * as ipc from '../services/ipc/electronApiAdapter'
import { FreeModal } from './ui/modals/FreeModal'
import { SettingsTabCredentials } from './settings/SettingsTabCredentials'
import { SettingsTabMCP } from './settings/SettingsTabMCP'
import { SettingsTabHotkeys } from './settings/SettingsTabHotkeys'
import { SettingsTabGeneral } from './settings/SettingsTabGeneral'
import { SettingsTabAccount } from './settings/SettingsTabAccount'
import { SettingsTabPermissions } from './settings/SettingsTabPermissions'
import { SettingsTabAppearance } from './settings/SettingsTabAppearance'
import { SettingsTabModels } from './settings/SettingsTabModels'
import { SettingsTabCustomizations } from './settings/SettingsTabCustomizations'
import { SettingsTabAIEngine } from './settings/SettingsTabAIEngine'
import { useSettingsDraft } from '../hooks/app/useSettingsDraft'
import { SettingsTransitionOverlay } from './overlay/SettingsTransitionOverlay'
import type { AISettings } from '../types/aiTypes'

export interface HotkeyConfig {
  save: string
  open: string
  newFile: string
  pdfExport: string
  toggleAI: string
  toggleMode: string
  zoomIn: string
  zoomOut: string
  zoomReset: string
}

export interface AppSettings {
  showPeersPointer: boolean
  showPeersDrag: boolean
  showCodeConsole: boolean
  autoSnapshot: boolean
  theme: 'dark' | 'gray' | 'white' | 'hacker' | 'nature' | 'win98'
  wordWrap: boolean
  showMinimap: boolean
  installedPlugins?: string[]
  securityPreset?: 'paranoiac' | 'turbo' | 'restricted'
  artifactReviewPolicy?: 'always' | 'never' | 'ask'
  hotkeys?: HotkeyConfig
  modelPath?: string
  codeModelPath?: string
}

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  settings: AppSettings
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void
  aiSettings: AISettings
  onUpdateAISettings: (newSettings: Partial<AISettings>) => void
  initialTab?: TabType
  username?: string
  userColor?: string
  onUpdateUser?: (name: string, color: string) => void
  onOpenModelHub?: () => void
}

type TabType = 'General' | 'AIEngine' | 'Account' | 'Permissions' | 'Appearance' | 'Models' | 'Customizations' | 'Hotkeys' | 'MCP' | 'Credentials'

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `SettingsModal`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `SettingsModal(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
export function SettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  aiSettings,
  onUpdateAISettings,
  initialTab,
  username = 'User',
  userColor = '#a855f7',
  onUpdateUser,
  onOpenModelHub,
}: SettingsModalProps) {
  void { Move, ShieldAlert, onOpenModelHub };

  // 0. 설정 Draft 및 전환 상태
  const { draftSettings, updateDraft, resetDraft, isDirty: isAppDirty } = useSettingsDraft(settings, isOpen)
  const [draftAISettings, setDraftAISettings] = useState<AISettings>(aiSettings)
  const [isAIDirty, setIsAIDirty] = useState(false)
  const [isApplying, setIsApplying] = useState(false)

  // 2. 활성 탭 상태 (기본 General 또는 initialTab)
  const [activeTab, setActiveTab] = useState<TabType>(initialTab || 'General')

  useEffect(() => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `isOpen`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (isOpen)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (isOpen) {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `initialTab`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (initialTab)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (initialTab) {
        setActiveTab(initialTab)
      } else {
        // If it was closed and opened again without initialTab, maybe keep the last active tab or reset to General.
        // We'll just set it to initialTab if provided.
      }
    }
  }, [isOpen, initialTab])

  // 3. 사용자 정보 폼 로컬 상태
  const [tempName, setTempName] = useState(username)
  const [tempColor, setTempColor] = useState(userColor)

  useEffect(() => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `isOpen`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (isOpen)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (isOpen) {
      setDraftAISettings(aiSettings)
      setIsAIDirty(false)
      setTempName(username)
      setTempColor(userColor)
    }
  }, [isOpen, aiSettings, username, userColor])

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `updateDraftAI`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const updateDraftAI = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const updateDraftAI = (updates: Partial<AISettings>) => {
    setDraftAISettings(prev => ({ ...prev, ...updates }))
    setIsAIDirty(true)
  }

  // 4. 모델 탭 스캔 상태
  const [localModels, setLocalModels] = useState<import('../services/ipc/ipcTypes').ModelInfo[]>([])
  const [localCodeModels, setLocalCodeModels] = useState<import('../services/ipc/ipcTypes').ModelInfo[]>([])
  const [gpuName, setGpuName] = useState<string | undefined>(undefined)

  // 🦾 Pro Plan 상태 (마켓플레이스 및 MCP 노출을 제어)
  const [isProPlan, setIsProPlan] = useState<boolean>(() => {
    try {
      return localStorage.getItem('is-pro-plan') === 'true'
    } catch {
      return false
    }
  })
  const [isFreeModeLocked, setIsFreeModeLocked] = useState(false)


      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `isUserDirty`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const isUserDirty = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const isUserDirty = tempName !== username || tempColor !== userColor
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `isAnyDirty`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const isAnyDirty = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const isAnyDirty = isAppDirty || isAIDirty || isUserDirty

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `handleSaveAndApply`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const handleSaveAndApply = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const handleSaveAndApply = () => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!isAnyDirty`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!isAnyDirty)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (!isAnyDirty) {
      onClose()
      return
    }
    setIsApplying(true)
    setTimeout(() => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `isAppDirty) onUpdateSettings(draftSettings`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (isAppDirty) onUpdateSettings(draftSettings)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (isAppDirty) onUpdateSettings(draftSettings)
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `isAIDirty) onUpdateAISettings(draftAISettings`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (isAIDirty) onUpdateAISettings(draftAISettings)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (isAIDirty) onUpdateAISettings(draftAISettings)
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `isUserDirty && onUpdateUser) onUpdateUser(tempName, tempColor`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (isUserDirty && onUpdateUser) onUpdateUser(tempName, tempColor)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (isUserDirty && onUpdateUser) onUpdateUser(tempName, tempColor)
      setIsApplying(false)
      onClose()
    }, 1800)
  }

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `handleCancel`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const handleCancel = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const handleCancel = () => {
    resetDraft()
    setDraftAISettings(aiSettings)
    setIsAIDirty(false)
    setTempName(username)
    setTempColor(userColor)
    onClose()
  }

  useEffect(() => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `isOpen`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (isOpen)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (isOpen) {
      // Pro 플랜 설정 실시간 반영
      try {
        setIsProPlan(localStorage.getItem('is-pro-plan') === 'true')
      } catch {}

      // 시작 시 무료 플래그 상태 체크
      if (ipc.isElectronEnv()) {
        ipc.isFreeMode().then(isFree => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `isFree`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (isFree)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
          if (isFree) {
            setIsFreeModeLocked(true)
            setIsProPlan(false)
          }
        })
      }
    }
  }, [isOpen])

  // 라이브 테마 프리뷰: Appearance 설정 탭에서 고르면 닫기 전까지 임시 적용
  useEffect(() => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `isOpen`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (isOpen)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (isOpen) {
      document.documentElement.setAttribute('data-theme', draftSettings.theme)
    } else {
      document.documentElement.setAttribute('data-theme', settings.theme)
    }
  }, [isOpen, draftSettings.theme, settings.theme])

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `handleToggleProPlan`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const handleToggleProPlan = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const handleToggleProPlan = async () => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `isFreeModeLocked`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (isFreeModeLocked)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (isFreeModeLocked) {
      alert('⚠️ 무료 모드 데모 플래그(--free)로 실행되어 요금제 강제 전환이 불가능합니다.')
      return
    }
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `nextVal`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const nextVal = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const nextVal = !isProPlan
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `ipc.isElectronEnv()`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (ipc.isElectronEnv())` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (ipc.isElectronEnv()) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `result`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const result = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const result = await ipc.planSetStatus(nextVal)
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `result && !result.success`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (result && !result.success)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (result && !result.success) {
        alert(`요금제 변경 실패: ${result.error}`)
        return
      }
    }
    setIsProPlan(nextVal)
    localStorage.setItem('is-pro-plan', String(nextVal))
    // 탭 선택 보정: 유료에서 무료로 전환 시 현재 MCP 탭에 있었다면 General 탭으로 대피시킴
    if (!nextVal && activeTab === 'MCP') {
      setActiveTab('General')
    }
  }

  useEffect(() => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `isOpen && ipc.isElectronEnv()`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (isOpen && ipc.isElectronEnv())` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (isOpen && ipc.isElectronEnv()) {
      Promise.all([
        ipc.llmListModels('llm').catch(() => []),
        ipc.llmListModels('code').catch(() => [])
      ]).then(([llmList, codeList]) => {
        setLocalModels(llmList)
        setLocalCodeModels(codeList)
      })

      ipc.llmGetGpuName?.().then(name => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `name) setGpuName(name`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (name) setGpuName(name)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (name) setGpuName(name)
      }).catch(() => {})
    }
  }, [isOpen])

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `startModelDownload`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const startModelDownload = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const startModelDownload = async (url: string, filename: string, type: 'llm' | 'code') => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!ipc.isElectronEnv()`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!ipc.isElectronEnv())` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (!ipc.isElectronEnv()) return
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `store`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const store = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const store = (await import('../stores/useProcessStore')).useProcessStore.getState()
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `existing`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const existing = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const existing = store.downloadQueue.find((q: any) => q.filename === filename && (q.status === 'pending' || q.status === 'downloading'))
    
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `existing`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (existing)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (existing) {
      // 이미 큐에 있음
      return
    }

    store.addDownloadToQueue({
      id: Math.random().toString(36).substring(2, 9),
      url,
      filename,
      type,
      status: 'pending',
      progress: 0
    })
  }


  const themes: { id: AppSettings['theme']; label: string; previewColor: string }[] = [
    { id: 'dark', label: 'Dark (Antigravity)', previewColor: '#0a0a0f' },
    { id: 'gray', label: 'Carbon Gray', previewColor: '#1e1e2e' },
    { id: 'white', label: 'Light White', previewColor: '#f3f4f6' },
    { id: 'hacker', label: 'Hacker Green', previewColor: '#000000' },
    { id: 'nature', label: 'Fairytale Nature', previewColor: '#f0fdf4' },
    { id: 'win98', label: 'Retro Windows 98', previewColor: '#c0c0c0' },
  ]

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `handleSaveUser`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const handleSaveUser = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const handleSaveUser = () => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `onUpdateUser`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (onUpdateUser)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (onUpdateUser) {
      onUpdateUser(tempName.trim(), tempColor)
    }
  }

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `formatBytes`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `formatBytes(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
  function formatBytes(bytes: number): string {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `bytes === 0`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (bytes === 0)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (bytes === 0) return 'N/A'
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)}MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`
  }

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!isOpen`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!isOpen)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
  if (!isOpen) return null

  return (
    <FreeModal
      isOpen={isOpen}
      onClose={handleCancel}
      title="AMEVA Workstation Settings"
      icon={<Settings size={18} />}
      initialWidth={820}
      initialHeight={580}
      hasBackdrop={true}
    >
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* 좌측 사이드바 탭 */}
        <div style={{
          width: '150px',
          borderRight: '1px solid var(--border-muted)',
          background: 'rgba(255,255,255,0.01)',
          display: 'flex',
          flexDirection: 'column',
          padding: '12px 8px',
          gap: '4px',
          flexShrink: 0,
        }}>
          {[
            { id: 'General', label: 'General', icon: Sliders },
            { id: 'AIEngine', label: 'AI Engine', icon: Cpu },
            { id: 'Account', label: 'Account', icon: User },
            { id: 'Permissions', label: 'Permissions', icon: Shield },
            { id: 'Credentials', label: 'Credentials', icon: Key },
            { id: 'Appearance', label: 'Appearance', icon: Monitor },
            { id: 'Models', label: 'Models', icon: Bot },
            { id: 'Customizations', label: 'Customizations', icon: ToyBrick },
            { id: 'Hotkeys', label: 'Hotkeys', icon: Keyboard },
            ...(isProPlan ? [{ id: 'MCP', label: 'MCP Manager', icon: ToyBrick }] : [])
          ].map(t => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `Icon`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const Icon = ...` 형태로 안전 캐싱 후 가공 기동.
       */
            const Icon = t.icon
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `isSelected`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const isSelected = ...` 형태로 안전 캐싱 후 가공 기동.
       */
            const isSelected = activeTab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as TabType)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '8px 12px', borderRadius: '6px', border: 'none',
                  background: isSelected ? 'var(--bg-glass-active)' : 'transparent',
                  color: isSelected ? 'var(--text-on-active)' : 'var(--text-muted)',
                  fontSize: '11px', fontWeight: isSelected ? 700 : 500,
                  cursor: 'pointer', textAlign: 'left',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                <Icon size={14} />
                <span>{t.label}</span>
              </button>
            )
          })}
        </div>

        {/* 우측 설정 내용 컨테이너 */}
        <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
          {/* General Tab */}
          <SettingsTabGeneral
            activeTab={activeTab}
            settings={draftSettings}
            onUpdateSettings={updateDraft}
            isProPlan={isProPlan}
            handleToggleProPlan={handleToggleProPlan}
          />

          {/* AIEngine Tab */}
          <SettingsTabAIEngine
            activeTab={activeTab}
            aiSettings={draftAISettings}
            onUpdateAISettings={updateDraftAI}
            gpuName={gpuName}
          />

          {/* Account Tab */}
          <SettingsTabAccount
            activeTab={activeTab}
            tempName={tempName}
            setTempName={setTempName}
            tempColor={tempColor}
            setTempColor={setTempColor}
            handleSaveUser={handleSaveUser}
          />

          {/* Permissions Tab */}
          <SettingsTabPermissions
            activeTab={activeTab}
            settings={draftSettings}
            onUpdateSettings={updateDraft}
          />

          {/* Credentials Tab */}
          <SettingsTabCredentials isOpen={isOpen} activeTab={activeTab} />

          {/* Appearance Tab */}
          <SettingsTabAppearance
            activeTab={activeTab}
            settings={draftSettings}
            handleThemeChange={(theme) => updateDraft({ theme })}
            themes={themes}
          />

          {/* Models Tab */}
          <SettingsTabModels
            activeTab={activeTab}
            settings={draftSettings}
            onUpdateSettings={updateDraft}
            localModels={localModels}
            localCodeModels={localCodeModels}
            formatBytes={formatBytes}
            startModelDownload={startModelDownload}
          />

          {/* Customizations Tab */}
          <SettingsTabCustomizations
            activeTab={activeTab}
            settings={draftSettings}
          />

          {/* Hotkeys Tab */}
          <SettingsTabHotkeys activeTab={activeTab} settings={draftSettings} onUpdateSettings={updateDraft} />

          {/* MCP Manager Tab (Pro Plan Only) */}
          {activeTab === 'MCP' && (
            <SettingsTabMCP isProPlan={isProPlan} isOpen={isOpen} />
          )}


        </div>
      </div>

      {/* 3. 최하단 푸터 */}
      <div
        style={{
          padding: '10px 18px',
          borderTop: '1px solid var(--border-muted)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '8px',
          backgroundColor: 'rgba(255, 255, 255, 0.01)',
          flexShrink: 0,
        }}
      >
        <button
          className="btn btn-secondary"
          style={{ padding: '5px 16px', fontSize: '11px', borderRadius: '6px', fontWeight: 600, border: '1px solid var(--border-muted)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}
          onClick={handleCancel}
          disabled={isApplying}
        >
          취소
        </button>
        <button
          className="btn btn-primary"
          style={{ padding: '5px 16px', fontSize: '11px', borderRadius: '6px', fontWeight: 700, opacity: isApplying ? 0.7 : 1, cursor: isApplying ? 'wait' : 'pointer' }}
          onClick={handleSaveAndApply}
          disabled={isApplying}
        >
          {isAnyDirty ? '적용 및 저장' : '닫기'}
        </button>
      </div>
      {/* 🚀 Transition Overlay */}
      <SettingsTransitionOverlay isVisible={isApplying} />
    </FreeModal>
  )
}

export { SettingsTabGeneral } from './settings/SettingsTabGeneral'
export { SettingsTabAIEngine } from './settings/SettingsTabAIEngine'
export { SettingsTabAccount } from './settings/SettingsTabAccount'
export { SettingsTabPermissions } from './settings/SettingsTabPermissions'
export { SettingsTabAppearance } from './settings/SettingsTabAppearance'
export { SettingsTabModels } from './settings/SettingsTabModels'
export { SettingsTabCustomizations } from './settings/SettingsTabCustomizations'

