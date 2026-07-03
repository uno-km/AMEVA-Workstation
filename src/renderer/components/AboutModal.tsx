import React from 'react'
import { X, Award, Shield, Cpu, ExternalLink } from 'lucide-react'

interface AboutModalProps {
  isOpen: boolean
  onClose: () => void
  onOpenGithub: () => void
}

export function AboutModal({ isOpen, onClose, onOpenGithub }: AboutModalProps) {
  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'var(--bg-deep)',
        opacity: 0.95,
        backdropFilter: 'blur(12px)',
        zIndex: 10001,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        className="glass-panel glow-primary"
        style={{
          width: '90%',
          maxWidth: '560px',
          borderRadius: '16px',
          border: '1px solid var(--border-glow)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px rgba(139, 92, 246, 0.35)',
          animation: 'scaleUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
          color: 'var(--text-main)',
        }}
      >
        {/* 헤더 */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-muted)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--bg-glass-active)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
            <Award size={20} />
            <h3 style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'var(--font-sans)' }}>About AMEVA Ecosystem</h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* 바디 */}
        <div style={{ padding: '30px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* 아메바 로고 이미지 구역 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '32px',
                fontWeight: 900,
                boxShadow: '0 0 25px var(--primary-glow)',
              }}
            >
              A
            </div>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '0.5px' }}>
                AMEVA <span style={{ color: 'var(--primary)' }}>Model Nexus</span>
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Version 1.0.0 (Enterprise Gold Release)
              </p>
            </div>
          </div>

          <div style={{ height: '1px', backgroundColor: 'var(--border-muted)' }} />

          {/* 에코시스템 목적 소개 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', lineHeight: '1.6', fontSize: '13px' }}>
            <p>
              <strong>아메바(AMEVA) 생태계</strong>는 개발자, 연구원, 기업이 디지털 문서를 단 하나의 툴에서 완벽하게 창작,
              분석, 시각화하고 최종 빌드할 수 있는 통합 문서 플랫폼을 지향합니다.
            </p>
            <p>
              단순한 텍스트 편집의 한계를 넘어, **실시간 Yjs 협업 엔진**을 탑재하여 언제 어디서나 안전하게 공동 연구 및
              편집을 진행할 수 있으며, 격리된 터미널 샌드박스로 마크다운 문서 내에서 코드를 즉각 기동할 수 있습니다.
            </p>
            <div
              style={{
                background: 'rgba(139, 92, 246, 0.08)',
                border: '1px solid rgba(139, 92, 246, 0.15)',
                borderRadius: '8px',
                padding: '12px 16px',
                marginTop: '10px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
              }}
            >
              <Cpu size={18} style={{ color: 'var(--primary)', marginTop: '2px' }} />
              <div>
                <h4 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)' }}>오픈 스펙 표준 변환 지원</h4>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Word, Excel, PDF, HTML, XML은 물론 한글 HWPX 규격까지 무손실 빌드를 보장합니다.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 푸터 */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-muted)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            backgroundColor: 'var(--bg-glass-active)',
          }}
        >
          <button className="btn btn-glass" style={{ fontSize: '12px' }} onClick={onOpenGithub}>
            <ExternalLink size={12} /> Contact Us (Github)
          </button>
          <button className="btn btn-primary" style={{ padding: '6px 20px', fontSize: '12px' }} onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
