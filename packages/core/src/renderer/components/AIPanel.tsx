/**
 * @file AIPanel.tsx
 * @system AMEVA OS Desktop Workstation - Client Renderer
 * @location src/renderer/components/AIPanel.tsx
 * @role Container Component for AI Interaction & Document Outline
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - AI 챗 인터페이스, 빠른 제안(Quick Actions), 문서 아웃라인, 플러그인 뷰의 탭 전환 렌더링을 격리 제어한다.
 * - `useAIPanelLogic` 비즈니스 컨트롤러에 데이터 및 콜백(logicProps)을 바인딩하여 렌더링과 로직을 분리(ADR)한다.
 * - 터미널 컴포넌트와 협업 도구에서 발송되는 Custom Event(`ameva:fill-ai-input`)의 수신기 역할을 수행한다.
 * 
 * [책임이 아닌 것 - NON-RESPONSIBILITY]
 * - LLM 추론 로직 직접 처리, VFS 파일 수정, 에디터 변경 처리 (useAI, useAppAISuggestions 훅에 완전히 위임).
 * - UI 레이아웃의 너비 드래그 제어 (App.tsx 및 AppLayout.tsx가 absolute width를 JS로 강제 조정함).
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST NOT: settings가 화이트 테마인 경우 `isWhiteTheme` 불리언 값을 올바르게 추출해야 하며, CSS variables가 충돌하지 않도록 스타일 분기해야 한다.
 * - MUST: 터미널 챗 또는 에디터 선택 텍스트 주입 이벤트를 구독 및 해제(`addEventListener`/`removeEventListener`)하여 메모리 누수를 완전히 방지할 것.
 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/AppLayout.tsx): 레이아웃 그리드 내부 또는 플로팅 레이어 영역 내에서 그리기로 소비.
 * - 소비처 B (src/renderer/App.tsx): 전역 모달 매니저 및 뷰포트 상태 스위칭에 따라 동적 마운트되어 소비.
 */

/* 
 * [IMPORT SEGMENTATION & CONTRACTS]
 * - useEffect, useState, useRef, useCallback: React 상태 관리 및 DOM 접근 훅.
 * - html2canvas: 탭 스크린샷 캡쳐 라이브러리.
 * - constants: 탭 번역 라벨 및 검색 스타일 상수.
 */
import { useEffect, useState, useRef } from 'react'
import html2canvas from 'html2canvas'
import { UTILITY_TAB_LABELS, HIGHLIGHT_STYLE } from './ai/constants'
/*
 * [IPC CONNECTOR BRIDGE IMPORT]
 * - ipc: Electron Preload IPC 스위치를 통해 캡쳐 이미지 클립보드 복사(clipboardWriteImage) 등을 호출하는 모듈.
 * - Rationale: 일렉트론 네이티브 운영체제 클립보드에 바인딩하여 렌더러와 OS 간 데이터 중계를 안전하게 위임받는다.
 */
import * as ipc from '../services/ipc/electronApiAdapter'

/* 
 * [LUCIDE ICONS]
 * - FileText: 문서 요약 액션 아이콘.
 * - Wand2: 문장 개선 액션 아이콘.
 * - Languages: 번역 액션 아이콘.
 * - Expand: 문장 확장 액션 아이콘.
 * - Lightbulb: 개념 설명 액션 아이콘.
 * - Camera, SearchIcon, ArrowUp, ArrowDown, CloseIcon: 유틸 툴바 제어 아이콘.
 */
import { FileText, Wand2, Languages, Expand, Lightbulb, Camera, Search as SearchIcon, ArrowUp, ArrowDown, X as CloseIcon, FileText as FileTextIcon, Crop } from 'lucide-react'

/* 
 * [PRESENTATION & LOGIC HOOKS]
 * - useAIPanelLogic: 입력 폼 조작, 엔터 키 감지 및 챗 스크롤 동기화 전담 비즈니스 컨트롤러.
 */
import { useAIPanelLogic } from '../hooks/ai/useAIPanelLogic'

/* 
 * [SUB-COMPONENTS]
 * - AIChatList: 에이전트 대화 말풍선 목록 렌더러.
 * - AIPanelHeader: 엔진 요약 및 액션 버튼(휴지통, 설정) 헤더.
 * - AIInputBar: 프롬프트 텍스트 인풋 박스 및 전송/중단 버튼.
 * - AIWelcomeScreen: 대화 이력이 없을 때 노출할 빠른 제안 및 환영 문구 카드.
 * - AIDownloadProgress: 모델 설치 파일 다운로드 진행 바.
 * - AIInputContextBar: 챗 문맥 주입 정보(선택영역, 모델선택, 참고블록) 뱃지 스트립.
 * - AIDocumentOutline: 활성 에디터의 제목 블록 구조 목록.
 * - AIPluginViews: 동적으로 입점하는 플러그인 뷰포트.
 */
