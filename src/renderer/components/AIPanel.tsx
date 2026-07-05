import React, { useState, useRef, useEffect } from 'react'
import {
  Bot, Send, Square, Trash2, Sparkles, ChevronDown, ChevronUp, Brain,
  Mic, MicOff, Settings2, Copy, Check, X, AlertCircle,
  Wand2, Languages, FileText, Expand, Lightbulb, Lock, Terminal,
  Loader2, CheckCircle2, Circle
} from 'lucide-react'
import type { AIMessage } from '../hooks/useAI'

interface AIPanelProps {
  isOpen: boolean
  onClose: () => void
  messages: AIMessage[]
  isGenerating: boolean
  isAvailable: boolean
  models: { name: string; filename: string; path: string; size: number }[]
  settings: { modelPath: string; temperature: number; maxTokens: number; systemPrompt: string }
  onSend: (message: string, context?: string, originalText?: string, blockId?: string, runtimeSettings?: any) => void
  onAbort: () => void
  onClear: () => void
  onUpdateSettings: (s: Partial<{ modelPath: string; temperature: number; maxTokens: number; systemPrompt: string }>) => void
  currentContent: string
  panelWidth?: number
  selectedText?: string
  onClearSelectedText?: () => void
  onApplySuggestion?: (text: string, mode: 'replace' | 'insert', blockId?: string) => void
  onUpdateDiffState?: (msgId: string, state: 'accepted' | 'rejected') => void
  activeBlockId?: string
  editor?: any
  blocks?: any[]
  activeTab?: string
  installedPlugins?: string[]
  engineLogs?: string
  showModelHub?: boolean
  setShowModelHub?: (show: boolean) => void
}

