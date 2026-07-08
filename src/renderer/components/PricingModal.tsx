import { useState, useEffect } from 'react'
import { X, Check, Award, Sparkles, Shield, Key, Network } from 'lucide-react'
import * as ipc from '../services/ipc/electronApiAdapter'

interface PricingModalProps {
  isOpen: boolean
  onClose: () => void
}

export function PricingModal({ isOpen, onClose }: PricingModalProps) {
  const [isPro, setIsPro] = useState(false)
  const [isFreeLocked, setIsFreeLocked] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setIsPro(localStorage.getItem('is-pro-plan') === 'true')
      
      ipc.isFreeMode().then((free: boolean) => {
        setIsFreeLocked(free)
      }).catch(() => {})
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleFreeAction = async () => {
    if (isPro) {
      if (confirm('Downgrade to Free Plan? (This will reload the application)')) {
        await ipc.planSetStatus(false)
        localStorage.setItem('is-pro-plan', 'false')
        window.location.reload()
      }
    }
  }

  const handleProAction = async () => {
    if (isPro) return

    if (isFreeLocked) {
      alert('무료 버전 강제 데모 모드(--free) 상태에서는 Pro Plan으로 업그레이드할 수 없습니다.')
      return
    }

    if (confirm('Upgrade to Pro Plan? (This will reload the application)')) {
      const result = await ipc.planSetStatus(true)
      if (result && !result.success) {
        alert(`업그레이드 실패: ${result.error}`)
        return
      }
      localStorage.setItem('is-pro-plan', 'true')
      window.location.reload()
    }
  }

  const handleEnterpriseAction = () => {
    window.open('https://github.com/uno-km/AMEVA-Workstation', '_blank')
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'var(--bg-glass-active)',
        backdropFilter: 'blur(20px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 11000,
        userSelect: 'none'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '840px',
          height: '560px',
          background: 'var(--bg-panel)',
          border: '1px solid var(--border-muted)',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5), 0 0 40px color-mix(in srgb, var(--primary) 10%, transparent)',
          overflow: 'hidden',
          position: 'relative',
          color: 'var(--text-main)',
          fontFamily: 'var(--font-sans)'
        }}
      >
        {/* 장식적 네온 보더라인 */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '3px', background: 'linear-gradient(90deg, #a855f7, #06b6d4, #10b981)' }} />

        {/* 헤더 */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award size={18} style={{ color: 'var(--primary)' }} />
            <span style={{ fontSize: '13.5px', fontWeight: 800, letterSpacing: '0.5px' }}>
              AMEVA Workstation Subscription Plans & Capability Matrix
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '4px',
              transition: 'color 0.15s'
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#fff'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            <X size={16} />
          </button>
        </div>

        {/* 바디 (요금제 매트릭스 카드 3개 수평 배치) */}
        <div
          style={{
            flex: 1,
            padding: '20px 24px',
            display: 'flex',
            gap: '16px',
            overflowY: 'auto'
          }}
        >
          {/* 1. Free Plan Card */}
          <div
            style={{
              flex: 1,
              background: 'color-mix(in srgb, var(--bg-main) 50%, transparent)',
              border: '1px solid var(--border-muted)',
              borderRadius: '12px',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'border-color 0.2s'
            }}
          >
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>FREE PLAN</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px', margin: '6px 0 12px' }}>
                <span style={{ fontSize: '24px', fontWeight: 900 }}>$0</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>/ month</span>
              </div>
              
              {/* 장점 요약 */}
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '6px 10px', marginBottom: '12px', fontSize: '9px', color: 'var(--text-muted)' }}>
                <strong>Advantage:</strong> Distraction-free writing with absolute offline local privacy.
              </div>

              <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', marginBottom: '12px' }} />
              
              {/* 기능 상세 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '8.5px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '3px' }}>Permissions</div>
                  <div style={{ fontSize: '9px', color: 'var(--text-main)' }}>• Restricted local filesystem access<br />• Closed local-loop (no outbound network)</div>
                </div>
                <div>
                  <div style={{ fontSize: '8.5px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '3px' }}>Limits & Usage</div>
                  <div style={{ fontSize: '9px', color: 'var(--text-main)' }}>• Up to 10 local AI generations / day<br />• Single document tab only</div>
                </div>
                <div>
                  <div style={{ fontSize: '8.5px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '3px' }}>Core Capabilities</div>
                  <div style={{ fontSize: '9px', color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Check size={10} style={{ color: 'var(--text-muted)' }} /> Collaborative text editing</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Check size={10} style={{ color: 'var(--text-muted)' }} /> Basic Markdown syntax rendering</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Check size={10} style={{ color: 'var(--text-muted)' }} /> Local llama-server fallback</span>
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={handleFreeAction}
              style={{
                width: '100%',
                padding: '6px',
                background: isPro ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.04)',
                border: isPro ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(255,255,255,0.08)',
                borderRadius: '6px',
                color: isPro ? '#f87171' : 'var(--text-muted)',
                fontSize: '9.5px',
                fontWeight: 700,
                cursor: isPro ? 'pointer' : 'default',
                marginTop: '16px'
              }}
            >
              {isPro ? 'Downgrade to Free' : 'Current Active Plan'}
            </button>
          </div>

          {/* 2. Pro Plan Card (Recommended) */}
          <div
            style={{
              flex: 1,
              background: 'linear-gradient(180deg, color-mix(in srgb, var(--primary) 5%, transparent) 0%, transparent 100%)',
              border: '1px solid color-mix(in srgb, var(--primary) 40%, transparent)',
              boxShadow: '0 0 15px color-mix(in srgb, var(--primary) 8%, transparent)',
              borderRadius: '12px',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
              transform: 'scale(1.01)'
            }}
          >
            <div style={{
              position: 'absolute', top: '-10px', right: '14px',
              background: 'var(--primary)', color: '#fff', fontSize: '7.5px',
              fontWeight: 800, padding: '2px 6px', borderRadius: '10px',
              letterSpacing: '0.5px'
            }}>
              POPULAR
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                PRO PLAN <Sparkles size={11} />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px', margin: '6px 0 12px' }}>
                <span style={{ fontSize: '24px', fontWeight: 900, color: 'var(--primary)' }}>$12</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>/ month</span>
              </div>

              {/* 장점 요약 */}
              <div style={{ background: 'rgba(168,85,247,0.08)', borderRadius: '6px', padding: '6px 10px', marginBottom: '12px', fontSize: '9px', color: 'var(--text-main)' }}>
                <strong>Advantage:</strong> Supercharge writing with local sandboxes, web searches & agentic tools.
              </div>

              <div style={{ height: '1px', background: 'rgba(168,85,247,0.2)', marginBottom: '12px' }} />

              {/* 기능 상세 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '8.5px', color: '#a855f7', fontWeight: 800, textTransform: 'uppercase', marginBottom: '3px' }}>Permissions</div>
                  <div style={{ fontSize: '9px', color: 'var(--text-main)' }}>• Full local workspace read/write access<br />• Outbound networks for DuckDuckGo queries</div>
                </div>
                <div>
                  <div style={{ fontSize: '8.5px', color: '#a855f7', fontWeight: 800, textTransform: 'uppercase', marginBottom: '3px' }}>Limits & Usage</div>
                  <div style={{ fontSize: '9px', color: 'var(--text-main)' }}>• Unlimited local/cloud AI inferencing<br />• Unlimited custom MCP Server integrations</div>
                </div>
                <div>
                  <div style={{ fontSize: '8.5px', color: '#a855f7', fontWeight: 800, textTransform: 'uppercase', marginBottom: '3px' }}>Core Capabilities</div>
                  <div style={{ fontSize: '9px', color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Check size={10} style={{ color: 'var(--primary)' }} /> <strong>Advanced AI ReAct Assistant</strong></span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Check size={10} style={{ color: 'var(--primary)' }} /> <strong>Sequential Request Queue</strong> buffering</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Check size={10} style={{ color: 'var(--primary)' }} /> Live Mouse presence & Selection sharing</span>
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={handleProAction}
              style={{
                width: '100%',
                padding: '6px',
                background: isPro ? 'rgba(168, 85, 247, 0.12)' : 'var(--primary)',
                border: isPro ? '1px solid rgba(168, 85, 247, 0.3)' : 'none',
                borderRadius: '6px',
                color: isPro ? '#a855f7' : '#fff',
                fontSize: '9.5px',
                fontWeight: 700,
                cursor: isPro ? 'default' : 'pointer',
                marginTop: '16px',
                boxShadow: isPro ? 'none' : '0 4px 10px rgba(168, 85, 247, 0.25)'
              }}
            >
              {isPro ? 'Current Active Plan ✓' : 'Upgrade to Pro Plan'}
            </button>
          </div>

          {/* 3. Enterprise Plan Card */}
          <div
            style={{
              flex: 1,
              background: 'rgba(255, 255, 255, 0.01)',
              border: '1px solid rgba(255, 255, 255, 0.04)',
              borderRadius: '12px',
              padding: '18px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
          >
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#06b6d4' }}>ENTERPRISE</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px', margin: '6px 0 12px' }}>
                <span style={{ fontSize: '20px', fontWeight: 900 }}>Custom</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>/ contact</span>
              </div>

              {/* 장점 요약 */}
              <div style={{ background: 'rgba(6,182,212,0.06)', borderRadius: '6px', padding: '6px 10px', marginBottom: '12px', fontSize: '9px', color: 'var(--text-main)' }}>
                <strong>Advantage:</strong> Iron-clad secure environments, hardware tokens & audio communications.
              </div>

              <div style={{ height: '1px', background: 'rgba(6,182,212,0.2)', marginBottom: '12px' }} />

              {/* 기능 상세 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '8.5px', color: '#06b6d4', fontWeight: 800, textTransform: 'uppercase', marginBottom: '3px' }}>Permissions</div>
                  <div style={{ fontSize: '9px', color: 'var(--text-main)' }}>• <strong>OS Keychain API</strong> hardware token guard<br />• Complete isolation from guest collab channels</div>
                </div>
                <div>
                  <div style={{ fontSize: '8.5px', color: '#06b6d4', fontWeight: 800, textTransform: 'uppercase', marginBottom: '3px' }}>Limits & Usage</div>
                  <div style={{ fontSize: '9px', color: 'var(--text-main)' }}>• Unlimited Request Queue stacking<br />• Dedicated LLM cluster priority access</div>
                </div>
                <div>
                  <div style={{ fontSize: '8.5px', color: '#06b6d4', fontWeight: 800, textTransform: 'uppercase', marginBottom: '3px' }}>Core Capabilities</div>
                  <div style={{ fontSize: '9px', color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Check size={10} style={{ color: '#06b6d4' }} /> <strong>WebRTC Live Voice Chatting</strong></span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Check size={10} style={{ color: '#06b6d4' }} /> Virtual SQLite backup snapshot auto-sync</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Check size={10} style={{ color: '#06b6d4' }} /> Single Sign-On (SSO) & LDAP directory</span>
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={handleEnterpriseAction}
              style={{
                width: '100%',
                padding: '6px',
                background: 'rgba(6, 182, 212, 0.08)',
                border: '1px solid rgba(6, 182, 212, 0.25)',
                borderRadius: '6px',
                color: '#22d3ee',
                fontSize: '9.5px',
                fontWeight: 700,
                cursor: 'pointer',
                marginTop: '16px'
              }}
            >
              Contact Enterprise Sales
            </button>
          </div>
        </div>

        {/* 푸터 알림 */}
        <div style={{
          padding: '12px 24px',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          background: 'rgba(0, 0, 0, 0.15)',
          fontSize: '9px',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#fb7185' }}>
            <Shield size={12} /> OS Keychain Protection
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#67e8f9' }}>
            <Key size={12} /> OAuth Tokens isolated
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#86efac' }}>
            <Network size={12} /> WebRTC Dual-audio
          </span>
        </div>
      </div>
    </div>
  )
}
