/**
 * @file InsertPreviewCard.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/features/ai-terminal/components/InsertPreviewCard.tsx
 * @role Core module helper and integration logic
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/App.tsx): AMEVA OS 최상위 마운트 레이어에서 의존성 로더로 연동 소비.
 * - 소비처 B (src/renderer/main.tsx): 렌더러 엔트리 라이프사이클의 기본 기능으로 수입 소비.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - 본 파일은 AMEVA 시스템 내에서 도메인 목적에 부합하는 연산 및 데이터 처리 흐름을 안전하게 캡슐화한다.
 * - 외부 라이브러리 및 하위 종속성을 조율하고 결과 규격을 일관되게 제공한다.
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - MUST: 모든 예외 발생 시 에러를 침묵시키지 말고 에러 로그를 명확하게 남길 것.
 * - MUST NOT: TypeScript any 형식을 우회 수단으로 함부로 선언하지 말 것.
 */

import { useState } from 'react';
import { 
  Check, X, ChevronUp, ChevronDown, Plus, Brain, ArrowUp, ArrowDown 
} from 'lucide-react';
import type { AIMessage, InsertSuggestion } from '../../../types/aiTypes';

/**
 * InsertPreviewCard
 * AI가 에디터에 특정 블록을 삽입/수정할 것을 제안했을 때,
 * 사용자에게 미리보기와 승인/거절 UI를 제공하는 컴포넌트입니다.
 */
