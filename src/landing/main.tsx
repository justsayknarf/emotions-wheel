import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './landing.css';
import { applyThemeVars, loadThemeId, THEMES } from '../config/theme';
import { Landing } from './Landing';

// Before React mounts, so the first paint already wears the selected theme.
applyThemeVars(THEMES[loadThemeId()].vars);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Landing />
  </StrictMode>,
);
