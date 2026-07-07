import { ipcMain } from 'electron'
import { join, basename } from 'path'
import { existsSync } from 'fs'

let activeDownloadRequest: any = null

// [SEC-W-003] 허용 다운로드 호스트 화이트리스트
const ALLOWED_DOWNLOAD_HOSTS = [
  'huggingface.co',
  'cdn-lfs.huggingface.co',
  'cdn-lfs-us-1.huggingface.co',
  'cdn.ollama.ai',
  'ollama.ai',
  'github.com',
  'objects.githubusercontent.com',
]
const MAX_REDIRECT_DEPTH = 5

/**
 * 모델 목록 조회, 모델 임포트, 온라인 모델 다운로드 및 취소 IPC 등록
 */
export function registerLlmModelIpc(): void {
  ipcMain.handle('llm:listModels', async (_event, type?: 'llm' | 'code' | 'ollama') => {
    if (type === 'ollama') {
      return new Promise((resolve) => {
        const http = require('http')
        const req = http.request({
          hostname: '127.0.0.1',
          port: 11434,
          path: '/api/tags',
          method: 'GET',
          timeout: 2000
        }, (res: any) => {
          let rawData = ''
          res.on('data', (chunk: any) => { rawData += chunk })
          res.on('end', () => {
            try {
              const parsed = JSON.parse(rawData)
              const models = (parsed.models || []).map((m: any) => ({
                name: m.name,
                filename: m.model,
                path: m.name,
                size: m.size || 0
              }))
              resolve(models)
            } catch (e) {
              resolve([])
            }
          })
        })
        req.on('error', () => { resolve([]) })
        req.on('timeout', () => { req.destroy(); resolve([]) })
        req.end()
      })
    }

    const llmDir = type === 'code' ? 'C:\\ameva\\models\\code' : 'C:\\ameva\\models\\llm'
    try {
      const { readdir } = await import('fs/promises')
      if (!existsSync(llmDir)) return []
      const files = await readdir(llmDir)
      const filtered = files
        .filter(f => f.endsWith('.gguf'))
        .map(f => ({
          name: f.replace('.gguf', '').replace(/-/g, ' '),
          filename: f,
          path: join(llmDir, f),
          size: (() => {
            try {
              const { statSync } = require('fs')
              return statSync(join(llmDir, f)).size
            } catch { return 0 }
          })(),
        }))
      return filtered
    } catch {
      return []
    }
  })

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

  ipcMain.handle('llm:downloadModel', async (event, payload: {
    url: string
    filename: string
    type?: 'llm' | 'code'
  }) => {
    const llmDir = payload.type === 'code' ? 'C:\\ameva\\models\\code' : 'C:\\ameva\\models\\llm'
    const { mkdir } = await import('fs/promises')
    const { createWriteStream } = require('fs')
    const https = require('https')

    try {
      const safeName = basename(payload.filename)
      if (!safeName.endsWith('.gguf') && !safeName.endsWith('.bin')) {
        return { success: false, error: '보안 정책: .gguf / .bin 파일만 다운로드 가능합니다.' }
      }
      const targetPath = join(llmDir, safeName)
      const { resolve: resolvePath } = require('path')
      const resolvedTarget = resolvePath(targetPath)
      const resolvedDir = resolvePath(llmDir)
      if (!resolvedTarget.startsWith(resolvedDir)) {
        return { success: false, error: '보안 정책: 경로 탈출이 감지되었습니다.' }
      }

      let parsedUrl: URL
      try {
        parsedUrl = new URL(payload.url)
      } catch {
        return { success: false, error: '유효하지 않은 URL입니다.' }
      }
      if (parsedUrl.protocol !== 'https:') {
        return { success: false, error: '보안 정책: HTTPS URL만 허용됩니다.' }
      }
      if (!ALLOWED_DOWNLOAD_HOSTS.includes(parsedUrl.hostname)) {
        return { success: false, error: `보안 정책: 허용되지 않은 다운로드 호스트입니다. (${parsedUrl.hostname})` }
      }

      if (!existsSync(llmDir)) {
        await mkdir(llmDir, { recursive: true })
      }

      const fileStream = createWriteStream(resolvedTarget)

      return new Promise<{ success: boolean; error?: string }>((resolve) => {
        let downloadedBytes = 0
        let totalBytes = 0
        let lastTime = Date.now()
        let lastBytes = 0

        const requestUrl = (targetUrl: string, depth = 0) => {
          if (depth > MAX_REDIRECT_DEPTH) {
            fileStream.destroy()
            activeDownloadRequest = null
            resolve({ success: false, error: '너무 많은 리다이렉트가 발생했습니다.' })
            return
          }
          let redirectParsed: URL
          try { redirectParsed = new URL(targetUrl) } catch {
            fileStream.destroy()
            resolve({ success: false, error: '리다이렉트 URL이 유효하지 않습니다.' })
            return
          }
          if (redirectParsed.protocol !== 'https:') {
            fileStream.destroy()
            resolve({ success: false, error: '리다이렉트가 HTTPS가 아닙니다.' })
            return
          }

          const req = https.get(targetUrl, (res: any) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              requestUrl(res.headers.location, depth + 1)
              return
            }
            if (res.statusCode !== 200) {
              fileStream.close()
              const errText = `다운로드 실패: 서버 응답 코드 오류: ${res.statusCode} (URL: ${targetUrl})`
              console.error(errText)
              if (!event.sender.isDestroyed()) {
                event.sender.send('llm:log', { text: `\n[Error] ${errText}\n` })
              }
              resolve({ success: false, error: `서버 응답 코드 오류: ${res.statusCode}` })
              return
            }

            totalBytes = parseInt(res.headers['content-length'] || '0', 10)

            res.on('data', (chunk: Buffer) => {
              downloadedBytes += chunk.length
              fileStream.write(chunk)

              const now = Date.now()
              if (now - lastTime > 500) {
                const chunkTime = (now - lastTime) / 1000
                const chunkBytes = downloadedBytes - lastBytes
                const speed = chunkBytes / chunkTime / (1024 * 1024)
                const progress = totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0
                const bytesRemaining = totalBytes - downloadedBytes
                const speedBytesPerSec = chunkBytes / chunkTime
                const timeRemaining = speedBytesPerSec > 0 ? bytesRemaining / speedBytesPerSec : 9999

                if (!event.sender.isDestroyed()) {
                  event.sender.send('llm:download-progress', {
                    filename: safeName,
                    progress: Math.min(100, Number(progress.toFixed(1))),
                    speed: Number(speed.toFixed(1)),
                    downloadedBytes,
                    totalBytes,
                    timeRemaining: Math.max(0, Math.round(timeRemaining))
                  })
                }
                lastTime = now
                lastBytes = downloadedBytes
              }
            })

            res.on('end', () => {
              fileStream.end()
              activeDownloadRequest = null
              if (!event.sender.isDestroyed()) {
                event.sender.send('llm:download-progress', {
                  filename: safeName,
                  progress: 100,
                  speed: 0,
                  downloadedBytes: totalBytes,
                  totalBytes,
                  timeRemaining: 0
                })
              }
              resolve({ success: true })
            })
          })

          activeDownloadRequest = req
          req.on('error', (err: any) => {
            fileStream.close()
            activeDownloadRequest = null
            const errText = `다운로드 통신 오류: ${err.message} (URL: ${payload.url})`
            console.error(errText)
            if (!event.sender.isDestroyed()) {
              event.sender.send('llm:log', { text: `\n[Error] ${errText}\n` })
            }
            resolve({ success: false, error: err.message })
          })
        }

        requestUrl(payload.url, 0)
      })

    } catch (err: any) {
      activeDownloadRequest = null
      return { success: false, error: err.message }
    }
  })

  ipcMain.on('llm:cancelDownload', () => {
    if (activeDownloadRequest) {
      activeDownloadRequest.destroy()
      activeDownloadRequest = null
    }
  })
}
