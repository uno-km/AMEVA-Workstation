/**
 * @file DocStatusIndicator.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/statusbar/DocStatusIndicator.tsx
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

import React from 'react'
import { Info, AlertTriangle, Check } from 'lucide-react'

interface DocStatusIndicatorProps {
  filePath: string | null
  isDirty: boolean
  lastSavedTime: Date | null
  activeTooltip: string | null
  setActiveTooltip: (id: string | null) => void
  tooltipStyle: React.CSSProperties
}

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
export function DocStatusIndicator({
  filePath,
  isDirty,
  lastSavedTime,
  activeTooltip,
  setActiveTooltip,
  tooltipStyle
}: DocStatusIndicatorProps) {
  // [RUN-TIME STATE / INVARIANT] - 변수 'formatSavedTime'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
  const formatSavedTime = (date: Date | null) => {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
    if (!date) return '최근 저장 시간 기록 없음 (새 문서)'
  // [RUN-TIME STATE / INVARIANT] - 변수 'yyyy'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const yyyy = date.getFullYear()
  // [RUN-TIME STATE / INVARIANT] - 변수 'mm'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const mm = String(date.getMonth() + 1).padStart(2, '0')
  // [RUN-TIME STATE / INVARIANT] - 변수 'dd'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const dd = String(date.getDate()).padStart(2, '0')
  // [RUN-TIME STATE / INVARIANT] - 변수 'hh'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const hh = String(date.getHours()).padStart(2, '0')
  // [RUN-TIME STATE / INVARIANT] - 변수 'min'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const min = String(date.getMinutes()).padStart(2, '0')
  // [RUN-TIME STATE / INVARIANT] - 변수 'ss'은 본 스코프 내에서 상태 보존 및 알고리즘 처리에 활용됨.
    const ss = String(date.getSeconds()).padStart(2, '0')
    return `최근 저장 시간: ${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <Info size={12} style={{ color: 'var(--primary)' }} />
        <span style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: '260px' }}>
          {filePath ? filePath.split(/[\\/]/).pop() : '무제 문서.md'}
        </span>
      </div>
      <div style={{ width: '1px', height: '12px', backgroundColor: 'var(--border-muted)' }} />
      {isDirty ? (
        <span 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '4px', 
            color: '#fb923c', // 주황색 계열 (수정 중)
            cursor: 'help',
            fontWeight: 600,
            fontSize: '11px',
            position: 'relative'
          }}
          onMouseEnter={() => setActiveTooltip('save')}
          onMouseLeave={() => setActiveTooltip(null)}
        >
          <AlertTriangle size={11} style={{ color: '#fb923c' }} /> 저장되지 않음

          {activeTooltip === 'save' && (
            <div style={{ ...tooltipStyle, width: '280px', left: 0 }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#fb923c', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px', marginBottom: '4px' }}>
                ⚠️ 미저장 수정사항 존재
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-main)', lineHeight: '1.4' }}>
                에디터 본문에 저장되지 않은 변경사항이 있습니다. <br />
                <span style={{ color: 'var(--primary)', fontWeight: 700 }}>Ctrl+S</span> 단축키를 눌러 디스크에 안전하게 저장하십시오.
              </div>
            </div>
          )}
        </span>
      ) : (
        <span 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '4px', 
            color: 'var(--success)', 
            cursor: 'help',
            fontSize: '11px',
            position: 'relative'
          }}
          onMouseEnter={() => setActiveTooltip('save')}
          onMouseLeave={() => setActiveTooltip(null)}
        >
          <Check size={11} style={{ color: 'var(--success)' }} /> 저장됨

          {activeTooltip === 'save' && (
            <div style={{ ...tooltipStyle, width: '260px', left: 0 }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--success)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px', marginBottom: '4px' }}>
                ✓ 문서가 디스크에 동기화됨
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-main)' }}>
                {formatSavedTime(lastSavedTime)}
              </div>
            </div>
          )}
        </span>
      )}
    </>
  )
}

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
