import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import { applyThemeVars, loadThemeId, THEMES } from '../config/theme';
import { AdminApp } from './App';

// Applied synchronously, before React mounts, so admin's own chrome reflects
// whichever theme is selected rather than flashing the shipped default.
applyThemeVars(THEMES[loadThemeId()].vars);

createRoot(document.getElementById('admin-root')!).render(
  <StrictMode>
    <AdminApp />
  </StrictMode>,
);