import { AIChatList } from './ai-panel/AIChatList'
import { AgentTaskChecklist } from './ai/AgentTaskChecklist'
import { AIPanelHeader } from './ai/AIPanelHeader'
import { AIInputBar } from './ai/AIInputBar'
import { AIWelcomeScreen } from './ai/AIWelcomeScreen'
import { AIDownloadProgress } from './ai/AIDownloadProgress'
import { AIInputContextBar } from './ai/AIInputContextBar'
import { AIDocumentOutline } from './ai/AIDocumentOutline'
import { AIPluginViews } from './ai/AIPluginViews'

/* 
 * [ZUSTAND GLOBAL STORES]
 * - useUIStore: 사이드바 개폐 및 활성 탭 스토어.
 * - useWorkspaceStore: 드래그 텍스트, 태그 블록 스토어.
 * - useProcessStore: 모델 다운로드 상태 스토어.
 */
import { useUIStore } from '../stores/useUIStore'
import { useWorkspaceStore } from '../stores/useWorkspaceStore'
import { useProcessStore } from '../stores/useProcessStore'

/* 
 * [GLOBAL CONTEXT & INTERACTION HOOKS]
 * - useAI: AI 오케스트레이션 훅.
 * - useAppContext: 에디터 테마 정보 동기화 컨텍스트.
 * - useAppAISuggestions: 에디터 내용 반영 훅.
 */
import { useAI } from '../hooks/useAI'
import { useAppContext } from '../contexts/AppContext'
import { useAppAISuggestions } from '../hooks/app/useAppAISuggestions'
import { WebLLMEngine } from '../services/ai/WebLLMEngine'
import { WebCPUEngine } from '../services/ai/WebCPUEngine'

/**
 * AI 패널 상단 환영 화면에 바인딩되는 빠른 작업 템플릿 목록.
 * CONTRACT: 사용자가 문서를 신속하게 보정할 수 있도록 고정된 프롬프트를 AI 에이전트에 발송한다.
 */
const QUICK_ACTIONS = [
  { id: 'summarize', icon: FileText, label: '요약', prompt: '이 문서를 세 문장으로 요약해줘.' },
  { id: 'improve', icon: Wand2, label: '개선', prompt: '더 자연스럽고 전문적인 표현으로 다듬어줘.' },
  { id: 'translate', icon: Languages, label: '번역', prompt: '이 문서를 영어로 번역해줘.' },
  { id: 'expand', icon: Expand, label: '확장', prompt: '이 문장의 내용을 좀 더 풍성하게 확장해줘.' },
  { id: 'explain', icon: Lightbulb, label: '설명', prompt: '이 개념을 쉽게 풀어서 설명해줘.' },
]

/**
 * @component AIPanel
 * @description AI 에이전트 인터랙션 사이드 패널.
 * 챗 인터페이스, 도메인 아웃라인 가이드 및 확장 플러그인 뷰들의 노출 조건 분기를 관장한다.
 */
