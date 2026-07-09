import { useSyncExternalStore } from 'react';

// The companion-rail layout engages on wide viewports with a fine pointer.
// Coarse/touch pointers keep the bottom sheet even on wide tablets.
const QUERY = '(min-width: 900px) and (pointer: fine)';

function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

export function useSidePanelLayout(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
