import { useEffect, useRef } from 'react'
import { useWorkspaceStore } from '../../stores/useWorkspaceStore'
import { convertJupyterToCodeBlocks } from '../../utils/markdownUtils'
import { type AmevaEditor as AppEditor, type AmevaPartialBlock as AppPartialBlock } from '../../editor/amevaBlockSchema'

export function useAppEditorSync({
  editor,
  setActiveBlockId,
  setCurrentContent,
  currentContent,
  autoSnapshot,
  createSnapshot,
}: {
  editor: AppEditor | null
  setActiveBlockId: (id: string | null) => void
  setCurrentContent: (content: string) => void
  currentContent: string
  autoSnapshot: boolean
  createSnapshot: (title: string, content?: string) => void
}) {
  const activeBlockIdRef = useRef<string | null>(null)
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const processedUrlsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!editor) return
    let isUpdating = false

    const handleEditorChange = async () => {
      if (isUpdating) return

      const cursor = editor.getTextCursorPosition()
      let currentId: string | null = null

      if (cursor?.block) {
        const activeBlock = cursor.block
        currentId = activeBlock.id

        if (activeBlock.type === 'paragraph') {
          const text = activeBlock.content ? (activeBlock.content as any).map((c: any) => c.text).join('') : ''
          const match = text.match(/^(#{1,3})([^\s#].*)$/)
          if (match) {
            const level = match[1].length
            isUpdating = true
            try {
              editor.updateBlock(activeBlock.id, {
                type: 'heading',
                props: { level: level as any },
                content: [{ type: 'text', text: match[2], styles: {} }]
              } as AppPartialBlock)
            } catch {}
            isUpdating = false
          }
        }
      }

      if (currentId !== activeBlockIdRef.current) {
        const prevId = activeBlockIdRef.current
        activeBlockIdRef.current = currentId
        setActiveBlockId(currentId)

        if (prevId) {
          try {
            const prevBlock = editor.getBlock(prevId)
            if (prevBlock?.type === 'heading') {
              const text = prevBlock.content ? (prevBlock.content as any).map((c: any) => c.text).join('') : ''
              const match = text.match(/^(#{1,3}\s)(.*)$/)
              if (match) {
                isUpdating = true
                editor.updateBlock(prevId, { content: [{ type: 'text', text: match[2], styles: {} }] } as AppPartialBlock)
                isUpdating = false
              }
            }
          } catch {}
        }

        if (currentId) {
          try {
            const currentBlock = editor.getBlock(currentId)
            if (currentBlock?.type === 'heading') {
              const level = (currentBlock.props as any)?.level || 1
              const text = currentBlock.content ? (currentBlock.content as any).map((c: any) => c.text).join('') : ''
              const prefix = level === 1 ? '# ' : level === 2 ? '## ' : '### '
              if (!text.startsWith(prefix)) {
                isUpdating = true
                 editor.updateBlock(currentId, { content: [{ type: 'text', text: prefix + text, styles: {} }] } as AppPartialBlock)
                isUpdating = false
              }
            }
          } catch {}
        }
      }

      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)

      syncTimeoutRef.current = setTimeout(async () => {
        if (isUpdating) return
        isUpdating = true

        try {
          const cursor = editor.getTextCursorPosition()
          const activeBlock = cursor?.block
          if (activeBlock && activeBlock.type === 'paragraph') {
            const contentArr = activeBlock.content as any[]
            if (contentArr && contentArr.length === 1 && contentArr[0].type === 'text') {
              const textVal = contentArr[0].text.trim()
              const urlPattern = /^(https?:\/\/[^\s]+)$/i
              if (urlPattern.test(textVal)) {
                if (!processedUrlsRef.current.has(activeBlock.id)) {
                  processedUrlsRef.current.add(activeBlock.id)

                  const blockId = activeBlock.id
                  let videoId = ''
                  if (textVal.includes('youtube.com/watch?v=')) {
                    videoId = textVal.split('watch?v=')[1].split('&')[0]
                  } else if (textVal.includes('youtu.be/')) {
                    videoId = textVal.split('youtu.be/')[1].split('?')[0]
                  }

                  if (videoId) {
                    editor.updateBlock(blockId, {
                      type: 'youtube',
                      props: { url: textVal, videoId: videoId }
                    })
                  } else {
                    editor.updateBlock(blockId, {
                      type: 'linkPreview',
                      props: {
                        url: textVal,
                        title: 'Loading preview...',
                        description: 'URL 프리뷰 데이터를 페치하고 있습니다...',
                        thumbnail: ''
                      }
                    })

                    if ((window as any).electronAPI?.fetchUrlMetadata) {
                      (window as any).electronAPI.fetchUrlMetadata(textVal).then((metadata: any) => {
                        try {
                          editor.updateBlock(blockId, {
                            type: 'linkPreview',
                            props: {
                              url: textVal,
                              title: metadata.title || 'Untitled Page',
                              description: metadata.description || '',
                              thumbnail: metadata.image || ''
                            }
                          })
                        } catch (updateErr) {
                          console.error('Failed to update LinkPreview block with metadata:', updateErr)
                        }
                      }).catch((fetchErr: any) => {
                        try {
                          editor.updateBlock(blockId, {
                            type: 'linkPreview',
                            props: {
                              url: textVal,
                              title: '연결 실패',
                              description: `메타데이터 수집 오류: ${fetchErr.message}`,
                              thumbnail: ''
                            }
                          })
                        } catch {}
                      })
                    }
                  }
                }
              }
            }
          }
        } catch (urlErr) {
          console.error('[URL Auto-Convert Failed]', urlErr)
        }

        let activeHeadingCleared = false
        let activeHeadingText = ''
        const activeId = activeBlockIdRef.current

        if (activeId) {
          try {
            const ab = editor.getBlock(activeId)
            if (ab?.type === 'heading') {
              const text = ab.content ? (ab.content as any).map((c: any) => c.text).join('') : ''
              const match = text.match(/^(#{1,3}\s)(.*)$/)
              if (match) {
                activeHeadingText = text
                 editor.updateBlock(activeId, { content: [{ type: 'text', text: match[2], styles: {} }] } as AppPartialBlock)
                activeHeadingCleared = true
              }
            }
          } catch {}
        }

        try {
          const markdown = await editor.blocksToMarkdownLossy(convertJupyterToCodeBlocks(editor.document))
          if (markdown.trim() !== useWorkspaceStore.getState().currentContent.trim()) setCurrentContent(markdown)
        } catch (err) {
          console.error('Markdown sync failed:', err)
        } finally {
          if (activeHeadingCleared && activeId) {
            try { editor.updateBlock(activeId, { content: [{ type: 'text', text: activeHeadingText, styles: {} }] } as AppPartialBlock) } catch {}
          }
          isUpdating = false
        }
      }, 300)
    }

    editor.onChange(handleEditorChange)

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
    }
  }, [editor, setActiveBlockId, setCurrentContent])

  useEffect(() => {
    if (!autoSnapshot || !currentContent) return
    const id = setInterval(() => createSnapshot(`자동 백업`, currentContent), 3 * 60 * 1000)
    return () => clearInterval(id)
  }, [autoSnapshot, currentContent, createSnapshot])
}
