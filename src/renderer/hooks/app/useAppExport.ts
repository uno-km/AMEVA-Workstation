import { useCallback } from 'react'
import confetti from 'canvas-confetti'
import { useProcessStore } from '../../stores/useProcessStore'
import { type AmevaEditor } from '../../editor/amevaBlockSchema'
import type { ExportFormat } from '../../../shared/types'
import { IDLE_PROGRESS } from '../../components/ExportModal'
import * as ipc from '../../services/ipc/electronApiAdapter'
import {
  blocksToHTML, exportToWord, exportToExcel,
  exportToPPTX, exportToHWPX, exportToXML,
} from '../../utils/exporters'
import { normalizeBlocks } from '../../utils/normalizeBlocks'
import { convertJupyterToCodeBlocks } from '../../utils/markdownUtils'

function triggerBrowserDownload(data: Blob | string, filename: string) {
  const blob = typeof data === 'string' ? new Blob([data], { type: 'text/markdown;charset=utf-8' }) : data
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function useAppExport(editor: AmevaEditor | null) {
  const {
    updateExportProgress,
    setExportProgress,
    setExportMinimized
  } = useProcessStore()

  const handleExport = useCallback(async (format: ExportFormat) => {
    if (!editor) return

    // 진행 모달 열기
    const setP = (percent: number, message: string) =>
      updateExportProgress({ percent, message })

    setExportMinimized(false)
    setExportProgress({ phase: 'running', format, percent: 0, message: '문서 분석 중...' })

    try {
      // ── 단계 1: 문서 변환 준비 (0~20%)
      await new Promise(r => setTimeout(r, 80))
      const rawBlocks = convertJupyterToCodeBlocks(editor.document)
      setP(15, '블록 데이터 수집 중...')

      const blocks = normalizeBlocks(rawBlocks)
      console.log(`[Export] normalizeBlocks: ${blocks.length}개 블록 변환 완료`, blocks)
      setP(25, '콘텐츠 변환 중...')

      let savedPath: string | null = null

      if (ipc.isElectronEnv()) {
        // ── Electron 환경 ─────────────────────────────────────
        switch (format) {

          case 'md': {
            setP(40, 'Markdown 생성 중...')
            const markdown = await editor.blocksToMarkdownLossy(convertJupyterToCodeBlocks(editor.document))
            setP(65, '저장 대화상자 열기...')
            savedPath = await ipc.saveExportedFile(
              markdown, false, 'document.md',
              [{ name: 'Markdown', extensions: ['md', 'markdown'] }]
            )
            break
          }

          case 'html': {
            setP(40, 'HTML 변환 중...')
            const res = await ipc.exportConvert({ blocks, format: 'html', defaultName: 'document.html' })
            savedPath = res.success ? (res.savedPath ?? null) : null
            if (!res.success && res.error) throw new Error(res.error)
            break
          }

          case 'pdf': {
            setP(30, 'HTML 렌더링 중...')
            const html = blocksToHTML(blocks)
            setP(50, 'PDF 렌더링 (Chromium)...')
            savedPath = await ipc.printToPDF(html)
            break
          }

          case 'docx': {
            setP(40, 'Word 변환 중...')
            const res = await ipc.exportConvert({ blocks, format: 'docx', defaultName: 'document.docx' })
            savedPath = res.success ? (res.savedPath ?? null) : null
            if (!res.success && res.error) throw new Error(res.error)
            break
          }

          case 'xlsx': {
            setP(40, 'Excel 변환 중...')
            const res = await ipc.exportConvert({ blocks, format: 'xlsx', defaultName: 'tables.xlsx' })
            savedPath = res.success ? (res.savedPath ?? null) : null
            if (!res.success && res.error) throw new Error(res.error)
            break
          }

          case 'pptx': {
            setP(40, 'PowerPoint 변환 중...')
            const res = await ipc.exportConvert({ blocks, format: 'pptx', defaultName: 'presentation.pptx' })
            savedPath = res.success ? (res.savedPath ?? null) : null
            if (!res.success && res.error) throw new Error(res.error)
            break
          }

          case 'hwpx': {
            setP(40, '한글 변환 중...')
            const res = await ipc.exportConvert({ blocks, format: 'hwpx', defaultName: 'document.hwpx' })
            savedPath = res.success ? (res.savedPath ?? null) : null
            if (!res.success && res.error) throw new Error(res.error)
            break
          }

          case 'xml': {
            setP(40, 'XML 변환 중...')
            const res = await ipc.exportConvert({ blocks, format: 'xml', defaultName: 'document.xml' })
            savedPath = res.success ? (res.savedPath ?? null) : null
            if (!res.success && res.error) throw new Error(res.error)
            break
          }

          default:
            throw new Error(`지원하지 않는 형식입니다: ${format}`)
        }

      } else {
        // ── 브라우저 환경 (Electron 없음) ─────────────────────
        switch (format) {
          case 'md': {
            const md = await editor.blocksToMarkdownLossy(editor.document)
            triggerBrowserDownload(md, 'document.md')
            savedPath = 'document.md (브라우저 다운로드)'
            break
          }
          case 'html': {
            const html = blocksToHTML(blocks)
            triggerBrowserDownload(html, 'document.html')
            savedPath = 'document.html (브라우저 다운로드)'
            break
          }
          case 'pdf': {
            const html = blocksToHTML(blocks)
            const iframe = document.createElement('iframe')
            Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' })
            document.body.appendChild(iframe)
            const doc = iframe.contentWindow?.document || iframe.contentDocument
            if (doc) {
              doc.write(html); doc.close()
              await new Promise(r => setTimeout(r, 500))
              iframe.contentWindow?.focus(); iframe.contentWindow?.print()
              document.body.removeChild(iframe)
            }
            savedPath = 'PDF 인쇄 대화상자'
            break
          }
          case 'docx': triggerBrowserDownload(await exportToWord(blocks), 'document.docx'); savedPath = 'document.docx'; break
          case 'xlsx': triggerBrowserDownload(new Blob([exportToExcel(blocks) as any]), 'tables.xlsx'); savedPath = 'tables.xlsx'; break
          case 'pptx': triggerBrowserDownload(new Blob([(await exportToPPTX(blocks)) as any]), 'presentation.pptx'); savedPath = 'presentation.pptx'; break
          case 'hwpx': triggerBrowserDownload(await exportToHWPX(blocks), 'document.hwpx'); savedPath = 'document.hwpx'; break
          case 'xml': triggerBrowserDownload(exportToXML(blocks), 'document.xml'); savedPath = 'document.xml'; break
          default: throw new Error(`지원하지 않는 형식입니다: ${format}`)
        }
      }

      // 사용자가 저장 다이얼로그에서 취소한 경우
      if (!savedPath) {
        setExportProgress(IDLE_PROGRESS)
        return
      }

      // ── 완료 처리 (90~100%)
      setP(90, '파일 저장 완료 중...')
      await new Promise(r => setTimeout(r, 120))
      setP(100, '완료!')

      updateExportProgress({
        phase: 'success',
        percent: 100,
        message: '저장 완료',
        savedPath,
      })

      // ✅ 성공 시에만 confetti
      confetti({
        particleCount: 70,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#8b5cf6', '#06b6d4', '#ec4899', '#10b981'],
      })

      // 2초 후 최소화 상태로 전환 (성공 메시지 유지)
      setTimeout(() => {
        setExportMinimized(true)
        // 추가 2초 후 완전히 닫기
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
