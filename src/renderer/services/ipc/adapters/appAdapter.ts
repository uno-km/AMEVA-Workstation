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