const QUICK_ACTIONS = [
  { id: 'summarize', icon: FileText, label: '요약', prompt: '현재 문서 내용을 핵심만 3줄로 요약해줘.' },
  { id: 'improve', icon: Wand2, label: '교정', prompt: '현재 문서의 문체와 표현을 자연스럽게 개선해줘.' },
  { id: 'translate', icon: Languages, label: '번역', prompt: '현재 문서를 영어로 번역해줘.' },
  { id: 'expand', icon: Expand, label: '확장', prompt: '현재 문서 내용을 더 풍부하게 확장해줘.' },
  { id: 'explain', icon: Lightbulb, label: '설명', prompt: '현재 문서의 핵심 개념을 쉽게 설명해줘.' },
]

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)}MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`
}

interface ThoughtNode {
  id: string
  title: string
  level: number
  isHeader: boolean
  children: ThoughtNode[]
  status: 'completed' | 'running' | 'pending'
}

const keyframeStyles = `
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
@keyframes pulseGlow {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; transform: scale(1.05); }
}
@keyframes slideDown {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
`

function parseThoughtText(text: string, isStreaming: boolean): ThoughtNode[] {
  const lines = text.split('\n')
  const roots: ThoughtNode[] = []
  const stack: ThoughtNode[] = []
  let nodeIdCounter = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue

    // Detect indentation level (number of spaces or tabs)
    const leadingWhitespace = line.match(/^(\s*)/)?.[0] || ''
    const indentWidth = leadingWhitespace.replace(/\t/g, '    ').length

    const trimmed = line.trim()
    
    // Check if it's a section header, e.g. [Header Name]
    const headerMatch = trimmed.match(/^\[([^\]]+)\]$/)
    
    if (headerMatch) {
      const title = headerMatch[1].trim()
      const node: ThoughtNode = {
        id: `thought_node_${nodeIdCounter++}`,
        title,
        level: 0,
        isHeader: true,
        children: [],
        status: 'completed',
      }
      roots.push(node)
      stack.length = 0 // Clear stack for new section
      stack.push(node)
    } else {
      // It's a step item
      // Clean bullet points: -, *, +, 1., 2. etc.
      const content = trimmed.replace(/^[-*+]\s+|^[0-9]+[.)]\s+/, '').trim()
      if (!content) continue

      let level = 1
      if (indentWidth > 0) {
        level = Math.floor(indentWidth / 2) + 1
      }

      const node: ThoughtNode = {
        id: `thought_node_${nodeIdCounter++}`,
        title: content,
        level,
        isHeader: false,
        children: [],
        status: 'completed',
      }

      // Find parent in stack
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop()
      }

      if (stack.length > 0) {
        stack[stack.length - 1].children.push(node)
      } else {
        roots.push(node)
      }
      stack.push(node)
    }
  }

  // Adjust statuses if streaming
  if (isStreaming) {
    let lastLeaf: ThoughtNode | null = null
    
    function findLastLeaf(nodes: ThoughtNode[]) {
      if (nodes.length === 0) return
      lastLeaf = nodes[nodes.length - 1]
      if (lastLeaf.children && lastLeaf.children.length > 0) {
        findLastLeaf(lastLeaf.children)
      }
    }
    
    findLastLeaf(roots)
    
    if (lastLeaf) {
      (lastLeaf as ThoughtNode).status = 'running'
      
      // Mark parent chain as running
      function markParentChain(nodes: ThoughtNode[]): boolean {
        let hasRunningChild = false
        for (const node of nodes) {
          const childRunning = markParentChain(node.children)
          if (node.status === 'running' || childRunning) {
            node.status = 'running'
            hasRunningChild = true
          }
        }
        return hasRunningChild
      }
      markParentChain(roots)
    }
  }

  return roots
}

function getThoughtSummary(text: string, isStreaming: boolean) {
  const nodes = parseThoughtText(text, isStreaming)
  let totalSteps = 0
  let completedSteps = 0
  
  function count(items: ThoughtNode[]) {
    for (const n of items) {
      if (!n.isHeader) {
        totalSteps++
        if (n.status === 'completed') {
          completedSteps++
        }
      }
      if (n.children) {
        count(n.children)
      }
    }
  }
  count(nodes)
  
  const activeStep = isStreaming ? completedSteps + 1 : totalSteps
  return { totalSteps, completedSteps, activeStep }
}

function ThoughtNodeItem({ node, isLast: _isLast }: { node: ThoughtNode; isLast: boolean }) {
  const isHeader = node.isHeader
  const hasChildren = node.children && node.children.length > 0

  let iconElement: React.ReactNode = null
  if (isHeader) {
    let HeaderIcon = Brain
    if (node.title.includes('의도')) HeaderIcon = Terminal
    else if (node.title.includes('플래닝') || node.title.includes('시스템')) HeaderIcon = Settings2
    else if (node.title.includes('실시간') || node.title.includes('추론')) HeaderIcon = Sparkles

    if (node.status === 'running') {
      iconElement = <HeaderIcon size={14} style={{ color: 'var(--secondary)', animation: 'pulseGlow 1.5s infinite ease-in-out' }} />
    } else {
      iconElement = <HeaderIcon size={14} style={{ color: node.status === 'completed' ? 'var(--primary)' : 'var(--text-muted)' }} />
    }
  } else {
    if (node.status === 'completed') {
      iconElement = <CheckCircle2 size={12} style={{ color: '#10b981' }} />
    } else if (node.status === 'running') {
      iconElement = <Loader2 size={12} style={{ color: 'var(--secondary)', animation: 'spin 1s linear infinite' }} />
    } else {
      iconElement = <Circle size={10} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
    }
  }

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    paddingLeft: isHeader ? '0' : '8px',
    marginBottom: isHeader ? '10px' : '4px',
    animation: 'slideDown 0.2s ease-out',
  }

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    fontSize: isHeader ? '11px' : '10.5px',
    fontWeight: isHeader ? 700 : 500,
    color: isHeader 
      ? 'var(--text-main)' 
      : node.status === 'running' 
        ? 'var(--text-main)' 
        : 'var(--text-muted)',
    lineHeight: '1.5',
    position: 'relative',
  }

  const childrenContainerStyle: React.CSSProperties = {
    paddingLeft: '12px',
    borderLeft: '1px solid rgba(255,255,255,0.05)',
    marginLeft: isHeader ? '6px' : '5px',
    marginTop: '4px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  }

  return (
    <div style={containerStyle}>
      <div style={rowStyle}>
        <div style={{ display: 'flex', alignItems: 'center', height: '18px', flexShrink: 0 }}>
          {iconElement}
        </div>
        <div style={{ 
          paddingTop: '2px', 
          fontFamily: isHeader ? 'inherit' : "'JetBrains Mono', 'Fira Code', Consolas, Monaco, monospace",
          wordBreak: 'break-word',
          opacity: node.status === 'pending' ? 0.5 : 1,
        }}>
          {node.title}
          {node.status === 'running' && !isHeader && (
            <span style={{ 
              display: 'inline-block', 
              width: '3px', 
              height: '9px', 
              background: 'var(--secondary)', 
              marginLeft: '4px',
              animation: 'pulseGlow 0.8s infinite ease-in-out',
              verticalAlign: 'middle'
            }} />
          )}
        </div>
      </div>

      {hasChildren && (
        <div style={childrenContainerStyle}>
          {node.children.map((child, index) => (
            <ThoughtNodeItem 
              key={child.id} 
              node={child} 
              isLast={index === node.children.length - 1} 
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ThoughtTreeView({ text, isStreaming }: { text: string; isStreaming: boolean }) {
  const nodes = parseThoughtText(text, isStreaming)
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <style dangerouslySetInnerHTML={{ __html: keyframeStyles }} />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {nodes.map((node, index) => (
          <ThoughtNodeItem 
            key={node.id} 
            node={node} 
            isLast={index === nodes.length - 1} 
          />
        ))}
      </div>
    </div>
  )
}

function MessageBubble({
  msg,
  onApplySuggestion,
  hasSelection,
  onUpdateDiffState,
}: {
  msg: AIMessage
  onApplySuggestion?: (text: string, mode: 'replace' | 'insert', blockId?: string) => void
  hasSelection: boolean
  onUpdateDiffState?: (msgId: string, state: 'accepted' | 'rejected') => void
}) {
  const [copied, setCopied] = useState(false)
  const [thoughtExpanded, setThoughtExpanded] = useState(false)
  const isUser = msg.role === 'user'

  // 생각 과정 (Thought Process) 파싱
  const thoughtMatch = msg.content.match(/<thought>([\s\S]*?)<\/thought>([\s\S]*)/i)
  let thoughtText = ''
  let cleanContent = msg.content
  
  if (thoughtMatch) {
    thoughtText = thoughtMatch[1].trim()
    cleanContent = thoughtMatch[2].trim()
  } else if (msg.content.includes('<thought>')) {
    const partialMatch = msg.content.match(/<thought>([\s\S]*)/i)
    if (partialMatch) {
      thoughtText = partialMatch[1].trim()
      cleanContent = ''
    }
  }

  const thoughtSummary = thoughtText ? getThoughtSummary(thoughtText, !!msg.isStreaming) : null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cleanContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  // AI 제안 코드/텍스트 추출
  let codeSnippet = ''
  if (cleanContent.includes('```')) {
    const parts = cleanContent.split('```')
    if (parts[1]) {
      const lines = parts[1].split('\n')
      // 첫 줄이 언어 식별자(javascript, py 등)인 경우 제거
      if (lines[0] && lines[0].trim().length < 15 && !lines[0].includes(' ') && !lines[0].includes('(')) {
        codeSnippet = lines.slice(1).join('\n').trim()
      } else {
        codeSnippet = parts[1].trim()
      }
    }
  }

  const textToApply = codeSnippet || cleanContent.trim()

  if (msg.role === 'system') {
    return (
      <div style={{
        textAlign: 'center',
        padding: '4px 0',
        fontSize: '10px',
        color: 'var(--text-muted)',
      }}>
        {msg.content}
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: isUser ? 'row-reverse' : 'row',
      gap: '8px',
      alignItems: 'flex-start',
      marginBottom: '14px',
    }}>
      {/* 아바타 */}
      <div style={{
        width: '28px',
        height: '28px',
        borderRadius: '50%',
        flexShrink: 0,
        background: isUser
          ? 'linear-gradient(135deg, var(--primary), #7c3aed)'
          : 'linear-gradient(135deg, var(--secondary), #0891b2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '12px',
        fontWeight: 700,
        color: '#fff',
        boxShadow: isUser ? '0 2px 8px var(--primary-glow)' : '0 2px 8px var(--secondary-glow)',
      }}>
        {isUser ? 'U' : <Bot size={14} />}
      </div>

      {/* 말풍선 */}
      <div style={{ maxWidth: '82%', position: 'relative', display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {/* 라벨 헤더 */}
        <span style={{
          fontSize: '9px',
          fontWeight: 800,
          color: isUser ? 'rgba(167,139,250,0.85)' : 'rgba(34,211,238,0.85)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          alignSelf: isUser ? 'flex-end' : 'flex-start',
          padding: '0 2px'
        }}>
          {isUser ? '질문 (Prompt)' : '응답 (Response)'}
        </span>
        <div style={{
          padding: '10px 12px',
          borderRadius: isUser ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
          background: isUser
            ? 'linear-gradient(135deg, rgba(139,92,246,0.18), rgba(124,58,237,0.12))'
            : (msg.aborted && cleanContent === '사용자가 답변을 중단했습니다'
              ? 'rgba(255,255,255,0.02)'
              : 'var(--bg-card)'),
          border: `1px solid ${isUser
            ? 'rgba(139,92,246,0.35)'
            : (msg.aborted && cleanContent === '사용자가 답변을 중단했습니다'
              ? 'rgba(255,255,255,0.05)'
              : 'var(--border-muted)')}`,
          fontSize: '13px',
          lineHeight: '1.6',
          color: msg.error
            ? '#f87171'
            : (msg.aborted && cleanContent === '사용자가 답변을 중단했습니다'
              ? 'var(--text-muted)'
              : 'var(--text-main)'),
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap',
          position: 'relative',
          userSelect: 'text',
          WebkitUserSelect: 'text',
        }}>
          {/* 생각 과정 (Thought Process) 박스 표출 */}
          {thoughtText && (
            <div style={{
              marginBottom: '8px',
              borderRadius: '6px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              overflow: 'hidden',
            }}>
              <div
                onClick={() => setThoughtExpanded(prev => !prev)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 10px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                  userSelect: 'none',
                  background: 'rgba(255,255,255,0.01)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Brain 
                    size={12} 
                    style={{ 
                      color: msg.isStreaming ? 'var(--secondary)' : '#10b981',
                      animation: msg.isStreaming ? 'pulseGlow 1.5s infinite ease-in-out' : 'none'
                    }} 
                  />
                  <span>
                    {msg.isStreaming 
                      ? `생각 과정 (${thoughtSummary?.activeStep}번째 추론 중...)` 
                      : `생각 과정 (총 ${thoughtSummary?.totalSteps}단계 추론 완료)`
                    }
                  </span>
                </div>
                {thoughtExpanded || msg.isStreaming ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </div>
              {(thoughtExpanded || msg.isStreaming) && (
                <div style={{
                  padding: '8px 10px',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  lineHeight: '1.5',
                  borderTop: '1px solid rgba(255,255,255,0.04)',
                  background: 'rgba(0,0,0,0.12)',
                }}>
                  <ThoughtTreeView text={thoughtText} isStreaming={!!msg.isStreaming} />
                </div>
              )}
            </div>
          )}

          {/* 스트리밍 완료 후 Diff 제안이 있는 경우 DiffRenderer 표출 */}
          {!isUser && !msg.isStreaming && msg.originalText && msg.proposedText ? (
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 'bold' }}>
                문서 수정 제안 (AI Edit Suggestion)
              </div>
              <div style={{
                border: '1px solid var(--border-muted)',
                borderRadius: '6px',
                overflow: 'hidden',
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                fontSize: '11px',
                background: '#0d0e12',
              }}>
                <div style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  padding: '6px 8px',
                  borderBottom: '1px solid rgba(239, 68, 68, 0.15)',
                }}>
                  <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#f87171', marginBottom: '2px' }}>수정 전 (Before)</div>
                  <div style={{ textDecoration: 'line-through', whiteSpace: 'pre-wrap', color: '#fca5a5' }}>
                    {msg.originalText}
                  </div>
                </div>
                <div style={{
                  background: 'rgba(34, 197, 94, 0.08)',
                  padding: '6px 8px',
                }}>
                  <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#4ade80', marginBottom: '2px' }}>수정 후 (After)</div>
                  <div style={{ whiteSpace: 'pre-wrap', color: '#86efac' }}>
                    {msg.proposedText}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            cleanContent || (msg.isStreaming ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary)' }}>
                  {/* 도트 바운스 스피너 */}
                  <span style={{ display: 'flex', gap: '3px' }}>
                    <span className="dot-thinking" style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--primary)', animation: 'dot-blink 1.4s infinite both' }} />
                    <span className="dot-thinking" style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--primary)', animation: 'dot-blink 1.4s infinite both 0.2s' }} />
                    <span className="dot-thinking" style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--primary)', animation: 'dot-blink 1.4s infinite both 0.4s' }} />
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 600 }}>AMEVA AI 엔진 추론 시작 중...</span>
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  엔진 로딩 및 로컬 CPU/GPU 가속 연산을 조율하고 있습니다. 잠시만 기다려주세요.
                </div>
              </div>
            ) : '')
          )}

          {msg.isStreaming && (
            <span style={{
              display: 'inline-block',
              width: '8px',
              height: '14px',
              background: 'var(--secondary)',
              marginLeft: '2px',
              verticalAlign: 'middle',
              borderRadius: '2px',
              animation: 'cursor-blink 0.8s step-end infinite',
            }} />
          )}

          {msg.aborted && cleanContent !== '사용자가 답변을 중단했습니다' && (
            <div style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              fontStyle: 'italic',
              marginTop: '8px',
              borderTop: '1px solid var(--border-muted)',
              paddingTop: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              userSelect: 'none'
            }}>
              <span>⏹ 사용자가 답변을 중단했습니다</span>
            </div>
          )}
        </div>

        {/* 스마트 액션 버튼 그룹 */}
        {!isUser && !msg.isStreaming && cleanContent && cleanContent !== '사용자가 답변을 중단했습니다' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: '8px',
            padding: '0 2px',
            flexWrap: 'wrap',
          }}>
            {/* Diff 제안 수락/거절 분기 */}
            {!isUser && msg.originalText && msg.proposedText ? (
              <>
                {msg.diffState === 'pending' && (
                  <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
                    <button
                      onClick={() => {
                        if (onApplySuggestion && msg.proposedText) {
                          onApplySuggestion(msg.proposedText, 'replace', msg.blockId)
                        }
                        if (onUpdateDiffState) {
                          onUpdateDiffState(msg.id, 'accepted')
                        }
                      }}
                      style={{
                        flex: 1,
                        background: 'rgba(16,185,129,0.18)',
                        border: '1px solid rgba(16,185,129,0.4)',
                        cursor: 'pointer',
                        color: '#34d399',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        padding: '5px 10px',
                        borderRadius: '5px',
                        transition: 'all 0.15s',
                      }}
                    >
                      <Check size={12} /> 수락 (Accept)
                    </button>
                    <button
                      onClick={() => {
                        if (onUpdateDiffState) {
                          onUpdateDiffState(msg.id, 'rejected')
                        }
                      }}
                      style={{
                        background: 'rgba(239,68,68,0.12)',
                        border: '1px solid rgba(239,68,68,0.3)',
                        cursor: 'pointer',
                        color: '#f87171',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        padding: '5px 10px',
                        borderRadius: '5px',
                        transition: 'all 0.15s',
                      }}
                    >
                      <X size={12} /> 거절
                    </button>
                  </div>
                )}
                {msg.diffState === 'accepted' && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    color: '#34d399',
                    background: 'rgba(16,185,129,0.06)',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: '1px solid rgba(16,185,129,0.15)',
                    fontWeight: 'bold',
                  }}>
                    <Check size={12} /> 수정안이 본문에 적용되었습니다
                  </div>
                )}
                {msg.diffState === 'rejected' && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    background: 'rgba(255,255,255,0.02)',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-muted)',
                  }}>
                    <X size={12} /> 제안 거절됨
                  </div>
                )}
              </>
            ) : (
              <>
                {/* 복사 */}
                <button
                  onClick={handleCopy}
                  style={{
                    background: 'var(--bg-glass)',
                    border: '1px solid var(--border-muted)',
                    cursor: 'pointer',
                    color: copied ? '#10b981' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    fontSize: '10px',
                    padding: '3px 7px',
                    borderRadius: '5px',
                    transition: 'all 0.15s',
                  }}
                >
                  {copied ? <Check size={10} /> : <Copy size={10} />}
                  {copied ? '복사됨' : '복사'}
                </button>

                {/* 에디터 커서 삽입 */}
                {onApplySuggestion && (
                  <button
                    onClick={() => onApplySuggestion(textToApply, 'insert')}
                    style={{
                      background: 'rgba(139,92,246,0.1)',
                      border: '1px solid rgba(139,92,246,0.25)',
                      cursor: 'pointer',
                      color: 'var(--primary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      fontSize: '10px',
                      padding: '3px 7px',
                      borderRadius: '5px',
                      transition: 'all 0.15s',
                    }}
                  >
                    커서에 삽입
                  </button>
                )}

                {/* 선택 교체 */}
                {onApplySuggestion && (
                  <button
                    onClick={() => onApplySuggestion(textToApply, 'replace', msg.blockId)}
                    disabled={!hasSelection}
                    style={{
                      background: hasSelection ? 'rgba(6,182,212,0.12)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${hasSelection ? 'rgba(6,182,212,0.3)' : 'var(--border-muted)'}`,
                      cursor: hasSelection ? 'pointer' : 'not-allowed',
                      color: hasSelection ? 'var(--secondary)' : 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      fontSize: '10px',
                      padding: '3px 7px',
                      borderRadius: '5px',
                      transition: 'all 0.15s',
                      opacity: hasSelection ? 1 : 0.45,
                    }}
                    title={hasSelection ? '에디터 선택 영역과 교체합니다' : '에디터에서 영역을 드래그하면 교체할 수 있습니다'}
                  >
                    선택교체
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* 타임스탬프 */}
        <div style={{
          fontSize: '9px',
          color: 'var(--text-dark)',
          marginTop: '6px',
          textAlign: isUser ? 'right' : 'left',
        }}>
          {new Date(msg.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )
}

interface FlatBlock {
  id: string
  text: string
  type: string
}

function flattenBlocks(blocks: any[]): FlatBlock[] {
  const result: FlatBlock[] = []
  function traverse(items: any[]) {
    if (!Array.isArray(items)) return
    for (const item of items) {
      if (!item) continue
      let text = ''
      if (item.content) {
        if (Array.isArray(item.content)) {
          text = item.content.map((c: any) => c.text || '').join('')
        } else if (typeof item.content === 'string') {
          text = item.content
        }
      }
      if (item.type === 'table' && item.content?.rows) {
        const cellTexts: string[] = []
        for (const row of item.content.rows) {
          if (row.cells) {
            for (const cell of row.cells) {
              if (Array.isArray(cell)) {
                cellTexts.push(cell.map((c: any) => c.text || '').join(''))
              }
            }
          }
        }
        text = cellTexts.join(' | ')
      }
      if (item.type === 'jupyter' && item.props?.code) {
        text = item.props.code
      }

      if (text.trim()) {
        result.push({ id: item.id, text, type: item.type })
      }
      if (item.children && item.children.length > 0) {
        traverse(item.children)
      }
    }
  }
  traverse(blocks)
  return result
}

function retrieveRelevantBlocks(query: string, flatBlocks: FlatBlock[], topK = 5): FlatBlock[] {
  const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 1)
  if (queryTerms.length === 0) return flatBlocks.slice(0, topK)

  const scored = flatBlocks.map(block => {
    const blockTextLower = block.text.toLowerCase()
    let score = 0
    for (const term of queryTerms) {
      if (blockTextLower.includes(term)) {
        score += 10
        const boundaryRegex = new RegExp('(?:^|\\s|[.,!?])' + term + '(?:$|\\s|[.,!?])', 'i')
        if (boundaryRegex.test(blockTextLower)) {
          score += 10
        }
        const occurrences = blockTextLower.split(term).length - 1
        score += occurrences * 2
      }
    }
    return { block, score }
  })

  return scored
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(x => x.block)
    .slice(0, topK)
}

export function AIPanel({
  isOpen, onClose, messages, isGenerating, isAvailable,
  models, settings, onSend, onAbort, onClear,
  onUpdateSettings, currentContent, panelWidth = 320,
  selectedText = '',
  onClearSelectedText,
  onApplySuggestion,
  onUpdateDiffState,
  activeBlockId,
  editor,
  blocks = [],
  activeTab = 'ai',
  installedPlugins = [],
  engineLogs = '', // 🤖 실시간 원시 로그 데이터 매핑
  showModelHub = false,
  setShowModelHub,
}: AIPanelProps) {
  const [input, setInput] = useState('')
  const [manualMode, setManualMode] = useState<'auto' | 'edit' | 'summary' | 'chat'>('auto')
  const [showSettings, setShowSettings] = useState(false)
  const [useContext, setUseContext] = useState(true) // 기본으로 켬
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const logEndRef = useRef<HTMLDivElement>(null) // 🤖 로그 자동스크롤용
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const logContainerRef = useRef<HTMLDivElement>(null)
  const [isLogsExpanded, setIsLogsExpanded] = useState(false)

  // 🤖 Props settings 구조분해 및 폴백 기본값 지정
  const apiType = settings.apiType || 'local'
  const gpuOnly = settings.gpuOnly !== false
  const apiKey = settings.apiKey || ''

  const [gpuName, setGpuName] = useState('')
  const [downloadStatus, setDownloadStatus] = useState<any>(null)
  const [showDownloadDetail, setShowDownloadDetail] = useState(false)
  const [showLogs, setShowLogs] = useState(false) // 🤖 실시간 터미널 로그창 토글 상태

  // 🤖 로컬 엔진 유효 여부 또는 무설치 모드(WASM, API, Ollama) 활성화 여부 판정
  const isInputEnabled = isAvailable || apiType === 'wasm' || apiType === 'api' || apiType === 'ollama'

  useEffect(() => {
    if (window.electronAPI?.onLLMDownloadProgress) {
      const unsub = window.electronAPI.onLLMDownloadProgress((status: any) => {
        setDownloadStatus(status)
      })
      return () => unsub()
    }
  }, [])

  useEffect(() => {
    if (window.electronAPI?.llmGetGpuName) {
      window.electronAPI.llmGetGpuName().then(setGpuName)
    }
  }, [])

  // 메시지 수신 시 스마트 자동 스크롤
  useEffect(() => {
    const container = messagesContainerRef.current
    if (container) {
      const lastMessage = messages[messages.length - 1]
      const isUserMsg = lastMessage?.role === 'user'
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 60
      if ((isNearBottom || isUserMsg) && messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }, [messages])

  const getContextWithRAG = (query: string, useFullFallback = false) => {
    if (selectedText) {
      return `[선택한 부분 텍스트]\n${selectedText}\n\n[문서 내용 전체]\n${currentContent}`
    }
    if (!useContext && !useFullFallback) return undefined

    if (blocks && blocks.length > 0) {
      try {
        const flat = flattenBlocks(blocks)
        const relevant = retrieveRelevantBlocks(query, flat, 5)
        if (relevant.length > 0) {
          return `[참조된 관련 문서 내용 (RAG 검색 결과)]\n아래는 사용자의 질문과 가장 연관성이 높은 문서 내 블록들입니다. 해당 정보를 정확히 파악하여 답변에 반영하고, 필요 시 명시된 Block ID를 사용해 수정 제안을 하십시오.\n\n` +
            relevant.map(b => `[Block ID: ${b.id}, Type: ${b.type}]\n${b.text}`).join('\n\n')
        }
      } catch (e) {
        console.warn('RAG 검색 실패, 전체 본문 폴백:', e)
      }
    }
    return currentContent
  }

  // 🤖 로그 수신 시 스마트 자동 스크롤
  useEffect(() => {
    const container = logContainerRef.current
    if (container) {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 60
      if (isNearBottom && logEndRef.current) {
        logEndRef.current.scrollIntoView({ behavior: 'auto' })
      }
    }
  }, [engineLogs])

  const getActiveMode = (queryText: string): 'edit' | 'summary' | 'chat' => {
    if (manualMode !== 'auto') return manualMode

    const cleanInput = queryText.toLowerCase().trim()
    const summaryKeywords = ['요약', '정리', '줄여', 'summarize', 'summary', 'brief']
    if (summaryKeywords.some(k => cleanInput.includes(k))) return 'summary'

    // 선택 영역이 활성화되어 있으면 기본적으로 수정/편집 모드(EDIT)로 자동 분류
    if (selectedText) return 'edit'

    const editKeywords = ['수정', '변경', '바꿔', '고쳐', '삽입', '지워', '추가', '작성해', 'edit', 'modify', 'replace', 'rewrite', 'correct']
    if (editKeywords.some(k => cleanInput.includes(k))) return 'edit'

    return 'chat'
  }

  const handleSend = () => {
    if (!input.trim() || isGenerating) return

    const finalContext = getContextWithRAG(input.trim(), false)
    const resolvedMode = getActiveMode(input)

    onSend(input.trim(), finalContext, selectedText || undefined, activeBlockId, {
      apiType,
      gpuOnly,
      apiKey,
      modelPath: settings.modelPath,
      resolvedMode, // 🤖 동적 결정되거나 수동 지정된 의도 모드 전달
    })
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleQuickAction = (prompt: string) => {
    if (isGenerating) return
    const finalContext = getContextWithRAG(prompt, true)
    const resolvedMode = getActiveMode(prompt)
    onSend(prompt, finalContext, selectedText || undefined, activeBlockId, {
      apiType,
      gpuOnly,
      apiKey,
      modelPath: settings.modelPath,
      resolvedMode, // 🤖 동적 결정되거나 수동 지정된 의도 모드 전달
    })
  }

  if (!isOpen) return null

  return (
    <div
      data-focus-region="ai-panel"
      style={{
        width: panelWidth,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-main)',
        backdropFilter: 'blur(20px)',
        borderLeft: '1px solid var(--border-muted)',
        position: 'relative',
        overflow: 'hidden',
        color: 'var(--text-main)',
      }}
    >
      {/* 글로우 라인 */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: '2px',
        background: 'linear-gradient(90deg, var(--primary), var(--secondary), var(--accent))',
      }} />

      {/* 헤더 */}
      <div style={{
        padding: '14px 16px 10px',
        borderBottom: '1px solid var(--border-muted)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexShrink: 0,
      }}>
        <div style={{
          width: '28px', height: '28px', borderRadius: '8px',
          background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 12px var(--primary-glow)',
          flexShrink: 0,
        }}>
          <Sparkles size={14} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.3px' }}>
              AMEVA <span style={{ color: 'var(--primary)' }}>AI</span>
            </span>
            {/* AI 모드별 상태 배지 */}
            <span style={{
              fontSize: '8px', fontWeight: 800, padding: '1px 4px', borderRadius: '4px',
              color: '#fff',
              background: apiType === 'wasm'
                ? 'linear-gradient(135deg, #0284c7, #0369a1)' // WASM 블루
                : apiType === 'api'
                ? 'linear-gradient(135deg, #7c3aed, #6d28d9)' // API 퍼플
                : apiType === 'ollama'
                ? 'linear-gradient(135deg, #f97316, #ea580c)' // Ollama 오렌지
                : 'linear-gradient(135deg, #16a34a, #15803d)', // Local 그린
            }}>
              {apiType === 'wasm' ? 'WebGPU WASM' : apiType === 'api' ? 'Cloud API' : apiType === 'ollama' ? 'Ollama' : 'Native Core'}
            </span>
            {/* 로컬 구동 시 CPU/GPU 가속 상태 배지 */}
            {(apiType === 'local' || apiType === 'ollama') && (
              <span style={{
                fontSize: '8px', fontWeight: 800, padding: '1px 4px', borderRadius: '4px',
                color: '#fff',
                background: gpuOnly
                  ? 'linear-gradient(135deg, #a855f7, #7c3aed)' // GPU 가속 보라
                  : 'linear-gradient(135deg, #4b5563, #374151)', // CPU 그레이
              }}>
                {gpuOnly ? 'GPU 가속' : 'CPU 연산'}
              </span>
            )}
          </div>
          <div style={{ fontSize: '9px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '170px' }}>
            {apiType === 'api'
              ? 'OpenAI GPT-4o 연결됨'
              : apiType === 'ollama'
              ? 'Ollama 로컬 백그라운드 서비스'
              : (isAvailable
                  ? `${models.find(m => m.path === settings.modelPath)?.name || '모델을 선택하세요'}`
                  : '로컬 모델 검색 필요'
                )
            }
          </div>
        </div>
        {(apiType === 'local' || apiType === 'ollama') && (
          <button
            onClick={() => setShowLogs(!showLogs)}
            style={{
              background: showLogs ? 'var(--bg-glass-active)' : 'transparent',
              border: 'none', cursor: 'pointer',
              color: showLogs ? 'var(--primary)' : 'var(--text-muted)',
              display: 'flex', alignItems: 'center',
              padding: '4px', borderRadius: '5px', transition: 'all 0.15s',
              marginRight: '2px',
            }}
            title="AI 엔진 터미널 로그 실시간 감시"
          >
            <Terminal size={14} />
          </button>
        )}
        <button
          onClick={() => setShowSettings(!showSettings)}
          style={{
            background: showSettings ? 'var(--bg-glass-active)' : 'transparent',
            border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
            padding: '4px', borderRadius: '5px', transition: 'all 0.15s',
          }}
          title="AI 설정"
        >
          <Settings2 size={14} />
        </button>
        <button
          onClick={onClose}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
            padding: '4px', borderRadius: '5px',
          }}
        >
          <X size={14} />
        </button>
      </div>

      {activeTab === 'ai' && (
        <>
          {/* 설정 패널 */}
      {showSettings && (
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-muted)',
          background: 'var(--bg-glass-active)',
          display: 'flex', flexDirection: 'column', gap: '10px',
          flexShrink: 0,
        }}>
          {/* AI 실행 유형 선택 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>AI 실행 유형</label>
            <select
              value={apiType}
              onChange={e => onUpdateSettings({ apiType: e.target.value as any })}
              style={{
                width: '100%',
                background: 'var(--bg-glass)',
                border: '1px solid var(--border-muted)',
                borderRadius: '6px',
                padding: '5px 8px',
                color: 'var(--text-main)',
                fontSize: '11px',
              }}
            >
              <option value="wasm">로컬 WebGPU 가속 (무설치)</option>
              <option value="local">로컬 고성능 엔진 (llama-cli)</option>
              <option value="ollama">로컬 백그라운드 서비스 (Ollama)</option>
              <option value="api">클라우드 외부 API (OpenAI 등)</option>
            </select>
          </div>

          {/* API Key 입력란 */}
          {apiType === 'api' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>OpenAI API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={e => onUpdateSettings({ apiKey: e.target.value })}
                placeholder="sk-..."
                style={{
                  width: '100%',
                  background: 'var(--bg-glass)',
                  border: '1px solid var(--border-muted)',
                  borderRadius: '6px',
                  padding: '5px 8px',
                  color: 'var(--text-main)',
                  fontSize: '11px',
                  outline: 'none',
                }}
              />
            </div>
          )}

          {/* 모델 선택 */}
          {apiType !== 'api' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>모델 선택</label>
                <button
                  onClick={() => setShowModelHub(true)}
                  style={{
                    fontSize: '9px', color: 'var(--primary)', background: 'none', border: 'none',
                    cursor: 'pointer', padding: 0, fontWeight: 700,
                  }}
                >
                  모델 허브 개방 📥
                </button>
              </div>
              {models.length === 0 ? (
                <div style={{
                  padding: '8px', borderRadius: '6px',
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                  fontSize: '11px', color: '#f87171',
                  display: 'flex', flexDirection: 'column', gap: '6px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertCircle size={12} />
                    <span>C:\ameva\models\llm 에 모델 없음</span>
                  </div>
                  <button
                    onClick={() => setShowModelHub(true)}
                    style={{
                      width: '100%', padding: '4px 8px', borderRadius: '4px',
                      background: 'var(--primary)', color: '#fff', border: 'none',
                      fontSize: '10px', fontWeight: 700, cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    추천 AI 모델 다운로드 센터 열기
                  </button>
                </div>
              ) : (
                <select
                  value={settings.modelPath}
                  onChange={e => onUpdateSettings({ modelPath: e.target.value })}
                  style={{
                    width: '100%',
                    background: 'var(--bg-glass)',
                    border: '1px solid var(--border-muted)',
                    borderRadius: '6px',
                    padding: '5px 8px',
                    color: 'var(--text-main)',
                    fontSize: '11px',
                  }}
                >
                  {models.map(m => (
                    <option key={m.path} value={m.path} style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}>
                      {m.name} ({formatBytes(m.size)})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* 하드웨어 가속 옵션 */}
          {apiType !== 'api' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="gpuOnly-checkbox"
                  checked={gpuOnly}
                  onChange={e => onUpdateSettings({ gpuOnly: e.target.checked })}
                  style={{ accentColor: 'var(--primary)' }}
                />
                <label htmlFor="gpuOnly-checkbox" style={{ fontSize: '11px', color: 'var(--text-main)', cursor: 'pointer' }}>
                  GPU 전용 가속 활성화 (해제 시 CPU 모드로 기동)
                </label>
              </div>
              {gpuName && (
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '22px' }}>
                  감지된 그래픽 장치: <span style={{ color: 'var(--secondary)', fontWeight: 'bold' }}>{gpuName}</span>
                </div>
              )}
            </div>
          )}

          {/* Temperature */}
          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>Temperature (창의성)</span>
              <span style={{ color: 'var(--primary)' }}>{settings.temperature.toFixed(1)}</span>
            </label>
            <input
              type="range" min="0" max="1" step="0.1"
              value={settings.temperature}
              onChange={e => onUpdateSettings({ temperature: parseFloat(e.target.value) })}
              style={{ width: '100%', accentColor: 'var(--primary)' }}
            />
          </div>

          {/* Max Tokens */}
          <div>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>최대 토큰</span>
              <span style={{ color: 'var(--primary)' }}>{settings.maxTokens}</span>
            </label>
            <input
              type="range" min="128" max="2048" step="128"
              value={settings.maxTokens}
              onChange={e => onUpdateSettings({ maxTokens: parseInt(e.target.value) })}
              style={{ width: '100%', accentColor: 'var(--primary)' }}
            />
          </div>

          {/* Hugging Face 추천 모델 다운로드 마켓플레이스 */}
          <div style={{ marginTop: '10px', borderTop: '1px solid var(--border-muted)', paddingTop: '10px' }}>
            <label style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              Hugging Face 추천 모델 원클릭 다운로드
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[
                { name: 'Qwen 2.5 1.5B (GGUF)', file: 'qwen2.5-1.5b-instruct-q4_k_m.gguf', url: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf' },
                { name: 'Qwen 2.5 3B (GGUF)', file: 'qwen2.5-3b-instruct-q4_k_m.gguf', url: 'https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf' },
                { name: 'Llama 3.1 8B (GGUF)', file: 'Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf', url: 'https://huggingface.co/QuantFactory/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf' }
              ].map(m => {
                const isDownloading = downloadStatus && downloadStatus.filename === m.file && downloadStatus.progress < 100
                return (
                  <div key={m.file} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'rgba(255,255,255,0.02)', padding: '6px 8px', borderRadius: '6px',
                    border: '1px solid var(--border-muted)'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)' }}>{m.name}</span>
                      <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{m.file}</span>
                    </div>
                    <button
                      disabled={!!isDownloading}
                      onClick={async () => {
                        if ((window as any).electron) {
                          setDownloadStatus({ filename: m.file, progress: 0, speed: 0, downloadedBytes: 0, totalBytes: 0, timeRemaining: 0 })
                          const res = await (window as any).electron.invoke('llm:downloadModel', { url: m.url, filename: m.file })
                          if (res.success) {
                            alert('다운로드 완료! AI 모델이 활성화되었습니다.')
                          } else {
                            alert(`다운로드 실패: ${res.error}`)
                          }
                        }
                      }}
                      style={{
                        background: isDownloading ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, var(--primary), var(--secondary))',
                        border: 'none', color: '#fff', fontSize: '10px', padding: '4px 10px',
                        borderRadius: '4px', cursor: isDownloading ? 'not-allowed' : 'pointer', fontWeight: 700
                      }}
                    >
                      {isDownloading ? `${downloadStatus.progress}%` : '설치'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* llama.cpp 설치 안내 (로컬 고성능 엔진 모드일 때만 안내 노출) */}
          {apiType === 'local' && !isAvailable && (
            <div style={{
              padding: '8px', borderRadius: '6px',
              background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)',
              fontSize: '10px', color: 'var(--text-muted)',
            }}>
              AI 사용을 위해 llama.cpp를 설치하세요:<br />
              C:\ameva\llama\llama-cli.exe
            </div>
          )}
        </div>
      )}

      {/* 메시지 없을 때 환영 화면 */}
      {messages.length === 0 && !showSettings && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '20px', gap: '16px',
          overflowY: 'auto',
        }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(139,92,246,0.3), rgba(6,182,212,0.3))',
            border: '1px solid rgba(139,92,246,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 30px rgba(139,92,246,0.15)',
          }}>
            <Sparkles size={24} color="var(--primary)" />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '6px' }}>
              AMEVA AI
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              문서 작성을 돕는 로컬 AI입니다.<br />
              {selectedText ? (
                <span style={{ color: 'var(--secondary)', fontWeight: 'bold' }}>
                  에디터 선택 영역({selectedText.length}자) 분석 대기 중!
                </span>
              ) : (
                '아래 빠른 작업으로 시작하거나 직접 입력하세요.'
              )}
            </div>
          </div>

          {/* 빠른 작업 버튼들 */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {QUICK_ACTIONS.map(action => {
              const labelText = selectedText ? `선택 영역 ${action.label}` : action.label
              return (
                <button
                  key={action.id}
                  onClick={() => handleQuickAction(action.prompt)}
                  disabled={!isAvailable}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 14px', borderRadius: '8px',
                    background: selectedText ? 'rgba(6,182,212,0.06)' : 'var(--bg-glass)',
                    border: `1px solid ${selectedText ? 'rgba(6,182,212,0.25)' : 'var(--border-muted)'}`,
                    color: 'var(--text-main)', cursor: isAvailable ? 'pointer' : 'not-allowed',
                    fontSize: '12px', textAlign: 'left',
                    transition: 'all 0.15s',
                    opacity: isAvailable ? 1 : 0.5,
                  }}
                  onMouseEnter={e => {
                    if (isAvailable) {
                      ;(e.currentTarget as HTMLButtonElement).style.borderColor = selectedText ? 'var(--secondary)' : 'var(--primary)'
                      ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-glass-active)'
                    }
                  }}
                  onMouseLeave={e => {
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = selectedText ? 'rgba(6,182,212,0.25)' : 'var(--border-muted)'
                    ;(e.currentTarget as HTMLButtonElement).style.background = selectedText ? 'rgba(6,182,212,0.06)' : 'var(--bg-glass)'
                  }}
                >
                  <action.icon size={14} style={{ color: selectedText ? 'var(--secondary)' : 'var(--primary)', flexShrink: 0 }} />
                  <span>{labelText}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* 🤖 실시간 AI 엔진 터미널 로그 서랍장 */}
      {showLogs && (
        <div style={{
          height: isLogsExpanded ? '320px' : '160px',
          background: '#090a0f',
          borderBottom: '1px solid var(--border-muted)',
          display: 'flex', flexDirection: 'column',
          flexShrink: 0,
          transition: 'height 0.2s ease',
        }}>
          {/* 터미널 헤더 바 */}
          <div style={{
            background: '#000', padding: '4px 10px',
            borderBottom: '1px solid #1e1e24',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#10b981', fontFamily: 'monospace' }}>
              📟 AI ENGINE TERMINAL LOGS (REALTIME)
            </span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={() => setIsLogsExpanded(prev => !prev)}
                style={{
                  fontSize: '8px', color: 'var(--text-muted)', background: 'none',
                  border: 'none', cursor: 'pointer', padding: 0,
                }}
                title={isLogsExpanded ? "축소하기" : "확대하기"}
              >
                {isLogsExpanded ? "Collapse" : "Extend"}
              </button>
              <button
                onClick={() => setEngineLogs('')}
                style={{
                  fontSize: '8px', color: 'var(--text-muted)', background: 'none',
                  border: 'none', cursor: 'pointer', padding: 0,
                }}
                title="로그 비우기"
              >
                Clear
              </button>
            </div>
          </div>
          {/* 로그 아웃풋 스크롤 영역 */}
          <div 
            ref={logContainerRef}
            style={{
              flex: 1, overflowY: 'auto', padding: '8px',
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              fontSize: '9.5px', color: '#a7f3d0', lineHeight: '1.4',
              wordBreak: 'break-all', whiteSpace: 'pre-wrap',
              userSelect: 'text',
              WebkitUserSelect: 'text',
            }}
          >
            {engineLogs ? (
              <>
                {engineLogs}
                <div ref={logEndRef} />
              </>
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>
                [대기] AI 프롬프트 전송 시 여기에 로컬 llama-cli의 스폰/추론/GPU연산 프로세스 로그가 실시간 출력됩니다.
              </span>
            )}
          </div>
        </div>
      )}

      {/* 메시지 목록 */}
      {messages.length > 0 && (
        <div 
          ref={messagesContainerRef}
          style={{
            flex: 1, overflowY: 'auto',
            padding: '14px 12px',
            display: 'flex', flexDirection: 'column',
          }}
        >
          {messages.map(msg => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              onApplySuggestion={onApplySuggestion}
              hasSelection={!!selectedText}
              onUpdateDiffState={onUpdateDiffState}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* 📥 하단 다운로드 진행률 및 모달 레이저 */}
      {downloadStatus && downloadStatus.progress < 100 && (
        <div 
          onClick={() => setShowDownloadDetail(true)}
          style={{
            padding: '8px 12px',
            background: 'rgba(16,185,129,0.08)',
            borderTop: '1px solid rgba(16,185,129,0.15)',
            display: 'flex', alignItems: 'center', gap: '8px',
            cursor: 'pointer', flexShrink: 0,
            transition: 'background 0.2s'
          }}
        >
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', animation: 'pulse 1.5s infinite' }} />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#10b981', fontWeight: 700 }}>
              <span>모델 파일 다운로드 중...</span>
              <span>{downloadStatus.progress}%</span>
            </div>
            <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ width: `${downloadStatus.progress}%`, height: '100%', background: '#10b981', transition: 'width 0.2s' }} />
            </div>
          </div>
        </div>
      )}

      {/* 📥 다운로드 세부 진행 상황 팝업 모달 */}
      {showDownloadDetail && downloadStatus && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(8px)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-muted)',
            borderRadius: '12px', padding: '20px', width: '100%', maxWidth: '300px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#f8fafc' }}>다운로드 세부 정보</span>
              <button 
                onClick={() => setShowDownloadDetail(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={14} />
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
              <div><strong>파일명:</strong> <span style={{ color: 'var(--text-main)' }}>{downloadStatus.filename}</span></div>
              <div><strong>진행률:</strong> <span style={{ color: '#10b981', fontWeight: 700 }}>{downloadStatus.progress}%</span></div>
              <div><strong>받은 용량:</strong> <span style={{ color: 'var(--text-main)' }}>{(downloadStatus.downloadedBytes / (1024 * 1024)).toFixed(1)} MB / {(downloadStatus.totalBytes / (1024 * 1024)).toFixed(1)} MB</span></div>
              <div><strong>현재 속도:</strong> <span style={{ color: 'var(--secondary)', fontWeight: 700 }}>{downloadStatus.speed} MB/s</span></div>
              <div><strong>남은 시간:</strong> <span style={{ color: 'var(--accent)' }}>{downloadStatus.timeRemaining}초</span></div>
            </div>

            <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: `${downloadStatus.progress}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary), var(--secondary))', transition: 'width 0.2s' }} />
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button
                onClick={() => {
                  if ((window as any).electron) {
                    (window as any).electron.send('llm:cancelDownload')
                  }
                  setDownloadStatus(null)
                  setShowDownloadDetail(false)
                }}
                style={{
                  flex: 1, padding: '8px', borderRadius: '6px', background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontSize: '11px',
                  fontWeight: 700, cursor: 'pointer', textAlign: 'center'
                }}
              >
                다운로드 취소
              </button>
              <button
                onClick={() => setShowDownloadDetail(false)}
                style={{
                  flex: 1, padding: '8px', borderRadius: '6px', background: 'var(--bg-glass-active)',
                  border: '1px solid var(--border-muted)', color: 'var(--text-main)', fontSize: '11px',
                  fontWeight: 600, cursor: 'pointer', textAlign: 'center'
                }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 입력 영역 */}
      <div style={{
        padding: '10px 12px',
        borderTop: '1px solid var(--border-muted)',
        display: 'flex', flexDirection: 'column', gap: '8px',
        flexShrink: 0,
        background: 'var(--bg-glass-active)',
      }}>
        {/* 🤖 에이전트 작업 모드 수동 지정 / 자동 라우팅 제어 패널 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          background: 'rgba(0,0,0,0.2)',
          border: '1px solid var(--border-muted)',
          borderRadius: '8px',
          padding: '2px',
          marginBottom: '2px',
          width: '100%',
        }}>
          {([
            { id: 'auto', label: '자동 (Auto)' },
            { id: 'edit', label: '수정 (Edit)' },
            { id: 'summary', label: '요약 (Summary)' },
            { id: 'chat', label: '대화 (Chat)' }
          ] as const).map(tab => {
            const isActive = manualMode === tab.id
            const currentResolved = getActiveMode(input)
            const resolvedLabel = tab.id === 'auto'
              ? `자동 (${currentResolved.toUpperCase()})`
              : tab.label
            
            // 활성화 탭 색상 커스텀 (수정: 분홍색, 요약: 하늘색, 대화: 보라색)
            const activeColor = tab.id === 'edit' || (tab.id === 'auto' && currentResolved === 'edit')
              ? '#fb7185'
              : tab.id === 'summary' || (tab.id === 'auto' && currentResolved === 'summary')
              ? '#38bdf8'
              : '#c084fc'

            return (
              <button
                key={tab.id}
                onClick={() => setManualMode(tab.id)}
                style={{
                  flex: 1,
                  padding: '5px 4px',
                  borderRadius: '6px',
                  background: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
                  border: isActive ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
                  color: isActive ? activeColor : 'var(--text-muted)',
                  fontSize: '9px',
                  fontWeight: isActive ? 800 : 500,
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s',
                  outline: 'none',
                }}
              >
                {resolvedLabel}
              </button>
            )
          })}
        </div>

        {/* 🤖 모델 간편 선택 셀렉트 */}
        {models.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            width: '100%',
            marginBottom: '2px',
          }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, flexShrink: 0 }}>
              AI 모델:
            </span>
            <select
              value={settings.modelPath}
              onChange={e => onUpdateSettings({ modelPath: e.target.value })}
              style={{
                flex: 1,
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid var(--border-muted)',
                borderRadius: '6px',
                padding: '4px 6px',
                color: 'var(--text-main)',
                fontSize: '10px',
                outline: 'none',
                cursor: 'pointer',
                fontFamily: 'monospace',
              }}
            >
              {models.map(m => (
                <option key={m.path} value={m.path} style={{ background: 'var(--bg-main)', color: 'var(--text-main)' }}>
                  {m.filename}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 선택 텍스트 연동 알림 뱃지 */}
        {selectedText && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(90deg, rgba(6,182,212,0.12) 0%, transparent 100%)',
            border: '1px solid rgba(6,182,212,0.3)',
            borderRadius: '6px',
            padding: '6px 10px',
            marginBottom: '2px',
          }}>
            <span style={{ fontSize: '11px', color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold' }}>
              <Bot size={12} />
              에디터 선택 영역 연동 중 ({selectedText.length}자)
            </span>
            <button
              onClick={onClearSelectedText}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
                padding: '2px', borderRadius: '4px',
              }}
              title="연동 해제"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* 컨텍스트 옵션 + 클리어 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyCommand: 'space-between', justifyContent: 'space-between' }}>
          <label style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            fontSize: '10px', color: 'var(--text-muted)', cursor: 'pointer',
          }}>
            <input
              type="checkbox"
              checked={useContext}
              disabled={!!selectedText} // 선택 텍스트가 있을 때는 강제로 선택 텍스트 컨텍스트 사용
              onChange={e => setUseContext(e.target.checked)}
              style={{ accentColor: 'var(--primary)' }}
            />
            {selectedText ? '선택 영역 자동 연동됨' : '문서 전체 내용 포함'}
          </label>
          {messages.length > 0 && (
            <button
              onClick={onClear}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
                gap: '3px', fontSize: '10px', padding: '2px 4px', borderRadius: '4px',
              }}
            >
              <Trash2 size={10} />
              대화 지우기
            </button>
          )}
        </div>

        {/* 텍스트 입력 + 버튼 */}
        <div
          data-focus-region="ai-input"
          style={{ display: 'flex', gap: '6px', alignItems: 'flex-end', position: 'relative', borderRadius: '10px' }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isInputEnabled ? '메시지를 입력하세요... (Shift+Enter: 줄바꿈)' : 'llama.cpp 설치 필요'}
            disabled={!isInputEnabled}
            rows={2}
            style={{
              flex: 1,
              background: 'var(--bg-glass)',
              border: selectedText ? '1px solid rgba(6,182,212,0.4)' : '1px solid var(--border-muted)',
              borderRadius: '8px',
              padding: '8px 10px',
              color: 'var(--text-main)',
              fontSize: '12px',
              resize: 'none',
              outline: 'none',
              fontFamily: 'var(--font-sans)',
              lineHeight: '1.5',
              transition: 'border-color 0.15s',
              maxHeight: '80px',
              overflowY: 'auto',
            }}
            onFocus={e => (e.target.style.borderColor = selectedText ? 'var(--secondary)' : 'var(--primary)')}
            onBlur={e => (e.target.style.borderColor = selectedText ? 'rgba(6,182,212,0.4)' : 'var(--border-muted)')}
          />

          {isGenerating ? (
            <button
              onClick={onAbort}
              style={{
                width: '36px', height: '36px', borderRadius: '8px',
                background: 'rgba(239,68,68,0.2)',
                border: '1px solid rgba(239,68,68,0.4)',
                color: '#f87171', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
              title="중단"
            >
              <Square size={14} />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim() || !isInputEnabled}
              style={{
                width: '36px', height: '36px', borderRadius: '8px',
                background: input.trim() && isInputEnabled
                  ? (selectedText ? 'linear-gradient(135deg, var(--secondary), #0891b2)' : 'linear-gradient(135deg, var(--primary), #7c3aed)')
                  : 'rgba(255,255,255,0.05)',
                border: '1px solid transparent',
                color: '#fff', cursor: input.trim() && isInputEnabled ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                boxShadow: input.trim() && isInputEnabled ? (selectedText ? '0 2px 8px var(--secondary-glow)' : '0 2px 8px var(--primary-glow)') : 'none',
                transition: 'all 0.15s',
                opacity: input.trim() && isInputEnabled ? 1 : 0.4,
              }}
              title="전송 (Enter)"
            >
              <Send size={14} />
            </button>
          )}
        </div>
      </div>
        </>
      )}

      {activeTab === 'outline' && (() => {
        const isUnlocked = installedPlugins.includes('outline')
        if (!isUnlocked) {
          return (
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
              textAlign: 'center',
              color: 'var(--text-dark)',
              gap: '12px',
            }}>
              <Lock size={28} style={{ color: 'var(--text-dark)' }} />
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#f8fafc' }}>
                Outline 기능이 잠겨 있습니다.
              </div>
              <div style={{ fontSize: '11px', lineHeight: '1.5', color: 'var(--text-muted)' }}>
                상단 메뉴의 Marketplace에서<br />
                Outline 익스텐션을 구독하시면 즉시 잠금이 해제됩니다.
              </div>
            </div>
          )
        }

        const getDocumentOutline = (items: any[]): { id: string; text: string; level: number }[] => {
          const list: any[] = []
          const traverse = (arr: any[]) => {
            for (const item of arr) {
              if (item.type === 'heading') {
                const text = item.content?.map((c: any) => c.text).join('') || '제목 없음'
                list.push({
                  id: item.id,
                  text,
                  level: item.props?.level || 1,
                })
              }
              if (item.children) {
                traverse(item.children)
              }
            }
          }
          if (items && Array.isArray(items)) {
            traverse(items)
          }
          return list
        }

        const outline = getDocumentOutline(blocks)

        return (
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px' }}>
              문서 개요 (총 {outline.length}개 제목)
            </div>
            {outline.length === 0 ? (
              <div style={{ fontSize: '11px', color: 'var(--text-dark)', fontStyle: 'italic', textAlign: 'center', marginTop: '24px' }}>
                작성된 제목(Heading)이 없습니다.
              </div>
            ) : (
              outline.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    const el = document.querySelector(`[data-id="${item.id}"]`)
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      el.classList.add('pulse-indicator')
                      setTimeout(() => el.classList.remove('pulse-indicator'), 1000)
                    }
                  }}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: item.level === 1 ? 'var(--text-main)' : 'var(--text-muted)',
                    fontWeight: item.level === 1 ? 700 : item.level === 2 ? 600 : 500,
                    paddingLeft: `${(item.level - 1) * 12 + 10}px`,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'background 0.15s',
                    borderLeft: item.level === 1 ? '2px solid var(--primary)' : '2px solid transparent',
                    background: 'rgba(255,255,255,0.01)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-glass-active)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.01)'}
                >
                  <span style={{
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    backgroundColor: item.level === 1 ? 'var(--primary)' : 'var(--text-dark)',
                    display: 'inline-block'
                  }} />
                  {item.text}
                </div>
              ))
            )}
          </div>
        )
      })()}

      {activeTab === 'calculator' && (
        <div
          id="ameva-plugin-calculator"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--bg-main)',
            height: '100%',
            padding: '16px',
            overflowY: 'auto',
          }}
          ref={(el) => {
            if (el && (window as any).AMEVA_PLUGINS?.calculator) {
              try {
                (window as any).AMEVA_PLUGINS.calculator.render(el.id);
              } catch (e) {
                console.error('계산기 플러그인 렌더링 실패:', e);
              }
            }
          }}
        />
      )}

      {activeTab === 'finance' && (
        <div
          id="ameva-plugin-finance-dashboard"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--bg-main)',
            height: '100%',
            padding: '16px',
            overflowY: 'auto',
          }}
          ref={(el) => {
            if (el && (window as any).AMEVA_PLUGINS?.["finance-dashboard"]) {
              try {
                (window as any).AMEVA_PLUGINS["finance-dashboard"].render(el.id);
              } catch (e) {
                console.error('주식/환율 플러그인 렌더링 실패:', e);
              }
            }
          }}
        />
      )}

      {activeTab === 'youtube' && (
        <div
          id="ameva-plugin-youtube"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--bg-main)',
            height: '100%',
            padding: '16px',
            overflowY: 'auto',
          }}
          ref={(el) => {
            if (el && (window as any).AMEVA_PLUGINS?.youtube) {
              try {
                (window as any).AMEVA_PLUGINS.youtube.render(el.id);
              } catch (e) {
                console.error('YouTube 플러그인 렌더링 실패:', e);
              }
            }
          }}
        />
      )}

      {activeTab === 'naver' && (
        <div
          id="ameva-plugin-naver"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--bg-main)',
            height: '100%',
            padding: '16px',
          }}
          ref={(el) => {
            if (el && (window as any).AMEVA_PLUGINS?.naver) {
              try {
                (window as any).AMEVA_PLUGINS.naver.render(el.id);
              } catch (e) {
                console.error('Naver 플러그인 렌더링 실패:', e);
              }
            }
          }}
        />
      )}

      {activeTab === 'google' && (
        <div
          id="ameva-plugin-google"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--bg-main)',
            height: '100%',
            padding: '16px',
          }}
          ref={(el) => {
            if (el && (window as any).AMEVA_PLUGINS?.google) {
              try {
                (window as any).AMEVA_PLUGINS.google.render(el.id);
              } catch (e) {
                console.error('Google 플러그인 렌더링 실패:', e);
              }
            }
          }}
        />
      )}

      {activeTab === 'calendar' && (
        <div
          id="ameva-plugin-calendar"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--bg-main)',
            height: '100%',
            padding: '16px',
            overflowY: 'auto',
          }}
          ref={(el) => {
            if (el && (window as any).AMEVA_PLUGINS?.calendar) {
              try {
                (window as any).AMEVA_PLUGINS.calendar.render(el.id);
              } catch (e) {
                console.error('Calendar 플러그인 렌더링 실패:', e);
              }
            }
          }}
        />
      )}

      {activeTab === 'google-drive' && (
        <div
          id="ameva-plugin-google-drive"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--bg-main)',
            height: '100%',
            padding: '16px',
            overflowY: 'auto',
          }}
          ref={(el) => {
            if (el && (window as any).AMEVA_PLUGINS?.["google-drive"]) {
              try {
                (window as any).AMEVA_PLUGINS["google-drive"].render(el.id);
              } catch (e) {
                console.error('GoogleDrive 플러그인 렌더링 실패:', e);
              }
            }
          }}
        />
      )}

      {/* 🤖 AMEVA AI 추천 모델 다운로드 허브 모달 */}
      {showModelHub && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '20px',
        }}>
          <div style={{
            background: 'var(--bg-main)', border: '1px solid var(--border-muted)',
            borderRadius: '12px', width: '100%', maxWidth: '440px',
            padding: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            display: 'flex', flexDirection: 'column', gap: '14px',
            color: 'var(--text-main)', position: 'relative',
          }}>
            <button
              onClick={() => setShowModelHub?.(false)}
              style={{
                position: 'absolute', top: '16px', right: '16px',
                background: 'none', border: 'none', color: 'var(--text-muted)',
                cursor: 'pointer', fontSize: '16px',
              }}
            >
              <X size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bot style={{ color: 'var(--primary)' }} size={22} />
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>AMEVA AI 모델 다운로드 센터</h3>
            </div>

            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
              원하는 사양의 온디바이스 언어모델(.gguf)을 다운로드하세요.<br />
              내려받은 파일은 기본 경로 <code>C:\ameva\models\llm\</code> 에 저장되며 감지 완료 시 즉시 AI를 구동할 수 있습니다.
            </p>

            <div style={{
              display: 'flex', flexDirection: 'column', gap: '8px',
              maxHeight: '240px', overflowY: 'auto', paddingRight: '4px',
            }}>
              {[
                {
                  name: 'Qwen 2.5 1.5B (초경량 모델)',
                  size: '1.1 GB',
                  desc: '저사양 PC 및 오피스 문서 최적화',
                  url: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf',
                  filename: 'qwen2.5-1.5b-instruct-q4_k_m.gguf',
                },
                {
                  name: 'Gemma 2 2B (구글 추천 모델)',
                  size: '1.6 GB',
                  desc: '빠른 속도와 우수한 한국어 이해도',
                  url: 'https://huggingface.co/lmstudio-community/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf',
                  filename: 'gemma-2-2b-it-q4_k_m.gguf',
                },
                {
                  name: 'EXAONE 3.0 2.4B (국산 최고 모델)',
                  size: '1.7 GB',
                  desc: 'LG AI 연구원의 뛰어난 한국어 특화 성능',
                  url: 'https://huggingface.co/LGAI-EXAONE/EXAONE-3.0-2.4B-Instruct-GGUF/resolve/main/exaone-3.0-2.4b-instruct-q4_k_m.gguf',
                  filename: 'exaone-3.0-2.4b-instruct-q4_k_m.gguf',
                },
                {
                  name: 'Qwen 2.5 3B (스탠다드 모델)',
                  size: '2.2 GB',
                  desc: '속도와 논리력 밸런스가 잡힌 베스트 에디션',
                  url: 'https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf',
                  filename: 'qwen2.5-3b-instruct-q4_k_m.gguf',
                },
                {
                  name: 'Llama 3.2 8B (고성능 모델)',
                  size: '4.7 GB',
                  desc: '강력한 논리력, 외장 GPU 장착 권장',
                  url: 'https://huggingface.co/lmstudio-community/Llama-3.2-8B-Instruct-GGUF/resolve/main/Llama-3.2-8B-Instruct-Q4_K_M.gguf',
                  filename: 'Llama-3.2-8B-Instruct-Q4_K_M.gguf',
                }
              ].map((model) => {
                const isDownloadingThis = downloadStatus && downloadStatus.filename === model.filename
                return (
                  <div key={model.filename} style={{
                    padding: '10px', borderRadius: '8px',
                    background: 'var(--bg-glass)', border: '1px solid var(--border-muted)',
                    display: 'flex', flexDirection: 'column', gap: '6px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700 }}>{model.name}</span>
                      <span style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: 800 }}>{model.size}</span>
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{model.desc}</div>

                    <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                      <button
                        onClick={() => {
                          if (window.electronAPI?.openExternalLink) {
                            window.electronAPI.openExternalLink(model.url)
                          } else {
                            window.open(model.url, '_blank')
                          }
                        }}
                        style={{
                          flex: 1, padding: '5px 8px', borderRadius: '4px',
                          background: 'rgba(255,255,255,0.06)', color: 'var(--text-main)',
                          border: '1px solid var(--border-muted)', fontSize: '10px',
                          cursor: 'pointer', fontWeight: 600, textAlign: 'center',
                        }}
                      >
                        브라우저 다운로드 🌐
                      </button>

                      {window.electronAPI?.llmDownloadModel && (
                        <button
                          disabled={!!downloadStatus}
                          onClick={async () => {
                            if (window.electronAPI?.llmDownloadModel) {
                              setDownloadStatus({ filename: model.filename, progress: 0, speed: 0 })
                              const res = await window.electronAPI.llmDownloadModel({
                                url: model.url,
                                filename: model.filename,
                              })
                              if (res && !res.success) {
                                alert(`다운로드 실패: ${res.error}`)
                                setDownloadStatus(null)
                              }
                            }
                          }}
                          style={{
                            flex: 1, padding: '5px 8px', borderRadius: '4px',
                            background: 'var(--primary)', color: '#fff',
                            border: 'none', fontSize: '10px',
                            cursor: !!downloadStatus ? 'not-allowed' : 'pointer',
                            fontWeight: 700, opacity: !!downloadStatus ? 0.5 : 1,
                          }}
                        >
                          앱 내 자동 설치 📥
                        </button>
                      )}
                    </div>

                    {isDownloadingThis && (
                      <div style={{ marginTop: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--text-muted)', marginBottom: '3px' }}>
                          <span>속도: {downloadStatus.speed} MB/s</span>
                          <span>진행률: {downloadStatus.progress}%</span>
                        </div>
                        <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${downloadStatus.progress}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.2s' }} />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
              <button
                onClick={() => {
                  if (window.electronAPI?.openExternalLink) {
                    window.electronAPI.openExternalLink('file:///C:/ameva/models/llm/')
                  }
                }}
                style={{
                  flex: 1, padding: '7px 10px', borderRadius: '6px',
                  background: 'none', border: '1px solid var(--border-muted)',
                  color: 'var(--text-main)', fontSize: '11px', cursor: 'pointer',
                }}
              >
                폴더 열기 📂
              </button>
              <button
                onClick={() => setShowModelHub?.(false)}
                style={{
                  flex: 1, padding: '7px 10px', borderRadius: '6px',
                  background: 'var(--bg-glass-active)', border: '1px solid var(--border-muted)',
                  color: 'var(--text-main)', fontSize: '11px', cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                완료 및 닫기
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes cursor-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes dot-blink {
          0%, 80%, 100% { transform: scale(0); opacity: 0.3; }
          40% { transform: scale(1.0); opacity: 1; }
        }
        .dot-thinking {
          display: inline-block;
        }
      `}</style>
    </div>
  )
}
