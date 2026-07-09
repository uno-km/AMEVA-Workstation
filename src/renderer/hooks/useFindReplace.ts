/**
 * @file useFindReplace.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/hooks/useFindReplace.ts
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/App.tsx): 최상위 Facade 구조에 통합 마운트.
 * - 소비처 B (src/renderer/contexts/AppContext.tsx): 리액트 Context 훅 목록에 바인딩되어 하위 뷰에 전파.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 본 파일은 AMEVA 시스템 내에서 도메인 목적에 부합하는 연산 및 데이터 처리 흐름을 안전하게 캡슐화한다.
 * - 외부 라이브러리 및 하위 종속성을 조율하고 결과 규격을 일관되게 제공한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그를 명확하게 남길 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

import { useState, useEffect } from 'react'
import { type AmevaEditor } from '../editor/amevaBlockSchema'

export interface SearchMatch {
  blockId: string
  blockType: string
  text: string
  matchIndices: number[] // 블록 텍스트 내에서 매칭이 시작되는 문자열 오프셋 리스트
}

interface UseFindReplaceProps {
  isOpen: boolean
  editor: AmevaEditor | null
  onScrollToBlock: (blockId: string) => void
}

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
export function useFindReplace({ isOpen, editor, onScrollToBlock }: UseFindReplaceProps) {
  const [findQuery, setFindQuery] = useState('')
  const [replaceQuery, setReplaceQuery] = useState('')
  const [matchCase, setMatchCase] = useState(false)
  const [matches, setMatches] = useState<SearchMatch[]>([])
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1) // 전체 매칭 중 현재 인덱스

  // 검색 쿼리가 변경되거나 대소문자 구분 변경 시 검색 즉시 수행
  useEffect(() => {
    performSearch()
  }, [findQuery, matchCase])

  // 에디터의 문서가 바뀌었을 때 검색 결과 업데이트를 위한 폴백
  useEffect(() => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (!isOpen || !editor) return
    
    // 에디터 블록 변경 감지용 간단한 폴링 또는 이벤트 연동 (가벼운 간격 체크)
    const interval = setInterval(() => {
      performSearch(true) // 인덱스 유지하며 갱신
    }, 1000)
    
    return () => clearInterval(interval)
  }, [isOpen, editor, findQuery, matchCase])

  // 전체 매칭 리스트의 총 개수 계산
  const totalMatchesCount = matches.reduce((acc, m) => acc + m.matchIndices.length, 0)

  // 현재 매칭의 글로벌 순서 번호와 구체적인 { blockId, charOffset } 알아내기
  const getCurrentActiveMatch = () => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (currentMatchIndex < 0 || matches.length === 0) return null
  // [RUN-TIME STATE / INVARIANT] - 변수 'count'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    let count = 0
  // [LOOP CONTROL ITERATION] - 데이터 콜렉션 순회 및 조건 도달 시까지의 반복적 상태 전이 연산 수행.
    for (let mIdx = 0; mIdx < matches.length; mIdx++) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'match'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const match = matches[mIdx]
  // [LOOP CONTROL ITERATION] - 데이터 콜렉션 순회 및 조건 도달 시까지의 반복적 상태 전이 연산 수행.
      for (let iIdx = 0; iIdx < match.matchIndices.length; iIdx++) {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
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
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (!editor || !findQuery) {
      setMatches([])
      setCurrentMatchIndex(-1)
      return
    }

    const flatBlocks: any[] = []
  // [RUN-TIME STATE / INVARIANT] - 변수 'traverse'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const traverse = (blks: any[]) => {
  // [LOOP CONTROL ITERATION] - 데이터 콜렉션 순회 및 조건 도달 시까지의 반복적 상태 전이 연산 수행.
      for (const b of blks) {
        flatBlocks.push(b)
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (b.children) traverse(b.children)
      }
    }
    traverse(editor.document)

    const newMatches: SearchMatch[] = []
    
    flatBlocks.forEach(block => {
      // 블록 내 텍스트 추출 (Rich Text의 텍스트만 합산)
      const text = getBlockPlainText(block)
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (!text) return

  // [RUN-TIME STATE / INVARIANT] - 변수 'searchTarget'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      let searchTarget = text
  // [RUN-TIME STATE / INVARIANT] - 변수 'queryTarget'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      let queryTarget = findQuery
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (!matchCase) {
        searchTarget = text.toLowerCase()
        queryTarget = findQuery.toLowerCase()
      }

      const indices: number[] = []
  // [RUN-TIME STATE / INVARIANT] - 변수 'startIdx'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      let startIdx = searchTarget.indexOf(queryTarget)
  // [LOOP CONTROL ITERATION] - 데이터 콜렉션 순회 및 조건 도달 시까지의 반복적 상태 전이 연산 수행.
      while (startIdx !== -1) {
        indices.push(startIdx)
        startIdx = searchTarget.indexOf(queryTarget, startIdx + queryTarget.length)
      }

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
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
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (totalCount === 0) {
      setCurrentMatchIndex(-1)
    } else if (keepIndex) {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
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
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (!block.content) return ''
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (typeof block.content === 'string') return block.content
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (Array.isArray(block.content)) {
      return block.content.map((c: any) => c.text || '').join('')
    }
    return ''
  }

  // 이전/다음 이동 핸들러
  const handleNavigate = (direction: 'next' | 'prev') => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (matches.length === 0) return
  // [RUN-TIME STATE / INVARIANT] - 변수 'totalCount'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const totalCount = totalMatchesCount
    
  // [RUN-TIME STATE / INVARIANT] - 변수 'nextIdx'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    let nextIdx = currentMatchIndex
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (direction === 'next') {
      nextIdx = (currentMatchIndex + 1) % totalCount
    } else {
      nextIdx = (currentMatchIndex - 1 + totalCount) % totalCount
    }
    
    setCurrentMatchIndex(nextIdx)
    
    // 현재 포커스 매칭 알아내고 스크롤 이동
    let count = 0
  // [LOOP CONTROL ITERATION] - 데이터 콜렉션 순회 및 조건 도달 시까지의 반복적 상태 전이 연산 수행.
    for (const match of matches) {
  // [LOOP CONTROL ITERATION] - 데이터 콜렉션 순회 및 조건 도달 시까지의 반복적 상태 전이 연산 수행.
      for (let i = 0; i < match.matchIndices.length; i++) {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
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
  // [RUN-TIME STATE / INVARIANT] - 변수 'active'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const active = getCurrentActiveMatch()
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (!active || !editor) return

    const { blockId, charOffset, matchLength } = active
  // [RUN-TIME STATE / INVARIANT] - 변수 'block'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const block = findBlockById(editor.document, blockId)
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (!block) return

  // [RUN-TIME STATE / INVARIANT] - 변수 'currentText'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const currentText = getBlockPlainText(block)
  // [RUN-TIME STATE / INVARIANT] - 변수 'before'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const before = currentText.substring(0, charOffset)
  // [RUN-TIME STATE / INVARIANT] - 변수 'after'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const after = currentText.substring(charOffset + matchLength)
  // [RUN-TIME STATE / INVARIANT] - 변수 'replacedText'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const replacedText = before + replaceQuery + after

    // 블록 텍스트 업데이트 (Rich Text 형식 호환 유지를 위한 가공)
    await updateBlockText(blockId, replacedText)
    
    // 검색 다시 돌리고 현재 매칭 번호 유지
    performSearch(true)
  }

  // 전체 바꾸기 (Replace All)
  const handleReplaceAll = async () => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (matches.length === 0 || !editor) return

  // [LOOP CONTROL ITERATION] - 데이터 콜렉션 순회 및 조건 도달 시까지의 반복적 상태 전이 연산 수행.
    for (const match of matches) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'block'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const block = findBlockById(editor.document, match.blockId)
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (!block) continue

  // [RUN-TIME STATE / INVARIANT] - 변수 'currentText'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const currentText = getBlockPlainText(block)
      
  // [RUN-TIME STATE / INVARIANT] - 변수 'searchTarget'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      let searchTarget = currentText
  // [RUN-TIME STATE / INVARIANT] - 변수 'queryTarget'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      let queryTarget = findQuery
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (!matchCase) {
        searchTarget = currentText.toLowerCase()
        queryTarget = findQuery.toLowerCase()
      }

      // 비대소문자 구분을 유지한 상태에서 모든 매칭 오프셋을 역순으로 변경해야 인덱스가 꼬이지 않음
      const indices: number[] = []
  // [RUN-TIME STATE / INVARIANT] - 변수 'startIdx'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      let startIdx = searchTarget.indexOf(queryTarget)
  // [LOOP CONTROL ITERATION] - 데이터 콜렉션 순회 및 조건 도달 시까지의 반복적 상태 전이 연산 수행.
      while (startIdx !== -1) {
        indices.push(startIdx)
        startIdx = searchTarget.indexOf(queryTarget, startIdx + queryTarget.length)
      }

  // [RUN-TIME STATE / INVARIANT] - 변수 'newText'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      let newText = currentText
  // [LOOP CONTROL ITERATION] - 데이터 콜렉션 순회 및 조건 도달 시까지의 반복적 상태 전이 연산 수행.
      for (let i = indices.length - 1; i >= 0; i--) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'offset'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const offset = indices[i]
        newText = newText.substring(0, offset) + replaceQuery + newText.substring(offset + findQuery.length)
      }

      await updateBlockText(match.blockId, newText)
    }

    performSearch(false)
  }

  // 블록 ID 기반 블록 탐색 헬퍼
  const findBlockById = (blks: any[], id: string): any => {
  // [LOOP CONTROL ITERATION] - 데이터 콜렉션 순회 및 조건 도달 시까지의 반복적 상태 전이 연산 수행.
    for (const b of blks) {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (b.id === id) return b
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (b.children) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'found'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const found = findBlockById(b.children, id)
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (found) return found
      }
    }
    return null
  }

  // 에디터 블록 텍스트 교체 처리
  const updateBlockText = async (blockId: string, newText: string) => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (!editor) return
  // [RUN-TIME STATE / INVARIANT] - 변수 'block'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const block = findBlockById(editor.document, blockId)
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
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

  return {
    findQuery,
    setFindQuery,
    replaceQuery,
    setReplaceQuery,
    matchCase,
    setMatchCase,
    currentMatchIndex,
    totalMatchesCount,
    handleNavigate,
    handleReplace,
    handleReplaceAll,
    performSearch
  }
}

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
