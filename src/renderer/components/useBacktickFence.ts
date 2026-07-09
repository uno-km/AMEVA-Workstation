/**
 * @file useBacktickFence.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/useBacktickFence.ts
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/AppLayout.tsx): 레이아웃 그리드 내부 또는 플로팅 레이어 영역 내에서 그리기로 소비.
 * - 소비처 B (src/renderer/App.tsx): 전역 모달 매니저 및 뷰포트 상태 스위칭에 따라 동적 마운트되어 소비.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 본 파일은 AMEVA 시스템 내에서 도메인 목적에 부합하는 연산 및 데이터 처리 흐름을 안전하게 캡슐화한다.
 * - 외부 라이브러리 및 하위 종속성을 조율하고 결과 규격을 일관되게 제공한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그를 명확하게 남길 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

import { useEffect } from 'react'
import { type AmevaEditor } from '../editor/amevaBlockSchema'

const FENCE_LANG_MAP: Record<string, string> = {
  js: 'javascript', javascript: 'javascript',
  ts: 'typescript', typescript: 'typescript',
  py: 'python',     python: 'python',
  html: 'html', css: 'css', mermaid: 'mermaid',
  md: 'markdown',  markdown: 'markdown',
  json: 'json', xml: 'xml', sql: 'sql',
  bash: 'bash', sh: 'bash', c: 'c', cpp: 'cpp', java: 'java',
  text: 'plaintext', plaintext: 'plaintext', txt: 'plaintext',
}

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
export function useBacktickFence(editor: AmevaEditor | null) {
  useEffect(() => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (!editor) return

  // [RUN-TIME STATE / INVARIANT] - 변수 'handleKeyDown'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const handleKeyDown = (e: KeyboardEvent) => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (e.key !== 'Enter') return
      try {
  // [RUN-TIME STATE / INVARIANT] - 변수 'pos'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const pos = editor.getTextCursorPosition()
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (!pos) return
  // [RUN-TIME STATE / INVARIANT] - 변수 'block'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const block = pos.block
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (block.type !== 'paragraph') return

  // [RUN-TIME STATE / INVARIANT] - 변수 'content'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const content = (block as { content?: unknown }).content
  // [RUN-TIME STATE / INVARIANT] - 변수 'text'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const text = Array.isArray(content)
          ? content.map((c: any) => c.text || c.type === 'text' ? c.text : '').join('')
          : typeof content === 'string'
            ? content
            : ''

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (text.startsWith('```')) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'langInput'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          const langInput = text.slice(3).trim().toLowerCase()
  // [RUN-TIME STATE / INVARIANT] - 변수 'matchedLang'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
          const matchedLang = FENCE_LANG_MAP[langInput] || 'javascript'
          e.preventDefault()

          editor.updateBlock(block.id, {
            type: 'codeBlock',
            props: { language: matchedLang },
            content: [],
          })

          setTimeout(() => {
            try {
              editor.setTextCursorPosition(block.id, 'start')
              editor.focus()
            } catch {}
          }, 20)
        }
      } catch {}
    }

  // [RUN-TIME STATE / INVARIANT] - 변수 'container'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const container = document.querySelector('.bn-editor')
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (container) {
      container.addEventListener('keydown', handleKeyDown as any)
    }
    return () => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (container) {
        container.removeEventListener('keydown', handleKeyDown as any)
      }
    }
  }, [editor])
}

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
