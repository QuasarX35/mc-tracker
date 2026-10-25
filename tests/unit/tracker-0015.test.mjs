// EDICT-0015 unit suite: ordering, custom-material resolution, import/export.
// Fixtures under tests/qa/edict-0015-fixtures/ are frozen by 測試部 (read-only here).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const fixtures = path.join(repo, 'tests', 'qa', 'edict-0015-fixtures');

function loadModel() {
  const sandbox = { console };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const rel of ['src/assets/icons/icons.js', 'src/tracker/model.js']) {
    vm.runInContext(readFileSync(path.join(repo, rel), 'utf8'), sandbox, { filename: rel });
  }
  return sandbox.TrackerModel;
}

const M = loadModel();
const fixtureText = (name) => readFileSync(path.join(fixtures, name), 'utf8');
const fixtureJSON = (name) => JSON.parse(fixtureText(name));
const names = (builds) => builds.map((build) => build.name);
// Model values are created inside the vm realm, so compare plain snapshots.
const plain = (value) => JSON.parse(JSON.stringify(value));

test('a shipped v1 backup imports and keeps no custom registries', () => {
  const result = M.importJSON(fixtureText('v1-backup.json'));
  assert.ok(result.state, result.error);
  assert.equal(result.state.version, 1);
  assert.deepEqual(plain(M.validate(result.state)), []);
  const world = M.activeWorld(result.state);
  assert.ok(world);
  assert.equal(world.customItems, undefined);
  const build = world.builds[0];
  assert.deepEqual(plain(M.resolveItem(result.state, world, build, 'stone')), {
    name: 'Stone',
    stack: 64,
    icon: { kind: 'item', slug: 'stone' },
    custom: false,
    scope: null
  });
});

test('the paste fixture is byte-identical to the v1 backup', () => {
  assert.equal(fixtureText('import-paste.json'), fixtureText('v1-backup.json'));
});

test('version 2 backups are refused whole', () => {
  const future = JSON.stringify({ version: 2, activeWorldId: null, worlds: [] });
  const result = M.importJSON(future);
  assert.equal(result.state, undefined);
  assert.match(result.error, /Unsupported data version\./);
});

test('builds sort building -> planned -> done, stable inside a rank', () => {
  const state = fixtureJSON('route-shuffle.v1.json');
  const world = state.worlds[0];
  const expected = fixtureJSON('route-shuffle.expected-order.json').order;
  assert.deepEqual(plain(names(M.sortBuilds(world.builds))), expected);
  assert.deepEqual(plain(names(world.builds)), [
    'Weekend Cottage',
    'Iron Factory',
    'Wizard Tower',
    'Barn',
    'Nether Road',
    'Greenhouse'
  ], 'the registry itself is never re-ordered by sorting');
});

test('a status change re-sorts without losing the build', () => {
  const state = fixtureJSON('route-shuffle.v1.json');
  const world = state.worlds[0];
  const applied = M.updateBuild(state, world.id, 'b1', { status: 'done' });
  assert.ok(applied.state, applied.error);
  const sorted = M.sortBuilds(M.activeWorld(applied.state).builds);
  assert.deepEqual(plain(names(sorted)), fixtureJSON('route-status-change.expected-order.json').order);
  const changed = sorted.filter((build) => build.id === 'b1')[0];
  assert.equal(changed.status, 'done');
  assert.equal(changed.name, 'Weekend Cottage');
});

test('statusRank keeps unknown statuses in the planned band', () => {
  assert.equal(M.statusRank('building'), 0);
  assert.equal(M.statusRank('planned'), 1);
  assert.equal(M.statusRank('done'), 2);
  assert.equal(M.statusRank('nonsense'), 1);
});

test('the budget fixture resolves its reduced stack sizes', () => {
  const state = fixtureJSON('budget-state.json');
  const world = M.activeWorld(state);
  assert.equal(world.name, 'Budget SMP');
  assert.equal(world.builds.length, 4);
  const carrier = world.builds.filter((build) => build.materials.length > 0)[0];
  assert.equal(carrier.status, 'building');
  const egg = M.resolveItem(state, world, carrier, 'Egg');
  assert.equal(egg.stack, 16);
  const bucket = M.resolveItem(state, world, carrier, 'Water Bucket');
  assert.equal(bucket.stack, 1);
  assert.ok(M.worldSummary(world).needed > 0);
});

