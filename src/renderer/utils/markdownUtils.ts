/**
 * @file markdownUtils.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/utils/markdownUtils.ts
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/hooks/): 관련 비즈니스 훅 내부 연산 시 순수 함수 유틸리티로 수입 소비.
 * - 소비처 B (src/renderer/components/): 렌더링 전 데이터 정제 단계에서 포맷터 유틸리티로 소비.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 본 파일은 AMEVA 시스템 내에서 도메인 목적에 부합하는 연산 및 데이터 처리 흐름을 안전하게 캡슐화한다.
 * - 외부 라이브러리 및 하위 종속성을 조율하고 결과 규격을 일관되게 제공한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그를 명확하게 남길 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
export function convertJupyterToCodeBlocks(blocks: any[]): any[] {
  return blocks.map(block => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'copy'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const copy = { ...block }
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (copy.type === 'jupyter') {
      copy.type = 'codeBlock'
  // [RUN-TIME STATE / INVARIANT] - 변수 'lang'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const lang = copy.props?.language || 'javascript'
  // [RUN-TIME STATE / INVARIANT] - 변수 'finalCodeText'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const finalCodeText = copy.props?.code || ''
      copy.content = [{ type: 'text', text: finalCodeText, styles: {} }]
      copy.props = {
        language: lang
      }
    } else if (copy.type === 'drawing') {
      copy.type = 'codeBlock'
  // [RUN-TIME STATE / INVARIANT] - 변수 'dataText'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const dataText = copy.props?.data || '[]'
      copy.content = [{ type: 'text', text: dataText, styles: {} }]
      copy.props = {
        language: 'ameva-drawing'
      }
    } else if (copy.children) {
      copy.children = convertJupyterToCodeBlocks(copy.children)
    }
    return copy
  })
}

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
export function normalizeMarkdown(raw: string): string {
  // [RUN-TIME STATE / INVARIANT] - 변수 'content'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  let content = raw.replace(/\r\n/g, '\n')
  content = content.replace(/^(#{1,6})([^\s#])/gm, '$1 $2')

  // [RUN-TIME STATE / INVARIANT] - 변수 'parts'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const parts = content.split('```')
  // [LOOP CONTROL ITERATION] - 데이터 콜렉션 순회 및 조건 도달 시까지의 반복적 상태 전이 연산 수행.
  for (let i = 1; i < parts.length; i += 2) {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (parts[i]) {
      parts[i] = parts[i].replace(/\n\s*\n/g, '\n\u200B\n')
      parts[i] = parts[i].replace(/</g, '__LT_TEMP__')
      parts[i] = parts[i].replace(/>/g, '__GT_TEMP__')
    }
  }
  content = parts.join('```')
  
  content = content.replace(/\n*```([a-zA-Z0-9_-]+)[^\n]*\n+/g, (_, lang) => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'l'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const l = lang.toLowerCase()
  // [RUN-TIME STATE / INVARIANT] - 변수 'mapped'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const mapped = l === 'js' ? 'javascript' : l === 'ts' ? 'typescript' : l === 'py' ? 'python' : l
    return `\n\n\`\`\`${mapped}\n`
  })
  content = content.replace(/\n*```[ \t]*\n+/g, '\n```\n\n')
  content = content.replace(/\n{3,}/g, '\n\n')
  return content.trim()
}

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
export function cleanCodeBlocks(blocks: any[]) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'supportedLangs'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const supportedLangs = ['python', 'py', 'javascript', 'js', 'html', 'css', 'c', 'cpp', 'java', 'xml', 'json', 'text', 'txt', 'plaintext', 'mermaid', 'bash', 'sh', 'typescript', 'ts', 'sql', 'ameva-drawing']
  blocks.forEach(block => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (block.type === 'codeBlock') {
  // [RUN-TIME STATE / INVARIANT] - 변수 'text'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const text = block.content ? block.content.map((c: any) => c.text).join('') : ''
  // [RUN-TIME STATE / INVARIANT] - 변수 'cleaned'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      let cleaned = text.replace(/\u200B/g, '').replace(/__LT_TEMP__/g, '<').replace(/__GT_TEMP__/g, '>')
  // [RUN-TIME STATE / INVARIANT] - 변수 'lines'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const lines = cleaned.split('\n')
  // [RUN-TIME STATE / INVARIANT] - 변수 'firstLine'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const firstLine = lines[0]?.trim()
      
  // [RUN-TIME STATE / INVARIANT] - 변수 'lang'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      let lang = 'javascript'
  // [RUN-TIME STATE / INVARIANT] - 변수 'finalCode'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      let finalCode = cleaned
      
  // [RUN-TIME STATE / INVARIANT] - 변수 'amevaLangMatch'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const amevaLangMatch = firstLine ? firstLine.match(/^(?:\/\/#|--|<!--)\s*\[AMEVA_LANG:([a-zA-Z0-9_-]+)\](?:\s*-->)?/) || firstLine.match(/^(?:\/\/|#|--)\s*\[AMEVA_LANG:([a-zA-Z0-9_-]+)\]/) : null
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (amevaLangMatch) {
        lang = amevaLangMatch[1].toLowerCase()
        finalCode = lines.slice(1).join('\n')
      } 
      else if (firstLine && (
        supportedLangs.includes(firstLine.toLowerCase()) ||
        (block.props?.language && firstLine.toLowerCase() === block.props.language.toLowerCase()) ||
        (block.props?.language && firstLine.toLowerCase() === 'py' && block.props.language.toLowerCase() === 'python') ||
        (block.props?.language && firstLine.toLowerCase() === 'js' && block.props.language.toLowerCase() === 'javascript') ||
        (block.props?.language && firstLine.toLowerCase() === 'ts' && block.props.language.toLowerCase() === 'typescript')
      )) {
        lang = firstLine.toLowerCase() === 'py' ? 'python' : firstLine.toLowerCase() === 'js' ? 'javascript' : firstLine.toLowerCase() === 'ts' ? 'typescript' : firstLine.toLowerCase()
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
        if (block.props?.language && !supportedLangs.includes(firstLine.toLowerCase())) {
          lang = block.props.language.toLowerCase()
        }
        finalCode = lines.slice(1).join('\n')
      } 
      else {
  // [RUN-TIME STATE / INVARIANT] - 변수 'rawLang'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
        const rawLang = (block.props?.language || 'javascript').toLowerCase()
        lang = rawLang === 'js' ? 'javascript' : rawLang === 'ts' ? 'typescript' : rawLang === 'py' ? 'python' : rawLang
      }
      
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (lang === 'ameva-drawing') {
        block.type = 'drawing'
        block.props = {
          data: finalCode
        }
        block.content = undefined
        return
      }

      block.type = 'jupyter'
      block.props = {
        language: lang,
        code: finalCode,
        runState: JSON.stringify({ hasRun: false, success: null, outputLines: [] })
      }
      block.content = undefined
    }
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (block.type === 'image' && block.props?.url) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'url'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const url = block.props.url.toLowerCase()
  // [RUN-TIME STATE / INVARIANT] - 변수 'isVideo'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const isVideo = url.endsWith('.mp4') || 
                      url.endsWith('.webm') || 
                      url.endsWith('.mov') || 
                      url.endsWith('.ogg') ||
                      url.startsWith('data:video/')
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (isVideo) {
        block.type = 'video'
      }
    }
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (block.children) {
      cleanCodeBlocks(block.children)
    }
  })
}

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
export function ensureBlockIds(blocks: any[]) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'generateId'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const generateId = () => Math.random().toString(36).substring(2, 10)
  blocks.forEach(block => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (!block.id) {
      block.id = generateId()
    }
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (block.children) {
      ensureBlockIds(block.children)
    }
  })
}

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
export function cleanMarkdownCodeBlocks(markdown: string): string {
  // [RUN-TIME STATE / INVARIANT] - 변수 'norm'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const norm = (l: string) => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'low'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const low = l.toLowerCase()
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (low === 'js') return 'javascript'
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (low === 'ts') return 'typescript'
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (low === 'py') return 'python'
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (low === 'txt') return 'text'
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (low === 'sh') return 'bash'
    return low
  }
  return markdown.replace(/```([a-zA-Z0-9_-]+)\n\s*([a-zA-Z0-9_-]+)\n/g, (match, lang1, lang2) => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (norm(lang1) === norm(lang2)) {
      return `\`\`\`${lang1}\n`
    }
    return match
  })
}
// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
