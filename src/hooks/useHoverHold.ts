// Pointer/focus hover reporting for a card word that drives the definition
// tooltip (word-definition-tooltips R5). An unmounting element fires no
// pointerleave/blur, so a word removed under the pointer (or while focused)
// would leave its hover stuck on. Hovered/focused are tracked in event
// handlers only and released on unmount. Touch never hovers.
import { useEffect, useRef } from 'react';

export function useHoverHold(onHoverChange: ((hovering: boolean) => void) | undefined) {
  const holding = useRef({ hovered: false, focused: false });
  const latest = useRef(onHoverChange);
  useEffect(() => { latest.current = onHoverChange; });
  useEffect(() => {
    const state = holding.current;
    return () => {
      if (state.hovered || state.focused) latest.current?.(false);
    };
  }, []);
  if (!onHoverChange) return null;
  return {
    pointer: {
      onPointerEnter: (e: React.PointerEvent) => {
        if (e.pointerType !== 'touch') { holding.current.hovered = true; onHoverChange(true); }
      },
      onPointerLeave: (e: React.PointerEvent) => {
        if (e.pointerType !== 'touch') { holding.current.hovered = false; onHoverChange(false); }
      },
    },
    focus: {
      onFocus: () => { holding.current.focused = true; onHoverChange(true); },
      onBlur: () => { holding.current.focused = false; onHoverChange(false); },
    },
  };
}
