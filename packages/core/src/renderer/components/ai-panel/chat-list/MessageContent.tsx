/**
 * @file MessageContent.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/ai-panel/chat-list/MessageContent.tsx
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

import React from 'react';

/**
 * LangMeta 인터페이스
 * 코드 블록의 문법 강조(Syntax Highlighting) 및 UI 스타일링을 위한 메타데이터 구조입니다.
 */
interface LangMeta {
  color: string;
  label: string;
}

/**
 * CHAT_LANG_META
 * 지원하는 프로그래밍 언어별 테마 색상과 표시 레이블을 정의한 상수 맵입니다.
 * 하드코딩을 방지하고 일관된 디자인 시스템을 유지하기 위해 사용됩니다.
 */
const CHAT_LANG_META: Record<string, LangMeta> = {
  javascript: { color: '#f59e0b', label: 'JavaScript' },
  js:         { color: '#f59e0b', label: 'JavaScript' },
  typescript: { color: '#60a5fa', label: 'TypeScript' },
  ts:         { color: '#60a5fa', label: 'TypeScript' },
  python:     { color: '#3b82f6', label: 'Python' },
  py:         { color: '#3b82f6', label: 'Python' },
  html:       { color: '#f97316', label: 'HTML' },
  css:        { color: '#a78bfa', label: 'CSS' },
  mermaid:    { color: '#8b5cf6', label: 'Mermaid' },
  markdown:   { color: '#34d399', label: 'Markdown' },
  json:       { color: '#34d399', label: 'JSON' },
  xml:        { color: '#fb923c', label: 'XML' },
  sql:        { color: '#e879f9', label: 'SQL' },
  bash:       { color: '#94a3b8', label: 'Bash' },
  sh:         { color: '#94a3b8', label: 'Shell' },
  c:          { color: '#10b981', label: 'C' },
  cpp:        { color: '#10b981', label: 'C++' },
  java:       { color: '#f43f5e', label: 'Java' },
  text:       { color: '#6b7280', label: 'Text' },
  plaintext:  { color: '#6b7280', label: 'Text' },
};

/**
 * getChatLangMeta 함수
 * 입력된 언어 식별자(lang)에 해당하는 메타데이터를 반환합니다.
 * 매핑되지 않은 언어의 경우 기본 회색 테마와 입력된 식별자 원본을 폴백으로 제공합니다.
 */
function getChatLangMeta(lang: string): LangMeta {
  return CHAT_LANG_META[lang.toLowerCase()] ?? {
    color: '#6b7280', label: lang
  };
}

/**
 * MessageCodeBlockProps 인터페이스
 * 개별 코드 블록 컴포넌트의 프로퍼티 스키마입니다.
 * onInsert 콜백은 코드 내용을 에디터 본문으로 즉각 삽입하는 이벤트를 상위로 위임합니다.
 */
interface MessageCodeBlockProps {
  lang: string;
  code: string;
  onInsert?: (text: string, mode: 'replace' | 'insert', blockId?: string, isCodeBlock?: boolean, lang?: string) => void;
}

/**
 * MessageCodeBlock 컴포넌트
 * 챗봇 답변 내 마크다운 코드 블록(```)을 시각적으로 렌더링하는 UI 컴포넌트입니다.
 * 클립보드 복사 기능 및 에디터 본문 다이렉트 삽입 기능을 내장하고 있습니다.
 */
