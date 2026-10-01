// Coverage check for word definitions (word-definition-tooltips R1/R2/AE7).
// Every word in every registered vocabulary must have a definition: the
// field's tooltip has no "no definition" state, and the admin switcher can put
// any registered vocabulary on screen. Run: pnpm run check:definitions
import { frameworks } from '../src/data/frameworks';
import { definitionFor, missingDefinitions } from '../src/data/descriptions';

let failures = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
  if (!ok) failures++;
}

// The helpers themselves.
check('definitionFor: known word', typeof definitionFor('happy') === 'string', 'happy has text');
check('definitionFor: unknown id', definitionFor('not-a-word') === null, 'null, not the generic fallback');
check('missingDefinitions: names the gap', missingDefinitions(['happy', 'not-a-word']).join() === 'not-a-word', 'only the unknown id');

// Coverage of every vocabulary the app can show.
for (const framework of Object.values(frameworks)) {
  const missing = missingDefinitions(framework.emotions.map((e) => e.id));
  check(
    `${framework.id}: every word defined (${framework.emotions.length} words)`,
    missing.length === 0,
    missing.length === 0 ? 'none missing' : `${missing.length} missing: ${missing.join(', ')}`,
  );
}

console.log(`\n${failures === 0 ? 'OK' : 'FAIL'} — ${failures} failure(s).`);
process.exit(failures > 0 ? 1 : 0);
