/**
 * @file ThoughtProcess.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/ai-panel/chat-list/ThoughtProcess.tsx
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
import { Brain, Terminal, Settings2, Sparkles, CheckCircle2, Loader2, Circle } from 'lucide-react';
import type { ThoughtNode } from '../../../utils/aiFormatters';
import { parseThoughtText } from '../../../utils/aiFormatters';

/**
 * AI 추론 및 동작 상태를 시각화하기 위한 전용 CSS 키프레임 애니메이션입니다.
 * 글로벌 스타일 오염을 막기 위해 컴포넌트 내부에 캡슐화되어 주입됩니다.
 */
const keyframeStyles = `
  @keyframes pulseGlow {
    0% { opacity: 0.6; transform: scale(0.95); }
    50% { opacity: 1; transform: scale(1.05); }
    100% { opacity: 0.6; transform: scale(0.95); }
  }
  @keyframes slideDown {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

/**
 * ThoughtNodeItem 컴포넌트
 * 단일 추론 노드(헤더 또는 자식 아이템)를 화면에 렌더링합니다.
 * 상태(running, completed, pending)에 따라 적절한 아이콘과 애니메이션을 동적으로 결정합니다.
 */
export function ThoughtNodeItem({ node, isLast: _isLast }: { node: ThoughtNode; isLast: boolean }) {
  const isHeader = node.isHeader;
  const hasChildren = node.children && node.children.length > 0;

  let iconElement: React.ReactNode = null;
  
  // 헤더 노드일 경우: 내용에 따라 특정 Lucide 아이콘을 매핑합니다.
  if (isHeader) {
    let HeaderIcon = Brain;
    if (node.title.includes('의도')) HeaderIcon = Terminal;
    else if (node.title.includes('플래닝') || node.title.includes('시스템')) HeaderIcon = Settings2;
    else if (node.title.includes('실시간') || node.title.includes('추론')) HeaderIcon = Sparkles;

    if (node.status === 'running') {
      iconElement = <HeaderIcon size={14} style={{ color: 'var(--secondary)', animation: 'pulseGlow 1.5s infinite ease-in-out' }} />;
    } else {
      iconElement = <HeaderIcon size={14} style={{ color: node.status === 'completed' ? 'var(--primary)' : 'var(--text-muted)' }} />;
    }
  } else {
    // 일반 자식 노드일 경우: 진행 상태에 따라 체크, 로딩, 대기 아이콘을 렌더링합니다.
    if (node.status === 'completed') {
      iconElement = <CheckCircle2 size={12} style={{ color: '#10b981' }} />;
    } else if (node.status === 'running') {
      iconElement = <Loader2 size={12} style={{ color: 'var(--secondary)', animation: 'spin 1s linear infinite' }} />;
    } else {
      iconElement = <Circle size={10} style={{ color: 'var(--text-muted)', opacity: 0.5 }} />;
    }
  }

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    paddingLeft: isHeader ? '0' : '8px',
    marginBottom: isHeader ? '10px' : '4px',
    animation: 'slideDown 0.2s ease-out',
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    fontSize: isHeader ? '11px' : '10.5px',
    fontWeight: isHeader ? 700 : 500,
    color: isHeader 
      ? 'var(--text-main)' 
      : node.status === 'running' 
        ? 'var(--text-main)' 
        : 'var(--text-muted)',
    lineHeight: '1.5',
    position: 'relative',
  };

  const childrenContainerStyle: React.CSSProperties = {
    paddingLeft: '12px',
    borderLeft: '1px solid rgba(255,255,255,0.05)',
    marginLeft: isHeader ? '6px' : '5px',
    marginTop: '4px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  };

  return (
    <div style={containerStyle}>
      <div style={rowStyle}>
        <div style={{ display: 'flex', alignItems: 'center', height: '18px', flexShrink: 0 }}>
          {iconElement}
        </div>
        <div style={{ 
          paddingTop: '2px', 
          fontFamily: isHeader ? 'inherit' : "'JetBrains Mono', 'Fira Code', Consolas, Monaco, monospace",
          wordBreak: 'break-word',
          opacity: node.status === 'pending' ? 0.5 : 1,
        }}>
          {node.title}
          {/* 실행 중인 상태일 때 텍스트 끝에 점멸하는 커서 형태의 애니메이션 추가 */}
          {node.status === 'running' && !isHeader && (
            <span style={{ 
              display: 'inline-block', 
              width: '3px', 
              height: '9px', 
              background: 'var(--secondary)', 
              marginLeft: '4px',
              animation: 'pulseGlow 0.8s infinite ease-in-out',
              verticalAlign: 'middle'
            }} />
          )}
        </div>
      </div>

      {/* 자식 노드가 존재하면 재귀적으로 ThoughtNodeItem을 렌더링합니다. */}
      {hasChildren && (
        <div style={childrenContainerStyle}>
          {node.children.map((child, index) => (
            <ThoughtNodeItem 
              key={child.id} 
              node={child} 
              isLast={index === node.children.length - 1} 
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * ThoughtTreeView 컴포넌트
 * 원시 텍스트 형태의 AI 추론(Thinking) 데이터를 파싱하여 계층형 트리 뷰로 변환 및 렌더링합니다.
 * 스트리밍 중첩 상태를 처리할 수 있도록 isStreaming 플래그를 받습니다.
 */
export function ThoughtTreeView({ text, isStreaming }: { text: string; isStreaming: boolean }) {
  // 유틸리티 함수를 사용해 평문 텍스트를 파싱된 트리 구조(ThoughtNode 배열)로 변환합니다.
  const nodes = parseThoughtText(text, isStreaming);
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* 캡슐화된 애니메이션 키프레임 스타일 주입 */}
      <style dangerouslySetInnerHTML={{ __html: keyframeStyles }} />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {nodes.map((node, index) => (
          <ThoughtNodeItem 
            key={node.id} 
            node={node} 
            isLast={index === nodes.length - 1} 
          />
        ))}
      </div>
    </div>
  );
}
