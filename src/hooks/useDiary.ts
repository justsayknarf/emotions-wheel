import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { readDiary, appendEntry, updateEntry as updateEntryInStore, setEntryNotes, clearDiary } from '../store/diary';
import type { DiaryEntry, JournalNote, PinEntry } from '../types';

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
      appendEntry(entry);
      setEntries(readDiary());
      return entry;
    },
    [],
  );

  const updateEntry = useCallback((entry: DiaryEntry): void => {
    updateEntryInStore(entry);
    setEntries(readDiary());
  }, []);

  // Returns whether the write landed (see setEntryNotes).
  const setNotes = useCallback((entryId: string, notes: JournalNote[]): boolean => {
    const ok = setEntryNotes(entryId, notes);
    setEntries(readDiary());
    return ok;
  }, []);

  const clear = useCallback(() => {
    clearDiary();
    setEntries([]);
  }, []);

  return { entries, record, updateEntry, setNotes, clear };
}
