// Behavioural check for the vocabulary switcher's saved choice
// (src/data/frameworks/index.ts). Run: pnpm run check:vocabulary
import {
  DEFAULT_FRAMEWORK_ID,
  activeFrameworkId,
  frameworks,
  resolveFrameworkId,
} from '../src/data/frameworks';

let failures = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
  if (!ok) failures++;
}

check('default is registered', DEFAULT_FRAMEWORK_ID in frameworks, DEFAULT_FRAMEWORK_ID);
check('nothing saved → default', resolveFrameworkId(null) === DEFAULT_FRAMEWORK_ID, String(resolveFrameworkId(null)));
check('empty → default', resolveFrameworkId('') === DEFAULT_FRAMEWORK_ID, String(resolveFrameworkId('')));
check('unknown id → default', resolveFrameworkId('retired-vocab') === DEFAULT_FRAMEWORK_ID, String(resolveFrameworkId('retired-vocab')));
check('prototype key → default', resolveFrameworkId('constructor') === DEFAULT_FRAMEWORK_ID, String(resolveFrameworkId('constructor')));
for (const id of Object.keys(frameworks)) {
  check(`registered "${id}" → itself`, resolveFrameworkId(id) === id, resolveFrameworkId(id));
}
// Node has no localStorage, so the check scripts always see the default.
check('no storage → active is the default', activeFrameworkId === DEFAULT_FRAMEWORK_ID, activeFrameworkId);

console.log(`\n${failures === 0 ? 'OK' : 'FAIL'} — ${failures} failure(s).`);
process.exit(failures > 0 ? 1 : 0);
