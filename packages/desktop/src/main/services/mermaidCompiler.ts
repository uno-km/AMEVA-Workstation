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

import puppeteer from 'puppeteer'
import { renderMermaid } from '@mermaid-js/mermaid-cli'

/**
 * Mermaid 코드를 PNG 버퍼로 변환합니다.
 * @param code Mermaid 정의 문자열
 * @returns PNG 파일 버퍼
 */
export async function renderMermaidToBuffer(code: string): Promise<Buffer> {
  let browser
  try {
    // 백그라운드에서 크롬(또는 퍼피티어 내장 브라우저) 실행
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    const { data } = await renderMermaid(browser, code, 'png', {
      puppeteerConfig: { headless: true, args: ['--no-sandbox'] }
    })

    // data는 Uint8Array 또는 Buffer 형식임
    return Buffer.from(data)
  } catch (error) {
    console.error('[MermaidCompiler] Failed to render mermaid graph:', error)
    throw error
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}
