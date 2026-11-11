import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/flatpickr-theme.css'
import App from './App.tsx'
import { attemptStaleChunkReload } from './utils/chunkRecovery'

// Recover cleanly when a new Vite deployment invalidates cached chunk hashes in open tabs
window.addEventListener('vite:preloadError', (event) => {
  if (attemptStaleChunkReload()) {
    event.preventDefault()
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
