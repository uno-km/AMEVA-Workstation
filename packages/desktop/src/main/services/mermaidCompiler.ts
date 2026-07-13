/**
 * @file mermaidCompiler.ts
 * @system AMEVA OS Desktop Workstation
 * @location packages/desktop/src/main/services/mermaidCompiler.ts
 * @role Mermaid to Image Buffer Converter
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - Mermaid CLI 및 Puppeteer를 사용하여 로컬 환경에서 다이어그램을 PNG Buffer로 변환.
 * - 사용하지 않을 때는 브라우저 인스턴스를 즉각 종료하여 리소스를 확보.
 */

import { BrowserWindow } from 'electron'
import mermaidScript from 'mermaid/dist/mermaid.min.js?raw'

/**
 * Mermaid 코드를 PNG 버퍼로 변환합니다.
 * @param code Mermaid 정의 문자열
 * @returns PNG 파일 버퍼
 */
export async function renderMermaidToBuffer(code: string): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    let win: BrowserWindow | null = new BrowserWindow({
      show: false, // 숨김 모드로 실행하여 화면 번쩍임 및 CMD 창 팝업 방지
      width: 1920,
      height: 1080,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        backgroundThrottling: false
      }
    })

    const timeout = setTimeout(() => {
      if (win) {
        win.close()
        win = null
      }
      reject(new Error('[MermaidCompiler] Rendering timeout'))
    }, 15000)

    try {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { margin: 0; padding: 20px; background: transparent; display: inline-block; }
            #container { background: white; border-radius: 8px; padding: 20px; display: inline-block; }
          </style>
        </head>
        <body>
          <div id="container">
            <pre class="mermaid">${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
          </div>
        </body>
        </html>
      `
      
      await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
      
      // 1. 오프라인(로컬) Mermaid 스크립트 주입 (CDN 통신 오류 원천 차단)
      await win.webContents.executeJavaScript(mermaidScript)
      
      // 2. Mermaid 초기화 및 렌더링 완료 대기
      await win.webContents.executeJavaScript(`
        mermaid.initialize({ startOnLoad: true, theme: 'default' });
        mermaid.run();
        new Promise((resolve) => {
          setTimeout(() => resolve(), 800); 
        })
      `)

      // 요소의 정확한 크기 계산
      const rect = await win.webContents.executeJavaScript(`
        (() => {
          const el = document.getElementById('container');
          if (!el) return { x: 0, y: 0, width: 800, height: 600 };
          const rect = el.getBoundingClientRect();
          return { x: Math.floor(rect.x), y: Math.floor(rect.y), width: Math.ceil(rect.width), height: Math.ceil(rect.height) };
        })();
      `)

      const image = await win.webContents.capturePage(rect)
      clearTimeout(timeout)
      resolve(image.toPNG())

    } catch (err) {
      clearTimeout(timeout)
      console.error('[MermaidCompiler] Failed to render:', err)
      reject(err)
    } finally {
      if (win) {
        win.close()
        win = null
      }
    }
  })
}
