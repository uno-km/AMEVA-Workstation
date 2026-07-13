/**
 * @file AIPanelHeader.tsx
 * @system AMEVA OS Desktop Workstation - Client Renderer
 * @location src/renderer/components/ai/AIPanelHeader.tsx
 * @role Presentational Component for AI Panel Header Info & Control Actions
 * 
 * [소비처 - CONSUMERS / USAGE CONTEXT]
 * - 소비처 A (src/renderer/components/AIPanel.tsx): AI 패널 상단 상태 표시줄 및 대화방 초기화/설정 액션용 뷰포트로 임포트되어 소비함.
 * - 결합 규격: 본 헤더는 AI 제어 스토어 상태(`isGenerating` 등)를 Props 형태로 투영받아 연동 구동되어야 함.
 * 
 * [책임 범위 - RESPONSIBILITY]
 * - AI 패널 상단에 추론 타깃 엔진 종류(title) 및 공급 모델 정보(providerLabel, modelLabel)를 안전하게 표시한다.
 * - AI 설정 모달을 트리거하는 콜백과 패널 종료(onClose) 트리거 버튼을 사용자 화면에 바인딩한다.
 * - 생성 중(isGenerating=true)일 때, 회전하는 로더 아이콘(`Loader2` with spin animation)을 노출하여 피드백을 제공한다.
 * - 대화 기록이 존재할 때 대화를 초기화하는 휴지통(`Trash2` with onClearMessages) 버튼을 렌더링한다.
 * 
 * [책임이 아닌 것 - NON-RESPONSIBILITY]
 * - 실제 AI 상태 관리, 설정 값 변경 수행, 혹은 대화 목록 데이터 초기화 수행 (상위 훅 useAI에서 처리 후 props로 내려받음).
 * 
 * [절대 깨면 안 되는 계약 - CONTRACT]
 * - isGenerating이 true일 때, 반드시 로딩 애니메이션 스피너가 지속적으로 렌더링되어야 하며,
 *   그 외의 대기 상황에서는 정적인 Sparkles 아이콘을 유지할 것.
 * - `spin` 애니메이션은 `src/renderer/styles/base.css`에 글로벌 키프레임 `@keyframes spin`이 존재함에 의존하므로,
 *   인라인 스타일 `animation: 'spin 1s linear infinite'` 형식을 임의 변경하지 말 것.
 */

/* 
 * [IMPORT SEGMENTATION & CONTRACTS]
 * - Settings2: AI 설정 톱니바퀴 아이콘.
 * - X: 패널 닫기 버튼 아이콘.
 * - Sparkles: 유휴(idle) 상태 표시 반짝이 아이콘.
 * - Trash2: 대화 지우기 휴지통 아이콘.
 * - Loader2: 생성 중(loading) 회전 스피너 아이콘.
 */
import { Settings2, X, Sparkles, Trash2, Loader2 } from 'lucide-react'

/**
 * @interface AIPanelHeaderProps
 * @description AIPanelHeader 렌더링에 요구되는 엄격한 속성 정의.
 */
export interface AIPanelHeaderProps {
  /** LLM 엔진 타입 분류 라벨 (wasm/local/ollama/api) */
  title: string
  /** 제공 서비스 사명 (Google Gemini / OpenAI GPT / WebGPU 등) */
  providerLabel: string
  /** 현재 활성화된 세부 모델 정보 */
  modelLabel: string
  /** 설정 버튼 마우스 클릭 시 핸들러 */
  onOpenSettings: () => void
  /** 패널 닫기 버튼 마우스 클릭 시 핸들러 (선택적) */
  onClose?: () => void
  /** 생성 중 여부 상태 (참일 때 스피너 회전) */
  isGenerating?: boolean
  /** 대화 기록 초기화 클릭 핸들러 (존재할 때만 휴지통 노출) */
  onClearMessages?: () => void
  /** 딥리즈닝 모드 활성화 여부 */
  deepReasoning?: boolean
  /** 딥리즈닝 모드 토글 이벤트 핸들러 */
  onToggleDeepReasoning?: () => void
}

/**
 * @component AIPanelHeader
 * @description AI 패널 전용 정보 지표 표시 및 설정 버튼을 구성하는 프리젠테이션 컴포넌트.
 */
