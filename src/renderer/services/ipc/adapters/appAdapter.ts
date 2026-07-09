/**
 * @file appAdapter.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/services/ipc/adapters/appAdapter.ts
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/App.tsx): AMEVA OS 최상위 마운트 레이어에서 의존성 로더로 연동 소비.
 * - 소비처 B (src/renderer/main.tsx): 렌더러 엔트리 라이프사이클의 기본 기능으로 수입 소비.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 본 파일은 AMEVA 시스템 내에서 도메인 목적에 부합하는 연산 및 데이터 처리 흐름을 안전하게 캡슐화한다.
 * - 외부 라이브러리 및 하위 종속성을 조율하고 결과 규격을 일관되게 제공한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그를 명확하게 남길 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

export interface MessageBoxOptions {
  type?: 'none' | 'info' | 'error' | 'question' | 'warning'
  buttons?: string[]
  defaultId?: number
  title?: string
  message: string
  detail?: string
  checkboxLabel?: string
  checkboxChecked?: boolean
  [key: string]: unknown
}

export function isElectronEnv(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI
}

export function appReady(): void {
  if (!window.electronAPI?.appReady) return
  window.electronAPI.appReady()
}

export function setZoomLevel(level: number): void {
  if (!window.electronAPI?.setZoomLevel) return
  window.electronAPI.setZoomLevel(level)
}

export async function getZoomLevel(): Promise<number> {
  if (!window.electronAPI?.getZoomLevel) return 0
  return window.electronAPI.getZoomLevel()
}

export async function getZoomFactor(): Promise<number> {
  if (!window.electronAPI?.getZoomFactor) return 1.0
  return window.electronAPI.getZoomFactor()
}

export function setZoomFactor(factor: number): void {
  if (!window.electronAPI?.setZoomFactor) return
  window.electronAPI.setZoomFactor(factor)
}

export async function showMessageBox(options: MessageBoxOptions): Promise<{ response: number }> {
  if (!window.electronAPI?.showMessageBox) return { response: 0 }
  return window.electronAPI.showMessageBox(options)
}

export async function planGetStatus(): Promise<boolean> {
  if (!window.electronAPI?.planGetStatus) return false
  return window.electronAPI.planGetStatus()
}

export async function planSetStatus(isPro: boolean): Promise<{ success: boolean; isPro?: boolean; error?: string }> {
  if (!window.electronAPI?.planSetStatus) return { success: false, error: 'API not available' }
  return window.electronAPI.planSetStatus(isPro)
}

export async function isFreeMode(): Promise<boolean> {
  if (!window.electronAPI?.isFreeMode) return true
  return window.electronAPI.isFreeMode()
}

export function newWindow(): void {
  if (!window.electronAPI?.newWindow) return
  window.electronAPI.newWindow()
}

export function closeApp(): void {
  if (!window.electronAPI?.closeApp) return
  window.electronAPI.closeApp()
}

export function forceCloseApp(): void {
  if (!window.electronAPI?.forceCloseApp) return
  window.electronAPI.forceCloseApp()
}
