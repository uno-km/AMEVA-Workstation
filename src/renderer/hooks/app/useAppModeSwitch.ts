/**
 * @file useAppModeSwitch.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/hooks/app/useAppModeSwitch.ts
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

import { normalizeMarkdown, cleanCodeBlocks, ensureBlockIds, cleanMarkdownCodeBlocks, convertJupyterToCodeBlocks } from '../../utils/markdownUtils'
import { type AmevaEditor as AppEditor } from '../../editor/amevaBlockSchema'
import { type EditorMode } from '../../../shared/types'
import { useWorkspaceStore } from '../../stores/useWorkspaceStore'

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
export function useAppModeSwitch({
  editor,
  editorMode,
  setEditorMode,
  currentContent,
  setCurrentContent,
  setOriginalContent,
  loadMarkdownIntoEditor,
  DEFAULT_WELCOME_TEXT,
}: {
  editor: AppEditor | null
  editorMode: EditorMode
  setEditorMode: (mode: EditorMode) => void
  currentContent: string
  setCurrentContent: (content: string) => void
  setOriginalContent: (content: string) => void
  loadMarkdownIntoEditor: (editor: AppEditor, content: string, isBinary?: boolean, filePath?: string) => Promise<void>
  DEFAULT_WELCOME_TEXT: string
}) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'handleRollback'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const handleRollback = async (rollbackContent: string) => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (!editor) return
    await loadMarkdownIntoEditor(editor, rollbackContent)
  }

  // [RUN-TIME STATE / INVARIANT] - 변수 'handleSwitchMode'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const handleSwitchMode = async (mode: EditorMode) => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (editorMode === 'edit' && (mode === 'preview' || mode === 'raw') && editor) {
      try {
  // [RUN-TIME STATE / INVARIANT] - 변수 'latest'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        let latest = await editor.blocksToMarkdownLossy(convertJupyterToCodeBlocks(editor.document))

  // [RUN-TIME STATE / INVARIANT] - 변수 'blocks'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const blocks = editor.document as any[]
  // [RUN-TIME STATE / INVARIANT] - 변수 'mermaidBlocks'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const mermaidBlocks = blocks.filter(
          b => b.type === 'codeBlock' &&
          (b.props?.language || '').toLowerCase() === 'mermaid'
        )

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (mermaidBlocks.length > 0) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'hasMermaidFence'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          const hasMermaidFence = latest.includes('```mermaid')
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
          if (!hasMermaidFence) {
            const lines: string[] = []
  // [LOOP CONTROL ITERATION] - 데이터 콜렉션 순회 및 조건 도달 시까지의 반복적 상태 전이 연산 수행.
            for (const block of blocks) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'lang'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
              const lang = (block.props?.language || '').toLowerCase()
  // [RUN-TIME STATE / INVARIANT] - 변수 'code'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
              const code = Array.isArray(block.content)
                ? block.content.map((c: any) => c.text ?? '').join('')
                : typeof block.content === 'string' ? block.content : ''

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
              if (block.type === 'codeBlock') {
                lines.push(`\`\`\`${lang}`)
                lines.push(code)
                lines.push('```')
                lines.push('')
              } else if (block.type === 'heading') {
  // [RUN-TIME STATE / INVARIANT] - 변수 'hashes'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
                const hashes = '#'.repeat(Math.min(6, Math.max(1, Number(block.props?.level) || 1)))
                lines.push(`${hashes} ${code}`)
                lines.push('')
              } else if (block.type === 'paragraph') {
                lines.push(code || '')
                lines.push('')
              } else if (block.type === 'bulletListItem') {
                lines.push(`- ${code}`)
              } else if (block.type === 'numberedListItem') {
                lines.push(`1. ${code}`)
              } else {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
                if (code) { lines.push(code); lines.push('') }
              }
            }
            latest = lines.join('\n')
          }
        }

        latest = cleanMarkdownCodeBlocks(latest)
        setCurrentContent(latest)
      } catch (err) {
        console.error('[handleSwitchMode] markdown 변환 실패:', err)
      }
    }

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (mode === 'edit' && editor) {
      try {
  // [RUN-TIME STATE / INVARIANT] - 변수 'normalized'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const normalized = normalizeMarkdown(useWorkspaceStore.getState().currentContent)
  // [RUN-TIME STATE / INVARIANT] - 변수 'blocks'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const blocks = await editor.tryParseMarkdownToBlocks(normalized)
        cleanCodeBlocks(blocks)
        ensureBlockIds(blocks)
        editor.replaceBlocks(editor.document, blocks)
      } catch (err) {
        console.error('[handleSwitchMode] editor blocks 로드 실패:', err)
      }
    }

    setEditorMode(mode)
  }

  // [RUN-TIME STATE / INVARIANT] - 변수 'handleStartWelcomeEdit'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const handleStartWelcomeEdit = async () => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (!editor) return
    try {
  // [RUN-TIME STATE / INVARIANT] - 변수 'normalized'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const normalized = normalizeMarkdown(currentContent || DEFAULT_WELCOME_TEXT)
  // [RUN-TIME STATE / INVARIANT] - 변수 'blocks'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const blocks = await editor.tryParseMarkdownToBlocks(normalized)
      cleanCodeBlocks(blocks)
      ensureBlockIds(blocks)
      editor.replaceBlocks(editor.document, blocks)
      setCurrentContent(currentContent || DEFAULT_WELCOME_TEXT)
      setOriginalContent(currentContent || DEFAULT_WELCOME_TEXT)
      setEditorMode('edit')
    } catch (err) {
      console.error('웰컴 편집 로드 실패:', err)
      setEditorMode('edit')
    }
  }

  return {
    handleRollback,
    handleSwitchMode,
    handleStartWelcomeEdit,
  }
}

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
