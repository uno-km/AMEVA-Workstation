import React, { useState } from 'react';
import {
  Check, X, ChevronUp, ChevronDown, Plus, Brain, ArrowUp, ArrowDown
} from 'lucide-react';
import type { AIMessage, InsertSuggestion } from '../../types/aiTypes';

/**
 * InsertPreviewCardProps 인터페이스 정의
 * AI가 생성한 문서 삽입/수정 제안을 UI에 렌더링하기 위한 필수 데이터와 콜백 함수들을 명시합니다.
 * AIPanel과의 강한 결합을 끊고 프레젠테이션 컴포넌트로 독립시키기 위해 모든 동작을 부모에게 위임합니다.
 * 예상되는 값: msg는 AI 응답 원본, ins는 삽입 제안 데이터, blocks는 에디터의 블록 구조입니다.
 */
export interface InsertPreviewCardProps {
  msg: AIMessage;
  ins: InsertSuggestion;
  blocks: any[];
  onApply: () => void;
  onReject: () => void;
  onMove: (direction: 'up' | 'down') => void;
  onScrollToBlock?: (blockId: string) => void;
}

/**
 * InsertPreviewCard 컴포넌트
 * AI가 에디터 내부의 특정 위치에 문서 삽입을 제안할 때 표시되는 UI 카드입니다.
 * 사용자가 제안을 수락, 거절, 위치 이동할 수 있도록 하며, AI의 판단 근거(Reasoning Trace)를 접을 수 있는 패널로 제공합니다.
 * 예상되는 값: 유효한 Props가 주어지면 승인 대기 상태 또는 완료 상태에 따른 시각적 피드백 블록을 렌더링합니다.
 */
