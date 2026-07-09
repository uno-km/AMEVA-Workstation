/**
 * @file handleHeadingFormat.ts
 * @system AMEVA OS Desktop Workstation - Editor Core
 * @location src/renderer/hooks/app/editor-sync/handleHeadingFormat.ts
 * @role Editor paragraph inline Markdown Heading prefix conversion pipeline handler
 * 
 * [설계 의도 - DESIGN INTENT / ADR]
 * - WYSIWYG 에디터의 특성상 사용자가 '# 제목' 이라고 타이핑했을 때 이를 즉시 감지하여 실시간 Heading 블록 스타일로 변환해야 자연스러운 마크다운 편집기처럼 동작한다.
 * - 단, 커서가 해당 블록 내부에 있는 동안에는 접두어('# ', '## ')를 화면에 계속 표시하고,
 *   커서가 다른 블록으로 포커싱 아웃(`currentId !== activeBlockIdRef.current`) 되는 시점에는 접두어 문자를 예쁘게 가려 숨기는 보정 기법을 구현한다.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 현재 커서 위치의 단락 블록을 분석하여 텍스트 정규식 매칭을 검사하고, Heading 블록으로 실시간 갱신 변환한다.
 * - 커서 이탈/진입 상태를 추적하여 접두어(prefix) 문자열을 동적으로 뗐다 붙였다 가공 갱신한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST NOT cause update recursion: 에디터를 갱신(`editor.updateBlock`)하는 동안 발생하는 변경 이벤트를 캡처하여 무한 루프가 돌지 않도록,
 *   반드시 블록 업데이트 앞뒤 단에서 `setIsUpdating(true/false)` 가드 락 계약을 철저히 이행할 것.
 */

/* 
 * [SHARED SCHEMAS]
 * - AppEditor: 블록노트 커스텀 렌더 에디터 타입.
 * - AppPartialBlock: 부분 업데이트 및 갱신 패킷용 블록 규격.
 */
import type { AmevaEditor as AppEditor, AmevaPartialBlock as AppPartialBlock } from '../../../editor/amevaBlockSchema'

/**
 * @function handleHeadingFormat
 * @description 에디터 타이핑 중 '#' 입력을 감지해 제목 블록으로 변환하고 포커스에 따른 접두어 노출을 동적으로 가공해 주는 함수.
 */
export function handleHeadingFormat(
  /*
   * [PARAMETER CONTRACTS]
   * - editor: BlockNote API 본체.
   * - activeBlockIdRef: 현재 포커싱된 블록 ID 참조 Mutable 레퍼런스.
   * - setActiveBlockId: 포커스 블록 ID 상태 전파 세터.
   * - setIsUpdating: 동기화 오작동 및 재귀 렌더 루프 방지용 가드 락 세터.
   */
  editor: AppEditor,
  activeBlockIdRef: React.MutableRefObject<string | null>,
  setActiveBlockId: (id: string | null) => void,
  setIsUpdating: (val: boolean) => void
) {
  // 1. 에디터 캔버스의 현재 텍스트 커서 위치 캡처
  const cursor = editor.getTextCursorPosition()
  let currentId: string | null = null

  if (cursor?.block) {
    const activeBlock = cursor.block
    currentId = activeBlock.id

    // 2. 현재 활성 문단이 paragraph이고 사용자 타이핑 문자열이 '#'으로 시작하는 경우 제목 블록으로 변환
    if (activeBlock.type === 'paragraph') {
      const text = activeBlock.content ? (activeBlock.content as any).map((c: any) => c.text).join('') : ''
      const match = text.match(/^(#{1,3})([^\s#].*)$/)
      if (match) {
        const level = match[1].length
        
        // CONTRACT: 갱신 시점 재귀 루프 차단 가드 락 작동
        setIsUpdating(true)
        try {
          editor.updateBlock(activeBlock.id, {
            type: 'heading',
            props: { level: level as any },
            content: [{ type: 'text', text: match[2], styles: {} }]
          } as AppPartialBlock)
        } catch {}
        setIsUpdating(false)
      }
    }
  }

  // 3. 커서 포커스 위치가 다른 블록으로 전환(이탈/진입)된 시점의 접두어 노출 가공 보정
  if (currentId !== activeBlockIdRef.current) {
    const prevId = activeBlockIdRef.current
    activeBlockIdRef.current = currentId
    setActiveBlockId(currentId)

    // 1) 이전 포커스 블록(prevBlock) 이탈 시: 접두어인 '# ', '## ' 문자를 깎아내어 화면에 감춤
    if (prevId) {
      try {
        const prevBlock = editor.getBlock(prevId)
        if (prevBlock?.type === 'heading') {
          const text = prevBlock.content ? (prevBlock.content as any).map((c: any) => c.text).join('') : ''
          const match = text.match(/^(#{1,3}\s)(.*)$/)
          if (match) {
            setIsUpdating(true)
            editor.updateBlock(prevId, { content: [{ type: 'text', text: match[2], styles: {} }] } as AppPartialBlock)
            setIsUpdating(false)
          }
        }
      } catch {}
    }

    // 2) 신규 포커스 블록(currentBlock) 진입 시: Heading 레벨에 알맞은 접두어('# ', '## ')를 접합하여 화면에 표출
    if (currentId) {
      try {
        const currentBlock = editor.getBlock(currentId)
        if (currentBlock?.type === 'heading') {
          const level = (currentBlock.props as any)?.level || 1
          const text = currentBlock.content ? (currentBlock.content as any).map((c: any) => c.text).join('') : ''
          const prefix = level === 1 ? '# ' : level === 2 ? '## ' : '### '
          
          if (!text.startsWith(prefix)) {
            setIsUpdating(true)
             editor.updateBlock(currentId, { content: [{ type: 'text', text: prefix + text, styles: {} }] } as AppPartialBlock)
            setIsUpdating(false)
          }
        }
      } catch {}
    }
  }
}

/**
 * ============================================================================
 * FUTURE DEVELOPMENT GUIDE (AI Agent Instruction Layer)
 * ============================================================================
 * 1. H4 등 헤딩 레벨 깊이를 늘리거나 접두어 포맷을 변경할 때:
 *    - `match` 정규식의 깊이 수치와 `prefix` 삼항연산자 분기 목록을 갱신 조율할 것.
 * ============================================================================
 */
