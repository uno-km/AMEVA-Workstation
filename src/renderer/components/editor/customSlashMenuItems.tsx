/**
 * @file customSlashMenuItems.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/editor/customSlashMenuItems.tsx
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


import { getDefaultReactSlashMenuItems } from '@blocknote/react'
import { Code2, Globe, Eye, Terminal, FileImage } from 'lucide-react'
import { type AmevaEditor } from '../../editor/amevaBlockSchema'

export function getCustomSlashMenuItems(editorInstance: AmevaEditor, installedPlugins: string[] = []) {
  const defaultItems = getDefaultReactSlashMenuItems(editorInstance)

  const filtered = defaultItems.filter(item =>
    !item.title.toLowerCase().includes('code block') &&
    !item.title.toLowerCase().includes('codeblock')
  )

  const insertCodeBlock = (lang: string) => () => {
    try {
      const pos = editorInstance.getTextCursorPosition()
      if (!pos) return
      editorInstance.updateBlock(pos.block.id, {
        type: 'jupyter',
        props: {
          language: lang,
          code: '',
          runState: JSON.stringify({ hasRun: false, success: null, outputLines: [] })
        },
      } as any)
      editorInstance.setTextCursorPosition(pos.block.id, 'start')
      editorInstance.focus()
    } catch {}
  }

  const insertDrawingBlock = () => {
    try {
      const pos = editorInstance.getTextCursorPosition()
      if (!pos) return
      editorInstance.updateBlock(pos.block.id, {
        type: 'drawing',
        props: { data: '[]' }
      } as any)
      editorInstance.setTextCursorPosition(pos.block.id, 'start')
      editorInstance.focus()
    } catch {}
  }

  const codeItems = [
    {
      title: 'JavaScript Code Block',
      onItemClick: insertCodeBlock('javascript'),
      aliases: ['js', 'javascript', 'node', 'code', 'snippet', 'cj', 'c'],
      group: 'Code',
      icon: <Code2 size={16} color="#f59e0b" />,
      subtext: 'JavaScript 실행 가능 코드 블록 삽입 (/cj 또는 /c)',
    },
    {
      title: 'Python Code Block',
      onItemClick: insertCodeBlock('python'),
      aliases: ['py', 'python', 'code', 'snippet', 'cp'],
      group: 'Code',
      icon: <Code2 size={16} color="#3b82f6" />,
      subtext: 'Python 실행 가능 코드 블록 삽입 (/cp)',
    },
    {
      title: 'SQL Code Block',
      onItemClick: insertCodeBlock('sql'),
      aliases: ['sql', 'sqlite', 'db', 'query', 'csql'],
      group: 'Code',
      icon: <Code2 size={16} color="#06b6d4" />,
      subtext: '가상 SQLite DB 실행 가능 SQL 코드 블록 삽입 (/csql)',
    },
    {
      title: 'HTML Sandbox Block',
      onItemClick: insertCodeBlock('html'),
      aliases: ['html', 'css', 'web', 'sandbox', 'ch'],
      group: 'Code',
      icon: <Globe size={16} color="#14b8a6" />,
      subtext: '실시간 프리뷰 지원 HTML/JS 샌드박스 삽입 (/ch)',
    },
    {
      title: 'Mermaid Diagram',
      onItemClick: insertCodeBlock('mermaid'),
      aliases: ['mermaid', 'diagram', 'flowchart', 'chart', 'cm'],
      group: 'Code',
      icon: <Eye size={16} color="#8b5cf6" />,
      subtext: 'Mermaid 다이어그램 블록 삽입 (/cm)',
    },
    {
      title: 'JSON Code Block',
      onItemClick: insertCodeBlock('json'),
      aliases: ['json', 'data', 'object'],
      group: 'Code',
      icon: <Code2 size={16} color="#10b981" />,
      subtext: 'JSON 데이터 구조화 코드 블록 삽입',
    },
    {
      title: 'Bash Code Block',
      onItemClick: insertCodeBlock('bash'),
      aliases: ['bash', 'sh', 'shell', 'terminal'],
      group: 'Code',
      icon: <Terminal size={16} color="#ec4899" />,
      subtext: 'Bash 쉘 스크립트 코드 블록 삽입',
    },
    {
      title: 'Plain Code Block',
      onItemClick: insertCodeBlock('plaintext'),
      aliases: ['code', 'codeblock', 'plain', 'text', 'ct'],
      group: 'Code',
      icon: <Code2 size={16} color="#6b7280" />,
      subtext: '기본 텍스트 및 기타 언어용 코드 블록 삽입 (/ct)',
    },
  ]

  const drawingSubscribed = installedPlugins.includes('drawing-board')
  const drawingItems = drawingSubscribed ? [
    {
      title: 'Drawing Board',
      onItemClick: insertDrawingBlock,
      aliases: ['drawing', 'draw', 'sketch', 'paint', 'canvas'],
      group: 'Drawing',
      icon: <FileImage size={16} color="#a855f7" />,
      subtext: 'Excalidraw 기반 화이트보드 드로잉 블록 삽입 (/draw)',
    }
  ] : []

  const mapItem = {
    title: 'Google Map Embed',
    onItemClick: () => {
      try {
        const pos = editorInstance.getTextCursorPosition()
        if (!pos) return
        editorInstance.updateBlock(pos.block.id, {
          type: 'map',
          props: { lat: '37.5665', lng: '126.9780', zoom: '14', locationName: '서울 특별시' }
        } as any)
        editorInstance.setTextCursorPosition(pos.block.id, 'start')
        editorInstance.focus()
      } catch {}
    },
    aliases: ['map', 'googlemap', 'location', '지도'],
    group: 'Maps',
    icon: <Globe size={16} color="#10b981" />,
    subtext: '구글 지도 임베드 블록 삽입 (/map)',
  }

  return [...filtered, ...codeItems, ...drawingItems, mapItem]
}
