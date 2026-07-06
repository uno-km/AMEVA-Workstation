import React, { useEffect, useRef, useState } from 'react'
import { X, ChevronDown, ChevronUp, Replace, ReplaceAll, Search } from 'lucide-react'

interface FindReplaceBarProps {
  isOpen: boolean
  onClose: () => void
  editor: any // BlockNoteEditor
  onScrollToBlock: (blockId: string) => void
  initialMode?: 'find' | 'replace'
}

interface SearchMatch {
  blockId: string
  blockType: string
  text: string
  matchIndices: number[] // 블록 텍스트 내에서 매칭이 시작되는 문자열 오프셋 리스트
}

export function FindReplaceBar({
  isOpen,
  onClose,
  editor,
  onScrollToBlock,
  initialMode = 'find'
}: FindReplaceBarProps) {
  const [findQuery, setFindQuery] = useState('')
  const [replaceQuery, setReplaceQuery] = useState('')
  const [showReplace, setShowReplace] = useState(initialMode === 'replace')
  const [matchCase, setMatchCase] = useState(false)
  const [matches, setMatches] = useState<SearchMatch[]>([])
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1) // 전체 매칭 중 현재 인덱스
  
  const findInputRef = useRef<HTMLInputElement>(null)

  // 모드가 변경될 때 상태 동기화 및 인풋 포커스
  useEffect(() => {
    if (isOpen) {
      setShowReplace(initialMode === 'replace')
      setTimeout(() => {
        findInputRef.current?.focus()
        findInputRef.current?.select()
      }, 50)
      performSearch()
    }
  }, [isOpen, initialMode])

  // 검색 쿼리가 변경되거나 대소문자 구분 변경 시 검색 즉시 수행
  useEffect(() => {
    performSearch()
  }, [findQuery, matchCase])

  // 에디터의 문서가 바뀌었을 때 검색 결과 업데이트를 위한 폴백
  useEffect(() => {
    if (!isOpen || !editor) return
    
    // 에디터 블록 변경 감지용 간단한 폴링 또는 이벤트 연동 (가벼운 간격 체크)
    const interval = setInterval(() => {
      performSearch(true) // 인덱스 유지하며 갱신
    }, 1000)
    
    return () => clearInterval(interval)
  }, [isOpen, editor, findQuery, matchCase])

  // ESC 키 누르면 찾기 창 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])

  // 전체 매칭 리스트의 총 개수 계산
  const totalMatchesCount = matches.reduce((acc, m) => acc + m.matchIndices.length, 0)

  // 현재 매칭의 글로벌 순서 번호와 구체적인 { blockId, charOffset } 알아내기
  const getCurrentActiveMatch = () => {
    if (currentMatchIndex < 0 || matches.length === 0) return null
    let count = 0
    for (let mIdx = 0; mIdx < matches.length; mIdx++) {
      const match = matches[mIdx]
      for (let iIdx = 0; iIdx < match.matchIndices.length; iIdx++) {
        if (count === currentMatchIndex) {
          return {
            match,
            blockId: match.blockId,
            charOffset: match.matchIndices[iIdx],
            matchLength: findQuery.length
          }
        }
        count++
      }
    }
    return null
  }

  // 실질적인 검색 매칭 탐색 로직
  const performSearch = (keepIndex = false) => {
    if (!editor || !findQuery) {
      setMatches([])
      setCurrentMatchIndex(-1)
      return
    }

    const flatBlocks: any[] = []
    const traverse = (blks: any[]) => {
      for (const b of blks) {
        flatBlocks.push(b)
        if (b.children) traverse(b.children)
      }
    }
    traverse(editor.document)

    const newMatches: SearchMatch[] = []
    
    flatBlocks.forEach(block => {
      // 블록 내 텍스트 추출 (Rich Text의 텍스트만 합산)
      const text = getBlockPlainText(block)
      if (!text) return

      let searchTarget = text
      let queryTarget = findQuery
      if (!matchCase) {
        searchTarget = text.toLowerCase()
        queryTarget = findQuery.toLowerCase()
      }

      const indices: number[] = []
      let startIdx = searchTarget.indexOf(queryTarget)
      while (startIdx !== -1) {
        indices.push(startIdx)
        startIdx = searchTarget.indexOf(queryTarget, startIdx + queryTarget.length)
      }

      if (indices.length > 0) {
        newMatches.push({
          blockId: block.id,
          blockType: block.type,
          text,
          matchIndices: indices
        })
      }
    })

    setMatches(newMatches)

    // 인덱스 보정
    const totalCount = newMatches.reduce((acc, m) => acc + m.matchIndices.length, 0)
    if (totalCount === 0) {
      setCurrentMatchIndex(-1)
    } else if (keepIndex) {
      if (currentMatchIndex >= totalCount) {
        setCurrentMatchIndex(totalCount - 1)
      } else if (currentMatchIndex < 0) {
        setCurrentMatchIndex(0)
      }
    } else {
      setCurrentMatchIndex(0)
    }
  }

  // 블록에서 순수 텍스트 문자열 가져오기
  const getBlockPlainText = (block: any): string => {
    if (!block.content) return ''
    if (typeof block.content === 'string') return block.content
    if (Array.isArray(block.content)) {
      return block.content.map((c: any) => c.text || '').join('')
    }
    return ''
  }

  // 이전/다음 이동 핸들러
  const handleNavigate = (direction: 'next' | 'prev') => {
    if (matches.length === 0) return
    const totalCount = totalMatchesCount
    
    let nextIdx = currentMatchIndex
    if (direction === 'next') {
      nextIdx = (currentMatchIndex + 1) % totalCount
    } else {
      nextIdx = (currentMatchIndex - 1 + totalCount) % totalCount
    }
    
    setCurrentMatchIndex(nextIdx)
    
    // 현재 포커스 매칭 알아내고 스크롤 이동
    let count = 0
    for (const match of matches) {
      for (let i = 0; i < match.matchIndices.length; i++) {
        if (count === nextIdx) {
          onScrollToBlock(match.blockId)
          return
        }
        count++
      }
    }
  }

  // 1개 단어 바꾸기 (Replace)
  const handleReplace = async () => {
    const active = getCurrentActiveMatch()
    if (!active || !editor) return

    const { blockId, charOffset, matchLength } = active
    const block = findBlockById(editor.document, blockId)
    if (!block) return

    const currentText = getBlockPlainText(block)
    const before = currentText.substring(0, charOffset)
    const after = currentText.substring(charOffset + matchLength)
    const replacedText = before + replaceQuery + after

    // 블록 텍스트 업데이트 (Rich Text 형식 호환 유지를 위한 가공)
    await updateBlockText(blockId, replacedText)
    
    // 검색 다시 돌리고 현재 매칭 번호 유지
    performSearch(true)
  }

  // 전체 바꾸기 (Replace All)
  const handleReplaceAll = async () => {
    if (matches.length === 0 || !editor) return

    for (const match of matches) {
      const block = findBlockById(editor.document, match.blockId)
      if (!block) continue

      const currentText = getBlockPlainText(block)
      
      let searchTarget = currentText
      let queryTarget = findQuery
      if (!matchCase) {
        searchTarget = currentText.toLowerCase()
        queryTarget = findQuery.toLowerCase()
      }

      // 비대소문자 구분을 유지한 상태에서 모든 매칭 오프셋을 역순으로 변경해야 인덱스가 꼬이지 않음
      const indices: number[] = []
      let startIdx = searchTarget.indexOf(queryTarget)
      while (startIdx !== -1) {
        indices.push(startIdx)
        startIdx = searchTarget.indexOf(queryTarget, startIdx + queryTarget.length)
      }

      let newText = currentText
      for (let i = indices.length - 1; i >= 0; i--) {
        const offset = indices[i]
        newText = newText.substring(0, offset) + replaceQuery + newText.substring(offset + findQuery.length)
      }

      await updateBlockText(match.blockId, newText)
    }

    performSearch(false)
  }

  // 블록 ID 기반 블록 탐색 헬퍼
  const findBlockById = (blks: any[], id: string): any => {
    for (const b of blks) {
      if (b.id === id) return b
      if (b.children) {
        const found = findBlockById(b.children, id)
        if (found) return found
      }
    }
    return null
  }

  // 에디터 블록 텍스트 교체 처리
  const updateBlockText = async (blockId: string, newText: string) => {
    if (!editor) return
    const block = findBlockById(editor.document, blockId)
    if (!block) return

    // 에디터의 기존 content 형식이 Array(Rich Text)인지 String인지 체크 후 빌드
    if (Array.isArray(block.content)) {
      // 기존 스타일이 있는 첫 번째 객체를 기반으로 텍스트 교체 처리 (스타일 보존)
      const firstChunk = block.content[0] || { type: 'text', styles: {} }
      editor.updateBlock(blockId, {
        content: [{ ...firstChunk, text: newText }]
      })
    } else {
      editor.updateBlock(blockId, {
        content: newText
      })
    }
  }

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: '64px',
        right: '24px',
        zIndex: 999,
        width: '320px',
        padding: '12px',
        borderRadius: '12px',
        background: 'rgba(10, 10, 15, 0.75)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.4), 0 0 15px rgba(139, 92, 246, 0.1)',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        animation: 'slideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        userSelect: 'none',
      }}
    >
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-10px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* 헤더 제어 영역 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {showReplace ? '찾기 및 바꾸기 (Find & Replace)' : '문서 검색 (Find)'}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={() => setShowReplace(!showReplace)}
            style={{
              background: showReplace ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
              border: 'none',
              borderRadius: '4px',
              padding: '2px 4px',
              color: showReplace ? '#c084fc' : 'var(--text-muted)',
              fontSize: '9.5px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {showReplace ? '찾기 모드' : '바꾸기 모드'}
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              padding: '2px',
              borderRadius: '4px',
            }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* 찾기 입력창 필드 */}
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', position: 'relative' }}>
        <Search size={12} style={{ position: 'absolute', left: '8px', color: 'var(--text-muted)' }} />
        <input
          ref={findInputRef}
          type="text"
          value={findQuery}
          onChange={e => setFindQuery(e.target.value)}
          placeholder="찾을 텍스트 입력..."
          style={{
            flex: 1,
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '6px',
            padding: '6px 6px 6px 26px',
            color: '#fff',
            fontSize: '11px',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
        {findQuery && (
          <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginRight: '4px' }}>
            {totalMatchesCount > 0 ? `${currentMatchIndex + 1}/${totalMatchesCount}` : '일치 없음'}
          </span>
        )}
      </div>

      {/* 바꾸기 입력창 필드 (바꾸기 모드 시에만 표시) */}
      {showReplace && (
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <input
            type="text"
            value={replaceQuery}
            onChange={e => setReplaceQuery(e.target.value)}
            placeholder="바꿀 텍스트 입력..."
            style={{
              flex: 1,
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              padding: '6px 8px',
              color: '#fff',
              fontSize: '11px',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
        </div>
      )}

      {/* 제어 패널 버튼 목록 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
        {/* 옵션 체크박스 */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '10px', color: 'var(--text-muted)' }}>
          <input
            type="checkbox"
            checked={matchCase}
            onChange={e => setMatchCase(e.target.checked)}
            style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
          />
          <span>대소문자 구분</span>
        </label>

        {/* 액션 제어 버튼부 */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {/* 이전 / 다음 이동 */}
          <button
            onClick={() => handleNavigate('prev')}
            disabled={totalMatchesCount === 0}
            title="이전 매칭 찾기"
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: totalMatchesCount > 0 ? '#fff' : 'rgba(255,255,255,0.2)',
              borderRadius: '4px',
              padding: '4px 6px',
              cursor: totalMatchesCount > 0 ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ChevronUp size={12} />
          </button>
          <button
            onClick={() => handleNavigate('next')}
            disabled={totalMatchesCount === 0}
            title="다음 매칭 찾기"
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: totalMatchesCount > 0 ? '#fff' : 'rgba(255,255,255,0.2)',
              borderRadius: '4px',
              padding: '4px 6px',
              cursor: totalMatchesCount > 0 ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ChevronDown size={12} />
          </button>

          {/* 바꾸기 액션 버튼 */}
          {showReplace && (
            <>
              <button
                onClick={handleReplace}
                disabled={currentMatchIndex < 0}
                title="선택된 항목 바꾸기"
                style={{
                  background: 'rgba(139, 92, 246, 0.2)',
                  border: '1px solid rgba(139, 92, 246, 0.35)',
                  color: currentMatchIndex >= 0 ? '#d8b4fe' : 'rgba(255,255,255,0.2)',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  cursor: currentMatchIndex >= 0 ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '10px',
                  fontWeight: 700,
                }}
              >
                <Replace size={10} />
                <span>바꾸기</span>
              </button>
              <button
                onClick={handleReplaceAll}
                disabled={totalMatchesCount === 0}
                title="모든 일치 항목 바꾸기"
                style={{
                  background: 'rgba(6, 182, 212, 0.2)',
                  border: '1px solid rgba(6, 182, 212, 0.35)',
                  color: totalMatchesCount > 0 ? '#99f6e4' : 'rgba(255,255,255,0.2)',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  cursor: totalMatchesCount > 0 ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '10px',
                  fontWeight: 700,
                }}
              >
                <ReplaceAll size={10} />
                <span>모두 바꾸기</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
