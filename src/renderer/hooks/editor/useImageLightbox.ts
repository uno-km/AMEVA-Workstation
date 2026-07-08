import { useEffect, useState } from 'react'

export function useImageLightbox(editorContainerRef: React.RefObject<HTMLDivElement | null>) {
  const [selectedImg, setSelectedImg] = useState<string | null>(null)

  useEffect(() => {
    if (!editorContainerRef.current) return
    const container = editorContainerRef.current
    const handleImgClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (t.tagName === 'IMG') setSelectedImg((t as HTMLImageElement).src)
    }
    container.addEventListener('click', handleImgClick)
    return () => container.removeEventListener('click', handleImgClick)
  }, [editorContainerRef])

  return { selectedImg, setSelectedImg }
}
