// Pure logic for tagging a check-in's originating surface
// (docs/plans/2026-08-25-001-feat-newtab-checkin-entry-plan.md, U1).
// No storage or DOM access, so it's importable directly under `npx tsx` for
// scripts/test-source.ts — same seam as src/data/departure.ts.

/**
 * Resolves which surface produced a check-in from the page's query string.
 * Defensive default: any value other than the literal 'new-tab' (a missing
 * key, an empty string, or an unrecognized value) resolves to 'web' — never
 * echoes arbitrary query input back into a DiaryEntry verbatim.
 */
export function resolveEntrySource(search: string): 'web' | 'new-tab' {
  const params = new URLSearchParams(search);
  return params.get('source') === 'new-tab' ? 'new-tab' : 'web';
}

const SESSION_KEY = 'emotion-selector-entry-source';

/**
 * Storage-backed wrapper (thin over the pure resolver above, same seam as
 * `nextCue` in groundingCues.ts): the app strips `?source=new-tab` from the
 * address bar right after the first paint of a tab (to keep a later
 * bookmark/share of that URL from mistagging every future check-in as
 * new-tab), which means a plain refresh of that same tab has nothing left in
 * the query string to resolve. sessionStorage is scoped to this tab — not to
 * a bookmark, a share, or a freshly opened tab — so caching the first
 * resolution there lets a refresh recover it without resurrecting the
 * mistagging risk the strip guards against. Falls back to the pure resolver
 * when sessionStorage is unavailable (private browsing, etc).
 */
export function resolveSessionEntrySource(search: string): 'web' | 'new-tab' {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored === 'new-tab' || stored === 'web') return stored;
    const resolved = resolveEntrySource(search);
    sessionStorage.setItem(SESSION_KEY, resolved);
    return resolved;
  } catch {
    return resolveEntrySource(search);
  }
}
