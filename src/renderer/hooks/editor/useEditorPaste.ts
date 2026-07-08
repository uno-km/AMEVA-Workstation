import { useCallback } from 'react'
import type { AmevaEditor } from '../../editor/amevaBlockSchema'
import type { EditorMode } from '../../../shared/types'

export function useEditorPaste(editor: AmevaEditor | null, editorMode: EditorMode) {
  const onPasteCapture = useCallback(async (e: React.ClipboardEvent) => {
    if (!editor || editorMode !== 'edit') return
    let text = e.clipboardData.getData('text/plain')
    if (!text) return
    text = text.trim()

    // [FIX-YT-001] YouTube Shorts (/shorts/VIDEO_ID) 패턴을 우선 체크
    const shortsMatch = text.match(/youtube\.com\/shorts\/([\w-]{11})/)
    const ytRegex = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([\w-]{11})(?:\S+)?$/
    const ytMatch = text.match(ytRegex)
    const isUrl = /^https?:\/\/[^\s]+$/.test(text)

    if (shortsMatch || ytMatch) {
      // YouTube URL → youtube 블록으로 삽입
      e.preventDefault()
      e.stopPropagation()
      const videoId = shortsMatch?.[1] || ytMatch?.[1] || ''
      editor.insertBlocks(
        [{ type: 'youtube', props: { url: text, videoId } }],
        editor.getTextCursorPosition().block,
        'after'
      )
    } else if (isUrl) {
      // 일반 URL → linkPreview 블록으로 삽입 후 메타데이터 fetch
      e.preventDefault()
      e.stopPropagation()
      const newBlock = {
        type: 'linkPreview',
        props: { url: text, title: 'Loading preview...', description: '웹 페이지 정보를 불러오는 중입니다...', thumbnail: '' }
      }
      editor.insertBlocks([newBlock as any], editor.getTextCursorPosition().block, 'after')

      try {
        const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(text)}`)
        if (res.ok) {
          const data = await res.json()
          const html = data.contents
          const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
          const ogTitleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i)
          const ogDescMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i)
          const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)
          const ogImageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)

          const title = ogTitleMatch?.[1] || titleMatch?.[1] || text
          const description = ogDescMatch?.[1] || descMatch?.[1] || '설명이 제공되지 않는 웹페이지입니다.'
          let thumbnail = ogImageMatch?.[1] || ''
          if (thumbnail && thumbnail.startsWith('/')) {
            const urlObj = new URL(text)
            thumbnail = `${urlObj.protocol}//${urlObj.host}${thumbnail}`
          }

          const nextBlock = editor.getTextCursorPosition().nextBlock
          if (nextBlock && nextBlock.type === 'linkPreview' && nextBlock.props.url === text) {
            editor.updateBlock(nextBlock, { props: { ...nextBlock.props, title, description, thumbnail } as any })
          }
        }
      } catch (err) {
        console.error('linkPreview fetch failed:', err)
      }
    } else if (text.includes('=') && /[0-9+\-*/().\s]+=/.test(text) && text.length < 100) {
      // 계산기 결과값처럼 보이는 패턴이면 (예: 12 + 34 = 46) 인용구로 예쁘게 삽입
      e.preventDefault()
      e.stopPropagation()
      editor.insertBlocks([
        { type: 'paragraph', content: '' },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: '🧮 계산 결과: ', styles: { bold: true } as any },
            { type: 'text', text, styles: { textColor: 'blue' } as any }
          ]
        }
      ], editor.getTextCursorPosition().block, 'after')
    }
  }, [editor, editorMode])

  return { onPasteCapture }
}
