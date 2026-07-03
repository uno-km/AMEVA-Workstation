import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
// 포커스 영역 관리 싱글턴 — import만으로 전역 이벤트 리스너 등록
import './lib/focusRegion'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
