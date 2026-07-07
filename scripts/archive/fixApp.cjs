const fs = require('fs');
const path = require('path');

// 1. Create mammoth.d.ts
const typesDir = path.join(__dirname, 'src/types');
if (!fs.existsSync(typesDir)) {
    fs.mkdirSync(typesDir, { recursive: true });
}
fs.writeFileSync(path.join(typesDir, 'mammoth.d.ts'), `
declare module 'mammoth' {
  export function convertToMarkdown(input: any): Promise<{ value: string; messages: any[] }>;
  export function extractRawText(input: any): Promise<{ value: string; messages: any[] }>;
  export function convertToHtml(input: any): Promise<{ value: string; messages: any[] }>;
}
`);

// 2. Patch ipcTypes.ts
const ipcTypesPath = path.join(__dirname, 'src/renderer/services/ipc/ipcTypes.ts');
let ipcTypes = fs.readFileSync(ipcTypesPath, 'utf8');
ipcTypes = ipcTypes.replace(
  'filePath: string\n  content: string',
  'filePath: string\n  content: string\n  isBinary?: boolean'
);
fs.writeFileSync(ipcTypesPath, ipcTypes);

// 3. Patch electronApiAdapter.ts
const adapterPath = path.join(__dirname, 'src/renderer/services/ipc/electronApiAdapter.ts');
let adapter = fs.readFileSync(adapterPath, 'utf8');
if (!adapter.includes('printToPDF?:')) {
  adapter = adapter.replace(
    '// 내보내기',
    'printToPDF?: (html: string) => Promise<string>;\n      newWindow?: (url?: string) => void;\n      saveExportedFile?: (data: string, isBase64: boolean, defaultName: string, filters: { name: string; extensions: string[] }[]) => Promise<any>;\n      exportConvert?: (payload: { blocks: any; format: string; defaultName: string }) => Promise<any>;\n      closeApp?: () => void;\n      // 내보내기'
  );
  adapter += `

export async function printToPDF(html: string): Promise<string> {
  if (!window.electronAPI?.printToPDF) return ''
  return window.electronAPI.printToPDF(html)
}

export function newWindow(url?: string): void {
  if (!window.electronAPI?.newWindow) return
  window.electronAPI.newWindow(url)
}

export async function saveExportedFile(data: string, isBase64: boolean, defaultName: string, filters: { name: string; extensions: string[] }[]): Promise<any> {
  if (!window.electronAPI?.saveExportedFile) return { success: false }
  return window.electronAPI.saveExportedFile(data, isBase64, defaultName, filters)
}

export async function exportConvert(payload: { blocks: any; format: string; defaultName: string }): Promise<any> {
  if (!window.electronAPI?.exportConvert) return { success: false }
  return window.electronAPI.exportConvert(payload)
}

export function closeApp(): void {
  if (!window.electronAPI?.closeApp) return
  window.electronAPI.closeApp()
}
`;
  fs.writeFileSync(adapterPath, adapter);
}

// 4. Patch App.tsx
const appPath = path.join(__dirname, 'src/renderer/App.tsx');
let app = fs.readFileSync(appPath, 'utf8');

// ArrayBufferLike
app = app.replace('arrayBufferToBase64(buffer: ArrayBuffer)', 'arrayBufferToBase64(buffer: ArrayBufferLike)');

// BlockNoteEditor state
app = app.replace('const [editor, setEditor] = useState<BlockNoteEditor | null>(null)', 'const [editor, setEditor] = useState<typeof schema.BlockNoteEditor | null>(null)');

// welcomeMD global
if (app.includes('const welcomeMD = `# 🚀 AMEVA Workstation')) {
    app = app.replace(/const welcomeMD = `# 🚀 AMEVA Workstation[\s\S]*?`\n/, '');
    const welcomeIndex = app.indexOf('function App()');
    app = app.slice(0, welcomeIndex) + `const welcomeMD = \`# 🚀 AMEVA Workstation
\n(AMEVA-OS WebAssembly Kernel & AI Hub)
\n이곳에서 문서 작성, 코드 실행, 파일 시스템 탐색을 할 수 있습니다.\`;\n\n` + app.slice(welcomeIndex);
}

// Missing username / userColor / setDragOffset
app = app.replace(
  'const [editorMode, setEditorMode] = useState<EditorMode>(\'welcome\')',
  `const [editorMode, setEditorMode] = useState<EditorMode>('welcome')
  const [username, setUsername] = useState('User_' + Math.floor(Math.random() * 1000))
  const [userColor, setUserColor] = useState('#' + Math.floor(Math.random() * 16777215).toString(16))`
);
app = app.replace(
  'const { pipVideoId, setPipVideoId, pipPosition, isDraggingPip } = useYoutubePiP()',
  'const { pipVideoId, setPipVideoId, pipPosition, isDraggingPip, setDragOffset } = useYoutubePiP()'
);

