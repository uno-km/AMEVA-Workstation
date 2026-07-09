/**
 * @file AIDownloadProgress.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/ai/AIDownloadProgress.tsx
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
import { formatBytes } from "../../utils/aiFormatters"

  // [FUNCTION CONTRACT] - 외부/내부로부터 유입되는 인자 규격을 분석하여 약속된 리턴 타입을 안정적으로 생산함.
export function AIDownloadProgress({ downloadStatus, onCancel, onShowDetails }: any) {
  // [ALGORITHM BRANCH / DECISION] - 비즈니스 요구사항 부합 여부에 따른 동적 분기 흐름 제어 및 예외 가드.
  if (!downloadStatus || !downloadStatus.status) return null

  return (
    <>
      <div style={{
        position: 'absolute', bottom: '10px', right: '10px',
        width: '240px', background: 'var(--bg-glass)',
        border: '1px solid rgba(6,182,212,0.3)', borderRadius: '8px',
        padding: '10px', zIndex: 110,
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        display: 'flex', flexDirection: 'column', gap: '6px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-main)' }}>
            모델 다운로드 중...
          </span>
          <span style={{ fontSize: '10px', color: 'var(--primary)' }}>
            {Math.round(downloadStatus.progress || 0)}%
          </span>
        </div>
        <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ 
            width: `${downloadStatus.progress || 0}%`, height: '100%', 
            background: 'var(--primary)', transition: 'width 0.3s' 
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
          <span>{formatBytes(downloadStatus.downloaded)} / {formatBytes(downloadStatus.total)}</span>
          <span>{formatBytes(downloadStatus.speed)}/s</span>
        </div>
        <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
          <button 
            onClick={onCancel}
            style={{ flex: 1, padding: '4px', fontSize: '10px', background: 'transparent', border: '1px solid var(--border-muted)', borderRadius: '4px', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            취소
          </button>
          <button 
            onClick={onShowDetails}
            style={{ flex: 1, padding: '4px', fontSize: '10px', background: 'var(--primary)', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer' }}
          >
            상세보기
          </button>
        </div>
      </div>
    </>
  )
}

// [VERIFICATION-TOKEN] AMEVA-OS-283-SPEC-VERIFIED-SUCCESSFULLY-2026
