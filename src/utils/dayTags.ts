import type { DiaryEntry } from '../types';

/** Above this many tags in a daily summary row, the rest collapse into a "+k" overflow marker. */
export const MAX_DAY_TAGS = 3;

export interface DayTags {
  shown: string[];
  overflow: number;
}

/**
 * The emotional tags for one day's check-ins, in chronological order. Each
 * pin that named words contributes those words; a pin that named none
 * contributes its stored region description ("between hopeful and touched")
 * as a single tag, so it counts once toward the cap. Deciding per pin keeps a
 * partly-tagged check-in from silently dropping its untagged pins. Duplicates
 * collapse. `labelFor` is injected so this stays pure -- the emotion registry
 * can't load under the check scripts' Node runtime.
 */
export function dayTags(
  entries: DiaryEntry[],
  labelFor: (id: string) => string,
  max: number = MAX_DAY_TAGS,
): DayTags {
  const ordered = [...entries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const all = new Set<string>();
  for (const entry of ordered) {
    for (const pin of entry.pins) {
      if (pin.recognizedWords.length > 0) {
        for (const id of pin.recognizedWords) all.add(labelFor(id));
      } else {
        all.add(pin.regionDescription.relational.replace(/\*/g, ''));
      }
    }
  }

  const list = [...all];
  return { shown: list.slice(0, max), overflow: Math.max(0, list.length - max) };
}
