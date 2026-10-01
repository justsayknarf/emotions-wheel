import { useRef, useState } from 'react';

// Scrubber resolution: the range input runs 0..SCRUB_STEPS.
export const SCRUB_STEPS = 1000;

// The replay scrubber's playhead, shared by the flat replay
// (DrawnConstellation) and the sky's (SkyReplay). `syncScrub` is written
// straight to the input every frame rather than through state, so playback
// doesn't re-render the whole replay 60 times a second. `ended` only changes
// at the edges, so it's cheap to keep in state for the button icon.
export function useReplayScrub() {
  const [ended, setEnded] = useState(false);
  const endedRef = useRef(false);
  const scrubRef = useRef<HTMLInputElement>(null);
  const syncScrub = (progress: number) => {
    const el = scrubRef.current;
    if (el) {
      el.value = String(Math.round(progress * SCRUB_STEPS));
      el.style.setProperty('--p', `${(progress * 100).toFixed(2)}%`);
    }
    const isEnd = progress >= 1;
    if (isEnd !== endedRef.current) {
      endedRef.current = isEnd;
      setEnded(isEnd);
    }
  };
  return { scrubRef, ended, syncScrub };
}
