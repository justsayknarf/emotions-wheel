import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { applyThemeVars, loadThemeId, THEMES } from './config/theme'
import App from './App'

// Applied synchronously, before React mounts, so the first paint already
// reflects a theme picked in the admin page rather than flashing the
// shipped default.
applyThemeVars(THEMES[loadThemeId()].vars)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
