/**
 * Unit tests for the build-tracker domain model (兵部, EDICT-0005).
 * The model is a classic script (file:// support), so it is loaded into a vm
 * context rather than imported.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const MODEL_PATH = path.resolve(import.meta.dirname, '..', '..', 'src', 'tracker', 'model.js');
const SOURCE = fs.readFileSync(MODEL_PATH, 'utf8');

function loadModel(extraGlobals = {}) {
  const sandbox = { console, ...extraGlobals };
  vm.createContext(sandbox);
  vm.runInContext(SOURCE, sandbox, { filename: MODEL_PATH });
  return sandbox.TrackerModel;
}

const M = loadModel();
const plain = (value) => JSON.parse(JSON.stringify(value));

test('emptyState has schema version and no worlds', () => {
  const state = M.emptyState();
  assert.equal(state.version, M.SCHEMA);
  assert.deepEqual(plain(state.worlds), []);
  assert.equal(state.activeWorldId, null);
});

test('createWorld validates a name and sets the first world active', () => {
  let state = M.emptyState();
  const failed = M.createWorld(state, { name: '   ' });
  assert.ok(failed.error);
  assert.equal(failed.state, state);

  const created = M.createWorld(state, { name: '  Survival  ', edition: 'java', version: '1.21.4' });
  state = created.state;
  assert.equal(state.worlds.length, 1);
  assert.equal(state.worlds[0].name, 'Survival');
  assert.equal(state.activeWorldId, state.worlds[0].id);
  assert.deepEqual(plain(state.worlds[0].builds), []);
});

test('createWorld is pure: the input state is not mutated', () => {
  const state = M.emptyState();
  M.createWorld(state, { name: 'A' });
  assert.equal(state.worlds.length, 0);
});

test('builds require a world and a name, and default to planned', () => {
  let state = M.createWorld(M.emptyState(), { name: 'W' }).state;
  const worldId = state.worlds[0].id;
  assert.ok(M.createBuild(state, 'nope', { name: 'X' }).error);
  assert.ok(M.createBuild(state, worldId, { name: ' ' }).error);

  const created = M.createBuild(state, worldId, { name: 'Iron Farm', coords: '1 2 3' });
  state = created.state;
  assert.equal(state.worlds[0].builds[0].status, 'planned');
  assert.equal(created.build.name, 'Iron Farm');
});

test('addMaterial merges duplicate items instead of duplicating rows', () => {
  let state = M.createWorld(M.emptyState(), { name: 'W' }).state;
  const worldId = state.worlds[0].id;
  const build = M.createBuild(state, worldId, { name: 'B' });
  state = build.state;
  const buildId = build.build.id;

  state = M.addMaterial(state, worldId, buildId, { item: 'Stone', needed: 10, collected: 2 }).state;
  state = M.addMaterial(state, worldId, buildId, { item: 'stone', needed: 5, collected: 1 }).state;

  const materials = state.worlds[0].builds[0].materials;
  assert.equal(materials.length, 1);
  assert.equal(materials[0].needed, 15);
  assert.equal(materials[0].collected, 3);
});

test('addMaterial rejects empty names and non-positive quantities', () => {
  let state = M.createWorld(M.emptyState(), { name: 'W' }).state;
  const worldId = state.worlds[0].id;
  const build = M.createBuild(state, worldId, { name: 'B' });
  state = build.state;
  assert.ok(M.addMaterial(state, worldId, build.build.id, { item: '', needed: 1 }).error);
  assert.ok(M.addMaterial(state, worldId, build.build.id, { item: 'X', needed: 0 }).error);
  assert.ok(M.addMaterial(state, worldId, build.build.id, { item: 'X', needed: -4 }).error);
});

test('collected above needed is allowed but clamped in progress and aggregation', () => {
  let state = M.createWorld(M.emptyState(), { name: 'W' }).state;
  const worldId = state.worlds[0].id;
  const build = M.createBuild(state, worldId, { name: 'B' });
  state = build.state;
  const added = M.addMaterial(state, worldId, build.build.id, { item: 'Glass', needed: 64, collected: 100 });
  state = added.state;
  const material = state.worlds[0].builds[0].materials[0];

  const progress = M.materialProgress(material);
  assert.equal(progress.collected, 64);
  assert.equal(progress.remaining, 0);
  assert.equal(progress.done, true);

  const rows = M.aggregateWorld(state.worlds[0]);
  assert.equal(rows[0].collected, 64);
  assert.equal(rows[0].remaining, 0);
});

test('aggregateWorld sums the same item across builds and names the builds', () => {
  let state = M.createWorld(M.emptyState(), { name: 'W' }).state;
  const worldId = state.worlds[0].id;
  const one = M.createBuild(state, worldId, { name: 'Farm' });
  state = one.state;
  const two = M.createBuild(state, worldId, { name: 'Hall' });
  state = two.state;
  state = M.addMaterial(state, worldId, one.build.id, { item: 'Stone Bricks', needed: 100, collected: 40 }).state;
  state = M.addMaterial(state, worldId, two.build.id, { item: 'stone bricks', needed: 50, collected: 10 }).state;
  state = M.addMaterial(state, worldId, two.build.id, { item: 'Oak Planks', needed: 20, collected: 20 }).state;

  const rows = M.aggregateWorld(state.worlds[0]);
  const bricks = rows.find((row) => row.item.toLowerCase() === 'stone bricks');
  assert.equal(bricks.needed, 150);
  assert.equal(bricks.collected, 50);
  assert.equal(bricks.remaining, 100);
  assert.deepEqual(plain(bricks.builds).sort(), ['Farm', 'Hall']);
  // gathered items sort after outstanding ones
  assert.equal(rows[rows.length - 1].done, true);
});

test('worldSummary and globalSummary roll up numbers consistently', () => {
  const state = M.seedState();
  const world = state.worlds[0];
  const summary = M.worldSummary(world);
  assert.equal(summary.builds, world.builds.length);
  assert.equal(summary.needed, summary.collected + summary.remaining);

  const global = M.globalSummary(state);
  assert.equal(global.builds, state.worlds.reduce((n, w) => n + w.builds.length, 0));
  assert.ok(global.needed >= summary.needed);
  assert.equal(global.byStatus.done, global.byStatus.done);
});

test('deleteWorld removes its builds and repoints the active world', () => {
  let state = M.seedState();
  const first = state.worlds[0];
  const second = state.worlds[1];
  state = M.deleteWorld(M.setActiveWorld(state, first.id).state, first.id).state;
  assert.equal(state.worlds.length, 1);
  assert.equal(state.activeWorldId, second.id);
  assert.ok(!M.findWorld(state, first.id));
});

test('deleteBuild removes only that build; unknown ids are rejected', () => {
  const state = M.seedState();
  const world = state.worlds[0];
  const buildId = world.builds[0].id;
  const next = M.deleteBuild(state, world.id, buildId).state;
  assert.equal(next.worlds[0].builds.length, world.builds.length - 1);
  assert.ok(M.deleteBuild(state, world.id, 'missing').error);
});

test('export/import round-trips, and import rejects foreign or corrupt data', () => {
  const state = M.seedState();
  const text = M.exportJSON(state);
  const imported = M.importJSON(text);
  assert.ok(!imported.error);
  assert.deepEqual(plain(imported.state), plain(state));

  assert.ok(M.importJSON('not json').error);
  assert.ok(M.importJSON('{"version":1}').error);
  const wrongVersion = M.importJSON(JSON.stringify({ version: 99, worlds: [] }));
  assert.ok(wrongVersion.error);
});

test('validate catches invalid status, quantities and missing ids', () => {
  const state = M.seedState();
  state.worlds[0].builds[0].status = 'nonsense';
  state.worlds[0].builds[0].materials[0].needed = 0;
  const errors = M.validate(state);
  assert.ok(errors.length >= 2);
});

test('load/save round-trips through a storage adapter and reports failures', () => {
  const storage = M.memoryStorage();
  const state = M.seedState();
  assert.equal(M.save(storage, state).ok, true);
  const loaded = M.load(storage);
  assert.deepEqual(plain(loaded.state), plain(state));

  const broken = { getItem: () => '{bad json' };
  assert.ok(M.load(broken).error);
  const full = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
  assert.ok(M.save(full, state).error);
});

test('seedState is self-consistent and useful as a demo', () => {
  const state = M.seedState();
  assert.ok(state.worlds.length >= 2);
  assert.deepEqual(plain(M.validate(state)), []);
  const survival = state.worlds[0];
  assert.ok(survival.builds.length >= 3);
  assert.ok(M.worldSummary(survival).materials >= 6);
  assert.equal(state.activeWorldId, survival.id);
});

