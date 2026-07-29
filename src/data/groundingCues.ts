// Short somatic cues for the grounding welcome. Each opens a check-in with an
// invitation to notice the body before locating a feeling on the field. Kept
// sentence-case and gentle — they read as presence, not instruction.
export const GROUNDING_CUES = [
  'Notice your breath.',
  'Feel your feet on the ground.',
  'Soften your shoulders.',
  'What do you notice right now?',
  'Let your body settle.',
  'Unclench your jaw.',
  "What's here, right now?",
  'Take one slow breath.',
] as const;

const CUE_KEY = 'emotion-selector-welcome-cue';

// Read the last-shown cue index, or null when absent/unreadable. Wrapped like
// store/diary.ts so a corrupt or unavailable localStorage degrades quietly.
function readLastIndex(): number | null {
  try {
    const raw = localStorage.getItem(CUE_KEY);
    if (raw === null) return null;
    const n = Number.parseInt(raw, 10);
    return Number.isInteger(n) && n >= 0 && n < GROUNDING_CUES.length ? n : null;
  } catch {
    return null;
  }
}

function writeLastIndex(index: number): void {
  try {
    localStorage.setItem(CUE_KEY, String(index));
  } catch {
    // localStorage unavailable — the next load just may repeat a cue.
  }
}

// Pure selection: pick any index other than `prev`. With a single-cue pool the
// only option is that cue (no repeat-avoidance possible). `prev === null`
// (first ever) picks freely.
export function pickCueIndex(
  prev: number | null,
  count: number = GROUNDING_CUES.length,
  rand: () => number = Math.random,
): number {
  if (count <= 1) return 0;
  let next = Math.floor(rand() * count);
  if (prev !== null) {
    // Map a draw from [0, count-1) onto the indices excluding `prev`, so every
    // non-prev cue is equally likely and we never loop.
    next = Math.floor(rand() * (count - 1));
    if (next >= prev) next += 1;
  }
  return Math.min(next, count - 1);
}

// Select the next cue to show, avoiding an immediate repeat across appearances
// (persisted, so it holds across page reloads), and record the choice.
export function nextCue(): { cue: string; index: number } {
  const index = pickCueIndex(readLastIndex());
  writeLastIndex(index);
  return { cue: GROUNDING_CUES[index], index };
}
