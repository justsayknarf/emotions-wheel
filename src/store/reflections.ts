import type { Reflection, ReflectionInviteState } from '../types';

// localStorage for the weekly reflection: completed reflections, the
// invitation's snooze state, and the one-time journal storage notice. Pure
// logic lives in src/data/reflection.ts; this stays a thin, try/catch-guarded
// wrapper, matching src/store/diary.ts's degrade-quietly posture.

const REFLECTIONS_KEY = 'emotion-selector-reflections';
const INVITE_KEY = 'emotion-selector-reflection-invite';
const NOTICE_KEY = 'emotion-selector-journal-notice-seen';

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function readReflections(): Reflection[] {
  const list = readJson<Reflection[]>(REFLECTIONS_KEY, []);
  return Array.isArray(list) ? list : [];
}

export function appendReflection(reflection: Reflection): boolean {
  return writeJson(REFLECTIONS_KEY, [...readReflections(), reflection]);
}

/** Rename a reflection's week, or clear the name with blank text. */
export function setWeekName(reflectionId: string, name: string): boolean {
  const trimmed = name.trim();
  return writeJson(
    REFLECTIONS_KEY,
    readReflections().map((r) => {
      if (r.id !== reflectionId) return r;
      const { weekName: _old, ...rest } = r;
      return trimmed ? { ...rest, weekName: trimmed } : rest;
    }),
  );
}

export function readInviteState(): ReflectionInviteState {
  const state = readJson<ReflectionInviteState>(INVITE_KEY, {});
  return state && typeof state === 'object' ? state : {};
}

export function writeInviteState(state: ReflectionInviteState): boolean {
  return writeJson(INVITE_KEY, state);
}

export function readJournalNoticeSeen(): boolean {
  try {
    return localStorage.getItem(NOTICE_KEY) === '1';
  } catch {
    return true; // storage unreadable: don't nag about storage on every note
  }
}

export function markJournalNoticeSeen(): void {
  try {
    localStorage.setItem(NOTICE_KEY, '1');
  } catch {
    // ignore
  }
}