export function AIPanel() {
  /*
   * [CONTRACT - UI & Workspace States]
   * - isOpen: AI 패널 노출 플래그.
   * - setShowAIPanel: AI 패널 노출 세터.
   * - activeTab: 현재 AI 패널 내부 활성 탭 (ai/outline/plugins).
   * - setIsSettingsOpen: 글로벌 설정 모달 가시성 세터.
   * - showModelHub: 로컬 모델 설치 허브 뷰 토글 플래그.
   * - setToastMessage: 글로벌 토스트 알림 메세지 세터.
   */
  const { showAIPanel: isOpen, setShowAIPanel, activeRightTab: activeTab, setIsSettingsOpen, showModelHub, setToastMessage } = useUIStore()
  
  /*
   * [CONTRACT - Workspace Buffer States]
   * - currentContent: 에디터 전체 마크다운 버퍼.
   * - selectedText: 드래그 드롭/선택 캡처된 텍스트.
   * - setSelectedText: 선택 텍스트 갱신 세터.
   * - activeBlockId: 마우스 포커스된 현재 블록 ID.
   * - taggedBlocks: 태그 지정된 블록 메타 목록.
   * - setTaggedBlocks: 태그 지정 블록 세터.
   */
  const { currentContent, selectedText, setSelectedText, activeBlockId, taggedBlocks, setTaggedBlocks } = useWorkspaceStore()
  
  /*
   * [CONTRACT - Process store values]
   * - downloadStatus: LLM 다운로드 백분율.
   * - setDownloadStatus: 다운로드 진행 세터.
   */
  const { downloadStatus, setDownloadStatus } = useProcessStore()
  
  /*
   * [CONTRACT - Orchestrator Hook Binding]
   * - 로컬 LLM 구동 상태 및 스트리밍 메시지, 모델 임포트 제어부를 불러와 UI 컴포넌트에 공급한다.
   * - Rationale: 이 훅에서 노출되는 state들은 useAI 내부에서 일관되게 동기화된다.
   */
  const {
    messages, isGenerating, isAvailable, models, settings,
    generateResponse, abortGeneration, clearHistory, updateSettings,
    updateMessageDiffState, updateInsertSuggestionStatus, engineLogs,
    refreshModels, pendingQueue, removeFromQueue
  } = useAI()
  
  const [wasmLoading, setWasmLoading] = useState(false)
  const [wasmProgressText, setWasmProgressText] = useState('')

  const handleLoadWasmModel = async () => {
    if (wasmLoading) return
    setWasmLoading(true)
    setWasmProgressText('초기화 준비 중...')
    const modelToLoad = settings.apiModel || 'Llama-3.2-1B-Instruct-q4f16_1-MLC'
    const gpuOnly = settings.gpuOnly ?? true
    try {
      if (gpuOnly) {
        await WebLLMEngine.getInstance().initModel(modelToLoad, (report) => {
          setWasmProgressText(report.text)
        })
      } else {
        await WebCPUEngine.getInstance().initModel(modelToLoad, (report) => {
          setWasmProgressText(report.text)
        })
      }
      setWasmProgressText('로딩 완료!')
    } catch (err: any) {
      console.error('AIPanel 웹LM 로딩 실패:', err)
      setWasmProgressText(`실패: ${err.message || err}`)
    } finally {
      setWasmLoading(false)
    }
  }

  /*
   * [CONTRACT - Application Context Binding]
   * - editor: BlockNote API 참조.
   * - appSettings: 자연 테마 등 렌더러 설정값.
   */
  const { editor, settings: appSettings } = useAppContext()

  /*
   * [RUN-TIME STATE / INVARIANT]
   * - contentRef: Non-AI 유틸리티 탭의 DOM 컨테이너를 가리키는 React Ref. 캡쳐 및 검색어 파싱용.
   * - searchOpen: 검색 입력바의 노출 여부.
   * - searchQuery: 검색어 입력 문자열.
   * - activeIndex: 현재 포커싱된 하이라이트 노드의 인덱스.
   * - highlights: 검색 매칭되어 임시 생성된 mark 엘리먼트 노드 어레이.
   */
  const contentRef = useRef<HTMLDivElement>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [highlights, setHighlights] = useState<HTMLSpanElement[]>([])

  // [FEAT-CROP-CAPTURE] 선택 캡쳐용 마우스 드래그 상태들
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
  }, [isCropMode])

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
      /**
       * 이미지 로드가 완료되었을 때 실행할 콜백 함수
       * - Expected Value Flow: img.onload 이벤트 발생 -> crop 영역에 따른 canvas 그리기 작업 비동기 시작 -> 클립보드 복사 혹은 다운로드 수행
       * - Rationale: canvas.drawImage 및 clipboardWriteImage 등의 비동기 동작 처리를 위해 async로 핸들러를 바인딩한다.
       */
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
            a.download = `${tabName}_선택캡쳐.png`
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
      setToastMessage(`선택 캡쳐 실패: ${err.message || err}`)
      setTimeout(() => setToastMessage(null), 3000)
    } finally {
      setCropStart(null)
      setCropEnd(null)
      setIsCropMode(false)
    }
  }

  // 탭이 전환되면 검색과 하이라이트 상태를 청결히 리셋한다
  useEffect(() => {
    setSearchOpen(false)
    setSearchQuery('')
    setHighlights([])
    setActiveIndex(0)
  }, [activeTab])

  // 검색어 입력에 맞춰 텍스트 노드를 실시간 순회하여 하이라이팅하는 이펙트
  useEffect(() => {
    if (!contentRef.current) return

    // 1. 기존 하이라이트 노드 전부 복원 (청소 작업)
    const marks = contentRef.current.querySelectorAll('.search-highlight')
    marks.forEach(mark => {
      const parent = mark.parentNode
      if (parent) {
        const textNode = document.createTextNode(mark.textContent || '')
        parent.replaceChild(textNode, mark)
      }
    })
    contentRef.current.normalize()

    // 2. 검색 조건 미달 시 스킵
    if (!searchQuery.trim() || !searchOpen) {
      setHighlights([])
      setActiveIndex(0)
      return
    }

    // 3. 신규 텍스트 노드 탐색 및 mark 태그 인젝션
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
            
            // 재귀적으로 남은 영역 파싱
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

  // 활성 하이라이트 인덱스 이동 시 포커싱 스타일 주입 및 스크롤 포커스 이동
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

  // [📸 캡쳐 기능 구현] - html2canvas로 탭 본문 영역 캡쳐 후 클립보드 복사
  const handleCapture = async () => {
    if (!contentRef.current) return
    try {
      const webviewEl = contentRef.current.querySelector('webview') as any
      let url = ''
      
      if (webviewEl && typeof webviewEl.capturePage === 'function') {
        // [FEAT-WEBVIEW-CAPTURE] 일렉트론 webview 내장 API를 사용하여 Same-Origin 차단을 우회 캡쳐
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
        a.download = `${tabName}_캡쳐.png`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setToastMessage('화면이 파일로 다운로드되었습니다!')
      }
      setTimeout(() => setToastMessage(null), 3000)
    } catch (err: any) {
      console.error('[AIPanel] Capture failed:', err)
      setToastMessage(`캡쳐 실패: ${err.message || err}`)
      setTimeout(() => setToastMessage(null), 3000)
    }
  }

  // [📝 본문에 넣기 기능 구현] - 각 유틸리티 탭별 정보 추출 후 에디터 전달
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
        text = `### 📝 문서 목차\n\n> ${contentRef.current.innerText.trim().replace(/\n/g, '\n> ')}`
      }
    } else if (activeTab === 'calculator') {
      const textLines = contentRef.current.innerText.split('\n').map(l => l.trim()).filter(Boolean);
      if (textLines.length > 0) {
        text = '### 🧮 계산기 연산 기록 및 결과\n\n' + textLines.map(l => `> ${l}`).join('\n')
      } else {
        text = `### 🧮 계산 결과: **${contentRef.current.innerText.trim()}**`
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
          tableLines.push(`| ${name} | ${price} | ${change} |`);
        }
      });
      if (tableLines.length > 0) {
        text = [
          '### 📊 금융 시장 시세 현황',
          `> 조회 기준: ${new Date().toLocaleString('ko-KR')}`,
          '',
          '| 종목/지수 | 현재가 | 등락률 |',
          '| :--- | :--- | :--- |',
          ...tableLines
        ].join('\n')
      } else {
        text = `### 📊 금융 대시보드\n\n> ${contentRef.current.innerText.trim().replace(/\n/g, '\n> ')}`
      }
    } else {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `webviewEl`
       * - 자료형 / 예상 값: contentRef 하위에서 검색된 HTML webview 엘리먼트 객체 또는 null.
       * - 시나리오: 동적 브라우저 플러그인 내부의 활성 웹페이지 제목 및 URL 추출에 소비됨.
       */
      const webviewEl = contentRef.current.querySelector('webview') as any
      if (webviewEl) {
        try {
          const currentUrl = webviewEl.getURL ? webviewEl.getURL() : ''
          const currentTitle = webviewEl.getTitle ? webviewEl.getTitle() : ''
          if (currentUrl) {
            text = [
              `### 🌐 [웹 정보] ${currentTitle || '참조 페이지'}`,
              `> 출처: [바로가기](${currentUrl}) · 수집 시점: ${new Date().toLocaleString('ko-KR')}`,
              `>`,
              `> *브라우저 플러그인 탭에서 활성화된 웹 정보가 에디터 본문으로 연동되었습니다.*`
            ].join('\n')
          }
        } catch (e) {
          console.error('[Webview Info Extraction Failed]', e)
        }
      }

      if (!text) {
        text = `### ℹ️ ${UTILITY_TAB_LABELS[activeTab as keyof typeof UTILITY_TAB_LABELS] || activeTab} 정보\n\n> ${contentRef.current.innerText.trim().replace(/\n/g, '\n> ')}`
      }
    }

    if (text) {
      window.dispatchEvent(new CustomEvent('ameva:insert-text', { detail: text }))
      setToastMessage('에디터 본문에 정보가 정상적으로 삽입되었습니다!')
      setTimeout(() => setToastMessage(null), 3000)
    }
  }

  /*
   * [INVARIANT - Editor Document Sync]
   * - blocks: 에디터 내 활성 노드들의 리스트.
   */
  const blocks = editor?.document || []
  
  /* 
   * [ADR - AI Suggestion Apply Binding]
   * - AI의 EDIT_SUGGESTION 또는 INSERT_SUGGESTION 반영 이벤트를 에디터 API에 직접 위임 전파한다.
   */
  const { handleApplySuggestion, handleApplyInsertSuggestion } = useAppAISuggestions(editor, updateInsertSuggestionStatus)

  /*
   * [CONTRACT - Local Action Handlers Mapping]
   * - onApplySuggestion: 에디터 텍스트 EDIT 덮어쓰기 트리거.
   * - onApplyInsertSuggestion: 에디터 텍스트 INSERT 추가 트리거.
   * - onUpdateDiffState: Diff 모달 상태 갱신.
   * - onUpdateInsertSuggestionStatus: 삽입 결과 갱신.
   * - onClearSelectedText: 드래그 캡처 영역 초기화.
   * - onOpenGlobalSettings: 설정 창 탭 강제 열기.
   * - onClose: AI 패널 가시성 끄기.
   * - onClear: 대화 비우기 콜백.
   */
  const onApplySuggestion = handleApplySuggestion
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `onApplyInsertSuggestion`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const onApplyInsertSuggestion = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const onApplyInsertSuggestion = handleApplyInsertSuggestion
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `onUpdateDiffState`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const onUpdateDiffState = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const onUpdateDiffState = updateMessageDiffState
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `onUpdateInsertSuggestionStatus`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const onUpdateInsertSuggestionStatus = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const onUpdateInsertSuggestionStatus = updateInsertSuggestionStatus
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `onClearSelectedText`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const onClearSelectedText = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const onClearSelectedText = () => setSelectedText('')
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `onOpenGlobalSettings`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const onOpenGlobalSettings = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const onOpenGlobalSettings = (tab: any) => setIsSettingsOpen(true, tab)
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `onClose`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const onClose = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const onClose = () => setShowAIPanel(false)
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `onClear`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const onClear = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const onClear = clearHistory
  
  /**
   * [SIDE EFFECT - Send AI Prompt]
   * - LLM 추론 생성 응답을 촉발하고, 태그 지정된 블록 버퍼를 비운다.
   * - Rationale: taggedBlocks가 전역에서 계속 남아있어 발생하는 오작동을 방지하고자 전송 직후 즉각 리셋(Invariant)한다.
   */
  const onSend = (msg: string, ctx?: string, orig?: string, bId?: string, runtimeSettings?: any) => {
    generateResponse(msg, ctx, orig, bId, runtimeSettings, editor, taggedBlocks)
    setTaggedBlocks([])
  }

  /**
   * [CONTRACT - useAIPanelLogic Bridge]
   * - Rationale: 비즈니스 로직과 UI 컴포넌트의 결합도를 차단하기 위한 logicProps 어레이.
   */
  const logicProps = {
    messages, engineLogs, taggedBlocks, isOpen, settings,
    blocks, currentContent, selectedText, activeBlockId,
    onSend, showModelHub, refreshModels, setDownloadStatus,
    onUpdateSettings: updateSettings, setTaggedBlocks
  }

  /*
   * [LOGIC PROPERTIES INJECTION]
   * - input: 챗 텍스트 입력값.
   * - setInput: 인풋 문자열 세터.
   * - manualMode: AI 에이전트 도구 수동 확인 모드 토글 플래그.
   * - setManualMode: 수동 모드 변경 세터.
   * - useContext: 챗 전송 시 문서 맥락 주입 여부.
   * - setUseContext: 맥락 주입 토글 세터.
   * - gpuName: 감지된 디바이스 GPU 네임 문자열.
   * - textareaRef: 인풋 텍스트 에어리어 DOM 포커싱용 참조값.
   * - messagesContainerRef: 챗 영역 스크롤 제어용 래퍼 DOM 참조값.
   * - messagesEndRef: 챗 최하단 자동 스크롤 추적 더미 엘리먼트 참조값.
   * - handleSend: 전송 트리거 핸들러.
   * - handleKeyDown: 엔터 키 전송 및 시프트 엔터 개행 감지 핸들러.
   * - handleQuickAction: 요약/번역 등 프롬프트 단축 단추 트리거.
   */
  const {
    input, setInput, manualMode, setManualMode, useContext, setUseContext, gpuName,
    textareaRef, messagesContainerRef, messagesEndRef,
    handleSend, handleKeyDown, handleQuickAction
  } = useAIPanelLogic(logicProps)

  /**
   * [SIDE EFFECT INTENTIONAL - IPC Terminal Text Injector]
   * - ConsoleContextMenu 등 외부 윈도우 단축 메뉴에서 유입되는 'ameva:fill-ai-input' 이벤트를 감청하여,
   *   마우스 드래그된 터미널 텍스트를 AI 챗 인풋 창에 강제로 주입 및 포커스를 위치시킨다.
   * - CONTRACT: useEffect 내 이벤트 리스너 제거를 수행하여 렌더러의 메모리 누수를 원천 방지한다.
   */
  useEffect(() => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `handler`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const handler = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const handler = (e: Event) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `text`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const text = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const text = (e as CustomEvent).detail as string
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `text`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (text)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (text) {
        setInput(text)
        setTimeout(() => {
          textareaRef?.current?.focus()
        }, 50)
      }
    }
    window.addEventListener('ameva:fill-ai-input', handler)
    return () => window.removeEventListener('ameva:fill-ai-input', handler)
  }, [setInput, textareaRef])

  // 플랜 리뷰 피드백 요청 시 챗 인풋에 접두사 작성 및 포커스 동기화
  useEffect(() => {
    const handler = () => {
      setInput('[계획 리뷰] ')
      setTimeout(() => {
        textareaRef?.current?.focus()
      }, 50)
    }
    window.addEventListener('ameva:review-plan-request', handler)
    return () => window.removeEventListener('ameva:review-plan-request', handler)
  }, [setInput, textareaRef])

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!isOpen`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!isOpen)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
  if (!isOpen) return null

  /*
   * [THEME MODE VARIABLE]
   * - isWhiteTheme: 스킨이 화이트 모드인지 판별.
   */
  const isWhiteTheme = appSettings?.theme === 'white'

  /*
   * [ENGINE LABEL DISPLAY]
   * - displayModelLabel: 화면 최상단에 마킹할 모델 명칭 지표.
   */
  const displayModelLabel = settings.apiType === 'wasm' && !settings.gpuOnly
    ? '경량 가상 CPU 안내 엔진'
    : (settings.apiModel || (gpuName ? `GPU: ${gpuName}` : 'auto'))

  return (
    <div 
      className="ai-panel"
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
      }}
      onDrop={(e) => {
        e.preventDefault()
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `url`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const url = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        let url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain')
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `url`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (url)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (url) {
          setInput((prev: string) => prev + (prev ? ' ' : '') + url.trim())
        }
      }}
      style={{
        width: '100%', height: '100%',
        background: 'var(--bg-main)', borderLeft: '1px solid var(--border-muted)',
        display: 'flex', flexDirection: 'column', position: 'relative',
        fontFamily: 'var(--font-sans)', zIndex: 100,
      }}>

      {activeTab === 'ai' ? (
        <>
          <AIPanelHeader 
            title={settings.apiType === 'wasm' ? 'Local Edge' : settings.apiType === 'local' ? 'Native Core' : settings.apiType === 'ollama' ? 'Ollama' : 'Cloud API'}
            providerLabel={settings.apiType === 'api' 
              ? (settings.apiProvider === 'gemini' ? 'Google Gemini' : settings.apiProvider === 'anthropic' ? 'Anthropic Claude' : 'OpenAI GPT') 
              : (settings.apiType === 'local' 
                  ? 'Llama.cpp' 
                  : (settings.apiType === 'ollama' 
                      ? 'Local Server' 
                      : (settings.gpuOnly ? 'WebGPU' : 'Wasm CPU')))}
            modelLabel={displayModelLabel}
            isGenerating={isGenerating}
            onOpenSettings={() => onOpenGlobalSettings?.('AIEngine')}
            onClearMessages={onClear}
            onClose={onClose}
          />

          {messages.length === 0 ? (
            <AIWelcomeScreen QUICK_ACTIONS={QUICK_ACTIONS} isAvailable={isAvailable} onAction={handleQuickAction} />
          ) : (
            <div ref={messagesContainerRef} style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column' }}>
              <AgentTaskChecklist />
              <AIChatList
                messages={messages}
                messagesContainerRef={messagesContainerRef}
                messagesEndRef={messagesEndRef}
                onApplySuggestion={onApplySuggestion}
                onUpdateDiffState={onUpdateDiffState}
                onApplyInsertSuggestion={onApplyInsertSuggestion}
                onUpdateInsertSuggestionStatus={onUpdateInsertSuggestionStatus}
                isWhiteTheme={isWhiteTheme}
                blocks={blocks}
                selectedText={selectedText}
              />
              <div ref={messagesEndRef} />
            </div>
          )}

          <AIDownloadProgress 
            downloadStatus={downloadStatus} 
            onCancel={() => {}} 
            onShowDetails={() => {}} 
          />

          <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border-muted)', background: 'var(--bg-main)' }}>
            {settings.apiType === 'wasm' && !isAvailable && (
              <div style={{
                marginBottom: '10px',
                padding: '10px 12px',
                background: 'rgba(168, 85, 247, 0.08)',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                boxSizing: 'border-box'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#c084fc', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    ⚡ 웹LM 오프라인 모델 미연결
                  </span>
                  <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={wasmProgressText}>
                    {wasmLoading 
                      ? `${wasmProgressText || '초기화 준비...'}` 
                      : '오프라인 웹LM 모델을 로드해야 대화가 가능합니다.'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleLoadWasmModel}
                  disabled={wasmLoading}
                  style={{
                    background: '#a855f7',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '10px',
                    fontWeight: 700,
                    cursor: wasmLoading ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 2px 8px rgba(168, 85, 247, 0.4)',
                    transition: 'all 0.15s ease',
                    flexShrink: 0
                  }}
                  onMouseEnter={e => !wasmLoading && (e.currentTarget.style.filter = 'brightness(1.15)')}
                  onMouseLeave={e => !wasmLoading && (e.currentTarget.style.filter = 'none')}
                >
                  {wasmLoading ? '로딩 중...' : '모델 연결하기'}
                </button>
              </div>
            )}

            {/* [FEAT-MODEL-SELECT] 가용 로컬/Ollama AI 모델 선택기 */}
            {models && models.length > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 10px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border-muted)',
                borderRadius: '6px',
                marginBottom: '8px',
                flexShrink: 0
              }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  🤖 모델 선택:
                </span>
                <select
                  value={settings.modelPath || ''}
                  onChange={(e) => {
                    const val = e.target.value
                    updateSettings({ modelPath: val })
                    if (settings.apiType === 'ollama') {
                      updateSettings({ apiModel: val })
                    }
                    setToastMessage(`추론 모델이 변경되었습니다: ${val.split('/').pop() || val}`)
                    setTimeout(() => setToastMessage(null), 2000)
                  }}
                  style={{
                    flex: 1,
                    background: 'var(--bg-main, #0f0f12)',
                    border: 'none',
                    color: 'var(--text-main)',
                    fontSize: '11px',
                    padding: '2px 4px',
                    outline: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  {models.map((m: any) => (
                    <option key={m.path} value={m.path} style={{ background: 'var(--bg-main, #0f0f12)' }}>
                      {m.name || m.filename}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <AIInputContextBar
              manualMode={manualMode} setManualMode={setManualMode}
              selectedText={selectedText} onClearSelectedText={onClearSelectedText}
              useContext={useContext} setUseContext={setUseContext}
              taggedBlocks={taggedBlocks} setTaggedBlocks={setTaggedBlocks}
              pendingQueue={pendingQueue} removeFromQueue={removeFromQueue}
              models={models} apiModel={settings.apiModel} onModelChange={() => {}}
            />
            
            <AIInputBar
              value={input}
              disabled={!isAvailable}
              isGenerating={isGenerating}
              placeholder={isAvailable ? '메시지를 입력하세요...' : (settings.apiType === 'wasm' ? '웹LM 모델 연결이 필요합니다.' : '준비중...')}
              textareaRef={textareaRef}
              onChange={setInput}
              onSubmit={handleSend}
              onAbort={abortGeneration}
              onKeyDown={handleKeyDown}
              selectedText={selectedText}
            />
          </div>
        </>
      ) : (
        <>
          {/* Non-AI 유틸리티 탭 공통 헤더 툴바 */}
          <div style={{ display: 'flex', flexDirection: 'column', borderBottom: '1px solid var(--border-muted)', background: 'var(--bg-main)', flexShrink: 0 }}>
            {/* 상단 툴바 행 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', height: '40px', boxSizing: 'border-box' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)' }}>
                {UTILITY_TAB_LABELS[activeTab as keyof typeof UTILITY_TAB_LABELS] || activeTab}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  onClick={handleCapture}
                  title="📸 전체 캡쳐"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', display: 'flex', transition: 'color 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--text-main)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                  <Camera size={14} />
                </button>
                <button
                  onClick={() => setIsCropMode(true)}
                  title="✂️ 선택 영역 캡쳐"
                  style={{ 
                    background: isCropMode ? 'var(--primary-glow, rgba(99, 102, 241, 0.2))' : 'none', 
                    border: 'none', 
                    cursor: 'pointer', 
                    color: isCropMode ? 'var(--primary)' : 'var(--text-muted)', 
                    padding: '4px', 
                    display: 'flex', 
                    transition: 'color 0.15s',
                    borderRadius: '4px'
                  }}
                  onMouseEnter={e => !isCropMode && (e.currentTarget.style.color = 'var(--text-main)')}
                  onMouseLeave={e => !isCropMode && (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  <Crop size={14} />
                </button>
                <button
                  onClick={() => setSearchOpen(!searchOpen)}
                  title="🔍 텍스트 검색"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: searchOpen ? 'var(--primary)' : 'var(--text-muted)', padding: '4px', display: 'flex', transition: 'color 0.15s' }}
                  onMouseEnter={e => !searchOpen && (e.currentTarget.style.color = 'var(--text-main)')}
                  onMouseLeave={e => !searchOpen && (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  <SearchIcon size={14} />
                </button>
                <button
                  onClick={handleInsertToEditor}
                  title="📝 본문에 넣기"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', display: 'flex', transition: 'color 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--text-main)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                  <FileTextIcon size={14} />
                </button>
                <div style={{ width: '1px', height: '12px', background: 'var(--border-muted)', margin: '0 2px' }} />
                <button
                  onClick={onClose}
                  title="닫기"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', display: 'flex', transition: 'color 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                  <CloseIcon size={14} />
                </button>
              </div>
            </div>

            {/* 검색 입력바 행 (토글 시 노출) */}
            {searchOpen && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px 8px', borderTop: '1px solid var(--border-muted)', background: 'var(--bg-glass)', animation: 'slideDown 0.15s ease-out' }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="검색어 입력..."
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (e.shiftKey) {
                        setActiveIndex(prev => highlights.length > 0 ? (prev - 1 + highlights.length) % highlights.length : 0);
                      } else {
                        setActiveIndex(prev => highlights.length > 0 ? (prev + 1) % highlights.length : 0);
                      }
                    }
                  }}
                  style={{
                    flex: 1, padding: '4px 8px', borderRadius: '4px',
                    background: 'var(--bg-main)', border: '1px solid var(--border-muted)',
                    color: 'var(--text-main)', fontSize: '10.5px', outline: 'none'
                  }}
                />
                {highlights.length > 0 && (
                  <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)' }}>
                    {activeIndex + 1} / {highlights.length}
                  </span>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <button
                    disabled={highlights.length === 0}
                    onClick={() => setActiveIndex(prev => highlights.length > 0 ? (prev - 1 + highlights.length) % highlights.length : 0)}
                    style={{ background: 'none', border: 'none', cursor: highlights.length > 0 ? 'pointer' : 'not-allowed', color: highlights.length > 0 ? 'var(--text-main)' : 'var(--text-muted)', padding: '2px', display: 'flex' }}
                  >
                    <ArrowUp size={12} />
                  </button>
                  <button
                    disabled={highlights.length === 0}
                    onClick={() => setActiveIndex(prev => highlights.length > 0 ? (prev + 1) % highlights.length : 0)}
                    style={{ background: 'none', border: 'none', cursor: highlights.length > 0 ? 'pointer' : 'not-allowed', color: highlights.length > 0 ? 'var(--text-main)' : 'var(--text-muted)', padding: '2px', display: 'flex' }}
                  >
                    <ArrowDown size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 유틸 탭 내용부 (ref 바인딩으로 캡쳐 및 검색 범위 적용) */}
          <div 
            ref={contentRef} 
            style={{ 
              flex: 1, 
              overflowY: 'auto', 
              display: 'flex', 
              flexDirection: 'column',
              position: 'relative'
            }}
          >
            {/* [FEAT-CROP-CAPTURE-UI] 선택 영역 캡쳐 드래그 오버레이 */}
            {isCropMode && (
              <div
                onMouseDown={handleCropMouseDown}
                onMouseMove={handleCropMouseMove}
                onMouseUp={handleCropMouseUp}
                style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0, bottom: 0,
                  zIndex: 999,
                  background: 'rgba(0, 0, 0, 0.45)',
                  cursor: 'crosshair',
                  userSelect: 'none'
                }}
              >
                {/* 헬퍼 안내 문구 */}
                <div style={{
                  position: 'absolute',
                  top: '10px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'rgba(0,0,0,0.85)',
                  color: '#fff',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '10.5px',
                  pointerEvents: 'none',
                  border: '1px solid rgba(255,255,255,0.15)',
                  zIndex: 1000
                }}>
                  마우스로 캡쳐할 영역을 드래그하세요 (Esc로 취소)
                </div>

                {/* 드래그 크롭 영역 하이라이트 */}
                {cropStart && cropEnd && (
                  <div
                    style={{
                      position: 'absolute',
                      left: Math.min(cropStart.x, cropEnd.x),
                      top: Math.min(cropStart.y, cropEnd.y),
                      width: Math.abs(cropStart.x - cropEnd.x),
                      height: Math.abs(cropStart.y - cropEnd.y),
                      border: '2px solid #a855f7',
                      boxShadow: '0 0 12px rgba(168,85,247,0.6), 0 0 0 9999px rgba(0,0,0,0.3)',
                      pointerEvents: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                )}
              </div>
            )}

            {activeTab === 'outline' && <AIDocumentOutline blocks={blocks} />}
            {activeTab !== 'outline' && <AIPluginViews activeTab={activeTab} />}
          </div>
        </>
      )}
    </div>
  )
}

/**
 * ============================================================================
 * FUTURE DEVELOPMENT GUIDE (AI Agent Instruction Layer)
 * ============================================================================
 * 1. 신규 퀵 액션 프롬프트를 추가하거나 동작 양식을 확장할 때:
 *    - `QUICK_ACTIONS` 상수 배열을 확장하여 지정된 icon, label, prompt 형식을 맞출 것.
 * 
 * 2. 아웃라인 외에 새로운 분석 탭(예: 감성 분석, 통계 등)을 추가할 때:
 *    - `activeTab` 조건 분기에 따라 렌더링되는 컴포넌트를 하단 분기문에 추가할 것.
 *    - 해당 컴포넌트는 `src/renderer/components/ai/` 내에 모듈화하여 저장할 것.
 * 
 * 3. 챗 리스트의 레이아웃이나 버그 발생 시 점검 순서:
 *    - `AIChatList`의 프롭 구조가 변경되었는지, `isWhiteTheme` 색상 매칭이 잘 깨지는 CSS 클래스가 있는지 확인.
 *    - `messagesContainerRef` 높이 스크롤이 자동으로 가장 아래로 포커싱되지 않을 때,
 *      `AIChatList` 마운트 라이프사이클의 스크롤 함수가 정상 작동하는지 점검.
 * ============================================================================
 */

