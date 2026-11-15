import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initPwaUpdates } from './services/pwaUpdateService'
import { startDebugLog } from './services/debugLogService'

// 開発用のデバッグログ（落ちる直前の記録を端末に残す）。最初に始めて、起動中のエラーも拾う
startDebugLog()

// Service Worker の登録と自動アップデートの監視
initPwaUpdates()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
