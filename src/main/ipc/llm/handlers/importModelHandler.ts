import { ipcMain } from 'electron'
import { join, basename } from 'path'
import { existsSync } from 'fs'

export function registerImportModelHandler(): void {
  ipcMain.handle('llm:importModel', async (_event, sourcePath: string, type?: 'llm' | 'code') => {
    const llmDir = type === 'code' ? 'C:\\ameva\\models\\code' : 'C:\\ameva\\models\\llm'
    try {
      const { copyFile, mkdir } = await import('fs/promises')
      if (!sourcePath || !existsSync(sourcePath)) {
        return { success: false, error: '선택한 파일이 존재하지 않습니다.' }
      }
      const filename = basename(sourcePath)
      if (!filename.endsWith('.gguf')) {
        return { success: false, error: '보안 정책: .gguf 파일만 추가할 수 있습니다.' }
      }
      if (!existsSync(llmDir)) {
        await mkdir(llmDir, { recursive: true })
      }
      const targetPath = join(llmDir, filename)
      await copyFile(sourcePath, targetPath)
      return { success: true, path: targetPath }
    } catch (err: any) {
      return { success: false, error: `파일 복사 실패: ${err.message}` }
    }
  })
}
