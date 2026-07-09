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
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `isResolved`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const isResolved = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    let isResolved = false

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `fetchHtml`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const fetchHtml = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const fetchHtml = (urlStr: string, redirectsRemaining = 5) => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `redirectsRemaining < 0`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (redirectsRemaining < 0)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
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

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `client`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const client = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const client = parsedUrl.protocol === 'https:' ? https : http
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `options`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const options = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const options = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        },
        timeout: 5000
      }

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `req`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const req = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const req = client.get(urlStr, options, (res: any) => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `res.statusCode >= 300 && res.statusCode < 400 && res.headers.location`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `redirectTarget`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const redirectTarget = ...` 형태로 안전 캐싱 후 가공 기동.
       */
          const redirectTarget = new URL(res.headers.location, urlStr).toString()
          res.resume()
          fetchHtml(redirectTarget, redirectsRemaining - 1)
          return
        }

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `res.statusCode !== 200`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (res.statusCode !== 200)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (res.statusCode !== 200) {
          res.resume()
          resolve({ title: '', description: `서버 코드: ${res.statusCode}`, image: '', url: targetUrl })
          return
        }

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `html`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const html = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        let html = ''
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `totalBytes`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const totalBytes = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        let totalBytes = 0
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `MAX_HTML_BYTES`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const MAX_HTML_BYTES = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const MAX_HTML_BYTES = 1024 * 1024
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `localIsResolved`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const localIsResolved = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        let localIsResolved = false

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `finalizeResolve`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const finalizeResolve = ...` 형태로 안전 캐싱 후 가공 기동.
       */
        const finalizeResolve = (htmlContent: string) => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `localIsResolved`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (localIsResolved)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
          if (localIsResolved) return
          localIsResolved = true

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `getMetaTag`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const getMetaTag = ...` 형태로 안전 캐싱 후 가공 기동.
       */
          const getMetaTag = (property: string) => {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `regexes`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const regexes = ...` 형태로 안전 캐싱 후 가공 기동.
       */
            const regexes = [
              new RegExp(`<meta[^>]*property=["']og:${property}["'][^>]*content=["']([^"']*)["']`, 'i'),
              new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:${property}["']`, 'i'),
              new RegExp(`<meta[^>]*name=["']og:${property}["'][^>]*content=["']([^"']*)["']`, 'i'),
              new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*name=["']og:${property}["']`, 'i')
            ]
      /*
       * [LOOP CONTROL ITERATION]
       * - 루프 조건: `for (const r of regexes) {`
       * - 예상 시나리오: 지정된 조건 한계 도달 시점까지 콜렉션 항목의 순차 매핑, 변환 및 동기 적재 처리를 수행함.
       * - 예시: `for (const item of list)` 루프 실행 시 모든 개별 블록의 html 포맷 정제 완료 후 스택 종결.
       */
            for (const r of regexes) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `match`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const match = ...` 형태로 안전 캐싱 후 가공 기동.
       */
              const match = htmlContent.match(r)
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `match && match[1]`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (match && match[1])` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
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

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `title`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const title = ...` 형태로 안전 캐싱 후 가공 기동.
       */
          let title = getMetaTag('title')
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!title`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!title)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
          if (!title) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `titleMatch`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const titleMatch = ...` 형태로 안전 캐싱 후 가공 기동.
       */
            const titleMatch = htmlContent.match(/<title[^>]*>([^<]*)<\/title>/i)
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `titleMatch && titleMatch[1]`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (titleMatch && titleMatch[1])` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
            if (titleMatch && titleMatch[1]) {
              title = titleMatch[1].trim()
            }
          }

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `description`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const description = ...` 형태로 안전 캐싱 후 가공 기동.
       */
          let description = getMetaTag('description')
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!description`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!description)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
          if (!description) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `descMatch`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const descMatch = ...` 형태로 안전 캐싱 후 가공 기동.
       */
            const descMatch = htmlContent.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `descMatch && descMatch[1]`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (descMatch && descMatch[1])` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
            if (descMatch && descMatch[1]) {
              description = descMatch[1].trim()
            }
          }

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `image`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const image = ...` 형태로 안전 캐싱 후 가공 기동.
       */
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
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `totalBytes > MAX_HTML_BYTES`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (totalBytes > MAX_HTML_BYTES)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
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
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `isResolved`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (isResolved)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (isResolved) return
        isResolved = true
        resolve({ title: '', description: `연결 실패: ${err.message}`, image: '', url: targetUrl })
      })

      req.on('timeout', () => {
        req.destroy()
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `isResolved`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (isResolved)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
        if (isResolved) return
        isResolved = true
        resolve({ title: '', description: '연결 시간 초과', image: '', url: targetUrl })
      })
    }

    fetchHtml(targetUrl)
  })
}

