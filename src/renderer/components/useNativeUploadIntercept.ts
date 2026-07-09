/**
 * @file useNativeUploadIntercept.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/useNativeUploadIntercept.ts
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

import { useEffect } from 'react'
import { type AmevaEditor } from '../editor/amevaBlockSchema'
import * as ipc from '../services/ipc/electronApiAdapter'

export function useNativeUploadIntercept(
  editor: AmevaEditor | null,
  editorContainerRef: React.RefObject<HTMLDivElement | null>
) {
  useEffect(() => {
    if (!editor || !editorContainerRef.current) return
    const container = editorContainerRef.current

    const isEditorMounted = () => {
      try {
        const view = (editor as any).proseMirrorView || (editor as any)._tiptapEditor?.view
        return !!(view && view.dom && document.body.contains(view.dom))
      } catch {
        return false
      }
    }

    const handleFileUploadIntercept = async (e: MouseEvent) => {
      if (!isEditorMounted()) return

      const target = e.target as HTMLElement
      const button = target.closest('button') || target.closest('[role="button"]') || target.closest('.bn-file-input')
      const isUploadTrigger = !!(button && (
        button.classList.contains('bn-file-input') ||
        button.textContent?.includes('Choose File') || 
        button.textContent?.includes('Upload File') ||
        button.textContent?.includes('Upload Image') ||
        button.textContent?.includes('Upload Video') ||
        button.textContent?.includes('Upload Audio')
      ))

      if (!isUploadTrigger) return

      if (!ipc.isElectronEnv()) return

      e.preventDefault()
      e.stopPropagation()

      const pos = editor.getTextCursorPosition()
      if (!pos?.block) return
      const blockId = pos.block.id
      const blockType = pos.block.type

      let filters: any[] = []
      if (blockType === 'image') {
        filters = [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'] }]
      } else if (blockType === 'video') {
        filters = [{ name: 'Videos', extensions: ['mp4', 'webm', 'ogg', 'mov'] }]
      } else if (blockType === 'audio') {
        filters = [{ name: 'Audios', extensions: ['mp3', 'wav', 'ogg', 'm4a'] }]
      } else {
        filters = [{ name: 'All Files', extensions: ['*'] }]
      }

      try {
        const res = await ipc.selectLocalFile(filters)
        if (res && res.base64) {
          const fileExt = res.filePath.split('.').pop()?.toLowerCase() || 'png'
          
          let mimeType = 'image/png'
          if (blockType === 'image') mimeType = `image/${fileExt === 'svg' ? 'svg+xml' : fileExt}`
          else if (blockType === 'video') mimeType = `video/${fileExt}`
          else if (blockType === 'audio') mimeType = `audio/${fileExt}`
          else mimeType = 'application/octet-stream'

          const dataUrl = `data:${mimeType};base64,${res.base64}`

          editor.updateBlock(blockId, {
            type: blockType as any,
            props: { url: dataUrl } as any
          })
        }
      } catch (err) {
        console.error('Electron file upload intercept failed:', err)
      }
    }

    container.addEventListener('click', handleFileUploadIntercept, true)
    return () => {
      container.removeEventListener('click', handleFileUploadIntercept, true)
    }
  }, [editor, editorContainerRef])
}
