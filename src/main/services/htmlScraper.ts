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
