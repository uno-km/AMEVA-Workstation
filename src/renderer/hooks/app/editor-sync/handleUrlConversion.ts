import type { AmevaEditor as AppEditor } from '../../../editor/amevaBlockSchema'

export function handleUrlConversion(
  editor: AppEditor,
  processedUrlsRef: React.MutableRefObject<Set<string>>
) {
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
            } else if (textVal.includes('youtube.com/shorts/')) {
              // [FIX-YT-001] YouTube Shorts URL 지원
              videoId = textVal.split('/shorts/')[1].split('?')[0]
            } else if (textVal.includes('youtube.com/live/')) {
              videoId = textVal.split('/live/')[1].split('?')[0]
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
}
