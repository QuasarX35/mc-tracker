/**
 * EDICT-0016 fixture generator (測試部, S2).
 *
 * Derives the round-4 fixtures from the frozen EDICT-0015 backup so they are valid against
 * `src/tracker/model.js` by construction, then verifies every one through the real model.
 *
 * Run directly: `node tests/qa/edict-0016-fixtures/make-fixtures.mjs` (never `node --test`).
 * Writes: v1-no-timestamps.json, malformed-timestamps.json, stepper-state.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, '..', '..', '..');
const MODEL_SRC = fs.readFileSync(path.join(ROOT, 'src', 'tracker', 'model.js'), 'utf8');
const sandbox = { module: { exports: {} }, exports: {} };
vm.createContext(sandbox);
vm.runInContext(MODEL_SRC, sandbox, { filename: 'model.js' });
const M = sandbox.module.exports;

// `package.json` marks the repo as ESM, so `require('src/tracker/model.js')` treats the classic
// script as an ES module (no exports) — the model must be loaded through `vm` like every other
// test. Consequence: every array the model returns belongs to the sandbox realm, and
// `assert.deepStrictEqual` rejects even two empty arrays because their prototypes differ.
// Assertions below therefore compare `.length` / `.join('; ')`, never deep equality.
function assertValid(state, label) {
  const errors = M.validate(state);
  assert.equal(errors.length, 0, `${label} must validate: ${errors.join('; ')}`);
}

const SOURCE = path.join(ROOT, 'tests', 'qa', 'edict-0015-fixtures', 'v1-backup.json');
const base = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));

function stripTimestamps(state) {
  const next = JSON.parse(JSON.stringify(state));
  for (const world of next.worlds) {
    delete world.createdAt;
    delete world.updatedAt;
    for (const build of world.builds) {
      delete build.createdAt;
      delete build.updatedAt;
      for (const custom of build.customItems || []) {
        delete custom.createdAt;
        delete custom.updatedAt;
      }
    }
    for (const custom of world.customItems || []) {
      delete custom.createdAt;
      delete custom.updatedAt;
    }
  }
  for (const custom of next.customItems || []) {
    delete custom.createdAt;
    delete custom.updatedAt;
  }
  return next;
}

function withTimestamps(state) {
  const next = JSON.parse(JSON.stringify(state));
  next.worlds[0].createdAt = '2026-09-14T08:05:00.000Z';
  next.worlds[0].updatedAt = '2026-10-25T21:40:00.000Z';
  next.worlds[0].builds[0].createdAt = '2026-09-14T08:06:00.000Z';
  next.worlds[0].builds[0].updatedAt = '2026-10-25T21:41:00.000Z';
  next.worlds[0].builds[0].customItems = [
    {
      id: 'custom-fixture-1',
      name: 'Fixture Slate',
      stack: 64,
      icon: null,
      createdAt: '2026-10-01T10:00:00.000Z',
      updatedAt: '2026-10-20T11:30:00.000Z'
    }
  ];
  return next;
}

/* 1. v1 backup without any timestamps — must import; display must fall back to "—". */
const noStamps = stripTimestamps(base);
assertValid(noStamps, 'v1-no-timestamps');
assert.ok(!('createdAt' in noStamps.worlds[0]), 'the fixture must not carry timestamps');

/* 2. Malformed timestamps — the model does not validate them today, so import succeeds and no
      date may be fabricated from a non-date value (display "—"). The fixture carries a non-date
      string, a number, an impossible ISO date and an empty string so the display helper and any
      validation rule are exercised for every shape. */
const malformed = stripTimestamps(base);
malformed.worlds[0].createdAt = 'yesterday';
malformed.worlds[0].updatedAt = 12345;
malformed.worlds[0].builds[0].createdAt = '2026-13-45T99:99:99Z';
malformed.worlds[0].builds[0].updatedAt = '';
assertValid(malformed, 'malformed-timestamps');

/* 3. Stepper behaviour fixture — materials with distinct stack sizes (64 / 16 / 1) for the
      Shift/Ctrl/wheel/Enter cases, plus valid ISO timestamps for the display-format cases. */
