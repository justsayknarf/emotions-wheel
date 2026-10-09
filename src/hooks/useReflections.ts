import { useCallback, useState } from 'react';
import {
  readReflections,
  appendReflection,
  setWeekName as setWeekNameInStore,
  readInviteState,
  writeInviteState,
} from '../store/reflections';
import { laterUntil } from '../data/reflection';
import type { Reflection, ReflectionInviteState } from '../types';

// Reflections and the invitation's snooze state, mirrored into React state
// the same way useDiary mirrors the diary: every write re-reads storage.
export function useReflections() {
  const [reflections, setReflections] = useState<Reflection[]>(() => readReflections());
  const [inviteState, setInviteState] = useState<ReflectionInviteState>(() => readInviteState());

  const complete = useCallback((reflection: Reflection) => {
    appendReflection(reflection);
    setReflections(readReflections());
  }, []);

  // Returns whether the write landed, for the History editor.
  const renameWeek = useCallback((reflectionId: string, name: string): boolean => {
    const ok = setWeekNameInStore(reflectionId, name);
    setReflections(readReflections());
    return ok;
  }, []);

  // "Later": hidden until the next local midnight.
  const snooze = useCallback((now: Date = new Date()) => {
    writeInviteState({ ...readInviteState(), snoozedUntil: laterUntil(now).toISOString() });
    setInviteState(readInviteState());
  }, []);

  // "Skip this week": restarts the 7-day timer from now.
  const skipWeek = useCallback((now: Date = new Date()) => {
    writeInviteState({ ...readInviteState(), lastSkippedAt: now.toISOString(), snoozedUntil: undefined });
    setInviteState(readInviteState());
  }, []);

  return { reflections, inviteState, complete, renameWeek, snooze, skipWeek };
}
