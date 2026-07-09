/**
 * @file useAIRAG.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/hooks/ai/useAIRAG.ts
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


export function useAIRAG(
  blocks: any[],
  currentContent: string,
  selectedText: string,
  useContext: boolean,
  manualMode: string,
  activeBlockId: string | undefined,
  apiType: string,
  gpuOnly: boolean,
  apiKey: string,
  modelPath: string,
  onSend: (msg: string, context?: string, selected?: string, blockId?: string, settings?: any) => void
) {
  const getContextWithRAG = (_query: string, useFullFallback = false) => {
    const buildBlockIndex = () => {
      if (!blocks || blocks.length === 0) return ''
      const flatAll: any[] = (function flatten(bks: any[]): any[] {
        return (bks || []).flatMap((b: any) => [b, ...flatten(b.children || [])])
      })(blocks)
      const lines = flatAll.map((b: any) => {
        const txt = Array.isArray(b.content)
          ? b.content.map((c: any) => c.text || '').join('').slice(0, 60)
          : ''
        const extra = b.type === 'heading' && b.props?.level ? ` level=${b.props.level}` : ''
        return `[Block ID: ${b.id}, Type: ${b.type}${extra}] ${txt}`
      })
      return `[문서 블록 구조 목록 — 삽입 위치(afterBlockId) 선택 시 사용]\n` + lines.join('\n')
    }

    if (selectedText) {
      return `[선택한 부분 텍스트]\n${selectedText}\n\n[문서 내용 전체]\n${currentContent}\n\n${buildBlockIndex()}`
    }
    if (!useContext && !useFullFallback) return buildBlockIndex() || undefined

    return (currentContent ? currentContent + '\n\n' : '') + buildBlockIndex()
  }

  const getActiveMode = (queryText: string): 'write' | 'edit' | 'summary' | 'chat' => {
    if (manualMode !== 'auto') return manualMode as any
    const cleanInput = queryText.toLowerCase().trim()
    const summaryKeywords = ['요약', '정리', '줄여', 'summarize', 'summary', 'brief']
    if (summaryKeywords.some(k => cleanInput.includes(k))) return 'summary'
    const writeKeywords = [
      '써줘', '써', '작성', '보고서', '리포트', '문서 만들어', '글 써줘',
      '제목', '본문', '넣어줘', '넣어', '입력해', '추가해줘', '만들어줘',
      '생성해', '도입말', '서론', '결론', 'write', 'draft', 'create', 'compose', 'generate', 'insert',
    ]
    if (writeKeywords.some(k => cleanInput.includes(k))) return 'write'
    if (selectedText) return 'edit'
    const editKeywords = [
      '수정', '변경', '바꿔', '고쳐', '삽입', '지워', '교체', '고쳐줘',
      'edit', 'modify', 'replace', 'rewrite', 'correct'
    ]
    if (editKeywords.some(k => cleanInput.includes(k))) return 'edit'
    return 'chat'
  }

  const handleSendAction = (text: string, isQuickAction = false) => {
    if (!text.trim()) return
    const finalContext = getContextWithRAG(text.trim(), isQuickAction)
    const resolvedMode = getActiveMode(text)

    onSend(text.trim(), finalContext, selectedText || undefined, activeBlockId, {
      apiType, gpuOnly, apiKey, modelPath, resolvedMode, isQuickAction
    })
  }

  return { getContextWithRAG, getActiveMode, handleSendAction }
}
