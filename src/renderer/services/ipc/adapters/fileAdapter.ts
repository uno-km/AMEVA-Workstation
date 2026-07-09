/**
 * @file fileAdapter.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/services/ipc/adapters/fileAdapter.ts
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

import type { FileOpenEventData, UrlMetadata } from '../ipcTypes'

export async function openFile(): Promise<FileOpenEventData | null> {
  if (!window.electronAPI) return null
  return window.electronAPI.openFile()
}

export async function saveFile(
  content: string,
  filePath?: string | null
): Promise<{ filePath?: string; success: boolean }> {
  if (!window.electronAPI) return { success: false }
  return window.electronAPI.saveFile(content, filePath)
}

export async function saveFileAs(
  content: string,
  filePath?: string | null
): Promise<{ filePath?: string; success: boolean }> {
  if (!window.electronAPI) return { success: false }
  return window.electronAPI.saveFileAs(content, filePath)
}

export async function selectLocalFile(
  filters?: Array<{ name: string; extensions: string[] }>
): Promise<{ filePath: string; base64: string } | null> {
  if (!window.electronAPI) return null
  return window.electronAPI.selectLocalFile(filters)
}

export function onFileOpenArgv(
  callback: (event: unknown, file: FileOpenEventData) => void
): () => void {
  if (!window.electronAPI) return () => {}
  return window.electronAPI.onFileOpenArgv(callback)
}

export async function fetchUrlMetadata(url: string): Promise<UrlMetadata> {
  if (!window.electronAPI?.fetchUrlMetadata) return {}
  try {
    return await window.electronAPI.fetchUrlMetadata(url)
  } catch (e) {
    console.error('[fetchUrlMetadata] URL 메타데이터 조회 실패:', e)
    return {}
  }
}

export function openExternalLink(url: string): void {
  if (!window.electronAPI?.openExternalLink) {
    if (url.startsWith('http')) {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
    return
  }
  window.electronAPI.openExternalLink(url)
}
