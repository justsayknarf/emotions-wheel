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

// --- updateEntryInList carries notes forward only when the key is absent ---
{
  const notes = withAtTimeNote(entry('e3'), 'keep me', now, newId);
  const before = [entry('e3', notes)];
  const correction = entry('e3'); // built fresh, no notes key — App.tsx's correction path
  const kept = updateEntryInList(before, correction)[0];
  check('update without a notes key keeps the original notes', kept.notes?.[0]?.text === 'keep me', JSON.stringify(kept.notes));

  const explicit = updateEntryInList(before, { ...entry('e3'), notes: [] })[0];
  check('update with notes: [] clears them (the old note is not carried back)', explicit.notes?.length === 0, JSON.stringify(explicit.notes));

  const replaced = updateEntryInList(before, { ...entry('e3'), notes: withAtTimeNote(entry('e3'), 'new', now, newId) })[0];
  check('update with explicit notes uses them', replaced.notes?.[0]?.text === 'new', JSON.stringify(replaced.notes));

  const plain = updateEntryInList([entry('e4')], entry('e4'))[0];
  check('entry that never had notes gains no notes key', !('notes' in plain), JSON.stringify(plain));
}

// --- pruneEntries: notes protect a check-in ---
{
  const noted = (i: number) => entry(`e${i}`, withAtTimeNote(entry(`e${i}`), 'note', now, newId));
  const diary: DiaryEntry[] = Array.from({ length: 500 }, (_, i) => (i === 0 ? noted(i) : entry(`e${i}`)));

  const pruned = pruneEntries(diary);
  check('AE8: at the cap, the oldest entry with a note is kept', pruned[0].id === 'e0', pruned[0].id);
  check('at the cap, 50 un-noted entries are dropped', pruned.length === 450, String(pruned.length));
  check('the dropped ones are the 50 oldest un-noted (e1–e50)', pruned[1].id === 'e51', pruned[1].id);

  const mostlyNoted: DiaryEntry[] = Array.from({ length: 500 }, (_, i) => (i < 480 ? noted(i) : entry(`e${i}`)));
  const prunedFew = pruneEntries(mostlyNoted);
  check(
    'with only 20 un-noted entries, only those 20 go and no noted one does',
    prunedFew.length === 480 && prunedFew.every(hasNotes),
    String(prunedFew.length),
  );

  const small = diary.slice(0, 499);
  check('below the cap the input comes back unchanged', pruneEntries(small) === small, String(pruneEntries(small).length));

  const emptied = [entry('e0', []), ...diary.slice(1)];
  check('an entry with notes: [] is prunable', pruneEntries(emptied)[0].id !== 'e0', pruneEntries(emptied)[0].id);
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nAll journal checks passed');
