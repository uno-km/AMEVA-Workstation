/**
 * @file htmlScraper.ts
 * @system AMEVA OS Desktop Workstation
 * @location src/main/services/htmlScraper.ts
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

import * as http from 'http'
import * as https from 'https'
import { URL } from 'url'

export interface UrlMetadata {
  title?: string
  description?: string
  image?: string
  url: string
}

export async function fetchHtmlMetadata(targetUrl: string): Promise<UrlMetadata> {
  return new Promise<UrlMetadata>((resolve) => {
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
        let localIsResolved = false

        const finalizeResolve = (htmlContent: string) => {
          if (localIsResolved) return
          localIsResolved = true

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
}
