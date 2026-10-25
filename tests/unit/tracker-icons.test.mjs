/**
 * Identity unit tests (EDICT-0010): world/build icons as item slugs or inline images.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const MODEL_PATH = path.resolve(import.meta.dirname, '..', '..', 'src', 'tracker', 'model.js');
const SOURCE = fs.readFileSync(MODEL_PATH, 'utf8');
const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(SOURCE, sandbox, { filename: MODEL_PATH });
const M = sandbox.TrackerModel;
const plain = (value) => JSON.parse(JSON.stringify(value));

const ITEM = { kind: 'item', slug: 'stone_bricks' };
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const WEBP = `data:image/webp;base64,${'A'.repeat(400)}`;

function seeded() {
  return M.seedState();
}

test('seed gives worlds and builds item icons from the extracted set', () => {
  const state = seeded();
  assert.deepEqual(plain(state.worlds.map((world) => world.icon.kind)), ['item', 'item']);
  assert.deepEqual(plain(state.worlds.map((world) => world.icon.slug)), ['grass_block', 'glass']);
  for (const world of state.worlds) {
    for (const build of world.builds) {
      assert.equal(build.icon.kind, 'item');
      assert.match(build.icon.slug, /^[a-z0-9_]+$/);
    }
  }
});

test('setWorldIcon stores an item icon and setBuildIcon stores an image icon', () => {
  let state = seeded();
  const world = state.worlds[0];
  const build = world.builds[0];

  let result = M.setWorldIcon(state, world.id, ITEM);
  assert.ok(!result.error);
  state = result.state;
  assert.deepEqual(plain(state.worlds[0].icon), ITEM);

  result = M.setBuildIcon(state, world.id, build.id, { kind: 'image', dataUrl: PNG });
  assert.ok(!result.error, result.error);
  state = result.state;
  assert.deepEqual(plain(state.worlds[0].builds[0].icon), { kind: 'image', dataUrl: PNG });
});

test('icons survive export and import', () => {
  let state = seeded();
  state = M.setBuildIcon(state, state.worlds[0].id, state.worlds[0].builds[0].id, { kind: 'image', dataUrl: WEBP }).state;
  const restored = M.importJSON(M.exportJSON(state));
  assert.ok(!restored.error, restored.error);
  assert.deepEqual(plain(restored.state.worlds[0].builds[0].icon), { kind: 'image', dataUrl: WEBP });
});

test('an icon can be cleared with null and the entity keeps working', () => {
  let state = seeded();
  const world = state.worlds[0];
  state = M.setWorldIcon(state, world.id, ITEM).state;
  const cleared = M.setWorldIcon(state, world.id, null);
  assert.ok(!cleared.error);
  assert.equal(cleared.state.worlds[0].icon, undefined);
  assert.equal(M.validate(cleared.state).length, 0);
});

test('bad icons are refused and leave the state untouched', () => {
  const state = seeded();
  const world = state.worlds[0];
  const build = world.builds[0];
  const cases = [
    [{ kind: 'nope', slug: 'stone' }, /unknown icon kind/i],
    [{ kind: 'item', slug: '../escape' }, /slug is not valid/i],
    [{ kind: 'item', slug: 'UPPER' }, /slug is not valid/i],
    [{ kind: 'item', slug: '' }, /slug is not valid/i],
    [{ kind: 'image', dataUrl: 'https://example.test/x.png' }, /data URL/i],
    [{ kind: 'image', dataUrl: 'data:image/svg+xml;base64,AAAA' }, /data URL/i],
    [{ kind: 'image', dataUrl: 'data:image/png;base64,' + 'A'.repeat(M.ICON_DATA_URL_MAX) }, /too large/i],
    ['not-an-object', /must be an object/i],
  ];
  for (const [icon, expected] of cases) {
    const result = M.setWorldIcon(state, world.id, icon);
    assert.ok(result.error, `expected refusal for ${JSON.stringify(icon).slice(0, 40)}`);
    assert.match(result.error, expected);
    assert.equal(result.state, state, 'state object is not replaced on refusal');
  }
  assert.ok(M.setBuildIcon(state, world.id, build.id, { kind: 'image', dataUrl: 'data:text/html;base64,AA' }).error);
});

test('createWorld and createBuild accept an icon and refuse an invalid one', () => {
  let state = M.emptyState();
  const good = M.createWorld(state, { name: 'Iconed', icon: ITEM });
  assert.ok(!good.error);
  assert.deepEqual(plain(good.world.icon), ITEM);

  const bad = M.createWorld(state, { name: 'Broken', icon: { kind: 'item', slug: 'BAD SLUG' } });
  assert.ok(bad.error);
  assert.equal(bad.state, state);

  const build = M.createBuild(good.state, good.world.id, { name: 'Tower', icon: { kind: 'image', dataUrl: PNG } });
  assert.ok(!build.error, build.error);
  assert.equal(build.build.icon.kind, 'image');
});

test('updateWorld and updateBuild accept icon patches, including clearing', () => {
  const state = seeded();
  const world = state.worlds[0];
  const build = world.builds[0];

  const patched = M.updateWorld(state, world.id, { icon: { kind: 'item', slug: 'diamond' } });
  assert.ok(!patched.error);
  assert.equal(patched.state.worlds[0].icon.slug, 'diamond');

  const cleared = M.updateBuild(patched.state, world.id, build.id, { icon: null });
  assert.ok(!cleared.error);
  assert.equal(cleared.state.worlds[0].builds[0].icon, undefined);

  const refused = M.updateBuild(state, world.id, build.id, { icon: { kind: 'image', dataUrl: 'nope' } });
  assert.ok(refused.error);
});

test('validate names the offending entity and import refuses a corrupt icon', () => {
  const state = seeded();
  state.worlds[0].builds[0].icon = { kind: 'image', dataUrl: 'javascript:alert(1)' };
  const errors = M.validate(state);
  assert.ok(errors.length > 0);
  assert.match(errors[0], /Icon for build "Iron Farm \(spawn\)"/);
  const imported = M.importJSON(JSON.stringify(state));
  assert.ok(imported.error);
  assert.match(imported.error, /not a tracker backup/);
});

test('backups written before icons existed still import (additive, no schema bump)', () => {
  const legacy = {
    version: 1,
    activeWorldId: 'w1',
    worlds: [{
      id: 'w1', name: 'Legacy', edition: 'java', version: '1.20.1', notes: '', createdAt: '2026-01-01T00:00:00Z',
      builds: [{ id: 'b1', name: 'Thing', status: 'planned', coords: '', notes: '', materials: [] }],
    }],
  };
  const imported = M.importJSON(JSON.stringify(legacy));
  assert.ok(!imported.error, imported.error);
  assert.equal(imported.state.worlds[0].icon, undefined);
  assert.equal(imported.state.worlds[0].builds[0].icon, undefined);
  assert.equal(imported.state.version, 1);
});