export function AIPanelHeader({
  /*
   * [PROPERTY CONTRACTS]
   * - title: Local/Cloud/Ollama 타이틀 뱃지 텍스트.
   * - providerLabel: 엔진 제조사 표기 텍스트.
   * - modelLabel: 로드된 세부 모델 모델명.
   * - onOpenSettings: 기동 설정 모달 트리거.
   * - onClose: 패널 닫기 트리거.
   * - isGenerating: 로딩 스피너 활성 플래그.
   * - onClearMessages: 대화 비우기 동작 바인더.
   */
  title,
  providerLabel,
  modelLabel,
  onOpenSettings,
  onClose,
  isGenerating,
  onClearMessages,
  deepReasoning,
  onToggleDeepReasoning
}: AIPanelHeaderProps) {
  return (
    <div style={{
      padding: '14px 16px 10px',
      borderBottom: '1px solid var(--border-muted)',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      flexShrink: 0,
      flexWrap: 'nowrap',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      {/* 
       * [VISUAL INDICATOR STATUS]
       * - AI가 연산 중일 때 `Loader2`에 스핀 효과를 준 로더를 그리고,
       *   유휴 상태일 때는 그라데이션 광원이 스며든 Sparkles 아이콘을 렌더링한다.
       * - ADR: 사용자 인디케이터 인식률 극대화를 위해 배경에 은은한 primary-glow 효과(boxShadow)를 입힌 디자인을 채택함.
       */
      }
      <div style={{
        width: '28px', height: '28px', borderRadius: '8px',
        background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 0 12px var(--primary-glow)',
        flexShrink: 0,
      }}>
        {isGenerating ? (
          <Loader2 size={14} color="#fff" style={{ animation: 'spin 1s linear infinite' }} />
        ) : (
          <Sparkles size={14} color="#fff" />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.3px', flexShrink: 0 }}>
            AMEVA <span style={{ color: 'var(--primary)' }}>AI</span>
          </span>
          <span style={{
            fontSize: '9px',
            padding: '2px 6px',
            background: 'color-mix(in srgb, var(--primary) 15%, transparent)',
            border: '1px solid color-mix(in srgb, var(--primary) 40%, transparent)',
            borderRadius: '4px',
            color: 'var(--text-main)',
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}>
            {title}
          </span>
        </div>
        <div style={{
          fontSize: '10px',
          color: 'var(--text-muted)',
          marginTop: '2px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {providerLabel} {modelLabel ? `(${modelLabel})` : ''}
        </div>
      </div>

      {/* 🧠 딥리즈닝 똑딱이 토글 스위치 */}
      {onToggleDeepReasoning && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: '6px', flexShrink: 0 }}>
          <span 
            style={{ 
              fontSize: '11px', 
              fontWeight: 600, 
              color: deepReasoning ? 'var(--primary)' : 'var(--text-muted)',
              transition: 'color 0.15s ease',
              userSelect: 'none'
            }}
          >
            🧠 딥리즈닝
          </span>
          <button
            onClick={onToggleDeepReasoning}
            style={{
              width: '26px',
              height: '14px',
              borderRadius: '9999px',
              background: deepReasoning ? 'var(--primary)' : 'var(--border-muted)',
              border: 'none',
              position: 'relative',
              cursor: 'pointer',
              padding: 0,
              transition: 'background-color 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)'
            }}
            title={deepReasoning ? "딥리즈닝 활성화됨" : "딥리즈닝 비활성화됨"}
          >
            <div 
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: '#ffffff',
                position: 'absolute',
                left: deepReasoning ? '14px' : '2px',
                transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.4)'
              }} 
            />
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
        {onClearMessages && (
          <button
            onClick={onClearMessages}
            style={{
              background: 'transparent',
              border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
              padding: '4px', borderRadius: '5px', transition: 'all 0.15s',
              flexShrink: 0,
            }}
            title="대화 비우기"
          >
            <Trash2 size={14} />
          </button>
        )}
        <button
          onClick={onOpenSettings}
          style={{
            background: 'transparent',
            border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
            padding: '4px', borderRadius: '5px', transition: 'all 0.15s',
            flexShrink: 0,
          }}
          title="AI 설정"
        >
          <Settings2 size={14} />
        </button>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
              padding: '4px', borderRadius: '5px',
              flexShrink: 0,
            }}
            title="패널 닫기"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * ============================================================================
 * FUTURE DEVELOPMENT GUIDE (AI Agent Instruction Layer)
 * ============================================================================
 * 1. 신규 헤더 제어 버튼(예: 피드백 전송, 대화 다운로드 등)을 추가할 때:
 *    - `<div style={{ display: 'flex', gap: '4px', ... }}>` 버튼 컨테이너 목록의 처음에 배치할 것.
 *    - lucide-react에서 적절한 규격의 14px 크기 아이콘을 가져올 것.
 * 
 * 2. 아이콘이나 배경색 호환성 이슈 발생 시:
 *    - AMEVA 전역 테마(White, Dark 등)에 맞게 CSS variables(`var(--text-muted)`, `var(--primary)`)가
 *      정상적으로 로드되고 적용되는지 검사할 것.
 * ============================================================================
 */

