/**
 * useAIEngineLogs.ts
 *
 * AI 엔진 로그 구독 및 관리 전담 훅.
 * 메인 프로세스의 LLM 로그 이벤트를 구독하고, WebGPU 관련 콘솔 로그를 가로채어
 * Electron 메인 프로세스로 전달하는 역할을 담당한다.
 *
 * [단일 책임]
 * 오직 엔진 로그 수신/관리에만 집중한다.
 * 스트리밍 토큰 처리나 AI 메시지 상태와 완전히 독립된다.
 */

import { useEffect, useRef } from 'react'
import { useAILogStore } from '../../stores/useAILogStore'
import * as ipc from '../../services/ipc/electronApiAdapter'

/**
 * useAIEngineLogs
 * LLM 엔진 로그를 구독하고 WebGPU 콘솔 로그를 인터셉트한다.
 *
 * @returns setEngineLogs - 엔진 로그 추가 함수
 * @returns engineLogs - 현재 엔진 로그 배열
 */
export function useAIEngineLogs() {
  const { sensorLogs: engineLogs, addSensorLog: setEngineLogs } = useAILogStore()

  // 로그 언서브 레퍼런스
  const unsubLogRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!ipc.isElectronEnv()) return

    // 1. 메인 프로세스 LLM 로그 실시간 수신
    const unsubLog = ipc.onLLMLog((data) => {
      setEngineLogs(data.text)
    })

    // 2. 누락된 초기 로그 일괄 불러오기
    ipc.llmGetLogs().then((logs) => {
      if (logs) {
        setEngineLogs(logs)
      }
    }).catch((err) => {
      console.error('[useAIEngineLogs] 초기 LLM 로그 불러오기 실패:', err)
    })

    // 3. WebGPU/GPU 관련 브라우저 콘솔 로그 인터셉트 (렌더러 → 메인 프로세스 전달)
    const origLog = console.log
    const origWarn = console.warn
    const origErr = console.error

    const interceptAndSend = (_type: string, args: any[]) => {
      const text = args
        .map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
        .join(' ')
      const lower = text.toLowerCase()
      if (
        lower.includes('webgpu') ||
        lower.includes('gpu') ||
        lower.includes('webgl')
      ) {
        ipc.llmAddLog({ text, prefix: 'WGU' })
      }
    }

    console.log = (...args) => { origLog(...args); interceptAndSend('log', args) }
    console.warn = (...args) => { origWarn(...args); interceptAndSend('warn', args) }
    console.error = (...args) => { origErr(...args); interceptAndSend('error', args) }

    unsubLogRef.current = unsubLog

    return () => {
      // 리스너 해제 및 콘솔 원복
      unsubLog()
      console.log = origLog
      console.warn = origWarn
      console.error = origErr
      if (unsubLogRef.current) {
        unsubLogRef.current()
        unsubLogRef.current = null
      }
    }
  }, [])

  return {
    engineLogs,
    setEngineLogs
  }
}
