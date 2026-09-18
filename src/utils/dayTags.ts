import type { DiaryEntry } from '../types';

/** Above this many tags in a daily summary row, the rest collapse into a "+k" overflow marker. */
export const MAX_DAY_TAGS = 3;

export interface DayTag {
  // 'tag' is a named emotion word; 'region' is the "between X and Y" fallback
  // for a check-in that named none.
  kind: 'tag' | 'region';
  text: string;
}

export interface DayTags {
  shown: DayTag[];
  overflow: number;
}

/**
 * The emotional tags for one day's check-ins, in chronological order. A
 * check-in that named words contributes those words; one that named none
 * contributes its stored region description ("between hopeful and touched")
 * as a single tag, so it counts once toward the cap. Duplicates across
 * check-ins collapse. `labelFor` is injected so this stays pure -- the
 * emotion registry can't load under the check scripts' Node runtime.
 */
export function dayTags(
  entries: DiaryEntry[],
  labelFor: (id: string) => string,
  max: number = MAX_DAY_TAGS,
): DayTags {
  const ordered = [...entries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const seen = new Set<string>();
  const all: DayTag[] = [];
  const add = (kind: DayTag['kind'], text: string) => {
    const key = `${kind}:${text}`;
    if (seen.has(key)) return;
    seen.add(key);
    all.push({ kind, text });
  };

  for (const entry of ordered) {
    if (entry.pins.length === 0) continue;
    const ids = [...new Set(entry.pins.flatMap(p => p.recognizedWords))];
    if (ids.length > 0) {
      for (const id of ids) add('tag', labelFor(id));
    } else {
      add('region', entry.pins[0].regionDescription.relational.replace(/\*/g, ''));
    }
  }

  return { shown: all.slice(0, max), overflow: Math.max(0, all.length - max) };
}
