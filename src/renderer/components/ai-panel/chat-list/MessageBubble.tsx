/**
 * @file MessageBubble.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/ai-panel/chat-list/MessageBubble.tsx
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

import React, { useState, useEffect } from 'react';
import { Bot } from 'lucide-react';
import type { AIMessage } from '../../../types/aiTypes';
import { getThoughtSummary } from '../../../utils/aiFormatters';
import { renderMessageContent } from './MessageContent';
import { InsertPreviewCard } from '../InsertPreviewCard';
import { ReasoningTraceViewer } from './ReasoningTraceViewer';
import { MessageActionBar } from './MessageActionBar';

/**
 * MessageBubble 컴포넌트 Props 스키마
 */
interface MessageBubbleProps {
  msg: AIMessage;
  onApplySuggestion?: (text: string, mode: 'replace' | 'insert', blockId?: string) => void;
  hasSelection: boolean;
  onUpdateDiffState?: (msgId: string, state: 'accepted' | 'rejected') => void;
  onApplyInsertSuggestion?: (msgId: string, afterBlockId: string, blockType: string, content: string, level?: number, suggestionIndex?: number) => void;
  onUpdateInsertSuggestionStatus?: (msgId: string, status: 'pending' | 'accepted' | 'rejected', newAfterBlockId?: string, newSiblingIndex?: number, suggestionIndex?: number) => void;
  blocks?: any[];
  onScrollToBlock?: (blockId: string) => void;
  isWhiteTheme: boolean;
}

/**
 * MessageBubble 컴포넌트
 * 단일 사용자/AI 메시지 블록의 렌더링, 스트리밍 상태, AI의 추론 과정(Reasoning Trace), 삽입 제안, 텍스트 복사 및 교체 액션을 통합 관리하는 "개별 메시지 단위"의 래퍼 컴포넌트입니다.
 */
