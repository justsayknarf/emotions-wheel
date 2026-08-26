export type AppView = 'field' | 'cards' | 'complete' | 'history' | 'constellation';

// Legacy type — kept for DefinitionCardSequence and EmotionPreviewCard.
// New code uses PinEntry.
export interface SelectedEmotion {
  id: string;
  label: string;
  x: number;
  y: number;
  cluster: string;
}

export interface RegionDescription {
  relational: string;  // e.g. "between tense and anxious"
  narrative: string;   // e.g. "stirred up, a little on edge"
}

export interface PinEntry {
  id: string;
  x: number;
  y: number;
  recognizedWords: string[];   // emotion IDs
  regionDescription: RegionDescription;
  // The coordinate where this pin was first dropped. Captured once at creation
  // and never mutated by later adjustments — x/y is the authoritative record,
  // this is kept as secondary metadata (the "your drop" anchor + history).
  // Optional so diary entries written before adjustable pins stay valid.
  origin?: { x: number; y: number };
}

export interface DiaryEntry {
  id: string;
  timestamp: string;       // ISO 8601
  pins: PinEntry[];
  sessionDurationMs: number;
  // Which surface produced this check-in. Optional so entries written before
  // the new-tab entry point stay valid; an absent value is treated as 'web'
  // wherever it's read (see src/data/source.ts).
  source?: 'web' | 'new-tab';
}
