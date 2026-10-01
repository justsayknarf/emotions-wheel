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
});

export function useDefinitionTooltipApi(): DefinitionTooltipApi {
  return useContext(DefinitionTooltipContext);
}

export function useDefinitionTooltip(layout: TipLayout): DefinitionTooltipApi {
  // The machine's state lives in a ref so events can be stepped synchronously
  // from event handlers and timers; the state copy only drives renders.
  const stateRef = useRef<DefinitionState>(INITIAL_DEFINITION_STATE);
  const [state, setState] = useState<DefinitionState>(INITIAL_DEFINITION_STATE);
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
    if (next !== stateRef.current) {
      stateRef.current = next;
      setState(next);
    }
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

  const openId = state.phase === 'open' || state.phase === 'grace' ? state.openId : null;
  return useMemo(
    () => ({ enabled: true, layout, openId, litId, hover, press, release, tap }),
    [layout, openId, litId, hover, press, release, tap],
  );
}