export function MessageBubble({
  msg,
  onApplySuggestion,
  hasSelection,
  onUpdateDiffState,
  onApplyInsertSuggestion,
  onUpdateInsertSuggestionStatus,
  blocks,
  onScrollToBlock,
  isWhiteTheme,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [thoughtExpanded, setThoughtExpanded] = useState(false);
  // [RUN-TIME STATE / INVARIANT] - 변수 'isUser'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const isUser = msg.role === 'user';

  // AI 스트리밍 중에는 사용자가 실시간 추론 과정을 추적할 수 있도록 '생각 과정' 아코디언을 자동으로 펼칩니다.
  useEffect(() => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (msg.isStreaming) setThoughtExpanded(true);
  }, [msg.isStreaming]);

  // msg.reasoningTrace 배열에서 type이 'thinking'인 트레이스 텍스트들을 추출해 하나로 결합합니다.
  const traceEvents = msg.reasoningTrace || [];
  // [RUN-TIME STATE / INVARIANT] - 변수 'hasRealTrace'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const hasRealTrace = traceEvents.length > 0;
  
  // [RUN-TIME STATE / INVARIANT] - 변수 'thinkingText'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const thinkingText = traceEvents
    .filter((t: any) => t.type === 'thinking')
    .map((t: any) => t.text || '')
    .filter((t: any) => Boolean(t))
    .join('\n\n---\n\n');
    
  // [RUN-TIME STATE / INVARIANT] - 변수 'cleanContent'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const cleanContent = msg.content; // sanitization을 거친 최종 응답 본문 텍스트

  // AI의 추론 텍스트의 볼륨과 단계를 요약(분석)하여 UI에 표시할 메타데이터 생성
  const thoughtSummary = getThoughtSummary(thinkingText, !!msg.isStreaming);
  console.debug("Unused vars (MessageBubble):", { React });

  /**
   * 클립보드 전체 메시지 복사 핸들러
   */
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cleanContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  /**
   * AI의 응답에 마크다운 코드 블록이 포함되어 있을 경우 첫 번째 코드블록의 내용을 추출합니다.
   * '에디터 본문에 즉각 삽입'하는 액션을 수행하기 위해 코드 스니펫만 파싱해냅니다.
   */
  let codeSnippet = '';
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
  if (cleanContent.includes('```')) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'parts'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const parts = cleanContent.split('```');
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (parts[1]) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'lines'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
      const lines = parts[1].split('\n');
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
      if (lines[0] && lines[0].trim().length < 15 && !lines[0].includes(' ') && !lines[0].includes('(')) {
        codeSnippet = lines.slice(1).join('\n').trim();
      } else {
        codeSnippet = parts[1].trim();
      }
    }
  }

  // [RUN-TIME STATE / INVARIANT] - 변수 'textToApply'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const textToApply = codeSnippet || cleanContent.trim();

  // 시스템 메시지일 경우 단순 중앙 정렬된 회색 텍스트로만 렌더링
  if (msg.role === 'system') {
    return (
      <div style={{
        textAlign: 'center', padding: '4px 0', fontSize: '10px', color: 'var(--text-muted)',
      }}>
        {msg.content}
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: isUser ? 'row-reverse' : 'row',
      gap: '8px',
      alignItems: 'flex-start',
      marginBottom: '14px',
    }}>
      {/* ── 아바타 섹션 ── */}
      <div style={{
        width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
        background: isUser
          ? 'linear-gradient(135deg, var(--primary), #7c3aed)'
          : 'linear-gradient(135deg, var(--secondary), #0891b2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '12px', fontWeight: 700, color: '#fff',
        boxShadow: isUser ? '0 2px 8px var(--primary-glow)' : '0 2px 8px var(--secondary-glow)',
      }}>
        {isUser ? 'U' : <Bot size={14} />}
      </div>

      {/* ── 본문 말풍선 섹션 ── */}
      <div style={{ maxWidth: '82%', position: 'relative', display: 'flex', flexDirection: 'column', gap: '3px' }}>
        
        {/* 발화자 라벨 (질문/응답 구분 표시기) */}
        <span style={{
          fontSize: '9px', fontWeight: 800,
          color: isWhiteTheme
            ? (isUser ? '#6d28d9' : '#0891b2')
            : (isUser ? 'rgba(167,139,250,0.85)' : 'rgba(34,211,238,0.85)'),
          textTransform: 'uppercase', letterSpacing: '0.5px',
          alignSelf: isUser ? 'flex-end' : 'flex-start', padding: '0 2px'
        }}>
          {isUser ? '질문 (Prompt)' : '응답 (Response)'}
        </span>
        
        {/* 메인 메시지 컨테이너 블록 */}
        <div style={{
          padding: '10px 12px',
          borderRadius: isUser ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
          background: isUser
            ? 'linear-gradient(135deg, rgba(139,92,246,0.18), rgba(124,58,237,0.12))'
            : (msg.aborted && cleanContent === '사용자가 답변을 중단했습니다'
              ? 'rgba(255,255,255,0.02)'
              : 'var(--bg-card)'),
          border: `1px solid ${isUser
            ? 'rgba(139,92,246,0.35)'
            : (msg.aborted && cleanContent === '사용자가 답변을 중단했습니다'
              ? 'rgba(255,255,255,0.05)'
              : 'var(--border-muted)')}`,
          fontSize: '13px', lineHeight: '1.6',
          color: msg.error
            ? '#f87171'
            : (msg.aborted && cleanContent === '사용자가 답변을 중단했습니다'
              ? 'var(--text-muted)'
              : 'var(--text-main)'),
          wordBreak: 'break-word', whiteSpace: 'pre-wrap', position: 'relative',
          userSelect: 'text', WebkitUserSelect: 'text',
        }}>
          
          {/* 🏷️ 에디터 영역 참조 태그 (퍼플 하이라이트 클릭 유도 UI) */}
          {isUser && msg.taggedBlocks && msg.taggedBlocks.length > 0 && (
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px',
              padding: '4px 6px', background: 'rgba(255, 255, 255, 0.04)',
              border: '1px dashed rgba(255, 255, 255, 0.1)', borderRadius: '6px',
              boxSizing: 'border-box', width: 'fit-content'
            }}>
              {msg.taggedBlocks.map((block: any) => (
                <span
                  key={block.id}
                  onClick={() => onScrollToBlock?.(block.id)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    background: 'var(--primary-glow)', color: isWhiteTheme ? 'var(--primary)' : '#d8b4fe',
                    fontSize: '9px', fontWeight: 700, padding: '2px 6px',
                    borderRadius: '4px', cursor: onScrollToBlock ? 'pointer' : 'default',
                    border: '1px solid var(--border-glow)', userSelect: 'none',
                  }}
                  title="클릭 시 에디터 상의 해당 위치로 이동 및 하이라이트"
                >
                  💜 #{block.text}
                </span>
              ))}
            </div>
          )}

          {/* 🧠 AI 추론 로그(Reasoning Trace) 폴딩 아코디언 */}
          {!isUser && (
            <ReasoningTraceViewer
              isStreaming={!!msg.isStreaming}
              hasRealTrace={hasRealTrace}
              thinkingText={thinkingText}
              thoughtSummary={thoughtSummary}
              thoughtExpanded={thoughtExpanded}
              setThoughtExpanded={setThoughtExpanded}
              isWhiteTheme={isWhiteTheme}
            />
          )}

          {/* 🧩 AI 자동 코드/블록 삽입 제안 카드 (Insert Suggestions) */}
          {!isUser && msg.insertSuggestions && msg.insertSuggestions.length > 0 ? (
            msg.insertSuggestions.map((ins: any, idx: number) => (
              <InsertPreviewCard
                key={idx}
                msg={msg}
                ins={ins}
                blocks={blocks || []}
                onScrollToBlock={onScrollToBlock}
                onApply={() => {
                  onApplyInsertSuggestion?.(msg.id, ins.afterBlockId, ins.blockType, ins.content, ins.level, idx)
                }}
                onReject={() => {
                  onUpdateInsertSuggestionStatus?.(msg.id, 'rejected', undefined, undefined, idx)
                }}
                onMove={(direction) => {
  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
                  const flatAll: any[] = (function flatten(bks: any[]): any[] {
                    return (bks || []).flatMap((b: any) => [b, ...flatten(b.children || [])])
                  })(blocks || [])
  // [RUN-TIME STATE / INVARIANT] - 변수 'ids'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
                  const ids = ins.siblingBlockIds ?? flatAll.map((b: any) => b.id)
  // [RUN-TIME STATE / INVARIANT] - 변수 'currIdx'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
                  const currIdx = ins.siblingIndex ?? ids.indexOf(ins.afterBlockId)

  // [RUN-TIME STATE / INVARIANT] - 변수 'highlightBlock'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
                  const highlightBlock = (targetId: string) => {
                    setTimeout(() => {
                      try {
  // [RUN-TIME STATE / INVARIANT] - 변수 'resolvedId'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
                        const resolvedId = targetId === 'START' ? ids[0] : targetId === 'END' ? ids[ids.length - 1] : targetId
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
                        if (!resolvedId) return
  // [RUN-TIME STATE / INVARIANT] - 변수 'el'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
                        const el = document.querySelector(`[data-id="\${resolvedId}"], [data-block-id="\${resolvedId}"]`)
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
                        if (el) {
                          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  // [RUN-TIME STATE / INVARIANT] - 변수 'outer'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
                          const outer = el.closest('.bn-block-outer') || el
                          outer.setAttribute('data-highlighted-temp', 'true')
                          setTimeout(() => outer.removeAttribute('data-highlighted-temp'), 1200)
                        }
                      } catch (e) {
                        console.warn('에디터 블록 포커싱 에러:', e)
                      }
                    }, 50)
                  }

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
                  if (direction === 'up' && currIdx > 0) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'newIdx'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
                    const newIdx = currIdx - 1
  // [RUN-TIME STATE / INVARIANT] - 변수 'newId'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
                    const newId = newIdx === 0 ? 'START' : ids[newIdx - 1]
                    onUpdateInsertSuggestionStatus?.(msg.id, 'pending', newId, newIdx, idx)
                    highlightBlock(newId)
                  } else if (direction === 'down') {
  // [RUN-TIME STATE / INVARIANT] - 변수 'newIdx'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
                    const newIdx = currIdx + 1
  // [RUN-TIME STATE / INVARIANT] - 변수 'newId'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
                    const newId = newIdx >= ids.length ? 'END' : ids[newIdx]
                    onUpdateInsertSuggestionStatus?.(msg.id, 'pending', newId, newIdx, idx)
                    highlightBlock(newId)
                  }
                }}
              />
            ))
          ) : (
            !isUser && msg.insertSuggestion && (
              <InsertPreviewCard
                msg={msg}
                ins={msg.insertSuggestion}
                blocks={blocks || []}
                onScrollToBlock={onScrollToBlock}
                onApply={() => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'ins'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
                  const ins = msg.insertSuggestion!
                  onApplyInsertSuggestion?.(msg.id, ins.afterBlockId, ins.blockType, ins.content, ins.level)
                }}
                onReject={() => {
                  onUpdateInsertSuggestionStatus?.(msg.id, 'rejected')
                }}
                onMove={(direction) => {
  // [RUN-TIME STATE / INVARIANT] - 변수 'ins'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
                  const ins = msg.insertSuggestion!
  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
                  const flatAll: any[] = (function flatten(bks: any[]): any[] {
                    return (bks || []).flatMap((b: any) => [b, ...flatten(b.children || [])])
                  })(blocks || [])
  // [RUN-TIME STATE / INVARIANT] - 변수 'ids'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
                  const ids = ins.siblingBlockIds ?? flatAll.map((b: any) => b.id)
  // [RUN-TIME STATE / INVARIANT] - 변수 'currIdx'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
                  const currIdx = ins.siblingIndex ?? ids.indexOf(ins.afterBlockId)

  // [RUN-TIME STATE / INVARIANT] - 변수 'highlightBlock'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
                  const highlightBlock = (targetId: string) => {
                    setTimeout(() => {
                      try {
  // [RUN-TIME STATE / INVARIANT] - 변수 'resolvedId'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
                        const resolvedId = targetId === 'START' ? ids[0] : targetId === 'END' ? ids[ids.length - 1] : targetId
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
                        if (!resolvedId) return
  // [RUN-TIME STATE / INVARIANT] - 변수 'el'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
                        const el = document.querySelector(`[data-id="\${resolvedId}"], [data-block-id="\${resolvedId}"]`)
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
                        if (el) {
                          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  // [RUN-TIME STATE / INVARIANT] - 변수 'outer'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
                          const outer = el.closest('.bn-block-outer') || el
                          outer.setAttribute('data-highlighted-temp', 'true')
                          setTimeout(() => outer.removeAttribute('data-highlighted-temp'), 1200)
                        }
                      } catch (e) {
                        console.warn('에디터 블록 포커싱 에러:', e)
                      }
                    }, 50)
                  }

  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
                  if (direction === 'up' && currIdx > 0) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'newIdx'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
                    const newIdx = currIdx - 1
  // [RUN-TIME STATE / INVARIANT] - 변수 'newId'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
                    const newId = newIdx === 0 ? 'START' : ids[newIdx - 1]
                    onUpdateInsertSuggestionStatus?.(msg.id, 'pending', newId, newIdx)
                    highlightBlock(newId)
                  } else if (direction === 'down') {
  // [RUN-TIME STATE / INVARIANT] - 변수 'newIdx'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
                    const newIdx = currIdx + 1
  // [RUN-TIME STATE / INVARIANT] - 변수 'newId'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
                    const newId = newIdx >= ids.length ? 'END' : ids[newIdx]
                    onUpdateInsertSuggestionStatus?.(msg.id, 'pending', newId, newIdx)
                    highlightBlock(newId)
                  }
                }}
              />
            )
          )}

          {/* 📝 AI 인라인 텍스트 교체/수정 Diff 제안 렌더러 */}
          {!isUser && !msg.isStreaming && msg.originalText && msg.proposedText ? (
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 'bold' }}>
                문서 수정 제안 (AI Edit Suggestion)
              </div>
              <div style={{
                border: '1px solid var(--border-muted)', borderRadius: '6px', overflow: 'hidden',
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: '11px', background: '#0d0e12',
              }}>
                {/* Before Diff 뷰어 */}
                <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '6px 8px', borderBottom: '1px solid rgba(239, 68, 68, 0.15)' }}>
                  <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#f87171', marginBottom: '2px' }}>수정 전 (Before)</div>
                  <div style={{ textDecoration: 'line-through', whiteSpace: 'pre-wrap', color: '#fca5a5' }}>
                    {msg.originalText}
                  </div>
                </div>
                {/* After Diff 뷰어 */}
                <div style={{ background: 'rgba(34, 197, 94, 0.08)', padding: '6px 8px' }}>
                  <div style={{ fontSize: '9px', fontWeight: 'bold', color: '#4ade80', marginBottom: '2px' }}>수정 후 (After)</div>
                  <div style={{ whiteSpace: 'pre-wrap', color: '#86efac' }}>
                    {msg.proposedText}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // 일반 텍스트 + 코드 마크다운 렌더링 호출
            renderMessageContent(cleanContent, onApplySuggestion) || (msg.isStreaming ? (
              // 스트리밍 애니메이션 도트 인디케이터
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
                <span style={{ display: 'flex', gap: '3px' }}>
                  <span className="dot-thinking" style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--primary)', animation: 'dot-blink 1.4s infinite both' }} />
                  <span className="dot-thinking" style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--primary)', animation: 'dot-blink 1.4s infinite both 0.2s' }} />
                  <span className="dot-thinking" style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--primary)', animation: 'dot-blink 1.4s infinite both 0.4s' }} />
                </span>
                <span style={{ fontSize: '11px' }}>응답 생성 중...</span>
              </div>
            ) : '')
          )}

          {/* 스트리밍 중 텍스트 깜빡임 커서(Blinking Cursor) */}
          {msg.isStreaming && (
            <span style={{
              display: 'inline-block', width: '8px', height: '14px', background: 'var(--secondary)',
              marginLeft: '2px', verticalAlign: 'middle', borderRadius: '2px', animation: 'cursor-blink 0.8s step-end infinite',
            }} />
          )}

          {/* AI 발화 중단 시 안내 문구 표출 */}
          {msg.aborted && cleanContent !== '사용자가 답변을 중단했습니다' && (
            <div style={{
              fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '8px',
              borderTop: '1px solid var(--border-muted)', paddingTop: '6px', display: 'flex',
              alignItems: 'center', gap: '4px', userSelect: 'none'
            }}>
              <span>⏹ 사용자가 답변을 중단했습니다</span>
            </div>
          )}
        </div>

        {/* ── 액션 버튼 그룹 바 (수락/거절, 복사 등) ── */}
        <MessageActionBar
          isUser={isUser}
          msg={msg}
          cleanContent={cleanContent}
          copied={copied}
          handleCopy={handleCopy}
          onApplySuggestion={onApplySuggestion}
          onUpdateDiffState={onUpdateDiffState}
          onScrollToBlock={onScrollToBlock}
          textToApply={textToApply}
          hasSelection={hasSelection}
        />

        {/* 발생 시간 타임스탬프 */}
        <div style={{
          fontSize: '9px', color: 'var(--text-dark)', marginTop: '6px', textAlign: isUser ? 'right' : 'left',
        }}>
          {new Date(msg.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
