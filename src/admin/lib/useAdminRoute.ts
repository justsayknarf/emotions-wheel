import { useEffect, useState } from 'react';

// Hash-based routing between admin's pages — no router dependency, just
// enough to make each section its own bookmarkable, back-button-able page.
// Writing the hash triggers the browser's own `hashchange` event, which the
// listener below turns back into state — the same "write triggers an event,
// a listener syncs state" shape as theme.ts/revealTuning.ts use for
// cross-tab sync, just same-tab here since there's nothing to persist.

export const ADMIN_ROUTES = ['emotions', 'reveal', 'themes'] as const;
export type AdminRoute = (typeof ADMIN_ROUTES)[number];

export const DEFAULT_ADMIN_ROUTE: AdminRoute = 'emotions';

function parseHash(): AdminRoute {
  const raw = window.location.hash.replace(/^#\/?/, '');
  return (ADMIN_ROUTES as readonly string[]).includes(raw) ? (raw as AdminRoute) : DEFAULT_ADMIN_ROUTE;
}

export function useAdminRoute(): [AdminRoute, (route: AdminRoute) => void] {
  const [route, setRoute] = useState<AdminRoute>(parseHash);

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = (next: AdminRoute) => {
    window.location.hash = `/${next}`;
  };

  return [route, navigate];
}
