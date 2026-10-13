// Behavioural check for the private journal's pure logic (src/data/journal.ts)
// and the notes rule in updateEntryInList (src/data/checkIn.ts).
// Run: npm run check:journal
// docs/plans/2026-10-09-001-feat-weekly-reflection-journal-plan.md, U1.
// Exits non-zero on any violation.
import {
  withAtTimeNote,
  withLookingBackNote,
  atTimeNote,
  lookingBackNotes,
  hasNotes,
  pruneEntries,
  withEntryNotes,
} from '../src/data/journal';
import { updateEntryInList } from '../src/data/checkIn';
import type { DiaryEntry, JournalNote } from '../src/types';

let failures = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
  if (!ok) failures++;
}

let idSeq = 0;
const newId = () => `n${++idSeq}`;
const now = new Date('2026-10-09T12:00:00.000Z');
const later = new Date('2026-10-10T12:00:00.000Z');

const entry = (id: string, notes?: JournalNote[]): DiaryEntry => ({
  id,
  timestamp: '2026-10-08T09:00:00.000Z',
  pins: [{ id: `p-${id}`, x: 0, y: 0, recognizedWords: [], regionDescription: { relational: '', narrative: '' } }],
  sessionDurationMs: 1000,
  ...(notes !== undefined ? { notes } : {}),
});

// --- at-the-time notes ---
{
  const e = entry('e1');
  const notes = withAtTimeNote(e, '  big meeting  ', now, newId);
  check('adds one at-the-time note', notes.length === 1 && notes[0].kind === 'at-the-time', JSON.stringify(notes));
  check('trims the text', notes[0].text === 'big meeting', notes[0].text);

  const edited = withAtTimeNote({ ...e, notes }, 'meeting went fine', later, newId);
  check(
    'editing replaces the text and keeps one note, its id and first-written date',
    edited.length === 1 && edited[0].text === 'meeting went fine' && edited[0].id === notes[0].id &&
      edited[0].writtenAt === now.toISOString(),
    JSON.stringify(edited),
  );

  const cleared = withAtTimeNote({ ...e, notes: edited }, '   ', later, newId);
  check('whitespace-only text removes the note, as an explicit []', Array.isArray(cleared) && cleared.length === 0, JSON.stringify(cleared));
}

// --- looking-back notes ---
{
  const e = entry('e2');
  const a = withLookingBackNote(e, 'r1', 'first pass', now, newId);
  const b = withLookingBackNote({ ...e, notes: a }, 'r1', 'second pass', later, newId);
  check('same walk twice keeps one note for that walk', b.length === 1 && b[0].text === 'second pass' && b[0].walkId === 'r1', JSON.stringify(b));

  const c = withLookingBackNote({ ...e, notes: b }, 'r2', 'another week', later, newId);
  check('a second walk adds a second note', c.length === 2 && c[1].walkId === 'r2', JSON.stringify(c));

  const d = withLookingBackNote({ ...e, notes: c }, 'r1', '', later, newId);
  check('blank text for r1 removes only r1\'s note', d.length === 1 && d[0].walkId === 'r2', JSON.stringify(d));

  const withBoth = { ...e, notes: [...withAtTimeNote(e, 'at the time', now, newId), ...c] };
  check('atTimeNote finds the at-the-time note', atTimeNote(withBoth)?.text === 'at the time', String(atTimeNote(withBoth)?.text));
  check(
    'lookingBackNotes returns only looking-back notes, oldest first',
    lookingBackNotes(withBoth).map((n) => n.walkId).join(',') === 'r1,r2',
    lookingBackNotes(withBoth).map((n) => n.walkId).join(','),
  );
}

// --- hasNotes ---
check('no notes key → not noted', !hasNotes(entry('x')), 'undefined');
check('empty notes array → not noted', !hasNotes(entry('x', [])), '[]');
check('one note → noted', hasNotes(entry('x', withAtTimeNote(entry('x'), 'hi', now, newId))), '1 note');