export function MessageCodeBlock({ lang, code, onInsert }: MessageCodeBlockProps) {
  const [copied, setCopied] = React.useState(false);

  /**
   * 클립보드 복사 핸들러
   * 브라우저의 navigator.clipboard API를 사용하여 텍스트를 복사하고, 성공 시 시각적 피드백(1.5초 유지)을 제공합니다.
   */
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  /**
   * 에디터 삽입 핸들러
   * 부모 컴포넌트에서 주입된 onInsert 콜백을 호출하여 이 코드를 새로운 Jupyter 블록 등으로 본문에 삽입합니다.
   */
  const handleInsert = () => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `onInsert`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (onInsert)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (onInsert) {
      onInsert(code, 'insert', undefined, true, lang);
    }
  };

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `meta`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const meta = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const meta = getChatLangMeta(lang);
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `accentColor`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const accentColor = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const accentColor = meta.color;

  return (
    <div style={{
      margin: '14px 0',
      borderRadius: '10px',
      border: `1.5px solid ${accentColor}33`,
      background: 'rgba(10,12,20,0.85)',
      overflow: 'hidden',
      boxShadow: `0 4px 24px rgba(0,0,0,0.4), 0 0 0 1px ${accentColor}22`,
      fontFamily: '"JetBrains Mono","Fira Code","Cascadia Code",monospace',
      textAlign: 'left',
      position: 'relative',
    }}>
      {/* ── 헤더 바: 언어 배지 및 액션 버튼 ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '7px 12px', background: `linear-gradient(90deg, ${accentColor}22 0%, transparent 100%)`,
        borderBottom: `1px solid ${accentColor}33`, userSelect: 'none',
      }}>
        {/* 언어 라벨 배지 */}
        <div style={{
          fontSize: '10px', fontWeight: 800, padding: '3px 8px', borderRadius: '4px',
          background: `${accentColor}22`, color: accentColor, border: `1px solid ${accentColor}44`,
          textTransform: 'uppercase', letterSpacing: '0.5px'
        }}>
          ● {meta.label}
        </div>
        
        <div style={{ display: 'flex', gap: '6px' }}>
          {/* 클립보드 복사 버튼 */}
          <button
            onClick={handleCopy}
            style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '4px', padding: '3px 8px', color: copied ? '#10b981' : '#d1d5db',
              fontSize: '10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
              gap: '4px', transition: 'all 0.15s ease',
            }}
          >
            <span>{copied ? '✓ 복사됨' : '📋 복사'}</span>
          </button>
          
          {/* 본문 다이렉트 삽입 버튼 (onInsert가 주입되었을 때만 렌더링) */}
          {onInsert && (
            <button
              onClick={handleInsert}
              style={{
                background: accentColor, color: '#fff', border: 'none', borderRadius: '4px',
                padding: '3px 8px', fontSize: '10px', fontWeight: 700, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: '4px', boxShadow: `0 2px 8px ${accentColor}40`,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.15)'}
              onMouseLeave={e => e.currentTarget.style.filter = 'none'}
            >
              <span>📥 본문에 삽입</span>
            </button>
          )}
        </div>
      </div>
      
      {/* 코드 본문 (Syntax Highlighting은 향후 별도 라이브러리 적용 가능하도록 구조화) */}
      <pre style={{
        margin: '4px 0', padding: '12px', borderRadius: '6px',
        color: 'var(--term-text)', whiteSpace: 'pre', background: 'var(--term-bg)',
        overflowX: 'auto', border: '1px solid var(--term-border)'
      }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

/**
 * renderMessageContent 함수
 * AI의 응답 평문 문자열을 분석하여, 일반 텍스트, 코드 블록(```), 시스템 특수 알림(MCP 연동) 등을 쪼개어
 * React 노드 배열로 렌더링합니다.
 */
export function renderMessageContent(
  content: string, 
  onApplySuggestion?: (text: string, mode: 'replace' | 'insert', blockId?: string, isCodeBlock?: boolean, lang?: string) => void
) {
  // 방어 코드: 문자열이 비어있거나 유효하지 않으면 렌더링 생략
  if (!content) return null;

  // [UI-CLEANUP] [INSERT_SUGGESTION] 및 [EDIT_SUGGESTION] 내부 지시 태그를 화면 렌더링에서 제거
  const cleaned = content
    .replace(/\[INSERT_SUGGESTION:[^\]]*\]/gi, '')
    .replace(/\[EDIT_SUGGESTION:[^\]]*\]/gi, '')
    .trim();

      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!cleaned`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!cleaned)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
  if (!cleaned) return null;

  // 🦾 [MCP-Visual-WOW] "✔ **MCP 데이터 연동 완료**" 패턴 존재 시 시각적으로 돋보이는 초록색 연동 알림 카드를 그립니다.
  // AI가 시스템(호스트/터미널/DB)과 연동하여 특수 동작을 수행했을 때 사용자에게 명확한 피드백을 주기 위함입니다.
  if (cleaned.includes("✔ **MCP 데이터 연동 완료**") || cleaned.includes("✔ MCP 데이터 연동 완료")) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `lines`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const lines = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const lines = cleaned.split('\n');
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `title`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const title = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const title = "✔ MCP 데이터 연동 완료";
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `description`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const description = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const description = lines.filter(l => !l.includes("✔")).join('\n').trim();


    return (
      <div style={{
        marginTop: '6px', marginBottom: '6px', padding: '14px 16px',
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(5, 150, 105, 0.03))',
        border: '1.5px solid rgba(16, 185, 129, 0.25)', borderRadius: '10px',
        boxShadow: '0 4px 15px rgba(16, 185, 129, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative', overflow: 'hidden',
      }}>
        {/* 상단 번개 뱃지 (MCP LIVE 상태 표시) */}
        <div style={{
          position: 'absolute', top: '12px', right: '12px',
          background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff',
          fontSize: '9px', fontWeight: 800, padding: '2px 7px', borderRadius: '20px',
          display: 'flex', alignItems: 'center', gap: '3px', boxShadow: '0 2px 5px rgba(16, 185, 129, 0.3)'
        }}>
          <span>⚡</span>
          <span>MCP LIVE</span>
        </div>

        {/* 연동 타이틀 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px',
          fontWeight: 700, color: '#10b981', textShadow: '0 0 10px rgba(16, 185, 129, 0.15)'
        }}>
          <span>{title}</span>
        </div>

        {/* 세부 텍스트 설명 */}
        <div style={{
          fontSize: '12px', lineHeight: '1.6', color: 'var(--text-main)',
          opacity: 0.9, whiteSpace: 'pre-wrap', wordBreak: 'break-word'
        }}>
          {description}
        </div>
      </div>
    );
  }

  // 백틱 3개(```)를 구분자로 사용하여 원본 마크다운 텍스트를 배열로 파싱합니다.
  const parts = cleaned.split('```');
  
  return parts.map((part, idx) => {
    // 짝수 번째 인덱스는 코드 블록 바깥의 일반 텍스트 영역을 의미합니다.
    if (idx % 2 === 0) {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!part`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!part)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
      if (!part) return null;
      return <React.Fragment key={idx}>{parseTextToMarkdownJSX(part, String(idx))}</React.Fragment>;
    }

    // 홀수 번째 인덱스는 fenced code block 내부 영역을 의미합니다.
    // 첫 번째 개행 문자를 찾아 언어 식별자(lang)와 실제 코드 본문(code)을 분리합니다.
    const firstLineEnd = part.indexOf('\n');
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `lang`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const lang = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    let lang = 'code';
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `code`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const code = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    let code = part;
    
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `firstLineEnd !== -1`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (firstLineEnd !== -1)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (firstLineEnd !== -1) {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `maybeLang`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const maybeLang = ...` 형태로 안전 캐싱 후 가공 기동.
       */
      const maybeLang = part.substring(0, firstLineEnd).trim();
      // 언어 식별자가 비정상적으로 길거나, 띄어쓰기/괄호가 포함된 경우(일반 텍스트 오인)를 방어합니다.
      if (maybeLang && maybeLang.length < 15 && !maybeLang.includes(' ') && !maybeLang.includes('(')) {
        lang = maybeLang;
        code = part.substring(firstLineEnd + 1);
      }
    }

    // ```` 처럼 백틱이 4개 이상 찍혔을 때 끝단에 남은 백틱 찌꺼기를 정규식으로 안전하게 제거합니다.
    code = code.replace(/`+$/, '').trim();

    return (
      <MessageCodeBlock
        key={idx}
        lang={lang}
        code={code}
        onInsert={onApplySuggestion}
      />
    );
  });
}

/**
 * 일반 텍스트 내의 마크다운 요소(헤더, 리스트, 볼드, 인라인코드, 테이블)를 파싱하여 JSX 노드로 변환합니다.
 * 
 * [소비처 - CONSUMERS]
 * - renderMessageContent의 텍스트 토큰 파싱 분기에서 전용 헬퍼로 호출됨.
 */
function parseTextToMarkdownJSX(text: string, keyPrefix: string): React.ReactNode {
  const lines = text.split('\n');
  const renderedElements: React.ReactNode[] = [];
  
  let inTable = false;
  let tableRows: string[][] = [];
  
  // 테이블 파싱 및 렌더링 헬퍼
  const renderTable = (rows: string[][], tableKey: string) => {
    if (rows.length === 0) return null;
    
    // 구분선 제외 (:---, :---:, ---, |---| 등 구분 기호가 섞인 행 필터링)
    const cleanRows = rows.filter(row => {
      return !row.every(cell => {
        const c = cell.trim();
        return c === '' || /^[:\s-]*$/.test(c) || c.startsWith('-');
      });
    });
    if (cleanRows.length === 0) return null;
    
    // 첫 행은 헤더로 간주
    const headers = cleanRows[0];
    const dataRows = cleanRows.slice(1);
    
    return (
      <div key={tableKey} style={{
        overflowX: 'auto',
        margin: '12px 0',
        borderRadius: '8px',
        border: '1px solid var(--border-muted)',
        background: 'rgba(255, 255, 255, 0.02)'
      }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '11.5px',
          textAlign: 'left'
        }}>
          <thead>
            <tr style={{ background: 'rgba(255, 255, 255, 0.04)', borderBottom: '1px solid var(--border-muted)' }}>
              {headers.map((h, i) => (
                <th key={i} style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>{h.trim()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataRows.map((row, ri) => (
              <tr key={ri} style={{ borderBottom: ri === dataRows.length - 1 ? 'none' : '1px solid rgba(255, 255, 255, 0.04)' }}>
                {row.map((cell, ci) => (
                  <td key={ci} style={{ padding: '8px 12px', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                    {parseInlineMarkdown(cell.trim())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // 인라인 볼드/코드 치환용 헬퍼
  const parseInlineMarkdown = (str: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let currentStr = str;
    let idx = 0;
    
    while (currentStr.length > 0) {
      // 1. 볼드 매칭
      const boldMatch = currentStr.match(/\*\*([^*]+)\*\*/);
      // 2. 인라인 코드 매칭
      const codeMatch = currentStr.match(/`([^`]+)`/);
      
      const boldIndex = boldMatch?.index ?? -1;
      const codeIndex = codeMatch?.index ?? -1;
      
      if (boldIndex !== -1 && (codeIndex === -1 || boldIndex < codeIndex)) {
        const prefix = currentStr.substring(0, boldIndex);
        if (prefix) parts.push(prefix);
        
        parts.push(<strong key={`b-${idx++}`} style={{ color: 'var(--text-main)', fontWeight: 700 }}>{boldMatch![1]}</strong>);
        currentStr = currentStr.substring(boldIndex + boldMatch![0].length);
      } else if (codeIndex !== -1 && (boldIndex === -1 || codeIndex < boldIndex)) {
        const prefix = currentStr.substring(0, codeIndex);
        if (prefix) parts.push(prefix);
        
        parts.push(
          <code key={`c-${idx++}`} style={{
            background: 'rgba(255, 255, 255, 0.08)',
            padding: '2px 4px',
            borderRadius: '4px',
            fontFamily: 'monospace',
            color: 'var(--secondary)',
            fontSize: '11px',
            whiteSpace: 'nowrap',
            display: 'inline-block'
          }}>
            {codeMatch![1]}
          </code>
        );
        currentStr = currentStr.substring(codeIndex + codeMatch![0].length);
      } else {
        parts.push(currentStr);
        break;
      }
    }
    
    return <>{parts}</>;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // 테이블 라인 감지
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      inTable = true;
      const cells = trimmed.split('|').slice(1, -1);
      tableRows.push(cells);
      continue;
    } else if (inTable) {
      renderedElements.push(renderTable(tableRows, `${keyPrefix}-t-${i}`));
      tableRows = [];
      inTable = false;
    }
    
    // 헤더 처리 (H1 ~ H6)
    if (trimmed.startsWith('#')) {
      const match = trimmed.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2];
        const fontSize = level === 1 ? '16px' : level === 2 ? '15px' : level === 3 ? '14px' : '13px';
        const color = level === 3 ? 'var(--primary)' : 'var(--text-main)';
        renderedElements.push(
          <div key={`${keyPrefix}-h-${i}`} style={{
            fontSize,
            fontWeight: 800,
            marginTop: '14px',
            marginBottom: '6px',
            color,
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            {parseInlineMarkdown(text)}
          </div>
        );
        continue;
      }
    }
    
    // 리스트 처리
    if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
      const text = trimmed.substring(2);
      renderedElements.push(
        <div key={`${keyPrefix}-l-${i}`} style={{
          display: 'flex',
          gap: '6px',
          paddingLeft: '8px',
          margin: '4px 0',
          alignItems: 'flex-start',
          lineHeight: '1.5'
        }}>
          <span style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }}>•</span>
          <span style={{ flex: 1 }}>{parseInlineMarkdown(text)}</span>
        </div>
      );
      continue;
    }
    
    // 일반 빈 줄
    if (trimmed === '') {
      renderedElements.push(<div key={`${keyPrefix}-br-${i}`} style={{ height: '8px' }} />);
      continue;
    }
    
    // 일반 텍스트 라인
    renderedElements.push(
      <div key={`${keyPrefix}-p-${i}`} style={{ margin: '4px 0', lineHeight: '1.5' }}>
        {parseInlineMarkdown(line)}
      </div>
    );
  }
  
  if (inTable && tableRows.length > 0) {
    renderedElements.push(renderTable(tableRows, `${keyPrefix}-t-end`));
  }
  
  return <div style={{ display: 'flex', flexDirection: 'column' }}>{renderedElements}</div>;
}

