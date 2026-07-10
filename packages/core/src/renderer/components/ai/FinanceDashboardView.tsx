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

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TrendingUp, TrendingDown, RefreshCw, Search, X, ChevronDown, ChevronUp, FileText, Eye } from 'lucide-react';
import { STOCK_MOCK_NEWS, DEFAULT_MOCK_NEWS } from './constants';

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

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `INDEX_SYMBOLS`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const INDEX_SYMBOLS = ...` 형태로 안전 캐싱 후 가공 기동.
       */
const INDEX_SYMBOLS = ['^GSPC', '^IXIC', '^KS11', '^N225', '^HSI', '^GDAXI'];
const INDEX_LABELS: Record<string, string> = {
  '^GSPC': 'S&P 500', '^IXIC': 'NASDAQ', '^KS11': 'KOSPI',
  '^N225': '닛케이 225', '^HSI': '항셍', '^GDAXI': 'DAX',
};
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `FX_SYMBOLS`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const FX_SYMBOLS = ...` 형태로 안전 캐싱 후 가공 기동.
       */
const FX_SYMBOLS = ['USDKRW=X', 'EURKRW=X', 'JPYKRW=X', 'CNYKRW=X'];
const FX_LABELS: Record<string, string> = {
  'USDKRW=X': 'USD / KRW', 'EURKRW=X': 'EUR / KRW',
  'JPYKRW=X': 'JPY / KRW', 'CNYKRW=X': 'CNY / KRW',
};
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `INTEREST_RATES`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const INTEREST_RATES = ...` 형태로 안전 캐싱 후 가공 기동.
       */
const INTEREST_RATES = [
  { label: '미국 기준금리', value: '5.25~5.50%', note: 'Fed · 2024' },
  { label: '한국 기준금리', value: '3.50%', note: 'BOK · 2024' },
];
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `DEFAULT_STOCK_SYMBOLS`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const DEFAULT_STOCK_SYMBOLS = ...` 형태로 안전 캐싱 후 가공 기동.
       */
