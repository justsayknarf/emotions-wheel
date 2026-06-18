export type AppView = 'field' | 'cards' | 'complete' | 'history';

export interface SelectedEmotion {
  id: string;
  label: string;
  x: number;
  y: number;
  cluster: string;
}

export interface DiaryEntry {
  id: string;
  timestamp: string;       // ISO 8601
  emotions: SelectedEmotion[];
  sessionDurationMs: number;
}
