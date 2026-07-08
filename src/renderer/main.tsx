import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import './styles/main.css'
// 포커스 영역 관리 싱글턴 — import만으로 전역 이벤트 리스너 등록
import './lib/focusRegion'

const App = lazy(() => import('./App'))

const SplashScreen = () => (
  <div style={{
    width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', 
    justifyContent: 'center', backgroundColor: '#1e1e1e', color: '#888', 
    fontFamily: 'sans-serif', flexDirection: 'column', gap: '1.5rem'
  }}>
    <div style={{
      width: '40px', height: '40px', border: '3px solid #333', 
      borderTopColor: '#0ea5e9', borderRadius: '50%', animation: 'spin 1s linear infinite'
    }} />
    <div style={{ fontSize: '14px', letterSpacing: '0.05em' }}>Loading AMEVA Workstation...</div>
    <style>{`
      @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    `}</style>
  </div>
)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Suspense fallback={<SplashScreen />}>
      <App />
    </Suspense>
  </React.StrictMode>
)
