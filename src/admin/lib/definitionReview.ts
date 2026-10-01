// Review aids for the Definitions page. Both lists are a snapshot from the
// word-definition-tooltips branch (2026-09-30); delete them once the copy has
// been reviewed, and the page's matching filters with them.

// The 103 definitions written on that branch (from `git diff` of
// src/data/descriptions.ts against its base, 5a3b3ce).
export const NEWLY_WRITTEN_IDS: ReadonlySet<string> = new Set([
  'worthy', 'valiant', 'intrigued', 'involved', 'fascinated', 'exploring', 'stimulated', 'centered',
  'trusting', 'patient', 'reflective', 'accepting', 'caring', 'empathetic', 'self-loving', 'compassionate',
  'affectionate', 'humbled', 'grace', 'fortunate', 'thankful', 'blessed', 'expectant', 'encouraged',
  'moody', 'grouchy', 'cynical', 'disdain', 'disgruntled', 'impatient', 'bitter', 'edgy', 'contempt',
  'upset', 'disturbed', 'exasperated', 'aggravated', 'agitated', 'vindictive', 'hostile', 'pissed',
  'irate', 'cranky', 'worn-out', 'weary', 'tight', 'on-edge', 'shaken', 'burned-out', 'rattled',
  'frazzled', 'hesitant', 'apprehensive', 'nervous', 'afraid', 'paralyzed', 'frightened', 'panic',
  'terrified', 'questioning', 'unsure', 'skeptical', 'dissatisfied', 'concerned', 'perplexed',
  'suspicious', 'ungrounded', 'rejecting', 'yearning', 'teary', 'unhappy', 'discouraged', 'gloomy',
  'sorrow', 'grief', 'forlorn', 'despondent', 'depressed', 'anguish', 'resistant', 'indifferent',
  'aloof', 'distant', 'listless', 'removed', 'withdrawn', 'lethargic', 'isolated', 'shut-down',
  'inhibited', 'self-conscious', 'weak', 'useless', 'mortified', 'worthless', 'sorry', 'regret',
  'remorseful', 'sensitive', 'victim', 'incapable', 'impotent', 'trapped',
]);

// The ones the content review asked a human to read first, and why.
export const FLAGGED: ReadonlyMap<string, string> = new Map([
  ['worthless', 'Describe the feeling without endorsing it'],
  ['victim', 'Describe the feeling without endorsing it'],
  ['useless', 'Describe the feeling without endorsing it'],
  ['weak', 'Describe the feeling without endorsing it'],
  ['contempt', 'Reads close to disdain'],
  ['disdain', 'Reads close to contempt'],
  ['cranky', 'Reads close to grouchy'],
  ['grouchy', 'Reads close to cranky'],
  ['weary', 'Reads close to worn-out'],
  ['worn-out', 'Reads close to weary'],
  ['worthy', 'Slightly directive ("You can let that be true")'],
  ['vindictive', '"them" has no antecedent'],
  ['perplexed', 'Close to a synonym definition'],
  ['grief', 'Echoes a familiar saying'],
  ['pissed', 'Check the register'],
]);
