import { useCallback, useEffect } from 'react'
import type { AmevaEditor } from '../../editor/amevaBlockSchema'
import type { EditorMode } from '../../../shared/types'

export function useEditorDragDrop(editor: AmevaEditor | null, editorMode: EditorMode) {
  const onDropCapture = useCallback(async (e: React.DragEvent) => {
    if (!editor || editorMode !== 'edit') return
    
    let url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain')
    if (!url) return
    url = url.trim()

    // [FIX-YT-001] YouTube Shorts URL (/shorts/) 패턴 추가
    const ytRegex = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/|youtube\.com\/live\/)?([\w-]{11})(?:[?&][^\s]*)?$/
    const ytMatch = url.match(ytRegex)
    // YouTube Shorts는 /shorts/VIDEO_ID 형식
    const shortsMatch = url.match(/youtube\.com\/shorts\/([\w-]{11})/)
    
    // 일반 URL 정규식
    const urlRegex = /^https?:\/\/[^\s]+$/
    const isUrl = urlRegex.test(url)

    if (ytMatch || shortsMatch) {
      e.preventDefault()
      e.stopPropagation()
      const videoId = shortsMatch?.[1] || ytMatch?.[1] || ''
      editor.insertBlocks([{
        type: 'youtube',
        props: { url, videoId }
      }], editor.getTextCursorPosition().block, 'after')
    } else if (isUrl) {
      e.preventDefault()
      e.stopPropagation()
      // 일단 Loading preview 상태로 넣음
      const newBlock = {
        type: 'linkPreview',
        props: { url, title: 'Loading preview...', description: '웹 페이지 정보를 불러오는 중입니다...', thumbnail: '' }
      }
      editor.insertBlocks([newBlock as any], editor.getTextCursorPosition().block, 'after')

      // 백그라운드에서 OpenGraph Fetch 시도 (CORS 프록시 사용)
      try {
        const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`)
        if (res.ok) {
          const data = await res.json()
          const html = data.contents
          const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
          const ogTitleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i)
          const ogDescMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i)
          const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)
          const ogImageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)
          
          const title = ogTitleMatch?.[1] || titleMatch?.[1] || url
          const description = ogDescMatch?.[1] || descMatch?.[1] || '설명이 제공되지 않는 웹페이지입니다.'
          let thumbnail = ogImageMatch?.[1] || ''
          if (thumbnail && thumbnail.startsWith('/')) {
            const urlObj = new URL(url)
            thumbnail = `${urlObj.protocol}//${urlObj.host}${thumbnail}`
          }

          const currentBlock = editor.getTextCursorPosition().block
          const nextBlock = editor.getTextCursorPosition().nextBlock
          const targetBlock = (nextBlock?.type === 'linkPreview' && nextBlock.props.url === url) ? nextBlock : 
                              (currentBlock?.type === 'linkPreview' && currentBlock.props.url === url) ? currentBlock : null
          if (targetBlock) {
            editor.updateBlock(targetBlock, { props: { ...targetBlock.props, title, description, thumbnail } as any })
          }
        }
      } catch (err) {
        console.error('Failed to fetch link preview:', err)
      }
    } else if (url.includes('=') && /[0-9+\-*/().\s]+=/.test(url) && url.length < 100) {
      // 계산기 결과값처럼 보이는 패턴이면 (예: 12 + 34 = 46) 인용구로 예쁘게 삽입
      e.preventDefault()
      e.stopPropagation()
      editor.insertBlocks([
        { type: 'paragraph', content: '' },
        { type: 'paragraph', content: [{ type: 'text', text: '🧮 계산 결과: ', styles: { bold: true } as any }, { type: 'text', text: url, styles: { textColor: 'blue' } as any }] }
      ], editor.getTextCursorPosition().block, 'after')
    }
  }, [editor, editorMode])

  useEffect(() => {
    if (!editor || editorMode !== 'edit') return
    const handleInsertYoutube = (e: Event) => {
      const customEvent = e as CustomEvent
      const videoId = customEvent.detail?.videoId
      if (videoId) {
        editor.insertBlocks([{
          type: 'youtube',
          props: { url: `https://youtube.com/watch?v=${videoId}`, videoId }
        }], editor.getTextCursorPosition().block, 'after')
      }
    }
    window.addEventListener('app:insert-youtube', handleInsertYoutube)
    return () => window.removeEventListener('app:insert-youtube', handleInsertYoutube)
  }, [editor, editorMode])

  return { onDropCapture }
}