const DEFAULT_STOCK_SYMBOLS = ['AAPL', 'NVDA', 'TSLA', 'MSFT', '005930.KS'];
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `AUTO_REFRESH_MS`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const AUTO_REFRESH_MS = ...` 형태로 안전 캐싱 후 가공 기동.
       */
const AUTO_REFRESH_MS = 60000;

async function fetchQuotesBatch(symbols: string[]): Promise<StockQuote[]> {
  /*
   * [FIX-FINANCE-IPC] 렌더러의 fetch -> 메인 프로세스 IPC 위임으로 전환.
   * - 기존: 렌더러에서 query2.finance.yahoo.com 직접 fetch -> CORS/Cookie 차단으로 403 발생.
   * - 변경: window.electronAPI.getFinanceQuotes() IPC 채널을 통해 메인 프로세스가 Node.js fetch로 대신 조회.
   *
   * [FIX-FINANCE-FALLBACK-002] IPC 실패 시 마켓플레이스 서버(3010) 프록시로 3단계 폴백 체인 구성.
   * - 1단계: Electron IPC getFinanceQuotes (메인 프로세스 Node.js fetch — Yahoo v7)
   * - 2단계: 마켓플레이스 서버 /api/finance/stock-detail 프록시 (Yahoo v8 기반 — 더 안정적)
   * - 3단계: 렌더러 직접 fetch (비 Electron 환경 최후 폴백)
   */

  // 1단계: Electron IPC 채널을 통한 메인 프로세스 조회
  try {
    const api = (window as Window & { electronAPI?: { getFinanceQuotes?: (symbols: string[]) => Promise<{ success: boolean; result: StockQuote[]; error?: string }> } }).electronAPI
    if (api?.getFinanceQuotes) {
      const res = await api.getFinanceQuotes(symbols)
      if (res.success && res.result.length > 0) return res.result
      console.warn('[FinanceDashboard] IPC 결과 없음 또는 실패 — 마켓플레이스 서버로 폴백:', res.error)
    }
  } catch (ipcErr) {
    console.error('[FinanceDashboard] IPC 채널 오류:', ipcErr)
  }

  // 2단계: 마켓플레이스 서버 v8 기반 프록시 (심볼별 병렬 요청)
  // [ADAPTER-FINANCE-002] 마켓플레이스 서버 응답({ ticker, name, price, changePercent })을
  // StockQuote 인터페이스({ symbol, shortName, regularMarketPrice, ... })로 변환한다.
  try {
    const marketplaceResults = await Promise.allSettled(
      symbols.map(async (sym) => {
        const res = await fetch(
          `http://localhost:3010/api/finance/stock-detail?ticker=${encodeURIComponent(sym)}`,
          { signal: AbortSignal.timeout(6000) }
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json() as { success: boolean; stock?: { ticker: string; name: string; price: number; changePercent: number } }
        if (!json.success || !json.stock) throw new Error('No data')
        const s = json.stock
        return {
          symbol: s.ticker,
          shortName: s.name,
          regularMarketPrice: s.price,
          regularMarketChangePercent: s.changePercent,
          regularMarketChange: 0,
          currency: (sym.endsWith('.KS') || sym.endsWith('.KQ')) ? 'KRW' : 'USD',
        } as StockQuote
      })
    )
    const settled = marketplaceResults
      .filter((r): r is PromiseFulfilledResult<StockQuote> => r.status === 'fulfilled')
      .map(r => r.value)
    if (settled.length > 0) return settled
    console.warn('[FinanceDashboard] 마켓플레이스 서버도 결과 없음 — 직접 fetch 시도')
  } catch (mktErr) {
    console.error('[FinanceDashboard] 마켓플레이스 서버 프록시 실패:', mktErr)
  }

  // 3단계: 비 Electron 환경 또는 최후 폴백 — 렌더러 직접 fetch
  try {
    const fields = 'shortName,regularMarketPrice,regularMarketChangePercent,regularMarketChange,currency,marketCap,trailingPE,fiftyTwoWeekLow,fiftyTwoWeekHigh,regularMarketVolume,regularMarketOpen,regularMarketDayHigh,regularMarketDayLow'
    const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(',')}&fields=${fields}`
    const res2 = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) })
    if (!res2.ok) throw new Error('HTTP ' + res2.status)
    const data = await res2.json() as { quoteResponse?: { result?: StockQuote[] } }
    return data?.quoteResponse?.result || []
  } catch (e) {
    console.error('[FinanceDashboard] 직접 fetch 폴백도 실패:', e)
    return []
  }
}

const fmt = (n?: number, d = 2) => n != null && !isNaN(n) ? n.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '-';
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `fmtVol`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const fmtVol = ...` 형태로 안전 캐싱 후 가공 기동.
       */