const stepper = withTimestamps(stripTimestamps(base));
stepper.worlds = [stepper.worlds[0]];
stepper.worlds[0].name = 'Stepper Fixture';
stepper.worlds[0].builds = [
  {
    id: 'build-stepper-1',
    name: 'Stepper Build',
    status: 'building',
    coords: '10 / 64 / -20',
    notes: 'Fixture for stepper modifiers, wheel and Enter traversal.',
    createdAt: '2026-09-14T08:06:00.000Z',
    updatedAt: '2026-10-25T21:41:00.000Z',
    materials: [
      { id: 'mat-stone', item: 'Stone Bricks', needed: 384, collected: 200 },
      { id: 'mat-egg', item: 'Egg', needed: 40, collected: 16 },
      { id: 'mat-bucket', item: 'Water Bucket', needed: 8, collected: 1 },
      { id: 'mat-glass', item: 'Glass', needed: 96, collected: 96 }
    ],
    icon: null
  }
];
stepper.activeWorldId = stepper.worlds[0].id;
assertValid(stepper, 'stepper-state');

/* 4. Suggestion-path fixture: a build with no icon at all (the avatar must suggest, not store). */
const noIcon = withTimestamps(stripTimestamps(base));
noIcon.worlds = [noIcon.worlds[0]];
noIcon.worlds[0].name = 'Suggestion Fixture';
noIcon.worlds[0].builds = [
  {
    id: 'build-noicon-1',
    name: 'Iron Farm (Spawn)',
    status: 'building',
    coords: '120 / 64 / -40',
    notes: 'Village-based farm, 3 modules.',
    materials: [
      { id: 'mat-noicon-stone', item: 'Stone Bricks', needed: 384, collected: 200 },
      { id: 'mat-noicon-hopper', item: 'Hopper', needed: 24, collected: 0 }
    ]
  }
];
noIcon.activeWorldId = noIcon.worlds[0].id;
assertValid(noIcon, 'no-icon-state');

/* 5. Compact-matrix fixture: one six-material build (deficit/done mix, a full row) and one
      three-material build (the small-matrix case). */
const compact = withTimestamps(stripTimestamps(base));
compact.worlds = [compact.worlds[0], compact.worlds[1] || JSON.parse(JSON.stringify(compact.worlds[0]))];
compact.worlds[0].name = 'Compact Fixture';
compact.worlds[0].builds = [
  {
    id: 'build-compact-six',
    name: 'Six Mat Wall',
    status: 'building',
    coords: '0 / 70 / 0',
    notes: 'Six materials, mixed states.',
    materials: [
      { id: 'mat-six-stone', item: 'Stone Bricks', needed: 384, collected: 200 },
      { id: 'mat-six-glass', item: 'Glass', needed: 96, collected: 96 },
      { id: 'mat-six-oak', item: 'Oak Planks', needed: 512, collected: 64 },
      { id: 'mat-six-egg', item: 'Egg', needed: 40, collected: 40 },
      { id: 'mat-six-torch', item: 'Torch', needed: 32, collected: 12 },
      { id: 'mat-six-bucket', item: 'Water Bucket', needed: 8, collected: 8 }
    ]
  },
  {
    id: 'build-compact-three',
    name: 'Three Mat Hut',
    status: 'planned',
    coords: '8 / 64 / 8',
    notes: 'Small matrix.',
    materials: [
      { id: 'mat-three-dirt', item: 'Dirt', needed: 64, collected: 20 },
      { id: 'mat-three-cobble', item: 'Cobblestone', needed: 128, collected: 128 },
      { id: 'mat-three-iron', item: 'Iron Ingot', needed: 12, collected: 0 }
    ]
  }
];
compact.worlds[1] = {
  id: 'world-compact-2',
  name: 'Compact Fixture Two',
  edition: 'java',
  version: '1.21.4',
  notes: 'Second world for switching.',
  createdAt: '2026-10-02T09:00:00.000Z',
  updatedAt: '2026-10-24T18:00:00.000Z',
  builds: []
};
compact.activeWorldId = compact.worlds[0].id;
assertValid(compact, 'compact-state');

const files = {
  'v1-no-timestamps.json': noStamps,
  'malformed-timestamps.json': malformed,
  'stepper-state.json': stepper,
  'no-icon-state.json': noIcon,
  'compact-state.json': compact
};

for (const [name, value] of Object.entries(files)) {
  const target = path.join(HERE, name);
  fs.writeFileSync(target, JSON.stringify(value, null, 2) + '\n', 'utf8');
  const imported = M.importJSON(fs.readFileSync(target, 'utf8'));
  assert.ok(!imported.error, `${name} must import: ${imported.error}`);
  console.log(name, '-> import ok,', fs.statSync(target).size, 'bytes');
}

console.log('fixtures regenerated:', Object.keys(files).join(', '));
