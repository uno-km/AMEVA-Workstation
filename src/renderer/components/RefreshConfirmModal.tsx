import { RotateCw } from 'lucide-react'

export interface RefreshConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
}

/*
 * RefreshConfirmModal.tsx
 *
 * 새로고침(Ctrl+Shift+R) 동작 전 사용자 동의를 구하는 팝업 모달.
 *
 * [버그 해결 핵심 조치]
 * ─────────────────────────────────────────────────────────────
 * 1. 수동 포커스 및 setTimeout 전면 제거:
 *    이전 코드에서 50ms 딜레이로 containerRef와 confirmBtnRef에 동시에 수동 focus()를 주던 중,
 *    FreeModal 등의 handleModalFocus 이벤트와 얽히며 포커스-렌더 무한 루프 데드락(프리징)이 발생했습니다.
 *    이 수동 포커싱 장치들을 모두 걷어냅니다.
 *
 * 2. HTML5 표준 autoFocus 활용:
 *    새로고침(Enter) 버튼에 'autoFocus' 속성을 직접 부여하여 브라우저 엔진이 마운트 시점에
 *    단 한 번만 안전하게 포커스를 잡도록 유도합니다. 이 조치로 엔터 키가 100% 즉각 반응합니다.
 *
 * 3. pointer-events 및 z-index 최적화:
 *    zIndex: 999999로 최상위에 띄우고, 백드롭을 클릭하면 닫히게 하되,
 *    모달 본체 카드 내부에서는 전파를 확실히 차단(stopPropagation)하여 취소/새로고침 버튼이 정확히 클릭됩니다.
 */
export function RefreshConfirmModal({ isOpen, onClose, onConfirm }: RefreshConfirmModalProps) {
  if (!isOpen) return null

  return (
    <div 
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(5px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 999999,
        pointerEvents: 'auto'
      }} 
      onClick={onClose}
    >
      <div 
        style={{
          background: 'var(--bg-main)', 
          border: '1px solid var(--border-glow)',
          borderRadius: '12px', width: '400px', padding: '24px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)', 
          display: 'flex', flexDirection: 'column', gap: '16px',
          pointerEvents: 'auto'
        }} 
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <RotateCw size={20} color="#3b82f6" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '15px', color: 'var(--text-main)', fontWeight: 800 }}>새로고침 하시겠습니까?</h2>
            <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: '1.4' }}>모든 임시 작업이 초기화되며 최초 화면으로 이동합니다.</p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
          <button 
            onClick={onClose} 
            style={{
              padding: '8px 16px', background: 'transparent', border: '1px solid var(--border-muted)',
              borderRadius: '6px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12.5px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-glass-active)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            취소 (Esc)
          </button>
          <button 
            autoFocus // 브라우저 표준 autoFocus 지정 (데드락 없음)
            onClick={onConfirm} 
            style={{
              padding: '8px 16px', background: 'var(--primary)', border: 'none',
              borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '12.5px', fontWeight: 'bold',
              boxShadow: '0 0 10px var(--primary-glow)',
              transition: 'opacity 0.2s',
              outline: 'none'
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            새로고침 (Enter)
          </button>
        </div>
      </div>
    </div>
  )
}



