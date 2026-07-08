import React, { useState, useEffect, useCallback } from 'react'
import { TrendingUp, TrendingDown, RefreshCw, Search } from 'lucide-react'

// ─────────────────────────────────────────────────────────────
// 내장 주식/환율 정보 뷰 (finance-dashboard / finance 탭)
// Yahoo Finance Public API (query2.finance.yahoo.com) 사용
// 별도 API 키 불필요 — 공개 엔드포인트 활용
// ─────────────────────────────────────────────────────────────

interface StockQuote {
  symbol: string
  shortName: string
  regularMarketPrice: number
  regularMarketChangePercent: number
  regularMarketChange: number
  currency: string
}

const DEFAULT_SYMBOLS = ['AAPL', 'NVDA', 'TSLA', 'MSFT', 'GOOGL', '005930.KS', '000660.KS', 'USDT=X', 'KRW=X']

async function fetchQuotes(symbols: string[]): Promise<StockQuote[]> {
  // Yahoo Finance v8 public endpoint (CORS 허용)
  const url = `https://query2.finance.yahoo.com/v8/finance/spark?symbols=${symbols.join(',')}&range=1d&interval=5m`
  const quotesUrl = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(',')}&fields=shortName,regularMarketPrice,regularMarketChangePercent,regularMarketChange,currency`
  
  try {
    const res = await fetch(quotesUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return (data?.quoteResponse?.result as StockQuote[]) || []
  } catch {
    // CORS 차단 시 allorigins.win 프록시 사용
    const proxied = `https://api.allorigins.win/get?url=${encodeURIComponent(quotesUrl)}`
    const res = await fetch(proxied)
    const data = await res.json()
    const parsed = JSON.parse(data.contents)
    return (parsed?.quoteResponse?.result as StockQuote[]) || []
  }
}

export function FinanceDashboardView() {
  const [quotes, setQuotes] = useState<StockQuote[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [symbols, setSymbols] = useState<string[]>(DEFAULT_SYMBOLS)
  const [lastUpdated, setLastUpdated] = useState<string>('')

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await fetchQuotes(symbols)
      setQuotes(data)
      setLastUpdated(new Date().toLocaleTimeString('ko-KR'))
    } catch (e) {
      setError('시세 데이터를 불러오지 못했습니다. 네트워크를 확인하세요.')
      console.error('[FinanceDashboard] fetch failed:', e)
    } finally {
      setIsLoading(false)
    }
  }, [symbols])

  useEffect(() => {
    refresh()
    // 60초마다 자동 갱신
    const interval = setInterval(refresh, 60000)
    return () => clearInterval(interval)
  }, [refresh])

  const handleAddSymbol = (e: React.FormEvent) => {
    e.preventDefault()
    const sym = searchQuery.toUpperCase().trim()
    if (sym && !symbols.includes(sym)) {
      setSymbols(prev => [...prev, sym])
      setSearchQuery('')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-main)', overflow: 'hidden' }}>
      {/* 헤더 */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-muted)', display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <TrendingUp size={14} color="#34d399" />
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-main)' }}>주식 / 환율 정보</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {lastUpdated && (
              <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{lastUpdated} 업데이트</span>
            )}
            <button
              onClick={refresh}
              disabled={isLoading}
              title="새로고침"
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--text-muted)', padding: '2px', display: 'flex', alignItems: 'center'
              }}
            >
              <RefreshCw size={13} style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          </div>
        </div>

        {/* 종목 검색 추가 */}
        <form onSubmit={handleAddSymbol} style={{ display: 'flex', gap: '6px' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="종목 코드 추가 (예: AMZN)"
            style={{
              flex: 1, padding: '5px 8px', borderRadius: '5px',
              background: 'var(--bg-glass)', border: '1px solid var(--border-muted)',
              color: 'var(--text-main)', fontSize: '10.5px', outline: 'none'
            }}
          />
          <button type="submit" style={{
            padding: '5px 8px', borderRadius: '5px', cursor: 'pointer',
            background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)',
            color: '#34d399', fontSize: '10.5px', display: 'flex', alignItems: 'center', gap: '3px'
          }}>
            <Search size={11} /> 추가
          </button>
        </form>
      </div>

      {/* 시세 목록 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {error && (
          <div style={{ padding: '12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', fontSize: '10.5px', color: '#ef4444', margin: '4px 0' }}>
            ⚠️ {error}
          </div>
        )}

        {isLoading && quotes.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} style={{ height: '52px', borderRadius: '8px', background: 'var(--bg-glass)', animation: 'pulse 1.5s ease-in-out infinite', opacity: 0.6 }} />
            ))}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {quotes.map(q => {
            const isUp = q.regularMarketChangePercent >= 0
            const pct = q.regularMarketChangePercent?.toFixed(2) ?? '0.00'
            const chg = q.regularMarketChange?.toFixed(2) ?? '0.00'
            return (
              <div
                key={q.symbol}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 10px', borderRadius: '8px',
                  background: isUp ? 'rgba(52,211,153,0.04)' : 'rgba(239,68,68,0.04)',
                  border: `1px solid ${isUp ? 'rgba(52,211,153,0.12)' : 'rgba(239,68,68,0.12)'}`,
                  cursor: 'default',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = isUp ? 'rgba(52,211,153,0.09)' : 'rgba(239,68,68,0.09)' }}
                onMouseLeave={e => { e.currentTarget.style.background = isUp ? 'rgba(52,211,153,0.04)' : 'rgba(239,68,68,0.04)' }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0 }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {q.symbol}
                  </span>
                  <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100px' }}>
                    {q.shortName || q.symbol}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', flexShrink: 0 }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
                    {q.regularMarketPrice?.toLocaleString() ?? '-'} <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 400 }}>{q.currency}</span>
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {isUp ? <TrendingUp size={10} color="#34d399" /> : <TrendingDown size={10} color="#ef4444" />}
                    <span style={{ fontSize: '10px', fontWeight: 600, color: isUp ? '#34d399' : '#ef4444', fontFamily: 'var(--font-mono)' }}>
                      {isUp ? '+' : ''}{chg} ({isUp ? '+' : ''}{pct}%)
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {!isLoading && quotes.length === 0 && !error && (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '10.5px', padding: '24px' }}>
            시세 데이터가 없습니다. 위에서 종목 코드를 추가하세요.
          </div>
        )}
      </div>
    </div>
  )
}
