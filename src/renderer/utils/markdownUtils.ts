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

export function convertJupyterToCodeBlocks(blocks: any[]): any[] {
  return blocks.map(block => {
    const copy = { ...block }
    if (copy.type === 'jupyter') {
      copy.type = 'codeBlock'
      const lang = copy.props?.language || 'javascript'
      const finalCodeText = copy.props?.code || ''
      copy.content = [{ type: 'text', text: finalCodeText, styles: {} }]
      copy.props = {
        language: lang
      }
    } else if (copy.type === 'drawing') {
      copy.type = 'codeBlock'
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

export function normalizeMarkdown(raw: string): string {
  let content = raw.replace(/\r\n/g, '\n')
  content = content.replace(/^(#{1,6})([^\s#])/gm, '$1 $2')

  const parts = content.split('```')
  for (let i = 1; i < parts.length; i += 2) {
    if (parts[i]) {
      parts[i] = parts[i].replace(/\n\s*\n/g, '\n\u200B\n')
      parts[i] = parts[i].replace(/</g, '__LT_TEMP__')
      parts[i] = parts[i].replace(/>/g, '__GT_TEMP__')
    }
  }
  content = parts.join('```')
  
  content = content.replace(/\n*```([a-zA-Z0-9_-]+)[^\n]*\n+/g, (_, lang) => {
    const l = lang.toLowerCase()
    const mapped = l === 'js' ? 'javascript' : l === 'ts' ? 'typescript' : l === 'py' ? 'python' : l
    return `\n\n\`\`\`${mapped}\n`
  })
  content = content.replace(/\n*```[ \t]*\n+/g, '\n```\n\n')
  content = content.replace(/\n{3,}/g, '\n\n')
  return content.trim()
}

export function cleanCodeBlocks(blocks: any[]) {
  const supportedLangs = ['python', 'py', 'javascript', 'js', 'html', 'css', 'c', 'cpp', 'java', 'xml', 'json', 'text', 'txt', 'plaintext', 'mermaid', 'bash', 'sh', 'typescript', 'ts', 'sql', 'ameva-drawing']
  blocks.forEach(block => {
    if (block.type === 'codeBlock') {
      const text = block.content ? block.content.map((c: any) => c.text).join('') : ''
      let cleaned = text.replace(/\u200B/g, '').replace(/__LT_TEMP__/g, '<').replace(/__GT_TEMP__/g, '>')
      const lines = cleaned.split('\n')
      const firstLine = lines[0]?.trim()
      
      let lang = 'javascript'
      let finalCode = cleaned
      
      const amevaLangMatch = firstLine ? firstLine.match(/^(?:\/\/#|--|<!--)\s*\[AMEVA_LANG:([a-zA-Z0-9_-]+)\](?:\s*-->)?/) || firstLine.match(/^(?:\/\/|#|--)\s*\[AMEVA_LANG:([a-zA-Z0-9_-]+)\]/) : null
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
        if (block.props?.language && !supportedLangs.includes(firstLine.toLowerCase())) {
          lang = block.props.language.toLowerCase()
        }
        finalCode = lines.slice(1).join('\n')
      } 
      else {
        const rawLang = (block.props?.language || 'javascript').toLowerCase()
        lang = rawLang === 'js' ? 'javascript' : rawLang === 'ts' ? 'typescript' : rawLang === 'py' ? 'python' : rawLang
      }
      
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
    if (block.type === 'image' && block.props?.url) {
      const url = block.props.url.toLowerCase()
      const isVideo = url.endsWith('.mp4') || 
                      url.endsWith('.webm') || 
                      url.endsWith('.mov') || 
                      url.endsWith('.ogg') ||
                      url.startsWith('data:video/')
      if (isVideo) {
        block.type = 'video'
      }
    }
    if (block.children) {
      cleanCodeBlocks(block.children)
    }
  })
}

export function ensureBlockIds(blocks: any[]) {
  const generateId = () => Math.random().toString(36).substring(2, 10)
  blocks.forEach(block => {
    if (!block.id) {
      block.id = generateId()
    }
    if (block.children) {
      ensureBlockIds(block.children)
    }
  })
}

export function cleanMarkdownCodeBlocks(markdown: string): string {
  const norm = (l: string) => {
    const low = l.toLowerCase()
    if (low === 'js') return 'javascript'
    if (low === 'ts') return 'typescript'
    if (low === 'py') return 'python'
    if (low === 'txt') return 'text'
    if (low === 'sh') return 'bash'
    return low
  }
  return markdown.replace(/```([a-zA-Z0-9_-]+)\n\s*([a-zA-Z0-9_-]+)\n/g, (match, lang1, lang2) => {
    if (norm(lang1) === norm(lang2)) {
      return `\`\`\`${lang1}\n`
    }
    return match
  })
}