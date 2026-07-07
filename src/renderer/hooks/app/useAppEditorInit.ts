import { useEffect, useRef } from 'react'
import { BlockNoteEditor } from "@blocknote/core"
import { amevaSchema as schema, type AmevaEditor as AppEditor } from '../../editor/amevaBlockSchema'
import * as ipc from '../../services/ipc/electronApiAdapter'

const DEFAULT_WELCOME_TEXT = `# 🚀 AMEVA Workstation

(AMEVA-OS WebAssembly Kernel & AI Hub)

이곳에서 문서 작성, 코드 실행, 파일 시스템 탐색을 할 수 있습니다.`;

export function useAppEditorInit({
  ydoc,
  provider,
  isActive,
  username,
  userColor,
  setEditor,
  setCurrentContent,
}: {
  ydoc: any
  provider: any
  isActive: boolean
  username: string
  userColor: string
  setEditor: (editor: AppEditor | null) => void
  setCurrentContent: (content: string) => void
}) {
  const isInitialLoad = useRef(true)

  useEffect(() => {
    let activeEditor: AppEditor
    
    const uploadFileHandler = async (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          if (typeof reader.result === 'string') resolve(reader.result)
          else reject(new Error('파일 읽기 실패'))
        }
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
      })
    }

    if (ydoc && provider && isActive) {
      activeEditor = BlockNoteEditor.create({
        schema,
        collaboration: {
          provider,
          fragment: ydoc.getXmlFragment('document-store'),
          user: { name: username, color: userColor },
        },
        uploadFile: uploadFileHandler,
      })
    } else {
      activeEditor = BlockNoteEditor.create({
        schema,
        uploadFile: uploadFileHandler,
      })
    }

    setEditor(activeEditor)

    if (isInitialLoad.current && (!isActive || !provider)) {
      isInitialLoad.current = false
      const welcomeMD = `# 🚀 AMEVA Workstation

차세대 AI 기반 통합 협업 워크스테이션에 오신 것을 환영합니다!

## ✨ 주요 기능

1. **AI 어시스턴트**: 우측 상단 ✨ 버튼으로 로컬 LLM AI 패널을 열어보세요.
2. **실시간 협업**: 사이드바 협업 탭에서 서버를 시작하고 동료와 함께 편집하세요.
3. **실시간 채팅**: 협업 연결 후 채팅 탭에서 실시간 메시지를 주고받을 수 있습니다.
4. **코드 실행**: 코드 블록에서 JavaScript, Python, SQL, HTML을 직접 실행할 수 있습니다.
5. **포맷 변환**: PDF, Word, Excel, PPT, 한글 HWPX 등으로 내보낼 수 있습니다.

---

### 🗄️ 가상 SQLite WASM 데이터베이스 예시
일렉트론 메모리상에 상주하는 가상 SQLite DB입니다. SELECT 실행 시 예쁜 반응형 그리드 테이블로 즉시 표출됩니다!

\`\`\`sql
-- 임시 테이블 생성 및 가상 데이터 삽입
CREATE TABLE IF NOT EXISTS developers (
  id INTEGER PRIMARY KEY,
  name TEXT,
  role TEXT,
  level TEXT
);

INSERT INTO developers (name, role, level) VALUES 
('Antigravity', 'AI Assistant', 'Legendary'),
('User', 'Fullstack Developer', 'Senior'),
('Explorer', 'WASM Specialist', 'Junior');

-- 데이터 쿼리 조회 (결과가 표로 렌더링됩니다!)
SELECT * FROM developers;
\`\`\`

### 🎨 Live HTML 샌드박스 렌더러 예시
HTML/CSS/JS로 만든 화려한 웹 컴포넌트 프리뷰를 격리된 샌드박스 안에서 즉시 실시간 렌더링하여 확인합니다.

\`\`\`html
<div style="
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 30px;
  border-radius: 12px;
  color: white;
  text-align: center;
  font-family: sans-serif;
  box-shadow: 0 10px 20px rgba(0,0,0,0.3);
">
  <h2 style="margin:0 0 10px 0;">🎉 AMEVA Live Sandbox</h2>
  <p style="opacity:0.9; margin: 0 0 20px 0;">격리된 iframe 위에서 HTML/CSS가 실시간 작동합니다!</p>
  <button onclick="alert('반갑습니다! 실시간 샌드박스 버튼입니다.')" style="
    background: white;
    color: #764ba2;
    border: none;
    padding: 10px 24px;
    border-radius: 20px;
    font-weight: bold;
    cursor: pointer;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  ">클릭해 보세요</button>
</div>
\`\`\`

### 💻 JavaScript 실행 예시

\`\`\`javascript
// JavaScript 실행 테스트
const nums = [1, 2, 3, 4, 5]
const sum = nums.reduce((a, b) => a + b, 0)
console.log('합계:', sum)
console.log('평균:', sum / nums.length)
\`\`\`

### 📊 Mermaid 다이어그램

\`\`\`mermaid
graph TD
    A[사용자] --> B[AMEVA Workstation]
    B --> C[AI 어시스턴트]
    B --> D[실시간 협업]
    B --> E[문서 변환]
    C --> F[로컬 LLM]
    D --> G[Y.js CRDT]
\`\`\`
`
      setCurrentContent(welcomeMD)
      if (ipc.isElectronEnv()) {
        ipc.appReady()
      }
    } else {
      if (ipc.isElectronEnv()) {
        ipc.appReady()
      }
    }
  }, [ydoc, provider, isActive, username, userColor, setCurrentContent, setEditor])

  return { DEFAULT_WELCOME_TEXT }
}
