import { app, BrowserWindow, ipcMain, dialog, shell, net, safeStorage } from 'electron'
import { join, resolve as resolvePath } from 'path'
import { existsSync, writeFileSync, readFileSync } from 'fs'
import { readFile, writeFile } from 'fs/promises'
import { createRequire } from 'module'
import * as exportersMain from '../exportersMain.js'
import { CollabServerManager } from '../services/collabServer.js'
import { getProPlanMemory } from '../services/planState.js'

const require = createRequire(import.meta.url)
const pdfModule = require('pdf-parse')
const pdf = typeof pdfModule === 'function' ? pdfModule : (pdfModule.default || pdfModule)

const credentialsPath = join(app.getPath('userData'), 'credentials.json')

// [SEC-W-005] openExternal 프로토콜 화이트리스트 — 임의 프로토콜 핸들러 실행 차단
const ALLOWED_EXTERNAL_PROTOCOLS = ['http:', 'https:', 'mailto:']

function getActiveWindow(event: any, getMainWindow: () => BrowserWindow | null): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender) || getMainWindow()
}

/**
 * 파일, 다이얼로그, 윈도우, 내보내기, 협업 서버, 키체인, URL 메타데이터 관련 IPC 핸들러 등록
 */
export function registerFileIpc(
  getMainWindow: () => BrowserWindow | null,
  createWindow: () => void
): void {
  // IPC 핸들러 - 파일 관리
  ipcMain.handle('dialog:openFile', async (event) => {
    const result = await dialog.showOpenDialog(getActiveWindow(event, getMainWindow)!, {
      properties: ['openFile'],
      filters: [
        { name: 'All Supported Documents', extensions: ['md', 'markdown', 'txt', 'docx', 'pdf', 'hwpx', 'xlsx', 'xls', 'ipynb', 'adc'] },
        { name: 'Markdown Document', extensions: ['md', 'markdown'] },
        { name: 'Plain Text', extensions: ['txt'] },
        { name: 'Word Document', extensions: ['docx'] },
        { name: 'PDF Document', extensions: ['pdf'] },
        { name: 'HWPX Document', extensions: ['hwpx'] },
        { name: 'Excel Sheet', extensions: ['xlsx', 'xls'] },
        { name: 'Jupyter Notebook', extensions: ['ipynb'] },
      ],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const filePath = result.filePaths[0]
    const ext = filePath.split('.').pop()?.toLowerCase() || ''
    
    const isBinary = ['docx', 'pdf', 'hwpx', 'xlsx', 'xls'].includes(ext)
    let content: string
    
    if (ext === 'pdf') {
      try {
        const buffer = await readFile(filePath)
        const data = await pdf(buffer)
        content = data.text || ''
      } catch (err: any) {
        content = `Error parsing PDF: ${err.message}`
      }
    } else if (isBinary) {
      const buffer = await readFile(filePath)
      content = buffer.toString('base64')
    } else {
      content = await readFile(filePath, 'utf-8')
    }
    
    return { content, filePath, isBinary }
  })

  ipcMain.handle('dialog:showMessageBox', async (event, options) => {
    return await dialog.showMessageBox(getActiveWindow(event, getMainWindow)!, options)
  })

  ipcMain.handle('dialog:selectLocalFile', async (event, filters?: any[]) => {
    const result = await dialog.showOpenDialog(getActiveWindow(event, getMainWindow)!, {
      properties: ['openFile'],
      filters: filters || [{ name: 'All Files', extensions: ['*'] }],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const filePath = result.filePaths[0]
    const buffer = await readFile(filePath)
    const base64 = buffer.toString('base64')
    return { filePath, base64 }
  })

  ipcMain.handle('dialog:saveFile', async (event, content: string, filePath?: string) => {
    let targetPath = filePath
    if (!targetPath) {
      const result = await dialog.showSaveDialog(getActiveWindow(event, getMainWindow)!, {
        title: 'Save Document',
        filters: [
          { name: 'All Supported Documents', extensions: ['md', 'markdown', 'txt', 'docx', 'pdf', 'hwpx', 'xlsx', 'ipynb', 'adc'] },
          { name: 'Markdown Document', extensions: ['md'] },
          { name: 'Plain Text', extensions: ['txt'] },
          { name: 'Word Document', extensions: ['docx'] },
          { name: 'PDF Document', extensions: ['pdf'] },
          { name: 'HWPX Document', extensions: ['hwpx'] },
          { name: 'Excel Sheet', extensions: ['xlsx'] },
          { name: 'Jupyter Notebook', extensions: ['ipynb'] },
        ],
      })
      if (result.canceled || !result.filePath) return null
      targetPath = result.filePath
    }
    
    const ext = targetPath.split('.').pop()?.toLowerCase() || ''
    const isBinarySave = ['docx', 'pdf', 'hwpx', 'xlsx', 'xls'].includes(ext)
    
    if (isBinarySave) {
      await writeFile(targetPath, Buffer.from(content, 'base64'))
    } else {
      await writeFile(targetPath, content, 'utf-8')
    }
    
    return targetPath
  })

  ipcMain.handle('dialog:saveExportedFile', async (event, data: string, isBase64: boolean, defaultName: string, filters: any[]) => {
    const result = await dialog.showSaveDialog(getActiveWindow(event, getMainWindow)!, {
      title: 'Export File',
      defaultPath: defaultName,
      filters: filters,
    })
    if (result.canceled || !result.filePath) return null
    if (isBase64) {
      await writeFile(result.filePath, Buffer.from(data, 'base64'))
    } else {
      await writeFile(result.filePath, data, 'utf-8')
    }
    return result.filePath
  })

  // IPC 핸들러 - PDF 변환 (Chrome Headless)
  ipcMain.handle('action:printToPDF', async (_event, htmlContent: string) => {
    // [SEC-W-012] sandbox: true + javascript: false 로 임의 HTML 렌더링 격리
    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        javascript: false,  // PDF 출력 전용 — JS 실행 불필요
      },
    })
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`)
    await new Promise((resolve) => setTimeout(resolve, 800))
    const pdfData = await printWindow.webContents.printToPDF({
      margins: { top: 1, bottom: 1, left: 1, right: 1 },
      pageSize: 'A4',
      printBackground: true,
    })
    printWindow.close()
    const saveResult = await dialog.showSaveDialog(getMainWindow()!, {
      title: 'Save PDF File',
      defaultPath: 'document.pdf',
      filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
    })
    if (saveResult.canceled || !saveResult.filePath) return null
    await writeFile(saveResult.filePath, pdfData)
    return saveResult.filePath
  })

  // IPC 핸들러 - 웹 실시간 검색 (CORS 우회 통로)
  ipcMain.handle('action:webSearch', async (_event, query: string) => {
    if (!getProPlanMemory()) {
      return { success: false, error: '무료 요금제에서는 실시간 웹 검색 기능을 사용할 수 없습니다. Pro 요금제로 업그레이드하세요.' }
    }
    try {
      const res = await net.fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      })
      if (!res.ok) {
        throw new Error(`DuckDuckGo 응답 오류: ${res.status}`)
      }
      const html = await res.text()
      const matches = html.match(/<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g) || []
      const snippets = matches
        .slice(0, 3)
        .map(m => m.replace(/<[^>]*>/g, '').trim())
        .join('\n\n')

      return { success: true, result: snippets }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  })

  ipcMain.handle('server:start', async (event, port: number) => {
    return await CollabServerManager.startServer(port, (status) => {
      event.sender.send('server:status', status)
    })
  })

  ipcMain.handle('server:stop', (event) => {
    return CollabServerManager.stopServer((status) => {
      event.sender.send('server:status', status)
    })
  })

  // 줌 레벨 조정
  ipcMain.on('window:setZoom', (event, level: number) => {
    const win = getActiveWindow(event, getMainWindow)
    if (win) win.webContents.setZoomLevel(level)
  })

  ipcMain.handle('window:getZoom', async (event) => {
    const win = getActiveWindow(event, getMainWindow)
    if (win) return win.webContents.getZoomLevel()
    return 0
  })

  ipcMain.on('window:setZoomFactor', (event, factor: number) => {
    const win = getActiveWindow(event, getMainWindow)
    if (win) win.webContents.setZoomFactor(factor)
  })

  ipcMain.handle('window:getZoomFactor', async (event) => {
    const win = getActiveWindow(event, getMainWindow)
    if (win) return win.webContents.getZoomFactor()
    return 1.0
  })

  ipcMain.on('window:new-window', () => {
    createWindow()
  })

  ipcMain.on('action:openExternal', (_event, url: string) => {
    if (url.startsWith('file:///')) {
      try {
        const decoded = decodeURIComponent(url.slice('file:///'.length))
        const normalized = resolvePath(decoded.replace(/\//g, '\\'))
        shell.showItemInFolder(normalized)
      } catch {
        console.warn('[Security] Invalid file:// URL for showItemInFolder')
      }
      return
    }

    try {
      const parsed = new URL(url)
      if (!ALLOWED_EXTERNAL_PROTOCOLS.includes(parsed.protocol)) {
        console.warn(`[Security] Blocked openExternal with disallowed protocol: ${parsed.protocol}`)
        return
      }
      shell.openExternal(url)
    } catch {
      console.warn(`[Security] Invalid URL for openExternal: ${url}`)
    }
  })

  ipcMain.on('export:showInFolder', (_event, filePath: string) => {
    shell.showItemInFolder(filePath)
  })

  ipcMain.handle('export:convert', async (event, payload: {
    blocks: any[]
    format: string
    defaultName: string
  }) => {
    const win = getActiveWindow(event, getMainWindow)
    if (!win) return { success: false, error: '활성화된 윈도우가 없습니다.' }

    const extensionsMap: Record<string, string[]> = {
      html: ['html', 'htm'],
      docx: ['docx'],
      xlsx: ['xlsx'],
      pptx: ['pptx'],
      hwpx: ['hwpx'],
      xml: ['xml']
    }

    const filters = [
      {
        name: `${payload.format.toUpperCase()} Document`,
        extensions: extensionsMap[payload.format] || [payload.format]
      }
    ]

    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: `${payload.format.toUpperCase()} 파일 저장 위치 선택`,
      defaultPath: payload.defaultName,
      filters
    })

    if (canceled || !filePath) {
      return { success: false, error: '저장이 취소되었습니다.' }
    }

    try {
      let outputBuffer: Buffer | string

      switch (payload.format) {
        case 'html':
          outputBuffer = exportersMain.blocksToHTML(payload.blocks)
          await writeFile(filePath, outputBuffer, 'utf-8')
          break
        case 'docx':
          outputBuffer = await exportersMain.exportToWord(payload.blocks)
          await writeFile(filePath, outputBuffer)
          break
        case 'xlsx':
          outputBuffer = await exportersMain.exportToExcel(payload.blocks)
          await writeFile(filePath, outputBuffer)
          break
        case 'pptx':
          outputBuffer = await exportersMain.exportToPPTX(payload.blocks)
          await writeFile(filePath, outputBuffer)
          break
        case 'hwpx':
          outputBuffer = await exportersMain.exportToHWPX(payload.blocks)
          await writeFile(filePath, outputBuffer)
          break
        case 'xml':
          outputBuffer = exportersMain.exportToXML(payload.blocks)
          await writeFile(filePath, outputBuffer, 'utf-8')
          break
        default:
          throw new Error(`지원하지 않는 변환 포맷입니다: ${payload.format}`)
      }

      return { success: true, savedPath: filePath }
    } catch (err: any) {
      console.error(`[export:convert] Failed:`, err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.on('window:close', (event) => {
    const win = getActiveWindow(event, getMainWindow)
    if (win) win.close()
  })

  ipcMain.handle('keychain:set', async (_event, key: string, value: string) => {
    try {
      if (!safeStorage.isEncryptionAvailable()) {
        return { success: false, error: 'OS 암호화 스토리지를 사용할 수 없는 환경입니다.' }
      }
      let data: Record<string, string> = {}
      if (existsSync(credentialsPath)) {
        try {
          data = JSON.parse(readFileSync(credentialsPath, 'utf8'))
        } catch {
          data = {}
        }
      }
      const encrypted = safeStorage.encryptString(value)
      data[key] = encrypted.toString('base64')
      writeFileSync(credentialsPath, JSON.stringify(data), 'utf8')
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('keychain:get', async (_event, key: string) => {
    try {
      if (!existsSync(credentialsPath)) return null
      if (!safeStorage.isEncryptionAvailable()) return null
      const data = JSON.parse(readFileSync(credentialsPath, 'utf8'))
      const encryptedBase64 = data[key]
      if (!encryptedBase64) return null
      const buffer = Buffer.from(encryptedBase64, 'base64')
      const decrypted = safeStorage.decryptString(buffer)
      return decrypted
    } catch {
      return null
    }
  })

  ipcMain.handle('keychain:delete', async (_event, key: string) => {
    try {
      if (!existsSync(credentialsPath)) return { success: true }
      let data: Record<string, string> = {}
      try {
        data = JSON.parse(readFileSync(credentialsPath, 'utf8'))
      } catch {
        data = {}
      }
      delete data[key]
      writeFileSync(credentialsPath, JSON.stringify(data), 'utf8')
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('action:fetchUrlMetadata', async (_event, targetUrl: string) => {
    return new Promise<{ title?: string; description?: string; image?: string; url: string }>((resolve) => {
      const http = require('http')
      const https = require('https')
      const { URL } = require('url')
      let isResolved = false

      const fetchHtml = (urlStr: string, redirectsRemaining = 5) => {
        if (redirectsRemaining < 0) {
          resolve({ title: '', description: '너무 많은 리다이렉트가 발생했습니다.', image: '', url: targetUrl })
          return
        }

        let parsedUrl: URL
        try {
          parsedUrl = new URL(urlStr)
        } catch (err) {
          resolve({ title: '', description: '유효하지 않은 URL 형식입니다.', image: '', url: targetUrl })
          return
        }

        const client = parsedUrl.protocol === 'https:' ? https : http
        const options = {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
          },
          timeout: 5000
        }

        const req = client.get(urlStr, options, (res: any) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            const redirectTarget = new URL(res.headers.location, urlStr).toString()
            res.resume()
            fetchHtml(redirectTarget, redirectsRemaining - 1)
            return
          }

          if (res.statusCode !== 200) {
            res.resume()
            resolve({ title: '', description: `서버 코드: ${res.statusCode}`, image: '', url: targetUrl })
            return
          }

          let html = ''
          let totalBytes = 0
          const MAX_HTML_BYTES = 1024 * 1024
          let isResolved = false

          const finalizeResolve = (htmlContent: string) => {
            if (isResolved) return
            isResolved = true

            const getMetaTag = (property: string) => {
              const regexes = [
                new RegExp(`<meta[^>]*property=["']og:${property}["'][^>]*content=["']([^"']*)["']`, 'i'),
                new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:${property}["']`, 'i'),
                new RegExp(`<meta[^>]*name=["']og:${property}["'][^>]*content=["']([^"']*)["']`, 'i'),
                new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*name=["']og:${property}["']`, 'i')
              ]
              for (const r of regexes) {
                const match = htmlContent.match(r)
                if (match && match[1]) {
                  return match[1]
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'")
                    .trim()
                }
              }
              return ''
            }

            let title = getMetaTag('title')
            if (!title) {
              const titleMatch = htmlContent.match(/<title[^>]*>([^<]*)<\/title>/i)
              if (titleMatch && titleMatch[1]) {
                title = titleMatch[1].trim()
              }
            }

            let description = getMetaTag('description')
            if (!description) {
              const descMatch = htmlContent.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)
              if (descMatch && descMatch[1]) {
                description = descMatch[1].trim()
              }
            }

            const image = getMetaTag('image')

            resolve({
              title: title || parsedUrl.hostname,
              description: description || '설명이 존재하지 않는 웹 페이지입니다.',
              image: image || '',
              url: urlStr
            })
          }

          res.on('data', (chunk: Buffer) => {
            totalBytes += chunk.length
            if (totalBytes > MAX_HTML_BYTES) {
              html += chunk.toString('utf8', 0, MAX_HTML_BYTES - (totalBytes - chunk.length))
              req.destroy()
              finalizeResolve(html)
            } else {
              html += chunk.toString('utf8')
            }
          })

          res.on('end', () => {
            finalizeResolve(html)
          })
        })

        req.on('error', (err: any) => {
          if (isResolved) return
          isResolved = true
          resolve({ title: '', description: `연결 실패: ${err.message}`, image: '', url: targetUrl })
        })

        req.on('timeout', () => {
          req.destroy()
          if (isResolved) return
          isResolved = true
          resolve({ title: '', description: '연결 시간 초과', image: '', url: targetUrl })
        })
      }

      fetchHtml(targetUrl)
    })
  })
}
