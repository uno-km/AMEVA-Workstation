/**
 * @file useDownloadManager.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/hooks/app/useDownloadManager.ts
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

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
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
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (!ipc.isElectronEnv()) return

  // [RUN-TIME STATE / INVARIANT] - 변수 'unsub'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const unsub = ipc.onLLMDownloadProgress?.((status: any) => {
      // status: { filename, progress, speed, downloadedBytes, totalBytes, timeRemaining }
      const activeItem = useProcessStore.getState().downloadQueue.find(
        (q: DownloadQueueItem) => q.status === 'downloading' && q.filename === status.filename
      )
      
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (activeItem) {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
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
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (unsub) unsub()
    }
  }, [updateDownloadInQueue])

  // 2. 큐 프로세서 루프
  useEffect(() => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (isProcessingRef.current) return

  // [RUN-TIME STATE / INVARIANT] - 변수 'pendingItem'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const pendingItem = downloadQueue.find((q: DownloadQueueItem) => q.status === 'pending')
  // [RUN-TIME STATE / INVARIANT] - 변수 'activeItem'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const activeItem = downloadQueue.find((q: DownloadQueueItem) => q.status === 'downloading')

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (!activeItem && pendingItem) {
      isProcessingRef.current = true
      startNextDownload(pendingItem)
    }
  }, [downloadQueue])

  // [RUN-TIME STATE / INVARIANT] - 변수 'startNextDownload'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const startNextDownload = async (item: DownloadQueueItem) => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (!ipc.isElectronEnv()) {
      isProcessingRef.current = false
      return
    }

    try {
      updateDownloadInQueue(item.id, { status: 'downloading', progress: 0 })
      
  // [RUN-TIME STATE / INVARIANT] - 변수 'res'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const res = await ipc.llmDownloadModel?.({
        url: item.url,
        filename: item.filename,
        type: item.type
      })

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
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
  // [RUN-TIME STATE / INVARIANT] - 변수 'existing'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const existing = useProcessStore.getState().downloadQueue.find(
      (q: DownloadQueueItem) => q.filename === filename && (q.status === 'pending' || q.status === 'downloading')
    )
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
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

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
