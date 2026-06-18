import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { readDiary, appendEntry, clearDiary } from '../store/diary';
import type { DiaryEntry, SelectedEmotion } from '../types';

export function useDiary() {
  const [entries, setEntries] = useState<DiaryEntry[]>(() => readDiary());

  const record = useCallback(
    (selectedEmotions: SelectedEmotion[], sessionStartMs: number): DiaryEntry => {
      const entry: DiaryEntry = {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        emotions: selectedEmotions,
        sessionDurationMs: Date.now() - sessionStartMs,
      };
      appendEntry(entry);
      setEntries(readDiary());
      return entry;
    },
    [],
  );

  const clear = useCallback(() => {
    clearDiary();
    setEntries([]);
  }, []);

  return { entries, record, clear };
}
