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
