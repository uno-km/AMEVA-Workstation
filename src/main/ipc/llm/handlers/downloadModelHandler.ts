/**
 * @file downloadModelHandler.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/main/ipc/llm/handlers/downloadModelHandler.ts
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/main/index.ts): 일렉트론 메인 라이프사이클(ready/will-quit) 및 윈도우 생성 시점에 결합 구동.
 * - 소비처 B (src/main/preload.ts): contextBridge 안전 통로 노출을 위한 핵심 백엔드 기능 공급자로 소비.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 본 파일은 AMEVA 시스템 내에서 도메인 목적에 부합하는 연산 및 데이터 처리 흐름을 안전하게 캡슐화한다.
 * - 외부 라이브러리 및 하위 종속성을 조율하고 결과 규격을 일관되게 제공한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그를 명확하게 남길 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

import { ipcMain } from 'electron'
import { join, basename } from 'path'
import { existsSync } from 'fs'

let activeDownloadRequest: any = null

// [SEC-W-003] 허용 다운로드 호스트 화이트리스트
const ALLOWED_DOWNLOAD_HOSTS = [
  'huggingface.co',
  'cdn.ollama.ai',
  'ollama.ai',
  'github.com',
  'objects.githubusercontent.com',
]
const MAX_REDIRECT_DEPTH = 5

export function registerDownloadModelHandler(): void {
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
      if (
        !ALLOWED_DOWNLOAD_HOSTS.includes(parsedUrl.hostname) &&
        !parsedUrl.hostname.endsWith('.huggingface.co') &&
        !parsedUrl.hostname.endsWith('.hf.co')
      ) {
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
