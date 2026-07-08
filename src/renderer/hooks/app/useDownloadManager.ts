import { useEffect, useRef } from 'react'
import * as ipc from '../../services/ipc/electronApiAdapter'
import { useProcessStore } from '../../stores/useProcessStore'

export interface DownloadQueueItem {
  id: string
  url: string
  filename: string
  type: 'llm' | 'code'
  sizeBytes?: number
  status: 'pending' | 'downloading' | 'completed' | 'error'
  progress?: number
  speed?: number
  timeRemaining?: number
  error?: string
}

export function useDownloadManager() {
  const {
    downloadQueue,
    updateDownloadInQueue,
    addDownloadToQueue
  } = useProcessStore()

  // 백그라운드 큐 처리루프를 여러 번 중복 실행하지 않도록 Guard
  const isProcessingRef = useRef(false)

  // 1. IPC 다운로드 이벤트 구독 (전역)
  useEffect(() => {
    if (!ipc.isElectronEnv()) return

    const unsub = ipc.onLLMDownloadProgress?.((status: any) => {
      // status: { filename, progress, speed, downloadedBytes, totalBytes, timeRemaining }
      const activeItem = useProcessStore.getState().downloadQueue.find(
        (q: DownloadQueueItem) => q.status === 'downloading' && q.filename === status.filename
      )
      
      if (activeItem) {
        if (status.progress >= 100) {
          updateDownloadInQueue(activeItem.id, {
            status: 'completed',
            progress: 100,
            speed: 0,
            timeRemaining: 0,
            sizeBytes: status.totalBytes
          })
          isProcessingRef.current = false // 다운로드 끝남
        } else {
          updateDownloadInQueue(activeItem.id, {
            progress: status.progress,
            speed: status.speed,
            timeRemaining: status.timeRemaining,
            sizeBytes: status.totalBytes
          })
        }
      }
    })

    return () => {
      if (unsub) unsub()
    }
  }, [updateDownloadInQueue])

  // 2. 큐 프로세서 루프
  useEffect(() => {
    if (isProcessingRef.current) return

    const pendingItem = downloadQueue.find((q: DownloadQueueItem) => q.status === 'pending')
    const activeItem = downloadQueue.find((q: DownloadQueueItem) => q.status === 'downloading')

    if (!activeItem && pendingItem) {
      isProcessingRef.current = true
      startNextDownload(pendingItem)
    }
  }, [downloadQueue])

  const startNextDownload = async (item: DownloadQueueItem) => {
    if (!ipc.isElectronEnv()) {
      isProcessingRef.current = false
      return
    }

    try {
      updateDownloadInQueue(item.id, { status: 'downloading', progress: 0 })
      
      const res = await ipc.llmDownloadModel?.({
        url: item.url,
        filename: item.filename,
        type: item.type
      })

      if (res && !res.success) {
        updateDownloadInQueue(item.id, {
          status: 'error',
          error: res.error || '다운로드 실패'
        })
        isProcessingRef.current = false
      }
      
      // 성공하면 IPC progress 100% 이벤트에서 completed 처리됨
    } catch (err: any) {
      updateDownloadInQueue(item.id, {
        status: 'error',
        error: err.message
      })
      isProcessingRef.current = false
    }
  }

  // 외부(컴포넌트)에서 다운로드 큐에 추가하는 함수
  const enqueueDownload = (url: string, filename: string, type: 'llm' | 'code') => {
    const existing = useProcessStore.getState().downloadQueue.find(
      (q: DownloadQueueItem) => q.filename === filename && (q.status === 'pending' || q.status === 'downloading')
    )
    if (existing) {
      // 이미 큐에 있거나 다운로드 중
      return false
    }

    const newItem: DownloadQueueItem = {
      id: Math.random().toString(36).substring(2, 9),
      url,
      filename,
      type,
      status: 'pending',
      progress: 0
    }
    
    addDownloadToQueue(newItem)
    return true
  }

  return { enqueueDownload }
}
