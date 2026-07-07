
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
            <div style={{ fontSize: '11.5px', fontWeight: 700 }}>?¤ì‹œê°??€???¬ì¸???œì‹œ</div>
            <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginTop: '2px' }}>?™ë£Œ???¤ì‹œê°?ë§ˆìš°???€ì§ì„???”ë©´???¬ì‚¬?©ë‹ˆ??</div>
          </div>
          <button onClick={() => onUpdateSettings({ showPeersPointer: !settings.showPeersPointer })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}>
            {settings.showPeersPointer ? <ToggleRight size={26} /> : <ToggleLeft size={26} style={{ color: 'var(--text-dark)' }} />}
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '11.5px', fontWeight: 700 }}>?€???ìŠ¤???œë˜ê·??™ê¸°??/div>
            <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginTop: '2px' }}>?™ë£Œ??? íƒ ?ì—­ ?‰íŠ¸ ?˜ì´?¼ì´?¸ë? ?¤ì‹œê°??œì‹œ?©ë‹ˆ??</div>
          </div>
          <button onClick={() => onUpdateSettings({ showPeersDrag: !settings.showPeersDrag })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}>
            {settings.showPeersDrag ? <ToggleRight size={26} /> : <ToggleLeft size={26} style={{ color: 'var(--text-dark)' }} />}
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '11.5px', fontWeight: 700 }}>ì½”ë“œ ?Œë“œë°•ìŠ¤ ì½˜ì†” ?„í¬</div>
            <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginTop: '2px' }}>?ë””???„ë˜??ì½”ë“œ ???°í????„ì ¯???ì‹œ ?¸ì¶œ?©ë‹ˆ??</div>
          </div>
          <button onClick={() => onUpdateSettings({ showCodeConsole: !settings.showCodeConsole })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}>
            {settings.showCodeConsole ? <ToggleRight size={26} /> : <ToggleLeft size={26} style={{ color: 'var(--text-dark)' }} />}
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '11.5px', fontWeight: 700 }}>ì¤„ë°”ê¿?ë¹„í™œ?±í™” (ê°€ë¡??¤í¬ë¡?</div>
            <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginTop: '2px' }}>?ìŠ¤???ë™ ì¤„ë°”ê¿ˆì„ ?€ê³?ê°€ë¡??¤í¬ë¡¤ë¡œ ë¬¸ì¥???œì¶œ?©ë‹ˆ??</div>
          </div>
          <button onClick={() => onUpdateSettings({ wordWrap: !settings.wordWrap })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}>
            {!settings.wordWrap ? <ToggleRight size={26} /> : <ToggleLeft size={26} style={{ color: 'var(--text-dark)' }} />}
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '11.5px', fontWeight: 700 }}>?ë””???°ì¸¡ ë¯¸ë‹ˆë§??œì‹œ</div>
            <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginTop: '2px' }}>?¤ë¥¸ìª½ì— ?„ì²´ ?ˆì´?„ì›ƒ ?œê°??Minimap ë°”ë? ?œì‹œ?©ë‹ˆ??</div>
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
            <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--primary)' }}>?‘‘ AMEVA Pro ?Œëœ ?œì„±??/div>
            <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
              ? ë£Œ ê¸°ëŠ¥???œì„±?”í•©?ˆë‹¤. ë§ˆì¼“?Œë ˆ?´ìŠ¤ ?‘ê·¼ ë°??¸ë? MCP ?œë²„(Stdio/HTTP) ë§¤ë‹ˆ?€ ??´ ê°œë°©?©ë‹ˆ??
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
