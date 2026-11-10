import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@dgtx/ui-frek/fonts.css'
import '@dgtx/ui-frek/styles.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
