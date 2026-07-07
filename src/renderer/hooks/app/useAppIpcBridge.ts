/**
 * useAppIpcBridge.ts
 *
 * App 레벨 IPC 이벤트 브리지 훅.
 * App.tsx 내에서 window.electronAPI 이벤트를 구독하여 전역 상태에 반영하는
 * 생애주기 코드를 격리한다.
 *
 * [포함 로직]
 * - onLLMDownloadProgress → downloadStatus, toastMessage 반영
 * - onFileOpenArgv → 파일 열기 OS 인자 처리
 * - onExportProgress → exportProgress 상태 반영
 * - appReady() 호출 (Electron에 렌더러 준비 완료 신호)
 */

import { useEffect } from 'react'
import { useProcessStore } from '../../stores/useProcessStore'
import { useUIStore } from '../../stores/useUIStore'

/**
 * FileOpenArgvHandler
 * OS에서 파일을 직접 열 때 호출되는 콜백 함수 타입.
 */
export type FileOpenArgvHandler = (file: { filePath: string; content: string; isBinary?: boolean }) => Promise<void>

/**
 * useAppIpcBridge
 * Electron 글로벌 IPC 이벤트들을 구독하고 전역 상태에 반영한다.
 *
 * @param onFileOpen - OS argv 파일 열기 이벤트 처리 콜백
 */
export function useAppIpcBridge(onFileOpen?: FileOpenArgvHandler) {
  const { setDownloadStatus } = useProcessStore()
  const { setToastMessage } = useUIStore()

  // 1. 모델 다운로드 진행 이벤트 구독
  useEffect(() => {
    if (!(window as any).electronAPI?.onLLMDownloadProgress) return

    const unsub = (window as any).electronAPI.onLLMDownloadProgress((status: any) => {
      setDownloadStatus((prev: any) => {
        const filenameOnly = String(status.filename || '').split(/[/\\]/).pop() || status.filename

        // 신규 다운로드 시작
        if (!prev && status) {
          setToastMessage(`📥 [다운로드 시작] '${filenameOnly}' 다운로드 작업이 시작되었습니다.`)
          setTimeout(() => setToastMessage(null), 3500)
        }

        // 다운로드 완료 (progress 100)
        if (status.progress === 100 && (!prev || prev.progress < 100)) {
          setToastMessage(`🎉 [설치 완료] '${filenameOnly}' 모델 설치가 완료되었습니다!`)
          setTimeout(() => {
            setToastMessage(null)
            setDownloadStatus(null)
          }, 4000)
        }

        return status
      })
    })

    return () => unsub()
  }, [setDownloadStatus, setToastMessage])

  // 2. OS argv 파일 열기 이벤트 구독
  useEffect(() => {
    if (!(window as any).electronAPI?.onFileOpenArgv || !onFileOpen) return

    const unsub = (window as any).electronAPI.onFileOpenArgv((_event: any, file: any) => {
      if (file && file.filePath) {
        onFileOpen(file).catch((e: any) => {
          console.error('[useAppIpcBridge] OS argv 파일 열기 처리 실패:', e)
        })
      }
    })

    return () => unsub()
  }, [onFileOpen])

  // 3. 앱 준비 신호 전송 (Electron에게 렌더러 준비 완료를 알림)
  useEffect(() => {
    if ((window as any).electronAPI?.appReady) {
      try {
        (window as any).electronAPI.appReady()
      } catch (e) {
        console.warn('[useAppIpcBridge] appReady 호출 실패:', e)
      }
    }
  }, [])
}