export function InsertPreviewCard({
  msg,
  ins,
  blocks,
  onApply,
  onReject,
  onMove,
  onScrollToBlock,
}: {
  msg: AIMessage;
  ins: InsertSuggestion;
  blocks: any[];
  onApply: () => void;
  onReject: () => void;
  onMove: (direction: 'up' | 'down') => void;
  onScrollToBlock?: (blockId: string) => void;
}) {
  const [logExpanded, setLogExpanded] = useState(false);

  // 인접 블록 레이블 추출 (pending/done 공통 사용)
  const flatBlocks: any[] = (function flatten(bks: any[]): any[] {
    return (bks || []).flatMap((b: any) => [b, ...flatten(b.children || [])]);
  })(blocks || []);

  /*
   * [FUNCTION CONTRACT]
   * - 함수 명: `getBlockLabel`
   * - 역할: 인자 정보를 검수하고 비즈니스 계약 조건에 맞춰 최종 바인딩 결과물/바이너리 버퍼를 반환함.
   * - 예시: `getBlockLabel(...)` 호출 시 런타임 비동기/동기 연쇄 반응 유도.
   */
  function getBlockLabel(b: any): string {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `!b`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (!b)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
    if (!b) return '';
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `txt`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const txt = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const txt = Array.isArray(b.content)
      ? b.content.map((c: any) => c.text || '').join('').slice(0, 40)
      : '';
    return txt || `[${b.type}]`;
  }

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `siblingIds`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const siblingIds = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const siblingIds = ins.siblingBlockIds ?? flatBlocks.map((b: any) => b.id);
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `currentIdx`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const currentIdx = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const currentIdx = ins.siblingIndex ?? siblingIds.indexOf(ins.afterBlockId);
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `prevBlockId`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const prevBlockId = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const prevBlockId = currentIdx > 0 ? siblingIds[currentIdx - 1] : null;
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `nextBlockId`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const nextBlockId = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const nextBlockId = siblingIds[currentIdx + 1] ?? null;
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `prevBlock`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const prevBlock = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const prevBlock = prevBlockId ? flatBlocks.find((b: any) => b.id === prevBlockId) : null;
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `nextBlock`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const nextBlock = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const nextBlock = nextBlockId ? flatBlocks.find((b: any) => b.id === nextBlockId) : null;

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `typeLabel`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const typeLabel = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const typeLabel = ins.blockType === 'heading'
    ? `제목 H${ins.level ?? 1}`
    : ins.blockType === 'paragraph' ? '단락'
    : ins.blockType === 'bulletListItem' ? '글머리 목록'
    : ins.blockType === 'numberedListItem' ? '번호 목록' : ins.blockType;

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `positionLabel`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const positionLabel = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const positionLabel = ins.afterBlockId === 'START'
    ? '문서 맨 앞'
    : ins.afterBlockId === 'END'
    ? '문서 맨 끝'
    : prevBlock
    ? `"${getBlockLabel(prevBlock)}" 다음`
    : '해당 위치';

  // 추론 경로 텍스트 (thinking trace + reasonText 합산)
  const thinkingText = (msg.reasoningTrace || [])
    .filter(t => t.type === 'thinking')
    .map(t => t.text || '')
    .filter(Boolean)
    .join('\n\n');
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `hasReasonLog`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const hasReasonLog = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const hasReasonLog = !!(ins.reasonText || thinkingText);

  // ── 완료 상태: 접힌 결과 로그 ──────────────────
  if (ins.status !== 'pending') {
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `accepted`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const accepted = ...` 형태로 안전 캐싱 후 가공 기동.
       */
    const accepted = ins.status === 'accepted';
    return (
      <div style={{
        marginBottom: '8px', borderRadius: '8px', overflow: 'hidden',
        border: `1px solid ${accepted ? 'rgba(16,185,129,0.22)' : 'rgba(239,68,68,0.18)'}`,
        background: accepted ? 'rgba(16,185,129,0.04)' : 'rgba(239,68,68,0.04)',
      }}>
        {/* 결과 헤더 — 클릭으로 펼침 및 수락 시 스크롤 포커싱 */}
        <div
          onClick={() => {
      /*
       * [ALGORITHM BRANCH / DECISION]
       * - 조건 식: `accepted && ins.afterBlockId && onScrollToBlock`
       * - 만족 시: 비즈니스 요구사항을 만족하여 대응 내부 분기 블록을 구동함.
       * - 불만족 시: 바이패스(Bypass)하여 하위 연산으로 폴백하거나 조건 스택을 탈출함.
       * - 예시: `if (accepted && ins.afterBlockId && onScrollToBlock)` 만족 시 런타임 내포 연산 및 데이터 매핑 즉시 활성화.
       */
            if (accepted && ins.afterBlockId && onScrollToBlock) {
              onScrollToBlock(ins.afterBlockId);
            }
            setLogExpanded(v => !v);
          }}
          style={{
            padding: '7px 10px',
            display: 'flex', alignItems: 'center', gap: '6px',
            cursor: (accepted || hasReasonLog) ? 'pointer' : 'default',
            fontSize: '11px', color: accepted ? '#10b981' : '#f87171',
            fontWeight: 600,
          }}
        >
          {accepted ? <Check size={11} /> : <X size={11} />}
          <span>{accepted ? '삽입 완료' : '삽입 취소'}</span>
          <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '10px' }}>
            · {typeLabel} / {positionLabel}
          </span>
          <span style={{ flex: 1 }} />
          {hasReasonLog && (
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
              {logExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              {logExpanded ? '접기' : '판단 로그'}
            </span>
          )}
        </div>

        {/* 펼쳐진 판단 로그 */}
        {logExpanded && hasReasonLog && (
          <div style={{
            borderTop: `1px solid ${accepted ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)'}`,
            background: 'rgba(0,0,0,0.12)',
            padding: '8px 12px',
            fontSize: '11px',
            color: 'var(--text-muted)',
            lineHeight: '1.6',
          }}>
            {/* 위치 결정 경로 */}
            <div style={{ marginBottom: '6px', fontWeight: 600, fontSize: '10px', color: 'rgba(167,139,250,0.7)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              📍 삽입 경로
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: '10px', marginBottom: '8px', color: 'rgba(255,255,255,0.5)' }}>
              {prevBlock && <div>↑ {getBlockLabel(prevBlock)}</div>}
              <div style={{ color: accepted ? '#10b981' : '#f87171', fontWeight: 700 }}>
                → [{typeLabel}] {ins.content.slice(0, 50)}{ins.content.length > 50 ? '...' : ''}
              </div>
              {nextBlock && <div>↓ {getBlockLabel(nextBlock)}</div>}
            </div>

            {/* AI 판단 근거 */}
            {ins.reasonText && (
              <>
                <div style={{ marginBottom: '4px', fontWeight: 600, fontSize: '10px', color: 'rgba(167,139,250,0.7)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  🤖 AI 판단 근거
                </div>
                <div style={{ marginBottom: '8px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {ins.reasonText}
                </div>
              </>
            )}

            {/* 생각 과정 (thinking trace) — AI 판단 근거와 다른 내용일 때만 보조적으로 노출 */}
            {thinkingText && thinkingText.trim() !== ins.reasonText?.trim() && (
              <>
                <div style={{ marginBottom: '4px', fontWeight: 600, fontSize: '10px', color: 'rgba(167,139,250,0.7)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  🧠 추론 과정
                </div>
                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', opacity: 0.75 }}>
                  {thinkingText}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── pending 상태: 삽입 위치 미리보기 + 버튼 ────────────
  const canMoveUp = ins.afterBlockId !== 'START' && currentIdx > 0;
      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `canMoveDown`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const canMoveDown = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const canMoveDown = ins.afterBlockId !== 'END' && nextBlockId !== null;

      /*
       * [RUN-TIME STATE / INVARIANT]
       * - 변수 명: `previewFontSize`
       * - 자료형 / 예상 값: 우변 식 계산 결과에 따라 런타임 할당되는 적격 데이터 타입 (예: string, number, boolean, Object 등).
       * - 시나리오: 본 함수 영역 내에서 상태 생명주기를 유지하며 데이터 보존 및 후속 분기 연산에 소비됨.
       * - 예시 코드: `const previewFontSize = ...` 형태로 안전 캐싱 후 가공 기동.
       */
  const previewFontSize = ins.blockType === 'heading'
    ? (ins.level === 1 ? '15px' : ins.level === 2 ? '13px' : '12px')
    : '12px';

  return (
    <div style={{
      marginBottom: '10px',
      borderRadius: '8px',
      border: '1px solid rgba(139,92,246,0.3)',
      overflow: 'hidden',
      background: 'rgba(139,92,246,0.03)',
    }}>
      {/* 헤더 */}
      <div style={{
        padding: '5px 10px',
        background: 'rgba(139,92,246,0.1)',
        borderBottom: '1px solid rgba(139,92,246,0.18)',
        display: 'flex', alignItems: 'center', gap: '5px',
        fontSize: '10px', fontWeight: 700, color: 'rgba(167,139,250,0.9)',
        textTransform: 'uppercase', letterSpacing: '0.4px',
      }}>
        <Plus size={10} />
        삽입 제안 · {typeLabel}
        <span style={{
          marginLeft: 'auto', fontWeight: 400,
          textTransform: 'none', color: 'var(--text-muted)', fontSize: '10px',
        }}>
          위치: {positionLabel}
        </span>
      </div>

      {/* AI 판단 근거 접힌 글 */}
      {ins.reasonText && (
        <div
          onClick={() => setLogExpanded(v => !v)}
          style={{
            padding: '4px 10px',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '5px',
            fontSize: '10px', color: 'rgba(167,139,250,0.7)',
          }}
        >
          <Brain size={9} />
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {logExpanded ? ins.reasonText : ins.reasonText.slice(0, 60) + (ins.reasonText.length > 60 ? '...' : '')}
          </span>
          {logExpanded ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
        </div>
      )}

      {/* 추론 과정 (thinking trace) — 펼쳐진 상태일 때 표시 */}
      {logExpanded && thinkingText && (
        <div style={{
          padding: '6px 10px',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          background: 'rgba(0,0,0,0.1)',
          fontSize: '10px', color: 'var(--text-muted)',
          lineHeight: '1.5', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {thinkingText}
        </div>
      )}

      {/* 위 블록 컨텍스트 */}
      {prevBlock && (
        <div style={{
          padding: '3px 12px', fontSize: '10px',
          color: 'var(--text-muted)', borderBottom: '1px dashed rgba(255,255,255,0.04)',
          opacity: 0.55, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          ↑ {getBlockLabel(prevBlock)}
        </div>
      )}

      {/* 삽입 내용 미리보기 */}
      <div style={{
        padding: '8px 14px',
        fontSize: previewFontSize,
        fontWeight: ins.blockType === 'heading' ? 700 : 400,
        color: 'var(--text-main)',
        lineHeight: '1.55',
        whiteSpace: 'pre-wrap',
        borderLeft: ins.blockType === 'heading'
          ? '3px solid var(--primary)'
          : '3px solid rgba(255,255,255,0.08)',
        background: 'rgba(0,0,0,0.06)',
      }}>
        {ins.blockType === 'bulletListItem' && '• '}
        {ins.blockType === 'numberedListItem' && '1. '}
        {ins.content}
      </div>

      {/* 아래 블록 컨텍스트 */}
      {nextBlock && (
        <div style={{
          padding: '3px 12px', fontSize: '10px',
          color: 'var(--text-muted)', borderTop: '1px dashed rgba(255,255,255,0.04)',
          opacity: 0.55, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          ↓ {getBlockLabel(nextBlock)}
        </div>
      )}

      {/* 액션 버튼 바 */}
      <div style={{
        padding: '6px 10px',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', alignItems: 'center', gap: '5px',
        background: 'rgba(0,0,0,0.12)',
      }}>
        <button
          onClick={() => onMove('up')}
          disabled={!canMoveUp}
          title="위로 이동"
          style={{
            padding: '3px 8px', borderRadius: '4px',
            border: '1px solid rgba(255,255,255,0.1)',
            background: canMoveUp ? 'rgba(255,255,255,0.05)' : 'transparent',
            color: canMoveUp ? 'var(--text-main)' : 'var(--text-muted)',
            cursor: canMoveUp ? 'pointer' : 'not-allowed',
            fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px',
          }}
        >
          <ArrowUp size={9} /> 위
        </button>
        <button
          onClick={() => onMove('down')}
          disabled={!canMoveDown}
          title="아래로 이동"
          style={{
            padding: '3px 8px', borderRadius: '4px',
            border: '1px solid rgba(255,255,255,0.1)',
            background: canMoveDown ? 'rgba(255,255,255,0.05)' : 'transparent',
            color: canMoveDown ? 'var(--text-main)' : 'var(--text-muted)',
            cursor: canMoveDown ? 'pointer' : 'not-allowed',
            fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px',
          }}
        >
          <ArrowDown size={9} /> 아래
        </button>
        <span style={{ flex: 1 }} />
        <button
          onClick={onReject}
          style={{
            padding: '3px 10px', borderRadius: '4px',
            border: '1px solid rgba(239,68,68,0.3)',
            background: 'rgba(239,68,68,0.08)', color: '#f87171',
            cursor: 'pointer', fontSize: '11px', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: '3px',
          }}
        >
          <X size={10} /> 거절
        </button>
        <button
          onClick={onApply}
          style={{
            padding: '3px 12px', borderRadius: '4px',
            border: '1px solid rgba(16,185,129,0.4)',
            background: 'rgba(16,185,129,0.12)', color: '#10b981',
            cursor: 'pointer', fontSize: '11px', fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: '3px',
          }}
        >
          <Check size={10} /> 삽입
        </button>
      </div>
    </div>
  );
}

