// When the field's definition tooltip opens, switches and closes
// (docs/brainstorms/2026-09-30-word-definition-tooltips-requirements.md).
// Pure: the hook (useDefinitionTooltip) runs the one timer this asks for.
//
// - A word must be rested on for DEFINITION_DELAY_MS before anything opens,
//   so a pass across stars or card words shows nothing (R4–R6).
// - Once open, the next word takes over at once (R7). Leaving every word
//   holds the tooltip for DEFINITION_GRACE_MS, then it closes and the delay
//   re-arms (R8).
// - A press (field, pin or slider) closes it and ignores hover until release
//   (R9). In the tray layout, release names the word nearest the resting pin,
//   which opens after the delay (R10). A tap opens at once (R11).
// - A dismiss (Escape, tapping the tooltip, a save, clear or leaving the
//   field) closes it outright and cancels anything pending.

export const DEFINITION_DELAY_MS = 500;
export const DEFINITION_GRACE_MS = 300;

export type DefinitionPhase = 'cold' | 'waiting' | 'open' | 'grace';

export interface DefinitionState {
  phase: DefinitionPhase;
  // The word whose tooltip is showing (open or grace).
  openId: string | null;
  // The word waiting out the delay.
  pendingId: string | null;
  // A press is in progress: hover is ignored.
  pressed: boolean;
}

export type DefinitionEvent =
  | { type: 'hover'; id: string | null }
  | { type: 'press' }
  | { type: 'release'; restId: string | null }
  | { type: 'tap'; id: string }
  | { type: 'dismiss' }
  | { type: 'timer' };

// Start a timer of `set` ms (replacing any running one), cancel it, or
// (null) leave whatever is running alone.
export type TimerCommand = { set: number } | 'clear' | null;

export interface DefinitionStep {
  state: DefinitionState;
  timer: TimerCommand;
}

export const INITIAL_DEFINITION_STATE: DefinitionState = {
  phase: 'cold',
  openId: null,
  pendingId: null,
  pressed: false,
};

const cold = (pressed: boolean): DefinitionState => ({ phase: 'cold', openId: null, pendingId: null, pressed });
const unchanged = (state: DefinitionState): DefinitionStep => ({ state, timer: null });

export function stepDefinition(s: DefinitionState, e: DefinitionEvent): DefinitionStep {
  switch (e.type) {
    case 'press':
      // Slider drags report every frame; a press already in force is a no-op,
      // so the drag doesn't re-render App each frame.
      if (s.pressed && s.phase === 'cold') return unchanged(s);
      return { state: cold(true), timer: 'clear' };

    case 'release':
      if (e.restId) {
        return {
          state: { phase: 'waiting', openId: null, pendingId: e.restId, pressed: false },
          timer: { set: DEFINITION_DELAY_MS },
        };
      }
      return s.pressed ? { state: { ...s, pressed: false }, timer: null } : unchanged(s);

    case 'dismiss':
      // Already closed and idle: keep the same object so nothing re-renders.
      return { state: s.phase === 'cold' && !s.pressed ? s : cold(false), timer: 'clear' };

    case 'tap':
      return { state: { phase: 'open', openId: e.id, pendingId: null, pressed: false }, timer: 'clear' };

    case 'timer':
      if (s.phase === 'waiting' && s.pendingId) {
        return { state: { ...s, phase: 'open', openId: s.pendingId, pendingId: null }, timer: null };
      }
      if (s.phase === 'grace') return { state: cold(s.pressed), timer: null };
      return unchanged(s);

    case 'hover': {
      if (s.pressed) return unchanged(s);
      const id = e.id;
      switch (s.phase) {
        case 'cold':
          return id
            ? { state: { ...s, phase: 'waiting', pendingId: id }, timer: { set: DEFINITION_DELAY_MS } }
            : unchanged(s);
        case 'waiting':
          if (id === s.pendingId) return unchanged(s);
          if (!id) return { state: cold(false), timer: 'clear' };
          return { state: { ...s, pendingId: id }, timer: { set: DEFINITION_DELAY_MS } };
        case 'open':
          if (id === s.openId) return unchanged(s);
          if (!id) return { state: { ...s, phase: 'grace' }, timer: { set: DEFINITION_GRACE_MS } };
          return { state: { ...s, openId: id }, timer: null };
        case 'grace':
          if (!id) return unchanged(s);
          return { state: { ...s, phase: 'open', openId: id }, timer: 'clear' };
      }
    }
  }
}
