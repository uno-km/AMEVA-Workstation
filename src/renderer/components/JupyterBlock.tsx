import React, { useEffect, useRef, useState } from 'react'
import { createReactBlockSpec, BlockContentWrapper } from '@blocknote/react'
import { JupyterCodeEditorHeader, JupyterCodeEditorTerminal } from './JupyterCodeEditor'
import type { RunState } from './JupyterCodeEditor'
import { useCodeRuntime } from '../hooks/useCodeRuntime'

// ─── 0. 자동완성용 정적 키워드 사전 ───────────────────────────
const KEYWORDS: Record<string, string[]> = {
  javascript: ['console', 'const', 'let', 'function', 'return', 'import', 'export', 'await', 'async', 'document', 'window', 'Promise', 'setTimeout', 'setInterval', 'querySelector', 'addEventListener', 'stringify', 'parse', 'forEach', 'map', 'filter', 'reduce'],
  python: ['print', 'def', 'import', 'return', 'class', 'self', 'lambda', 'yield', 'try', 'except', 'finally', 'global', 'numpy', 'pandas', 'matplotlib', 'range', 'len', 'append', 'dict', 'list', 'split', 'join'],
  sql: ['SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'ON', 'GROUP', 'BY', 'ORDER', 'LIMIT', 'COUNT', 'SUM'],
  html: ['div', 'span', 'class', 'id', 'style', 'script', 'href', 'iframe', 'button', 'canvas', 'input', 'head', 'body', 'section', 'header', 'footer', 'meta', 'link', 'title'],
  bash: ['echo', 'cd', 'ls', 'pwd', 'mkdir', 'rm', 'git', 'npm', 'node', 'python', 'pip', 'grep', 'cat', 'install', 'run', 'build', 'sudo', 'chmod', 'clear'],
  cmd: ['echo', 'cd', 'dir', 'mkdir', 'del', 'rmdir', 'copy', 'move', 'cls', 'path', 'taskkill', 'tasklist', 'netstat', 'ipconfig']
}

// 본문 문서 내 최근 단어 토크나이저 (최소 2글자 이상으로 완화하여 짧은 변수도 파싱)
function getDocWords(text: string): string[] {
  const matches = text.match(/\b[a-zA-Z_]\w{1,25}\b/g)
  if (!matches) return []
  return Array.from(new Set(matches))
}

// 1. 커스텀 Jupyter React 블록 정의
const JupyterBlockSpec = createReactBlockSpec(
  {
    type: 'jupyter',
    propSchema: {
      language: { default: 'javascript' },
      code: { default: '' },
      runState: { default: '{"hasRun":false,"success":null,"outputLines":[]}' }
    },
    content: 'none'
  },
  {
    render: ({ block, editor }) => {
      try {
        const code = block.props.code || ''
        const language = block.props.language || 'javascript'
        const { runJSCode, runPythonCode, runSQLCode } = useCodeRuntime()
        const [isInputCollapsed, setIsInputCollapsed] = useState(false)
        const textareaRef = useRef<HTMLTextAreaElement | null>(null)
        const [cursorPos, setCursorPos] = useState(0)
        const mirrorRef = useRef<HTMLDivElement | null>(null)

        // 로컬 입력 버퍼 캐시 (랙 방지)
        const [localCode, setLocalCode] = useState(code)

        // 부모의 code prop이 변경되면 로컬 캐시 동기화 (단, 포커스 중이 아닐 때만)
        useEffect(() => {
          if (document.activeElement !== textareaRef.current) {
            setLocalCode(code)
          }
        }, [code])

        // 텍스트 스크롤 동기화 핸들러
        const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
          if (mirrorRef.current) {
            mirrorRef.current.scrollTop = e.currentTarget.scrollTop
          }
        }

        // 제안 단어 실시간 계산 (로컬 캐시 기준)
        let suggestion = ''
        const beforeCursor = localCode.substring(0, cursorPos)
        const prefixMatch = beforeCursor.match(/([a-zA-Z_]\w*)$/)
        const prefix = prefixMatch ? prefixMatch[1] : ''

        if (prefix.length >= 1) {
          const langKeywords = KEYWORDS[language] || []
          const docWords = getDocWords(localCode)
          // 0순위로 본문 로컬 변수명(docWords)을 매핑! 그 뒤에 정적 키워드 결합!
          const allCandidates = Array.from(new Set([...docWords, ...langKeywords]))
          const match = allCandidates.find(w => w.toLowerCase().startsWith(prefix.toLowerCase()) && w.toLowerCase() !== prefix.toLowerCase())
          if (match) {
            suggestion = match.substring(prefix.length)
          }
        }
        
        let parsedRunState: RunState = { hasRun: false, success: null, outputLines: [] }
        if (block.props.runState) {
          try {
            parsedRunState = JSON.parse(block.props.runState)
          } catch (e) {
            console.error('runState 파싱 에러:', e)
          }
        }

        // 블록 props 변경 유틸 (로컬과 부모 상태 둘 다 갱신)
        const updateCode = (newCode: string) => {
          setLocalCode(newCode)
          editor.updateBlock(block.id, {
            type: 'jupyter',
            props: { ...block.props, code: newCode }
          })
        }

        const updateRunState = (newRunState: RunState) => {
          editor.updateBlock(block.id, {
            type: 'jupyter',
            props: { ...block.props, runState: JSON.stringify(newRunState) }
          })
        }

        // Ctrl+Enter 실행 로직
        const handleCtrlEnterRun = async () => {
          updateRunState({
            hasRun: true,
            success: null,
            outputLines: [{ type: 'info', text: '▶ 실행 중...' }]
          })
          try {
            if (language === 'html') {
              updateRunState({
                hasRun: true,
                success: true,
                outputLines: [{ type: 'info', text: '렌더링 완료' }]
              })
              return
            }
            const result = (language === 'python' || language === 'py')
              ? await runPythonCode(code)
              : (language === 'sql')
              ? await runSQLCode(code)
              : await runJSCode(code)
            updateRunState({
              hasRun: true,
              success: result.success,
              outputLines: (result.output || '').split('\n').map(text => ({
                type: result.success ? 'stdout' : 'stderr',
                text
              })),
              tableData: result.tableData
            })
          } catch (err: any) {
            updateRunState({
              hasRun: true,
              success: false,
              outputLines: [{ type: 'stderr', text: err.message || '알 수 없는 에러' }]
            })
          }
        }

        // 갓 생성된 빈 코드블록인 경우 인풋 textarea에 자동 포커스
        useEffect(() => {
          if (textareaRef.current && code === '') {
            const timer = setTimeout(() => {
              textareaRef.current?.focus()
            }, 60)
            return () => clearTimeout(timer)
          }
        }, [block.id])

        return (
          <BlockContentWrapper
            blockType="jupyter"
            blockProps={block.props}
            propSchema={{
              language: { default: 'javascript' },
              code: { default: '' },
              runState: { default: '{"hasRun":false,"success":null,"outputLines":[]}' }
            }}
          >
            <div
              className="custom-jupyter-card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                background: '#12131a',
                border: '1.5px solid rgba(139, 92, 246, 0.25)',
                borderRadius: '10px',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
                overflow: 'hidden',
                margin: '14px 0',
                width: '100%',
                boxSizing: 'border-box',
                fontFamily: '"JetBrains Mono","Fira Code","Cascadia Code",monospace',
              }}
            >
              {/* 1. 상단 헤더 배너 (Run / Copy 버튼) */}
              <div style={{ height: '36px', width: '100%' }}>
                <JupyterCodeEditorHeader
                  code={code}
                  language={language}
                  blockId={block.id}
                  editor={editor as any}
                  isInputCollapsed={isInputCollapsed}
                  onToggleInputCollapse={() => setIsInputCollapsed(!isInputCollapsed)}
                  onRunStart={() => {
                    updateRunState({
                      hasRun: true,
                      success: null,
                      outputLines: [{ type: 'info', text: '▶ 실행 중...' }]
                    })
                  }}
                  onRunSuccess={(success, lines, tableData) => {
                    updateRunState({
                      hasRun: true,
                      success,
                      outputLines: lines.map(text => ({ type: success ? 'stdout' : 'stderr', text })),
                      tableData
                    })
                  }}
                  onRunFailure={(errMessage) => {
                    updateRunState({
                      hasRun: true,
                      success: false,
                      outputLines: [{ type: 'stderr', text: errMessage }]
                    })
                  }}
                />
              </div>

              {/* 2. 중단 정적 textarea 코드 에디터 */}
              <div 
                style={{ 
                  padding: isInputCollapsed ? '0px 14px' : '12px 14px', 
                  background: '#12131a', 
                  display: 'flex', 
                  flexDirection: 'column',
                  maxHeight: isInputCollapsed ? '0px' : '500px',
                  overflow: 'hidden',
                  transition: 'max-height 0.25s ease-out, padding 0.25s ease-out',
                  position: 'relative'
                }}
              >
                {/* 고스트 텍스트 오버레이 레이어 (z-index 1, 투명 글자와 겹쳐서 회색 제안 노출) */}
                {!isInputCollapsed && (
                  <div
                    ref={mirrorRef}
                    style={{
                      position: 'absolute',
                      top: '12px',
                      left: '14px',
                      right: '14px',
                      bottom: '12px',
                      pointerEvents: 'none',
                      fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, Monaco, monospace",
                      fontSize: '13px',
                      lineHeight: '1.6',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      color: 'transparent',
                      overflow: 'hidden',
                      textAlign: 'left'
                    }}
                  >
                    <span>{localCode.substring(0, cursorPos)}</span>
                    {suggestion && (
                      <span style={{ color: '#6b7280', opacity: 0.8, background: 'rgba(255,255,255,0.06)', borderRadius: '2px', padding: '0 2px' }}>
                        {suggestion}
                      </span>
                    )}
                  </div>
                )}

                <textarea
                  ref={textareaRef}
                  value={localCode}
                  onChange={(e) => {
                    updateCode(e.target.value)
                    setCursorPos(e.target.selectionStart)
                  }}
                  onSelect={(e) => {
                    setCursorPos(e.currentTarget.selectionStart)
                  }}
                  onKeyUp={(e) => {
                    setCursorPos(e.currentTarget.selectionStart)
                  }}
                  onScroll={handleScroll}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault()
                      handleCtrlEnterRun()
                      return
                    }

                    const textarea = textareaRef.current
                    if (!textarea) return

                    const start = textarea.selectionStart
                    const end = textarea.selectionEnd
                    const text = textarea.value

                    // 1. Tab 키 자동완성 수락 혹은 들여쓰기
                    if (e.key === 'Tab') {
                      e.preventDefault()
                      if (suggestion) {
                        const newCode = text.substring(0, start) + suggestion + text.substring(end)
                        updateCode(newCode)
                        const newPos = start + suggestion.length
                        setTimeout(() => {
                          textarea.selectionStart = textarea.selectionEnd = newPos
                          setCursorPos(newPos)
                        }, 0)
                      } else {
                        const space = '  '
                        const newCode = text.substring(0, start) + space + text.substring(end)
                        updateCode(newCode)
                        setTimeout(() => {
                          textarea.selectionStart = textarea.selectionEnd = start + space.length
                          setCursorPos(start + space.length)
                        }, 0)
                      }
                      return
                    }

                    // 2. 괄호 / 따옴표 자동 닫힘
                    const pairs: Record<string, string> = {
                      '(': ')',
                      '{': '}',
                      '[': ']',
                      '"': '"',
                      "'": "'",
                      '`': '`'
                    }

                    if (pairs[e.key] !== undefined) {
                      e.preventDefault()
                      const closingChar = pairs[e.key]
                      const selection = text.substring(start, end)
                      const newCode = text.substring(0, start) + e.key + selection + closingChar + text.substring(end)
                      updateCode(newCode)
                      setTimeout(() => {
                        textarea.selectionStart = start + 1
                        textarea.selectionEnd = start + 1 + selection.length
                        setCursorPos(start + 1)
                      }, 0)
                      return
                    }

                    // 3. 닫는 문자 스킵
                    const closers = [')', '}', ']', '"', "'", '`']
                    if (closers.includes(e.key) && text[start] === e.key) {
                      e.preventDefault()
                      setTimeout(() => {
                        textarea.selectionStart = textarea.selectionEnd = start + 1
                        setCursorPos(start + 1)
                      }, 0)
                      return
                    }

                    // 4. HTML 태그 자동 닫힘
                    if (language === 'html' && e.key === '>') {
                      const beforeText = text.substring(0, start)
                      const tagMatch = beforeText.match(/<([a-zA-Z1-6]+)(?:\s+[^>]*)?$/)
                      if (tagMatch) {
                        e.preventDefault()
                        const tagName = tagMatch[1]
                        const newCode = beforeText + '>' + '</' + tagName + '>' + text.substring(end)
                        updateCode(newCode)
                        setTimeout(() => {
                          textarea.selectionStart = textarea.selectionEnd = start + 1
                          setCursorPos(start + 1)
                        }, 0)
                        return
                      }
                    }
                  }}
                  placeholder="// 이곳에 코드를 입력하세요... (JavaScript 또는 Python)"
                  style={{
                    width: '100%',
                    minHeight: '80px',
                    background: 'transparent',
                    border: 'none',
                    color: '#f3f4f6',
                    fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, Monaco, monospace",
                    fontSize: '13px',
                    lineHeight: '1.6',
                    resize: 'vertical',
                    outline: 'none',
                    padding: '0',
                    margin: '0',
                    zIndex: 2,
                    caretColor: '#a78bfa'
                  }}
                />
              </div>

              {/* 3. 하단 터미널 결과창 */}
              {parsedRunState.hasRun && (
                <div style={{ width: '100%' }}>
                  <JupyterCodeEditorTerminal
                    language={language}
                    runState={parsedRunState}
                    code={code}
                    blockId={block.id}
                  />
                </div>
              )}
            </div>
          </BlockContentWrapper>
        )
      } catch (err: any) {
        return (
          <div style={{
            padding: '16px',
            margin: '14px 0',
            background: '#fef2f2',
            border: '1.5px solid #f87171',
            borderRadius: '10px',
            color: '#991b1b',
            fontFamily: 'monospace',
            fontSize: '12px'
          }}>
            Jupyter 블록 렌더링 실패: {err.message}
          </div>
        )
      }
    },
    toExternalHTML: ({ block }) => {
      return (
        <pre data-content-type="jupyter" data-language={block.props.language}>
          <code>{block.props.code}</code>
        </pre>
      )
    }
  }
)

export const JupyterBlock = JupyterBlockSpec()
