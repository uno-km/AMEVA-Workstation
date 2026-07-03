import { useEffect } from 'react'
import { BlockNoteEditor } from '@blocknote/core'

export function useNativeUploadIntercept(
  editor: BlockNoteEditor | null,
  editorContainerRef: React.RefObject<HTMLDivElement | null>
) {
  useEffect(() => {
    if (!editor || !editorContainerRef.current) return
    const container = editorContainerRef.current

    const isEditorMounted = () => {
      const view = (editor as any).proseMirrorView || (editor as any)._tiptapEditor?.view
      return !!(view && view.dom && document.body.contains(view.dom))
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

      if (!window.electronAPI?.selectLocalFile) return

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
        const res = await window.electronAPI.selectLocalFile(filters)
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
