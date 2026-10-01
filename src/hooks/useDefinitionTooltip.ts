// Runs the definition tooltip's timing (definitionTiming.ts) with a single
// timer, and shares it: App owns one instance, passes it to the field as
// props and to the card through DefinitionTooltipContext.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  INITIAL_DEFINITION_STATE,
  stepDefinition,
  type DefinitionEvent,
  type DefinitionState,
} from '../components/EmotionField/definitionTiming';
import type { TipLayout } from '../components/EmotionField/definitionPlacement';

export interface DefinitionTooltipApi {
  enabled: boolean;
  layout: TipLayout;
  openId: string | null;
  litId: string | null;
  hover(id: string | null, source: 'field' | 'card'): void;
  press(): void;
  release(restId: string | null): void;
  tap(id: string): void;
  // Close outright: Escape, tapping the band card, save, clear, leaving the field.
  close(): void;
}

const noop = () => {};
export const DefinitionTooltipContext = createContext<DefinitionTooltipApi>({
  enabled: false,
  layout: 'tethered',
  openId: null,
  litId: null,
  hover: noop,
  press: noop,
  release: noop,
  tap: noop,
  close: noop,
});

export function useDefinitionTooltipApi(): DefinitionTooltipApi {
  return useContext(DefinitionTooltipContext);
}

// The word whose tooltip shows: open, or holding through the grace.
const shownId = (s: DefinitionState) => (s.phase === 'open' || s.phase === 'grace' ? s.openId : null);

export function useDefinitionTooltip(layout: TipLayout): DefinitionTooltipApi {
  // The machine lives only in a ref, stepped synchronously from event
  // handlers and timers. React state holds just the open word, set only when
  // it changes: App owns this hook, and a render per star crossed (waiting,
  // pending, press toggles) would re-render App during field interaction.
  const stateRef = useRef<DefinitionState>(INITIAL_DEFINITION_STATE);
  const [openId, setOpenId] = useState<string | null>(null);
  const [litId, setLitId] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const dispatchRef = useRef<((event: DefinitionEvent) => void) | null>(null);

  const dispatch = useCallback((event: DefinitionEvent) => {
    const { state: next, timer } = stepDefinition(stateRef.current, event);
    if (timer !== null) {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = null;
      if (timer !== 'clear') {
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          dispatchRef.current?.({ type: 'timer' });
        }, timer.set);
      }
    }
    const prevOpen = shownId(stateRef.current);
    stateRef.current = next;
    const nextOpen = shownId(next);
    if (nextOpen !== prevOpen) setOpenId(nextOpen);
  }, []);

  useEffect(() => {
    dispatchRef.current = dispatch;
  }, [dispatch]);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  const hover = useCallback((id: string | null, source: 'field' | 'card') => {
    if (source === 'card') setLitId(id);
    dispatch({ type: 'hover', id });
  }, [dispatch]);
  const press = useCallback(() => {
    setLitId(null);
    dispatch({ type: 'press' });
  }, [dispatch]);
  const release = useCallback((restId: string | null) => dispatch({ type: 'release', restId }), [dispatch]);
  const tap = useCallback((id: string) => dispatch({ type: 'tap', id }), [dispatch]);
  const close = useCallback(() => {
    setLitId(null);
    dispatch({ type: 'dismiss' });
  }, [dispatch]);

  // Escape dismisses an open tooltip (WCAG 1.4.13), listening only while one is.
  const isOpen = openId !== null;
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  return useMemo(
    () => ({ enabled: true, layout, openId, litId, hover, press, release, tap, close }),
    [layout, openId, litId, hover, press, release, tap, close],
  );
}
