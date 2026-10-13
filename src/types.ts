export type AppView = 'field' | 'cards' | 'history' | 'constellation' | 'settings' | 'reflection';

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
  // Private journal notes on this check-in (src/data/journal.ts). Optional so
  // every entry written before the journal stays valid; an empty array means
  // the user cleared what they wrote.
  notes?: JournalNote[];
}

// One line of the private journal. `at-the-time` notes are written on the
// saved check-in card or in History's entry detail; `looking-back` notes are
// written during a weekly reflection walk.
export interface JournalNote {
  id: string;
  kind: 'at-the-time' | 'looking-back';
  text: string;
  writtenAt: string;       // ISO 8601, when first written; edits keep it
  // Looking-back notes only: the walk that wrote this note. It groups one
  // walk's notes and need not resolve to a recorded Reflection, since a walk
  // left early records none.
  walkId?: string;
}

// A completed weekly reflection. Its id is the walk's id, so it matches the
// `walkId` on the looking-back notes written during it.
export interface Reflection {
  id: string;
  completedAt: string;     // ISO 8601
  windowEndKey: string;    // dateKey of the window's last day (the day the walk started)
  momentEntryIds: string[];
  // Only walks opened from the invitation move its weekly timer.
  opened: 'invite' | 'on-demand';
  openLine?: string;
  weekName?: string;
}

// The invitation's snooze state. Whether it is due is derived at render
// (src/data/reflection.ts inviteStatus), never stored.
export interface ReflectionInviteState {
  lastSkippedAt?: string;  // ISO 8601
  snoozedUntil?: string;   // ISO 8601
}
