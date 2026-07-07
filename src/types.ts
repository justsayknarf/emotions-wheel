export type AppView = 'field' | 'cards' | 'complete' | 'history';

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
}

export interface DiaryEntry {
  id: string;
  timestamp: string;       // ISO 8601
  pins: PinEntry[];
  sessionDurationMs: number;
}
