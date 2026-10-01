// Behavioural checks for the field's definition tooltip: the timing state
// machine (definitionTiming.ts) and its geometry (definitionPlacement.ts).
// Run: pnpm run check:tooltip
import {
  DEFINITION_DELAY_MS,
  DEFINITION_GRACE_MS,
  INITIAL_DEFINITION_STATE,
  stepDefinition,
  type DefinitionEvent,
  type DefinitionState,
  type TimerCommand,
} from '../src/components/EmotionField/definitionTiming';

let failures = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
  if (!ok) failures++;
}

// Run events in order, returning the final state and every timer command.
function run(events: DefinitionEvent[], from: DefinitionState = INITIAL_DEFINITION_STATE) {
  let state = from;
  const timers: TimerCommand[] = [];
  for (const e of events) {
    const r = stepDefinition(state, e);
    state = r.state;
    timers.push(r.timer);
  }
  return { state, timers };
}
const hover = (id: string | null): DefinitionEvent => ({ type: 'hover', id });
const timer: DefinitionEvent = { type: 'timer' };

// --- timing ---
check('delay is 500ms, grace 300ms', DEFINITION_DELAY_MS === 500 && DEFINITION_GRACE_MS === 300, `${DEFINITION_DELAY_MS}/${DEFINITION_GRACE_MS}`);
{
  const { state, timers } = run([hover('anxious')]);
  check('hover arms the delay', state.phase === 'waiting' && state.pendingId === 'anxious', state.phase);
  check('hover sets a 500ms timer', JSON.stringify(timers[0]) === JSON.stringify({ set: 500 }), JSON.stringify(timers[0]));
}
{
  const { state } = run([hover('anxious'), timer]);
  check('delay elapsing opens it (R4)', state.phase === 'open' && state.openId === 'anxious', `${state.phase} ${state.openId}`);
}
{
  // AE1: a sweep across words never opens anything.
  const { state, timers } = run([hover('a'), hover('b'), hover('c'), hover('d'), hover(null)]);
  check('sweep then leave: cold (AE1, R6)', state.phase === 'cold' && state.openId === null, state.phase);
  check('leaving cancels the timer', timers[timers.length - 1] === 'clear', String(timers[timers.length - 1]));
  check('each new word restarts the delay', timers.slice(0, 4).every((t) => typeof t === 'object' && t !== null), JSON.stringify(timers));
}
{
  const first = run([hover('anxious')]).state;
  const again = stepDefinition(first, hover('anxious'));
  check('re-hovering the pending word keeps the timer', again.state === first && again.timer === null, String(again.timer));
}
{
  // AE2: hand-off is instant once open.
  const { state, timers } = run([hover('anxious'), timer, hover('apprehensive')]);
  check('open: next word switches at once (AE2, R7)', state.phase === 'open' && state.openId === 'apprehensive', `${state.openId}`);
  check('switch sets no timer', timers[2] === null, String(timers[2]));
}
{
  // AE3: leaving everything closes after the grace and re-arms the delay.
  const left = run([hover('anxious'), timer, hover(null)]);
  check('leaving all targets starts the grace (R8)', left.state.phase === 'grace' && left.state.openId === 'anxious', left.state.phase);
  check('grace timer is 300ms', JSON.stringify(left.timers[2]) === JSON.stringify({ set: 300 }), JSON.stringify(left.timers[2]));
  const closed = stepDefinition(left.state, timer).state;
  check('grace elapsing closes (AE3)', closed.phase === 'cold' && closed.openId === null, closed.phase);
  const rearmed = stepDefinition(closed, hover('nervous'));
  check('after closing, the delay applies again', rearmed.state.phase === 'waiting', rearmed.state.phase);
  const rescued = stepDefinition(left.state, hover('nervous'));
  check('a word reached within the grace takes over', rescued.state.phase === 'open' && rescued.state.openId === 'nervous' && rescued.timer === 'clear', `${rescued.state.openId}`);
}
{
  // AE5: a press closes and suppresses.
  const { state, timers } = run([hover('anxious'), timer, { type: 'press' }]);
  check('press closes an open tooltip (AE5, R9)', state.phase === 'cold' && state.openId === null && state.pressed, state.phase);
  check('press clears the timer', timers[2] === 'clear', String(timers[2]));
  const during = stepDefinition(state, hover('nervous'));
  check('no hover while pressed', during.state === state, during.state.phase);
  const released = stepDefinition(state, { type: 'release', restId: null });
  check('release (no rest) ends suppression, stays closed', !released.state.pressed && released.state.phase === 'cold', released.state.phase);
  const again = stepDefinition(state, { type: 'press' });
  check('repeated press (every drag frame) changes nothing', again.state === state && again.timer === null, 'same state');
  const pending = run([hover('anxious'), { type: 'press' }]).state;
  check('press cancels a pending open', pending.phase === 'cold' && pending.pendingId === null, pending.phase);
}
{
  // AE6: the pin coming to rest in the tray layout.
  const { state, timers } = run([{ type: 'press' }, { type: 'release', restId: 'content' }]);
  check('pin rest arms the delay for the nearest word (R10)', state.phase === 'waiting' && state.pendingId === 'content' && !state.pressed, state.phase);
  check('pin rest timer is 500ms', JSON.stringify(timers[1]) === JSON.stringify({ set: 500 }), JSON.stringify(timers[1]));
  check('then opens', stepDefinition(state, timer).state.openId === 'content', 'content');
  const stray = stepDefinition(INITIAL_DEFINITION_STATE, { type: 'release', restId: null });
  check('a stray release changes nothing', stray.state === INITIAL_DEFINITION_STATE && stray.timer === null, 'same state');
}
{
  // R11: a tap opens immediately.
  const { state, timers } = run([{ type: 'tap', id: 'hopeful' }]);
  check('tap opens with no delay (R11)', state.phase === 'open' && state.openId === 'hopeful' && timers[0] === 'clear', state.phase);
  const switched = stepDefinition(state, { type: 'tap', id: 'touched' }).state;
  check('tap switches an open tooltip', switched.openId === 'touched', `${switched.openId}`);
}
{
  const stale = stepDefinition(INITIAL_DEFINITION_STATE, timer);
  check('a stale timer is ignored', stale.state === INITIAL_DEFINITION_STATE, stale.state.phase);
}

// GEOMETRY CHECKS (Task 4) GO HERE

console.log(`\n${failures === 0 ? 'OK' : 'FAIL'} — ${failures} failure(s).`);
process.exit(failures > 0 ? 1 : 0);
