import { ToggleLeft, ToggleRight } from 'lucide-react'
import type { AppSettings } from '../SettingsModal'

export interface SettingsTabGeneralProps {
  activeTab: string
  settings: AppSettings
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void
  isProPlan: boolean
  handleToggleProPlan: () => void | Promise<void>
}

export function SettingsTabGeneral({
  activeTab,
  settings,
  onUpdateSettings,
  isProPlan,
  handleToggleProPlan,
}: SettingsTabGeneralProps) {
  if (activeTab !== 'General') return null

  return (
    <>
      <h3 style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 6px' }}>General Settings</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '11.5px', fontWeight: 700 }}>실시간 타인 포인터 표시</div>
            <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginTop: '2px' }}>동료의 실시간 마우스 움직임을 화면에 투사합니다.</div>
          </div>
          <button onClick={() => onUpdateSettings({ showPeersPointer: !settings.showPeersPointer })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}>
            {settings.showPeersPointer ? <ToggleRight size={26} /> : <ToggleLeft size={26} style={{ color: 'var(--text-dark)' }} />}
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '11.5px', fontWeight: 700 }}>타인 텍스트 드래그 동기화</div>
            <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginTop: '2px' }}>동료의 선택 영역 렉트 하이라이트를 실시간 표시합니다.</div>
          </div>
          <button onClick={() => onUpdateSettings({ showPeersDrag: !settings.showPeersDrag })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}>
            {settings.showPeersDrag ? <ToggleRight size={26} /> : <ToggleLeft size={26} style={{ color: 'var(--text-dark)' }} />}
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '11.5px', fontWeight: 700 }}>코드 샌드박스 콘솔 도크</div>
            <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginTop: '2px' }}>에디터 아래에 코드 퀵 런타임 위젯을 상시 노출합니다.</div>
          </div>
          <button onClick={() => onUpdateSettings({ showCodeConsole: !settings.showCodeConsole })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}>
            {settings.showCodeConsole ? <ToggleRight size={26} /> : <ToggleLeft size={26} style={{ color: 'var(--text-dark)' }} />}
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '11.5px', fontWeight: 700 }}>줄바꿈 비활성화 (가로 스크롤)</div>
            <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginTop: '2px' }}>텍스트 자동 줄바꿈을 풀고 가로 스크롤로 문장을 표출합니다.</div>
          </div>
          <button onClick={() => onUpdateSettings({ wordWrap: !settings.wordWrap })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}>
            {!settings.wordWrap ? <ToggleRight size={26} /> : <ToggleLeft size={26} style={{ color: 'var(--text-dark)' }} />}
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '11.5px', fontWeight: 700 }}>에디터 우측 미니맵 표시</div>
            <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginTop: '2px' }}>오른쪽에 전체 레이아웃 시각화 Minimap 바를 표시합니다.</div>
          </div>
          <button onClick={() => onUpdateSettings({ showMinimap: !settings.showMinimap })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}>
            {settings.showMinimap ? <ToggleRight size={26} /> : <ToggleLeft size={26} style={{ color: 'var(--text-dark)' }} />}
          </button>
        </div>

        <div style={{ height: '1px', backgroundColor: 'var(--border-muted)', margin: '4px 0' }} />

        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          background: 'rgba(168, 85, 247, 0.05)',
          border: '1px dashed rgba(168, 85, 247, 0.3)',
          borderRadius: '8px',
          padding: '10px 12px'
        }}>
          <div>
            <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--primary)' }}>👑 AMEVA Pro 플랜 활성화</div>
            <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
              유료 기능을 활성화합니다. 마켓플레이스 접근 및 외부 MCP 서버(Stdio/HTTP) 매니저 탭이 개방됩니다.
            </div>
          </div>
          <button onClick={handleToggleProPlan} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}>
            {isProPlan ? <ToggleRight size={26} /> : <ToggleLeft size={26} style={{ color: 'var(--text-dark)' }} />}
          </button>
        </div>
      </div>
    </>
  )
}
