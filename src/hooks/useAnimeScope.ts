import { useEffect, useRef, type DependencyList, type RefObject } from 'react';
import { createScope, type Scope } from 'animejs';

// The one way this repo uses anime.js from React. framer-motion still owns
// component enter/exit; anime.js is for one-shot moments and scrubbable
// timelines (see AGENTS.md → Motion).
//
// `setup` runs inside an anime.js Scope rooted at `root`, so selector strings
// resolve inside this component only, and every animation it creates is
// reverted on unmount or when `deps` change. StrictMode's double effect run
// therefore leaves nothing behind.
//
// `reduced` mirrors prefers-reduced-motion, read live by the scope; when it
// flips, the scope re-runs `setup` with the new value. Honor it: jump to the
// end state (utils.set, or `duration: 0`) rather than skipping the change.
//
// Register imperative triggers with `scope.add('name', fn)` and call them
// later via `scope.current?.methods.name(...)` — e.g. from a counter-keyed
// effect, the repo's one-shot convention (AxisRadiance.tsx).
export function useAnimeScope<T extends HTMLElement | SVGElement = HTMLDivElement>(
  setup: (scope: Scope, reduced: boolean) => void | (() => void),
  deps: DependencyList,
): { root: RefObject<T | null>; scope: RefObject<Scope | null> } {
  const root = useRef<T | null>(null);
  const scope = useRef<Scope | null>(null);

  useEffect(() => {
    if (!root.current) return;
    const s = createScope({
      root: root.current,
      mediaQueries: { reduceMotion: '(prefers-reduced-motion: reduce)' },
    }).add(self => setup(self!, !!self?.matches.reduceMotion));
    scope.current = s;
    return () => {
      s.revert();
      if (scope.current === s) scope.current = null;
    };
    // `setup` is deliberately excluded: callers pass the values it closes over in `deps`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { root, scope };
}
