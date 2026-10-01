// Behavioural check for the admin's in-place descriptions.ts editor
// (src/admin/lib/patchDescriptions.ts). Run: pnpm run check:patchdefs
//
// The editor must change only the entries it is given: the real file has
// definitions for words outside the admin's own framework, and helpers below
// the object, that a wholesale rewrite would lose.
import fs from 'node:fs';
import path from 'node:path';
import { patchDescriptions } from '../src/admin/lib/patchDescriptions';

let failures = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
  if (!ok) failures++;
}

const sample = `export interface EmotionDescription {
  description: string;
  relatedIds: string[];
}

export const descriptions: Record<string, EmotionDescription> = {
  happy: {
    description: "A warm, open sense.",
    relatedIds: ['joyful', 'content'],
  },
  'burned-out': {
    description: 'Given past refilling.',
    relatedIds: ['weary'],
  },
  calm: {
    description: "Settled.",
    relatedIds: [],
  },
};

export function definitionFor(id: string): string | null {
  return descriptions[id]?.description ?? null;
}
`;

// Evaluate a patched module's object so the checks read real values, not text.
function load(src: string): Record<string, { description: string; relatedIds: string[] }> {
  const body = src
    .replace(/export interface[\s\S]*?\n}\n/, '')
    .replace(/export function[\s\S]*$/, '')
    .replace('export const descriptions: Record<string, EmotionDescription> =', 'return');
  return new Function(body)();
}

{
  const out = patchDescriptions(sample, {});
  check('no patches: byte-identical', out === sample, 'unchanged');
}
{
  const out = patchDescriptions(sample, { happy: { description: 'Things are good, and you know it.' } });
  const d = load(out);
  check('bare key: description replaced', d.happy.description === 'Things are good, and you know it.', d.happy.description);
  check('bare key: related ids kept', d.happy.relatedIds.join() === 'joyful,content', d.happy.relatedIds.join());
  check('other entries untouched', out.includes("description: 'Given past refilling.',") && out.includes('description: "Settled.",'), 'neighbours intact');
  check('helpers below the object kept', out.includes('export function definitionFor'), 'definitionFor present');
}
{
  const text = `It's "too much" —\nall at once.`;
  const out = patchDescriptions(sample, { 'burned-out': { description: text } });
  check('quoted key + quotes/apostrophe/newline survive', load(out)['burned-out'].description === text, JSON.stringify(load(out)['burned-out'].description));
}
{
  const out = patchDescriptions(sample, { calm: { relatedIds: ['peaceful', "it's"] } });
  const d = load(out);
  check('related ids replaced', d.calm.relatedIds.join('|') === "peaceful|it's", d.calm.relatedIds.join('|'));
  check('description kept when only related ids change', d.calm.description === 'Settled.', d.calm.description);
}
{
  const out = patchDescriptions(sample, { 'on-edge': { description: 'Braced.', relatedIds: ['edgy'] }, ghost: { description: '  ' } });
  const d = load(out);
  check('missing entry inserted with a quoted key', d['on-edge']?.description === 'Braced.' && out.includes("  'on-edge': {"), JSON.stringify(d['on-edge']));
  check('empty patch for a missing entry adds nothing', !('ghost' in d), 'no ghost');
  check('insert keeps the helpers', out.includes('export function definitionFor'), 'present');
}
{
  // The real file round-trips, and a patch to one word changes only its line.
  const real = fs.readFileSync(path.join(import.meta.dirname, '../src/data/descriptions.ts'), 'utf-8');
  check('real file: no patches is byte-identical', patchDescriptions(real, {}) === real, 'unchanged');
  const out = patchDescriptions(real, { 'worn-out': { description: 'Test line.' } });
  const changed = out.split('\n').filter((line, i) => line !== real.split('\n')[i]);
  check('real file: one line changes', changed.length === 1 && changed[0] === '    description: "Test line.",', JSON.stringify(changed));
}

console.log(`\n${failures === 0 ? 'OK' : 'FAIL'} — ${failures} failure(s).`);
process.exit(failures > 0 ? 1 : 0);