export const InsertPreviewCard: React.FC<InsertPreviewCardProps> = ({
  msg,
  ins,
  blocks,
  onApply,
  onReject,
  onMove,
  onScrollToBlock,
}) => {
  const [logExpanded, setLogExpanded] = useState(false);

  /**
   * 트리 구조 평탄화 (Flattening)
   * 중첩된 에디터 블록(blocks) 배열을 1차원 배열로 변환하여 순차적 탐색이 가능하게 만듭니다.
   * 이는 삽입 위치의 앞뒤 형제(sibling) 블록을 쉽게 찾기 위한 필수적인 전처리 과정입니다.
   * 즉시 실행 함수(IIFE) 패턴을 사용하여 초기 렌더링 시 1회만 계산되도록 캡슐화했습니다.
   * 예상되는 값: 중첩된 트리 형태의 blocks가 주어지면 모든 노드가 직렬화된 1차원 배열을 반환합니다.
   */
  const flatBlocks: any[] = (function flatten(bks: any[]): any[] {
    // 재귀적으로 자식 요소들을 순회하며 배열을 평탄화하는 로직입니다.
    // 자식이 있는 노드를 발견할 때마다 자신을 배열에 추가하고, 자식 노드들에 대해 다시 이 함수를 호출하여 전개합니다.
    // 빈 배열 방어 코드가 포함되어 있어 undefined 에러를 원천 차단합니다.
    // 예상되는 값: bks가 유효한 배열일 때 재귀 전개된 1차원 배열 반환.
    return (bks || []).flatMap((b: any) => [b, ...flatten(b.children || [])]);
  })(blocks || []);

  /**
   * getBlockLabel 함수
   * 평탄화된 블록 객체에서 사용자가 읽을 수 있는 텍스트 형태의 요약 레이블을 추출합니다.
   * 만약 텍스트가 존재하지 않는 특수 블록(예: 이미지)일 경우 대괄호 형식의 타입명으로 폴백 처리합니다.
   * 예상되는 값: 유효한 텍스트 블록 객체가 주어지면 앞 40자를 잘라낸 문자열을 반환합니다.
   */
  function getBlockLabel(b: any): string {
    // 입력된 블록 객체가 유효한지 1차 검증을 수행하는 방어 코드입니다.
    // 블록이 존재하지 않는 극단적 예외 상황을 처리합니다.
    // 예상되는 값: b가 null 또는 undefined이면 빈 문자열 반환.
    if (!b) return '';
    
    const txt = Array.isArray(b.content)
      ? b.content.map((c: any) => c.text || '').join('').slice(0, 40)
      : '';
      
    // 텍스트 추출에 성공했다면 해당 텍스트를 반환하고, 실패했다면 블록 타입을 기반으로 임시 레이블을 생성합니다.
    // 시각적으로 빈 공간이 표시되는 것을 막기 위한 UX 보호 장치입니다.
    // 예상되는 값: 텍스트가 빈 문자열이면 `[heading]`과 같은 형태 반환.
    return txt || `[${b.type}]`;
  }

  // 삽입 컨텍스트 분석을 위해 형제 요소 및 기준점 인덱스를 산출합니다.
  const siblingIds = ins.siblingBlockIds ?? flatBlocks.map((b: any) => b.id);
  const currentIdx = ins.siblingIndex ?? siblingIds.indexOf(ins.afterBlockId);
  const prevBlockId = currentIdx > 0 ? siblingIds[currentIdx - 1] : null;
  const nextBlockId = siblingIds[currentIdx + 1] ?? null;
  const prevBlock = prevBlockId ? flatBlocks.find((b: any) => b.id === prevBlockId) : null;
  const nextBlock = nextBlockId ? flatBlocks.find((b: any) => b.id === nextBlockId) : null;

  // 블록 타입에 대응하는 한국어 레이블 매핑 변수입니다.
  const typeLabel = ins.blockType === 'heading'
    ? `제목 H${ins.level ?? 1}`
    : ins.blockType === 'paragraph' ? '단락'
    : ins.blockType === 'bulletListItem' ? '글머리 목록'
    : ins.blockType === 'numberedListItem' ? '번호 목록' : ins.blockType;

  // 삽입 위치에 대한 한국어 텍스트 매핑 변수입니다.
  const positionLabel = ins.afterBlockId === 'START'
    ? '문서 맨 앞'
    : ins.afterBlockId === 'END'
    ? '문서 맨 끝'
    : prevBlock
    ? `"${getBlockLabel(prevBlock)}" 다음`
    : '해당 위치';

  // AI 추론 과정(Thinking Trace)을 추출하여 문자열로 결합합니다.
  const thinkingText = (msg.reasoningTrace || [])
    .filter((t: any) => t.type === 'thinking')
    .map((t: any) => t.text || '')
    .filter(Boolean)
    .join('\n\n');
  const hasReasonLog = !!(ins.reasonText || thinkingText);

  // ── 완료 상태: 접힌 결과 로그 (삽입 수락/거절이 끝난 상태) ──────────────────
  // 제안된 동작이 이미 수행(수락 또는 거절)되었는지를 확인하여 UI를 변경하는 조건문입니다.
  // 완료된 항목은 화면 공간을 최소화하기 위해 접힌 형태의 미니멀한 로그 뷰로 전환됩니다.
  // 이 조건이 참일 경우, 하단 액션 버튼이 사라지고 상태 배지형태의 UI가 렌더링되어 반환됩니다.
  // 예상되는 값: ins.status가 'pending'이 아닐 때 결과 뷰 렌더링 진입.
  if (ins.status !== 'pending') {
    const accepted = ins.status === 'accepted';
    return (
      <div style={{
        marginBottom: '8px', borderRadius: '8px', overflow: 'hidden',
        border: `1px solid ${accepted ? 'rgba(16,185,129,0.22)' : 'rgba(239,68,68,0.18)'}`,
        background: accepted ? 'rgba(16,185,129,0.04)' : 'rgba(239,68,68,0.04)',
      }}>
        {/* 결과 헤더 — 클릭으로 펼침 및 수락 시 스크롤 포커싱 이벤트를 발생시킵니다. */}
        <div
          onClick={() => {
            // 사용자가 수락된 로그를 클릭했을 때 에디터의 해당 위치로 스크롤을 이동시키는 조건문입니다.
            // 블록 ID가 유효하고, 부모로부터 onScrollToBlock 함수를 주입받은 경우에만 실행됩니다.
            // 예상되는 값: accepted가 참이고 ins.afterBlockId가 존재하면 함수 호출 실행.
            if (accepted && ins.afterBlockId && onScrollToBlock) {
              onScrollToBlock(ins.afterBlockId);
            }
            setLogExpanded(v => !v);
          }}
          style={{
            padding: '7px 10px', display: 'flex', alignItems: 'center', gap: '6px',
            cursor: (accepted || hasReasonLog) ? 'pointer' : 'default',
            fontSize: '11px', color: accepted ? '#10b981' : '#f87171', fontWeight: 600,
          }}
        >
          {accepted ? <Check size={11} /> : <X size={11} />}
          <span>{accepted ? '삽입 완료' : '삽입 취소'}</span>
          <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '10px' }}>
            · {typeLabel} / {positionLabel}
          </span>
          <span style={{ flex: 1 }} />
          {/* 부가적인 판단 로그가 존재하는 경우에만 우측에 토글 인디케이터를 그립니다. */}
          {/* 예상되는 값: hasReasonLog가 참이면 Chevron 화살표와 텍스트 노출. */}
          {hasReasonLog && (
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
              {logExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              {logExpanded ? '접기' : '판단 로그'}
            </span>
          )}
        </div>

        {/* 사용자가 로그 영역을 펼쳤을 때 AI 판단 근거와 상세 삽입 위치를 렌더링하는 조건문입니다. */}
        {/* 결과 내역을 투명하게 공개하여 사용자가 AI의 동작 원리를 신뢰할 수 있도록 돕습니다. */}
        {/* 예상되는 값: logExpanded가 참이고 hasReasonLog가 참일 때 내부 컨텐츠 렌더링. */}
        {logExpanded && hasReasonLog && (
          <div style={{
            borderTop: `1px solid ${accepted ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)'}`,
            background: 'rgba(0,0,0,0.12)', padding: '8px 12px', fontSize: '11px',
            color: 'var(--text-muted)', lineHeight: '1.6',
          }}>
            {/* 위치 결정 경로 컨텍스트 표시 영역 */}
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

            {/* 명시적인 AI 판단 근거 텍스트가 있을 경우 렌더링하는 구문입니다. */}
            {/* 예상되는 값: ins.reasonText가 비어있지 않은 문자열일 때 컴포넌트 렌더링. */}
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

            {/* 생각 과정 (Thinking Trace) — AI 판단 근거와 다른 세부 내용일 때만 보조적으로 노출하는 조건문입니다. */}
            {/* 동일한 텍스트가 중복으로 노출되어 시각적 피로감을 유발하는 것을 막습니다. */}
            {/* 예상되는 값: thinkingText가 존재하고 reasonText와 일치하지 않을 때만 렌더링. */}
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

  // ── pending 상태: 삽입 위치 미리보기 + 버튼 (아직 수락/거절을 선택하지 않은 대기 상태) ────────────
  // 현재 위치에서 사용자가 제안을 한 칸 위 또는 아래로 수동 조작할 수 있는지 여부를 판별합니다.
  const canMoveUp = ins.afterBlockId !== 'START' && currentIdx > 0;
  const canMoveDown = ins.afterBlockId !== 'END' && nextBlockId !== null;

  // 삽입될 블록의 종류에 맞춰 미리보기 텍스트의 폰트 크기를 다르게 지정하는 렌더링 로직입니다.
  const previewFontSize = ins.blockType === 'heading'
    ? (ins.level === 1 ? '15px' : ins.level === 2 ? '13px' : '12px')
    : '12px';

  return (
    <div style={{
      marginBottom: '10px', borderRadius: '8px',
      border: '1px solid rgba(139,92,246,0.3)', overflow: 'hidden',
      background: 'rgba(139,92,246,0.03)',
    }}>
      {/* 미리보기 카드 헤더 */}
      <div style={{
        padding: '5px 10px', background: 'rgba(139,92,246,0.1)',
        borderBottom: '1px solid rgba(139,92,246,0.18)', display: 'flex', alignItems: 'center', gap: '5px',
        fontSize: '10px', fontWeight: 700, color: 'rgba(167,139,250,0.9)',
        textTransform: 'uppercase', letterSpacing: '0.4px',
      }}>
        <Plus size={10} />
        삽입 제안 · {typeLabel}
        <span style={{ marginLeft: 'auto', fontWeight: 400, textTransform: 'none', color: 'var(--text-muted)', fontSize: '10px' }}>
          위치: {positionLabel}
        </span>
      </div>

      {/* 대기 상태의 카드에서 AI 판단 근거를 접어두는 아코디언 컴포넌트 조건문입니다. */}
      {/* UI 공간 절약을 위해 접은 채로 요약 텍스트만 보여주며 클릭 시 확장됩니다. */}
      {/* 예상되는 값: ins.reasonText가 존재할 때 렌더링. */}
      {ins.reasonText && (
        <div
          onClick={() => setLogExpanded(v => !v)}
          style={{
            padding: '4px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px',
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

      {/* 추론 과정이 있고, 아코디언이 펼쳐져 있을 때 표시되는 렌더링 영역입니다. */}
      {/* 판단 근거(Reason)와 실제 생각 과정(Thinking)을 별도 레이어로 구분하여 신뢰도를 더합니다. */}
      {/* 예상되는 값: logExpanded가 참이고 thinkingText가 비어있지 않을 때. */}
      {logExpanded && thinkingText && (
        <div style={{
          padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)',
          background: 'rgba(0,0,0,0.1)', fontSize: '10px', color: 'var(--text-muted)',
          lineHeight: '1.5', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {thinkingText}
        </div>
      )}

      {/* 에디터 내부의 위 블록 텍스트 미리보기 — 삽입 컨텍스트 인지용 */}
      {prevBlock && (
        <div style={{
          padding: '3px 12px', fontSize: '10px',
          color: 'var(--text-muted)', borderBottom: '1px dashed rgba(255,255,255,0.04)',
          opacity: 0.55, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          ↑ {getBlockLabel(prevBlock)}
        </div>
      )}

      {/* 삽입될 메인 콘텐츠 블록 미리보기 렌더링 (글머리 기호 자동 부여 로직 포함) */}
      <div style={{
        padding: '8px 14px', fontSize: previewFontSize,
        fontWeight: ins.blockType === 'heading' ? 700 : 400, color: 'var(--text-main)',
        lineHeight: '1.55', whiteSpace: 'pre-wrap',
        borderLeft: ins.blockType === 'heading' ? '3px solid var(--primary)' : '3px solid rgba(255,255,255,0.08)',
        background: 'rgba(0,0,0,0.06)',
      }}>
        {ins.blockType === 'bulletListItem' && '• '}
        {ins.blockType === 'numberedListItem' && '1. '}
        {ins.content}
      </div>

      {/* 에디터 내부의 아래 블록 텍스트 미리보기 — 삽입 컨텍스트 인지용 */}
      {nextBlock && (
        <div style={{
          padding: '3px 12px', fontSize: '10px',
          color: 'var(--text-muted)', borderTop: '1px dashed rgba(255,255,255,0.04)',
          opacity: 0.55, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          ↓ {getBlockLabel(nextBlock)}
        </div>
      )}

      {/* 사용자 인터랙션을 제어하는 액션 버튼 바입니다. 위치 이동 및 수락/거절 이벤트 핸들러를 바인딩합니다. */}
      <div style={{
        padding: '6px 10px', borderTop: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(0,0,0,0.12)',
      }}>
        <button
          onClick={() => onMove('up')}
          disabled={!canMoveUp}
          title="위로 이동"
          style={{
            padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)',
            background: canMoveUp ? 'rgba(255,255,255,0.05)' : 'transparent',
            color: canMoveUp ? 'var(--text-main)' : 'var(--text-muted)',
            cursor: canMoveUp ? 'pointer' : 'not-allowed', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px',
          }}
        >
          <ArrowUp size={9} /> 위
        </button>
        <button
          onClick={() => onMove('down')}
          disabled={!canMoveDown}
          title="아래로 이동"
          style={{
            padding: '3px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)',
            background: canMoveDown ? 'rgba(255,255,255,0.05)' : 'transparent',
            color: canMoveDown ? 'var(--text-main)' : 'var(--text-muted)',
            cursor: canMoveDown ? 'pointer' : 'not-allowed', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px',
          }}
        >
          <ArrowDown size={9} /> 아래
        </button>
        <span style={{ flex: 1 }} />
        <button
          onClick={onReject}
          style={{
            padding: '3px 10px', borderRadius: '4px', border: '1px solid rgba(239,68,68,0.3)',
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
            padding: '3px 12px', borderRadius: '4px', border: '1px solid rgba(16,185,129,0.4)',
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
};