// --- updateEntryInList always keeps the stored notes; withEntryNotes writes them ---
{
  const notes = withAtTimeNote(entry('e3'), 'keep me', now, newId);
  const before = [entry('e3', notes)];
  const correction = entry('e3'); // built fresh, no notes key — App.tsx's correction path
  const kept = updateEntryInList(before, correction)[0];
  check('a correction without notes keeps the stored notes', kept.notes?.[0]?.text === 'keep me', JSON.stringify(kept.notes));

  const stale = updateEntryInList(before, { ...entry('e3'), notes: [] })[0];
  check('an update carrying a stale notes array cannot clear the stored notes', stale.notes?.[0]?.text === 'keep me', JSON.stringify(stale.notes));

  const plain = updateEntryInList([entry('e4')], entry('e4'))[0];
  check('entry that never had notes gains no notes key', !('notes' in plain), JSON.stringify(plain));

  const cleared = withEntryNotes(before, 'e3', (e) => withAtTimeNote(e, '', now, newId));
  check('withEntryNotes clearing the only note leaves zero notes', cleared?.[0].notes?.length === 0, JSON.stringify(cleared?.[0].notes));

  // Another tab added a looking-back note after this tab read the diary:
  // the write builds on the stored entry it is handed, so both survive.
  const stored = [entry('e5', [...withLookingBackNote(entry('e5'), 'w1', 'from the other tab', now, newId)])];
  const merged = withEntryNotes(stored, 'e5', (e) => withAtTimeNote(e, 'from this tab', now, newId));
  check(
    'withEntryNotes builds on the stored entry, so a note from another tab survives',
    merged?.[0].notes?.length === 2,
    JSON.stringify(merged?.[0].notes),
  );
  check('withEntryNotes on a missing id is null (never resurrects a pruned entry)', withEntryNotes(stored, 'gone', () => []) === null, 'null');
}

// --- pruneEntries: notes and recent check-ins are protected ---
{
  const PRUNE_NOW = new Date('2027-06-01T12:00:00.000Z'); // every helper entry is months old
  const at = (daysAgo: number) => new Date(PRUNE_NOW.getTime() - daysAgo * 86_400_000).toISOString();
  const noted = (i: number) => entry(`e${i}`, withAtTimeNote(entry(`e${i}`), 'note', now, newId));
  const diary: DiaryEntry[] = Array.from({ length: 500 }, (_, i) => (i === 0 ? noted(i) : entry(`e${i}`)));

  const pruned = pruneEntries(diary, 500, 50, PRUNE_NOW);
  check('AE8: at the cap, the oldest entry with a note is kept', pruned[0].id === 'e0', pruned[0].id);
  check('at the cap, 50 un-noted entries are dropped', pruned.length === 450, String(pruned.length));
  check('the dropped ones are the 50 oldest un-noted (e1–e50)', pruned[1].id === 'e51', pruned[1].id);

  // 480 noted, then 20 un-noted check-ins from this week: none may go.
  const mostlyNoted: DiaryEntry[] = Array.from({ length: 500 }, (_, i) =>
    i < 480 ? noted(i) : { ...entry(`e${i}`), timestamp: at(500 - i < 7 ? 1 : 2) },
  );
  const prunedRecent = pruneEntries(mostlyNoted, 500, 50, PRUNE_NOW);
  check(
    'with the old entries all noted, this week\'s un-noted check-ins survive (the diary grows instead)',
    prunedRecent.length === 500,
    String(prunedRecent.length),
  );

  // 480 noted + 20 un-noted months old: those 20 go, no noted one does.
  const oldFew: DiaryEntry[] = Array.from({ length: 500 }, (_, i) => (i < 480 ? noted(i) : entry(`e${i}`)));
  const prunedFew = pruneEntries(oldFew, 500, 50, PRUNE_NOW);
  check('only old un-noted entries are dropped, never a noted one', prunedFew.length === 480 && prunedFew.every(hasNotes), String(prunedFew.length));

  const small = diary.slice(0, 499);
  check('below the cap the input comes back unchanged', pruneEntries(small, 500, 50, PRUNE_NOW) === small, '499');

  const emptied = [entry('e0', []), ...diary.slice(1)];
  check('an entry with notes: [] is prunable', pruneEntries(emptied, 500, 50, PRUNE_NOW)[0].id !== 'e0', pruneEntries(emptied, 500, 50, PRUNE_NOW)[0].id);
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nAll journal checks passed');
