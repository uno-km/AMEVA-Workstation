import { useEffect, useState, useRef, useCallback } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import type { PeerState } from '../../shared/types'
import * as ipc from '../services/ipc/electronApiAdapter'

export function useCollaboration(
  documentId: string,
  username: string,
  color: string,
  serverPort: number,
  serverHost: string,
  useLocalServer: boolean
) {
  const [provider, setProvider] = useState<WebsocketProvider | null>(null)
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null)
  const [peers, setPeers] = useState<PeerState[]>([])
  const [serverRunning, setServerRunning] = useState(false)
  const [collabActive, setCollabActive] = useState(false)
  const [serverInfo, setServerInfo] = useState<{ port?: number; error?: string }>({})
  const [serverIp, setServerIp] = useState('localhost')
  const [isConnected, setIsConnected] = useState(false)
  // [SEC-W-009] 서버에서 발급한 세션 토큰 보관
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const editorContainerRef = useRef<HTMLDivElement | null>(null)

  const ydocRef = useRef<Y.Doc | null>(null)
  const providerRef = useRef<WebsocketProvider | null>(null)

  // 활성화 조건: 사용자가 명시적으로 협업 시작 버튼을 눌렀을 때(collabActive가 참일 때)
  const isActive = collabActive

  // Y.js Doc 초기화 (히스토리도 여기에 의존)
  useEffect(() => {
    const doc = new Y.Doc()
    ydocRef.current = doc
    setYdoc(doc)
    return () => {
      doc.destroy()
      ydocRef.current = null
    }
  }, [documentId])

  useEffect(() => {
    if (ipc.isElectronEnv()) {
      const unsub = ipc.onServerStatus((status: any) => {
        setServerRunning(status.running)
        setServerInfo({ port: status.port, error: status.error })
        if (status.ip) setServerIp(status.ip)
        // [SEC-W-009] 서버가 발급한 세션 토큰 저장
        if (status.token) setSessionToken(status.token)
        if (!status.running) setSessionToken(null)
        if (useLocalServer && !status.running) setCollabActive(false)
      })
      return () => {
        if (unsub) unsub()
      }
    }
  }, [useLocalServer])

  // 2. WebSocket Provider: 활성화 상태(isActive)일 때 연결
  useEffect(() => {
    if (!isActive || !ydocRef.current) {
      setProvider(prev => {
        if (prev) prev.disconnect()
        return null
      })
      providerRef.current = null
      setPeers([])
      setIsConnected(false)
      return
    }

    const doc = ydocRef.current
    // [SEC-W-009] 로컈 서버일 때 세션 토큰을 URL에 첨부
    const serverUrl = useLocalServer
      ? `ws://${serverHost}:${serverPort}${sessionToken ? `?token=${encodeURIComponent(sessionToken)}` : ''}`
      : (serverHost.startsWith('ws://') || serverHost.startsWith('wss://')
          ? serverHost
          : `wss://${serverHost}`)

    let wsProvider: WebsocketProvider | null = null

    try {
      wsProvider = new WebsocketProvider(serverUrl, `ameva-doc-${documentId}`, doc, {
        connect: true,
      })

      setProvider(wsProvider)
      providerRef.current = wsProvider

      // 자신의 Awareness 초기화
      wsProvider.awareness.setLocalStateField('user', {
        name: username,
        color,
        status: 'online',
      })

      wsProvider.on('status', (event: { status: string }) => {
        setIsConnected(event.status === 'connected')
      })

      // Awareness 변경 → peers 상태 갱신
      const handleAwarenessChange = () => {
        const states = wsProvider!.awareness.getStates()
        const newPeers: PeerState[] = []
        states.forEach((state: any, clientID: number) => {
          if (clientID === doc.clientID) return   // 자신 제외
          if (state.user) {
            newPeers.push({
              id: clientID.toString(),
              name: state.user.name,
              color: state.user.color,
              pointer: state.pointer,
              dragSelection: state.dragSelection,
              // 블록 하이라이트: 타 사용자의 현재 블록 + 편집 여부
              blockHighlight: state.blockHighlight ?? undefined,
            })
          }
        })
        setPeers(newPeers)
      }

      wsProvider.awareness.on('change', handleAwarenessChange)
    } catch (err) {
      console.error('WebSocket provider creation failed:', err)
    }

    return () => {
      if (wsProvider) wsProvider.disconnect()
      providerRef.current = null
      setPeers([])
      setIsConnected(false)
    }
  }, [isActive, serverHost, serverPort, useLocalServer, documentId, username, color, sessionToken])



  // 3. 내장 협업 서버 구동/중지 및 전체 협업 토글
  const toggleLocalServer = useCallback(async (port: number) => {
    if (useLocalServer && !ipc.isElectronEnv()) {
      alert("⚠️ 현재 일반 브라우저 환경입니다.\n\n로컬 PC 서버를 직접 구동하려면 일렉트론 데스크톱 앱을 사용해 주셔야 합니다.\n\n일반 브라우저에서는 '로컬 서버 사용' 체크박스를 끄시면 공용 협업 데모 서버(wss://demos.yjs.dev)를 통해 다른 사람과 실시간 협업을 바로 시작해 보실 수 있습니다!")
      return
    }
    if (useLocalServer && ipc.isElectronEnv()) {
      if (serverRunning) {
        await ipc.stopCollaborationServer()
      } else {
        await ipc.startCollaborationServer(port)
      }
    }
    setCollabActive(prev => !prev)
  }, [serverRunning, useLocalServer])

  // 4. 마우스 포인터 브로드캐스트 (60ms 스로틀 적용으로 렉 차단 + 미세 변화 필터링)
  const lastMouseTimeRef = useRef<number>(0)
  const lastPointerPosRef = useRef<{ x: number; y: number } | null>(null)
  const pendingMouseRef = useRef<{ x: number; y: number } | null>(null)
  const throttleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
 
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const prov = providerRef.current
    if (!prov || !editorContainerRef.current || !isActive) return
 
    const rect = editorContainerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top + editorContainerRef.current.scrollTop
 
    // 1. 미세 움직임 필터링 (Displacement Filter): 이전 마우스 위치와 비교해 거리가 3px 이하인 경우 드롭
    if (lastPointerPosRef.current) {
      const dx = x - lastPointerPosRef.current.x
      const dy = y - lastPointerPosRef.current.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (distance < 3) return // 미세 변화는 무시하여 소켓 송수신 빈도 감소
    }
 
    const now = Date.now()
    // 2. 적응형 스로틀 가드 (Adaptive Throttle): 동시 접속 중인 피어 수에 따라 스로틀링 범위 동적 스케일링
    // 피어가 많을수록 패킷 발송 주기를 60ms ~ 150ms 사이로 완충 제어
    const currentPeersCount = peers.length
    const THROTTLE_LIMIT = Math.min(150, 60 + currentPeersCount * 2)
 
    const sendPointer = (posX: number, posY: number) => {
      prov.awareness.setLocalStateField('pointer', { x: posX, y: posY, username })
      lastMouseTimeRef.current = Date.now()
      lastPointerPosRef.current = { x: posX, y: posY }
    }
 
    if (now - lastMouseTimeRef.current >= THROTTLE_LIMIT) {
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current)
        throttleTimeoutRef.current = null
      }
      sendPointer(x, y)
      pendingMouseRef.current = null
    } else {
      pendingMouseRef.current = { x, y }
      if (!throttleTimeoutRef.current) {
        throttleTimeoutRef.current = setTimeout(() => {
          if (pendingMouseRef.current) {
            sendPointer(pendingMouseRef.current.x, pendingMouseRef.current.y)
            pendingMouseRef.current = null
          }
          throttleTimeoutRef.current = null
        }, THROTTLE_LIMIT - (now - lastMouseTimeRef.current))
      }
    }
  }, [isActive, username, peers.length])

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current)
      }
    }
  }, [])

  // 5. 드래그 선택 영역 브로드캐스트
  const updateDragSelection = useCallback((selection: { anchorBlockId: string; focusBlockId: string } | null) => {
    const prov = providerRef.current
    if (!prov || !editorContainerRef.current || !isActive) return

    if (!selection) {
      prov.awareness.setLocalStateField('dragSelection', null)
      return
    }

    const containerRect = editorContainerRef.current.getBoundingClientRect()
    const rects: { top: number; left: number; width: number; height: number }[] = []
    const domSelection = window.getSelection()

    if (domSelection && !domSelection.isCollapsed) {
      const range = domSelection.getRangeAt(0)
      const clientRects = range.getClientRects()
      for (let i = 0; i < clientRects.length; i++) {
        const r = clientRects[i]
        rects.push({
          top: r.top - containerRect.top + editorContainerRef.current.scrollTop,
          left: r.left - containerRect.left,
          width: r.width,
          height: r.height,
        })
      }
    }

    prov.awareness.setLocalStateField('dragSelection', {
      anchorBlockId: selection.anchorBlockId,
      focusBlockId: selection.focusBlockId,
      rects,
    })
  }, [isActive])

  // 6. 블록 하이라이트 브로드캐스트 (MarkdownEditor → 자신의 현재 블록 전파)
  const updateBlockHighlight = useCallback((blockId: string | null, isEditing: boolean = false) => {
    const prov = providerRef.current
    if (!prov || !isActive) return

    if (!blockId) {
      prov.awareness.setLocalStateField('blockHighlight', null)
      return
    }

    prov.awareness.setLocalStateField('blockHighlight', {
      blockId,
      isEditing,
      updatedAt: Date.now(),
    })
  }, [isActive])

  const collaborationLink = useLocalServer
    ? `ws://${serverIp}:${serverPort}`
    : `wss://${serverHost}`

  return {
    ydoc,
    provider: isActive ? provider : null,
    peers,
    serverRunning,
    serverInfo,
    serverIp,
    isConnected,
    toggleLocalServer,
    handleMouseMove,
    updateDragSelection,
    updateBlockHighlight,
    editorContainerRef,
    isActive,
    collaborationLink,
  }
}
