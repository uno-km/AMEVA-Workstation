/**
 * @file AIWelcomeScreen.tsx
 * @system AMEVA OS Desktop Workstation
 * @location src/renderer/components/ai/AIWelcomeScreen.tsx
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

import { Bot } from 'lucide-react'

export function AIWelcomeScreen({ QUICK_ACTIONS, isAvailable, onAction }: any) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      color: 'var(--text-muted)', padding: '40px 20px', textAlign: 'center'
    }}>
      <div style={{ marginBottom: '24px', opacity: 0.8 }}>
        <div style={{
          width: '64px', height: '64px', borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(6,182,212,0.1), rgba(124,58,237,0.1))',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px'
        }}>
          <Bot size={32} color="var(--primary)" />
        </div>
        <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-main)', fontSize: '16px', fontWeight: 600 }}>
          AMEVA AI Assistant
        </h3>
        <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.5' }}>
          무엇을 도와드릴까요?
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', width: '100%', maxWidth: '280px' }}>
        {QUICK_ACTIONS.map((action: any) => (
          <button
            key={action.id}
            onClick={() => onAction(action.prompt)}
            disabled={!isAvailable}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 12px', borderRadius: '10px',
              background: 'var(--bg-glass-active)', border: '1px solid var(--border-muted)',
              color: 'var(--text-on-active)', cursor: isAvailable ? 'pointer' : 'not-allowed',
              opacity: isAvailable ? 1 : 0.5,
              fontSize: '12px', textAlign: 'left', transition: 'all 0.2s',
            }}
          >
            <action.icon size={14} style={{ color: 'var(--primary)' }} />
            {action.label}
          </button>
        ))}
      </div>
    </div>
  )
}
