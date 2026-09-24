import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  readDiary,
  appendEntry,
  updateEntry as updateEntryInStore,
  clearDiary,
  requestPersistentStorage,
} from '../store/diary';
import type { DiaryEntry, PinEntry } from '../types';

export function useDiary() {
  const [entries, setEntries] = useState<DiaryEntry[]>(() => readDiary());

  const record = useCallback(
    (pins: PinEntry[], sessionStartMs: number, source: DiaryEntry['source']): DiaryEntry => {
      const entry: DiaryEntry = {
        id: uuidv4(),
        timestamp: new Date().toISOString(),
        pins,
        sessionDurationMs: Date.now() - sessionStartMs,
        source,
      };
      if (appendEntry(entry)) requestPersistentStorage();
      else console.error('Check-in could not be saved to this browser.');
      setEntries(readDiary());
      return entry;
    },
    [],
  );

  const updateEntry = useCallback((entry: DiaryEntry): void => {
    if (!updateEntryInStore(entry)) console.error('Check-in edit could not be saved to this browser.');
    setEntries(readDiary());
  }, []);

  const clear = useCallback(() => {
    clearDiary();
    setEntries([]);
  }, []);

  return { entries, record, updateEntry, clear };
}
