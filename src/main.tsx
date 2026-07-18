import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './app/App.tsx'
import { configurePwaUpdate, notifyPwaUpdateAvailable } from './lib/pwaUpdate'

configurePwaUpdate(
  registerSW({
    immediate: true,
    onNeedRefresh: notifyPwaUpdateAvailable,
  }),
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
