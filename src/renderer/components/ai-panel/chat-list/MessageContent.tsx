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
    if (onInsert) {
      onInsert(code, 'insert', undefined, true, lang);
    }
  };

  const meta = getChatLangMeta(lang);
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

  // 🦾 [MCP-Visual-WOW] "✔ **MCP 데이터 연동 완료**" 패턴 존재 시 시각적으로 돋보이는 초록색 연동 알림 카드를 그립니다.
  // AI가 시스템(호스트/터미널/DB)과 연동하여 특수 동작을 수행했을 때 사용자에게 명확한 피드백을 주기 위함입니다.
  if (content.includes("✔ **MCP 데이터 연동 완료**") || content.includes("✔ MCP 데이터 연동 완료")) {
    const lines = content.split('\n');
    const title = "✔ MCP 데이터 연동 완료";
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
  const parts = content.split('```');
  
  return parts.map((part, idx) => {
    // 짝수 번째 인덱스는 코드 블록 바깥의 일반 텍스트 영역을 의미합니다.
    if (idx % 2 === 0) {
      if (!part) return null;
      return <span key={idx}>{part}</span>;
    }

    // 홀수 번째 인덱스는 fenced code block 내부 영역을 의미합니다.
    // 첫 번째 개행 문자를 찾아 언어 식별자(lang)와 실제 코드 본문(code)을 분리합니다.
    const firstLineEnd = part.indexOf('\n');
    let lang = 'code';
    let code = part;
    
    if (firstLineEnd !== -1) {
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
