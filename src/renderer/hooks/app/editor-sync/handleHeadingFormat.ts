import type { AmevaEditor as AppEditor, AmevaPartialBlock as AppPartialBlock } from '../../../editor/amevaBlockSchema'

export function handleHeadingFormat(
  editor: AppEditor,
  activeBlockIdRef: React.MutableRefObject<string | null>,
  setActiveBlockId: (id: string | null) => void,
  setIsUpdating: (val: boolean) => void
) {
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
        setIsUpdating(true)
        try {
          editor.updateBlock(activeBlock.id, {
            type: 'heading',
            props: { level: level as any },
            content: [{ type: 'text', text: match[2], styles: {} }]
          } as AppPartialBlock)
        } catch {}
        setIsUpdating(false)
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
            setIsUpdating(true)
            editor.updateBlock(prevId, { content: [{ type: 'text', text: match[2], styles: {} }] } as AppPartialBlock)
            setIsUpdating(false)
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
            setIsUpdating(true)
             editor.updateBlock(currentId, { content: [{ type: 'text', text: prefix + text, styles: {} }] } as AppPartialBlock)
            setIsUpdating(false)
          }
        }
      } catch {}
    }
  }
}
