import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { remoteLog } from './remoteLog'
import './index.css'

void remoteLog.start()
remoteLog.log(`page loading: ${location.href}`)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

remoteLog.log('page ready')
