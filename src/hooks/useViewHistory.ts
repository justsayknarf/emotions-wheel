import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppView } from '../types';

// Pushes a browser history entry when entering an overlay view (history,
// constellation) so the physical back button — and an in-app back button
// wired to `goBack` — dismiss the overlay instead of leaving the app.
// Same "write triggers an event, a listener syncs state" shape as
// admin/lib/useAdminRoute.ts, but keyed off `history.state` rather than the
// URL hash: nothing here needs to be bookmarkable, and the app already
// avoids leaving app state in the visible URL (see data/source.ts).

interface ViewHistoryState {
  view: AppView;
}

function isViewHistoryState(state: unknown): state is ViewHistoryState {
  return !!state && typeof state === 'object' && 'view' in state;
}

export function useViewHistory(initial: AppView) {
  const [view, setViewState] = useState<AppView>(initial);
  const viewRef = useRef(view);
  const didInit = useRef(false);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    if (!didInit.current) {
      didInit.current = true;
      // Anchor the current history entry to the initial view so a back
      // navigation off a pushed overlay entry always has somewhere defined to land.
      window.history.replaceState({ view: initial } satisfies ViewHistoryState, '');
    }

    const onPopState = (event: PopStateEvent) => {
      setViewState(isViewHistoryState(event.state) ? event.state.view : initial);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [initial]);

  const navigateTo = useCallback((next: AppView) => {
    // Pushing history is a side effect, so it can't live inside a setState
    // updater — StrictMode double-invokes those in dev, which would push twice.
    if (viewRef.current === next) return;
    window.history.pushState({ view: next } satisfies ViewHistoryState, '');
    setViewState(next);
  }, []);

  const goBack = useCallback(() => {
    window.history.back();
  }, []);

  return { view, navigateTo, goBack };
}
