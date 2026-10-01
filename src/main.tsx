import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { applyThemeVars, loadThemeId, THEMES } from './config/theme'
import { loadTuning, saveTuning } from './config/revealTuning'
import App from './App'
import { VOCABULARY_STORAGE_KEY } from './data/frameworks'

// Applied synchronously, before React mounts, so the first paint already
// reflects a theme picked in the admin page rather than flashing the
// shipped default.
applyThemeVars(THEMES[loadThemeId()].vars)

// ?field=sky or ?field=flat persists the field view on deployed builds,
// where the admin tuning page isn't served.
const fieldParam = new URLSearchParams(window.location.search).get('field')
if (fieldParam === 'sky' || fieldParam === 'flat') {
  saveTuning({ ...loadTuning(), skyField: fieldParam === 'sky' })
}

// The vocabulary is read once at load, so a switch made on the admin page
// (another tab) takes effect by reloading.
window.addEventListener('storage', (e) => {
  if (e.key === VOCABULARY_STORAGE_KEY) window.location.reload()
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