// IDLE_PROGRESS -> IDLE_EXPORT_PROGRESS
app = app.replace(/IDLE_PROGRESS/g, 'IDLE_EXPORT_PROGRESS');
if (!app.includes('IDLE_EXPORT_PROGRESS')) {
    app = app.replace(
      'exportProgress, setExportProgress, resetExportProgress,',
      'exportProgress, setExportProgress, resetExportProgress, IDLE_EXPORT_PROGRESS,' // Wait, it's exported from store? Let's check.
    ); // Oh wait, IDLE_EXPORT_PROGRESS is exported from the store file itself, not from the hook. I will just import it.
}
app = app.replace(
  'import { useProcessStore } from \'./stores/useProcessStore\'',
  'import { useProcessStore, IDLE_EXPORT_PROGRESS } from \'./stores/useProcessStore\''
);

// Zustand setState prev => ... fixes
app = app.replace(/setCurrentContent\(prev => prev \+ '\\n' \+ text\)/g, 'setCurrentContent(useWorkspaceStore.getState().currentContent + "\\n" + text)');
app = app.replace(/setToastMessage\(prev => prev === '선택한 블록이 AI 어시스턴트에 참조 태그되었습니다\.' \? null : prev\)/g, 'setToastMessage(useUIStore.getState().toastMessage === "선택한 블록이 AI 어시스턴트에 참조 태그되었습니다." ? null : useUIStore.getState().toastMessage)');
app = app.replace(/setIsSearching\(prev => !prev\)/g, 'setIsSearching(!useUIStore.getState().isSearching)');
app = app.replace(/setShowSettings\(prev => !prev\)/g, 'setShowSettings(!useUIStore.getState().isSettingsOpen)'); // Actually UIStore is isSettingsOpen! wait, did App.tsx use setIsSettingsOpen?
app = app.replace(/setIsSearchRegex\(prev => !prev\)/g, 'setIsSearchRegex(!useUIStore.getState().isSearchRegex)');

app = app.replace(/setSplitRatio\(prev => Math\.max\(20, prev - 5\)\)/g, 'setSplitRatio(Math.max(20, useUIStore.getState().splitRatio - 5))');
app = app.replace(/setSplitRatio\(prev => Math\.min\(80, prev \+ 5\)\)/g, 'setSplitRatio(Math.min(80, useUIStore.getState().splitRatio + 5))');
app = app.replace(/setSplitRatio\(\(prev\) => Math\.min\(80, prev \+ 10\)\)/g, 'setSplitRatio(Math.min(80, useUIStore.getState().splitRatio + 10))');
app = app.replace(/setSplitRatio\(\(prev\) => Math\.max\(20, prev - 10\)\)/g, 'setSplitRatio(Math.max(20, useUIStore.getState().splitRatio - 10))');

app = app.replace(/setExportMinimized\(prev => !prev\)/g, 'setExportMinimized(!useProcessStore.getState().exportMinimized)');
app = app.replace(/setExportProgress\(prev => \(\{ \.\.\.prev, percent, message \}\)\)/g, 'setExportProgress({ ...useProcessStore.getState().exportProgress, percent, message })');
app = app.replace(/setExportProgress\(prev => \(\{\n\s*\.\.\.prev,\n\s*phase: 'success',\n/g, 'setExportProgress({\n          ...useProcessStore.getState().exportProgress,\n          phase: \'success\',\n');
app = app.replace(/setExportProgress\(prev => \(\{\n\s*\.\.\.prev,\n\s*phase: 'error',\n/g, 'setExportProgress({\n          ...useProcessStore.getState().exportProgress,\n          phase: \'error\',\n');

// allowfullscreen
app = app.replace(/allowfullscreen/g, 'allowFullScreen');

// res.split handling
app = app.replace(/const filename = res\.split\(\/[/\\\\]\/\)\.pop\(\)/g, 'const filePathStr = typeof res === "string" ? res : res.filePath;\n                const filename = filePathStr?.split(/[\\\\/]/).pop()');
app = app.replace(/setToastMessage\(`저장 완료: \$\{res\}`\)/g, 'setToastMessage(`저장 완료: ${typeof res === "string" ? res : res.filePath}`)');
app = app.replace(/toast\.success\(`\$\{res\} 파일이 저장되었습니다.`\)/g, 'toast.success(`${typeof res === "string" ? res : res.filePath} 파일이 저장되었습니다.`)');

fs.writeFileSync(appPath, app);
console.log('Done patching.');
