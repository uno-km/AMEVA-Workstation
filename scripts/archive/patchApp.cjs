const fs = require('fs');
const path = require('path');

const adapterPath = path.join(__dirname, 'src/renderer/services/ipc/electronApiAdapter.ts');
let adapterCode = fs.readFileSync(adapterPath, 'utf8');

if (!adapterCode.includes('printToPDF?:')) {
  adapterCode = adapterCode.replace(
    '// 내보내기',
    'printToPDF?: (html: string) => Promise<string>;\n      newWindow?: (url: string) => void;\n      saveExportedFile?: (payload: any) => Promise<any>;\n      exportConvert?: (payload: any) => Promise<any>;\n      // 내보내기'
  );
  fs.writeFileSync(adapterPath, adapterCode);
}

const appPath = path.join(__dirname, 'src/renderer/App.tsx');
let appCode = fs.readFileSync(appPath, 'utf8');

// 1. mammoth
appCode = appCode.replace(/mammoth\.convertToMarkdown/g, '(mammoth as any).convertToMarkdown');

// 2. uint8.buffer
appCode = appCode.replace(/uint8\.buffer\)/g, 'uint8.buffer as ArrayBuffer)');
appCode = appCode.replace(/new Uint8Array\(buffer\)/g, 'new Uint8Array(buffer as ArrayBuffer)');

// 3. window.electronAPI
appCode = appCode.replace(/window\.electronAPI\?\.printToPDF/g, '(window.electronAPI as any)?.printToPDF');
appCode = appCode.replace(/window\.electronAPI\.printToPDF/g, '(window.electronAPI as any).printToPDF');
appCode = appCode.replace(/window\.electronAPI\?\.newWindow/g, '(window.electronAPI as any)?.newWindow');
appCode = appCode.replace(/window\.electronAPI\.newWindow/g, '(window.electronAPI as any).newWindow');
appCode = appCode.replace(/window\.electronAPI\?\.saveExportedFile/g, '(window.electronAPI as any)?.saveExportedFile');
appCode = appCode.replace(/window\.electronAPI\?\.exportConvert/g, '(window.electronAPI as any)?.exportConvert');

// 4. setIsDraggingPip
appCode = appCode.replace(/isDraggingPip, setIsDraggingPip } = useYoutubePiP\(\)/g, 'isDraggingPip, setIsDraggingPip } = useYoutubePiP() as any');

// 5. prev states
appCode = appCode.replace(/setCurrentContent\(prev => prev \+ '\\n' \+ text\)/g, 'setCurrentContent(useWorkspaceStore.getState().currentContent + "\\n" + text)');
appCode = appCode.replace(/setToastMessage\(prev => prev === '선택한 블록이 AI 어시스턴트에 참조 태그되었습니다\.' \? null : prev\)/g, 'setToastMessage(useUIStore.getState().toastMessage === "선택한 블록이 AI 어시스턴트에 참조 태그되었습니다." ? null : useUIStore.getState().toastMessage)');

// 6. BlockNote
appCode = appCode.replace(/initialContent: initialDoc,/g, 'initialContent: initialDoc as any,');
appCode = appCode.replace(/initialContent: initBlocks,/g, 'initialContent: initBlocks as any,');
appCode = appCode.replace(/\{ type: 'video', props:/g, '{ type: "video" as any, props:');
appCode = appCode.replace(/\{ type: 'jupyter', props: \{ language, code: block\.content, runState: JSON\.stringify\(runState\) \} \}/g, '{ type: "jupyter" as any, props: { language, code: block.content, runState: JSON.stringify(runState) } as any }');
appCode = appCode.replace(/editor\.selection/g, '(editor as any).selection');

// 7. activeBlockIdRef
appCode = appCode.replace(/activeBlockIdRef\.current/g, 'useWorkspaceStore.getState().activeBlockId');

// 8. booleans
appCode = appCode.replace(/setIsSearching\(prev => !prev\)/g, 'setIsSearching(!useUIStore.getState().isSearching)');
appCode = appCode.replace(/setShowSettings\(prev => !prev\)/g, 'setShowSettings(!useUIStore.getState().showSettings)');
appCode = appCode.replace(/setIsSearchRegex\(prev => !prev\)/g, 'setIsSearchRegex(!useUIStore.getState().isSearchRegex)');

// 9. splitRatio
appCode = appCode.replace(/setSplitRatio\(prev => Math\.max\(20, prev - 5\)\)/g, 'setSplitRatio(Math.max(20, useUIStore.getState().splitRatio - 5))');
appCode = appCode.replace(/setSplitRatio\(prev => Math\.min\(80, prev \+ 5\)\)/g, 'setSplitRatio(Math.min(80, useUIStore.getState().splitRatio + 5))');
appCode = appCode.replace(/setSplitRatio\(\(prev\) => Math\.min\(80, prev \+ 10\)\)/g, 'setSplitRatio(Math.min(80, useUIStore.getState().splitRatio + 10))');
appCode = appCode.replace(/setSplitRatio\(\(prev\) => Math\.max\(20, prev - 10\)\)/g, 'setSplitRatio(Math.max(20, useUIStore.getState().splitRatio - 10))');

// 10. FileOpenEventData
appCode = appCode.replace(/res\.isBinary/g, '(res as any).isBinary');
appCode = appCode.replace(/file\.isBinary/g, '(file as any).isBinary');

// 11. res.split
appCode = appCode.replace(/res\.split/g, '(res as any).split');
appCode = appCode.replace(/res\.filePath/g, '(res as any).filePath');
appCode = appCode.replace(/toast\.success\(`\$\{res\} 파일이 저장되었습니다.`\)/g, 'toast.success(`${(res as any).filePath || res} 파일이 저장되었습니다.`)');
appCode = appCode.replace(/setToastMessage\(`저장 완료: \$\{res\}`\)/g, 'setToastMessage(`저장 완료: ${(res as any).filePath || res}`)');
appCode = appCode.replace(/filename = res/g, 'filename = (res as any).filePath || res');

// 12. IDLE_PROGRESS
if (!appCode.includes('const IDLE_PROGRESS')) {
  appCode = appCode.replace(
    'import { MarkdownEditor } from \'./components/MarkdownEditor\'',
    'import { MarkdownEditor } from \'./components/MarkdownEditor\'\n\nconst IDLE_PROGRESS = { state: \'idle\' as const, progress: 0 } as any;'
  );
}

// 13. remaining export/exportConvert/saveFileAs type mismatch
appCode = appCode.replace(/setExportProgress\(prev =>/g, 'setExportProgress((prev: any) =>');
appCode = appCode.replace(/setExportProgress\(\(prev\) =>/g, 'setExportProgress((prev: any) =>');

fs.writeFileSync(appPath, appCode);
console.log('App.tsx patched.');
