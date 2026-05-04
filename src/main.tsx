import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import './index.css'
import App from './App.tsx'
import { registerServiceWorker } from './utils/registerSW'
import { enableTouchOptimization, isTouchDevice, optimizeIOSInput } from './utils/touchOptimization'

// 注册 Service Worker（生产环境）
if (import.meta.env.PROD) {
  registerServiceWorker();
}

// 启用触摸优化（触摸设备）
if (isTouchDevice()) {
  enableTouchOptimization();
  optimizeIOSInput();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
