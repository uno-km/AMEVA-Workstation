import { useCallback } from 'react'
import confetti from 'canvas-confetti'
import { useProcessStore } from '../../stores/useProcessStore'
import { type AmevaEditor } from '../../editor/amevaBlockSchema'
import type { ExportFormat } from '../../../shared/types'
import { IDLE_PROGRESS } from '../../components/ExportModal'
import * as ipc from '../../services/ipc/electronApiAdapter'
import { normalizeBlocks } from '../../utils/normalizeBlocks'
import { convertJupyterToCodeBlocks } from '../../utils/markdownUtils'
import { handleElectronExport } from './export/handleElectronExport'
import { handleBrowserExport } from './export/handleBrowserExport'

export function useAppExport(editor: AmevaEditor | null) {
  const {
    updateExportProgress,
    setExportProgress,
    setExportMinimized
  } = useProcessStore()

  const handleExport = useCallback(async (format: ExportFormat) => {
    if (!editor) return

    const setP = (percent: number, message: string) =>
      updateExportProgress({ percent, message })

    setExportMinimized(false)
    setExportProgress({ phase: 'running', format, percent: 0, message: '문서 분석 중...' })

    try {
      await new Promise(r => setTimeout(r, 80))
      const rawBlocks = convertJupyterToCodeBlocks(editor.document)
      setP(15, '블록 데이터 수집 중...')

      const blocks = normalizeBlocks(rawBlocks)
      console.log(`[Export] normalizeBlocks: ${blocks.length}개 블록 변환 완료`, blocks)
      setP(25, '콘텐츠 변환 중...')

      let savedPath: string | null = null

      if (ipc.isElectronEnv()) {
        savedPath = await handleElectronExport(editor, format, blocks, setP)
      } else {
        savedPath = await handleBrowserExport(editor, format, blocks)
      }

      if (!savedPath) {
        setExportProgress(IDLE_PROGRESS)
        return
      }

      setP(90, '파일 저장 완료 중...')
      await new Promise(r => setTimeout(r, 120))
      setP(100, '완료!')

      updateExportProgress({
        phase: 'success',
        percent: 100,
        message: '저장 완료',
        savedPath,
      })

      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#8b5cf6', '#06b6d4', '#ec4899', '#10b981'],
      })

      setTimeout(() => {
        setExportMinimized(true)
        setTimeout(() => setExportProgress(IDLE_PROGRESS), 2000)
      }, 2000)

    } catch (err: any) {
      updateExportProgress({
        phase: 'error',
        message: '변환 실패',
        error: err?.message ?? String(err),
      })
    }
  }, [editor, updateExportProgress, setExportProgress, setExportMinimized])

  return {
    handleExport
  }
}