const fmtVol = (n?: number) => !n ? '-' : n >= 1e9 ? (n/1e9).toFixed(1) + 'B' : n >= 1e6 ? (n/1e6).toFixed(1) + 'M' : n >= 1e3 ? (n/1e3).toFixed(1) + 'K' : String(n);
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `fmtCap`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const fmtCap = ...` 형태로 안전 캐싱 후 가공 기동.
       */
const fmtCap = (n?: number) => !n ? '-' : n >= 1e12 ? '$' + (n/1e12).toFixed(2) + 'T' : n >= 1e9 ? '$' + (n/1e9).toFixed(1) + 'B' : '$' + (n/1e6).toFixed(0) + 'M';

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `SectionTitle`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `SectionTitle(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
function SectionTitle({ label, icon }: { label: string; icon: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 0 4px', marginBottom: '4px', borderBottom: '1px solid var(--border-muted)' }}>
      <span style={{ fontSize: '10px' }}>{icon}</span>
      <span style={{ fontSize: '9.5px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
    </div>
  );
}

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `QuoteRow`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `QuoteRow(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
function QuoteRow({ symbol, label, price, pct, currency = '', isUp, onClick, isActive, onContextMenu }: {
  symbol: string; label: string; price: number; pct: number
  currency?: string; isUp: boolean; onClick?: () => void; isActive?: boolean; onContextMenu?: (e: React.MouseEvent) => void
}) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `bg`
       * - 자료형 / 예상 값: 활성 여부 및 등락 상태에 따른 동적 배경색 값.
       */
  const bg = isActive
    ? (isUp ? 'rgba(52,211,153,0.12)' : 'rgba(239,68,68,0.12)')
    : (isUp ? 'rgba(52,211,153,0.03)' : 'rgba(239,68,68,0.03)');

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `border`
       * - 자료형 / 예상 값: 활성 여부 및 등락 상태에 따른 동적 테두리 색상 값.
       */
  const border = isActive
    ? (isUp ? 'rgba(52,211,153,0.4)' : 'rgba(239,68,68,0.4)')
    : (isUp ? 'rgba(52,211,153,0.08)' : 'rgba(239,68,68,0.08)');

  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', borderRadius: '7px', background: bg, border: '1px solid ' + border, cursor: (onClick || onContextMenu) ? 'pointer' : 'default', transition: 'background 0.12s', marginBottom: '3px' }}
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

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `DetailPanel`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `DetailPanel(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
function DetailPanel({ q, onClose }: { q: StockQuote; onClose: () => void }) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `isUp`
       * - 자료형 / 예상 값: q.regularMarketChangePercent가 0 이상인지 판단한 boolean 값.
       * - 시나리오: 본 패널의 색상 테마 및 화살표 방향 결정에 소비됨.
       */
  const isUp = q.regularMarketChangePercent >= 0;

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `newsList`
       * - 자료형 / 예상 값: STOCK_MOCK_NEWS 맵에서 찾은 해당 심볼의 뉴스 목록 또는 기본 default 뉴스 목록.
       * - 시나리오: 하단 뉴스 리스트 렌더링에 반복적으로 맵핑되어 노출됨.
       */
  const newsList = STOCK_MOCK_NEWS[q.symbol] || DEFAULT_MOCK_NEWS;

      /*
       * [FUNCTION CONTRACT]
       * - 함수 명: `handleInsert`
       * - 역할: 현재가, 고가, 거래량 등 시세 정보를 마크다운 표로 만들어 에디터에 삽입한다.
       */
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

      /*
       * [FUNCTION CONTRACT]
       * - 함수 명: `handleInsertNews`
       * - 역할: 선택한 뉴스의 헤드라인과 요약을 인용구 형식 마크다운으로 에디터에 전파한다.
       */
  const handleInsertNews = (news: typeof newsList[0]) => {
    const md = [
      `### 📰 [뉴스] ${news.title}`,
      `> 출처: ${news.source} · 스크랩 시점: ${new Date().toLocaleString('ko-KR')}`,
      `>`,
      `> ${news.summary}`,
      `>`,
      `> *본 뉴스 정보는 금융 탭에서 본문으로 스크랩되었습니다.*`
    ].join('\n');
    window.dispatchEvent(new CustomEvent('ameva:insert-text', { detail: md }));
  };

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `rows`
       * - 자료형 / 예상 값: 라벨과 가공된 포맷 가격의 튜플 쌍 2차원 배열.
       * - 시나리오: 상세 지표 테이블 렌더링에 반복적으로 소비됨.
       */
  const rows = [
    ['시가', fmt(q.regularMarketOpen)], ['고가', fmt(q.regularMarketDayHigh)],
    ['저가', fmt(q.regularMarketDayLow)], ['거래량', fmtVol(q.regularMarketVolume)],
    ['시가총액', fmtCap(q.marketCap)], ['PER', q.trailingPE ? fmt(q.trailingPE) : '-'],
    ['52주 고가', fmt(q.fiftyTwoWeekHigh)], ['52주 저가', fmt(q.fiftyTwoWeekLow)],
  ];

  return (
    <div 
      style={{ 
        margin: '0 0 6px', padding: '10px', borderRadius: '8px', 
        background: 'var(--bg-glass, rgba(15, 15, 20, 0.4))', 
        border: '1px solid ' + (isUp ? 'rgba(52,211,153,0.25)' : 'rgba(239,68,68,0.25)'),
        animation: 'financeAccordionOpen 0.25s ease-out forwards',
        overflow: 'hidden'
      }}
    >
      <style>{`
        @keyframes financeAccordionOpen {
          from { max-height: 0; opacity: 0; transform: translateY(-5px); }
          to { max-height: 1200px; opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-main)' }}>{(q.shortName || q.symbol) + ' 상세 정보'}</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex' }}>
          <X size={13} />
        </button>
      </div>
      
      {/* 상세 수치 그리드 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 12px', marginBottom: '10px' }}>
        {rows.map(([label, value]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ color: 'var(--text-muted)' }}>{label}</span>
            <span style={{ color: 'var(--text-main)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{value}</span>
          </div>
        ))}
      </div>

      {/* 시세 표 삽입 버튼 */}
      <button
        onClick={handleInsert}
        style={{ width: '100%', padding: '6px', borderRadius: '6px', cursor: 'pointer', background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)', color: 'var(--primary)', fontSize: '10px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', transition: 'background 0.15s', marginBottom: '10px' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(139,92,246,0.22)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(139,92,246,0.12)')}
      >
        <FileText size={11} /> 본문에 시세 삽입 (마크다운 표)
      </button>

      {/* 실시간 종목 뉴스 목록 섹션 */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px' }}>
        <span style={{ fontSize: '9.5px', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
          📰 실시간 종목 뉴스 (클릭 시 본문 스크랩)
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {newsList.map(n => (
            <div
              key={n.id}
              onClick={() => handleInsertNews(n)}
              style={{
                padding: '6px 8px', borderRadius: '6px', background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer', transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(139,92,246,0.06)';
                e.currentTarget.style.borderColor = 'rgba(139,92,246,0.2)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)';
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>{n.title}</span>
                <span style={{ fontSize: '8px', color: 'var(--text-muted)' }}>{n.time}</span>
              </div>
              <p style={{ fontSize: '8.5px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.3, textOverflow: 'ellipsis', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {n.summary}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '3px' }}>
                <span style={{ fontSize: '7.5px', color: 'var(--primary)' }}>{n.source}</span>
                <span style={{ fontSize: '7.5px', color: 'var(--text-muted)', opacity: 0.6 }}>스크랩하기 →</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `FinanceDashboardView`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `FinanceDashboardView(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
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

  /*
   * [RUN-TIME STATE / INVARIANT]
   * - 변수 명: `contextMenu`
   * - 자료형 / 예상 값: 우클릭 마우스 좌표 및 대상 종목 쿼리를 포함한 Object 또는 null.
   * - 시나리오: 커스텀 우클릭 팝업 창의 노출 조율에 소비됨.
   */
  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; symbol: string; q: StockQuote
  } | null>(null);

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `handleContextMenu`
   * - 역할: 주식 항목 우클릭 이벤트를 차단하고 해당 마우스 좌표에 컨텍스트 메뉴 데이터를 수립한다.
   */
  const handleContextMenu = useCallback((e: React.MouseEvent, symbol: string, q: StockQuote) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, symbol, q });
  }, []);

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `handleInsertDirect`
   * - 역할: 우클릭 메뉴 액션 트리거 시, 디테일 패널 개방 없이 바로 해당 시세 정보를 마크다운 표로 에디터에 삽입한다.
   */
  const handleInsertDirect = (q: StockQuote) => {
    const isUp = q.regularMarketChangePercent >= 0;
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

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `refresh`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const refresh = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `all`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const all = ...` 형태로 안전 캐싱 후 가공 기동.
       */
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
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `id`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const id = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const id = setInterval(refresh, AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [refresh]);

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `handleAdd`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const handleAdd = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `sym`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const sym = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const sym = searchQuery.toUpperCase().trim();
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `sym && !symbols.includes(sym)) { setSymbols(p => [...p, sym]); setSearchQuery(''`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (sym && !symbols.includes(sym)) { setSymbols(p => [...p, sym]); setSearchQuery('')` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (sym && !symbols.includes(sym)) { setSymbols(p => [...p, sym]); setSearchQuery(''); }
  };

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `skel`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const skel = ...` 형태로 안전 캐싱 후 가공 기동.
       */
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
          <QuoteRow key={q.symbol} symbol={q.symbol} label={INDEX_LABELS[q.symbol] || q.symbol} price={q.regularMarketPrice} pct={q.regularMarketChangePercent} currency={q.currency} isUp={q.regularMarketChangePercent >= 0} onContextMenu={(e) => handleContextMenu(e, q.symbol, q)} />
        ))}
 
        <div style={{ marginTop: '12px' }}>
          <SectionTitle label="주요 환율" icon="💱" />
          {isLoading && fxQ.length === 0 ? skel(4) : fxQ.map(q => (
            <QuoteRow key={q.symbol} symbol={q.symbol} label={FX_LABELS[q.symbol] || q.symbol} price={q.regularMarketPrice} pct={q.regularMarketChangePercent} isUp={q.regularMarketChangePercent >= 0} onContextMenu={(e) => handleContextMenu(e, q.symbol, q)} />
          ))}
        </div>
 
        <div style={{ marginTop: '12px' }}>
          <SectionTitle label="주요 금리" icon="📊" />
          {bondQ && (
            <QuoteRow symbol="^TNX" label="미 10Y 국채 수익률" price={bondQ.regularMarketPrice} pct={bondQ.regularMarketChangePercent} currency="%" isUp={bondQ.regularMarketChangePercent >= 0} onContextMenu={(e) => handleContextMenu(e, bondQ.symbol, bondQ)} />
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
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `isUp`
       * - 자료형 / 예상 값: 등락 여부 boolean.
       */
            const isUp = q.regularMarketChangePercent >= 0;
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `isExpanded`
       * - 자료형 / 예상 값: 아코디언 확장 상태 boolean.
       */
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
                      onContextMenu={(e) => handleContextMenu(e, q.symbol, q)}
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

      {/* 우클릭 사제 컨텍스트 메뉴 팝업 */}
      {contextMenu && (
        <StockContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          symbol={contextMenu.symbol}
          onInsert={() => handleInsertDirect(contextMenu.q)}
          onDetail={() => setExpandedSymbol(contextMenu.symbol)}
          onDismiss={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

interface StockContextMenuProps {
  x: number;
  y: number;
  symbol: string;
  onInsert: () => void;
  onDetail: () => void;
  onDismiss: () => void;
}

/*
 * [FUNCTION CONTRACT]
 * - 함수 명: `StockContextMenu`
 * - 역할: 주식 항목 우클릭 시 호출되며 [본문에 넣기, 자세히 보기] 기능을 제안하는 컨텍스트 윈도우를 띄운다.
 */
function StockContextMenu({ x, y, symbol, onInsert, onDetail, onDismiss }: StockContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const safeX = Math.min(x, window.innerWidth - 160);
  const safeY = Math.min(y, window.innerHeight - 100);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    };
    const id = setTimeout(() => window.addEventListener('mousedown', handler), 10);
    return () => {
      clearTimeout(id);
      window.removeEventListener('mousedown', handler);
    };
  }, [onDismiss]);

  const btnStyle: React.CSSProperties = {
    background: 'transparent', border: 'none', color: 'var(--text-main)',
    padding: '8px 12px', textAlign: 'left', cursor: 'pointer',
    fontSize: '11px', borderRadius: '4px', width: '100%',
    display: 'flex', alignItems: 'center', gap: '8px',
    transition: 'background 0.12s',
  };

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed', top: safeY, left: safeX,
        background: 'var(--bg-glass, rgba(15, 15, 20, 0.85))',
        border: '1px solid var(--border-muted, rgba(255,255,255,0.1))',
        borderRadius: '8px', padding: '4px', display: 'flex', flexDirection: 'column',
        zIndex: 99999, boxShadow: '0 8px 32px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.08)',
        fontFamily: 'var(--font-sans)', minWidth: '150px', backdropFilter: 'blur(12px)',
      }}
    >
      <div style={{ padding: '4px 10px 6px', borderBottom: '1px solid var(--border-muted, rgba(255,255,255,0.1))', marginBottom: '2px' }}>
        <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', fontWeight: 600 }}>{symbol} 작업</span>
      </div>

      <button
        style={btnStyle}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-glass-active, rgba(255,255,255,0.1))')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        onClick={() => { onInsert(); onDismiss(); }}
      >
        <FileText size={12} style={{ color: 'var(--primary)' }} />
        본문에 시세 넣기
      </button>

      <button
        style={btnStyle}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-glass-active, rgba(255,255,255,0.1))')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        onClick={() => { onDetail(); onDismiss(); }}
      >
        <Eye size={12} style={{ color: '#34d399' }} />
        자세히 보기 (뉴스)
      </button>
    </div>
  );
}

