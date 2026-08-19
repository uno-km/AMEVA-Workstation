import { useState, useEffect, useRef, RefObject } from 'react'
import html2canvas from 'html2canvas'
import { UTILITY_TAB_LABELS, HIGHLIGHT_STYLE } from './ai/constants'
import * as ipc from '../services/ipc/electronApiAdapter'
import { useWorkspaceStore } from '../stores/useWorkspaceStore'

export function useAIPanelUI(
  activeTab: string,
  contentRef: RefObject<HTMLDivElement>,
  setToastMessage: (msg: string | null) => void
) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [highlights, setHighlights] = useState<HTMLSpanElement[]>([])

  const [isCropMode, setIsCropMode] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null)
  const [cropEnd, setCropEnd] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isCropMode) {
        setIsCropMode(false)
        setCropStart(null)
        setCropEnd(null)
        setIsDrawing(false)
        setToastMessage('캡쳐가 취소되었습니다.')
        setTimeout(() => setToastMessage(null), 2000)
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [isCropMode, setToastMessage])

  const handleCropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setCropStart({ x, y })
    setCropEnd({ x, y })
    setIsDrawing(true)
  }

  const handleCropMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !cropStart) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height))
    setCropEnd({ x, y })
  }

  const handleCropMouseUp = async () => {
    if (!isDrawing || !cropStart || !cropEnd) return
    setIsDrawing(false)

    const x1 = Math.min(cropStart.x, cropEnd.x)
    const y1 = Math.min(cropStart.y, cropEnd.y)
    const w = Math.abs(cropStart.x - cropEnd.x)
    const h = Math.abs(cropStart.y - cropEnd.y)

    if (w < 10 || h < 10) {
      setCropStart(null)
      setCropEnd(null)
      setIsCropMode(false)
      return
    }

    try {
      const webviewEl = contentRef.current?.querySelector('webview') as any
      let fullUrl = ''
      
      if (webviewEl && typeof webviewEl.capturePage === 'function') {
        const nativeImage = await webviewEl.capturePage()
        fullUrl = nativeImage.toDataURL()
      } else if (contentRef.current) {
        const canvas = await html2canvas(contentRef.current, {
          useCORS: true,
          backgroundColor: 'var(--bg-main, #0f0f12)',
          scale: 2
        })
        fullUrl = canvas.toDataURL('image/png')
      }

      if (!fullUrl) throw new Error('캡쳐 데이터를 생성하지 못했습니다.')

      const img = new Image()
      img.onload = async () => {
        const canvas = document.createElement('canvas')
        const scaleX = img.width / contentRef.current!.getBoundingClientRect().width
        const scaleY = img.height / contentRef.current!.getBoundingClientRect().height

        canvas.width = w * scaleX
        canvas.height = h * scaleY

        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(
            img,
            x1 * scaleX,
            y1 * scaleY,
            w * scaleX,
            h * scaleY,
            0,
            0,
            w * scaleX,
            h * scaleY
          )
          
          const cropUrl = canvas.toDataURL('image/png')
          
          let copied = false
          if (ipc.isElectronEnv()) {
            copied = await ipc.clipboardWriteImage(cropUrl)
          }

          if (copied) {
            setToastMessage('선택 영역이 클립보드에 복사되었습니다! (Ctrl+V로 에디터에 붙여넣기 가능)')
          } else {
            const a = document.createElement('a')
            a.href = cropUrl
            const tabName = UTILITY_TAB_LABELS[activeTab as keyof typeof UTILITY_TAB_LABELS] || activeTab
            a.download = ${tabName}_선택캡쳐.png
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            setToastMessage('선택 영역이 파일로 다운로드되었습니다!')
          }
          setTimeout(() => setToastMessage(null), 3000)
        }
      }
      img.src = fullUrl
    } catch (err: any) {
      console.error('[AIPanel] Crop capture failed:', err)
      setToastMessage(선택 캡쳐 실패: )
      setTimeout(() => setToastMessage(null), 3000)
    } finally {
      setCropStart(null)
      setCropEnd(null)
      setIsCropMode(false)
    }
  }

  useEffect(() => {
    setSearchOpen(false)
    setSearchQuery('')
    setHighlights([])
    setActiveIndex(0)
  }, [activeTab])

  useEffect(() => {
    if (!contentRef.current) return

    const marks = contentRef.current.querySelectorAll('.search-highlight')
    marks.forEach(mark => {
      const parent = mark.parentNode
      if (parent) {
        const textNode = document.createTextNode(mark.textContent || '')
        parent.replaceChild(textNode, mark)
      }
    })
    contentRef.current.normalize()

    if (!searchQuery.trim() || !searchOpen) {
      setHighlights([])
      setActiveIndex(0)
      return
    }

    const foundMarks: HTMLSpanElement[] = []
    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const val = node.nodeValue || ''
        const idx = val.toLowerCase().indexOf(searchQuery.toLowerCase())
        if (idx >= 0) {
          const parent = node.parentNode
          if (
            parent &&
            parent.nodeName !== 'MARK' &&
            parent.nodeName !== 'SCRIPT' &&
            parent.nodeName !== 'STYLE' &&
            parent.nodeName !== 'TEXTAREA' &&
            parent.nodeName !== 'INPUT'
          ) {
            const mark = document.createElement('mark')
            Object.assign(mark.style, HIGHLIGHT_STYLE)
            mark.className = 'search-highlight'
            
            const matchedText = val.substring(idx, idx + searchQuery.length)
            mark.textContent = matchedText
            
            const afterText = document.createTextNode(val.substring(idx + searchQuery.length))
            node.nodeValue = val.substring(0, idx)
            
            parent.insertBefore(afterText, node.nextSibling)
            parent.insertBefore(mark, afterText)
            foundMarks.push(mark)
            
            walk(afterText)
          }
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element
        if (
          el.tagName !== 'SCRIPT' &&
          el.tagName !== 'STYLE' &&
          !el.classList.contains('search-exclude')
        ) {
          Array.from(node.childNodes).forEach(walk)
        }
      }
    }

    walk(contentRef.current)
    setHighlights(foundMarks)
    setActiveIndex(0)
  }, [searchQuery, searchOpen, activeTab])

  useEffect(() => {
    if (highlights.length === 0) return
    highlights.forEach((h, idx) => {
      if (idx === activeIndex) {
        h.style.backgroundColor = 'var(--primary, #8b5cf6)'
        h.style.color = '#ffffff'
        h.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } else {
        const defaultBg = HIGHLIGHT_STYLE.backgroundColor
        h.style.backgroundColor = typeof defaultBg === 'string' ? defaultBg : 'rgba(250, 204, 21, 0.4)'
        h.style.color = '#ffffff'
      }
    })
  }, [activeIndex, highlights])

  const handleCapture = async () => {
    if (!contentRef.current) return
    try {
      const webviewEl = contentRef.current.querySelector('webview') as any
      let url = ''
      
      if (webviewEl && typeof webviewEl.capturePage === 'function') {
        const nativeImage = await webviewEl.capturePage()
        url = nativeImage.toDataURL()
      } else {
        const canvas = await html2canvas(contentRef.current, {
          useCORS: true,
          backgroundColor: 'var(--bg-main, #0f0f12)',
          scale: 2
        })
        url = canvas.toDataURL('image/png')
      }
      
      if (!url) throw new Error('캡쳐 데이터를 생성하지 못했습니다.')
      
      let copied = false
      if (ipc.isElectronEnv()) {
        copied = await ipc.clipboardWriteImage(url)
      }

      if (copied) {
        setToastMessage('화면 캡쳐본이 클립보드에 복사되었습니다! (Ctrl+V로 에디터에 붙여넣기 가능)')
      } else {
        const a = document.createElement('a')
        a.href = url
        const tabName = UTILITY_TAB_LABELS[activeTab as keyof typeof UTILITY_TAB_LABELS] || activeTab
        a.download = ${tabName}_캡쳐.png
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setToastMessage('화면이 파일로 다운로드되었습니다!')
      }
      setTimeout(() => setToastMessage(null), 3000)
    } catch (err: any) {
      console.error('[AIPanel] Capture failed:', err)
      setToastMessage(캡쳐 실패: )
      setTimeout(() => setToastMessage(null), 3000)
    }
  }

  const handleInsertToEditor = () => {
    if (!contentRef.current) return
    let text = ''
    
    if (activeTab === 'outline') {
      const items = contentRef.current.querySelectorAll('[class*="outline-item"], [data-outline-item]');
      if (items.length > 0) {
        text = '### 📝 문서 목차 구조도\n\n' + Array.from(items).map(el => {
          const style = el.getAttribute('style') || ''
          const padMatch = style.match(/paddingLeft:\s*['"]?(\d+)px['"]?/) || style.match(/padding-left:\s*(\d+)px/)
          const pad = padMatch ? parseInt(padMatch[1], 10) : 0
          const level = Math.floor(pad / 12)
          const prefix = '  '.repeat(level) + '- '
          return prefix + (el.textContent || '').trim()
        }).join('\n')
      } else {
        text = ### 📝 문서 목차\n\n> 
      }
    } else if (activeTab === 'calculator') {
      const textLines = contentRef.current.innerText.split('\n').map(l => l.trim()).filter(Boolean);
      if (textLines.length > 0) {
        text = '### 🧮 계산기 연산 기록 및 결과\n\n' + textLines.map(l => > ).join('\n')
      } else {
        text = ### 🧮 계산 결과: ****
      }
    } else if (activeTab === 'finance' || activeTab === 'finance-dashboard') {
      const rows = contentRef.current.querySelectorAll('div[style*="justify-content: space-between"], [class*="QuoteRow"]');
      const tableLines: string[] = [];
      rows.forEach(row => {
        const textContent = (row.textContent || '').trim();
        const parts = textContent.split(/\s+/).filter(Boolean);
        if (parts.length >= 3) {
          const price = parts[parts.length - 2];
          const change = parts[parts.length - 1];
          const name = parts.slice(0, parts.length - 2).join(' ');
          tableLines.push(|  |  |  |);
        }
      });
      if (tableLines.length > 0) {
        text = [
          '### 📊 금융 시장 시세 현황',
          > 조회 기준: ,
          '',
          '| 종목/지수 | 현재가 | 등락률 |',
          '| :--- | :--- | :--- |',
          ...tableLines
        ].join('\n')
      } else {
        text = ### 📊 금융 대시보드\n\n> 
      }
    } else {
      const webviewEl = contentRef.current.querySelector('webview') as any
      if (webviewEl) {
        try {
          const currentUrl = webviewEl.getURL ? webviewEl.getURL() : ''
          const currentTitle = webviewEl.getTitle ? webviewEl.getTitle() : ''
          if (currentUrl) {
            text = [
              ### 🌐 [웹 정보] ,
              > 출처: [바로가기]() · 수집 시점: ,
              >,
              > *브라우저 플러그인 탭에서 활성화된 웹 정보가 에디터 본문으로 연동되었습니다.*
            ].join('\n')
          }
        } catch (e) {
          console.error('[Webview Info Extraction Failed]', e)
        }
      }

      if (!text) {
        text = ### ℹ️  정보\n\n> 
      }
    }

    if (text) {
      window.dispatchEvent(new CustomEvent('ameva:insert-text', { detail: text }))
      setToastMessage('에디터 본문에 정보가 정상적으로 삽입되었습니다!')
      setTimeout(() => setToastMessage(null), 3000)
    }
  }

  return {
    searchOpen, setSearchOpen, searchQuery, setSearchQuery, activeIndex, setActiveIndex, highlights,
    isCropMode, setIsCropMode, isDrawing, cropStart, cropEnd,
    handleCropMouseDown, handleCropMouseMove, handleCropMouseUp,
    handleCapture, handleInsertToEditor
  }
}