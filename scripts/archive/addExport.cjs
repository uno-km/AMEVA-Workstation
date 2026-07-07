const fs = require('fs');
let content = fs.readFileSync('src/renderer/services/ipc/electronApiAdapter.ts', 'utf-8');

if (!content.includes('export async function llmDownloadModel')) {
  const funcStr = `

/**
 * llmDownloadModel
 * 로컬 LLM 모델 다운로드 요청
 */
export async function llmDownloadModel(modelId: string, options?: any): Promise<{ success: boolean; error?: string }> {
  if (!window.electronAPI?.llmDownloadModel) return { success: false, error: 'IPC not available' }
  try {
    return await window.electronAPI.llmDownloadModel(modelId, options)
  } catch (e: any) {
    console.error('[llmDownloadModel] 다운로드 실패:', e)
    return { success: false, error: e.message }
  }
}
`;
  content += funcStr;
  fs.writeFileSync('src/renderer/services/ipc/electronApiAdapter.ts', content, 'utf-8');
  console.log('Added llmDownloadModel to electronApiAdapter.ts');
}