test('custom items resolve build -> world -> account, then the catalogue', () => {
  const imported = M.importJSON(fixtureText('custom-items.v1.json'));
  assert.ok(imported.state, imported.error);
  const state = imported.state;
  const world = state.worlds[0];
  const shadowBuild = world.builds.filter((build) => Array.isArray(build.customItems) && build.customItems.length)[0];
  assert.ok(shadowBuild, 'fixture carries a build registry');
  assert.equal(shadowBuild.customItems.filter((entry) => entry.name === 'Deepslate Bricks')[0].stack, 1);
  assert.equal(M.customItem(state, world, shadowBuild, 'Deepslate Bricks').stack, 1);
  assert.deepEqual(plain(M.resolveItem(state, world, shadowBuild, 'Deepslate Bricks')), {
    name: 'Deepslate Bricks',
    stack: 1,
    icon: null,
    custom: true,
    scope: 'build'
  });
  const pillarOwner = world.builds.filter((build) =>
    Array.isArray(build.customItems) && build.customItems.some((entry) => entry.name === 'Pillar Stone'))[0];
  assert.ok(pillarOwner, 'fixture carries an image-icon custom item');
  const pillar = M.resolveItem(state, world, pillarOwner, 'Pillar Stone');
  assert.equal(pillar.stack, 16);
  assert.equal(pillar.icon.kind, 'image');
  assert.match(pillar.icon.dataUrl, /^data:image\/png;base64,/);
  const roof = M.resolveItem(state, world, world.builds[0], 'Roof Tile');
  assert.equal(roof.stack, 64);
  assert.deepEqual(plain(roof.icon), { kind: 'item', slug: 'deepslate_tiles' });
  assert.equal(roof.scope, 'account');
  assert.equal(M.resolveItem(state, world, world.builds[0], 'no such material at all'), null);
});

test('createCustomItem clones the state and reports the four frozen errors', () => {
  const state = M.emptyState();
  const world = { id: 'w1', name: 'W', builds: [], customItems: [] };
  state.worlds.push(world);
  state.activeWorldId = 'w1';
  const build = { id: 'b1', name: 'B', customItems: [], materials: [] };
  world.builds.push(build);
  const before = JSON.stringify(state);

  const account = M.createCustomItem(state, world, build, 'account', { name: '  Roof Tile  ', stack: 32, icon: { kind: 'item', slug: 'deepslate_tiles' } });
  assert.ok(account.state, account.error);
  assert.equal(account.entry.name, 'Roof Tile');
  assert.equal(account.entry.stack, 32);
  assert.equal(JSON.stringify(state), before, 'the argument state is never mutated');
  assert.equal(account.state.customItems.length, 1);
  assert.equal(M.resolveItem(account.state, world, build, 'roof tile').scope, 'account');

  const scoped = M.createCustomItem(account.state, world, build, 'build', { name: 'Pillar Stone', stack: 16 });
  assert.ok(scoped.state, scoped.error);
  assert.equal(scoped.state.worlds[0].builds[0].customItems.length, 1);
  const freshWorld = scoped.state.worlds[0];
  assert.equal(M.resolveItem(scoped.state, freshWorld, freshWorld.builds[0], 'Pillar Stone').scope, 'build');

  const errors = {
    name: M.createCustomItem(state, world, build, 'account', { name: '   ' }),
    stackZero: M.createCustomItem(state, world, build, 'account', { name: 'A', stack: 0 }),
    stackBig: M.createCustomItem(state, world, build, 'account', { name: 'A', stack: 1000 }),
    icon: M.createCustomItem(state, world, build, 'account', { name: 'A', icon: { kind: 'image', dataUrl: 'javascript:alert(1)' } }),
    duplicate: M.createCustomItem(account.state, world, build, 'account', { name: 'ROOF TILE' })
  };
  assert.equal(errors.name.error, 'Custom material needs a name.');
  assert.equal(errors.stackZero.error, 'Stack size must be between 1 and 999.');
  assert.equal(errors.stackBig.error, 'Stack size must be between 1 and 999.');
  assert.equal(errors.icon.error, 'Icon must be a catalogue item or an uploaded image.');
  assert.equal(errors.duplicate.error, 'Name already used by another material.');
  assert.equal(M.createCustomItem(state, { id: 'ghost' }, null, 'world', { name: 'X' }).error, 'Custom material cannot be saved here.');
});

test('invalid fixtures are rejected atomically with the frozen strings', () => {
  const cases = [
    ['invalid-no-name.json', 'Custom material needs a name.'],
    ['invalid-stack-zero.json', 'Stack size must be between 1 and 999.'],
    ['invalid-stack-1000.json', 'Stack size must be between 1 and 999.'],
    ['invalid-duplicate-name.json', 'Name already used by another material.'],
    ['invalid-bad-icon.json', 'Icon must be a catalogue item or an uploaded image.'],
    ['invalid-registry-shape.json', 'must be an array']
  ];
  cases.forEach(([file, needle]) => {
    const result = M.importJSON(fixtureText(file));
    assert.equal(result.state, undefined, file + ' must not import');
    assert.ok(result.error.includes(needle), file + ' -> ' + result.error);
    assert.ok(M.validate(fixtureJSON(file)).length > 0, file + ' must fail validate');
  });
});

test('custom registries round-trip through export and import', () => {
  const imported = M.importJSON(fixtureText('custom-items.v1.json'));
  const exported = M.exportJSON(imported.state);
  const again = M.importJSON(exported);
  assert.ok(again.state, again.error);
  assert.equal(again.state.worlds[0].customItems.length, imported.state.worlds[0].customItems.length);
  assert.equal(again.state.customItems.length, imported.state.customItems.length);
  assert.deepEqual(plain(JSON.parse(M.exportJSON(again.state))), JSON.parse(exported));
});
