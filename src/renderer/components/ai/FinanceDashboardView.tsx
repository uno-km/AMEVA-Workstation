/**
 * @file FinanceDashboardView.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/ai/FinanceDashboardView.tsx
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/AppLayout.tsx): 레이아웃 그리드 내부 또는 플로팅 레이어 영역 내에서 그리기로 소비.
 * - 소비처 B (src/renderer/App.tsx): 전역 모달 매니저 및 뷰포트 상태 스위칭에 따라 동적 마운트되어 소비.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 본 파일은 AMEVA 시스템 내에서 도메인 목적에 부합하는 연산 및 데이터 처리 흐름을 안전하게 캡슐화한다.
 * - 외부 라이브러리 및 하위 종속성을 조율하고 결과 규격을 일관되게 제공한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그를 명확하게 남길 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, RefreshCw, Search, X, ChevronDown, ChevronUp, FileText } from 'lucide-react';

interface StockQuote {
  symbol: string;
  shortName: string;
  regularMarketPrice: number;
  regularMarketChangePercent: number;
  regularMarketChange: number;
  currency: string;
  marketCap?: number;
  trailingPE?: number;
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekHigh?: number;
  regularMarketVolume?: number;
  regularMarketOpen?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
}

const INDEX_SYMBOLS = ['^GSPC', '^IXIC', '^KS11', '^N225', '^HSI', '^GDAXI'];
const INDEX_LABELS: Record<string, string> = {
  '^GSPC': 'S&P 500', '^IXIC': 'NASDAQ', '^KS11': 'KOSPI',
  '^N225': '닛케이 225', '^HSI': '항셍', '^GDAXI': 'DAX',
};
const FX_SYMBOLS = ['USDKRW=X', 'EURKRW=X', 'JPYKRW=X', 'CNYKRW=X'];
const FX_LABELS: Record<string, string> = {
  'USDKRW=X': 'USD / KRW', 'EURKRW=X': 'EUR / KRW',
  'JPYKRW=X': 'JPY / KRW', 'CNYKRW=X': 'CNY / KRW',
};
const INTEREST_RATES = [
  { label: '미국 기준금리', value: '5.25~5.50%', note: 'Fed · 2024' },
  { label: '한국 기준금리', value: '3.50%', note: 'BOK · 2024' },
];
const DEFAULT_STOCK_SYMBOLS = ['AAPL', 'NVDA', 'TSLA', 'MSFT', '005930.KS'];
const AUTO_REFRESH_MS = 60000;

async function fetchQuotesBatch(symbols: string[]): Promise<StockQuote[]> {
  const fields = 'shortName,regularMarketPrice,regularMarketChangePercent,regularMarketChange,currency,marketCap,trailingPE,fiftyTwoWeekLow,fiftyTwoWeekHigh,regularMarketVolume,regularMarketOpen,regularMarketDayHigh,regularMarketDayLow';
  const url = 'https://query2.finance.yahoo.com/v7/finance/quote?symbols=' + symbols.join(',') + '&fields=' + fields;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    return (data?.quoteResponse?.result as StockQuote[]) || [];
  } catch {
    try {
      const proxied = 'https://api.allorigins.win/get?url=' + encodeURIComponent(url);
      const res = await fetch(proxied, { signal: AbortSignal.timeout(10000) });
      const parsed = JSON.parse((await res.json()).contents);
      return (parsed?.quoteResponse?.result as StockQuote[]) || [];
    } catch (e) {
      console.error('[FinanceDashboard] fetch failed:', e);
      return [];
    }
  }
}

const fmt = (n?: number, d = 2) => n != null && !isNaN(n) ? n.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '-';
const fmtVol = (n?: number) => !n ? '-' : n >= 1e9 ? (n/1e9).toFixed(1) + 'B' : n >= 1e6 ? (n/1e6).toFixed(1) + 'M' : n >= 1e3 ? (n/1e3).toFixed(1) + 'K' : String(n);
const fmtCap = (n?: number) => !n ? '-' : n >= 1e12 ? '$' + (n/1e12).toFixed(2) + 'T' : n >= 1e9 ? '$' + (n/1e9).toFixed(1) + 'B' : '$' + (n/1e6).toFixed(0) + 'M';

function SectionTitle({ label, icon }: { label: string; icon: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 0 4px', marginBottom: '4px', borderBottom: '1px solid var(--border-muted)' }}>
      <span style={{ fontSize: '10px' }}>{icon}</span>
      <span style={{ fontSize: '9.5px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
    </div>
  );
}

function QuoteRow({ symbol, label, price, pct, currency = '', isUp, onClick, isActive }: {
  symbol: string; label: string; price: number; pct: number
  currency?: string; isUp: boolean; onClick?: () => void; isActive?: boolean
}) {
  const bg = isActive
    ? (isUp ? 'rgba(52,211,153,0.12)' : 'rgba(239,68,68,0.12)')
    : (isUp ? 'rgba(52,211,153,0.03)' : 'rgba(239,68,68,0.03)');
  const border = isActive
    ? (isUp ? 'rgba(52,211,153,0.4)' : 'rgba(239,68,68,0.4)')
    : (isUp ? 'rgba(52,211,153,0.08)' : 'rgba(239,68,68,0.08)');
  return (
    <div
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', borderRadius: '7px', background: bg, border: '1px solid ' + border, cursor: onClick ? 'pointer' : 'default', transition: 'background 0.12s', marginBottom: '3px' }}
      onMouseEnter={e => onClick && (e.currentTarget.style.background = isUp ? 'rgba(52,211,153,0.09)' : 'rgba(239,68,68,0.09)')}
      onMouseLeave={e => onClick && (e.currentTarget.style.background = bg)}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0 }}>
        <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '130px' }}>{label}</span>
        {label !== symbol && <span style={{ fontSize: '8px', color: 'var(--text-muted)' }}>{symbol}</span>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1px', flexShrink: 0, marginLeft: '6px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
          {fmt(price)} <span style={{ fontSize: '8px', color: 'var(--text-muted)', fontWeight: 400 }}>{currency}</span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          {isUp ? <TrendingUp size={9} color="#34d399" /> : <TrendingDown size={9} color="#ef4444" />}
          <span style={{ fontSize: '9.5px', fontWeight: 600, color: isUp ? '#34d399' : '#ef4444', fontFamily: 'var(--font-mono)' }}>
            {(isUp ? '+' : '') + fmt(pct)}%
          </span>
        </div>
      </div>
    </div>
  );
}

function DetailPanel({ q, onClose }: { q: StockQuote; onClose: () => void }) {
  const isUp = q.regularMarketChangePercent >= 0;
  const handleInsert = () => {
    const now = new Date().toLocaleString('ko-KR');
    const md = [
      '### 📊 ' + (q.shortName || q.symbol) + ' (' + q.symbol + ') 시세 스냅샷',
      '> 기준: ' + now,
      '',
      '| 항목 | 값 |',
      '|------|------|',
      '| 현재가 | **' + fmt(q.regularMarketPrice) + ' ' + q.currency + '** |',
      '| 등락 | ' + (isUp ? '▲' : '▼') + ' ' + fmt(Math.abs(q.regularMarketChange || 0)) + ' (' + (isUp ? '+' : '') + fmt(q.regularMarketChangePercent || 0) + '%) |',
      '| 시가 | ' + fmt(q.regularMarketOpen) + ' |',
      '| 고가 | ' + fmt(q.regularMarketDayHigh) + ' |',
      '| 저가 | ' + fmt(q.regularMarketDayLow) + ' |',
      '| 거래량 | ' + fmtVol(q.regularMarketVolume) + ' |',
      '| 시가총액 | ' + fmtCap(q.marketCap) + ' |',
      q.trailingPE ? '| PER | ' + fmt(q.trailingPE) + ' |' : null,
      '| 52주 범위 | ' + fmt(q.fiftyTwoWeekLow) + ' ~ ' + fmt(q.fiftyTwoWeekHigh) + ' |',
    ].filter(Boolean).join('\n');
    window.dispatchEvent(new CustomEvent('ameva:insert-text', { detail: md }));
  };

  const rows = [
    ['시가', fmt(q.regularMarketOpen)], ['고가', fmt(q.regularMarketDayHigh)],
    ['저가', fmt(q.regularMarketDayLow)], ['거래량', fmtVol(q.regularMarketVolume)],
    ['시가총액', fmtCap(q.marketCap)], ['PER', q.trailingPE ? fmt(q.trailingPE) : '-'],
    ['52주 고가', fmt(q.fiftyTwoWeekHigh)], ['52주 저가', fmt(q.fiftyTwoWeekLow)],
  ];

  return (
    <div style={{ margin: '0 0 6px', padding: '10px', borderRadius: '8px', background: 'var(--bg-glass)', border: '1px solid ' + (isUp ? 'rgba(52,211,153,0.25)' : 'rgba(239,68,68,0.25)') }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-main)' }}>{(q.shortName || q.symbol) + ' 상세'}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}>
          <X size={13} />
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 12px', marginBottom: '10px' }}>
        {rows.map(([label, value]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ color: 'var(--text-muted)' }}>{label}</span>
            <span style={{ color: 'var(--text-main)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{value}</span>
          </div>
        ))}
      </div>
      <button
        onClick={handleInsert}
        style={{ width: '100%', padding: '6px', borderRadius: '6px', cursor: 'pointer', background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)', color: 'var(--primary)', fontSize: '10px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', transition: 'background 0.15s' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(139,92,246,0.22)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(139,92,246,0.12)')}
      >
        <FileText size={11} /> 본문에 시세 삽입 (마크다운 표)
      </button>
    </div>
  );
}

export function FinanceDashboardView() {
  const [indexQ, setIndexQ] = useState<StockQuote[]>([]);
  const [fxQ, setFxQ] = useState<StockQuote[]>([]);
  const [bondQ, setBondQ] = useState<StockQuote | null>(null);
  const [stockQ, setStockQ] = useState<StockQuote[]>([]);
  const [symbols, setSymbols] = useState<string[]>(DEFAULT_STOCK_SYMBOLS);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState('');
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const all = await fetchQuotesBatch([...INDEX_SYMBOLS, ...FX_SYMBOLS, '^TNX', ...symbols]);
      setIndexQ(all.filter(q => INDEX_SYMBOLS.includes(q.symbol)));
      setFxQ(all.filter(q => FX_SYMBOLS.includes(q.symbol)));
      setBondQ(all.find(q => q.symbol === '^TNX') || null);
      setStockQ(all.filter(q => symbols.includes(q.symbol)));
      setLastUpdated(new Date().toLocaleTimeString('ko-KR'));
    } catch (e) {
      setError('시세 데이터를 불러오지 못했습니다. 네트워크를 확인하세요.');
      console.error('[FinanceDashboard] fetch 실패:', e);
    } finally {
      setIsLoading(false);
    }
  }, [symbols]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const sym = searchQuery.toUpperCase().trim();
    if (sym && !symbols.includes(sym)) { setSymbols(p => [...p, sym]); setSearchQuery(''); }
  };

  const skel = (n: number) => [...Array(n)].map((_, i) => (
    <div key={i} style={{ height: '32px', borderRadius: '7px', background: 'var(--bg-glass)', marginBottom: '3px', opacity: 0.45 }} />
  ));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-main)', overflow: 'hidden' }}>
      <div style={{ padding: '10px 12px 6px', borderBottom: '1px solid var(--border-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <TrendingUp size={13} color="#34d399" />
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-main)' }}>글로벌 금융 대시보드</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {lastUpdated && <span style={{ fontSize: '8.5px', color: 'var(--text-muted)' }}>{lastUpdated} 갱신</span>}
          <button onClick={refresh} disabled={isLoading} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', display: 'flex' }} title="새로고침">
            <RefreshCw size={12} style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      <div className="finance-scroll" style={{ flex: 1, overflowY: 'auto', padding: '10px 12px' }}>
        {error && <div style={{ padding: '8px 10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', fontSize: '10px', color: '#ef4444', marginBottom: '8px' }}>⚠️ {error}</div>}

        <SectionTitle label="세계 주요 지수" icon="🌐" />
        {isLoading && indexQ.length === 0 ? skel(6) : indexQ.map(q => (
          <QuoteRow key={q.symbol} symbol={q.symbol} label={INDEX_LABELS[q.symbol] || q.symbol} price={q.regularMarketPrice} pct={q.regularMarketChangePercent} currency={q.currency} isUp={q.regularMarketChangePercent >= 0} />
        ))}

        <div style={{ marginTop: '12px' }}>
          <SectionTitle label="주요 환율" icon="💱" />
          {isLoading && fxQ.length === 0 ? skel(4) : fxQ.map(q => (
            <QuoteRow key={q.symbol} symbol={q.symbol} label={FX_LABELS[q.symbol] || q.symbol} price={q.regularMarketPrice} pct={q.regularMarketChangePercent} isUp={q.regularMarketChangePercent >= 0} />
          ))}
        </div>

        <div style={{ marginTop: '12px' }}>
          <SectionTitle label="주요 금리" icon="📊" />
          {bondQ && (
            <QuoteRow symbol="^TNX" label="미 10Y 국채 수익률" price={bondQ.regularMarketPrice} pct={bondQ.regularMarketChangePercent} currency="%" isUp={bondQ.regularMarketChangePercent >= 0} />
          )}
          {INTEREST_RATES.map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 8px', borderRadius: '7px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '3px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-main)' }}>{r.label}</span>
                <span style={{ fontSize: '8.5px', color: 'var(--text-muted)' }}>{r.note}</span>
              </div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#facc15', fontFamily: 'var(--font-mono)' }}>{r.value}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: '12px' }}>
          <SectionTitle label="관심 종목" icon="🔍" />
          <form onSubmit={handleAdd} style={{ display: 'flex', gap: '5px', marginBottom: '8px' }}>
            <input
              type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="심볼 추가 (예: AMZN, 035720.KS)"
              style={{ flex: 1, padding: '5px 8px', borderRadius: '5px', background: 'var(--bg-glass)', border: '1px solid var(--border-muted)', color: 'var(--text-main)', fontSize: '10.5px', outline: 'none' }}
            />
            <button type="submit" style={{ padding: '5px 8px', borderRadius: '5px', cursor: 'pointer', background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)', color: '#34d399', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Search size={10} /> 추가
            </button>
          </form>

          {stockQ.map(q => {
            const isUp = q.regularMarketChangePercent >= 0;
            const isExpanded = expandedSymbol === q.symbol;
            return (
              <div key={q.symbol}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <div style={{ flex: 1 }}>
                    <QuoteRow
                      symbol={q.symbol} label={q.shortName || q.symbol}
                      price={q.regularMarketPrice} pct={q.regularMarketChangePercent}
                      currency={q.currency} isUp={isUp}
                      onClick={() => setExpandedSymbol(p => p === q.symbol ? null : q.symbol)}
                      isActive={isExpanded}
                    />
                  </div>
                  <button onClick={() => setExpandedSymbol(p => p === q.symbol ? null : q.symbol)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', display: 'flex' }} title={isExpanded ? '접기' : '상세 보기'}>
                    {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                  <button onClick={() => { setSymbols(p => p.filter(s => s !== q.symbol)); if (expandedSymbol === q.symbol) setExpandedSymbol(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', display: 'flex' }} title="제거">
                    <X size={11} />
                  </button>
                </div>
                {isExpanded && <DetailPanel q={q} onClose={() => setExpandedSymbol(null)} />}
              </div>
            );
          })}

          {stockQ.length === 0 && !isLoading && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '10px', padding: '16px' }}>위에서 종목 코드를 추가하세요.</div>
          )}
        </div>
        <div style={{ height: '20px' }} />
      </div>
    </div>
  );
}
