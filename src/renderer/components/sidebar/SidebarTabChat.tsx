
import { MessageCircle, Share2 } from 'lucide-react'
import type { ChatMessage } from '../../hooks/useChat'
import { ChatPanel } from '../ChatPanel'

export interface SidebarTabChatProps {
  chatMessages: ChatMessage[]
  onChatSend: (content: string) => void
  onChatClear: () => void
  username: string
  userColor: string
  isChatFloating: boolean
  onToggleChatFloat: () => void
  serverRunning: boolean
}

export function SidebarTabChat({
  chatMessages, onChatSend, onChatClear, username, userColor,
  isChatFloating, onToggleChatFloat, serverRunning,
}: SidebarTabChatProps) {
  return (
    <div
      data-focus-region="sidebar-chat"
      style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}
    >
      {isChatFloating ? (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '24px', textAlign: 'center', gap: '12px',
          color: 'var(--text-muted)'
        }}>
          <MessageCircle size={32} style={{ opacity: 0.3, color: 'var(--primary)' }} />
          <div style={{ fontSize: '13px', fontWeight: 600 }}>채팅창이 분리되었습니다</div>
          <div style={{ fontSize: '11px', opacity: 0.8 }}>바탕화면에 띄워진 플로팅 채팅창을 통해 메시지를 주고받을 수 있습니다.</div>
          <button
            className="btn btn-glass"
            onClick={onToggleChatFloat}
            style={{ fontSize: '11px', marginTop: '10px' }}
          >
            채팅창 가져오기 (고정)
          </button>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
          <button
            onClick={onToggleChatFloat}
            title="플로팅 창으로 띄우기"
            style={{
              position: 'absolute',
              top: '10px',
              right: '34px',
              zIndex: 10,
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '4px',
              borderRadius: '4px',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            <Share2 size={11} style={{ transform: 'rotate(180deg)' }} />
          </button>
          <ChatPanel
            messages={chatMessages}
            onSend={onChatSend}
            onClear={onChatClear}
            username={username}
            userColor={userColor}
            serverRunning={serverRunning}
          />
        </div>
      )}
    </div>
  )
}
